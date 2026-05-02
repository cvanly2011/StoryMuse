// Mock所有依赖 - 必须在导入之前
import * as ServerModule from '@modelcontextprotocol/sdk/server/index.js';
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('../database');
jest.mock('../utils/init.util');
jest.mock('../database/dao/novel.dao');
jest.mock('../services/git.service', () => ({
  gitService: {
    init: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { initDatabase } from '../database';
import { toolHandlers } from '../tools';
import { ensureProjectInitialized } from '../utils/init.util';
import { novelDAO } from '../database/dao/novel.dao';
import { startMCPServer, tools } from '../server';

// 现在Server已经被mock了
const Server = ServerModule.Server as jest.Mock;

describe('MCP <-> Skill Integration Tests', () => {
  let mockSetRequestHandler: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // 模拟Server类
    mockSetRequestHandler = jest.fn();
    Server.mockImplementation(() => ({
      setRequestHandler: mockSetRequestHandler,
      connect: jest.fn().mockResolvedValue(undefined),
    }));

    // 模拟initDatabase
    (initDatabase as jest.Mock).mockResolvedValue(undefined);
    // 模拟ensureProjectInitialized
    (ensureProjectInitialized as jest.Mock).mockResolvedValue(undefined);
  });

  test('should register correct list tools handler that returns all defined tools', async () => {
    // 启动MCP服务器
    await startMCPServer();

    // 验证Server类被正确实例化
    expect(Server).toHaveBeenCalledWith(
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

    // 验证list tools handler被注册
    expect(mockSetRequestHandler).toHaveBeenCalledWith(
      ListToolsRequestSchema,
      expect.any(Function)
    );

    // 获取list tools handler
    const listToolsHandler = mockSetRequestHandler.mock.calls.find(
      (call) => call[0] === ListToolsRequestSchema
    )[1];

    // 调用handler，验证返回的工具列表
    const result = await listToolsHandler({});
    expect(result).toHaveProperty('tools');
    expect(result.tools).toBeInstanceOf(Array);
    // 验证返回的工具和server.ts里定义的一致
    expect(result.tools).toEqual(tools);
    // 验证每个工具都有name、description和inputSchema
    for (const tool of result.tools) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      expect(tool.inputSchema).toHaveProperty('type', 'object');
    }
  });

  test('should register correct call tool handler that routes to the right tool handler', async () => {
    // 模拟一个工具返回结果
    const mockNovelInfo = {
      success: true,
      data: {
        id: 1,
        name: '测试小说',
        description: '测试简介',
        genre: '科幻',
        targetPlatform: '起点',
        wordCountTarget: 100000,
        createdAt: new Date().toISOString(),
        totalWordCount: 0,
        progress: 0
      }
    };
    // 模拟findById返回小说
    (novelDAO.findById as jest.Mock).mockReturnValue(mockNovelInfo.data);
    // 模拟getTotalWordCount
    (novelDAO.getTotalWordCount as jest.Mock).mockReturnValue(0);
    // 模拟getProgress
    (novelDAO.getProgress as jest.Mock).mockReturnValue(0);

    // 启动MCP服务器
    await startMCPServer();

    // 验证call tool handler被注册
    expect(mockSetRequestHandler).toHaveBeenCalledWith(
      CallToolRequestSchema,
      expect.any(Function)
    );

    // 获取call tool handler
    const callToolHandler = mockSetRequestHandler.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )[1];

    // 测试调用存在的工具，传入required参数novelId
    const result = await callToolHandler({
      params: {
        name: 'getNovelInfo',
        arguments: {
          novelId: 1
        },
      },
    });

    // 验证返回格式正确
    expect(result).toHaveProperty('content');
    expect(result.content).toBeInstanceOf(Array);
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0]).toHaveProperty('text');
    expect(result).toHaveProperty('isError', false);

    // 验证返回的内容是正确的JSON
    const responseData = JSON.parse(result.content[0].text);
    expect(responseData).toEqual(mockNovelInfo);

    // 验证核心服务被初始化
    expect(initDatabase).toHaveBeenCalled();
    expect(ensureProjectInitialized).toHaveBeenCalled();
  });

  test('should return correct error response when calling non-existent tool', async () => {
    // 启动MCP服务器
    await startMCPServer();

    // 获取call tool handler
    const callToolHandler = mockSetRequestHandler.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )[1];

    // 测试调用不存在的工具
    const result = await callToolHandler({
      params: {
        name: 'nonExistentTool',
        arguments: {},
      },
    });

    // 验证返回错误格式正确
    expect(result).toHaveProperty('isError', true);
    expect(result.content[0]).toHaveProperty('type', 'text');
    const responseData = JSON.parse(result.content[0].text);
    expect(responseData).toHaveProperty('success', false);
    expect(responseData).toHaveProperty('message', '未知工具: nonExistentTool');
  });

  test('should handle tool execution errors correctly', async () => {
    // 模拟工具抛出错误
    const mockError = new Error('数据库连接失败');
    jest.spyOn(toolHandlers, 'getNovelInfo').mockRejectedValue(mockError);

    // 启动MCP服务器
    await startMCPServer();

    // 获取call tool handler
    const callToolHandler = mockSetRequestHandler.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )[1];

    // 调用会抛出错误的工具
    const result = await callToolHandler({
      params: {
        name: 'getNovelInfo',
        arguments: {
          novelId: 1
        },
      },
    });

    // 验证错误被正确返回
    expect(result).toHaveProperty('isError', true);
    const responseData = JSON.parse(result.content[0].text);
    expect(responseData).toHaveProperty('success', false);
    expect(responseData.message).toBe('数据库连接失败');
  });

  test('tool definitions should match between server.ts and toolHandlers', async () => {
    const serverToolNames = new Set(tools.map((t: any) => t.name));
    const handlerToolNames = new Set(Object.keys(toolHandlers));

    // 验证所有server里定义的工具都有对应的handler
    for (const toolName of serverToolNames) {
      expect(handlerToolNames.has(toolName as string)).toBe(true);
    }

    // 验证所有handler里的工具都在server里有定义
    for (const toolName of handlerToolNames) {
      expect(serverToolNames.has(toolName)).toBe(true);
    }
  });
});
