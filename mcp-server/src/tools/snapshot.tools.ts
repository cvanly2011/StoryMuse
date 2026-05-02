import { FastifyRequest, FastifyReply } from 'fastify';
import { contextSnapshotService } from '../services/context-snapshot.service';
import { contextSnapshotDAO } from '../database/dao/context-snapshot.dao';
import { outlineNodeDAO } from '../database/dao/outline-node.dao';
import { fileSyncService } from '../services/file-sync.service';

// 请求类型定义
interface GenerateSnapshotRequest {
  chapterId: number; // 要为哪个章节生成快照
}

interface GetSnapshotRequest {
  chapterId: number;
  version?: number; // 可选，指定版本号，不传则获取最新
}

interface GetAllVersionsRequest {
  chapterId: number;
}

/**
 * 生成上下文快照
 */
export async function generateContextSnapshot(request: FastifyRequest<{ Body: GenerateSnapshotRequest }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { chapterId } = request.body;

    // 验证章节存在
    const chapter = outlineNodeDAO.findById(chapterId);
    if (!chapter || chapter.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '章节不存在'
      });
    }

    const snapshotContent = await contextSnapshotService.generateSnapshot(chapterId, novelId);

    return reply.send({
      success: true,
      message: '上下文快照生成成功',
      data: {
        snapshotContent,
        chapterId,
        chapterTitle: chapter.title
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `生成快照失败: ${error.message}`
    });
  }
}

/**
 * 获取最新的上下文快照
 */
export async function getCurrentContextSnapshot(request: FastifyRequest<{ Body: GetSnapshotRequest }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { chapterId } = request.body;

    // 验证章节存在
    const chapter = outlineNodeDAO.findById(chapterId);
    if (!chapter || chapter.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '章节不存在'
      });
    }

    const snapshotContent = await contextSnapshotService.getLatestSnapshot(chapterId);

    if (!snapshotContent) {
      return reply.status(404).send({
        success: false,
        message: '该章节暂无上下文快照，请先生成'
      });
    }

    return reply.send({
      success: true,
      data: {
        snapshotContent,
        chapterId,
        chapterTitle: chapter.title
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取快照失败: ${error.message}`
    });
  }
}

/**
 * 获取章节的所有快照版本
 */
export async function getAllSnapshotVersions(request: FastifyRequest<{ Body: GetAllVersionsRequest }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const { chapterId } = request.body;

    // 验证章节存在
    const chapter = outlineNodeDAO.findById(chapterId);
    if (!chapter || chapter.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '章节不存在'
      });
    }

    const allVersions = contextSnapshotDAO.findAllByChapterId(chapterId);

    return reply.send({
      success: true,
      data: {
        versions: allVersions.map(v => ({
          id: v.id,
          version: v.snapshot_version,
          createdAt: v.created_at
        })),
        chapterId,
        chapterTitle: chapter.title,
        totalVersions: allVersions.length
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取版本列表失败: ${error.message}`
    });
  }
}
