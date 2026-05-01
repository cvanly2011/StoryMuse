import { FastifyRequest, FastifyReply } from 'fastify';
import { getGitBranchInfo } from '../services/git.service';

// 获取Git分支信息
export async function getGitBranchInfo(request: FastifyRequest, reply: FastifyReply) {
  try {
    const info = await getGitBranchInfo();
    return reply.send({
      success: true,
      data: info
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      message: `获取分支信息失败: ${error.message}`
    });
  }
}
