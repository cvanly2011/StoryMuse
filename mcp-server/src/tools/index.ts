import { FastifyInstance } from 'fastify';
import * as novelTools from './novel.tools';
import * as seedTools from './seed.tools';
// import * as outlineTools from './outline.tools'; // 暂时注释，待修复
import * as characterTools from './character.tools';
import * as chapterTools from './chapter.tools';
// import * as foreshadowingTools from './foreshadowing.tools'; // 暂时注释，待修复
// import * as snapshotTools from './snapshot.tools'; // 暂时注释，待修复
// import * as checkTools from './check.tools'; // 暂时注释，待修复
import * as loadTools from './load.tools';
// import * as gitTools from './git.tools'; // 暂时注释，待修复

export function registerTools(fastify: FastifyInstance) {
  // 小说相关工具
  fastify.post('/tools/createNovel', novelTools.createNovel);
  fastify.post('/tools/getNovelInfo', novelTools.getNovelInfo);
  fastify.post('/tools/listNovels', novelTools.listNovels);

  // 故事种子相关工具
  fastify.post('/tools/saveStorySeed', seedTools.saveStorySeed);
  fastify.post('/tools/getActiveSeed', seedTools.getActiveSeed);
  fastify.post('/tools/listSeedVersions', seedTools.listSeedVersions);

  // 大纲相关工具（暂时注释，待修复）
  // fastify.post('/tools/createOutlineNode', outlineTools.createOutlineNode);
  // fastify.post('/tools/updateOutlineNode', outlineTools.updateOutlineNode);
  // fastify.post('/tools/moveOutlineNode', outlineTools.moveOutlineNode);
  // fastify.post('/tools/getOutlineTree', outlineTools.getOutlineTree);

  // 人物相关工具
  fastify.post('/tools/createCharacter', characterTools.createCharacter);
  fastify.post('/tools/updateCharacter', characterTools.updateCharacter);
  fastify.post('/tools/listCharacters', characterTools.listCharacters);
  fastify.post('/tools/addCharacterRelation', characterTools.addCharacterRelation);
  fastify.post('/tools/addRelationEvolution', characterTools.addRelationEvolution);
  fastify.post('/tools/getCharacterRelationGraph', characterTools.getCharacterRelationGraph);

  // 章节相关工具
  fastify.post('/tools/saveChapterVersion', chapterTools.saveChapterVersion);
  fastify.post('/tools/listChapterVersions', chapterTools.listChapterVersions);
  fastify.post('/tools/getChapterContent', chapterTools.getChapterContent);
  fastify.post('/tools/rollbackChapter', chapterTools.rollbackChapter);

  // 伏笔相关工具（暂时注释，待修复）
  // fastify.post('/tools/createForeshadowing', foreshadowingTools.createForeshadowing);
  // fastify.post('/tools/markForeshadowingPaidOff', foreshadowingTools.markForeshadowingPaidOff);
  // fastify.post('/tools/listUnpaidForeshadowings', foreshadowingTools.listUnpaidForeshadowings);

  // 快照相关工具（暂时注释，待修复）
  // fastify.post('/tools/generateContextSnapshot', snapshotTools.generateContextSnapshot);
  // fastify.post('/tools/getCurrentContextSnapshot', snapshotTools.getCurrentContextSnapshot);

  // 检查相关工具（暂时注释，待修复）
  // fastify.post('/tools/checkCharacterConsistency', checkTools.checkCharacterConsistency);
  // fastify.post('/tools/checkForeshadowingRecovery', checkTools.checkForeshadowingRecovery);
  // fastify.post('/tools/checkPlotLogic', checkTools.checkPlotLogic);
  // fastify.post('/tools/checkPlatformCompliance', checkTools.checkPlatformCompliance);

  // 加载文件相关工具
  fastify.post('/tools/loadFileContent', loadTools.loadFileContent);
  fastify.post('/tools/detectModifiedFiles', loadTools.detectModifiedFiles);
  fastify.post('/tools/rebuildDatabase', loadTools.rebuildDatabase);

  // Git相关工具（暂时注释，待修复）
  // fastify.post('/tools/getGitBranchInfo', gitTools.getGitBranchInfo);

  // 全局视图工具
  fastify.post('/tools/getNovelOverview', novelTools.getNovelOverview);
  fastify.post('/tools/getStoryTimeline', novelTools.getStoryTimeline);
}
