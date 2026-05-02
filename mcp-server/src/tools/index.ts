import { FastifyRequest, FastifyReply } from 'fastify';
import * as novelTools from './novel.tools';
import * as seedTools from './seed.tools';
import * as outlineTools from './outline.tools';
import * as characterTools from './character.tools';
import * as chapterTools from './chapter.tools';
import * as foreshadowingTools from './foreshadowing.tools';
import * as snapshotTools from './snapshot.tools';
import * as checkTools from './check.tools';
import * as loadTools from './load.tools';
import * as gitTools from './git.tools';

// 工具名称类型
export type ToolName =
  | 'createNovel'
  | 'getNovelInfo'
  | 'listNovels'
  | 'saveStorySeed'
  | 'getActiveSeed'
  | 'listSeedVersions'
  | 'getOutlineTree'
  | 'createOutlineNode'
  | 'updateOutlineNode'
  | 'deleteOutlineNode'
  | 'updateNodeStatus'
  | 'rebuildOutlineFromFile'
  | 'getNodesByLevel'
  | 'createCharacter'
  | 'updateCharacter'
  | 'listCharacters'
  | 'addCharacterRelation'
  | 'addRelationEvolution'
  | 'getCharacterRelationGraph'
  | 'saveChapterVersion'
  | 'listChapterVersions'
  | 'getChapterContent'
  | 'rollbackChapter'
  | 'getForeshadowings'
  | 'createForeshadowing'
  | 'markForeshadowingAsPaid'
  | 'markForeshadowingAsAbandoned'
  | 'deleteForeshadowing'
  | 'getOverdueForeshadowings'
  | 'generateContextSnapshot'
  | 'getCurrentContextSnapshot'
  | 'getAllSnapshotVersions'
  | 'runQualityChecks'
  | 'checkCharacterConsistency'
  | 'checkForeshadowingRecovery'
  | 'checkPlotLogic'
  | 'checkPlatformCompliance'
  | 'loadFileContent'
  | 'detectModifiedFiles'
  | 'rebuildDatabase'
  | 'initGit'
  | 'listBranches'
  | 'createBranch'
  | 'switchBranch'
  | 'deleteBranch'
  | 'mergeBranch'
  | 'getGitStatus'
  | 'commitChanges'
  | 'getGitInfo'
  | 'getNovelOverview'
  | 'getStoryTimeline';

// 工具处理函数类型
type ToolHandler<T = any, R = any> = (args: T) => Promise<R>;

/**
 * 将Fastify处理函数转换为ToolHandler
 * @param handler Fastify处理函数
 * @returns ToolHandler函数
 */
function adaptFastifyHandler<T = any, R = any>(
  handler: (request: FastifyRequest<{ Body: T }>, reply: FastifyReply) => Promise<R>
): ToolHandler<T, R> {
  return async (args: T) => {
    // 模拟Fastify request对象
    const request = {
      body: args,
      query: {},
      params: {},
      headers: {},
    } as FastifyRequest<{ Body: T }>;

    // 模拟Fastify reply对象
    let response: any;
    let statusCode = 200;

    const reply = {
      send: (data: any) => {
        response = data;
        return Promise.resolve();
      },
      status: (code: number) => {
        statusCode = code;
        return reply;
      },
    } as unknown as FastifyReply;

    // 调用原始处理函数
    const result = await handler(request, reply);

    // 如果处理函数直接返回了结果，使用它
    if (result !== undefined) {
      return result;
    }

    // 否则使用reply.send设置的response
    if (statusCode >= 400) {
      throw new Error(response?.message || `请求失败，状态码 ${statusCode}`);
    }

    return response;
  };
}

// 工具处理函数映射
export const toolHandlers: Record<ToolName, ToolHandler> = {
  // 小说相关工具
  createNovel: adaptFastifyHandler(novelTools.createNovel),
  getNovelInfo: adaptFastifyHandler(novelTools.getNovelInfo),
  listNovels: adaptFastifyHandler(novelTools.listNovels),
  getNovelOverview: adaptFastifyHandler(novelTools.getNovelOverview),
  getStoryTimeline: adaptFastifyHandler(novelTools.getStoryTimeline),

  // 故事种子相关工具 - 已经重构为纯函数，不需要适配
  saveStorySeed: seedTools.saveStorySeed,
  getActiveSeed: seedTools.getActiveSeed,
  listSeedVersions: seedTools.listSeedVersions,

  // 大纲相关工具
  getOutlineTree: adaptFastifyHandler(outlineTools.getOutlineTree),
  createOutlineNode: adaptFastifyHandler(outlineTools.createOutlineNode),
  updateOutlineNode: adaptFastifyHandler(outlineTools.updateOutlineNode),
  deleteOutlineNode: adaptFastifyHandler(outlineTools.deleteOutlineNode),
  updateNodeStatus: adaptFastifyHandler(outlineTools.updateNodeStatus),
  rebuildOutlineFromFile: adaptFastifyHandler(outlineTools.rebuildOutlineFromFile),
  getNodesByLevel: adaptFastifyHandler(outlineTools.getNodesByLevel),

  // 人物相关工具
  createCharacter: adaptFastifyHandler(characterTools.createCharacter),
  updateCharacter: adaptFastifyHandler(characterTools.updateCharacter),
  listCharacters: adaptFastifyHandler(characterTools.listCharacters),
  addCharacterRelation: adaptFastifyHandler(characterTools.addCharacterRelation),
  addRelationEvolution: adaptFastifyHandler(characterTools.addRelationEvolution),
  getCharacterRelationGraph: adaptFastifyHandler(characterTools.getCharacterRelationGraph),

  // 章节相关工具
  saveChapterVersion: adaptFastifyHandler(chapterTools.saveChapterVersion),
  listChapterVersions: adaptFastifyHandler(chapterTools.listChapterVersions),
  getChapterContent: adaptFastifyHandler(chapterTools.getChapterContent),
  rollbackChapter: adaptFastifyHandler(chapterTools.rollbackChapter),

  // 伏笔相关工具
  getForeshadowings: adaptFastifyHandler(foreshadowingTools.getForeshadowings),
  createForeshadowing: adaptFastifyHandler(foreshadowingTools.createForeshadowing),
  markForeshadowingAsPaid: adaptFastifyHandler(foreshadowingTools.markForeshadowingAsPaid),
  markForeshadowingAsAbandoned: adaptFastifyHandler(foreshadowingTools.markForeshadowingAsAbandoned),
  deleteForeshadowing: adaptFastifyHandler(foreshadowingTools.deleteForeshadowing),
  getOverdueForeshadowings: adaptFastifyHandler(foreshadowingTools.getOverdueForeshadowings),

  // 快照相关工具
  generateContextSnapshot: adaptFastifyHandler(snapshotTools.generateContextSnapshot),
  getCurrentContextSnapshot: adaptFastifyHandler(snapshotTools.getCurrentContextSnapshot),
  getAllSnapshotVersions: adaptFastifyHandler(snapshotTools.getAllSnapshotVersions),

  // 检查相关工具
  runQualityChecks: adaptFastifyHandler(checkTools.runQualityChecks),
  checkCharacterConsistency: adaptFastifyHandler(checkTools.checkCharacterConsistency),
  checkForeshadowingRecovery: adaptFastifyHandler(checkTools.checkForeshadowingRecovery),
  checkPlotLogic: adaptFastifyHandler(checkTools.checkPlotLogic),
  checkPlatformCompliance: adaptFastifyHandler(checkTools.checkPlatformCompliance),

  // 加载文件相关工具
  loadFileContent: adaptFastifyHandler(loadTools.loadFileContent),
  detectModifiedFiles: adaptFastifyHandler(loadTools.detectModifiedFiles),
  // rebuildDatabase的参数在query中，单独适配
  rebuildDatabase: async (args: { conflictStrategy?: 'overwrite' | 'skip' | 'error' } = {}) => {
    // 模拟Fastify request对象，将参数放在query中
    const request = {
      query: args,
      body: {},
      params: {},
      headers: {},
    } as FastifyRequest<{ Querystring?: { conflictStrategy?: 'overwrite' | 'skip' | 'error' } }>;

    // 模拟Fastify reply对象
    let response: any;
    let statusCode = 200;

    const reply = {
      send: (data: any) => {
        response = data;
        return Promise.resolve();
      },
      status: (code: number) => {
        statusCode = code;
        return reply;
      },
    } as unknown as FastifyReply;

    // 调用原始处理函数
    await loadTools.rebuildDatabase(request, reply);

    if (statusCode >= 400) {
      throw new Error(response?.message || `请求失败，状态码 ${statusCode}`);
    }

    return response;
  },

  // Git相关工具
  initGit: adaptFastifyHandler(gitTools.initGit),
  listBranches: adaptFastifyHandler(gitTools.listBranches),
  createBranch: adaptFastifyHandler(gitTools.createBranch),
  switchBranch: adaptFastifyHandler(gitTools.switchBranch),
  deleteBranch: adaptFastifyHandler(gitTools.deleteBranch),
  mergeBranch: adaptFastifyHandler(gitTools.mergeBranch),
  getGitStatus: adaptFastifyHandler(gitTools.getGitStatus),
  commitChanges: adaptFastifyHandler(gitTools.commitChanges),
  getGitInfo: adaptFastifyHandler(gitTools.getGitInfo),
} as const;
