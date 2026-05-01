import { getDb } from '../index';

export interface Novel {
  id: number;
  name: string;
  slug: string;
  description?: string;
  genre?: string;
  theme?: string;
  tone?: string;
  targetPlatform?: string;
  targetAudience?: string;
  coreConflict?: string;
  wordCountTarget?: number;
  createdAt: string;
  updatedAt: string;
  settings?: string;
}

// 创建小说
export function createNovel(params: Omit<Novel, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO novels (name, slug, description, genre, theme, tone, target_platform, target_audience, core_conflict, word_count_target, settings)
    VALUES (@name, @slug, @description, @genre, @theme, @tone, @targetPlatform, @targetAudience, @coreConflict, @wordCountTarget, @settings)
    RETURNING *
  `);

  // 生成slug
  const slug = params.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const result = stmt.get({ ...params, slug }) as Novel;
  return result;
}

// 获取所有小说
export function listNovels() {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM novels ORDER BY updated_at DESC');
  return stmt.all() as Novel[];
}

// 根据ID获取小说
export function getNovelById(id: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM novels WHERE id = ?');
  return stmt.get(id) as Novel | undefined;
}

// 更新小说
export function updateNovel(id: number, updates: Partial<Novel>) {
  const db = getDb();
  const fields = Object.keys(updates)
    .map(key => {
      const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      return `${dbKey} = @${key}`;
    })
    .join(', ');

  const stmt = db.prepare(`
    UPDATE novels
    SET ${fields}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
    RETURNING *
  `);

  return stmt.get({ ...updates, id }) as Novel;
}

// 删除小说
export function deleteNovel(id: number) {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM novels WHERE id = ? RETURNING *');
  return stmt.get(id) as Novel;
}

// 获取小说总字数
export function getNovelTotalWordCount(novelId: number) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT SUM(c.word_count) as total
    FROM chapters c
    JOIN outline_nodes o ON c.outline_node_id = o.id
    WHERE o.novel_id = ? AND c.is_current = 1
  `);
  const result = stmt.get(novelId) as { total: number | null };
  return result.total || 0;
}

// 获取小说完成进度
export function getNovelProgress(novelId: number) {
  const db = getDb();
  const totalStmt = db.prepare('SELECT COUNT(*) as total FROM outline_nodes WHERE novel_id = ? AND level = 3');
  const completedStmt = db.prepare('SELECT COUNT(*) as completed FROM outline_nodes WHERE novel_id = ? AND level = 3 AND status = "completed"');

  const total = (totalStmt.get(novelId) as { total: number }).total;
  const completed = (completedStmt.get(novelId) as { completed: number }).completed;

  return total > 0 ? Math.round((completed / total) * 100) : 0;
}
