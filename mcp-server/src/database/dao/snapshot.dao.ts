import { getDb } from '../index';

export interface ContextSnapshot {
  id: number;
  novelId: number;
  chapterId: number;
  snapshotContent: string; // JSON格式
  snapshotVersion: number;
  createdAt: string;
}

// 创建快照
export function createSnapshot(params: Omit<ContextSnapshot, 'id' | 'createdAt'>) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO context_snapshots (novel_id, chapter_id, snapshot_content, snapshot_version)
    VALUES (@novelId, @chapterId, @snapshotContent, @snapshotVersion)
    RETURNING *
  `);

  const result = stmt.get(params) as ContextSnapshot;
  return result;
}

// 获取章节的最大快照版本号
export function getMaxSnapshotVersion(novelId: number, chapterId: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT MAX(snapshot_version) as maxVersion FROM context_snapshots WHERE novel_id = ? AND chapter_id = ?');
  const result = stmt.get(novelId, chapterId) as { maxVersion: number | null };
  return result.maxVersion || 0;
}

// 获取当前章节的最新快照
export function getCurrentSnapshot(novelId: number, chapterId: number) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM context_snapshots
    WHERE novel_id = ? AND chapter_id = ?
    ORDER BY snapshot_version DESC
    LIMIT 1
  `);
  return stmt.get(novelId, chapterId) as ContextSnapshot | undefined;
}

// 标记快照过期（当内容修改时）
export function markSnapshotsExpired(novelId: number, fromChapterId: number) {
  const db = getDb();
  // 这里可以实现更复杂的过期逻辑，暂时省略
  // 实际实现中，可以删除从fromChapterId开始的所有后续快照，强制重新生成
}
