import path from 'path';
import os from 'os';

// 获取当前工作目录
const WORKSPACE_DIR = process.cwd();

// 数据库文件路径
export const DB_PATH = path.join(WORKSPACE_DIR, '.claude', 'story-muse.db');

// 备份目录
export const BACKUP_DIR = path.join(WORKSPACE_DIR, '.claude', 'backup');

// WAL模式配置
export const DB_CONFIG = {
  readonly: false,
  fileMustExist: false,
  timeout: 5000,
  verbose: undefined
};

// 自动备份配置
export const BACKUP_CONFIG = {
  enabled: true,
  interval: 3600000, // 1小时自动备份一次
  maxBackups: 7, // 保留最近7个备份
};
