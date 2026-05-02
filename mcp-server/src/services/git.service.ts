import { exec, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { rebuildDatabase as rebuildDb, initDatabase } from '../database';
import { fileSyncService } from './file-sync.service';
import { novelDAO } from '../database/dao/novel.dao';

export interface GitBranch {
  name: string;
  current: boolean;
  lastCommit?: string;
  lastCommitTime?: string;
  author?: string;
}

export interface GitStatus {
  branch: string;
  modifiedFiles: string[];
  stagedFiles: string[];
  untrackedFiles: string[];
  isClean: boolean;
}

export interface MergeResult {
  success: boolean;
  conflicts?: string[];
  message?: string;
}

/**
 * Git服务类
 * 封装Git操作，支持多分支并行创作
 */
class GitService {
  private projectRoot: string = '';
  private currentBranch: string = '';
  private dbPath: string = '';
  private initialized: boolean = false;

  /**
   * 初始化Git服务
   * @param projectRoot 项目根目录
   */
  public init(projectRoot: string): void {
    this.projectRoot = projectRoot;
    this.dbPath = path.join(projectRoot, '.claude', 'storymuse.db');

    // 检查是否是Git仓库，不是的话初始化
    if (!this.isGitRepository()) {
      this.initGitRepository();
    }

    // 获取当前分支
    this.currentBranch = this.getCurrentBranch();

    // 确保当前分支对应的数据库存在
    this.ensureBranchDatabaseExists();

    this.initialized = true;
    console.log('[Git] 服务初始化完成，当前分支:', this.currentBranch);
  }

  /**
   * 检查是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 检查当前目录是否是Git仓库
   */
  public isGitRepository(): boolean {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.projectRoot,
        stdio: 'ignore'
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 初始化Git仓库
   */
  public initGitRepository(): void {
    execSync('git init', { cwd: this.projectRoot });

    // 创建.gitignore文件
    const gitignoreContent = `
# StoryMuse 忽略文件
.claude/
*.tmp
*.bak
*.swp
.DS_Store
node_modules/

# 数据库文件 - 每个分支有独立的数据库
storymuse-*.db
    `.trim();

    fs.writeFileSync(path.join(this.projectRoot, '.gitignore'), gitignoreContent);

    // 初始提交
    execSync('git add .gitignore', { cwd: this.projectRoot });
    execSync('git commit -m "chore: 初始化StoryMuse项目"', {
      cwd: this.projectRoot,
      env: {
        ...process.env,
        GIT_COMMITTER_NAME: 'StoryMuse',
        GIT_COMMITTER_EMAIL: 'storymuse@example.com',
        GIT_AUTHOR_NAME: 'StoryMuse',
        GIT_AUTHOR_EMAIL: 'storymuse@example.com'
      }
    });

    console.log('[Git] 仓库初始化完成');
  }

  /**
   * 获取当前分支名
   */
  public getCurrentBranch(): string {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();
      this.currentBranch = branch;
      return branch;
    } catch (error) {
      throw new Error(`获取当前分支失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取所有分支列表
   */
  public listBranches(): GitBranch[] {
    try {
      const output = execSync('git branch -la', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      const branches: GitBranch[] = [];
      const lines = output.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        const current = line.startsWith('*');
        const name = line.replace(/^\*?\s+/, '').replace(/^remotes\/origin\//, '');

        // 跳过重复的远程分支
        if (branches.some(b => b.name === name)) continue;

        // 获取分支最后提交信息
        let lastCommit = '';
        let lastCommitTime = '';
        let author = '';

        try {
          const logOutput = execSync(`git log -1 --format="%H|%ci|%an" ${name}`, {
            cwd: this.projectRoot,
            encoding: 'utf8'
          }).trim();
          const [commitHash, commitTime, commitAuthor] = logOutput.split('|');
          lastCommit = commitHash;
          lastCommitTime = commitTime;
          author = commitAuthor;
        } catch (error) {
          // 忽略获取提交信息失败的情况
        }

        branches.push({
          name,
          current,
          lastCommit,
          lastCommitTime,
          author
        });
      }

      return branches;
    } catch (error) {
      throw new Error(`获取分支列表失败: ${(error as Error).message}`);
    }
  }

  /**
   * 创建新分支
   * @param branchName 新分支名
   * @param sourceBranch 源分支，默认当前分支
   */
  public createBranch(branchName: string, sourceBranch?: string): void {
    try {
      const source = sourceBranch || this.currentBranch;

      // 检查分支名是否合法
      if (!/^[a-zA-Z0-9_\-/.]+$/.test(branchName)) {
        throw new Error('分支名只能包含字母、数字、下划线、短横线、斜杠和点');
      }

      // 检查分支是否已存在
      const existingBranches = this.listBranches().map(b => b.name);
      if (existingBranches.includes(branchName)) {
        throw new Error(`分支 ${branchName} 已存在`);
      }

      // 创建并切换到新分支
      execSync(`git checkout -b ${branchName} ${source}`, {
        cwd: this.projectRoot
      });

      this.currentBranch = branchName;

      // 复制当前分支的数据库到新分支
      const sourceDbPath = this.getBranchDbPath(source);
      const targetDbPath = this.getBranchDbPath(branchName);

      if (fs.existsSync(sourceDbPath)) {
        fs.copyFileSync(sourceDbPath, targetDbPath);
      } else {
        // 如果源分支数据库不存在，初始化新数据库
        initDatabase();
      }

      // 切换到新分支的数据库
      this.switchBranchDatabase(branchName);

      console.log(`[Git] 分支 ${branchName} 创建成功`);
    } catch (error) {
      throw new Error(`创建分支失败: ${(error as Error).message}`);
    }
  }

  /**
   * 切换分支
   * @param branchName 要切换的分支名
   * @param force 是否强制切换（丢弃未提交的改动）
   */
  public async switchBranch(branchName: string, force: boolean = false): Promise<void> {
    try {
      // 检查分支是否存在
      const existingBranches = this.listBranches().map(b => b.name);
      if (!existingBranches.includes(branchName)) {
        throw new Error(`分支 ${branchName} 不存在`);
      }

      if (branchName === this.currentBranch) {
        return; // 已经是当前分支，不需要切换
      }

      // 检查工作区是否干净
      const status = this.getStatus();
      if (!status.isClean && !force) {
        throw new Error('工作区有未提交的改动，请先提交或 stash 后再切换分支，或使用 force 参数强制切换');
      }

      // 保存当前工作进度（如果有改动且不强制切换）
      if (!status.isClean && !force) {
        try {
          execSync('git stash push -m "StoryMuse 自动 stash（切换分支前）"', {
            cwd: this.projectRoot
          });
          console.log('[Git] 自动 stash 当前改动');
        } catch (error) {
          // stash失败，继续切换
        }
      }

      // 停止文件监控
      fileSyncService.stopWatching();

      // 切换分支
      execSync(`git checkout ${branchName}${force ? ' -f' : ''}`, {
        cwd: this.projectRoot
      });

      this.currentBranch = branchName;

      // 切换到对应分支的数据库
      this.switchBranchDatabase(branchName);

      // 重新启动文件监控
      const configPath = path.join(this.projectRoot, '.story-muse.config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.novelId) {
          fileSyncService.startWatching(this.projectRoot, config.novelId);
        }
      }

      console.log(`[Git] 已切换到分支 ${branchName}`);
    } catch (error) {
      throw new Error(`切换分支失败: ${(error as Error).message}`);
    }
  }

  /**
   * 删除分支
   * @param branchName 要删除的分支名
   * @param force 是否强制删除
   */
  public deleteBranch(branchName: string, force: boolean = false): void {
    try {
      // 不能删除当前分支
      if (branchName === this.currentBranch) {
        throw new Error('不能删除当前所在分支，请先切换到其他分支');
      }

      // 检查分支是否存在
      const existingBranches = this.listBranches().map(b => b.name);
      if (!existingBranches.includes(branchName)) {
        throw new Error(`分支 ${branchName} 不存在`);
      }

      // 删除分支
      execSync(`git branch ${force ? '-D' : '-d'} ${branchName}`, {
        cwd: this.projectRoot
      });

      // 删除对应的数据库文件
      const branchDbPath = this.getBranchDbPath(branchName);
      if (fs.existsSync(branchDbPath)) {
        fs.unlinkSync(branchDbPath);
      }

      console.log(`[Git] 分支 ${branchName} 已删除`);
    } catch (error) {
      throw new Error(`删除分支失败: ${(error as Error).message}`);
    }
  }

  /**
   * 合并分支
   * @param sourceBranch 源分支
   * @param targetBranch 目标分支，默认当前分支
   */
  public mergeBranch(sourceBranch: string, targetBranch?: string): MergeResult {
    try {
      const target = targetBranch || this.currentBranch;

      // 如果目标分支不是当前分支，先切换过去
      if (target !== this.currentBranch) {
        throw new Error('合并操作只能在当前分支进行，请先切换到目标分支');
      }

      // 检查工作区是否干净
      const status = this.getStatus();
      if (!status.isClean) {
        throw new Error('工作区有未提交的改动，请先提交后再合并');
      }

      // 执行合并
      try {
        execSync(`git merge ${sourceBranch} --no-edit`, {
          cwd: this.projectRoot,
          stdio: 'pipe'
        });

        // 合并成功，同步数据库
        // TODO: 实现更智能的数据库合并策略，现在简单使用源分支数据库覆盖
        const sourceDbPath = this.getBranchDbPath(sourceBranch);
        const targetDbPath = this.getBranchDbPath(target);
        if (fs.existsSync(sourceDbPath)) {
          fs.copyFileSync(sourceDbPath, targetDbPath);
        }

        return {
          success: true,
          message: `分支 ${sourceBranch} 已成功合并到 ${target}`
        };
      } catch (mergeError: any) {
        // 检查是否有冲突
        if (mergeError.status === 1) {
          // 获取冲突文件列表
          const conflictOutput = execSync('git diff --name-only --diff-filter=U', {
            cwd: this.projectRoot,
            encoding: 'utf8'
          });
          const conflicts = conflictOutput.split('\n').filter(line => line.trim() !== '');

          // 中止合并
          execSync('git merge --abort', { cwd: this.projectRoot });

          return {
            success: false,
            conflicts,
            message: `合并失败，存在 ${conflicts.length} 个冲突文件，请手动解决后再合并`
          };
        }
        throw mergeError;
      }
    } catch (error) {
      return {
        success: false,
        message: `合并分支失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取工作区状态
   */
  public getStatus(): GitStatus {
    try {
      const output = execSync('git status --porcelain', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      const modifiedFiles: string[] = [];
      const stagedFiles: string[] = [];
      const untrackedFiles: string[] = [];

      const lines = output.split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        const status = line.slice(0, 2);
        const filePath = line.slice(3).trim();

        if (status === '??') {
          untrackedFiles.push(filePath);
        } else if (status.startsWith('M') || status.startsWith('A') || status.startsWith('D')) {
          if (status[0] !== ' ') {
            stagedFiles.push(filePath);
          }
          if (status[1] !== ' ') {
            modifiedFiles.push(filePath);
          }
        }
      }

      return {
        branch: this.getCurrentBranch(),
        modifiedFiles,
        stagedFiles,
        untrackedFiles,
        isClean: modifiedFiles.length === 0 && stagedFiles.length === 0 && untrackedFiles.length === 0
      };
    } catch (error) {
      throw new Error(`获取工作区状态失败: ${(error as Error).message}`);
    }
  }

  /**
   * 提交当前改动
   * @param message 提交信息
   */
  public commit(message: string): string {
    try {
      // 添加所有改动
      execSync('git add .', { cwd: this.projectRoot });

      // 提交
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: this.projectRoot,
        env: {
          ...process.env,
          GIT_COMMITTER_NAME: 'StoryMuse',
          GIT_COMMITTER_EMAIL: 'storymuse@example.com',
          GIT_AUTHOR_NAME: 'StoryMuse',
          GIT_AUTHOR_EMAIL: 'storymuse@example.com'
        }
      });

      // 获取最新commit hash
      const commitHash = execSync('git rev-parse HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      console.log(`[Git] 提交成功: ${commitHash}`);
      return commitHash;
    } catch (error) {
      throw new Error(`提交失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取分支对应的数据库路径
   */
  private getBranchDbPath(branchName: string): string {
    const dbDir = path.join(this.projectRoot, '.claude');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    // 替换分支名中的特殊字符
    const safeBranchName = branchName.replace(/[^\w\-/.]/g, '_');
    return path.join(dbDir, `storymuse-${safeBranchName}.db`);
  }

  /**
   * 确保当前分支的数据库存在
   */
  private ensureBranchDatabaseExists(): void {
    const branchDbPath = this.getBranchDbPath(this.currentBranch);
    if (!fs.existsSync(branchDbPath)) {
      // 如果当前分支没有数据库，尝试从主分支复制，或者创建新的
      const mainDbPath = this.getBranchDbPath('main');
      const masterDbPath = this.getBranchDbPath('master');

      if (fs.existsSync(mainDbPath)) {
        fs.copyFileSync(mainDbPath, branchDbPath);
      } else if (fs.existsSync(masterDbPath)) {
        fs.copyFileSync(masterDbPath, branchDbPath);
      } else {
        // 初始化新数据库
        initDatabase();
      }
    }

    // 创建软链接到当前数据库
    this.updateCurrentDbSymlink(branchDbPath);
  }

  /**
   * 切换分支数据库
   */
  private switchBranchDatabase(branchName: string): void {
    const branchDbPath = this.getBranchDbPath(branchName);
    if (!fs.existsSync(branchDbPath)) {
      throw new Error(`分支 ${branchName} 的数据库不存在`);
    }

    // 更新软链接
    this.updateCurrentDbSymlink(branchDbPath);

    // 重新初始化数据库连接
    rebuildDb();
    initDatabase();
  }

  /**
   * 更新当前数据库的软链接
   */
  private updateCurrentDbSymlink(targetPath: string): void {
    const currentDbPath = path.join(this.projectRoot, '.claude', 'storymuse.db');

    // 删除现有链接或文件
    if (fs.existsSync(currentDbPath)) {
      fs.unlinkSync(currentDbPath);
    }

    // 创建软链接
    try {
      fs.symlinkSync(path.basename(targetPath), currentDbPath);
    } catch (error) {
      // Windows不支持软链接的话，直接复制文件
      fs.copyFileSync(targetPath, currentDbPath);
    }
  }
}

export const gitService = new GitService();

// 兼容旧接口
export async function initGitService(projectRoot: string = process.cwd()) {
  try {
    gitService.init(projectRoot);
    return true;
  } catch (error) {
    console.log('Git服务初始化失败，分支适配功能已禁用:', error);
    return false;
  }
}

export async function getGitBranchInfo() {
  try {
    if (!gitService.isInitialized()) {
      return {
        isGitRepo: false,
        branchName: 'default',
        commitHash: null
      };
    }

    const currentBranch = gitService.getCurrentBranch();
    const lastCommit = execSync('git rev-parse HEAD', {
      cwd: process.cwd(),
      encoding: 'utf8'
    }).trim();

    return {
      isGitRepo: true,
      branchName: currentBranch,
      commitHash: lastCommit.substring(0, 8)
    };
  } catch (error) {
    return {
      isGitRepo: false,
      branchName: 'default',
      commitHash: null
    };
  }
}

export async function handleBranchSwitch(newBranch: string) {
  try {
    console.log(`检测到分支切换到: ${newBranch}`);
    if (gitService.isInitialized()) {
      await gitService.switchBranch(newBranch);
    }
  } catch (error) {
    console.error('处理分支切换失败:', error);
  }
}

