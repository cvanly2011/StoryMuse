import { BaseDAO } from './base.dao';

export interface ContextSnapshot {
  id: number;
  novel_id: number;
  chapter_id: number;
  snapshot_content: string; // JSON 格式，严格控制token≤2000
  snapshot_version: number;
  created_at: string;
}

class ContextSnapshotDAO extends BaseDAO<ContextSnapshot> {
  protected tableName = 'context_snapshots';
  protected primaryKey = 'id';

  // 获取章节的最新版本上下文快照
  public findLatestByChapterId(chapterId: number): ContextSnapshot | undefined {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE chapter_id = ?
      ORDER BY snapshot_version DESC
      LIMIT 1
    `;
    return this.getDb().prepare(sql).get(chapterId) as ContextSnapshot | undefined;
  }

  // 获取章节的所有版本上下文快照，按版本号降序排列
  public findAllByChapterId(chapterId: number): ContextSnapshot[] {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE chapter_id = ?
      ORDER BY snapshot_version DESC
    `;
    return this.getDb().prepare(sql).all(chapterId) as ContextSnapshot[];
  }

  // 获取章节的指定版本上下文快照
  public findByVersion(chapterId: number, version: number): ContextSnapshot | undefined {
    return this.findOne({ chapter_id: chapterId, snapshot_version: version });
  }

  // 获取章节的最新版本号
  public getLatestVersion(chapterId: number): number {
    const sql = `
      SELECT MAX(snapshot_version) as max_version
      FROM ${this.tableName}
      WHERE chapter_id = ?
    `;
    const result = this.getDb().prepare(sql).get(chapterId) as { max_version: number | null };
    return result.max_version || 0;
  }

  // 创建新的上下文快照版本
  public createVersion(params: Omit<ContextSnapshot, 'id' | 'created_at'>): ContextSnapshot {
    const id = this.insert({
      ...params,
      created_at: new Date().toISOString()
    } as Partial<ContextSnapshot>);
    const snapshot = this.findById(id);
    if (!snapshot) {
      throw new Error('创建快照失败');
    }
    return snapshot;
  }

  // 清理章节的旧版本快照，只保留最近的N个版本
  public cleanupOldVersions(chapterId: number, keepCount: number = 5): number {
    return this.transaction(() => {
      // 获取需要保留的最新版本号
      const sql = `
        SELECT snapshot_version
        FROM ${this.tableName}
        WHERE chapter_id = ?
        ORDER BY snapshot_version DESC
        LIMIT -1 OFFSET ?
      `;
      const oldVersions = this.getDb().prepare(sql).all(chapterId, keepCount) as { snapshot_version: number }[];

      if (oldVersions.length === 0) return 0;

      // 删除旧版本
      const placeholders = oldVersions.map(() => '?').join(', ');
      const deleteSql = `
        DELETE FROM ${this.tableName}
        WHERE chapter_id = ? AND snapshot_version IN (${placeholders})
      `;
      const params = [chapterId, ...oldVersions.map(v => v.snapshot_version)];

      const result = this.getDb().prepare(deleteSql).run(...params);
      return result.changes;
    });
  }
}

export const contextSnapshotDAO = new ContextSnapshotDAO();
