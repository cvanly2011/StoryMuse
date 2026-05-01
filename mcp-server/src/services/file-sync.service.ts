import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { novelDAO } from '../database/dao/novel.dao';
import { storySeedDAO } from '../database/dao/story-seed.dao';
import { outlineNodeDAO } from '../database/dao/outline-node.dao';
import { characterDAO } from '../database/dao/character.dao';
import { chapterDAO } from '../database/dao/chapter.dao';

export interface SyncResult {
  success: boolean;
  filePath: string;
  changes?: string[];
  error?: string;
}

/**
 * 文件同步服务
 * 负责监控本地Markdown文件的变化，自动同步到数据库
 */
export class FileSyncService {
  private watcher: chokidar.FSWatcher | null = null;
  private projectRoot: string = '';
  private novelId: number | null = null;
  private isSyncing: boolean = false;

  /**
   * 启动文件监控
   */
  public startWatching(projectRoot: string, novelId: number): void {
    if (this.watcher) {
      this.stopWatching();
    }

    this.projectRoot = projectRoot;
    this.novelId = novelId;

    // 监控所有Markdown文件
    this.watcher = chokidar.watch('**/*.md', {
      cwd: projectRoot,
      ignoreInitial: true,
      ignored: [
        'node_modules/**',
        '.git/**',
        '.claude/**',
        '**/*.tmp.md',
        '**/*~'
      ]
    });

    // 监听文件变化
    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath, 'add'))
      .on('change', (filePath) => this.handleFileChange(filePath, 'change'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'unlink'));

    console.log(`[FileSync] 开始监控项目目录：${projectRoot}`);
  }

  /**
   * 停止文件监控
   */
  public stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('[FileSync] 已停止文件监控');
    }
  }

  /**
   * 处理文件变化
   */
  private async handleFileChange(filePath: string, changeType: 'add' | 'change' | 'unlink'): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const fullPath = path.join(this.projectRoot, filePath);
      console.log(`[FileSync] 检测到文件${changeType}：${filePath}`);

      switch (changeType) {
        case 'add':
        case 'change':
          await this.syncFile(fullPath);
          break;
        case 'unlink':
          await this.handleFileDelete(fullPath);
          break;
      }
    } catch (error) {
      console.error(`[FileSync] 同步文件失败：${error}`);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 同步单个文件到数据库
   */
  public async syncFile(filePath: string): Promise<SyncResult> {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    try {
      // 根据文件名判断文件类型
      if (fileName === 'story-seed.md') {
        return await this.syncStorySeed(filePath, content);
      } else if (fileName === 'outline.md') {
        return await this.syncOutline(filePath, content);
      } else if (fileName === 'characters.md') {
        return await this.syncCharacters(filePath, content);
      } else if (fileName.startsWith('第') && fileName.endsWith('章.md')) {
        return await this.syncChapter(filePath, content);
      } else if (fileName.match(/^\d+\.md$/)) { // 数字命名的章节
        return await this.syncChapter(filePath, content);
      }

      return {
        success: true,
        filePath,
        changes: ['文件无需同步']
      };
    } catch (error) {
      return {
        success: false,
        filePath,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 同步故事种子文件
   */
  private async syncStorySeed(filePath: string, content: string): Promise<SyncResult> {
    if (!this.novelId) throw new Error('小说ID未设置');

    // 解析内容
    const coreIdea = this.extractSection(content, '核心创意|故事内核') || content.substring(0, 500);
    const worldSetting = this.extractSection(content, '世界观设定|世界设定') || '';
    const coreCharacters = this.extractSection(content, '核心人物|人物设定') || '';
    const sellingPoints = this.extractSection(content, '核心卖点|作品亮点') || '';

    // 创建新版本
    const latestVersion = storySeedDAO.getLatestVersion(this.novelId);
    const newVersion = latestVersion + 1;

    const seedId = storySeedDAO.insert({
      novel_id: this.novelId,
      version: newVersion,
      core_idea: coreIdea,
      world_setting: worldSetting,
      core_characters_silhouette: coreCharacters,
      selling_points: sellingPoints,
      is_active: true
    });

    // 将旧版本设为非激活
    if (latestVersion > 0) {
      storySeedDAO.updateBy(
        { novel_id: this.novelId, version: latestVersion },
        { is_active: false }
      );
    }

    return {
      success: true,
      filePath,
      changes: [`故事种子已同步到版本 ${newVersion}`]
    };
  }

  /**
   * 同步大纲文件
   */
  private async syncOutline(filePath: string, content: string): Promise<SyncResult> {
    if (!this.novelId) throw new Error('小说ID未设置');

    // 解析大纲结构
    const outlineNodes = this.parseOutline(content);
    const changes: string[] = [];

    // 开启事务更新
    outlineNodeDAO.transaction(() => {
      // 先删除现有大纲
      outlineNodeDAO.deleteBy({ novel_id: this.novelId });

      // 插入新大纲节点
      for (const node of outlineNodes) {
        const nodeId = outlineNodeDAO.insert({
          novel_id: this.novelId,
          parent_id: node.parentId,
          level: node.level,
          order: node.order,
          title: node.title,
          description: node.description,
          character_goals: node.characterGoals,
          conflict_points: node.conflictPoints,
          turning_points: node.turningPoints,
          foreshadowing_hints: node.foreshadowingHints,
          word_count_target: node.wordCountTarget,
          status: 'pending',
          path: node.path
        });
        changes.push(`已导入：${node.title}`);
      }
    });

    return {
      success: true,
      filePath,
      changes
    };
  }

  /**
   * 同步人物设定文件
   */
  private async syncCharacters(filePath: string, content: string): Promise<SyncResult> {
    if (!this.novelId) throw new Error('小说ID未设置');

    // 解析人物列表
    const characters = this.parseCharacters(content);
    const changes: string[] = [];

    // 开启事务更新
    characterDAO.transaction(() => {
      // 先标记所有人物为已归档
      characterDAO.updateBy({ novel_id: this.novelId }, { is_archived: true });

      // 插入或更新人物
      for (const char of characters) {
        const existing = characterDAO.findByName(this.novelId, char.name);
        if (existing) {
          characterDAO.update(existing.id, {
            ...char,
            is_archived: false,
            updated_at: new Date().toISOString()
          });
          changes.push(`已更新：${char.name}`);
        } else {
          const charId = characterDAO.insert({
            ...char,
            novel_id: this.novelId,
            is_archived: false
          });
          changes.push(`已添加：${char.name}`);
        }
      }
    });

    return {
      success: true,
      filePath,
      changes
    };
  }

  /**
   * 同步章节文件
   */
  private async syncChapter(filePath: string, content: string): Promise<SyncResult> {
    if (!this.novelId) throw new Error('小说ID未设置');

    const fileName = path.basename(filePath);
    // 解析章节号
    const chapterMatch = fileName.match(/第(\d+)章/) || fileName.match(/^(\d+)\.md$/);
    if (!chapterMatch) {
      return { success: false, filePath, error: '无法识别章节号' };
    }

    const chapterNumber = parseInt(chapterMatch[1], 10);
    // 查找对应的大纲节点
    const allChapters = outlineNodeDAO.findByLevel(this.novelId, 3);
    const chapterNode = allChapters.find(c => c.order === chapterNumber);

    if (!chapterNode) {
      return {
        success: false,
        filePath,
        error: `找不到对应第${chapterNumber}章的大纲节点，请先同步outline.md`
      };
    }

    // 提取章节摘要和关键事件（简化实现）
    const summary = content.split('\n')[0] || content.substring(0, 200);
    const keyEvents = JSON.stringify(this.extractKeyEvents(content));
    const characterAppearances = JSON.stringify(this.extractCharacterAppearances(content));

    // 创建新版本
    const latestVersion = chapterDAO.getLatestVersion(chapterNode.id);
    const newVersion = latestVersion + 1;

    const chapterId = chapterDAO.createVersion({
      outline_node_id: chapterNode.id,
      version: newVersion,
      content,
      word_count: content.length,
      summary,
      key_events: keyEvents,
      character_appearances: characterAppearances
    });

    return {
      success: true,
      filePath,
      changes: [`章节内容已同步到版本 ${newVersion}`]
    };
  }

  /**
   * 处理文件删除
   */
  private async handleFileDelete(filePath: string): Promise<SyncResult> {
    const fileName = path.basename(filePath);
    // 目前不处理文件删除，避免误删数据
    return {
      success: true,
      filePath,
      changes: ['文件删除不同步到数据库']
    };
  }

  /**
   * 提取指定章节的内容
   */
  private extractSection(content: string, sectionNames: string): string | undefined {
    const names = sectionNames.split('|');
    for (const name of names) {
      const regex = new RegExp(`(?:^|\\n)#{1,3}\\s*${name}[^\\n]*\\n([\\s\\S]*?)(?=\\n#{1,3}|$)`, 'i');
      const match = content.match(regex);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  /**
   * 解析大纲结构
   */
  private parseOutline(content: string): any[] {
    // 简化实现，后续完善Markdown大纲解析
    const lines = content.split('\n');
    const nodes: any[] = [];
    const stack: any[] = [];
    let order = 1;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        // 调整栈层级
        while (stack.length >= level) {
          stack.pop();
        }

        const parent = stack[stack.length - 1];
        const node = {
          parentId: parent?.id || null,
          level,
          order: level === 3 ? order++ : 0, // 章节级别（level=3）才有order
          title,
          description: '',
          characterGoals: '',
          conflictPoints: '',
          turningPoints: '',
          foreshadowingHints: '',
          wordCountTarget: 0,
          path: parent ? `${parent.path}/${nodes.length + 1}` : `${nodes.length + 1}`
        };

        nodes.push(node);
        stack.push({ ...node, id: nodes.length }); // 临时ID
      }
    }

    return nodes;
  }

  /**
   * 解析人物设定
   */
  private parseCharacters(content: string): any[] {
    // 简化实现
    const characters: any[] = [];
    const sections = content.split(/^##\s+/m).slice(1); // 按二级标题分割

    for (const section of sections) {
      const lines = section.split('\n');
      const name = lines[0].trim();
      if (!name) continue;

      const content = lines.slice(1).join('\n');
      const role = this.extractField(content, '角色|身份|定位') || 'supporting';
      const personality = this.extractField(content, '性格|特点|个性') || '';
      const coreDesire = this.extractField(content, '目标|需求|欲望') || '';
      const coreFear = this.extractField(content, '恐惧|弱点|害怕') || '';
      const characterArc = this.extractField(content, '人物弧光|成长线|转变') || '';
      const backstory = this.extractField(content, '背景|经历|过往') || '';

      characters.push({
        name,
        role: this.normalizeRole(role),
        personality,
        core_desire: coreDesire,
        core_fear: coreFear,
        character_arc: characterArc,
        backstory
      });
    }

    return characters;
  }

  /**
   * 提取字段
   */
  private extractField(content: string, fieldNames: string): string | undefined {
    const names = fieldNames.split('|');
    for (const name of names) {
      const regex = new RegExp(`(?:^|\\n)\\s*[*•-]?\\s*${name}\\s*[：:：]\\s*([^\\n]+)`, 'i');
      const match = content.match(regex);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  /**
   * 标准化角色类型
   */
  private normalizeRole(role: string): 'protagonist' | 'antagonist' | 'supporting' | 'guest' | 'npc' {
    const roleLower = role.toLowerCase();
    if (roleLower.includes('主角') || roleLower.includes('protagonist')) return 'protagonist';
    if (roleLower.includes('反派') || roleLower.includes('antagonist')) return 'antagonist';
    if (roleLower.includes('配角') || roleLower.includes('supporting')) return 'supporting';
    if (roleLower.includes('客串') || roleLower.includes('guest')) return 'guest';
    return 'npc';
  }

  /**
   * 提取关键事件
   */
  private extractKeyEvents(content: string): string[] {
    // 简化实现
    const events: string[] = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') && trimmed.length > 10) {
        events.push(trimmed.substring(1).trim());
        if (events.length >= 5) break; // 最多提取5个关键事件
      }
    }
    return events;
  }

  /**
   * 提取出场人物
   */
  private extractCharacterAppearances(content: string): any[] {
    // 简化实现
    return [];
  }

  /**
   * 全量同步所有文件
   */
  public async syncAll(): Promise<SyncResult[]> {
    if (!this.projectRoot || !this.novelId) {
      throw new Error('项目目录或小说ID未设置');
    }

    const results: SyncResult[] = [];

    // 同步核心文件
    const coreFiles = ['story-seed.md', 'outline.md', 'characters.md'];
    for (const file of coreFiles) {
      const fullPath = path.join(this.projectRoot, file);
      if (fs.existsSync(fullPath)) {
        const result = await this.syncFile(fullPath);
        results.push(result);
      }
    }

    // 同步章节文件
    const chaptersDir = path.join(this.projectRoot, 'chapters');
    if (fs.existsSync(chaptersDir)) {
      const chapterFiles = fs.readdirSync(chaptersDir)
        .filter(file => file.endsWith('.md'))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.match(/\d+/)?.[0] || '0');
          return numA - numB;
        });

      for (const file of chapterFiles) {
        const fullPath = path.join(chaptersDir, file);
        const result = await this.syncFile(fullPath);
        results.push(result);
      }
    }

    return results;
  }
}

export const fileSyncService = new FileSyncService();
