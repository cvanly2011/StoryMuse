import { getDb } from '../index';

export interface Character {
  id: number;
  novelId: number;
  name: string;
  alias?: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'guest' | 'npc';
  appearance?: string;
  personality?: string;
  innerConflict?: string;
  coreDesire?: string;
  coreFear?: string;
  characterArc?: string;
  signatureLines?: string;
  backstory?: string;
  firstAppearanceChapterId?: number;
  finalOutcome?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// 创建人物
export function createCharacter(params: Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO characters (novel_id, name, alias, role, appearance, personality, inner_conflict, core_desire, core_fear, character_arc, signature_lines, backstory, first_appearance_chapter_id, final_outcome)
    VALUES (@novelId, @name, @alias, @role, @appearance, @personality, @innerConflict, @coreDesire, @coreFear, @characterArc, @signatureLines, @backstory, @firstAppearanceChapterId, @finalOutcome)
    RETURNING *
  `);

  const result = stmt.get({ ...params, isArchived: false }) as Character;
  return result;
}

// 更新人物
export function updateCharacter(id: number, updates: Partial<Character>) {
  const db = getDb();
  const fields = Object.keys(updates)
    .map(key => {
      const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      return `${dbKey} = @${key}`;
    })
    .join(', ');

  const stmt = db.prepare(`
    UPDATE characters
    SET ${fields}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
    RETURNING *
  `);

  return stmt.get({ ...updates, id }) as Character;
}

// 获取人物列表
export function listCharacters(novelId: number, role?: string) {
  const db = getDb();
  let sql = 'SELECT * FROM characters WHERE novel_id = ? AND is_archived = 0';
  const params: any[] = [novelId];

  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }

  sql += ' ORDER BY CASE role WHEN "protagonist" THEN 1 WHEN "antagonist" THEN 2 WHEN "supporting" THEN 3 ELSE 4 END, name';

  const stmt = db.prepare(sql);
  return stmt.all(...params) as Character[];
}

// 根据ID获取人物
export function getCharacterById(id: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM characters WHERE id = ?');
  return stmt.get(id) as Character | undefined;
}

// 获取某个人物出场的所有章节ID
export function getCharacterAppearanceChapterIds(characterId: number) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT DISTINCT c.outline_node_id
    FROM chapters c, json_each(c.character_appearances) as ca
    WHERE json_extract(ca.value, '$.characterId') = ? AND c.is_current = 1
  `);
  const result = stmt.all(characterId) as { outline_node_id: number }[];
  return result.map(item => item.outline_node_id);
}
