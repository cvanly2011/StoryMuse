import { FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs';
import path from 'path';
import { rebuildDatabase } from '../database';
import { detectModifiedFiles } from '../services/file.service';

// 加载文件内容到数据库
export async function loadFileContent(request: FastifyRequest<{
  Body: {
    fileType: 'seed' | 'outline' | 'character' | 'chapter';
    filePath: string;
    chapterId?: number;
  }
}>, reply: FastifyReply) {
  try {
    const { fileType, filePath, chapterId } = request.body;
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      return reply.status(404).send({
        success: false,
        message: '文件不存在'
      });
    }

    const content = fs.readFileSync(fullPath, 'utf-8');

    // 根据不同文件类型处理内容，更新数据库
    // 这里实现具体的解析和更新逻辑，暂时省略
    // 不同文件类型需要不同的解析规则，提取元数据和内容

    return reply.send({
      success: true,
      message: `${fileType}文件已成功加载到数据库`
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `加载文件失败: ${error.message}`
    });
  }
}

// 检测修改的文件
export async function detectModifiedFiles(request: FastifyRequest, reply: FastifyReply) {
  try {
    const modifiedFiles = await detectModifiedFiles();
    return reply.send({
      success: true,
      data: {
        modifiedFiles
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `检测修改文件失败: ${error.message}`
    });
  }
}

// 重建数据库
export async function rebuildDatabase(request: FastifyRequest, reply: FastifyReply) {
  try {
    await rebuildDatabase();
    return reply.send({
      success: true,
      message: '数据库已成功重建，所有内容已从工作区文件恢复'
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `重建数据库失败: ${error.message}`
    });
  }
}
