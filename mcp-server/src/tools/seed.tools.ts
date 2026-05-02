import fs from 'fs';
import path from 'path';
import { storySeedDAO } from '../database/dao/story-seed.dao';
import { novelDAO } from '../database/dao/novel.dao';
import { fileSyncService } from '../services/file-sync.service';

// 保存故事种子参数
interface SaveStorySeedParams {
  novelId?: number;
  coreIdea: string;
  worldSetting?: string;
  coreCharacters?: string; // 对应原来的coreCharactersSilhouette
  sellingPoints?: string;
  setAsActive?: boolean;
}

// 保存故事种子
export async function saveStorySeed(args: SaveStorySeedParams) {
  // 从配置或默认获取novelId
  const novelId = args.novelId ?? 1;

  // 验证小说存在
  const novel = novelDAO.findById(novelId);
  if (!novel) {
    throw new Error(`小说 ${novelId} 不存在`);
  }

  const maxVersion = storySeedDAO.getLatestVersion(novelId);
  const newVersion = maxVersion + 1;

  const seedId = storySeedDAO.insert({
    novel_id: novelId,
    version: newVersion,
    core_idea: args.coreIdea,
    world_setting: args.worldSetting,
    core_characters_silhouette: args.coreCharacters,
    selling_points: args.sellingPoints,
    is_active: args.setAsActive ?? false,
    created_at: new Date().toISOString()
  });

  // 更新工作区的story-seed.md文件
  if (args.setAsActive) {
    // 将其他版本设为非激活
    if (maxVersion > 0) {
      storySeedDAO.updateBy(
        { novel_id: novelId, version: { $ne: newVersion } as any },
        { is_active: false }
      );
    }

    const seedPath = path.join(process.cwd(), 'story-seed.md');
    let content = `# 故事核心设定 v${newVersion}
## 核心创意
${args.coreIdea}
`;

    if (args.worldSetting) {
      content += `
## 世界观设定
${args.worldSetting}
`;
    }

    if (args.coreCharacters) {
      content += `
## 核心人物
${args.coreCharacters}
`;
    }

    if (args.sellingPoints) {
      content += `
## 核心卖点
${args.sellingPoints}
`;
    }

    fs.writeFileSync(seedPath, content);
  }

  return {
    success: true,
    data: {
      seedId: seedId,
      version: newVersion
    }
  };
}

// 获取当前激活的种子参数
interface GetActiveSeedParams {
  novelId?: number;
}

// 获取当前激活的种子
export async function getActiveSeed(args: GetActiveSeedParams = {}) {
  const novelId = args.novelId ?? 1;

  const seed = storySeedDAO.findActiveByNovelId(novelId);

  return {
    success: true,
    data: seed ? {
      id: seed.id,
      novelId: seed.novel_id,
      version: seed.version,
      coreIdea: seed.core_idea,
      worldSetting: seed.world_setting,
      coreCharacters: seed.core_characters_silhouette,
      sellingPoints: seed.selling_points,
      isActive: seed.is_active,
      createdAt: seed.created_at
    } : null
  };
}

// 获取种子版本列表参数
interface ListSeedVersionsParams {
  novelId?: number;
}

// 获取种子版本列表
export async function listSeedVersions(args: ListSeedVersionsParams = {}) {
  const novelId = args.novelId ?? 1;

  const versions = storySeedDAO.findAllByNovelId(novelId);

  return {
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
  };
}
