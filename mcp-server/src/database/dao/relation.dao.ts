import { getDb } from '../index';

export interface CharacterRelation {
  id: number;
  novelId: number;
  relationType: 'binary' | 'multiple';
  characterIds: string; // JSON数组
  relationName: string;
  description?: string;
  closeness: number;
  secrecyLevel: number;
  conflictLevel: number;
  plotImportance: number;
  createdAt: string;
}

export interface RelationEvolution {
  id: number;
  relationId: number;
  chapterId: number;
  oldRelationState?: string;
  newRelationState: string;
  triggerEvent: string;
  impactDescription?: string;
  createdAt: string;
}

// 创建人物关系
export function createRelation(params: Omit<CharacterRelation, 'id' | 'createdAt'>) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO character_relations (novel_id, relation_type, character_ids, relation_name, description, closeness, secrecy_level, conflict_level, plot_importance)
    VALUES (@novelId, @relationType, @characterIds, @relationName, @description, @closeness, @secrecyLevel, @conflictLevel, @plotImportance)
    RETURNING *
  `);

  const result = stmt.get(params) as CharacterRelation;
  return result;
}

// 获取小说的所有关系
export function listRelations(novelId: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM character_relations WHERE novel_id = ? ORDER BY plot_importance DESC, closeness DESC');
  return stmt.all(novelId) as CharacterRelation[];
}

// 添加关系演变记录
export function addRelationEvolution(params: Omit<RelationEvolution, 'id' | 'createdAt'>) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO relation_evolutions (relation_id, chapter_id, old_relation_state, new_relation_state, trigger_event, impact_description)
    VALUES (@relationId, @chapterId, @oldRelationState, @newRelationState, @triggerEvent, @impactDescription)
    RETURNING *
  `);

  const result = stmt.get(params) as RelationEvolution;
  return result;
}

// 获取关系的演变历史
export function getRelationEvolutions(relationId: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM relation_evolutions WHERE relation_id = ? ORDER BY created_at ASC');
  return stmt.all(relationId) as RelationEvolution[];
}

// 获取截至到某章节的关系状态
export function getRelationStateUpToChapter(relationId: number, chapterId: number) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT new_relation_state
    FROM relation_evolutions
    WHERE relation_id = ? AND chapter_id <= ?
    ORDER BY chapter_id DESC
    LIMIT 1
  `);
  const result = stmt.get(relationId, chapterId) as { new_relation_state: string } | undefined;
  return result?.new_relation_state;
}
