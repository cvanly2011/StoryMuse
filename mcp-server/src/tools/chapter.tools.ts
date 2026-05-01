import { FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs';
import path from 'path';
import { createChapterVersion, getMaxChapterVersion, listChapterVersions, getChapterContent, rollbackChapter } from '../database/dao/chapter.dao';
import { updateOutlineNode, getOutlineNodeById } from '../database/dao/outline.dao';
import { markSnapshotsExpired } from '../database/dao/snapshot.dao';
import { generateContextSnapshot } from './snapshot.tools';

// 保存章节版本
export async function saveChapterVersion(request: FastifyRequest<{
  Body: {
    outlineNodeId: number;
    content: string;
    summary: string;
    keyEvents: string[];
    characterAppearances: any[];
    foreshadowingIds?: number[];
    createdBy?: string;
  }
}>, reply: FastifyReply) {
  try {
    const params = request.body;
    const maxVersion = await getMaxChapterVersion(params.outlineNodeId);
    const newVersion = maxVersion + 1;

    // 计算字数
    const wordCount = params.content.replace(/\s+/g, ' ').trim().split(' ').length;

    const chapter = await createChapterVersion({
      ...params,
      version: newVersion,
      wordCount,
      keyEvents: JSON.stringify(params.keyEvents),
      characterAppearances: JSON.stringify(params.characterAppearances),
      foreshadowingIds: params.foreshadowingIds ? JSON.stringify(params.foreshadowingIds) : undefined
    });

    // 更新大纲节点状态为已完成
    await updateOutlineNode(params.outlineNodeId, { status: 'completed' });

    // 更新对应的md文件
    const node = await getOutlineNodeById(params.outlineNodeId);
    if (node) {
      const chaptersDir = path.join(process.cwd(), 'chapters');
      const chapterPath = path.join(chaptersDir, `第${node.order}章 ${node.title}.md`);

      const content = `---
chapter_id: ${node.id}
version: ${newVersion}
word_count: ${wordCount}
---
# ${node.title}
${params.content}

## 章节摘要
${params.summary}

## 关键事件
${params.keyEvents.map(event => `- ${event}`).join('\n')}
`;

      fs.writeFileSync(chapterPath, content);
    }

    // 自动生成下一章的上下文快照
    const node = await getOutlineNodeById(params.outlineNodeId);
    if (node) {
      // 这里可以找到下一章的ID，提前生成快照，优化体验
      // 简化实现，暂时省略
    }

    return reply.send({
      success: true,
      data: {
        chapterId: chapter.id,
        version: chapter.version,
        wordCount: chapter.wordCount
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `保存章节失败: ${error.message}`
    });
  }
}

// 获取章节版本列表
export async function listChapterVersions(request: FastifyRequest<{
  Body: {
    outlineNodeId: number;
  }
}>, reply: FastifyReply) {
  try {
    const { outlineNodeId } = request.body;
    const versions = await listChapterVersions(outlineNodeId);

    return reply.send({
      success: true,
      data: {
        versions
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取版本列表失败: ${error.message}`
    });
  }
}

// 获取章节内容
export async function getChapterContent(request: FastifyRequest<{
  Body: {
    outlineNodeId: number;
    version?: number;
    includeFullContent?: boolean;
  }
}>, reply: FastifyReply) {
  try {
    const { outlineNodeId, version, includeFullContent = false } = request.body;
    const chapter = await getChapterContent(outlineNodeId, version);

    if (!chapter) {
      return reply.status(404).send({
        success: false,
        message: '章节不存在'
      });
    }

    const data: any = {
      id: chapter.id,
      version: chapter.version,
      wordCount: chapter.wordCount,
      summary: chapter.summary,
      keyEvents: JSON.parse(chapter.keyEvents),
      characterAppearances: JSON.parse(chapter.characterAppearances),
      createdBy: chapter.createdBy,
      createdAt: chapter.createdAt
    };

    if (includeFullContent) {
      data.content = chapter.content;
    }

    return reply.send({
      success: true,
      data
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取章节内容失败: ${error.message}`
    });
  }
}

// 回滚章节
export async function rollbackChapter(request: FastifyRequest<{
  Body: {
    outlineNodeId: number;
    targetVersion: number;
  }
}>, reply: FastifyReply) {
  try {
    const { outlineNodeId, targetVersion } = request.body;
    const chapter = await rollbackChapter(outlineNodeId, targetVersion);

    if (!chapter) {
      return reply.status(404).send({
        success: false,
        message: '章节不存在'
      });
    }

    // 更新对应的md文件
    const node = await getOutlineNodeById(outlineNodeId);
    if (node) {
      const chaptersDir = path.join(process.cwd(), 'chapters');
      const chapterPath = path.join(chaptersDir, `第${node.order}章 ${node.title}.md`);

      const content = `---
chapter_id: ${node.id}
version: ${targetVersion}
word_count: ${chapter.wordCount}
---
# ${node.title}
${chapter.content}

## 章节摘要
${chapter.summary}

## 关键事件
${JSON.parse(chapter.keyEvents).map((event: string) => `- ${event}`).join('\n')}
`;

      fs.writeFileSync(chapterPath, content);
    }

    // 标记后续章节快照过期
    await markSnapshotsExpired(node!.novelId, outlineNodeId + 1);

    return reply.send({
      success: true,
      data: {
        newVersion: targetVersion
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `回滚章节失败: ${error.message}`
    });
  }
}
