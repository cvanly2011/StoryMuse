import { FastifyRequest, FastifyReply } from 'fastify';
import { foreshadowingDAO } from '../database/dao/foreshadowing.dao';
import { outlineNodeDAO } from '../database/dao/outline-node.dao';
import { fileSyncService } from '../services/file-sync.service';

// 请求类型定义
interface CreateForeshadowingRequest {
  setupChapterId: number; // 埋设伏笔的章节ID
  description: string; // 伏笔描述
  hintLevel?: number; // 提示等级 1-5
  importance?: number; // 重要程度 1-10
  payoffChapterId?: number; // 计划回收的章节ID
}

interface MarkAsPaidRequest {
  id: number;
  payoffChapterId: number; // 实际回收的章节ID
  payoffDescription?: string; // 回收描述
}

interface MarkAsAbandonedRequest {
  id: number;
}

interface GetForeshadowingsRequest {
  status?: 'setup' | 'paid_off' | 'abandoned';
  minImportance?: number;
}

interface GetOverdueRequest {
  currentChapterId: number; // 当前已完成的最大章节ID
}

/**
 * 获取小说的所有伏笔
 */
export async function getForeshadowings(request: FastifyRequest<{ Body: GetForeshadowingsRequest }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { status, minImportance = 0 } = request.body;
    let foreshadowings: any[];

    if (status === 'setup' && minImportance > 0) {
      foreshadowings = foreshadowingDAO.findUnpaidByNovelId(novelId, undefined, minImportance);
    } else {
      foreshadowings = foreshadowingDAO.findAllByNovelId(novelId, status);
    }

    // 补充章节标题信息
    const foreshadowingsWithChapterTitles = await Promise.all(
      foreshadowings.map(async (foreshadowing) => {
        const setupChapter = outlineNodeDAO.findById(foreshadowing.setup_chapter_id);
        const payoffChapter = foreshadowing.payoff_chapter_id
          ? outlineNodeDAO.findById(foreshadowing.payoff_chapter_id)
          : null;

        return {
          ...foreshadowing,
          setupChapterTitle: setupChapter?.title || '未知章节',
          payoffChapterTitle: payoffChapter?.title || null
        };
      })
    );

    return reply.send({
      success: true,
      data: {
        foreshadowings: foreshadowingsWithChapterTitles,
        total: foreshadowingsWithChapterTitles.length,
        statusFilter: status,
        minImportanceFilter: minImportance
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取伏笔失败: ${error.message}`
    });
  }
}

/**
 * 创建新的伏笔
 */
export async function createForeshadowing(request: FastifyRequest<{ Body: CreateForeshadowingRequest }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { setupChapterId, description, hintLevel = 3, importance = 5, payoffChapterId } = request.body;

    // 验证章节存在
    const setupChapter = outlineNodeDAO.findById(setupChapterId);
    if (!setupChapter || setupChapter.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '埋设伏笔的章节不存在'
      });
    }

    if (payoffChapterId) {
      const payoffChapter = outlineNodeDAO.findById(payoffChapterId);
      if (!payoffChapter || payoffChapter.novel_id !== novelId) {
        return reply.status(404).send({
          success: false,
          message: '计划回收的章节不存在'
        });
      }
    }

    const foreshadowingId = foreshadowingDAO.insert({
      novel_id: novelId,
      setup_chapter_id: setupChapterId,
      description,
      hint_level: hintLevel,
      importance,
      payoff_chapter_id: payoffChapterId
    });

    const newForeshadowing = foreshadowingDAO.findById(foreshadowingId);

    return reply.status(201).send({
      success: true,
      message: '伏笔创建成功',
      data: { foreshadowing: newForeshadowing }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `创建伏笔失败: ${error.message}`
    });
  }
}

/**
 * 标记伏笔为已回收
 */
export async function markForeshadowingAsPaid(request: FastifyRequest<{ Body: MarkAsPaidRequest }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { id, payoffChapterId, payoffDescription } = request.body;

    // 验证伏笔存在
    const existing = foreshadowingDAO.findById(id);
    if (!existing || existing.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '伏笔不存在'
      });
    }

    // 验证回收章节存在
    const payoffChapter = outlineNodeDAO.findById(payoffChapterId);
    if (!payoffChapter || payoffChapter.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '回收章节不存在'
      });
    }

    const updatedCount = foreshadowingDAO.markAsPaid(id, payoffChapterId, payoffDescription);

    if (updatedCount === 0) {
      return reply.status(404).send({
        success: false,
        message: '伏笔不存在'
      });
    }

    const updatedForeshadowing = foreshadowingDAO.findById(id);

    return reply.send({
      success: true,
      message: '伏笔已标记为已回收',
      data: { foreshadowing: updatedForeshadowing }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `标记伏笔回收失败: ${error.message}`
    });
  }
}

/**
 * 标记伏笔为已废弃
 */
export async function markForeshadowingAsAbandoned(request: FastifyRequest<{ Body: MarkAsAbandonedRequest }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { id } = request.body;

    // 验证伏笔存在
    const existing = foreshadowingDAO.findById(id);
    if (!existing || existing.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '伏笔不存在'
      });
    }

    const updatedCount = foreshadowingDAO.markAsAbandoned(id);

    if (updatedCount === 0) {
      return reply.status(404).send({
        success: false,
        message: '伏笔不存在'
      });
    }

    const updatedForeshadowing = foreshadowingDAO.findById(id);

    return reply.send({
      success: true,
      message: '伏笔已标记为已废弃',
      data: { foreshadowing: updatedForeshadowing }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `标记伏笔废弃失败: ${error.message}`
    });
  }
}

/**
 * 删除伏笔
 */
export async function deleteForeshadowing(request: FastifyRequest<{ Body: { id: number } }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { id } = request.body;

    // 验证伏笔存在
    const existing = foreshadowingDAO.findById(id);
    if (!existing || existing.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '伏笔不存在'
      });
    }

    const deletedCount = foreshadowingDAO.delete(id);

    if (deletedCount === 0) {
      return reply.status(404).send({
        success: false,
        message: '伏笔不存在'
      });
    }

    return reply.send({
      success: true,
      message: '伏笔删除成功'
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `删除伏笔失败: ${error.message}`
    });
  }
}

/**
 * 获取逾期未回收的伏笔
 */
export async function getOverdueForeshadowings(request: FastifyRequest<{ Body: GetOverdueRequest }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { currentChapterId } = request.body;

    // 验证章节存在
    const currentChapter = outlineNodeDAO.findById(currentChapterId);
    if (!currentChapter || currentChapter.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '当前章节不存在'
      });
    }

    const overdueForeshadowings = foreshadowingDAO.findOverdueByNovelId(novelId, currentChapterId);

    // 补充章节标题信息
    const foreshadowingsWithChapterTitles = await Promise.all(
      overdueForeshadowings.map(async (foreshadowing) => {
        const setupChapter = outlineNodeDAO.findById(foreshadowing.setup_chapter_id);
        const payoffChapter = foreshadowing.payoff_chapter_id
          ? outlineNodeDAO.findById(foreshadowing.payoff_chapter_id)
          : null;

        return {
          ...foreshadowing,
          setupChapterTitle: setupChapter?.title || '未知章节',
          payoffChapterTitle: payoffChapter?.title || null
        };
      })
    );

    return reply.send({
      success: true,
      data: {
        overdueForeshadowings: foreshadowingsWithChapterTitles,
        count: foreshadowingsWithChapterTitles.length,
        currentChapterId,
        currentChapterTitle: currentChapter.title
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取逾期伏笔失败: ${error.message}`
    });
  }
}
