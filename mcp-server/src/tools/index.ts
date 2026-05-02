import { FastifyInstance } from 'fastify';
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

export function registerTools(fastify: FastifyInstance) {
  // 小说相关工具
  fastify.post('/tools/createNovel', novelTools.createNovel);
  fastify.post('/tools/getNovelInfo', novelTools.getNovelInfo);
  fastify.post('/tools/listNovels', novelTools.listNovels);

  // 故事种子相关工具
  fastify.post('/tools/saveStorySeed', seedTools.saveStorySeed);
  fastify.post('/tools/getActiveSeed', seedTools.getActiveSeed);
  fastify.post('/tools/listSeedVersions', seedTools.listSeedVersions);

  // 大纲相关工具
  fastify.post('/tools/getOutlineTree', outlineTools.getOutlineTree);
  fastify.post('/tools/createOutlineNode', outlineTools.createOutlineNode);
  fastify.post('/tools/updateOutlineNode', outlineTools.updateOutlineNode);
  fastify.post('/tools/deleteOutlineNode', outlineTools.deleteOutlineNode);
  fastify.post('/tools/updateNodeStatus', outlineTools.updateNodeStatus);
  fastify.post('/tools/rebuildOutlineFromFile', outlineTools.rebuildOutlineFromFile);
  fastify.post('/tools/getNodesByLevel', outlineTools.getNodesByLevel);

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

  // 伏笔相关工具
  fastify.post('/tools/getForeshadowings', foreshadowingTools.getForeshadowings);
  fastify.post('/tools/createForeshadowing', foreshadowingTools.createForeshadowing);
  fastify.post('/tools/markForeshadowingAsPaid', foreshadowingTools.markForeshadowingAsPaid);
  fastify.post('/tools/markForeshadowingAsAbandoned', foreshadowingTools.markForeshadowingAsAbandoned);
  fastify.post('/tools/deleteForeshadowing', foreshadowingTools.deleteForeshadowing);
  fastify.post('/tools/getOverdueForeshadowings', foreshadowingTools.getOverdueForeshadowings);

  // 快照相关工具
  fastify.post('/tools/generateContextSnapshot', snapshotTools.generateContextSnapshot);
  fastify.post('/tools/getCurrentContextSnapshot', snapshotTools.getCurrentContextSnapshot);
  fastify.post('/tools/getAllSnapshotVersions', snapshotTools.getAllSnapshotVersions);

  // 检查相关工具
  fastify.post('/tools/runQualityChecks', checkTools.runQualityChecks);
  fastify.post('/tools/checkCharacterConsistency', checkTools.checkCharacterConsistency);
  fastify.post('/tools/checkForeshadowingRecovery', checkTools.checkForeshadowingRecovery);
  fastify.post('/tools/checkPlotLogic', checkTools.checkPlotLogic);
  fastify.post('/tools/checkPlatformCompliance', checkTools.checkPlatformCompliance);

  // 加载文件相关工具
  fastify.post('/tools/loadFileContent', loadTools.loadFileContent);
  fastify.post('/tools/detectModifiedFiles', loadTools.detectModifiedFiles);
  fastify.post('/tools/rebuildDatabase', loadTools.rebuildDatabase);

  // Git相关工具
  fastify.post('/tools/initGit', gitTools.initGit);
  fastify.post('/tools/listBranches', gitTools.listBranches);
  fastify.post('/tools/createBranch', gitTools.createBranch);
  fastify.post('/tools/switchBranch', gitTools.switchBranch);
  fastify.post('/tools/deleteBranch', gitTools.deleteBranch);
  fastify.post('/tools/mergeBranch', gitTools.mergeBranch);
  fastify.post('/tools/getGitStatus', gitTools.getGitStatus);
  fastify.post('/tools/commitChanges', gitTools.commitChanges);
  fastify.post('/tools/getGitInfo', gitTools.getGitInfo);

  // 全局视图工具
  fastify.post('/tools/getNovelOverview', novelTools.getNovelOverview);
  fastify.post('/tools/getStoryTimeline', novelTools.getStoryTimeline);
}
