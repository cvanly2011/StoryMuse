import { novelDAO } from '../database/dao/novel.dao';
import { chapterDAO } from '../database/dao/chapter.dao';
import { characterDAO } from '../database/dao/character.dao';
import { foreshadowingDAO } from '../database/dao/foreshadowing.dao';
import { outlineNodeDAO } from '../database/dao/outline-node.dao';

export interface CheckResult {
  type: 'character_consistency' | 'foreshadowing_recovery' | 'plot_logic' | 'platform_compliance';
  level: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
  chapterId?: number;
  position?: { line: number; column: number };
}

/**
 * 质量检查服务
 * 负责检查人物一致性、伏笔回收、情节逻辑、平台合规等
 */
export class QualityCheckService {
  /**
   * 检查单章内容质量
   */
  public async checkChapter(novelId: number, chapterId: number, content?: string): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    // 并行执行各项检查
    const [characterIssues, foreshadowingIssues, plotIssues] = await Promise.all([
      this.checkCharacterConsistency(novelId, chapterId, content),
      this.checkForeshadowingRecovery(novelId, chapterId, content),
      this.checkPlotLogic(novelId, chapterId, content)
    ]);

    results.push(...characterIssues, ...foreshadowingIssues, ...plotIssues);

    return results;
  }

  /**
   * 检查整部小说的质量
   */
  public async checkWholeNovel(novelId: number): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const allChapters = outlineNodeDAO.findByLevel(novelId, 3); // 所有章节

    for (const chapter of allChapters) {
      const chapterResults = await this.checkChapter(novelId, chapter.id);
      results.push(...chapterResults);
    }

    // 全局检查
    const globalIssues = await this.checkGlobalIssues(novelId);
    results.push(...globalIssues);

    return results;
  }

  /**
   * 检查人物一致性
   */
  private async checkCharacterConsistency(novelId: number, chapterId: number, content?: string): Promise<CheckResult[]> {
    const issues: CheckResult[] = [];
    const chapter = chapterDAO.findCurrentByOutlineNodeId(chapterId);
    if (!chapter) return issues;

    // 提取本章出现的人物
    const appearingCharacterIds = this.extractAppearingCharacters(chapter.character_appearances);
    const characters = await Promise.all(
      appearingCharacterIds.map(id => characterDAO.findById(id))
    );

    for (const character of characters.filter(Boolean)) {
      if (!character) continue;

      // 检查人物行为是否符合设定
      if (content && character.personality) {
        const inconsistencies = this.findPersonalityInconsistencies(content, character.personality);
        inconsistencies.forEach(msg => {
          issues.push({
            type: 'character_consistency',
            level: 'warning',
            message: `人物「${character.name}」的行为可能不符合其性格设定：${msg}`,
            chapterId
          });
        });
      }

      // 检查人物设定是否前后矛盾
      if (character.inner_conflict && content) {
        const conflictIssues = this.checkInnerConflictConsistency(content, character.inner_conflict);
        conflictIssues.forEach(msg => {
          issues.push({
            type: 'character_consistency',
            level: 'warning',
            message: `人物「${character.name}」的内在冲突表现可能不一致：${msg}`,
            chapterId
          });
        });
      }
    }

    return issues;
  }

  /**
   * 检查伏笔回收情况
   */
  private async checkForeshadowingRecovery(novelId: number, chapterId: number, content?: string): Promise<CheckResult[]> {
    const issues: CheckResult[] = [];

    // 检查本章是否有应该回收的伏笔
    const overdueForeshadowings = foreshadowingDAO.findOverdueByNovelId(novelId, chapterId);
    overdueForeshadowings.forEach(foreshadowing => {
      issues.push({
        type: 'foreshadowing_recovery',
        level: 'info',
        message: `伏笔「${foreshadowing.description.substring(0, 50)}...」已超过计划回收章节，建议尽快安排回收`,
        chapterId
      });
    });

    // 检查本章埋设的伏笔是否有明确的回收计划
    const newForeshadowings = foreshadowingDAO.findBySetupChapterId(chapterId);
    newForeshadowings.forEach(foreshadowing => {
      if (!foreshadowing.payoff_chapter_id && foreshadowing.importance >= 7) {
        issues.push({
          type: 'foreshadowing_recovery',
          level: 'warning',
          message: `重要伏笔「${foreshadowing.description.substring(0, 50)}...」尚未设置回收计划，建议明确回收章节`,
          chapterId
        });
      }
    });

    return issues;
  }

  /**
   * 检查情节逻辑合理性
   */
  private async checkPlotLogic(novelId: number, chapterId: number, content?: string): Promise<CheckResult[]> {
    const issues: CheckResult[] = [];
    const chapter = outlineNodeDAO.findById(chapterId);
    if (!chapter) return issues;

    // 检查本章是否完成了预期的情节目标
    if (chapter.description && content) {
      const missedGoals = this.findMissedPlotGoals(content, chapter.description);
      missedGoals.forEach(goal => {
        issues.push({
          type: 'plot_logic',
          level: 'info',
          message: `本章预期目标「${goal.substring(0, 50)}...」可能未完全实现`,
          chapterId
        });
      });
    }

    // 检查情节转折是否合理
    if (chapter.turning_points && content) {
      const abruptTurns = this.findAbruptTurningPoints(content, chapter.turning_points);
      abruptTurns.forEach(msg => {
        issues.push({
          type: 'plot_logic',
          level: 'warning',
          message: `情节转折可能过于突兀：${msg}`,
          chapterId
        });
      });
    }

    return issues;
  }

  /**
   * 全局质量检查
   */
  private async checkGlobalIssues(novelId: number): Promise<CheckResult[]> {
    const issues: CheckResult[] = [];

    // 检查有多少逾期未回收的重要伏笔
    const allChapters = outlineNodeDAO.findByLevel(novelId, 3);
    const lastChapterId = allChapters[allChapters.length - 1]?.id;
    if (lastChapterId) {
      const overdueImportant = foreshadowingDAO.findOverdueByNovelId(novelId, lastChapterId)
        .filter(f => f.importance >= 8);

      if (overdueImportant.length > 0) {
        issues.push({
          type: 'foreshadowing_recovery',
          level: 'warning',
          message: `有 ${overdueImportant.length} 个重要伏笔已逾期超过5章尚未回收，建议尽快安排`
        });
      }
    }

    // 检查人物弧光完成情况
    const protagonists = characterDAO.findByRole(novelId, 'protagonist');
    for (const protagonist of protagonists) {
      if (protagonist.character_arc && !protagonist.final_outcome) {
        issues.push({
          type: 'character_consistency',
          level: 'info',
          message: `主角「${protagonist.name}」的人物弧光尚未完成，建议在后续章节中逐步展现其成长`
        });
      }
    }

    return issues;
  }

  /**
   * 提取出场人物ID列表
   */
  private extractAppearingCharacters(characterAppearances: string): number[] {
    try {
      const arr = JSON.parse(characterAppearances);
      return Array.isArray(arr) ? arr.map((item: any) => item.characterId).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  /**
   * 查找性格不一致的地方
   */
  private findPersonalityInconsistencies(content: string, personality: string): string[] {
    // 简化实现，后续可以用NLP做更精确的检查
    const issues: string[] = [];
    const personalityLower = personality.toLowerCase();

    // 简单的关键词匹配检查
    if (personalityLower.includes('内向') && content.match(/大声说话|主动搭讪|滔滔不绝/)) {
      issues.push('内向性格的人物表现得过于外向');
    }
    if (personalityLower.includes('冷静') && content.match(/冲动|暴怒|失去理智/)) {
      issues.push('冷静性格的人物表现得过于冲动');
    }
    if (personalityLower.includes('善良') && content.match(/故意伤害|欺骗|背叛/)) {
      issues.push('善良性格的人物做出了不符合设定的恶意行为');
    }

    return issues;
  }

  /**
   * 检查内在冲突一致性
   */
  private checkInnerConflictConsistency(content: string, innerConflict: string): string[] {
    // 简化实现
    const issues: string[] = [];
    return issues;
  }

  /**
   * 查找未完成的情节目标
   */
  private findMissedPlotGoals(content: string, description: string): string[] {
    // 简化实现
    const issues: string[] = [];
    return issues;
  }

  /**
   * 查找突兀的情节转折
   */
  private findAbruptTurningPoints(content: string, turningPoints: string): string[] {
    // 简化实现
    const issues: string[] = [];
    return issues;
  }
}

export const qualityCheckService = new QualityCheckService();
