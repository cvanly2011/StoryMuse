import Fastify from 'fastify';
import { initDatabase } from './database';
import { registerTools } from './tools';
import { initFileWatcher } from './services/file.service';
import { initGitService } from './services/git.service';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 19876;

async function startServer() {
  console.log('🚀 启动 StoryMuse MCP Server...');

  // 初始化数据库
  await initDatabase();
  console.log('✅ 数据库初始化完成');

  // 初始化Git服务
  await initGitService();
  console.log('✅ Git服务初始化完成');

  // 初始化文件监听器
  initFileWatcher();
  console.log('✅ 文件监听器启动完成');

  // 创建Fastify实例
  const fastify = Fastify({
    logger: false
  });

  // 注册所有工具接口
  registerTools(fastify);

  // 健康检查接口
  fastify.get('/health', async () => {
    return { status: 'ok', version: '1.0.0' };
  });

  // 启动服务
  try {
    await fastify.listen({ port: PORT, host: '127.0.0.1' });
    console.log(`✅ MCP Server 已启动，监听端口 ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

startServer().catch(err => {
  console.error('❌ 启动失败:', err);
  process.exit(1);
});
