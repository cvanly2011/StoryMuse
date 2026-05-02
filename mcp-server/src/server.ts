#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fastify from 'fastify';
import cors from '@fastify/cors';
import { initDatabase } from './database';
import { toolHandlers, ToolName } from './tools';
import { gitService } from './services/git.service';
import { ensureProjectInitialized } from './utils/init.util';
import { responseTransformHook } from './middleware/response-transform.middleware';

// 工具定义，和mcp.json保持一致
const tools: Tool[] = [
  {
    name: 'createNovel',
    description: '创建新小说',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '小说名称' },
        description: { type: 'string', description: '一句话简介' },
        genre: { type: 'string', description: '题材类型' },
        targetPlatform: { type: 'string', description: '目标发布平台' },
        wordCountTarget: { type: 'number', description: '目标总字数' }
      },
      required: ['name', 'description']
    }
  },
  {
    name: 'getNovelInfo',
    description: '获取当前小说基础信息',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'saveStorySeed',
    description: '保存故事种子版本',
    inputSchema: {
      type: 'object',
      properties: {
        coreIdea: { type: 'string', description: '核心创意' },
        worldSetting: { type: 'string', description: '世界观设定' },
        coreCharacters: { type: 'string', description: '核心人物剪影' },
        sellingPoints: { type: 'string', description: '核心卖点' },
        setAsActive: { type: 'boolean', description: '是否设为当前激活版本' }
      },
      required: ['coreIdea']
    }
  },
  {
    name: 'getActiveSeed',
    description: '获取当前激活的故事种子',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'createOutlineNode',
    description: '创建大纲节点',
    inputSchema: {
      type: 'object',
      properties: {
        parentId: { type: 'number', description: '父节点ID' },
        level: { type: 'number', description: '层级1-4' },
        order: { type: 'number', description: '同级排序' },
        title: { type: 'string', description: '节点标题' },
        description: { type: 'string', description: '节点描述' },
        characterGoals: { type: 'string', description: '人物目标' },
        conflictPoints: { type: 'string', description: '冲突点' },
        turningPoints: { type: 'string', description: '转折点' },
        foreshadowingHints: { type: 'string', description: '伏笔提示' }
      },
      required: ['level', 'order', 'title']
    }
  },
  {
    name: 'updateOutlineNode',
    description: '更新大纲节点',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'number', description: '节点ID' },
        updates: { type: 'object', description: '要更新的字段' }
      },
      required: ['nodeId', 'updates']
    }
  },
  {
    name: 'getOutlineTree',
    description: '获取完整大纲树',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'number', description: '返回指定层级以上的节点' }
      }
    }
  },
  {
    name: 'createCharacter',
    description: '创建人物',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '人物姓名' },
        alias: { type: 'string', description: '别名' },
        role: { type: 'string', enum: ['protagonist', 'antagonist', 'supporting', 'guest', 'npc'], description: '角色类型' },
        appearance: { type: 'string', description: '外貌' },
        personality: { type: 'string', description: '性格' },
        innerConflict: { type: 'string', description: '内在矛盾' },
        coreDesire: { type: 'string', description: '核心欲望' },
        coreFear: { type: 'string', description: '核心恐惧' },
        characterArc: { type: 'string', description: '人物弧光' },
        backstory: { type: 'string', description: '背景故事' }
      },
      required: ['name', 'role']
    }
  },
  {
    name: 'updateCharacter',
    description: '更新人物信息',
    inputSchema: {
      type: 'object',
      properties: {
        characterId: { type: 'number', description: '人物ID' },
        updates: { type: 'object', description: '要更新的字段' }
      },
      required: ['characterId', 'updates']
    }
  },
  {
    name: 'listCharacters',
    description: '获取人物列表',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', description: '按角色类型过滤' }
      }
    }
  },
  {
    name: 'addCharacterRelation',
    description: '添加人物关系',
    inputSchema: {
      type: 'object',
      properties: {
        relationType: { type: 'string', enum: ['binary', 'multiple'], description: '关系类型' },
        characterIds: { type: 'array', items: { type: 'number' }, description: '关联人物ID列表' },
        relationName: { type: 'string', description: '关系名称' },
        description: { type: 'string', description: '关系描述' },
        closeness: { type: 'number', description: '亲密程度1-10' },
        secrecyLevel: { type: 'number', description: '秘密程度1-10' },
        conflictLevel: { type: 'number', description: '冲突等级1-10' },
        plotImportance: { type: 'number', description: '重要程度1-10' }
      },
      required: ['relationType', 'characterIds', 'relationName']
    }
  },
  {
    name: 'getCharacterRelationGraph',
    description: '获取人物关系图谱',
    inputSchema: {
      type: 'object',
      properties: {
        upToChapterId: { type: 'number', description: '截至到某章节的关系状态' }
      }
    }
  },
  {
    name: 'saveChapterVersion',
    description: '保存章节版本',
    inputSchema: {
      type: 'object',
      properties: {
        outlineNodeId: { type: 'number', description: '大纲节点ID' },
        content: { type: 'string', description: '章节正文' },
        summary: { type: 'string', description: '章节摘要' },
        keyEvents: { type: 'array', items: { type: 'string' }, description: '关键事件列表' },
        characterAppearances: { type: 'array', items: { type: 'object' }, description: '出场人物状态变化' },
        foreshadowingIds: { type: 'array', items: { type: 'number' }, description: '本章埋设的伏笔ID' },
        createdBy: { type: 'string', description: '创建者' }
      },
      required: ['outlineNodeId', 'content', 'summary', 'keyEvents', 'characterAppearances']
    }
  },
  {
    name: 'getChapterContent',
    description: '获取章节内容',
    inputSchema: {
      type: 'object',
      properties: {
        outlineNodeId: { type: 'number', description: '大纲节点ID' },
        version: { type: 'number', description: '版本号，默认当前版本' },
        includeFullContent: { type: 'boolean', description: '是否包含完整正文，默认false只返回摘要' }
      },
      required: ['outlineNodeId']
    }
  },
  {
    name: 'rollbackChapter',
    description: '回滚章节到指定版本',
    inputSchema: {
      type: 'object',
      properties: {
        outlineNodeId: { type: 'number', description: '大纲节点ID' },
        targetVersion: { type: 'number', description: '目标版本号' }
      },
      required: ['outlineNodeId', 'targetVersion']
    }
  },
  {
    name: 'createForeshadowing',
    description: '创建伏笔',
    inputSchema: {
      type: 'object',
      properties: {
        setupChapterId: { type: 'number', description: '埋设章节ID' },
        description: { type: 'string', description: '伏笔内容' },
        payoffChapterId: { type: 'number', description: '计划回收章节ID' },
        hintLevel: { type: 'number', description: '暗示明显程度1-5' },
        importance: { type: 'number', description: '重要程度1-10' }
      },
      required: ['setupChapterId', 'description']
    }
  },
  {
    name: 'markForeshadowingAsPaid',
    description: '标记伏笔已回收',
    inputSchema: {
      type: 'object',
      properties: {
        foreshadowingId: { type: 'number', description: '伏笔ID' },
        payoffChapterId: { type: 'number', description: '回收章节ID' },
        payoffDescription: { type: 'string', description: '回收描述' }
      },
      required: ['foreshadowingId', 'payoffChapterId', 'payoffDescription']
    }
  },
  {
    name: 'getOverdueForeshadowings',
    description: '获取未回收伏笔列表',
    inputSchema: {
      type: 'object',
      properties: {
        upToChapterId: { type: 'number', description: '截至到某章节未回收的' }
      }
    }
  },
  {
    name: 'generateContextSnapshot',
    description: '生成章节上下文快照',
    inputSchema: {
      type: 'object',
      properties: {
        chapterId: { type: 'number', description: '章节ID' },
        previousChaptersCount: { type: 'number', description: '包含前N章信息，默认3' }
      },
      required: ['chapterId']
    }
  },
  {
    name: 'getCurrentContextSnapshot',
    description: '获取当前章节的上下文快照',
    inputSchema: {
      type: 'object',
      properties: {
        chapterId: { type: 'number', description: '章节ID' }
      }
    }
  },
  {
    name: 'checkCharacterConsistency',
    description: '检查人物一致性',
    inputSchema: {
      type: 'object',
      properties: {
        chapterId: { type: 'number', description: '指定章节，默认全部' }
      }
    }
  },
  {
    name: 'checkForeshadowingRecovery',
    description: '检查伏笔回收情况',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'checkPlotLogic',
    description: '检查情节逻辑合理性',
    inputSchema: {
      type: 'object',
      properties: {
        startChapterId: { type: 'number', description: '开始章节ID' },
        endChapterId: { type: 'number', description: '结束章节ID' }
      }
    }
  },
  {
    name: 'checkPlatformCompliance',
    description: '检查平台合规性',
    inputSchema: {
      type: 'object',
      properties: {
        chapterId: { type: 'number', description: '指定章节，默认全部' }
      }
    }
  },
  {
    name: 'getNovelOverview',
    description: '获取小说全局概览',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'getStoryTimeline',
    description: '获取故事时间线',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'loadFileContent',
    description: '加载文件内容到数据库',
    inputSchema: {
      type: 'object',
      properties: {
        fileType: { type: 'string', enum: ['seed', 'outline', 'character', 'chapter'], description: '文件类型' },
        filePath: { type: 'string', description: '文件路径' },
        chapterId: { type: 'number', description: '章节ID，仅当fileType为chapter时需要' }
      },
      required: ['fileType', 'filePath']
    }
  },
  {
    name: 'detectModifiedFiles',
    description: '检测所有修改过的文件',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'rebuildDatabase',
    description: '从工作区文件重建数据库',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'listNovels',
    description: '获取小说列表',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'listSeedVersions',
    description: '获取故事种子版本列表',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'deleteOutlineNode',
    description: '删除大纲节点',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'number', description: '节点ID' }
      },
      required: ['nodeId']
    }
  },
  {
    name: 'updateNodeStatus',
    description: '更新节点状态',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'number', description: '节点ID' },
        status: { type: 'string', description: '节点状态' }
      },
      required: ['nodeId', 'status']
    }
  },
  {
    name: 'rebuildOutlineFromFile',
    description: '从文件重建大纲',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'getNodesByLevel',
    description: '获取指定层级的大纲节点',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'number', description: '层级' }
      },
      required: ['level']
    }
  },
  {
    name: 'addRelationEvolution',
    description: '添加人物关系演变',
    inputSchema: {
      type: 'object',
      properties: {
        relationId: { type: 'number', description: '关系ID' },
        chapterId: { type: 'number', description: '章节ID' },
        description: { type: 'string', description: '演变描述' }
      },
      required: ['relationId', 'chapterId', 'description']
    }
  },
  {
    name: 'listChapterVersions',
    description: '获取章节版本列表',
    inputSchema: {
      type: 'object',
      properties: {
        outlineNodeId: { type: 'number', description: '大纲节点ID' }
      },
      required: ['outlineNodeId']
    }
  },
  {
    name: 'getForeshadowings',
    description: '获取伏笔列表',
    inputSchema: {
      type: 'object',
      properties: {
        chapterId: { type: 'number', description: '章节ID，可选' }
      }
    }
  },
  {
    name: 'markForeshadowingAsAbandoned',
    description: '标记伏笔为废弃',
    inputSchema: {
      type: 'object',
      properties: {
        foreshadowingId: { type: 'number', description: '伏笔ID' },
        reason: { type: 'string', description: '废弃原因' }
      },
      required: ['foreshadowingId', 'reason']
    }
  },
  {
    name: 'deleteForeshadowing',
    description: '删除伏笔',
    inputSchema: {
      type: 'object',
      properties: {
        foreshadowingId: { type: 'number', description: '伏笔ID' }
      },
      required: ['foreshadowingId']
    }
  },
  {
    name: 'getAllSnapshotVersions',
    description: '获取所有快照版本',
    inputSchema: {
      type: 'object',
      properties: {
        chapterId: { type: 'number', description: '章节ID，可选' }
      }
    }
  },
  {
    name: 'runQualityChecks',
    description: '运行质量检查',
    inputSchema: {
      type: 'object',
      properties: {
        chapterId: { type: 'number', description: '章节ID，可选' },
        checkTypes: { type: 'array', items: { type: 'string' }, description: '检查类型，可选' }
      }
    }
  },
  {
    name: 'initGit',
    description: '初始化Git仓库',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'listBranches',
    description: '获取Git分支列表',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'createBranch',
    description: '创建Git分支',
    inputSchema: {
      type: 'object',
      properties: {
        branchName: { type: 'string', description: '分支名称' }
      },
      required: ['branchName']
    }
  },
  {
    name: 'switchBranch',
    description: '切换Git分支',
    inputSchema: {
      type: 'object',
      properties: {
        branchName: { type: 'string', description: '分支名称' }
      },
      required: ['branchName']
    }
  },
  {
    name: 'deleteBranch',
    description: '删除Git分支',
    inputSchema: {
      type: 'object',
      properties: {
        branchName: { type: 'string', description: '分支名称' }
      },
      required: ['branchName']
    }
  },
  {
    name: 'mergeBranch',
    description: '合并Git分支',
    inputSchema: {
      type: 'object',
      properties: {
        sourceBranch: { type: 'string', description: '源分支名称' },
        targetBranch: { type: 'string', description: '目标分支名称' }
      },
      required: ['sourceBranch', 'targetBranch']
    }
  },
  {
    name: 'getGitStatus',
    description: '获取Git状态',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'commitChanges',
    description: '提交Git更改',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '提交信息' }
      },
      required: ['message']
    }
  },
  {
    name: 'getGitInfo',
    description: '获取当前Git信息',
    inputSchema: { type: 'object', properties: {} }
  }
];

/**
 * 初始化核心服务（数据库、Git、文件同步等）
 */
async function initCoreServices() {
  // 初始化数据库
  await initDatabase();
  console.error('数据库初始化成功'); // 输出到stderr，不影响MCP通信

  // 初始化Git服务
  try {
    await gitService.init(process.cwd());
    console.error('Git服务初始化成功');
  } catch (error) {
    console.error('Git服务初始化失败，分支功能将不可用:', (error as Error).message);
  }

  // 确保项目已初始化
  try {
    await ensureProjectInitialized();
    console.error('项目初始化完成');
  } catch (error) {
    console.error('项目初始化失败:', error);
    throw error;
  }
}

/**
 * 启动MCP服务器（stdin/stdout模式，默认模式）
 */
async function startMCPServer() {
  const server = new Server(
    {
      name: 'storymuse-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 注册工具列表处理
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // 注册工具调用处理
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name as ToolName;
    const args = request.params.arguments as any;

    try {
      // 所有工具调用前确保核心服务已初始化
      await initCoreServices();

      // 调用对应的工具处理器
      const handler = toolHandlers[toolName];
      if (!handler) {
        throw new Error(`未知工具: ${toolName}`);
      }

      const result = await handler(args);

      // 转换为MCP响应格式
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error(`工具调用失败 ${toolName}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: (error as Error).message,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // 启动服务器，使用stdio传输
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 StoryMuse MCP Server 启动成功，运行在STDIO模式');
}

/**
 * 启动HTTP服务器（可选模式，用于其他场景）
 */
async function startHTTPServer() {
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

  // 注册响应转换钩子（snake_case → camelCase）
  server.addHook('onSend', responseTransformHook);

  // 全局前置钩子：所有请求都先确保项目已初始化
  server.addHook('preHandler', async (request, reply) => {
    // 健康检查接口跳过初始化
    if (request.routerPath === '/health') {
      return;
    }
    try {
      await ensureProjectInitialized();
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: `项目初始化失败: ${(error as Error).message}`
      });
    }
  });

  // 健康检查接口
  server.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'StoryMuse MCP Server'
    };
  });

  // 注册所有工具接口
  for (const [name, handler] of Object.entries(toolHandlers)) {
    server.post(`/tools/${name}`, async (request, reply) => {
      try {
        const result = await handler(request.body as any);
        return reply.send(result);
      } catch (error) {
        return reply.status(500).send({
          success: false,
          message: (error as Error).message,
        });
      }
    });
  }

  // 初始化核心服务
  await initCoreServices();

  // 启动服务
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 20000;
  await server.listen({ port, host: '127.0.0.1' });

  console.log(`🚀 StoryMuse MCP Server 启动成功，监听端口 ${port}`);
  console.log(`📖 健康检查地址：http://127.0.0.1:${port}/health`);
  console.log(`🛠️  工具接口已注册，等待调用`);

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
}

// 主入口
async function main() {
  try {
    // 检查命令行参数，决定启动模式
    const args = process.argv.slice(2);
    if (args.includes('--http')) {
      // HTTP模式
      await startHTTPServer();
    } else {
      // 默认MCP stdio模式
      await startMCPServer();
    }
  } catch (error) {
    console.error('❌ 服务器启动失败：', error);
    process.exit(1);
  }
}

// 导出用于测试
export { startMCPServer, startHTTPServer, initCoreServices, tools };

// 只有在直接运行这个文件的时候才执行main()
if (require.main === module) {
  main();
}