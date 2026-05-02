// Mock all dependencies first (jest.mock is hoisted, but let's put them at the top to be clear)
jest.mock('fs');
// Explicitly mock database module to avoid running top-level code
jest.mock('../../database', () => ({
  initDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  closeDatabase: jest.fn(),
  backupDatabase: jest.fn(),
  rebuildDatabase: jest.fn()
}));
jest.mock('../../database/dao/novel.dao', () => ({
  novelDAO: {
    create: jest.fn()
  }
}));
jest.mock('../../services/file-sync.service', () => ({
  fileSyncService: {
    startWatching: jest.fn()
  }
}));

import fs from 'fs';
import path from 'path';
// We will import init.util dynamically in each test to reset module state
import { initDatabase } from '../../database';
import { novelDAO } from '../../database/dao/novel.dao';
import { fileSyncService } from '../../services/file-sync.service';

describe('init.util', () => {
  const mockCwd = '/test/project';
  const configPath = path.join(mockCwd, '.story-muse.config.json');

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    // Reset module state (initialized flag)
    jest.resetModules();
    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    // Mock console.log to avoid noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('should create config file, init database, create novel, and start sync service when no config exists', async () => {
    // Mock fs.existsSync to return false (no config file)
    (fs.existsSync as jest.Mock).mockImplementation((path) => {
      console.error('fs.existsSync called with:', path);
      return false;
    });
    // Mock fs.writeFileSync
    (fs.writeFileSync as jest.Mock).mockImplementation((path, data) => {
      console.error('fs.writeFileSync called with:', path, data);
    });
    // Mock initDatabase to resolve
    (initDatabase as jest.Mock).mockImplementation(() => {
      console.error('initDatabase called');
      return Promise.resolve(undefined);
    });
    // Mock novelDAO.create
    (novelDAO.create as jest.Mock).mockImplementation((data) => {
      console.error('novelDAO.create called with:', data);
    });
    // Mock fileSyncService.startWatching
    (fileSyncService.startWatching as jest.Mock).mockImplementation((cwd, novelId) => {
      console.error('fileSyncService.startWatching called with:', cwd, novelId);
    });

    // Dynamically import init.util to get fresh module state
    const { ensureProjectInitialized } = await import('../../utils/init.util');

    console.error('Calling ensureProjectInitialized...');
    // Call init function
    await ensureProjectInitialized();
    console.error('Call completed.');

    // Verify config file was created with correct content
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({
        novelId: 1,
        novelName: "我的小说",
        description: "正在创作中的小说",
        genre: "其他",
        targetPlatform: "通用",
        wordCountTarget: 200000
      }, null, 2)
    );

    // Verify database was initialized
    expect(initDatabase).toHaveBeenCalled();

    // Verify default novel was created
    expect(novelDAO.create).toHaveBeenCalledWith({
      name: "我的小说",
      description: "正在创作中的小说",
      genre: "其他",
      targetPlatform: "通用",
      wordCountTarget: 200000
    });

    // Verify file sync service was started with novelId 1
    expect(fileSyncService.startWatching).toHaveBeenCalledWith(mockCwd, 1);
  });

  test('should init database and start sync service when config exists', async () => {
    // Mock fs.existsSync to return true (config exists)
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    // Mock fs.readFileSync to return config with novelId 2
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      novelId: 2,
      novelName: "测试小说",
      description: "测试描述",
      genre: "科幻",
      targetPlatform: "起点",
      wordCountTarget: 100000
    }));
    // Mock initDatabase to resolve
    (initDatabase as jest.Mock).mockResolvedValue(undefined);
    // Mock fileSyncService['watcher'] to be undefined (not started)
    Object.defineProperty(fileSyncService, 'watcher', {
      value: undefined,
      writable: true
    });
    // Mock fileSyncService.startWatching
    (fileSyncService.startWatching as jest.Mock).mockImplementation(() => {});

    // Dynamically import init.util to get fresh module state
    const { ensureProjectInitialized } = await import('../../utils/init.util');

    // Call init function
    await ensureProjectInitialized();

    // Verify database was initialized
    expect(initDatabase).toHaveBeenCalled();

    // Verify file sync service was started with novelId 2 from config
    expect(fileSyncService.startWatching).toHaveBeenCalledWith(mockCwd, 2);
  });

  test('should not start sync service if already running when config exists', async () => {
    // Mock fs.existsSync to return true (config exists)
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    // Mock fs.readFileSync to return config with novelId 2
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      novelId: 2,
      novelName: "测试小说",
      description: "测试描述",
      genre: "科幻",
      targetPlatform: "起点",
      wordCountTarget: 100000
    }));
    // Mock initDatabase to resolve
    (initDatabase as jest.Mock).mockResolvedValue(undefined);
    // Mock fileSyncService['watcher'] to exist (already started)
    Object.defineProperty(fileSyncService, 'watcher', {
      value: {},
      writable: true
    });
    // Mock fileSyncService.startWatching
    (fileSyncService.startWatching as jest.Mock).mockImplementation(() => {});

    // Dynamically import init.util to get fresh module state
    const { ensureProjectInitialized } = await import('../../utils/init.util');

    // Call init function
    await ensureProjectInitialized();

    // Verify startWatching was NOT called
    expect(fileSyncService.startWatching).not.toHaveBeenCalled();
  });

  test('should be idempotent: multiple calls should only run initialization once', async () => {
    // Mock fs.existsSync to return false (no config file)
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    // Mock fs.writeFileSync
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    // Mock initDatabase to resolve
    (initDatabase as jest.Mock).mockResolvedValue(undefined);
    // Mock novelDAO.create
    (novelDAO.create as jest.Mock).mockImplementation(() => {});
    // Mock fileSyncService.startWatching
    (fileSyncService.startWatching as jest.Mock).mockImplementation(() => {});

    // Dynamically import init.util to get fresh module state
    const { ensureProjectInitialized } = await import('../../utils/init.util');

    // Call init function 3 times in parallel
    await Promise.all([
      ensureProjectInitialized(),
      ensureProjectInitialized(),
      ensureProjectInitialized()
    ]);

    // Verify all operations were only called once
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(initDatabase).toHaveBeenCalledTimes(1);
    expect(novelDAO.create).toHaveBeenCalledTimes(1);
    expect(fileSyncService.startWatching).toHaveBeenCalledTimes(1);
  });

  test('should reset state and allow retry if initialization fails', async () => {
    // Mock fs.existsSync to return false (no config file)
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    // Mock fs.writeFileSync
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    // Mock initDatabase to reject first time
    (initDatabase as jest.Mock)
      .mockRejectedValueOnce(new Error('Database init failed'))
      .mockResolvedValueOnce(undefined);
    // Mock novelDAO.create
    (novelDAO.create as jest.Mock).mockImplementation(() => {});
    // Mock fileSyncService.startWatching
    (fileSyncService.startWatching as jest.Mock).mockImplementation(() => {});

    // Dynamically import init.util to get fresh module state
    const { ensureProjectInitialized } = await import('../../utils/init.util');

    // First call should fail
    await expect(ensureProjectInitialized()).rejects.toThrow('Database init failed');

    // Second call should succeed
    await ensureProjectInitialized();

    // Verify initDatabase was called twice
    expect(initDatabase).toHaveBeenCalledTimes(2);
    // Verify other operations were called once (after successful init)
    expect(novelDAO.create).toHaveBeenCalledTimes(1);
    expect(fileSyncService.startWatching).toHaveBeenCalledTimes(1);
  });
});
