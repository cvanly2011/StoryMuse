import { BaseDAO } from './base.dao';

export interface Character {
  id: number;
  novel_id: number;
  name: string;
  alias?: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'guest' | 'npc';
  appearance?: string;
  personality?: string;
  inner_conflict?: string;
  core_desire?: string;
  core_fear?: string;
  character_arc?: string;
  signature_lines?: string;
  backstory?: string;
  first_appearance_chapter_id?: number;
  final_outcome?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

class CharacterDAO extends BaseDAO<Character> {
  protected tableName = 'characters';
  protected primaryKey = 'id';

  // 获取小说的所有人物
  public findAllByNovelId(novelId: number, includeArchived: boolean = false): Character[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE novel_id = ?`;
    const params: any[] = [novelId];

    if (!includeArchived) {
      sql += ` AND is_archived = false`;
    }

    sql += ` ORDER BY CASE role WHEN 'protagonist' THEN 1 WHEN 'antagonist' THEN 2 WHEN 'supporting' THEN 3 ELSE 4 END, name`;
    return this.getDb().prepare(sql).all(...params) as Character[];
  }

  // 按角色类型筛选人物
  public findByRole(novelId: number, role: string): Character[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE novel_id = ? AND role = ? AND is_archived = false ORDER BY name`;
    return this.getDb().prepare(sql).all(novelId, role) as Character[];
  }

  // 根据姓名查找人物
  public findByName(novelId: number, name: string): Character | undefined {
    const sql = `SELECT * FROM ${this.tableName} WHERE novel_id = ? AND (name = ? OR alias = ?) AND is_archived = false LIMIT 1`;
    return this.getDb().prepare(sql).get(novelId, name, name) as Character | undefined;
  }

  // 获取某个人物出场的所有章节ID
  public getAppearanceChapterIds(characterId: number): number[] {
    const sql = `
      SELECT DISTINCT c.outline_node_id
      FROM chapters c, json_each(c.character_appearances) as ca
      WHERE json_extract(ca.value, '$.characterId') = ? AND c.is_current = 1
    `;
    const result = this.getDb().prepare(sql).all(characterId) as { outline_node_id: number }[];
    return result.map(item => item.outline_node_id);
  }

  // 更新人物的更新时间
  public updateUpdatedAt(id: number): number {
    return this.update(id, { updated_at: new Date().toISOString() } as Partial<Character>);
  }
}

export const characterDAO = new CharacterDAO();

