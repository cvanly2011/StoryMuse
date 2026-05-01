import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';

// 监听工作区的文件变化
export function initFileWatcher() {
  const watchPaths = [
    path.join(process.cwd(), 'story-seed.md'),
    path.join(process.cwd(), 'outline.md'),
    path.join(process.cwd(), 'characters.md'),
    path.join(process.cwd(), 'chapters/**/*.md')
  ];

  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    persistent: true
  });

  // 监听文件变化
  watcher
    .on('change', (filePath) => {
      console.log(`文件被修改: ${path.relative(process.cwd(), filePath)}`);
      // 这里可以实现自动提示用户加载更新的逻辑
    })
    .on('add', (filePath) => {
      console.log(`文件被添加: ${path.relative(process.cwd(), filePath)}`);
    })
    .on('unlink', (filePath) => {
      console.log(`文件被删除: ${path.relative(process.cwd(), filePath)}`);
    });

  console.log('文件监听器已启动，正在监听工作区变化');

  return watcher;
}

// 检测修改的文件
export async function detectModifiedFiles() {
  // 这里可以实现更复杂的修改检测逻辑，比较文件的最后修改时间和数据库中的记录
  // 简化实现，暂时返回空列表
  return [];
}
