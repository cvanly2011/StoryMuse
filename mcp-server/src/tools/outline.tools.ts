import { FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs';
import path from 'path';
import { createOutlineNode, updateOutlineNode, moveOutlineNode, getOutlineTree, getImpactedChapterIds } from '../database/dao/outline.dao';
import { markSnapshotsExpired } from '../database/dao/snapshot.dao';

// 创建大纲节点
export async function createOutlineNode(request: FastifyRequest<{
  Body: {
    novelId: number;
    parentId?: number;
    level: number;
    order: number;
    title: string;
    description?: string;
    characterGoals?: string;
    conflictPoints?: string;
    turningPoints?: string;
    foreshadowingHints?: string;
  }
}>, reply: FastifyReply) {
  try {
    const params = request.body;
    const node = await createOutlineNode({
      ...params,
      status: 'pending'
    });

    // 如果是章节点（level=3），自动创建对应的md文件
    if (node.level === 3) {
      const chaptersDir = path.join(process.cwd(), 'chapters');
      const chapterPath = path.join(chaptersDir, `第${node.order}章 ${node.title}.md`);

      if (!fs.existsSync(chapterPath)) {
        let content = `---
chapter_id: ${node.id}
version: 0
word_count: 0
---
# ${node.title}
<!-- 在这里写章节内容 -->
`;

        if (node.description) {
          content += `
## 章节概要
${node.description}
`;
        }

        if (node.characterGoals) {
          content += `
## 人物目标
${node.characterGoals}
`;
        }

        if (node.conflictPoints) {
          content += `
## 冲突点
${node.conflictPoints}
`;
        }

        if (node.turningPoints) {
          content += `
## 转折点
${node.turningPoints}
`;
        }

        fs.writeFileSync(chapterPath, content);
      }
    }

    return reply.send({
      success: true,
      data: {
        nodeId: node.id,
        path: node.path
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `创建大纲节点失败: ${error.message}`
    });
  }
}

// 更新大纲节点
export async function updateOutlineNode(request: FastifyRequest<{
  Body: {
    nodeId: number;
    updates: any;
  }
}>, reply: FastifyReply) {
  try {
    const { nodeId, updates } = request.body;
    const node = await updateOutlineNode(nodeId, updates);

    // 标记受影响的章节快照过期
    const impactedIds = await getImpactedChapterIds(nodeId);
    if (impactedIds.length > 0) {
      await markSnapshotsExpired(node.novelId, Math.min(...impactedIds));
    }

    // 更新对应的md文件信息（如果是章节点）
    if (node.level === 3) {
      const chaptersDir = path.join(process.cwd(), 'chapters');
      // 这里需要处理文件重命名逻辑，暂时省略
    }

    return reply.send({
      success: true,
      data: {
        impactedChapterIds: impactedIds
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `更新大纲节点失败: ${error.message}`
    });
  }
}

// 移动大纲节点
export async function moveOutlineNode(request: FastifyRequest<{
  Body: {
    nodeId: number;
    newParentId?: number;
    newOrder: number;
  }
}>, reply: FastifyReply) {
  try {
    const { nodeId, newParentId, newOrder } = request.body;
    await moveOutlineNode(nodeId, newParentId, newOrder);

    // 获取受影响的章节
    const impactedIds = await getImpactedChapterIds(nodeId);

    return reply.send({
      success: true,
      data: {
        impactedChapterIds: impactedIds
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `移动大纲节点失败: ${error.message}`
    });
  }
}

// 获取大纲树
export async function getOutlineTree(request: FastifyRequest<{
  Body: {
    novelId: number;
    level?: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId, level } = request.body;
    const tree = await getOutlineTree(novelId, level);

    return reply.send({
      success: true,
      data: {
        tree
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取大纲树失败: ${error.message}`
    });
  }
}
