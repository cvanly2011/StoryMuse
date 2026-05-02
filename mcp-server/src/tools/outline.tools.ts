import { FastifyRequest, FastifyReply } from 'fastify';
import { outlineNodeDAO } from '../database/dao/outline-node.dao';
import { fileSyncService } from '../services/file-sync.service';
import { validateRequired, validateNumber, validateString, validateEnum } from '../utils/validation.utils';
import path from 'path';
import fs from 'fs';

// 请求类型定义
interface CreateNodeRequest {
  parentId?: number;
  level: number;
  order: number;
  title: string;
  description?: string;
  characterGoals?: string;
  conflictPoints?: string;
  turningPoints?: string;
  foreshadowingHints?: string;
  wordCountTarget?: number;
  status?: 'pending' | 'writing' | 'completed' | 'locked';
}

interface UpdateNodeRequest {
  parentId?: number;
  level?: number;
  order?: number;
  title?: string;
  description?: string;
  characterGoals?: string;
  conflictPoints?: string;
  turningPoints?: string;
  foreshadowingHints?: string;
  wordCountTarget?: number;
  status?: 'pending' | 'writing' | 'completed' | 'locked';
}

interface UpdateNodeStatusRequest {
  status: 'pending' | 'writing' | 'completed' | 'locked';
}

/**
 * 获取完整大纲树
 */
export async function getOutlineTree(request: FastifyRequest, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const allNodes = outlineNodeDAO.findAll({ novel_id: novelId }, '"level" ASC, "order" ASC');

    // 构建树形结构
    const nodeMap = new Map<number, any>();
    const rootNodes: any[] = [];

    // 第一遍：创建节点映射，添加children字段
    allNodes.forEach(node => {
      nodeMap.set(node.id, {
        ...node,
        children: []
      });
    });

    // 第二遍：构建树形结构
    allNodes.forEach(node => {
      const treeNode = nodeMap.get(node.id);
      if (node.parent_id === null) {
        rootNodes.push(treeNode);
      } else {
        const parent = nodeMap.get(node.parent_id);
        if (parent) {
          parent.children.push(treeNode);
        }
      }
    });

    return reply.send({
      success: true,
      data: {
        tree: rootNodes,
        totalNodes: allNodes.length
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取大纲失败: ${error.message}`
    });
  }
}

/**
 * 创建新的大纲节点
 */
export async function createOutlineNode(request: FastifyRequest<{ Body: CreateNodeRequest }>, reply: FastifyReply) {
  try {
    const novelId = fileSyncService['novelId'];
    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    const nodeData = request.body;

    // 参数验证
    validateRequired(nodeData, ['level', 'order', 'title']);
    validateNumber(nodeData.level, 'level', 1, 10); // 最多支持10级大纲
    validateNumber(nodeData.order, 'order', 1);
    validateString(nodeData.title, 'title', 1, 200);

    if (nodeData.parentId !== undefined) {
      validateNumber(nodeData.parentId, 'parentId', 1);
    }

    if (nodeData.wordCountTarget !== undefined) {
      validateNumber(nodeData.wordCountTarget, 'wordCountTarget', 0, 100000);
    }

    if (nodeData.status !== undefined) {
      validateEnum(nodeData.status, 'status', ['pending', 'writing', 'completed', 'locked']);
    }

    // 生成路径
    let pathStr = '';
    if (nodeData.parentId) {
      const parent = outlineNodeDAO.findById(nodeData.parentId);
      if (!parent || parent.novel_id !== novelId) {
        return reply.status(404).send({
          success: false,
          message: '父节点不存在'
        });
      }
      pathStr = `${parent.path}/${nodeData.order}`;
    } else {
      // 根节点路径为order
      pathStr = `${nodeData.order}`;
    }

    const nodeId = outlineNodeDAO.insert({
      novel_id: novelId,
      parent_id: nodeData.parentId || null,
      level: nodeData.level,
      order: nodeData.order,
      title: nodeData.title,
      description: nodeData.description || '',
      character_goals: nodeData.characterGoals || '',
      conflict_points: nodeData.conflictPoints || '',
      turning_points: nodeData.turningPoints || '',
      foreshadowing_hints: nodeData.foreshadowingHints || '',
      word_count_target: nodeData.wordCountTarget || 0,
      status: nodeData.status || 'pending',
      path: pathStr,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const newNode = outlineNodeDAO.findById(nodeId);

    return reply.status(201).send({
      success: true,
      message: '大纲节点创建成功',
      data: { node: newNode }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `创建大纲节点失败: ${error.message}`
    });
  }
}

/**
 * 更新大纲节点
 */
export async function updateOutlineNode(request: FastifyRequest<{
  Body: UpdateNodeRequest & { id: number }
}>, reply: FastifyReply) {
  try {
    const nodeId = request.body.id;
    const updates = request.body;
    const novelId = fileSyncService['novelId'];

    const existingNode = outlineNodeDAO.findById(nodeId);
    if (!existingNode || existingNode.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '大纲节点不存在'
      });
    }

    // 如果parentId或order变化，需要更新路径
    let pathStr = existingNode.path;
    if (updates.parentId !== undefined || updates.order !== undefined) {
      const parentId = updates.parentId !== undefined ? updates.parentId : existingNode.parent_id;
      const order = updates.order !== undefined ? updates.order : existingNode.order;

      if (parentId) {
        const parent = outlineNodeDAO.findById(parentId);
        if (!parent || parent.novel_id !== novelId) {
          return reply.status(404).send({
            success: false,
            message: '父节点不存在'
          });
        }
        pathStr = `${parent.path}/${order}`;
      } else {
        pathStr = `${order}`;
      }
    }

    // 转换字段为snake_case
    const dbUpdates: any = {
      path: pathStr,
      updated_at: new Date().toISOString()
    };
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
    if (updates.level !== undefined) dbUpdates.level = updates.level;
    if (updates.order !== undefined) dbUpdates.order = updates.order;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.characterGoals !== undefined) dbUpdates.character_goals = updates.characterGoals;
    if (updates.conflictPoints !== undefined) dbUpdates.conflict_points = updates.conflictPoints;
    if (updates.turningPoints !== undefined) dbUpdates.turning_points = updates.turningPoints;
    if (updates.foreshadowingHints !== undefined) dbUpdates.foreshadowing_hints = updates.foreshadowingHints;
    if (updates.wordCountTarget !== undefined) dbUpdates.word_count_target = updates.wordCountTarget;
    if (updates.status !== undefined) dbUpdates.status = updates.status;

    const updatedCount = outlineNodeDAO.update(nodeId, dbUpdates);

    if (updatedCount === 0) {
      return reply.status(404).send({
        success: false,
        message: '大纲节点不存在'
      });
    }

    const updatedNode = outlineNodeDAO.findById(nodeId);

    return reply.send({
      success: true,
      message: '大纲节点更新成功',
      data: { node: updatedNode }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `更新大纲节点失败: ${error.message}`
    });
  }
}

/**
 * 删除大纲节点（包含所有子节点）
 */
export async function deleteOutlineNode(request: FastifyRequest<{ Body: { id: number } }>, reply: FastifyReply) {
  try {
    const nodeId = request.body.id;
    const novelId = fileSyncService['novelId'];

    const existingNode = outlineNodeDAO.findById(nodeId);
    if (!existingNode || existingNode.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '大纲节点不存在'
      });
    }

    // 删除节点及其所有子节点
    const deletedCount = outlineNodeDAO.deleteNodeAndChildren(nodeId);

    if (deletedCount === 0) {
      return reply.status(404).send({
        success: false,
        message: '大纲节点不存在'
      });
    }

    return reply.send({
      success: true,
      message: '大纲节点及所有子节点删除成功'
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `删除大纲节点失败: ${error.message}`
    });
  }
}

/**
 * 更新节点状态
 */
export async function updateNodeStatus(request: FastifyRequest<{
  Body: UpdateNodeStatusRequest & { id: number }
}>, reply: FastifyReply) {
  try {
    const nodeId = request.body.id;
    const { status } = request.body;
    const novelId = fileSyncService['novelId'];

    const existingNode = outlineNodeDAO.findById(nodeId);
    if (!existingNode || existingNode.novel_id !== novelId) {
      return reply.status(404).send({
        success: false,
        message: '大纲节点不存在'
      });
    }

    const updatedCount = outlineNodeDAO.update(nodeId, {
      status,
      updated_at: new Date().toISOString()
    });

    if (updatedCount === 0) {
      return reply.status(404).send({
        success: false,
        message: '大纲节点不存在'
      });
    }

    const updatedNode = outlineNodeDAO.findById(nodeId);

    return reply.send({
      success: true,
      message: '节点状态更新成功',
      data: { node: updatedNode }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `更新节点状态失败: ${error.message}`
    });
  }
}

/**
 * 从outline.md文件重建大纲
 */
export async function rebuildOutlineFromFile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const projectRoot = fileSyncService['projectRoot'];
    const novelId = fileSyncService['novelId'];

    if (!projectRoot || !novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃项目，请先初始化项目'
      });
    }

    const outlinePath = path.join(projectRoot, 'outline.md');
    if (!fs.existsSync(outlinePath)) {
      return reply.status(404).send({
        success: false,
        message: '项目根目录下未找到outline.md文件'
      });
    }

    const syncResult = await fileSyncService.syncFile(outlinePath);

    if (!syncResult.success) {
      return reply.status(500).send({
        success: false,
        message: `同步大纲文件失败: ${syncResult.error}`,
        data: syncResult
      });
    }

    return reply.send({
      success: true,
      message: '大纲已从文件重建成功',
      data: syncResult
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `重建大纲失败: ${error.message}`
    });
  }
}

/**
 * 按层级获取节点
 */
export async function getNodesByLevel(request: FastifyRequest<{ Body: { level: number } }>, reply: FastifyReply) {
  try {
    const level = request.body.level;
    const novelId = fileSyncService['novelId'];

    if (!novelId) {
      return reply.status(400).send({
        success: false,
        message: '无活跃小说，请先初始化项目'
      });
    }

    if (isNaN(level) || level < 1) {
      return reply.status(400).send({
        success: false,
        message: '层级参数必须为大于0的数字'
      });
    }

    const nodes = outlineNodeDAO.findByLevel(novelId, level);

    return reply.send({
      success: true,
      data: {
        nodes,
        count: nodes.length,
        level
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取节点失败: ${error.message}`
    });
  }
}
