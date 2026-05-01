import { FastifyRequest, FastifyReply } from 'fastify';
import { characterDAO, Character } from '../database/dao/character.dao';
// 关系相关功能暂时注释，后续实现
// import { createRelation, addRelationEvolution, listRelations, getRelationStateUpToChapter } from '../database/dao/relation.dao';
// import { markSnapshotsExpired } from '../database/dao/snapshot.dao';

// 创建人物
export async function createCharacter(request: FastifyRequest<{
  Body: {
    novelId: number;
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'guest' | 'npc';
    alias?: string;
    appearance?: string;
    personality?: string;
    innerConflict?: string;
    coreDesire?: string;
    coreFear?: string;
    characterArc?: string;
    backstory?: string;
  }
}>, reply: FastifyReply) {
  try {
    const params = request.body;
    const characterId = characterDAO.insert({
      novel_id: params.novelId,
      name: params.name,
      role: params.role,
      alias: params.alias,
      appearance: params.appearance,
      personality: params.personality,
      inner_conflict: params.innerConflict,
      core_desire: params.coreDesire,
      core_fear: params.coreFear,
      character_arc: params.characterArc,
      backstory: params.backstory,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return reply.send({
      success: true,
      data: {
        characterId
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `创建人物失败: ${error.message}`
    });
  }
}

// 更新人物
export async function updateCharacter(request: FastifyRequest<{
  Body: {
    characterId: number;
    updates: any;
  }
}>, reply: FastifyReply) {
  try {
    const { characterId, updates } = request.body;

    // 转换字段名
    const dbUpdates: Partial<Character> = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.alias) dbUpdates.alias = updates.alias;
    if (updates.role) dbUpdates.role = updates.role;
    if (updates.appearance) dbUpdates.appearance = updates.appearance;
    if (updates.personality) dbUpdates.personality = updates.personality;
    if (updates.innerConflict) dbUpdates.inner_conflict = updates.innerConflict;
    if (updates.coreDesire) dbUpdates.core_desire = updates.coreDesire;
    if (updates.coreFear) dbUpdates.core_fear = updates.coreFear;
    if (updates.characterArc) dbUpdates.character_arc = updates.characterArc;
    if (updates.backstory) dbUpdates.backstory = updates.backstory;
    dbUpdates.updated_at = new Date().toISOString();

    const changes = characterDAO.update(characterId, dbUpdates);

    // 标记该人物出场的所有章节的快照过期（暂时注释）
    const impactedChapterIds = characterDAO.getAppearanceChapterIds(characterId);
    // if (impactedChapterIds.length > 0) {
    //   await markSnapshotsExpired(character.novelId, Math.min(...impactedChapterIds));
    // }

    return reply.send({
      success: true,
      data: {
        impactedChapterIds,
        changes
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `更新人物失败: ${error.message}`
    });
  }
}

// 获取人物列表
export async function listCharacters(request: FastifyRequest<{
  Body: {
    novelId: number;
    role?: string;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId, role } = request.body;
    let characters: Character[];
    if (role) {
      characters = characterDAO.findByRole(novelId, role);
    } else {
      characters = characterDAO.findAllByNovelId(novelId);
    }

    return reply.send({
      success: true,
      data: {
        characters: characters.map(c => ({
          id: c.id,
          novelId: c.novel_id,
          name: c.name,
          alias: c.alias,
          role: c.role,
          appearance: c.appearance,
          personality: c.personality,
          innerConflict: c.inner_conflict,
          coreDesire: c.core_desire,
          coreFear: c.core_fear,
          characterArc: c.character_arc,
          backstory: c.backstory,
          isArchived: c.is_archived,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        }))
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取人物列表失败: ${error.message}`
    });
  }
}

// 添加人物关系（暂未实现）
export async function addCharacterRelation(request: FastifyRequest<{
  Body: {
    novelId: number;
    relationType: 'binary' | 'multiple';
    characterIds: number[];
    relationName: string;
    description?: string;
    closeness?: number;
    secrecyLevel?: number;
    conflictLevel?: number;
    plotImportance?: number;
  }
}>, reply: FastifyReply) {
  return reply.status(501).send({
    success: false,
    message: '人物关系功能暂未实现'
  });
}

// 添加关系演变记录（暂未实现）
export async function addRelationEvolution(request: FastifyRequest<{
  Body: {
    relationId: number;
    chapterId: number;
    newRelationState: string;
    triggerEvent: string;
    oldRelationState?: string;
    impactDescription?: string;
  }
}>, reply: FastifyReply) {
  return reply.status(501).send({
    success: false,
    message: '关系演变功能暂未实现'
  });
}

// 获取人物关系图谱（暂未实现）
export async function getCharacterRelationGraph(request: FastifyRequest<{
  Body: {
    novelId: number;
    upToChapterId?: number;
  }
}>, reply: FastifyReply) {
  // 暂时只返回人物列表
  const characters = characterDAO.findAllByNovelId(request.body.novelId);
  return reply.send({
    success: true,
    data: {
      characters: characters.map(c => ({
        id: c.id,
        name: c.name,
        role: c.role
      })),
      relations: []
    }
  });
}
