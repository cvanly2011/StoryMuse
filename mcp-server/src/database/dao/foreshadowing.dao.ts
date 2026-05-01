import { getDb } from '../index';

export interface Foreshadowing {
  id: number;
  novelId: number;
  setupChapterId: number;
  payoffChapterId?: number;
  description: string;
  hintLevel: number;
  importance: number;
  status: 'setup' | 'paid_off' | 'abandoned';
  payoffDescription?: string;
  createdAt: string;
  updatedAt: string;
}

// 创建伏笔
export function createForeshadowing(params: Omit<Foreshadowing, 'id' | 'createdAt' | 'updatedAt' | 'status'>) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO foreshadowings (novel_id, setup_chapter_id, payoff_chapter_id, description, hint_level, importance)
    VALUES (@novelId, @setupChapterId, @payoffChapterId, @description, @hintLevel, @importance)
    RETURNING *
  `);

  const result = stmt.get({ ...params, status: 'setup' }) as Foreshadowing;
  return result;
}

// 更新伏笔
export function updateForeshadowing(id: number, updates: Partial<Foreshadowing>) {
  const db = getDb();
  const fields = Object.keys(updates)
    .map(key => {
      const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      return `${dbKey} = @${key}`;
    })
    .join(', ');

  const stmt = db.prepare(`
    UPDATE foreshadowings
    SET ${fields}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
    RETURNING *
  `);

  return stmt.get({ ...updates, id }) as Foreshadowing;
}

// 标记伏笔已回收
export function markForeshadowingPaidOff(id: number, payoffChapterId: number, payoffDescription: string) {
  return updateForeshadowing(id, {
    status: 'paid_off',
    payoffChapterId,
    payoffDescription
  });
}

// 获取未回收的伏笔
export function listUnpaidForeshadowings(novelId: number, upToChapterId?: number) {
  const db = getDb();
  let sql = 'SELECT * FROM foreshadowings WHERE novel_id = ? AND status = "setup" AND importance >= 5';
  const params: any[] = [novelId];

  if (upToChapterId !== undefined) {
    sql += ' AND setup_chapter_id <= ?';
    params.push(upToChapterId);
  }

  sql += ' ORDER BY importance DESC, setup_chapter_id ASC';

  const stmt = db.prepare(sql);
  return stmt.all(...params) as Foreshadowing[];
}

// 获取所有伏笔
export function listAllForeshadowings(novelId: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM foreshadowings WHERE novel_id = ? ORDER BY setup_chapter_id, importance DESC');
  return stmt.all(novelId) as Foreshadowing[];
}

// 获取逾期未回收的伏笔（超过计划回收章节）
export function listOverdueForeshadowings(novelId: number, currentChapterId: number) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM foreshadowings
    WHERE novel_id = ? AND status = "setup" AND payoff_chapter_id IS NOT NULL AND payoff_chapter_id < ?
    ORDER BY importance DESC
  `);
  return stmt.all(novelId, currentChapterId) as Foreshadowing[];
}
