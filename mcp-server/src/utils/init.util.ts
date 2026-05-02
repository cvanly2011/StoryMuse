import fs from 'fs';
import path from 'path';
import { initDatabase } from '../database';
import { novelDAO } from '../database/dao/novel.dao';
import { fileSyncService } from '../services/file-sync.service';

// 标记是否已经执行过初始化，避免重复执行
let initialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * 确保项目已初始化，如果没有配置文件则自动创建
 * 这个函数是幂等的，多次调用不会有问题
 */
export async function ensureProjectInitialized() {
  // 如果已经初始化过，直接返回
  if (initialized) {
    return;
  }

  // 如果正在初始化中，等待初始化完成
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const configPath = path.join(process.cwd(), '.story-muse.config.json');

      // 如果配置文件不存在，自动创建
      if (!fs.existsSync(configPath)) {
        console.log("检测到未初始化项目，自动创建配置文件和数据库");

        // 1. 创建默认配置
        const defaultConfig = {
          novelId: 1,
          novelName: "我的小说",
          description: "正在创作中的小说",
          genre: "其他",
          targetPlatform: "通用",
          wordCountTarget: 200000
        };

        // 2. 写入配置文件
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log("配置文件已创建:", configPath);

        // 3. 初始化数据库（会自动创建.claude目录）
        await initDatabase();
        console.log("数据库初始化完成");

        // 4. 创建默认小说记录
        novelDAO.create({
          name: defaultConfig.novelName,
          description: defaultConfig.description,
          genre: defaultConfig.genre,
          targetPlatform: defaultConfig.targetPlatform,
          wordCountTarget: defaultConfig.wordCountTarget
        });
        console.log("默认小说记录已创建");

        // 5. 启动文件同步服务
        fileSyncService.startWatching(process.cwd(), 1);
        console.log("文件同步服务已启动");

        console.log("项目自动初始化完成");
      } else {
        // 如果配置文件存在，确保数据库和文件同步服务已经启动
        try {
          console.log("检测到现有配置文件，正在初始化服务...");
          // 初始化数据库（幂等操作，多次调用没问题）
          await initDatabase();
          console.log("数据库初始化完成");

          // 如果文件同步服务没有启动，启动它
          if (!fileSyncService['watcher']) {
            // 读取配置文件获取novelId
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.novelId) {
              fileSyncService.startWatching(process.cwd(), config.novelId);
              console.log("文件同步服务已启动");
            }
          }
        } catch (error) {
          console.error("初始化服务失败:", error);
          throw error;
        }
      }

      // 标记已初始化
      initialized = true;
    } catch (error) {
      // 初始化失败，重置状态，允许下次重试
      initialized = false;
      initializationPromise = null;
      console.error("项目初始化失败:", error);
      throw error;
    }
  })();

  return initializationPromise;
}
