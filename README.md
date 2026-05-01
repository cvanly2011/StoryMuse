# 🎭 StoryMuse - Claude Code Plugin for Novel Writers

> Your AI writing muse, turning vague ideas into full-length novels.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code Compatible](https://img.shields.io/badge/Claude%20Code-Compatible-blue)]()
[![Version](https://img.shields.io/badge/version-1.0.0-green)]()

[English](README.md) | [中文](README-zh.md)

## ✨ Core Features
### 🎯 7 Core Skills
1. **/story-seed** - Expand a one-sentence idea into a structured story core card
2. **/story-skeleton** - Generate a complete 3-act 4-level story outline structure
3. **/story-characters** - Deep character design and dynamic relationship network management
4. **/story-write** - Chapter-by-chapter writing with multi-version support and low-token context
5. **/story-check** - Consistency check, plot hole detection, and Socratic guiding feedback
6. **/story-map** - Read-only global view of your story progress and state
7. **/load** - Sync manual file modifications back to the database

### ⚡ Key Advantages
- **100% Local Storage** - All your content stays on your computer, no cloud uploads, absolute privacy
- **Low Token Optimization** - Context snapshots strictly controlled ≤ 2000 tokens, no full text transmission
- **Multi-Platform Support** - Native adaptation for 8 major Chinese web novel platforms
- **Git Friendly** - One branch corresponds to one story version, perfect for multi-ending experiments
- **No Export Needed** - Chapters are saved as standard Markdown files, ready to publish directly
- **Million-Word Support** - Optimized for long-form novels, smooth performance even with 1M+ words

## 🚀 Quick Start
### Installation
1. Open Claude Code → Settings → Plugins
2. Search for "StoryMuse" and install with one click
3. Or download the plugin package and install manually

### 30 Seconds to Start Your First Novel
1. Create a new empty folder and open it with Claude Code
2. Run: 
   ```
   /create-novel "My First Novel" "Core idea of your story"
   ```
3. Choose your target publishing platform
4. Start writing!

The following files will be automatically generated in your workspace:
```
your-project/
├── .claude/                  # Plugin data directory (auto-managed)
├── .story-muse.config.json   # Project binding config (auto-generated)
├── story-seed.md             # Story core setting
├── outline.md                # Story outline
├── characters.md             # Character design
└── chapters/                 # Chapter content directory
    └── Chapter 1 Title.md
```

## 📖 Standard Workflow
1. **Idea Phase**: Use `/story-seed` to refine your core idea
2. **Outline Phase**: Use `/story-skeleton` to generate a complete 3-act outline
3. **Character Phase**: Use `/story-characters` to design characters and relationships
4. **Writing Phase**: Use `/story-write` to write chapter by chapter
5. **Review Phase**: Use `/story-check` to check quality and consistency
6. **Global View**: Use `/story-map` anytime to see your progress

## 🎯 Supported Platforms
StoryMuse natively adapts to major Chinese web novel platforms:
- ✅ Qidian (起点中文网)
- ✅ Jinjiang (晋江文学城)
- ✅ Tomato Novel (番茄小说)
- ✅ Qimao Novel (七猫免费小说)
- ✅ Zongheng (纵横中文网)
- ✅ 17K Novel (17K小说网)
- ✅ Douban Read (豆瓣阅读)
- ✅ Yuewen Full Platform (阅文全平台)

Each platform includes:
- Content compliance rules and sensitive word detection
- Chapter length and structure recommendations
- Platform-specific rhythm and style guidance
- Review standard pre-checking

## 🌿 Git Branch Workflow
Perfect for Git-based version management:
1. **Different Outlines**: Create branches to try different plot structures
2. **Multiple Endings**: Write different endings in separate branches
3. **Platform Adaptation**: Separate branches for different platform requirements
4. **Collaboration**: Multiple writers work on their own branches, merge easily

**Note**: You only need to commit the Markdown files to Git, no need to commit the `.claude` directory. Switch branches and run `/load --all` to fully restore the state.

## 📊 Performance
- SQLite with WAL mode, 10x faster read/write performance
- 1M+ word novel loading < 100ms
- Context snapshot generation < 50ms
- Auto backup every hour, 7 versions retention

## 🔒 Privacy & Security
- 100% of your creative content stored locally on your device
- No content ever uploaded to any external server
- No telemetry, no analytics, no data collection
- All database files are standard SQLite format, fully portable

## 🛠️ Development
For developers who want to extend or modify StoryMuse:
```bash
git clone https://github.com/your-repo/story-muse.git
cd story-muse/mcp-server
npm install
npm run dev
```
See [Developer Guide](docs/developer-guide.md) for detailed documentation.

## 📝 Changelog
See [CHANGELOG.md](docs/changelog.md) for version history.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
MIT License - see [LICENSE](LICENSE) file for details.

---

### 💡 Happy Writing! May your story touch millions of hearts. 🎉
