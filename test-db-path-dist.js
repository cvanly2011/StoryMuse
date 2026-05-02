// 测试数据库路径配置（使用编译后的dist文件）
import { DB_PATH, BACKUP_DIR } from './dist/config/db.config.js';
import { initDatabase } from './dist/database/index.js';
import fs from 'fs';
import path from 'path';

async function testDbPath() {
  console.log('当前工作目录:', process.cwd());
  console.log('数据库路径:', DB_PATH);
  console.log('备份目录:', BACKUP_DIR);

  // 初始化数据库
  const db = await initDatabase();
  console.log('数据库初始化成功');

  // 验证文件是否存在
  console.log('数据库文件是否存在:', fs.existsSync(DB_PATH));
  console.log('备份目录是否存在:', fs.existsSync(BACKUP_DIR));

  // 验证.gitignore文件是否存在
  const claudeDir = path.dirname(DB_PATH);
  const gitignorePath = path.join(claudeDir, '.gitignore');
  console.log('.gitignore是否存在:', fs.existsSync(gitignorePath));
  if (fs.existsSync(gitignorePath)) {
    console.log('.gitignore内容:', fs.readFileSync(gitignorePath, 'utf8'));
  }

  // 关闭数据库
  db.close();
  console.log('测试完成');
}

testDbPath().catch(console.error);