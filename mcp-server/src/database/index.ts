import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { DB_PATH, DB_CONFIG, BACKUP_DIR, BACKUP_CONFIG } from '../config/db.config';
import { INIT_SQL } from './schema';

let db: Database.Database | null = null;

// 确保目录存在
function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 初始化数据库
export async function initDatabase() {
  if (db) return db;

  ensureDirExists(path.dirname(DB_PATH));
  ensureDirExists(BACKUP_DIR);

  // 创建数据库连接
  db = new Database(DB_PATH, DB_CONFIG);

  // 执行初始化SQL
  db.exec(INIT_SQL);

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

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.db`);

  db.backup(backupPath)
    .then(() => {
      console.log(`✅ 数据库备份完成: ${backupPath}`);
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
    console.log(`🧹 清理了 ${filesToDelete.length} 个旧备份`);
  }
}

// 数据库重建
export async function rebuildDatabase() {
  if (db) {
    db.close();
    db = null;
  }

  // 备份当前数据库
  if (fs.existsSync(DB_PATH)) {
    const backupPath = `${DB_PATH}.rebuild.${Date.now()}.bak`;
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`💾 重建前备份已保存到: ${backupPath}`);
    fs.unlinkSync(DB_PATH);
  }

  // 重新初始化
  await initDatabase();
  console.log('✅ 数据库重建完成');
}
