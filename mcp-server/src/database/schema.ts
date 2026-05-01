export const INIT_SQL = `
-- 小说主表
CREATE TABLE IF NOT EXISTS novels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  genre TEXT,
  theme TEXT,
  tone TEXT,
  target_platform TEXT,
  target_audience TEXT,
  core_conflict TEXT,
  word_count_target INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  settings TEXT -- JSON 扩展配置
);

-- 故事种子表
CREATE TABLE IF NOT EXISTS story_seeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  core_idea TEXT NOT NULL,
  world_setting TEXT,
  core_characters_silhouette TEXT,
  selling_points TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(novel_id, version)
);

-- 大纲节点表（严格4级结构：幕→卷→章→节）
CREATE TABLE IF NOT EXISTS outline_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES outline_nodes(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  "order" INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  character_goals TEXT,
  conflict_points TEXT,
  turning_points TEXT,
  foreshadowing_hints TEXT,
  word_count_target INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'writing', 'completed', 'locked')),
  path TEXT NOT NULL, -- 路径冗余，例如 "1/3/5"
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 人物表
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  alias TEXT,
  role TEXT NOT NULL CHECK (role IN ('protagonist', 'antagonist', 'supporting', 'guest', 'npc')),
  appearance TEXT,
  personality TEXT,
  inner_conflict TEXT,
  core_desire TEXT,
  core_fear TEXT,
  character_arc TEXT,
  signature_lines TEXT,
  backstory TEXT,
  first_appearance_chapter_id INTEGER REFERENCES outline_nodes(id),
  final_outcome TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 人物关系表
CREATE TABLE IF NOT EXISTS character_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('binary', 'multiple')),
  character_ids TEXT NOT NULL, -- JSON 数组
  relation_name TEXT NOT NULL,
  description TEXT,
  closeness INTEGER DEFAULT 5 CHECK (closeness BETWEEN 1 AND 10),
  secrecy_level INTEGER DEFAULT 1 CHECK (secrecy_level BETWEEN 1 AND 10),
  conflict_level INTEGER DEFAULT 1 CHECK (conflict_level BETWEEN 1 AND 10),
  plot_importance INTEGER DEFAULT 5 CHECK (plot_importance BETWEEN 1 AND 10),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 关系演变历史表
CREATE TABLE IF NOT EXISTS relation_evolutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  relation_id INTEGER NOT NULL REFERENCES character_relations(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES outline_nodes(id),
  old_relation_state TEXT,
  new_relation_state TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  impact_description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 章节内容表
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outline_node_id INTEGER NOT NULL REFERENCES outline_nodes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL, -- 结构化摘要，200字以内
  key_events TEXT NOT NULL, -- JSON 数组，关键事件
  character_appearances TEXT NOT NULL, -- JSON 数组，出场人物状态变化
  foreshadowing_ids TEXT, -- JSON 数组，本章埋设的伏笔ID
  created_by TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(outline_node_id, version)
);

-- 伏笔表
CREATE TABLE IF NOT EXISTS foreshadowings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  setup_chapter_id INTEGER NOT NULL REFERENCES outline_nodes(id),
  payoff_chapter_id INTEGER REFERENCES outline_nodes(id),
  description TEXT NOT NULL,
  hint_level INTEGER DEFAULT 3 CHECK (hint_level BETWEEN 1 AND 5),
  importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  status TEXT DEFAULT 'setup' CHECK (status IN ('setup', 'paid_off', 'abandoned')),
  payoff_description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 上下文快照表
CREATE TABLE IF NOT EXISTS context_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES outline_nodes(id),
  snapshot_content TEXT NOT NULL, -- JSON 格式，严格控制token≤2000
  snapshot_version INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(novel_id, chapter_id, snapshot_version)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_novels_slug ON novels(slug);
CREATE INDEX IF NOT EXISTS idx_story_seeds_novel_active ON story_seeds(novel_id, is_active);
CREATE INDEX IF NOT EXISTS idx_story_seeds_novel_version ON story_seeds(novel_id, version);
CREATE INDEX IF NOT EXISTS idx_outline_nodes_parent_order ON outline_nodes(novel_id, parent_id, "order");
CREATE INDEX IF NOT EXISTS idx_outline_nodes_level ON outline_nodes(novel_id, level);
CREATE INDEX IF NOT EXISTS idx_characters_novel_name ON characters(novel_id, name);
CREATE INDEX IF NOT EXISTS idx_characters_novel_role ON characters(novel_id, role);
CREATE INDEX IF NOT EXISTS idx_character_relations_novel ON character_relations(novel_id);
CREATE INDEX IF NOT EXISTS idx_relation_evolutions_relation_chapter ON relation_evolutions(relation_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_relation_evolutions_chapter ON relation_evolutions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapters_node_current ON chapters(outline_node_id, is_current);
CREATE INDEX IF NOT EXISTS idx_chapters_node_version ON chapters(outline_node_id, version);
CREATE INDEX IF NOT EXISTS idx_foreshadowings_novel_status ON foreshadowings(novel_id, status);
CREATE INDEX IF NOT EXISTS idx_foreshadowings_setup_chapter ON foreshadowings(setup_chapter_id);
CREATE INDEX IF NOT EXISTS idx_foreshadowings_payoff_chapter ON foreshadowings(payoff_chapter_id);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_novel_chapter_version ON context_snapshots(novel_id, chapter_id, snapshot_version);

-- 启用WAL模式
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -20000;
PRAGMA foreign_keys = ON;
`;
