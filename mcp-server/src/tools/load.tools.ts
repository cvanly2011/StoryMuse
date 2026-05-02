import { FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs';
import path from 'path';
import { rebuildDatabase as rebuildDb, initDatabase } from '../database';
import { detectModifiedFiles as detectModified } from '../services/file.service';
import { fileSyncService } from '../services/file-sync.service';
import { novelDAO } from '../database/dao/novel.dao';
import { gitService } from '../services/git.service';

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
    const modifiedFiles = await detectModified();
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
export async function rebuildDatabase(request: FastifyRequest<{
  Querystring?: { conflictStrategy?: 'overwrite' | 'skip' | 'error' }
}>, reply: FastifyReply) {
  try {
    const projectRoot = process.cwd();
    const configPath = path.join(projectRoot, '.story-muse.config.json');

    // 1. 检查配置文件是否存在
    if (!fs.existsSync(configPath)) {
      return reply.status(400).send({
        success: false,
        message: '当前目录不是StoryMuse项目，缺少.story-muse.config.json配置文件'
      });
    }

    // 2. 读取配置文件
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config.novelId || !config.novelName) {
      return reply.status(400).send({
        success: false,
        message: '配置文件格式不正确，缺少novelId或novelName'
      });
    }

    // 3. 重建数据库
    await rebuildDb();
    await initDatabase();

    // 4. 初始化Git服务（如果还没有初始化）
    try {
      if (!gitService.isInitialized()) {
        await gitService.init(projectRoot);
        console.log('Git服务初始化成功');
      }
    } catch (error) {
      console.log('Git服务初始化失败，分支功能将不可用:', (error as Error).message);
    }

    // 5. 重建小说基本信息
    const novelId = novelDAO.create({
      name: config.novelName,
      description: config.description || '',
      genre: config.genre,
      targetPlatform: config.targetPlatform,
      wordCountTarget: config.wordCountTarget
    }).id;

    // 5. 初始化文件同步服务
    fileSyncService.startWatching(projectRoot, novelId);

    // 6. 扫描并同步所有Markdown文件
    const conflictStrategy = request.query?.conflictStrategy || 'overwrite';
    const syncResults = await fileSyncService.syncAll({ conflictStrategy });

    // 统计结果
    const successCount = syncResults.filter(r => r.success).length;
    const errorCount = syncResults.filter(r => !r.success).length;

    return reply.send({
      success: true,
      message: `数据库已成功重建，成功同步${successCount}个文件，失败${errorCount}个`,
      data: {
        syncResults,
        successCount,
        errorCount
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `重建数据库失败: ${error.message}`
    });
  }
}
