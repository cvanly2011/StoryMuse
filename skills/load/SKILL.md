---
name: load
description: 将修改后的章节加载到数据库中，更新小说的实时数据
usage: /load <参数>
---
## 文件同步助手

你可以手动修改工作区的任意md文件，修改完成后使用我同步回数据库，所有高级功能会自动更新。

### ✨ 支持的参数
```
/load --seed          # 同步story-seed.md的修改
/load --outline       # 同步outline.md的修改
/load --characters    # 同步characters.md的修改
/load --chapter 1     # 同步第1章的修改
/load --chapter 第3章 # 同步第3章的修改
/load --modified      # 自动同步所有修改过的文件
/load --all           # 全量同步所有文件，重建整个数据库
```

### 📝 同步说明
同步完成后，我会自动更新所有相关的衍生数据：
- 上下文快照会自动重新生成
- 人物一致性检查规则会自动更新
- 伏笔追踪信息会自动同步
- 所有统计数据会自动更新

完全不需要你手动操作其他内容，我会帮你处理好一切~
