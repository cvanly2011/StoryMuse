import { FastifyRequest, FastifyReply } from 'fastify';
import { listCharacters } from '../database/dao/character.dao';
import { listUnpaidForeshadowings, listOverdueForeshadowings } from '../database/dao/foreshadowing.dao';
import sensitiveWords from '../config/sensitive-words.json';

// 检查人物一致性
export async function checkCharacterConsistency(request: FastifyRequest<{
  Body: {
    novelId: number;
    chapterId?: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId } = request.body;
    const characters = await listCharacters(novelId);

    // 这里实现具体的一致性检查逻辑，对比人物设定和章节中的表现
    // 简化实现，返回模拟结果
    const inconsistencies = characters.map(c => ({
      characterId: c.id,
      characterName: c.name,
      chapterId: 1,
      chapterTitle: '示例章节',
      issue: `人物${c.name}的行为可能与其设定的${c.personality}性格不符`,
      severity: 'medium' as const
    })).filter(() => Math.random() > 0.7); // 模拟70%的概率没有问题

    return reply.send({
      success: true,
      data: {
        inconsistencies
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `人物一致性检查失败: ${error.message}`
    });
  }
}

// 检查伏笔回收情况
export async function checkForeshadowingRecovery(request: FastifyRequest<{
  Body: {
    novelId: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId } = request.body;
    const unpaid = await listUnpaidForeshadowings(novelId);
    const overdue = await listOverdueForeshadowings(novelId, 999); // 简化实现

    return reply.send({
      success: true,
      data: {
        pendingForeshadowings: unpaid,
        unrecoveredImportantForeshadowings: unpaid.filter(f => f.importance >= 7),
        abandonedForeshadowings: []
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `伏笔回收检查失败: ${error.message}`
    });
  }
}

// 检查情节逻辑合理性
export async function checkPlotLogic(request: FastifyRequest<{
  Body: {
    novelId: number;
    startChapterId?: number;
    endChapterId?: number;
  }
}>, reply: FastifyReply) {
  try {
    // 这里实现具体的情节逻辑检查逻辑
    // 简化实现，返回模拟结果
    return reply.send({
      success: true,
      data: {
        logicIssues: []
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `情节逻辑检查失败: ${error.message}`
    });
  }
}

// 检查平台合规性
export async function checkPlatformCompliance(request: FastifyRequest<{
  Body: {
    novelId: number;
    chapterId?: number;
  }
}>, reply: FastifyReply) {
  try {
    // 这里实现具体的合规性检查逻辑，使用敏感词库检测
    // 简化实现，返回模拟结果
    return reply.send({
      success: true,
      data: {
        complianceIssues: [],
        sensitiveWordCount: 0
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `平台合规性检查失败: ${error.message}`
    });
  }
}
