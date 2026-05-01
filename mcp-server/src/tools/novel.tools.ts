import { FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs';
import path from 'path';
import { novelDAO } from '../database/dao/novel.dao';
import { chapterDAO } from '../database/dao/chapter.dao';
import { outlineNodeDAO } from '../database/dao/outline-node.dao';

// 创建小说
export async function createNovel(request: FastifyRequest<{
  Body: {
    name: string;
    description: string;
    genre?: string;
    targetPlatform?: string;
    wordCountTarget?: number;
  }
}>, reply: FastifyReply) {
  try {
    const params = request.body;
    const novel = novelDAO.create(params);

    // 自动创建默认三幕大纲结构
    const act1Id = outlineNodeDAO.insert({
      novel_id: novel.id,
      level: 1,
      order: 1,
      title: '第一幕：入世',
      description: '故事开端，介绍世界观、主要人物，触发核心冲突',
      status: 'pending',
      path: '1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const act2Id = outlineNodeDAO.insert({
      novel_id: novel.id,
      level: 1,
      order: 2,
      title: '第二幕：成长',
      description: '主角踏上冒险，遭遇一系列挫折，midpoint转折点，冲突升级',
      status: 'pending',
      path: '2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const act3Id = outlineNodeDAO.insert({
      novel_id: novel.id,
      level: 1,
      order: 3,
      title: '第三幕：巅峰',
      description: '最终对决，冲突解决，人物弧光完成，结局收尾',
      status: 'pending',
      path: '3',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // 创建绑定配置文件
    const configPath = path.join(process.cwd(), '.story-muse.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      novelId: novel.id,
      novelName: novel.name,
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    }, null, 2));

    // 创建默认目录结构
    const chaptersDir = path.join(process.cwd(), 'chapters');
    if (!fs.existsSync(chaptersDir)) {
      fs.mkdirSync(chaptersDir, { recursive: true });
    }

    // 创建默认文件
    const seedPath = path.join(process.cwd(), 'story-seed.md');
    if (!fs.existsSync(seedPath)) {
      fs.writeFileSync(seedPath, `# ${novel.name} - 故事核心
## 核心创意
${novel.description}

## 世界观设定
<!-- 在这里描述你的故事世界规则 -->

## 核心人物
<!-- 在这里描述主要人物 -->

## 核心卖点
<!-- 在这里描述故事的核心吸引力 -->
`);
    }

    const outlinePath = path.join(process.cwd(), 'outline.md');
    if (!fs.existsSync(outlinePath)) {
      fs.writeFileSync(outlinePath, `# ${novel.name} - 故事大纲
## 第一幕：入世
<!-- 在这里写第一幕的详细大纲 -->

## 第二幕：成长
<!-- 在这里写第二幕的详细大纲 -->

## 第三幕：巅峰
<!-- 在这里写第三幕的详细大纲 -->
`);
    }

    const charactersPath = path.join(process.cwd(), 'characters.md');
    if (!fs.existsSync(charactersPath)) {
      fs.writeFileSync(charactersPath, `# ${novel.name} - 人物设定
## 主角
<!-- 在这里写主角设定 -->

## 反派
<!-- 在这里写反派设定 -->

## 重要配角
<!-- 在这里写其他重要人物设定 -->
`);
    }

    return reply.send({
      success: true,
      data: {
        novelId: novel.id,
        slug: novel.slug,
        createdAt: novel.createdAt
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `创建小说失败: ${error.message}`
    });
  }
}

// 获取小说信息
export async function getNovelInfo(request: FastifyRequest<{
  Body: {
    novelId: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId } = request.body;
    const novel = novelDAO.findById(novelId);

    if (!novel) {
      return reply.status(404).send({
        success: false,
        message: '小说不存在'
      });
    }

    const totalWordCount = novelDAO.getTotalWordCount(novelId);
    const progress = novelDAO.getProgress(novelId);

    return reply.send({
      success: true,
      data: {
        ...novel,
        totalWordCount,
        progress
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取小说信息失败: ${error.message}`
    });
  }
}

// 获取小说列表
export async function listNovels(request: FastifyRequest, reply: FastifyReply) {
  try {
    const novels = novelDAO.listAll();

    // 暂时注释统计信息，先测试基本功能
    // const novelsWithStats = novels.map(novel => {
    //   const totalWordCount = novelDAO.getTotalWordCount(novel.id);
    //   const progress = novelDAO.getProgress(novel.id);
    //   return {
    //     ...novel,
    //     totalWordCount,
    //     progress
    //   };
    // });

    return reply.send({
      success: true,
      data: {
        novels: novels
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取小说列表失败: ${error.message}`
    });
  }
}

// 获取小说全局概览
export async function getNovelOverview(request: FastifyRequest<{
  Body: {
    novelId: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId } = request.body;
    const novel = novelDAO.findById(novelId);

    if (!novel) {
      return reply.status(404).send({
        success: false,
        message: '小说不存在'
      });
    }

    const totalWordCount = novelDAO.getTotalWordCount(novelId);
    const progress = novelDAO.getProgress(novelId);
    const completedChapterIds = chapterDAO.getCompletedChapterIds(novelId);

    return reply.send({
      success: true,
      data: {
        novel,
        totalWordCount,
        progress,
        completedChapters: completedChapterIds.length
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取全局概览失败: ${error.message}`
    });
  }
}

// 获取故事时间线
export async function getStoryTimeline(request: FastifyRequest<{
  Body: {
    novelId: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId } = request.body;
    const completedChapterIds = chapterDAO.getCompletedChapterIds(novelId);

    // 这里可以实现更复杂的时间线生成逻辑，从章节中提取关键事件
    // 简化实现，暂时返回章节ID列表
    return reply.send({
      success: true,
      data: {
        timeline: completedChapterIds
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取时间线失败: ${error.message}`
    });
  }
}
