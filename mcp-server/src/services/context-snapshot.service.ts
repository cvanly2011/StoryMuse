import { contextSnapshotDAO } from '../database/dao/context-snapshot.dao';
import { storySeedDAO } from '../database/dao/story-seed.dao';
import { chapterDAO } from '../database/dao/chapter.dao';
import { foreshadowingDAO } from '../database/dao/foreshadowing.dao';
import { characterDAO } from '../database/dao/character.dao';
import { outlineNodeDAO } from '../database/dao/outline-node.dao';
import { countTokens, truncateToTokenLimit } from '../utils/token.utils';

export interface SnapshotContent {
  coreInfo: {
    coreIdea: string;
    worldSetting: string;
    coreCharacters: string;
  };
  recentPlot: Array<{
    chapterTitle: string;
    chapterNumber: number;
    summary: string;
  }>;
  currentChapter: {
    title: string;
    chapterNumber: number;
    summary: string;
  };
  unresolvedForeshadowing: Array<{
    description: string;
    setupChapter: string;
    importance: number;
  }>;
  keyCharacters: Array<{
    name: string;
    role: string;
    currentState: string;
  }>;
}

/**
 * 上下文快照服务
 * 生成严格控制token数量(≤2000)的上下文快照，用于AI写作辅助
 */
class ContextSnapshotService {
  private readonly MAX_TOKENS = 2000;
  private readonly MAX_RECENT_CHAPTERS = 3; // 最多包含最近3章的摘要
  private readonly MAX_FORESADOWING = 5; // 最多包含5个重要的未回收伏笔
  private readonly MAX_CHARACTERS = 10; // 最多包含10个关键人物

  /**
   * 为指定章节生成上下文快照
   */
  public async generateSnapshot(chapterId: number, novelId: number): Promise<string> {
    try {
      // 1. 收集所有需要的信息
      const coreInfo = await this.getCoreInfo(novelId);
      const recentPlot = await this.getRecentPlot(novelId, chapterId);
      const currentChapter = await this.getCurrentChapterInfo(chapterId);
      const unresolvedForeshadowing = await this.getUnresolvedForeshadowing(novelId);
      const keyCharacters = await this.getKeyCharacters(novelId);

      // 2. 构建内容对象
      const content: SnapshotContent = {
        coreInfo,
        recentPlot,
        currentChapter,
        unresolvedForeshadowing,
        keyCharacters
      };

      // 3. 转换为JSON字符串，检查token数量
      let jsonContent = JSON.stringify(content, null, 2);
      let tokenCount = countTokens(jsonContent);

      // 4. 如果超过token限制，逐步精简内容
      if (tokenCount > this.MAX_TOKENS) {
        jsonContent = await this.truncateContent(content, this.MAX_TOKENS);
      }

      // 5. 保存到数据库
      const latestVersion = contextSnapshotDAO.getLatestVersion(chapterId);
      const newVersion = latestVersion + 1;

      contextSnapshotDAO.createVersion({
        novel_id: novelId,
        chapter_id: chapterId,
        snapshot_content: jsonContent,
        snapshot_version: newVersion
      });

      // 6. 清理旧版本，只保留最近5个
      contextSnapshotDAO.cleanupOldVersions(chapterId, 5);

      return jsonContent;
    } catch (error) {
      console.error('生成上下文快照失败:', error);
      throw error;
    }
  }

  /**
   * 获取最新的上下文快照
   */
  public async getLatestSnapshot(chapterId: number): Promise<string | null> {
    const snapshot = contextSnapshotDAO.findLatestByChapterId(chapterId);
    return snapshot ? snapshot.snapshot_content : null;
  }

  /**
   * 获取核心故事信息
   */
  private async getCoreInfo(novelId: number): Promise<SnapshotContent['coreInfo']> {
    const latestSeed = storySeedDAO.getLatest(novelId);
    if (!latestSeed) {
      return {
        coreIdea: '',
        worldSetting: '',
        coreCharacters: ''
      };
    }

    return {
      coreIdea: latestSeed.core_idea,
      worldSetting: latestSeed.world_setting || '',
      coreCharacters: latestSeed.core_characters_silhouette || ''
    };
  }

  /**
   * 获取最近章节的情节摘要
   */
  private async getRecentPlot(novelId: number, currentChapterId: number): Promise<SnapshotContent['recentPlot']> {
    // 获取当前章节的信息
    const currentChapterNode = outlineNodeDAO.findById(currentChapterId);
    if (!currentChapterNode) return [];

    // 获取当前章节的order（章节号）
    const currentChapterOrder = currentChapterNode.order;
    // 计算需要获取的最近章节范围
    const startChapterOrder = Math.max(1, currentChapterOrder - this.MAX_RECENT_CHAPTERS);

    // 获取范围内的所有章节节点
    const allChapters = outlineNodeDAO.findByLevel(novelId, 3);
    const recentChapterNodes = allChapters
      .filter(c => c.order >= startChapterOrder && c.order < currentChapterOrder)
      .sort((a, b) => a.order - b.order);

    // 获取这些章节的内容摘要
    const recentPlot: SnapshotContent['recentPlot'] = [];
    for (const node of recentChapterNodes) {
      const latestChapter = chapterDAO.getLatestByOutlineNodeId(node.id);
      if (latestChapter) {
        recentPlot.push({
          chapterTitle: node.title,
          chapterNumber: node.order,
          summary: latestChapter.summary
        });
      }
    }

    return recentPlot;
  }

  /**
   * 获取当前章节的信息
   */
  private async getCurrentChapterInfo(chapterId: number): Promise<SnapshotContent['currentChapter']> {
    const chapterNode = outlineNodeDAO.findById(chapterId);
    if (!chapterNode) {
      return {
        title: '',
        chapterNumber: 0,
        summary: ''
      };
    }

    const latestChapter = chapterDAO.getLatestByOutlineNodeId(chapterId);
    return {
      title: chapterNode.title,
      chapterNumber: chapterNode.order,
      summary: latestChapter?.summary || ''
    };
  }

  /**
   * 获取未回收的重要伏笔
   */
  private async getUnresolvedForeshadowing(novelId: number): Promise<SnapshotContent['unresolvedForeshadowing']> {
    // 获取未回收的重要伏笔（importance ≥7）
    const foreshadowings = foreshadowingDAO.findUnpaidByNovelId(novelId, undefined, 7);
    const topForeshadowings = foreshadowings.slice(0, this.MAX_FORESADOWING);

    return Promise.all(
      topForeshadowings.map(async (f) => {
        const setupChapter = outlineNodeDAO.findById(f.setup_chapter_id);
        return {
          description: f.description,
          setupChapter: setupChapter?.title || `第${setupChapter?.order}章` || '未知章节',
          importance: f.importance
        };
      })
    );
  }

  /**
   * 获取关键人物信息
   */
  private async getKeyCharacters(novelId: number): Promise<SnapshotContent['keyCharacters']> {
    // 获取所有非归档人物，按角色重要性排序（主角→反派→配角→其他）
    const characters = characterDAO.findAllByNovelId(novelId, false);
    const sortedCharacters = characters.sort((a, b) => {
      const roleOrder: Record<string, number> = {
        'protagonist': 0,
        'antagonist': 1,
        'supporting': 2,
        'guest': 3,
        'npc': 4
      };
      return (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
    });

    const topCharacters = sortedCharacters.slice(0, this.MAX_CHARACTERS);
    return topCharacters.map(c => ({
      name: c.name,
      role: c.role,
      currentState: c.personality?.slice(0, 50) || '' // 精简人物信息
    }));
  }

  /**
   * 逐步精简内容到token限制
   */
  private async truncateContent(content: SnapshotContent, maxTokens: number): Promise<string> {
    let truncatedContent = { ...content };
    let jsonStr = JSON.stringify(truncatedContent, null, 2);
    let tokenCount = countTokens(jsonStr);

    // 第一步：减少伏笔数量
    if (tokenCount > maxTokens) {
      truncatedContent.unresolvedForeshadowing = truncatedContent.unresolvedForeshadowing.slice(0, 3);
      jsonStr = JSON.stringify(truncatedContent, null, 2);
      tokenCount = countTokens(jsonStr);
    }

    // 第二步：减少人物数量
    if (tokenCount > maxTokens) {
      truncatedContent.keyCharacters = truncatedContent.keyCharacters.slice(0, 5);
      jsonStr = JSON.stringify(truncatedContent, null, 2);
      tokenCount = countTokens(jsonStr);
    }

    // 第三步：减少最近章节数量
    if (tokenCount > maxTokens) {
      truncatedContent.recentPlot = truncatedContent.recentPlot.slice(0, 1);
      jsonStr = JSON.stringify(truncatedContent, null, 2);
      tokenCount = countTokens(jsonStr);
    }

    // 第四步：精简核心信息
    if (tokenCount > maxTokens) {
      truncatedContent.coreInfo.worldSetting = truncatedContent.coreInfo.worldSetting.slice(0, 200);
      truncatedContent.coreInfo.coreCharacters = truncatedContent.coreInfo.coreCharacters.slice(0, 200);
      jsonStr = JSON.stringify(truncatedContent, null, 2);
      tokenCount = countTokens(jsonStr);
    }

    // 第五步：最后截断整个JSON
    if (tokenCount > maxTokens) {
      jsonStr = truncateToTokenLimit(jsonStr, maxTokens);
    }

    return jsonStr;
  }
}

export const contextSnapshotService = new ContextSnapshotService();
