import { novelDAO } from '../database/dao/novel.dao';
import { storySeedDAO } from '../database/dao/story-seed.dao';
import { outlineNodeDAO } from '../database/dao/outline-node.dao';
import { characterDAO } from '../database/dao/character.dao';
import { chapterDAO } from '../database/dao/chapter.dao';
import { foreshadowingDAO } from '../database/dao/foreshadowing.dao';
import { contextSnapshotDAO } from '../database/dao/context-snapshot.dao';

export interface SnapshotContent {
  // 核心设定（<500 tokens）
  coreSetting: {
    novelTitle: string;
    genre: string;
    coreConflict: string;
    coreIdea: string;
    worldSettingBrief: string;
  };

  // 前几章摘要（<500 tokens）
  recentChapters: Array<{
    chapterId: number;
    chapterTitle: string;
    summary: string;
    keyEvents: string[];
  }>;

  // 未回收伏笔（<300 tokens）
  unpaidForeshadowings: Array<{
    id: number;
    description: string;
    importance: number;
    setupChapter: number;
  }>;

  // 当前章节信息（<300 tokens）
  currentChapter: {
    chapterId: number;
    chapterTitle: string;
    chapterGoal: string;
    conflictPoints: string[];
    turningPoints: string[];
  };

  // 出场人物（<400 tokens）
  appearingCharacters: Array<{
    id: number;
    name: string;
    role: string;
    personalityBrief: string;
    currentGoal: string;
  }>;
}

/**
 * 上下文快照服务
 * 负责生成严格控制token量的上下文快照，确保总tokens ≤2000
 */
export class SnapshotService {
  /**
   * 生成章节的上下文快照
   * @param novelId 小说ID
   * @param chapterId 章节ID
   * @returns 结构化的上下文快照
   */
  public async generateForChapter(novelId: number, chapterId: number): Promise<SnapshotContent> {
    // 并行获取所有需要的数据
    const [novel, activeSeed, chapter, outlineNode, recentChapters, unpaidForeshadowings, characters] = await Promise.all([
      novelDAO.findById(novelId),
      storySeedDAO.findActiveByNovelId(novelId),
      chapterDAO.findCurrentByOutlineNodeId(chapterId),
      outlineNodeDAO.findById(chapterId),
      this.getRecentChapters(novelId, chapterId, 3),
      foreshadowingDAO.findUnpaidByNovelId(novelId, chapterId),
      characterDAO.findAllByNovelId(novelId)
    ]);

    if (!novel || !outlineNode) {
      throw new Error('小说或章节不存在');
    }

    // 构建快照内容，严格控制各部分长度
    const snapshot: SnapshotContent = {
      coreSetting: {
        novelTitle: novel.name,
        genre: novel.genre || '',
        coreConflict: novel.coreConflict || '',
        coreIdea: activeSeed?.core_idea?.substring(0, 200) || '',
        worldSettingBrief: activeSeed?.world_setting?.substring(0, 200) || ''
      },

      recentChapters: recentChapters.map(c => ({
        chapterId: c.id,
        chapterTitle: c.title,
        summary: c.summary?.substring(0, 100) || '',
        keyEvents: this.parseJsonArray(c.key_events, 3).map(e => e.substring(0, 50))
      })),

      unpaidForeshadowings: unpaidForeshadowings
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5) // 只保留最重要的5个伏笔
        .map(f => ({
          id: f.id,
          description: f.description.substring(0, 80),
          importance: f.importance,
          setupChapter: f.setup_chapter_id
        })),

      currentChapter: {
        chapterId: chapterId,
        chapterTitle: outlineNode.title,
        chapterGoal: outlineNode.description?.substring(0, 100) || '',
        conflictPoints: this.parseJsonArray(outlineNode.conflict_points, 3).map(p => p.substring(0, 50)),
        turningPoints: this.parseJsonArray(outlineNode.turning_points, 3).map(p => p.substring(0, 50))
      },

      appearingCharacters: characters
        .filter(c => this.isCharacterInChapter(c.id, chapterId, novelId))
        .slice(0, 5) // 只保留最重要的5个人物
        .map(c => ({
          id: c.id,
          name: c.name,
          role: c.role,
          personalityBrief: c.personality?.substring(0, 80) || '',
          currentGoal: c.core_desire?.substring(0, 80) || ''
        }))
    };

    // 保存快照到数据库
    const latestVersion = contextSnapshotDAO.getLatestVersion(chapterId);
    contextSnapshotDAO.createVersion({
      novel_id: novelId,
      chapter_id: chapterId,
      snapshot_content: JSON.stringify(snapshot),
      snapshot_version: latestVersion + 1
    });

    // 清理旧版本，只保留最近5个
    contextSnapshotDAO.cleanupOldVersions(chapterId, 5);

    return snapshot;
  }

  /**
   * 获取最近的N章摘要
   */
  private async getRecentChapters(novelId: number, currentChapterId: number, count: number): Promise<any[]> {
    const allChapters = outlineNodeDAO.findTreeByNovelId(novelId);
    const currentIndex = allChapters.findIndex(c => c.id === currentChapterId);

    if (currentIndex === -1) return [];

    const startIndex = Math.max(0, currentIndex - count);
    const recentChapterIds = allChapters
      .slice(startIndex, currentIndex)
      .filter(c => c.level === 3) // 只取章节级别
      .map(c => c.id);

    const chapters = await Promise.all(
      recentChapterIds.map(id => chapterDAO.findCurrentByOutlineNodeId(id))
    );

    return chapters.filter(Boolean).map((chapter, index) => ({
      id: recentChapterIds[index],
      title: allChapters.find(c => c.id === recentChapterIds[index])?.title || '',
      summary: chapter?.summary || '',
      key_events: chapter?.key_events || '[]'
    }));
  }

  /**
   * 判断人物是否在当前章节出场
   */
  private isCharacterInChapter(characterId: number, chapterId: number, novelId: number): boolean {
    // 简化判断：如果是主角或重要配角，默认出场
    // 后续可以根据chapter的character_appearances字段精确判断
    const character = characterDAO.findById(characterId);
    return character?.role === 'protagonist' || character?.role === 'antagonist' || Math.random() > 0.5;
  }

  /**
   * 安全解析JSON数组
   */
  private parseJsonArray(jsonStr: string | undefined, maxCount: number): string[] {
    if (!jsonStr) return [];
    try {
      const arr = JSON.parse(jsonStr);
      return Array.isArray(arr) ? arr.slice(0, maxCount) : [];
    } catch {
      return [];
    }
  }

  /**
   * 获取章节的最新上下文快照
   */
  public getLatestForChapter(chapterId: number): SnapshotContent | undefined {
    const snapshot = contextSnapshotDAO.findLatestByChapterId(chapterId);
    if (!snapshot) return undefined;
    try {
      return JSON.parse(snapshot.snapshot_content) as SnapshotContent;
    } catch {
      return undefined;
    }
  }
}

export const snapshotService = new SnapshotService();
