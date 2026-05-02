import { BaseDAO } from './base.dao';

export interface Chapter {
  id: number;
  outline_node_id: number;
  version: number;
  content: string;
  word_count: number;
  summary: string;
  key_events: string; // JSON 数组
  character_appearances: string; // JSON 数组
  foreshadowing_ids?: string; // JSON 数组
  created_by?: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

class ChapterDAO extends BaseDAO<Chapter> {
  protected tableName = 'chapters';
  protected primaryKey = 'id';

  // 获取大纲节点的当前版本章节
  public findCurrentByOutlineNodeId(outlineNodeId: number): Chapter | undefined {
    return this.findOne({ outline_node_id: outlineNodeId, is_current: true });
  }

  // 获取大纲节点的所有版本章节，按版本号降序排列
  public findAllByOutlineNodeId(outlineNodeId: number): Chapter[] {
    const sql = `SELECT * FROM "${this.tableName}" WHERE outline_node_id = ? ORDER BY version DESC`;
    return this.getDb().prepare(sql).all(outlineNodeId) as Chapter[];
  }

  // 获取大纲节点的指定版本章节
  public findByVersion(outlineNodeId: number, version: number): Chapter | undefined {
    return this.findOne({ outline_node_id: outlineNodeId, version });
  }

  // 获取大纲节点的最新版本号
  public getLatestVersion(outlineNodeId: number): number {
    const sql = `SELECT MAX(version) as max_version FROM "${this.tableName}" WHERE outline_node_id = ?`;
    const result = this.getDb().prepare(sql).get(outlineNodeId) as { max_version: number | null };
    return result.max_version || 0;
  }

  // 获取大纲节点的最新版本章节
  public getLatestByOutlineNodeId(outlineNodeId: number): Chapter | null {
    const stmt = this.getDb().prepare(`
      SELECT * FROM "${this.tableName}"
      WHERE "outline_node_id" = ?
      ORDER BY "version" DESC
      LIMIT 1
    `);
    return stmt.get(outlineNodeId) as Chapter || null;
  }

  // 创建新的章节版本，并自动设为当前版本
  public createVersion(params: Omit<Chapter, 'id' | 'created_at' | 'updated_at' | 'is_current'>): Chapter {
    return this.transaction(() => {
      // 先将所有版本设置为非当前
      this.updateBy({ outline_node_id: params.outline_node_id }, { is_current: false });
      // 创建新版本并设为当前
      const now = new Date().toISOString();
      const id = this.insert({
        ...params,
        is_current: true,
        created_at: now,
        updated_at: now
      });
      // 返回创建的章节
      const chapter = this.findById(id);
      if (!chapter) {
        throw new Error('创建章节失败');
      }
      return chapter;
    });
  }

  // 将指定版本设置为当前版本，其他版本设置为非当前
  public setCurrentVersion(outlineNodeId: number, version: number): number {
    return this.transaction(() => {
      // 先将所有版本设置为非当前
      this.updateBy({ outline_node_id: outlineNodeId }, { is_current: false });
      // 再将指定版本设置为当前
      return this.updateBy({ outline_node_id: outlineNodeId, version }, { is_current: true });
    });
  }

  // 获取小说的所有已完成章节
  public findCompletedByNovelId(novelId: number): Chapter[] {
    const sql = `
      SELECT c.* FROM "${this.tableName}" c
      JOIN "outline_nodes" o ON c.outline_node_id = o.id
      WHERE o.novel_id = ? AND c.is_current = true AND o.status = 'completed'
      ORDER BY o.path
    `;
    return this.getDb().prepare(sql).all(novelId) as Chapter[];
  }

  // 获取小说的所有已完成章节ID
  public getCompletedChapterIds(novelId: number): number[] {
    const sql = `
      SELECT o.id
      FROM "outline_nodes" o
      JOIN "${this.tableName}" c ON o.id = c.outline_node_id
      WHERE o.novel_id = ? AND o.status = 'completed' AND c.is_current = 1
      ORDER BY o.path
    `;
    const result = this.getDb().prepare(sql).all(novelId) as { id: number }[];
    return result.map(item => item.id);
  }
}

export const chapterDAO = new ChapterDAO();

