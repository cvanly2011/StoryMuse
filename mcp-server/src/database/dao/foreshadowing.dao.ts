import { BaseDAO } from './base.dao';

export interface Foreshadowing {
  id: number;
  novel_id: number;
  setup_chapter_id: number;
  payoff_chapter_id?: number;
  description: string;
  hint_level: number; // 1-5
  importance: number; // 1-10
  status: 'setup' | 'paid_off' | 'abandoned';
  payoff_description?: string;
  created_at: string;
  updated_at: string;
}

class ForeshadowingDAO extends BaseDAO<Foreshadowing> {
  protected tableName = 'foreshadowings';
  protected primaryKey = 'id';

  // 创建伏笔
  public insert(params: Omit<Foreshadowing, 'id' | 'created_at' | 'updated_at' | 'status'>): number {
    return super.insert({
      ...params,
      status: 'setup',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as Partial<Foreshadowing>);
  }

  // 获取小说的所有伏笔
  public findAllByNovelId(novelId: number, status?: string): Foreshadowing[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE novel_id = ?`;
    const params: any[] = [novelId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY importance DESC, setup_chapter_id ASC`;
    return this.getDb().prepare(sql).all(...params) as Foreshadowing[];
  }

  // 获取指定章节埋设的伏笔
  public findBySetupChapterId(chapterId: number): Foreshadowing[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE setup_chapter_id = ? ORDER BY importance DESC`;
    return this.getDb().prepare(sql).all(chapterId) as Foreshadowing[];
  }

  // 获取指定章节回收的伏笔
  public findByPayoffChapterId(chapterId: number): Foreshadowing[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE payoff_chapter_id = ? ORDER BY importance DESC`;
    return this.getDb().prepare(sql).all(chapterId) as Foreshadowing[];
  }

  // 获取所有未回收的伏笔
  public findUnpaidByNovelId(novelId: number, upToChapterId?: number, minImportance: number = 5): Foreshadowing[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE novel_id = ? AND status = 'setup' AND importance >= ?`;
    const params: any[] = [novelId, minImportance];

    if (upToChapterId !== undefined) {
      sql += ` AND setup_chapter_id <= ?`;
      params.push(upToChapterId);
    }

    sql += ` ORDER BY importance DESC, setup_chapter_id ASC`;
    return this.getDb().prepare(sql).all(...params) as Foreshadowing[];
  }

  // 获取逾期未回收的伏笔（超过计划回收章节）
  public findOverdueByNovelId(novelId: number, currentChapterId: number): Foreshadowing[] {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE novel_id = ? AND status = 'setup' AND payoff_chapter_id IS NOT NULL AND payoff_chapter_id < ?
      ORDER BY importance DESC
    `;
    return this.getDb().prepare(sql).all(novelId, currentChapterId) as Foreshadowing[];
  }

  // 标记伏笔已回收
  public markAsPaid(id: number, payoffChapterId: number, payoffDescription?: string): number {
    return this.update(id, {
      status: 'paid_off',
      payoff_chapter_id: payoffChapterId,
      payoff_description: payoffDescription,
      updated_at: new Date().toISOString()
    } as Partial<Foreshadowing>);
  }

  // 标记伏笔已废弃
  public markAsAbandoned(id: number): number {
    return this.update(id, {
      status: 'abandoned',
      updated_at: new Date().toISOString()
    } as Partial<Foreshadowing>);
  }

  // 更新伏笔的更新时间
  public updateUpdatedAt(id: number): number {
    return this.update(id, { updated_at: new Date().toISOString() } as Partial<Foreshadowing>);
  }
}

export const foreshadowingDAO = new ForeshadowingDAO();

