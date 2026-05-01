import { getDb } from '../index';

export interface StorySeed {
  id: number;
  novelId: number;
  version: number;
  coreIdea: string;
  worldSetting?: string;
  coreCharactersSilhouette?: string;
  sellingPoints?: string;
  isActive: boolean;
  createdAt: string;
}

// 创建种子版本
export function createSeed(params: Omit<StorySeed, 'id' | 'createdAt'>) {
  const db = getDb();

  // 如果要设为激活版本，先把其他版本设为非激活
  if (params.isActive) {
    const deactivateStmt = db.prepare('UPDATE story_seeds SET is_active = 0 WHERE novel_id = ?');
    deactivateStmt.run(params.novelId);
  }

  const stmt = db.prepare(`
    INSERT INTO story_seeds (novel_id, version, core_idea, world_setting, core_characters_silhouette, selling_points, is_active)
    VALUES (@novelId, @version, @coreIdea, @worldSetting, @coreCharactersSilhouette, @sellingPoints, @isActive)
    RETURNING *
  `);

  const result = stmt.get(params) as StorySeed;
  return result;
}

// 获取小说的最大版本号
export function getMaxVersion(novelId: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT MAX(version) as maxVersion FROM story_seeds WHERE novel_id = ?');
  const result = stmt.get(novelId) as { maxVersion: number | null };
  return result.maxVersion || 0;
}

// 获取所有种子版本
export function listSeedVersions(novelId: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM story_seeds WHERE novel_id = ? ORDER BY version DESC');
  return stmt.all(novelId) as StorySeed[];
}

// 获取当前激活的种子
export function getActiveSeed(novelId: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM story_seeds WHERE novel_id = ? AND is_active = 1');
  return stmt.get(novelId) as StorySeed | undefined;
}

// 设置激活版本
export function setActiveSeed(novelId: number, seedId: number) {
  const db = getDb();
  const deactivateStmt = db.prepare('UPDATE story_seeds SET is_active = 0 WHERE novel_id = ?');
  deactivateStmt.run(novelId);

  const activateStmt = db.prepare('UPDATE story_seeds SET is_active = 1 WHERE id = ? AND novel_id = ?');
  activateStmt.run(seedId, novelId);
}
