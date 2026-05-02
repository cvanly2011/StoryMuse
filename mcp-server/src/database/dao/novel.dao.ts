import { BaseDAO } from './base.dao';

export interface Novel {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  genre?: string;
  theme?: string;
  tone?: string;
  targetPlatform?: string;
  targetAudience?: string;
  coreConflict?: string;
  wordCountTarget?: number;
  createdAt: string;
  updatedAt: string;
  settings?: string;
}

class NovelDAO extends BaseDAO<Novel> {
  protected tableName = 'novels';
  protected primaryKey = 'id';

  // 创建小说
  public create(params: Omit<Novel, 'id' | 'createdAt' | 'updatedAt'>): Novel {
    // 生成slug
    const slug = params.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // 映射camelCase到snake_case
    const dbParams: any = {
      name: params.name,
      slug,
      description: params.description,
      genre: params.genre,
      theme: params.theme,
      tone: params.tone,
      target_platform: params.targetPlatform,
      target_audience: params.targetAudience,
      core_conflict: params.coreConflict,
      word_count_target: params.wordCountTarget,
      settings: params.settings,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const id = this.insert(dbParams);

    const novel = this.findById(id);
    if (!novel) throw new Error('创建小说失败');
    return novel;
  }

  // 获取所有小说
  public listAll(): Novel[] {
    return this.findAll(undefined, 'updated_at DESC');
  }

  // 更新小说
  public update(id: number, updates: Partial<Novel>): number {
    // 映射camelCase到snake_case
    const dbUpdates: any = {};
    Object.keys(updates).forEach(key => {
      switch (key) {
        case 'targetPlatform':
          dbUpdates.target_platform = updates[key];
          break;
        case 'targetAudience':
          dbUpdates.target_audience = updates[key];
          break;
        case 'coreConflict':
          dbUpdates.core_conflict = updates[key];
          break;
        case 'wordCountTarget':
          dbUpdates.word_count_target = updates[key];
          break;
        default:
          dbUpdates[key] = updates[key];
      }
    });

    // 添加更新时间
    dbUpdates.updated_at = new Date().toISOString();

    return super.update(id, dbUpdates);
  }

  // 获取小说总字数
  public getTotalWordCount(novelId: number): number {
    const stmt = this.getDb().prepare(`
      SELECT SUM(c.word_count) as total
      FROM "chapters" c
      JOIN "outline_nodes" o ON c.outline_node_id = o.id
      WHERE o.novel_id = ? AND c.is_current = 1
    `);
    const result = stmt.get(novelId) as { total: number | bigint | null };
    return Number(result.total) || 0;
  }

  // 获取小说完成进度
  public getProgress(novelId: number): number {
    const totalStmt = this.getDb().prepare('SELECT COUNT(*) as total FROM "outline_nodes" WHERE novel_id = ? AND level = 3');
    const completedStmt = this.getDb().prepare('SELECT COUNT(*) as completed FROM "outline_nodes" WHERE novel_id = ? AND level = 3 AND status = "completed"');

    const total = Number((totalStmt.get(novelId) as { total: number | bigint }).total);
    const completed = Number((completedStmt.get(novelId) as { completed: number | bigint }).completed);

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }
}

export const novelDAO = new NovelDAO();
