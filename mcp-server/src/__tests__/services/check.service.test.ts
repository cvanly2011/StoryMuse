import { checkService, CheckResult } from '../../services/check.service';
import { characterDAO } from '../../database/dao/character.dao';
import { foreshadowingDAO } from '../../database/dao/foreshadowing.dao';
import { chapterDAO } from '../../database/dao/chapter.dao';
import { outlineNodeDAO } from '../../database/dao/outline-node.dao';

// Mock all DAOs explicitly
jest.mock('../../database/dao/character.dao', () => ({
  characterDAO: {
    findAllByNovelId: jest.fn()
  }
}));

jest.mock('../../database/dao/foreshadowing.dao', () => ({
  foreshadowingDAO: {
    findOverdueByNovelId: jest.fn(),
    findUnpaidByNovelId: jest.fn()
  }
}));

jest.mock('../../database/dao/chapter.dao', () => ({
  chapterDAO: {
    getLatestByOutlineNodeId: jest.fn()
  }
}));

jest.mock('../../database/dao/outline-node.dao', () => ({
  outlineNodeDAO: {
    findByLevel: jest.fn(),
    findById: jest.fn()
  }
}));

describe('CheckService', () => {
  const mockNovelId = 1;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkCharacterConsistency', () => {
    test('should return warnings for characters with incomplete settings', async () => {
      // Mock characters with incomplete settings
      const mockCharacters = [
        {
          id: 1,
          name: '张三',
          personality: '善良', // Too short (length 2 < 20)
          core_desire: null, // Missing
          backstory: '普通农民' // Too short (length 4 < 50)
        },
        {
          id: 2,
          name: '李四',
          personality: '性格开朗，乐于助人，喜欢冒险，有正义感，对待朋友真诚友善，遇到困难从不退缩', // 34 characters > 20
          core_desire: '成为最伟大的侠客', // Present
          backstory: '出身武林世家，从小习武，父母被恶人杀害，决心报仇雪恨，行走江湖帮助他人，一路上经历了无数艰难险阻，结识了许多志同道合的朋友，最终成为一代大侠' // 78 characters > 50
        }
      ];
      (characterDAO.findAllByNovelId as jest.Mock).mockReturnValue(mockCharacters);
      // Mock outlineNodeDAO to return empty array (chapters not used in current implementation)
      (outlineNodeDAO.findByLevel as jest.Mock).mockReturnValue([]);

      // Call the private method (using type assertion to access private)
      const results = await (checkService as any).checkCharacterConsistency(mockNovelId);

      // Should return 3 warnings for the first character
      expect(results.length).toBe(3);
      expect(results).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'character_consistency',
          level: 'warning',
          message: expect.stringContaining('张三')
        }),
        expect.objectContaining({
          type: 'character_consistency',
          level: 'warning',
          message: expect.stringContaining('张三')
        }),
        expect.objectContaining({
          type: 'character_consistency',
          level: 'info',
          message: expect.stringContaining('张三')
        })
      ]));

      // Verify DAO was called correctly
      expect(characterDAO.findAllByNovelId).toHaveBeenCalledWith(mockNovelId, false);
    });

    test('should return no warnings for characters with complete settings', async () => {
      // Mock characters with complete settings
      (characterDAO.findAllByNovelId as jest.Mock).mockReturnValue([
        {
          id: 2,
          name: '李四',
          personality: '性格开朗，乐于助人，喜欢冒险，有正义感，对待朋友真诚友善，遇到困难从不退缩', // >20
          core_desire: '成为最伟大的侠客', // Present
          backstory: '出身武林世家，从小习武，父母被恶人杀害，决心报仇雪恨，行走江湖帮助他人，一路上经历了无数艰难险阻，结识了许多志同道合的朋友，最终成为一代大侠' // >50
        }
      ]);
      // Mock outlineNodeDAO to return empty array
      (outlineNodeDAO.findByLevel as jest.Mock).mockReturnValue([]);

      const results = await (checkService as any).checkCharacterConsistency(mockNovelId);

      expect(results.length).toBe(0);
    });
  });

  describe('checkForeshadowingRecovery', () => {
    test('should return errors for overdue high-importance foreshadowings', async () => {
      // Mock completed chapters up to order 15
      (outlineNodeDAO.findByLevel as jest.Mock).mockReturnValue([
        { id: 1, order: 1, status: 'completed', title: '第一章' },
        { id: 2, order: 2, status: 'completed', title: '第二章' },
        // ... up to 15
        { id: 15, order: 15, status: 'completed', title: '第十五章' }
      ]);

      // Mock overdue foreshadowing (setup in chapter 2, expected payoff in chapter 10)
      (foreshadowingDAO.findOverdueByNovelId as jest.Mock).mockReturnValue([
        {
          id: 1,
          description: '主角获得的神秘玉佩似乎隐藏着巨大的秘密',
          setup_chapter_id: 2,
          payoff_chapter_id: 10,
          importance: 9 // High importance
        }
      ]);

      // Mock findById to return chapter info
      (outlineNodeDAO.findById as jest.Mock).mockImplementation((id: number) => {
        if (id === 2) return { id: 2, title: '第二章' };
        if (id === 10) return { id: 10, title: '第十章' };
        return null;
      });

      // Mock unpaid foreshadowings to be empty
      (foreshadowingDAO.findUnpaidByNovelId as jest.Mock).mockReturnValue([]);

      const results = await (checkService as any).checkForeshadowingRecovery(mockNovelId);

      expect(results.length).toBe(1);
      expect(results[0]).toEqual(expect.objectContaining({
        type: 'foreshadowing_recovery',
        level: 'error', // High importance should be error
        message: expect.stringContaining('神秘玉佩')
      }));
    });

    test('should return warnings for foreshadowings not recovered after 10 chapters', async () => {
      // Mock completed chapters up to order 15
      (outlineNodeDAO.findByLevel as jest.Mock).mockReturnValue([
        { id: 1, order: 1, status: 'completed', title: '第一章' },
        // ... up to 15
        { id: 15, order: 15, status: 'completed', title: '第十五章' }
      ]);

      // Mock no overdue foreshadowings
      (foreshadowingDAO.findOverdueByNovelId as jest.Mock).mockReturnValue([]);

      // Mock unpaid foreshadowing setup in chapter 2 (13 chapters ago)
      (foreshadowingDAO.findUnpaidByNovelId as jest.Mock).mockReturnValue([
        {
          id: 2,
          description: '酒馆里遇到的神秘老人似乎认识主角的父亲',
          setup_chapter_id: 2,
          importance: 8
        }
      ]);

      // Mock findById
      (outlineNodeDAO.findById as jest.Mock).mockImplementation((id: number) => {
        if (id === 2) return { id: 2, order: 2, title: '第二章' };
        return null;
      });

      const results = await (checkService as any).checkForeshadowingRecovery(mockNovelId);

      expect(results.length).toBe(1);
      expect(results[0]).toEqual(expect.objectContaining({
        type: 'foreshadowing_recovery',
        level: 'warning',
        message: expect.stringContaining('神秘老人')
      }));
    });
  });

  describe('checkPlotLogic', () => {
    test('should return info for chapters with large word count deviation', async () => {
      // Mock chapter
      const mockChapter = {
        id: 1,
        title: '第一章',
        word_count_target: 3000,
        status: 'completed'
      };
      (outlineNodeDAO.findById as jest.Mock).mockReturnValue(mockChapter);

      // Mock chapter content with 5000 words (67% deviation)
      (chapterDAO.getLatestByOutlineNodeId as jest.Mock).mockReturnValue({
        id: 1,
        word_count: 5000,
        summary: '这是第一章的摘要，内容非常丰富，讲述了主角的出生和成长经历，以及他如何踏上冒险的旅程，遇到了各种各样的人和事，经历了许多挑战和困难', // Length > 50
        key_events: JSON.stringify(['主角出生', '主角长大'])
      });

      const results = await (checkService as any).checkPlotLogic(mockNovelId, 1);

      expect(results.length).toBe(1);
      expect(results[0]).toEqual(expect.objectContaining({
        type: 'plot_logic',
        level: 'info',
        message: expect.stringContaining('字数')
      }));
    });

    test('should return info for chapters without summary or key events', async () => {
      // Mock chapter
      const mockChapter = {
        id: 1,
        title: '第一章',
        word_count_target: 3000,
        status: 'completed'
      };
      (outlineNodeDAO.findById as jest.Mock).mockReturnValue(mockChapter);

      // Mock chapter content with no summary and no key events
      (chapterDAO.getLatestByOutlineNodeId as jest.Mock).mockReturnValue({
        id: 1,
        word_count: 3000,
        summary: '', // No summary
        key_events: JSON.stringify([]) // No key events
      });

      const results = await (checkService as any).checkPlotLogic(mockNovelId, 1);

      expect(results.length).toBe(2); // One for missing summary, one for missing key events
      expect(results).toEqual(expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('摘要') }),
        expect.objectContaining({ message: expect.stringContaining('关键事件') })
      ]));
    });
  });

  describe('runChecks', () => {
    test('should run all check types by default and sort results by severity', async () => {
      // Mock all checks to return results of different severity
      jest.spyOn(checkService as any, 'checkCharacterConsistency').mockResolvedValue([
        { type: 'character_consistency', level: 'warning', message: '人物警告' }
      ]);
      jest.spyOn(checkService as any, 'checkForeshadowingRecovery').mockResolvedValue([
        { type: 'foreshadowing_recovery', level: 'error', message: '伏笔错误' }
      ]);
      jest.spyOn(checkService as any, 'checkPlotLogic').mockResolvedValue([
        { type: 'plot_logic', level: 'info', message: '情节提示' }
      ]);
      jest.spyOn(checkService as any, 'checkPlatformCompliance').mockResolvedValue([
        { type: 'platform_compliance', level: 'info', message: '合规提示' }
      ]);

      const results = await checkService.runChecks(mockNovelId);

      // Should have 4 results total
      expect(results.length).toBe(4);
      // Should be sorted by severity: error first, then warning, then info
      expect(results[0].level).toBe('error');
      expect(results[1].level).toBe('warning');
      expect(results[2].level).toBe('info');
      expect(results[3].level).toBe('info');

      // Verify all checks were called
      expect(checkService['checkCharacterConsistency']).toHaveBeenCalled();
      expect(checkService['checkForeshadowingRecovery']).toHaveBeenCalled();
      expect(checkService['checkPlotLogic']).toHaveBeenCalled();
      expect(checkService['checkPlatformCompliance']).toHaveBeenCalled();
    });

    test('should only run specified check types', async () => {
      // Mock all checks
      jest.spyOn(checkService as any, 'checkCharacterConsistency').mockResolvedValue([]);
      jest.spyOn(checkService as any, 'checkForeshadowingRecovery').mockResolvedValue([]);
      jest.spyOn(checkService as any, 'checkPlotLogic').mockResolvedValue([]);
      jest.spyOn(checkService as any, 'checkPlatformCompliance').mockResolvedValue([]);

      // Only run character and foreshadowing checks
      await checkService.runChecks(mockNovelId, {
        checkTypes: ['character_consistency', 'foreshadowing_recovery']
      });

      // Verify only specified checks were called
      expect(checkService['checkCharacterConsistency']).toHaveBeenCalled();
      expect(checkService['checkForeshadowingRecovery']).toHaveBeenCalled();
      expect(checkService['checkPlotLogic']).not.toHaveBeenCalled();
      expect(checkService['checkPlatformCompliance']).not.toHaveBeenCalled();
    });
  });
});
