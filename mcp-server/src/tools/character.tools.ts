import { FastifyRequest, FastifyReply } from 'fastify';
import { createCharacter, updateCharacter, listCharacters, getCharacterById, getCharacterAppearanceChapterIds } from '../database/dao/character.dao';
import { createRelation, addRelationEvolution, listRelations, getRelationStateUpToChapter } from '../database/dao/relation.dao';
import { markSnapshotsExpired } from '../database/dao/snapshot.dao';

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
    const character = await createCharacter(params);

    return reply.send({
      success: true,
      data: {
        characterId: character.id
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
    const character = await updateCharacter(characterId, updates);

    // 标记该人物出场的所有章节的快照过期
    const impactedChapterIds = await getCharacterAppearanceChapterIds(characterId);
    if (impactedChapterIds.length > 0) {
      await markSnapshotsExpired(character.novelId, Math.min(...impactedChapterIds));
    }

    return reply.send({
      success: true,
      data: {
        impactedChapterIds
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
    const characters = await listCharacters(novelId, role);

    return reply.send({
      success: true,
      data: {
        characters
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取人物列表失败: ${error.message}`
    });
  }
}

// 添加人物关系
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
  try {
    const params = request.body;
    const relation = await createRelation({
      ...params,
      characterIds: JSON.stringify(params.characterIds),
      closeness: params.closeness ?? 5,
      secrecyLevel: params.secrecyLevel ?? 1,
      conflictLevel: params.conflictLevel ?? 1,
      plotImportance: params.plotImportance ?? 5
    });

    return reply.send({
      success: true,
      data: {
        relationId: relation.id
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `添加人物关系失败: ${error.message}`
    });
  }
}

// 添加关系演变记录
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
  try {
    const params = request.body;
    const evolution = await addRelationEvolution(params);

    return reply.send({
      success: true,
      data: {
        evolutionId: evolution.id
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `添加关系演变记录失败: ${error.message}`
    });
  }
}

// 获取人物关系图谱
export async function getCharacterRelationGraph(request: FastifyRequest<{
  Body: {
    novelId: number;
    upToChapterId?: number;
  }
}>, reply: FastifyReply) {
  try {
    const { novelId, upToChapterId } = request.body;
    const relations = await listRelations(novelId);
    const characters = await listCharacters(novelId);

    // 填充当前关系状态
    const relationsWithState = await Promise.all(relations.map(async relation => {
      const currentState = upToChapterId
        ? await getRelationStateUpToChapter(relation.id, upToChapterId)
        : undefined;

      return {
        ...relation,
        currentState,
        characterIds: JSON.parse(relation.characterIds)
      };
    }));

    return reply.send({
      success: true,
      data: {
        characters: characters.map(c => ({
          id: c.id,
          name: c.name,
          role: c.role
        })),
        relations: relationsWithState
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取关系图谱失败: ${error.message}`
    });
  }
}
