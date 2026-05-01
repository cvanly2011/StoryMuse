import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import { initDatabase } from '../database';

const git = simpleGit(process.cwd());

// 初始化Git服务
export async function initGitService() {
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.log('当前目录不是Git仓库，Git分支适配功能已禁用');
      return false;
    }

    console.log('Git服务已启动，分支适配功能已启用');
    return true;
  } catch (error) {
    console.log('Git服务初始化失败，分支适配功能已禁用:', error);
    return false;
  }
}

// 获取当前Git分支信息
export async function getGitBranchInfo() {
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return {
        isGitRepo: false,
        branchName: 'default',
        commitHash: null
      };
    }

    const branchSummary = await git.branch();
    const currentBranch = branchSummary.current || 'default';
    const latestCommit = await git.revparse(['HEAD']);

    return {
      isGitRepo: true,
      branchName: currentBranch,
      commitHash: latestCommit.substring(0, 8)
    };
  } catch (error) {
    return {
      isGitRepo: false,
      branchName: 'default',
      commitHash: null
    };
  }
}

// 切换分支时初始化对应数据库
export async function handleBranchSwitch(newBranch: string) {
  try {
    console.log(`检测到分支切换到: ${newBranch}`);
    // 这里可以实现不同分支使用不同数据库的逻辑
    // 简化实现，暂时共用同一个数据库
    await initDatabase();
  } catch (error) {
    console.error('处理分支切换失败:', error);
  }
}
