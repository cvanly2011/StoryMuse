import { FastifyRequest, FastifyReply } from 'fastify';
import { checkService, CheckOptions, CheckResult } from '../services/check.service';
import { fileSyncService } from '../services/file-sync.service';

// 请求类型定义
interface RunChecksRequest {
  checkTypes?: Array<'character_consistency' | 'foreshadowing_recovery' | 'plot_logic' | 'platform_compliance'>;
  chapterId?: number; // 可选，只检查指定章节，不传则检查整个小说
}

/**
 * 执行质量检查
 */
export async function runQualityChecks(request: FastifyRequest<{ Body: RunChecksRequest }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { checkTypes, chapterId } = request.body;
    const options: CheckOptions = {};

    if (checkTypes && checkTypes.length > 0) {
      options.checkTypes = checkTypes;
    }

    if (chapterId !== undefined) {
      options.chapterId = chapterId;
    }

    const checkResults = await checkService.runChecks(novelId, options);

    // 统计结果
    const stats = {
      total: checkResults.length,
      errors: checkResults.filter(r => r.level === 'error').length,
      warnings: checkResults.filter(r => r.level === 'warning').length,
      infos: checkResults.filter(r => r.level === 'info').length
    };

    return reply.send({
      success: true,
      message: `质量检查完成，发现 ${stats.errors} 个错误，${stats.warnings} 个警告，${stats.infos} 个提示`,
      data: {
        results: checkResults,
        stats,
        checkedChapterId: chapterId
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `质量检查失败: ${error.message}`
    });
  }
}

/**
 * 人物一致性检查
 */
export async function checkCharacterConsistency(request: FastifyRequest<{ Body: { chapterId?: number } }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { chapterId } = request.body;
    const results = await checkService.runChecks(novelId, {
      checkTypes: ['character_consistency'],
      chapterId
    });

    return reply.send({
      success: true,
      data: {
        results,
        count: results.length,
        checkedChapterId: chapterId
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `人物一致性检查失败: ${error.message}`
    });
  }
}

/**
 * 伏笔回收检查
 */
export async function checkForeshadowingRecovery(request: FastifyRequest<{ Body: { chapterId?: number } }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { chapterId } = request.body;
    const results = await checkService.runChecks(novelId, {
      checkTypes: ['foreshadowing_recovery'],
      chapterId
    });

    return reply.send({
      success: true,
      data: {
        results,
        count: results.length,
        checkedChapterId: chapterId
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `伏笔回收检查失败: ${error.message}`
    });
  }
}

/**
 * 情节逻辑检查
 */
export async function checkPlotLogic(request: FastifyRequest<{ Body: { chapterId?: number } }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { chapterId } = request.body;
    const results = await checkService.runChecks(novelId, {
      checkTypes: ['plot_logic'],
      chapterId
    });

    return reply.send({
      success: true,
      data: {
        results,
        count: results.length,
        checkedChapterId: chapterId
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `情节逻辑检查失败: ${error.message}`
    });
  }
}

/**
 * 平台合规检查
 */
export async function checkPlatformCompliance(request: FastifyRequest<{ Body: { chapterId?: number } }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { chapterId } = request.body;
    const results = await checkService.runChecks(novelId, {
      checkTypes: ['platform_compliance'],
      chapterId
    });

    return reply.send({
      success: true,
      data: {
        results,
        count: results.length,
        checkedChapterId: chapterId
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `平台合规检查失败: ${error.message}`
    });
  }
}
