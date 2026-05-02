import { characterDAO } from '../database/dao/character.dao';
import { foreshadowingDAO } from '../database/dao/foreshadowing.dao';
import { chapterDAO } from '../database/dao/chapter.dao';
import { outlineNodeDAO } from '../database/dao/outline-node.dao';
import { countTokens } from '../utils/token.utils';

export interface CheckResult {
  type: 'character_consistency' | 'foreshadowing_recovery' | 'plot_logic' | 'platform_compliance';
  level: 'info' | 'warning' | 'error';
  message: string;
  details?: any;
  chapterId?: number;
  chapterTitle?: string;
}

export interface CheckOptions {
  checkTypes?: Array<'character_consistency' | 'foreshadowing_recovery' | 'plot_logic' | 'platform_compliance'>;
  chapterId?: number; // 可选，只检查指定章节，不传则检查整个小说
}

/**
 * 质量检查引擎
 * 提供小说内容的各类质量检查和优化建议
 */
class CheckService {
  /**
   * 执行所有质量检查
   */
  public async runChecks(novelId: number, options: CheckOptions = {}): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const checkTypes = options.checkTypes || [
      'character_consistency',
      'foreshadowing_recovery',
      'plot_logic',
      'platform_compliance'
    ];

    // 人物一致性检查
    if (checkTypes.includes('character_consistency')) {
      const characterResults = await this.checkCharacterConsistency(novelId, options.chapterId);
      results.push(...characterResults);
    }

    // 伏笔回收检查
    if (checkTypes.includes('foreshadowing_recovery')) {
      const foreshadowingResults = await this.checkForeshadowingRecovery(novelId, options.chapterId);
      results.push(...foreshadowingResults);
    }

    // 情节逻辑检查
    if (checkTypes.includes('plot_logic')) {
      const plotResults = await this.checkPlotLogic(novelId, options.chapterId);
      results.push(...plotResults);
    }

    // 平台合规检查
    if (checkTypes.includes('platform_compliance')) {
      const complianceResults = await this.checkPlatformCompliance(novelId, options.chapterId);
      results.push(...complianceResults);
    }

    // 按严重程度排序：error > warning > info
    const levelOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
    return results.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
  }

  /**
   * 人物一致性检查
   * 检查人物行为、性格是否符合设定
   */
  private async checkCharacterConsistency(novelId: number, chapterId?: number): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const characters = characterDAO.findAllByNovelId(novelId, false);

    // 如果指定了章节，只检查该章节出现的人物
    let chaptersToCheck: number[] = [];
    if (chapterId) {
      chaptersToCheck = [chapterId];
    } else {
      // 检查所有已完成的章节
      const completedChapters = outlineNodeDAO.findByLevel(novelId, 3).filter(c => c.status === 'completed');
      chaptersToCheck = completedChapters.map(c => c.id);
    }

    for (const char of characters) {
      // 这里可以实现更复杂的一致性检查逻辑
      // 目前简化为：检查人物是否有完整的设定
      if (!char.personality || char.personality.length < 20) {
        results.push({
          type: 'character_consistency',
          level: 'warning',
          message: `人物 ${char.name} 的性格设定不够详细，可能导致后续写作出现不一致`,
          details: {
            characterId: char.id,
            characterName: char.name,
            issue: 'insufficient_personality'
          }
        });
      }

      if (!char.core_desire) {
        results.push({
          type: 'character_consistency',
          level: 'warning',
          message: `人物 ${char.name} 缺少核心目标设定，人物行为可能缺乏驱动力`,
          details: {
            characterId: char.id,
            characterName: char.name,
            issue: 'missing_core_desire'
          }
        });
      }

      if (!char.backstory || char.backstory.length < 50) {
        results.push({
          type: 'character_consistency',
          level: 'info',
          message: `人物 ${char.name} 的背景故事不够丰富，人物形象可能不够立体`,
          details: {
            characterId: char.id,
            characterName: char.name,
            issue: 'insufficient_backstory'
          }
        });
      }
    }

    return results;
  }

  /**
   * 伏笔回收检查
   * 检查是否有伏笔应该回收但没有回收，或者回收不合理
   */
  private async checkForeshadowingRecovery(novelId: number, chapterId?: number): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    // 获取所有已完成的章节
    const completedChapters = outlineNodeDAO.findByLevel(novelId, 3).filter(c => c.status === 'completed');
    const maxCompletedOrder = completedChapters.length > 0 ? Math.max(...completedChapters.map(c => c.order)) : 0;

    // 检查逾期未回收的伏笔
    const overdueForeshadowings = foreshadowingDAO.findOverdueByNovelId(novelId, maxCompletedOrder + 1); // +1 包括当前章节

    for (const foreshadowing of overdueForeshadowings) {
      const setupChapter = outlineNodeDAO.findById(foreshadowing.setup_chapter_id);
      const expectedPayoffChapter = foreshadowing.payoff_chapter_id
        ? outlineNodeDAO.findById(foreshadowing.payoff_chapter_id)
        : null;

      results.push({
        type: 'foreshadowing_recovery',
        level: foreshadowing.importance >= 8 ? 'error' : 'warning',
        message: `伏笔 "${foreshadowing.description.substring(0, 50)}..." 已超过计划回收章节，建议尽快回收`,
        details: {
          foreshadowingId: foreshadowing.id,
          description: foreshadowing.description,
          setupChapterId: foreshadowing.setup_chapter_id,
          setupChapterTitle: setupChapter?.title || '未知章节',
          expectedPayoffChapterId: foreshadowing.payoff_chapter_id,
          expectedPayoffChapterTitle: expectedPayoffChapter?.title || null,
          importance: foreshadowing.importance
        },
        chapterId: chapterId,
        chapterTitle: chapterId ? outlineNodeDAO.findById(chapterId)?.title : undefined
      });
    }

    // 检查长时间未回收的伏笔（超过10章）
    const allUnpaid = foreshadowingDAO.findUnpaidByNovelId(novelId);
    for (const foreshadowing of allUnpaid) {
      const setupChapter = outlineNodeDAO.findById(foreshadowing.setup_chapter_id);
      if (setupChapter && maxCompletedOrder - setupChapter.order > 10 && foreshadowing.importance >=7) {
        results.push({
          type: 'foreshadowing_recovery',
          level: 'warning',
          message: `伏笔 "${foreshadowing.description.substring(0, 50)}..." 已埋设超过10章仍未回收，建议安排回收`,
          details: {
            foreshadowingId: foreshadowing.id,
            description: foreshadowing.description,
            setupChapterId: foreshadowing.setup_chapter_id,
            setupChapterTitle: setupChapter.title,
            chaptersSinceSetup: maxCompletedOrder - setupChapter.order,
            importance: foreshadowing.importance
          }
        });
      }
    }

    return results;
  }

  /**
   * 情节逻辑检查
   * 检查情节是否有逻辑矛盾、前后不一致
   */
  private async checkPlotLogic(novelId: number, chapterId?: number): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const chapters = chapterId
      ? [outlineNodeDAO.findById(chapterId)]
      : outlineNodeDAO.findByLevel(novelId, 3).filter(c => c.status === 'completed');

    for (const chapter of chapters) {
      if (!chapter) continue;

      const latestChapterContent = chapterDAO.getLatestByOutlineNodeId(chapter.id);
      if (!latestChapterContent) continue;

      // 检查章节字数是否符合预期（这里简化处理）
      const expectedWordCount = chapter.word_count_target || 3000;
      const wordCountDeviation = Math.abs(latestChapterContent.word_count - expectedWordCount) / expectedWordCount;

      if (wordCountDeviation > 0.5 && expectedWordCount > 0) {
        results.push({
          type: 'plot_logic',
          level: 'info',
          message: `章节 "${chapter.title}" 的字数(${latestChapterContent.word_count})与预期(${expectedWordCount})相差较大，建议检查内容是否完整`,
          details: {
            chapterId: chapter.id,
            actualWordCount: latestChapterContent.word_count,
            expectedWordCount,
            deviation: wordCountDeviation
          },
          chapterId: chapter.id,
          chapterTitle: chapter.title
        });
      }

      // 检查章节是否有摘要
      if (!latestChapterContent.summary || latestChapterContent.summary.length < 50) {
        results.push({
          type: 'plot_logic',
          level: 'info',
          message: `章节 "${chapter.title}" 缺少内容摘要，建议添加摘要便于后续情节连贯性检查`,
          details: {
            chapterId: chapter.id
          },
          chapterId: chapter.id,
          chapterTitle: chapter.title
        });
      }

      // 检查关键事件是否为空
      try {
        const keyEvents = JSON.parse(latestChapterContent.key_events || '[]');
        if (keyEvents.length === 0 && latestChapterContent.word_count > 1000) {
          results.push({
            type: 'plot_logic',
            level: 'info',
            message: `章节 "${chapter.title}" 未提取关键事件，建议补充便于情节追踪`,
            details: {
              chapterId: chapter.id
            },
            chapterId: chapter.id,
            chapterTitle: chapter.title
          });
        }
      } catch (e) {
        // 忽略JSON解析错误
      }
    }

    return results;
  }

  /**
   * 平台合规检查
   * 检查内容是否符合目标平台的规定（敏感词、内容限制等）
   */
  private async checkPlatformCompliance(novelId: number, chapterId?: number): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    // 这里可以实现敏感词检查、内容合规检查等
    // 目前简化为占位实现
    results.push({
      type: 'platform_compliance',
      level: 'info',
      message: '平台合规检查功能正在开发中，后续将支持敏感词检测、内容政策合规性检查',
      details: {
        status: 'under_development'
      }
    });

    return results;
  }
}

export const checkService = new CheckService();
