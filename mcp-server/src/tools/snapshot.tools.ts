import { FastifyRequest, FastifyReply } from 'fastify';
import { createSnapshot, getCurrentSnapshot, getMaxSnapshotVersion } from '../database/dao/snapshot.dao';
import { getActiveSeed } from '../database/dao/seed.dao';
import { listUnpaidForeshadowings } from '../database/dao/foreshadowing.dao';
import { getChapterContent, getCompletedChapterIds } from '../database/dao/chapter.dao';
import { getOutlineNodeById } from '../database/dao/outline.dao';

// 生成上下文快照（核心低token优化）
export async function generateContextSnapshot(request: FastifyRequest<{
  Body: {
    novelId: number;
    chapterId: number;
    previousChaptersCount?: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId, chapterId, previousChaptersCount = 3 } = request.body;
    const node = await getOutlineNodeById(chapterId);

    if (!node) {
      return reply.status(404).send({
        success: false,
        message: '章节不存在'
      });
    }

    // 1. 获取故事核心设定
    const activeSeed = await getActiveSeed(novelId);

    // 2. 获取前N章的摘要和关键事件
    const allCompletedChapters = await getCompletedChapterIds(novelId);
    const currentChapterIndex = allCompletedChapters.indexOf(chapterId);
    const previousChapterIds = currentChapterIndex > 0
      ? allCompletedChapters.slice(Math.max(0, currentChapterIndex - previousChaptersCount), currentChapterIndex)
      : [];

    const previousChaptersSummary = await Promise.all(
      previousChapterIds.map(async id => {
        const chapter = await getChapterContent(id);
        if (chapter) {
          return {
            chapterId: id,
            summary: chapter.summary,
            keyEvents: JSON.parse(chapter.keyEvents),
            characterChanges: JSON.parse(chapter.characterAppearances)
          };
        }
        return null;
      })
    );

    // 3. 获取未回收的重要伏笔
    const unpaidForeshadowings = await listUnpaidForeshadowings(novelId, chapterId);

    // 4. 获取当前章节的写作要求
    const chapterRequirements = {
      title: node.title,
      description: node.description,
      characterGoals: node.characterGoals,
      conflictPoints: node.conflictPoints,
      turningPoints: node.turningPoints,
      foreshadowingHints: node.foreshadowingHints
    };

    // 5. 组装快照，严格控制内容大小，确保总token不超过2000
    const snapshotContent = {
      coreSetting: activeSeed ? {
        coreIdea: activeSeed.coreIdea.substring(0, 200),
        worldSetting: activeSeed.worldSetting?.substring(0, 200)
      } : null,
      previousChapters: previousChaptersSummary.filter(Boolean).map(c => ({
        summary: c!.summary.substring(0, 150),
        keyEvents: c!.keyEvents.slice(0, 3).map((e: string) => e.substring(0, 100))
      })),
      importantUnpaidForeshadowings: unpaidForeshadowings
        .filter(f => f.importance >= 7)
        .slice(0, 5)
        .map(f => ({
          id: f.id,
          description: f.description.substring(0, 100),
          setupChapterId: f.setupChapterId
        })),
      currentChapterRequirements: {
        title: chapterRequirements.title,
        description: chapterRequirements.description?.substring(0, 200),
        coreConflict: chapterRequirements.conflictPoints?.substring(0, 150)
      }
    };

    const snapshotContentStr = JSON.stringify(snapshotContent);

    // 保存快照
    const maxVersion = await getMaxSnapshotVersion(novelId, chapterId);
    const snapshot = await createSnapshot({
      novelId,
      chapterId,
      snapshotContent: snapshotContentStr,
      snapshotVersion: maxVersion + 1
    });

    return reply.send({
      success: true,
      data: {
        snapshotId: snapshot.id,
        version: snapshot.snapshotVersion,
        tokenSize: snapshotContentStr.length, // 粗略估算token数量
        snapshotContent: snapshotContent
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `生成快照失败: ${error.message}`
    });
  }
}

// 获取当前上下文快照
export async function getCurrentContextSnapshot(request: FastifyRequest<{
  Body: {
    novelId: number;
    chapterId: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId, chapterId } = request.body;
    const snapshot = await getCurrentSnapshot(novelId, chapterId);

    if (!snapshot) {
      // 如果不存在，自动生成一个
      const generateResult = await generateContextSnapshot(request as any, reply as any);
      return generateResult;
    }

    return reply.send({
      success: true,
      data: {
        snapshotId: snapshot.id,
        version: snapshot.snapshotVersion,
        snapshotContent: JSON.parse(snapshot.snapshotContent)
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取快照失败: ${error.message}`
    });
  }
}
