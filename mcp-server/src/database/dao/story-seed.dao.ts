import { BaseDAO } from './base.dao';

export interface StorySeed {
  id: number;
  novel_id: number;
  version: number;
  core_idea: string;
  world_setting?: string;
  core_characters_silhouette?: string;
  selling_points?: string;
  is_active: boolean;
  created_at: string;
}

class StorySeedDAO extends BaseDAO<StorySeed> {
  protected tableName = 'story_seeds';
  protected primaryKey = 'id';

  // 获取小说的激活版本故事种子
  public findActiveByNovelId(novelId: number): StorySeed | undefined {
    return this.findOne({ novel_id: novelId, is_active: true });
  }

  // 获取小说的所有版本故事种子，按版本号降序排列
  public findAllByNovelId(novelId: number): StorySeed[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE novel_id = ? ORDER BY version DESC`;
    return this.getDb().prepare(sql).all(novelId) as StorySeed[];
  }

  // 获取小说的最新版本号
  public getLatestVersion(novelId: number): number {
    const sql = `SELECT MAX(version) as max_version FROM ${this.tableName} WHERE novel_id = ?`;
    const result = this.getDb().prepare(sql).get(novelId) as { max_version: number | null };
    return result.max_version || 0;
  }

  // 将指定版本设置为激活版本，其他版本设置为非激活
  public setActiveVersion(novelId: number, version: number): number {
    return this.transaction(() => {
      // 先将所有版本设置为非激活
      this.updateBy({ novel_id: novelId }, { is_active: false });
      // 再将指定版本设置为激活
      return this.updateBy({ novel_id: novelId, version }, { is_active: true });
    });
  }
}

export const storySeedDAO = new StorySeedDAO();
