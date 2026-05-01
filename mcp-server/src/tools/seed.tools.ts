import { FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs';
import path from 'path';
import { storySeedDAO } from '../database/dao/story-seed.dao';
import { contextSnapshotDAO } from '../database/dao/context-snapshot.dao';

// 保存故事种子
export async function saveStorySeed(request: FastifyRequest<{
  Body: {
    novelId: number;
    coreIdea: string;
    worldSetting?: string;
    coreCharactersSilhouette?: string;
    sellingPoints?: string;
    setAsActive?: boolean;
  }
}>, reply: FastifyReply) {
  try {
    const params = request.body;
    const maxVersion = storySeedDAO.getLatestVersion(params.novelId);
    const newVersion = maxVersion + 1;

    const seedId = storySeedDAO.insert({
      novel_id: params.novelId,
      version: newVersion,
      core_idea: params.coreIdea,
      world_setting: params.worldSetting,
      core_characters_silhouette: params.coreCharactersSilhouette,
      selling_points: params.sellingPoints,
      is_active: params.setAsActive ?? false,
      created_at: new Date().toISOString()
    });

    // 更新工作区的story-seed.md文件
    if (params.setAsActive) {
      // 将其他版本设为非激活
      if (maxVersion > 0) {
        storySeedDAO.updateBy(
          { novel_id: params.novelId, version: { $ne: newVersion } as any },
          { is_active: false }
        );
      }

      const seedPath = path.join(process.cwd(), 'story-seed.md');
      let content = `# 故事核心设定 v${newVersion}
## 核心创意
${params.coreIdea}
`;

      if (params.worldSetting) {
        content += `
## 世界观设定
${params.worldSetting}
`;
      }

      if (params.coreCharactersSilhouette) {
        content += `
## 核心人物
${params.coreCharactersSilhouette}
`;
      }

      if (params.sellingPoints) {
        content += `
## 核心卖点
${params.sellingPoints}
`;
      }

      fs.writeFileSync(seedPath, content);

      // 标记所有快照过期，因为核心设定修改了（暂时注释，后续实现）
      // await markSnapshotsExpired(params.novelId, 1);
    }

    return reply.send({
      success: true,
      data: {
        seedId: seedId,
        version: newVersion
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `保存种子失败: ${error.message}`
    });
  }
}

// 获取当前激活的种子
export async function getActiveSeed(request: FastifyRequest<{
  Body: {
    novelId: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId } = request.body;
    const seed = storySeedDAO.findActiveByNovelId(novelId);

    return reply.send({
      success: true,
      data: seed ? {
        id: seed.id,
        novelId: seed.novel_id,
        version: seed.version,
        coreIdea: seed.core_idea,
        worldSetting: seed.world_setting,
        coreCharactersSilhouette: seed.core_characters_silhouette,
        sellingPoints: seed.selling_points,
        isActive: seed.is_active,
        createdAt: seed.created_at
      } : null
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取激活种子失败: ${error.message}`
    });
  }
}

// 获取种子版本列表
export async function listSeedVersions(request: FastifyRequest<{
  Body: {
    novelId: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId } = request.body;
    const versions = storySeedDAO.findAllByNovelId(novelId);

    return reply.send({
      success: true,
      data: {
        versions: versions.map(v => ({
          id: v.id,
          version: v.version,
          coreIdea: v.core_idea.substring(0, 100) + (v.core_idea.length > 100 ? '...' : ''),
          createdAt: v.created_at,
          isActive: v.is_active
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
