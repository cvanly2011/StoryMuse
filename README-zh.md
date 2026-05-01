# 🎭 StoryMuse - 专为网文作者打造的Claude Code插件

> 你的专属AI写作缪斯，陪伴你把模糊的创意成长为完整的长篇小说。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code 兼容](https://img.shields.io/badge/Claude%20Code-兼容-blue)]()
[![版本](https://img.shields.io/badge/version-1.0.0-green)]()

[English](README.md) | [中文](README-zh.md)

## ✨ 核心功能
### 🎯 7个核心Skill
1. **/story-seed** - 将一句话创意扩展为结构化的故事核心卡片
2. **/story-skeleton** - 生成完整的三幕四段式故事大纲结构
3. **/story-characters** - 深度人物设计和动态关系网络管理
4. **/story-write** - 逐章写作，支持多版本管理和低token上下文
5. **/story-check** - 一致性检查、情节漏洞检测、苏格拉底式引导反馈
6. **/story-map** - 只读的全局故事进度和状态视图
7. **/load** - 将手动修改的文件同步回数据库

### ⚡ 核心优势
- **100%本地存储** - 所有内容都存在你的电脑上，不上传任何内容到云端，绝对隐私
- **低token优化** - 上下文快照严格控制≤2000 token，不传输完整前文内容
- **多平台原生适配** - 支持国内8大主流网文平台的创作规则
- **Git友好** - 一个分支对应一个故事版本，完美支持多结局尝试
- **无需导出** - 章节直接保存为标准Markdown文件，可直接发布到平台
- **百万字级别支持** - 针对长篇小说优化，即使100万字以上也能流畅运行

## 🚀 快速开始
### 安装方式
#### 方式一：插件市场安装（推荐）
1. 打开Claude Code → 设置 → 插件
2. 搜索「StoryMuse」点击安装即可自动完成配置

#### 方式二：手动安装
1. 下载最新版本插件包
2. 打开Claude Code → 设置 → 插件 → 「从本地安装」
3. 选择下载的zip包即可

### 30秒创建你的第一部小说
1. 新建一个空文件夹，用Claude Code打开
2. 运行命令：
   ```
   /create-novel "我的第一部小说" "你的故事核心创意"
   ```
3. 选择目标发布平台
4. 开始创作！

创建完成后，工作区会自动生成以下文件结构：
```
你的项目/
├── .claude/                  # 插件数据目录（自动管理，无需手动修改）
├── .story-muse.config.json   # 项目绑定配置（自动生成）
├── story-seed.md             # 故事核心设定
├── outline.md                # 故事大纲
├── characters.md             # 人物设定
└── chapters/                 # 章节内容目录
    └── 第1章 章节标题.md
```

## 📖 标准创作流程
1. **创意阶段**：使用`/story-seed`梳理你的核心创意
2. **大纲阶段**：使用`/story-skeleton`生成完整的三幕式大纲
3. **人物阶段**：使用`/story-characters`设计人物设定和关系网络
4. **写作阶段**：使用`/story-write`逐章创作
5. **检查阶段**：使用`/story-check`检查内容质量和一致性
6. **全局查看**：随时使用`/story-map`查看创作进度

## 🎯 支持的平台
StoryMuse原生适配国内主流网文平台：
- ✅ 起点中文网
- ✅ 晋江文学城
- ✅ 番茄小说
- ✅ 七猫免费小说
- ✅ 纵横中文网
- ✅ 17K小说网
- ✅ 豆瓣阅读
- ✅ 阅文全平台（QQ阅读、创世、云起）

每个平台的适配包括：
- 内容合规规则和敏感词检测
- 章节长度和结构建议
- 平台特定的节奏和风格指导
- 审核标准预检查

## 🌿 Git分支工作流
完美适配Git版本管理：
1. **多大纲尝试**：创建不同分支尝试不同情节结构
2. **多结局创作**：不同分支写不同结局，自由切换
3. **多平台适配**：不同分支适配不同平台的要求
4. **协同创作**：多个作者在各自分支创作，轻松合并

**注意**：只需要提交Markdown文件到Git，不需要提交`.claude`目录。切换分支后执行`/load --all`即可完全恢复该分支的状态。

## 📊 性能表现
- SQLite WAL模式，读写性能提升10倍
- 100万字级别小说加载 < 100ms
- 上下文快照生成 < 50ms
- 每小时自动备份，保留7个版本

## 🔒 隐私与安全
- 100%的创作内容存储在你的本地设备
- 任何内容都不会上传到外部服务器
- 无遥测、无分析、无数据收集
- 所有数据库文件都是标准SQLite格式，完全可移植

## 🛠️ 开发者指南
想要扩展或修改StoryMuse的开发者：
```bash
git clone https://github.com/your-repo/story-muse.git
cd story-muse/mcp-server
npm install
npm run dev
```
详细文档请查看 [开发者指南](docs/developer-guide.md)。

## 📝 更新日志
版本历史请查看 [CHANGELOG.md](docs/changelog.md)。

## 🤝 贡献
欢迎提交PR贡献代码！

## 📄 许可证
MIT许可证 - 详情请查看 [LICENSE](LICENSE) 文件。

---

### 💡 写作愉快！愿你的故事打动千万读者。 🎉
