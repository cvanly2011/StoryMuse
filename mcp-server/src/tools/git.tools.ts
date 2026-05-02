import { FastifyRequest, FastifyReply } from 'fastify';
import { gitService } from '../services/git.service';
import { validateRequired, validateBoolean, validateString } from '../utils/validation.utils';

/**
 * 初始化Git仓库
 */
export async function initGit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const projectRoot = process.cwd();

    if (gitService.isGitRepository()) {
      return reply.status(400).send({
        success: false,
        message: '当前目录已经是Git仓库'
      });
    }

    gitService.init(projectRoot);

    return reply.send({
      success: true,
      message: 'Git仓库初始化完成'
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `初始化Git仓库失败: ${error.message}`
    });
  }
}

/**
 * 获取分支列表
 */
export async function listBranches(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!gitService.isInitialized()) {
      return reply.status(400).send({
        success: false,
        message: 'Git服务未初始化，请先初始化Git仓库'
      });
    }

    const branches = gitService.listBranches();

    return reply.send({
      success: true,
      data: {
        branches,
        currentBranch: gitService.getCurrentBranch()
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取分支列表失败: ${error.message}`
    });
  }
}

/**
 * 创建新分支
 */
export async function createBranch(request: FastifyRequest<{
  Body: {
    branchName: string;
    sourceBranch?: string;
  }
}>, reply: FastifyReply) {
  try {
    if (!gitService.isInitialized()) {
      return reply.status(400).send({
        success: false,
        message: 'Git服务未初始化，请先初始化Git仓库'
      });
    }

    const { branchName, sourceBranch } = request.body;

    // 参数验证
    validateRequired(request.body, ['branchName']);
    validateString(branchName, 'branchName', 1, 100);

    gitService.createBranch(branchName, sourceBranch);

    return reply.send({
      success: true,
      message: `分支 ${branchName} 创建成功`,
      data: {
        branchName,
        sourceBranch: sourceBranch || gitService.getCurrentBranch()
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `创建分支失败: ${error.message}`
    });
  }
}

/**
 * 切换分支
 */
export async function switchBranch(request: FastifyRequest<{
  Body: {
    branchName: string;
    force?: boolean;
  }
}>, reply: FastifyReply) {
  try {
    if (!gitService.isInitialized()) {
      return reply.status(400).send({
        success: false,
        message: 'Git服务未初始化，请先初始化Git仓库'
      });
    }

    const { branchName, force = false } = request.body;

    // 参数验证
    validateRequired(request.body, ['branchName']);
    validateString(branchName, 'branchName', 1, 100);
    if (force !== undefined) {
      validateBoolean(force, 'force');
    }

    await gitService.switchBranch(branchName, force);

    return reply.send({
      success: true,
      message: `已切换到分支 ${branchName}`,
      data: {
        branchName
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `切换分支失败: ${error.message}`
    });
  }
}

/**
 * 删除分支
 */
export async function deleteBranch(request: FastifyRequest<{
  Body: {
    branchName: string;
    force?: boolean;
  }
}>, reply: FastifyReply) {
  try {
    if (!gitService.isInitialized()) {
      return reply.status(400).send({
        success: false,
        message: 'Git服务未初始化，请先初始化Git仓库'
      });
    }

    const { branchName, force = false } = request.body;

    // 参数验证
    validateRequired(request.body, ['branchName']);
    validateString(branchName, 'branchName', 1, 100);
    if (force !== undefined) {
      validateBoolean(force, 'force');
    }

    gitService.deleteBranch(branchName, force);

    return reply.send({
      success: true,
      message: `分支 ${branchName} 已删除`
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `删除分支失败: ${error.message}`
    });
  }
}

/**
 * 合并分支
 */
export async function mergeBranch(request: FastifyRequest<{
  Body: {
    sourceBranch: string;
    targetBranch?: string;
  }
}>, reply: FastifyReply) {
  try {
    if (!gitService.isInitialized()) {
      return reply.status(400).send({
        success: false,
        message: 'Git服务未初始化，请先初始化Git仓库'
      });
    }

    const { sourceBranch, targetBranch } = request.body;

    // 参数验证
    validateRequired(request.body, ['sourceBranch']);
    validateString(sourceBranch, 'sourceBranch', 1, 100);
    if (targetBranch !== undefined) {
      validateString(targetBranch, 'targetBranch', 1, 100);
    }

    const result = gitService.mergeBranch(sourceBranch, targetBranch);

    if (result.success) {
      return reply.send({
        success: true,
        message: result.message,
        data: {
          sourceBranch,
          targetBranch: targetBranch || gitService.getCurrentBranch()
        }
      });
    } else {
      return reply.status(409).send({
        success: false,
        message: result.message,
        data: {
          conflicts: result.conflicts
        }
      });
    }
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `合并分支失败: ${error.message}`
    });
  }
}

/**
 * 获取工作区状态
 */
export async function getGitStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!gitService.isInitialized()) {
      return reply.status(400).send({
        success: false,
        message: 'Git服务未初始化，请先初始化Git仓库'
      });
    }

    const status = gitService.getStatus();

    return reply.send({
      success: true,
      data: status
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取工作区状态失败: ${error.message}`
    });
  }
}

/**
 * 提交改动
 */
export async function commitChanges(request: FastifyRequest<{
  Body: {
    message: string;
  }
}>, reply: FastifyReply) {
  try {
    if (!gitService.isInitialized()) {
      return reply.status(400).send({
        success: false,
        message: 'Git服务未初始化，请先初始化Git仓库'
      });
    }

    const { message } = request.body;

    // 参数验证
    validateRequired(request.body, ['message']);
    validateString(message, 'message', 1, 500);

    const commitHash = gitService.commit(message);

    return reply.send({
      success: true,
      message: '提交成功',
      data: {
        commitHash
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `提交失败: ${error.message}`
    });
  }
}

/**
 * 获取当前Git信息
 */
export async function getGitInfo(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!gitService.isInitialized()) {
      return reply.send({
        success: true,
        data: {
          isGitRepo: false,
          branchName: 'default',
          commitHash: null
        }
      });
    }

    const currentBranch = gitService.getCurrentBranch();
    const commitHash = require('child_process').execSync('git rev-parse HEAD', {
      cwd: process.cwd(),
      encoding: 'utf8'
    }).trim().substring(0, 8);

    return reply.send({
      success: true,
      data: {
        isGitRepo: true,
        branchName: currentBranch,
        commitHash
      }
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取Git信息失败: ${error.message}`
    });
  }
}
