# StoryMuse 开发者指南

本文档面向想要二次开发、扩展功能的开发者。

## 📋 目录
1. [项目架构](#项目架构)
2. [开发环境搭建](#开发环境搭建)
3. [核心模块说明](#核心模块说明)
4. [扩展开发指南](#扩展开发指南)
5. [打包发布](#打包发布)

## 项目架构
```
story-muse/
├── .claude-plugin/        # 插件配置文件
│   ├── plugin.json        # 插件元信息
│   ├── skills.json        # Skill列表配置
│   └── mcp.json           # MCP服务配置
├── mcp-server/            # MCP后端服务（Node.js + TypeScript）
│   ├── src/
│   │   ├── database/      # 数据库层（SQLite + WAL模式）
│   │   ├── tools/         # MCP工具层（对外接口）
│   │   ├── services/      # 业务逻辑层
│   │   └── config/        # 配置文件（平台规则、敏感词库）
│   └── package.json
├── skills/                # Skill定义（纯Markdown + YAML）
├── docs/                  # 文档
└── scripts/               # 辅助脚本
```

### 技术栈
- **后端**：Node.js + TypeScript + Fastify
- **数据库**：SQLite3 + better-sqlite3 + WAL模式
- **文件监听**：chokidar
- **Git集成**：simple-git

## 开发环境搭建
### 前置要求
- Node.js >= 18.0.0
- Claude Code 最新版本

### 本地开发步骤
1. 克隆仓库到本地
```bash
git clone https://github.com/your-repo/story-muse.git
cd story-muse
```

2. 安装MCP服务依赖
```bash
cd mcp-server
npm install
```

3. 启动开发服务
```bash
npm run dev
```

4. 在Claude Code中加载本地插件
- 打开Claude Code → 设置 → 插件 → 「从本地安装」
- 选择项目根目录即可加载开发中的插件

## 核心模块说明
### 数据库层（mcp-server/src/database/）
- **schema.ts**：数据库表结构定义和初始化SQL
- **index.ts**：数据库连接管理、备份、恢复逻辑
- **dao/**：数据访问对象，每个表对应一个dao文件，封装CRUD操作
- **migrations/**：数据库迁移脚本，用于版本升级

### 工具层（mcp-server/src/tools/）
每个工具对应一个文件，定义对外暴露的MCP接口，遵循以下规范：
- 每个工具函数接收Fastify的request和reply参数
- 所有参数校验在工具层完成
- 调用service层处理业务逻辑
- 统一返回格式：`{ success: boolean, data?: any, message?: string }`

### 业务逻辑层（mcp-server/src/services/）
封装复杂的业务逻辑，被工具层调用：
- **snapshot.service.ts**：上下文快照生成逻辑，低token优化核心
- **check.service.ts**：质量检查逻辑（人物一致性、伏笔回收等）
- **platform.service.ts**：平台规则适配逻辑
- **sync.service.ts**：文件同步逻辑
- **git.service.ts**：Git分支适配逻辑
- **file.service.ts**：文件监听逻辑

### Skill层（skills/）
每个Skill是一个纯Markdown文件，开头包含YAML元信息：
```yaml
---
name: skill-name
description: skill description
usage: /skill-name [params]
---
```
文件内容是Skill的交互逻辑和提示词，不需要编译。

## 扩展开发指南
### 添加新的平台规则
1. 在`mcp-server/src/config/platform-rules/`目录下新建JSON文件，以平台名称命名
2. 按照格式编写平台规则
3. 在`platform.service.ts`中添加对应的适配逻辑
4. 重新编译打包即可

### 添加新的检查项
1. 在`check.service.ts`中添加新的检查逻辑
2. 在`check.tools.ts`中添加对应的工具接口
3. 在`story-check.md`中更新Skill的说明文档

### 添加新的Skill
1. 在`skills/`目录下新建Markdown文件，按照格式编写
2. 在`.claude-plugin/skills.json`中添加Skill的配置
3. 重启插件即可使用

### 自定义主题和交互风格
修改Skill文件中的提示词内容即可调整交互风格，不需要修改代码。

## 打包发布
### 打包插件包
执行打包脚本：
```bash
./scripts/pack-plugin.sh
```
会在根目录生成`story-muse-vx.x.x.zip`文件，可以直接上传到插件市场。

### 版本升级注意事项
1. 数据库结构变更需要编写迁移脚本，放在`migrations/`目录下
2. 升级逻辑需要保证向下兼容，不能丢失用户数据
3. 升级后需要触发用户数据自动迁移逻辑

## 贡献指南
欢迎提交PR贡献代码，提交前请确保：
1. 代码遵循TypeScript规范，通过ESLint检查
2. 所有新功能都有对应的测试用例
3. 更新相关的文档
4. 提交信息清晰说明修改内容

## 📞 交流
开发者交流群：XXX

Happy coding! 🎉
