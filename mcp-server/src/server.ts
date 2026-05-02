import fastify from 'fastify';
import cors from '@fastify/cors';
import { initDatabase } from './database';
import { registerTools } from './tools';
import { errorHandler } from './middleware/error-handler.middleware';
import { responseTransformHook } from './middleware/response-transform.middleware';
import { gitService } from './services/git.service';

const server = fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  }
});

// 配置CORS
server.register(cors, {
  origin: true, // 允许所有来源
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// 注册错误处理中间件
server.setErrorHandler(errorHandler);

// 注册响应转换钩子（snake_case → camelCase）
server.addHook('onSend', responseTransformHook);

// 健康检查接口
server.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'StoryMuse MCP Server'
  };
});

// 注册所有工具接口
registerTools(server);

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    console.log('数据库初始化成功');

    // 初始化Git服务
    try {
      gitService.init(process.cwd());
      console.log('Git服务初始化成功');
    } catch (error) {
      console.log('Git服务初始化失败，分支功能将不可用:', (error as Error).message);
    }

    // 启动服务
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 20000;
    await server.listen({ port, host: '127.0.0.1' });

    console.log(`🚀 StoryMuse MCP Server 启动成功，监听端口 ${port}`);
    console.log(`📖 健康检查地址：http://127.0.0.1:${port}/health`);
    console.log(`🛠️  工具接口已注册，等待Claude Code调用`);
  } catch (error) {
    console.error('❌ 服务器启动失败：', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n📤 正在关闭服务器...');
  await server.close();
  console.log('✅ 服务器已关闭');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📤 收到终止信号，正在关闭服务器...');
  await server.close();
  console.log('✅ 服务器已关闭');
  process.exit(0);
});

// 启动服务
startServer();
