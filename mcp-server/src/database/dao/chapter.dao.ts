import { getDb } from '../index';

export interface Chapter {
  id: number;
  outlineNodeId: number;
  version: number;
  content: string;
  wordCount: number;
  summary: string;
  keyEvents: string; // JSON数组
  characterAppearances: string; // JSON数组
  foreshadowingIds?: string; // JSON数组
  createdBy?: string;
  isCurrent: boolean;
  createdAt: string;
}

// 创建章节版本
export function createChapterVersion(params: Omit<Chapter, 'id' | 'createdAt' | 'isCurrent'>) {
  const db = getDb();

  // 先把之前的当前版本设为非当前
  const deactivateStmt = db.prepare('UPDATE chapters SET is_current = 0 WHERE outline_node_id = ?');
  deactivateStmt.run(params.outlineNodeId);

  const stmt = db.prepare(`
    INSERT INTO chapters (outline_node_id, version, content, word_count, summary, key_events, character_appearances, foreshadowing_ids, created_by, is_current)
    VALUES (@outlineNodeId, @version, @content, @wordCount, @summary, @keyEvents, @characterAppearances, @foreshadowingIds, @createdBy, 1)
    RETURNING *
  `);

  const result = stmt.get(params) as Chapter;
  return result;
}

// 获取章节的最大版本号
export function getMaxChapterVersion(outlineNodeId: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT MAX(version) as maxVersion FROM chapters WHERE outline_node_id = ?');
  const result = stmt.get(outlineNodeId) as { maxVersion: number | null };
  return result.maxVersion || 0;
}

// 获取章节版本列表
export function listChapterVersions(outlineNodeId: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT id, version, word_count, created_by, created_at FROM chapters WHERE outline_node_id = ? ORDER BY version DESC');
  return stmt.all(outlineNodeId) as Omit<Chapter, 'content' | 'summary' | 'keyEvents' | 'characterAppearances' | 'foreshadowingIds' | 'isCurrent'>[];
}

// 获取章节内容
export function getChapterContent(outlineNodeId: number, version?: number) {
  const db = getDb();
  let sql = 'SELECT * FROM chapters WHERE outline_node_id = ?';
  const params: any[] = [outlineNodeId];

  if (version !== undefined) {
    sql += ' AND version = ?';
    params.push(version);
  } else {
    sql += ' AND is_current = 1';
  }

  const stmt = db.prepare(sql);
  return stmt.get(...params) as Chapter | undefined;
}

// 回滚到指定版本
export function rollbackChapter(outlineNodeId: number, targetVersion: number) {
  const db = getDb();

  // 把目标版本设为当前版本
  const deactivateStmt = db.prepare('UPDATE chapters SET is_current = 0 WHERE outline_node_id = ?');
  deactivateStmt.run(outlineNodeId);

  const activateStmt = db.prepare('UPDATE chapters SET is_current = 1 WHERE outline_node_id = ? AND version = ?');
  activateStmt.run(outlineNodeId, targetVersion);

  return getChapterContent(outlineNodeId, targetVersion);
}

// 获取所有已完成的章节ID
export function getCompletedChapterIds(novelId: number) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT o.id
    FROM outline_nodes o
    JOIN chapters c ON o.id = c.outline_node_id
    WHERE o.novel_id = ? AND o.status = 'completed' AND c.is_current = 1
    ORDER BY o.path
  `);
  const result = stmt.all(novelId) as { id: number }[];
  return result.map(item => item.id);
}
