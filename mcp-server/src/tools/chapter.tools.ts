import { FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs';
import path from 'path';
import { chapterDAO } from '../database/dao/chapter.dao';
import { outlineNodeDAO } from '../database/dao/outline-node.dao';
// import { markSnapshotsExpired } from '../database/dao/snapshot.dao'; // 暂时注释
// import { generateContextSnapshot } from './snapshot.tools'; // 暂时注释

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
    const maxVersion = chapterDAO.getLatestVersion(params.outlineNodeId);
    const newVersion = maxVersion + 1;

    // 计算字数
    const wordCount = params.content.replace(/\s+/g, ' ').trim().split(' ').length;

    const chapter = chapterDAO.createVersion({
      outline_node_id: params.outlineNodeId,
      version: newVersion,
      content: params.content,
      word_count: wordCount,
      summary: params.summary,
      key_events: JSON.stringify(params.keyEvents),
      character_appearances: JSON.stringify(params.characterAppearances),
      foreshadowing_ids: params.foreshadowingIds ? JSON.stringify(params.foreshadowingIds) : undefined,
      created_by: params.createdBy
    });

    // 更新大纲节点状态为已完成
    outlineNodeDAO.update(params.outlineNodeId, {
      status: 'completed',
      updated_at: new Date().toISOString()
    });

    // 更新对应的md文件
    const node = outlineNodeDAO.findById(params.outlineNodeId);
    if (node) {
      const chaptersDir = path.join(process.cwd(), 'chapters');
      if (!fs.existsSync(chaptersDir)) {
        fs.mkdirSync(chaptersDir, { recursive: true });
      }
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
    // 简化实现，暂时省略

    return reply.send({
      success: true,
      data: {
        chapterId: chapter.id,
        version: chapter.version,
        wordCount: chapter.word_count
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
    const versions = chapterDAO.findAllByOutlineNodeId(outlineNodeId);

    return reply.send({
      success: true,
      data: {
        versions: versions.map(v => ({
          id: v.id,
          outlineNodeId: v.outline_node_id,
          version: v.version,
          wordCount: v.word_count,
          summary: v.summary,
          createdAt: v.created_at
        }))
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
    let chapter;
    if (version) {
      chapter = chapterDAO.findByVersion(outlineNodeId, version);
    } else {
      chapter = chapterDAO.findCurrentByOutlineNodeId(outlineNodeId);
    }

    if (!chapter) {
      return reply.status(404).send({
        success: false,
        message: '章节不存在'
      });
    }

    const data: any = {
      id: chapter.id,
      version: chapter.version,
      wordCount: chapter.word_count,
      summary: chapter.summary,
      keyEvents: JSON.parse(chapter.key_events),
      characterAppearances: JSON.parse(chapter.character_appearances),
      createdBy: chapter.created_by,
      createdAt: chapter.created_at
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
    // 设置目标版本为当前版本
    const changes = chapterDAO.setCurrentVersion(outlineNodeId, targetVersion);
    if (changes === 0) {
      return reply.status(404).send({
        success: false,
        message: '章节或版本不存在'
      });
    }

    // 获取目标版本内容
    const chapter = chapterDAO.findByVersion(outlineNodeId, targetVersion);
    if (!chapter) {
      return reply.status(404).send({
        success: false,
        message: '版本不存在'
      });
    }

    // 更新对应的md文件
    const node = outlineNodeDAO.findById(outlineNodeId);
    if (node) {
      const chaptersDir = path.join(process.cwd(), 'chapters');
      if (!fs.existsSync(chaptersDir)) {
        fs.mkdirSync(chaptersDir, { recursive: true });
      }
      const chapterPath = path.join(chaptersDir, `第${node.order}章 ${node.title}.md`);

      const content = `---
chapter_id: ${node.id}
version: ${targetVersion}
word_count: ${chapter.word_count}
---
# ${node.title}
${chapter.content}

## 章节摘要
${chapter.summary}

## 关键事件
${JSON.parse(chapter.key_events).map((event: string) => `- ${event}`).join('\n')}
`;

      fs.writeFileSync(chapterPath, content);
    }

    // 标记后续章节快照过期（暂时注释）
    // await markSnapshotsExpired(node!.novelId, outlineNodeId + 1);

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
