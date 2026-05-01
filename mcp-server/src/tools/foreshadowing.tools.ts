import { FastifyRequest, FastifyReply } from 'fastify';
import { createForeshadowing, markForeshadowingPaidOff, listUnpaidForeshadowings } from '../database/dao/foreshadowing.dao';

// 创建伏笔
export async function createForeshadowing(request: FastifyRequest<{
  Body: {
    novelId: number;
    setupChapterId: number;
    description: string;
    payoffChapterId?: number;
    hintLevel?: number;
    importance?: number;
  }
}>, reply: FastifyReply) {
  try {
    const params = request.body;
    const foreshadowing = await createForeshadowing({
      ...params,
      hintLevel: params.hintLevel ?? 3,
      importance: params.importance ?? 5
    });

    return reply.send({
      success: true,
      data: {
        foreshadowingId: foreshadowing.id
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `创建伏笔失败: ${error.message}`
    });
  }
}

// 标记伏笔已回收
export async function markForeshadowingPaidOff(request: FastifyRequest<{
  Body: {
    foreshadowingId: number;
    payoffChapterId: number;
    payoffDescription: string;
  }
}>, reply: FastifyReply) {
  try {
    const params = request.body;
    const foreshadowing = await markForeshadowingPaidOff(
      params.foreshadowingId,
      params.payoffChapterId,
      params.payoffDescription
    );

    return reply.send({
      success: true,
      data: {
        foreshadowingId: foreshadowing.id
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `标记伏笔已回收失败: ${error.message}`
    });
  }
}

// 获取未回收伏笔列表
export async function listUnpaidForeshadowings(request: FastifyRequest<{
  Body: {
    novelId: number;
    upToChapterId?: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId, upToChapterId } = request.body;
    const foreshadowings = await listUnpaidForeshadowings(novelId, upToChapterId);

    return reply.send({
      success: true,
      data: {
        foreshadowings
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取未回收伏笔失败: ${error.message}`
    });
  }
}
