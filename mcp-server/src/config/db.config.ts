import fs from 'fs';
import path from 'path';
import os from 'os';

// 确保数据目录存在并生成.gitignore
function ensureDataDir(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    // 自动生成.gitignore，避免用户误提交插件数据
    const gitignorePath = path.join(dirPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, '*\n!.gitignore\n', 'utf8');
    }
  }
  // 验证目录可写
  fs.accessSync(dirPath, fs.constants.W_OK);
  return dirPath;
}

// 延迟初始化数据库路径，避免在模块导入时执行文件系统操作
let _dbPath: string | null = null;
let _backupDir: string | null = null;

function initializePaths() {
  if (_dbPath && _backupDir) return;

  // 获取项目根目录（当前工作目录）
  const PROJECT_ROOT = process.cwd();
  const PROJECT_CLAUDE_DIR = path.join(PROJECT_ROOT, '.claude');
  const GLOBAL_CLAUDE_DIR = path.join(os.homedir(), '.claude', 'story-muse');

  try {
    ensureDataDir(PROJECT_CLAUDE_DIR);
    _dbPath = path.join(PROJECT_CLAUDE_DIR, 'story-muse.db');
    _backupDir = path.join(PROJECT_CLAUDE_DIR, 'backups');
  } catch (e) {
    console.warn('当前项目目录不可写，使用全局数据库存储');
    ensureDataDir(GLOBAL_CLAUDE_DIR);
    _dbPath = path.join(GLOBAL_CLAUDE_DIR, 'global.db');
    _backupDir = path.join(GLOBAL_CLAUDE_DIR, 'backups');
  }

  // 确保备份目录存在
  ensureDataDir(_backupDir);
}

// Getter functions to lazy-load the paths
export function getDBPath(): string {
  initializePaths();
  return _dbPath!;
}

export function getBackupDir(): string {
  initializePaths();
  return _backupDir!;
}

// WAL模式配置
export const DB_CONFIG = {
  readonly: false,
  fileMustExist: false,
  timeout: 5000,
  verbose: undefined
};

// 自动备份配置
export const BACKUP_CONFIG = {
  enabled: true,
  interval: 3600000, // 1小时自动备份一次
  maxBackups: 7, // 保留最近7个备份
};
