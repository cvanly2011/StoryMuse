import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { getDBPath, DB_CONFIG, getBackupDir, BACKUP_CONFIG } from '../config/db.config';

// 加载迁移文件，优先使用编译后的dist目录，回退到src目录
// 使用__dirname来定位迁移文件，因为__dirname是当前文件的目录，不受process.cwd()影响
let migrationDir = path.join(__dirname, 'migrations');
if (!fs.existsSync(migrationDir)) {
  // 如果在dist目录下找不到，尝试在src目录下找（开发环境）
  migrationDir = path.join(__dirname, '..', '..', 'src', 'database', 'migrations');
}
console.error(`使用迁移目录: ${migrationDir}`);
console.error(`迁移目录存在: ${fs.existsSync(migrationDir)}`);
if (fs.existsSync(migrationDir)) {
  console.error(`迁移文件: ${fs.readdirSync(migrationDir).join(', ')}`);
}

let db: Database.Database | null = null;

// 确保目录存在
function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 运行所有未应用的迁移
function runMigrations() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
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

  // 获取所有迁移文件，匹配.ts或.js文件
  const migrationFiles = fs
    .readdirSync(migrationDir)
    .filter((file) => file.match(/^\d+-.+\.(ts|js)$/))
    .sort((a, b) => {
      const versionA = parseInt(a.split('-')[0]);
      const versionB = parseInt(b.split('-')[0]);
      return versionA - versionB;
    });

  // 执行未应用的迁移
  for (const file of migrationFiles) {
    const version = parseInt(file.split('-')[0]);
    if (appliedVersions.has(version)) continue;

    const migration = require(path.join(migrationDir, file)).default;
    db!.transaction(() => {
      migration(db);
      db!.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)').run(version, file);
    })();

    console.error(`✅ Applied migration: ${file}`);
  }
}

// 初始化数据库
export async function initDatabase() {
  if (db) return db;

  const DB_PATH = getDBPath();
  const BACKUP_DIR = getBackupDir();

  ensureDirExists(path.dirname(DB_PATH));
  ensureDirExists(BACKUP_DIR);

  // 创建数据库连接并启用WAL模式
  db = new Database(DB_PATH, DB_CONFIG);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -20000'); // 20MB缓存
  db.pragma('foreign_keys = ON'); // 启用外键约束
  db.pragma('temp_store = MEMORY'); // 临时表存储在内存

  // 运行数据库迁移
  runMigrations();

  // 启动自动备份
  if (BACKUP_CONFIG.enabled) {
    startAutoBackup();
  }

  return db;
}

// 获取数据库实例
export function getDb() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

// 关闭数据库连接
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// 手动备份数据库
export function backupDatabase() {
  if (!db) return;

  const BACKUP_DIR = getBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.db`);

  db.backup(backupPath)
    .then(() => {
      console.error(`✅ 数据库备份完成: ${backupPath}`);
      // 清理旧备份
      cleanupOldBackups();
    })
    .catch(err => {
      console.error('❌ 数据库备份失败:', err);
    });
}

// 自动备份
function startAutoBackup() {
  setInterval(() => {
    backupDatabase();
  }, BACKUP_CONFIG.interval);
}

// 清理旧备份
function cleanupOldBackups() {
  const BACKUP_DIR = getBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith('backup-') && file.endsWith('.db'))
    .map(file => ({
      name: file,
      time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length > BACKUP_CONFIG.maxBackups) {
    const filesToDelete = files.slice(BACKUP_CONFIG.maxBackups);
    filesToDelete.forEach(file => {
      fs.unlinkSync(path.join(BACKUP_DIR, file.name));
    });
    console.error(`🧹 清理了 ${filesToDelete.length} 个旧备份`);
  }
}

// 数据库重建
export async function rebuildDatabase() {
  if (db) {
    db.close();
    db = null;
  }

  const DB_PATH = getDBPath();

  // 获取实际的数据库文件路径（处理软链接）
  let actualDbPath = DB_PATH;
  try {
    if (fs.lstatSync(DB_PATH).isSymbolicLink()) {
      actualDbPath = fs.readlinkSync(DB_PATH);
      // 如果是相对路径，转换为绝对路径
      if (!path.isAbsolute(actualDbPath)) {
        actualDbPath = path.join(path.dirname(DB_PATH), actualDbPath);
      }
    }
  } catch (error) {
    // 不是软链接或者不存在，使用默认路径
  }

  // 备份当前数据库
  if (fs.existsSync(actualDbPath)) {
    const backupPath = `${actualDbPath}.rebuild.${Date.now()}.bak`;
    fs.copyFileSync(actualDbPath, backupPath);
    console.error(`💾 重建前备份已保存到: ${backupPath}`);
    fs.unlinkSync(actualDbPath);
  }

  // 如果是软链接，也删除它
  if (fs.existsSync(DB_PATH) && fs.lstatSync(DB_PATH).isSymbolicLink()) {
    fs.unlinkSync(DB_PATH);
  }

  // 重新初始化
  await initDatabase();
  console.error('✅ 数据库重建完成');
}
