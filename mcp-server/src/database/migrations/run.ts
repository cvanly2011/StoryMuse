import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getDBPath } from '../../config/db.config';

// 获取数据库路径
const DB_PATH = getDBPath();

// 确保数据库目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 连接数据库
const db = new Database(DB_PATH);

// 初始化迁移表
db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 获取已应用的迁移版本
const appliedVersions = new Set(
  db
    .prepare('SELECT version FROM migrations ORDER BY version')
    .all()
    .map((row: any) => row.version)
);

// 获取所有迁移文件
const migrationDir = __dirname;
const migrationFiles = fs
  .readdirSync(migrationDir)
  .filter((file) => file.match(/^\d+-.+\.ts$/))
  .sort((a, b) => {
    const versionA = parseInt(a.split('-')[0]);
    const versionB = parseInt(b.split('-')[0]);
    return versionA - versionB;
  });

// 执行未应用的迁移
for (const file of migrationFiles) {
  const version = parseInt(file.split('-')[0]);
  if (appliedVersions.has(version)) continue;

  console.log(`Applying migration: ${file}`);
  const migration = require(path.join(migrationDir, file)).default;

  db.transaction(() => {
    migration(db);
    db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)').run(version, file);
  })();

  console.log(`✅ Migration ${file} applied successfully`);
}

console.log('All migrations completed successfully');
db.close();
