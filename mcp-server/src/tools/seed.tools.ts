import { FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs';
import path from 'path';
import { createSeed, getMaxVersion, getActiveSeed, listSeedVersions, setActiveSeed } from '../database/dao/seed.dao';
import { markSnapshotsExpired } from '../database/dao/snapshot.dao';

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
    const maxVersion = await getMaxVersion(params.novelId);
    const newVersion = maxVersion + 1;

    const seed = await createSeed({
      ...params,
      version: newVersion,
      isActive: params.setAsActive ?? false
    });

    // 更新工作区的story-seed.md文件
    if (params.setAsActive) {
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

      // 标记所有快照过期，因为核心设定修改了
      await markSnapshotsExpired(params.novelId, 1);
    }

    return reply.send({
      success: true,
      data: {
        seedId: seed.id,
        version: seed.version
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
    const seed = await getActiveSeed(novelId);

    return reply.send({
      success: true,
      data: seed || null
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
    const versions = await listSeedVersions(novelId);

    return reply.send({
      success: true,
      data: {
        versions: versions.map(v => ({
          id: v.id,
          version: v.version,
          coreIdea: v.coreIdea.substring(0, 100) + (v.coreIdea.length > 100 ? '...' : ''),
          createdAt: v.createdAt,
          isActive: v.isActive
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
