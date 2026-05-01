import { BaseDAO } from './base.dao';

export interface OutlineNode {
  id: number;
  novel_id: number;
  parent_id?: number;
  level: number;
  order: number;
  title: string;
  description?: string;
  character_goals?: string;
  conflict_points?: string;
  turning_points?: string;
  foreshadowing_hints?: string;
  word_count_target?: number;
  status: 'pending' | 'writing' | 'completed' | 'locked';
  path: string;
  created_at: string;
  updated_at: string;
}

class OutlineNodeDAO extends BaseDAO<OutlineNode> {
  protected tableName = 'outline_nodes';
  protected primaryKey = 'id';

  // 获取小说的完整大纲树
  public findTreeByNovelId(novelId: number): OutlineNode[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE novel_id = ? ORDER BY level, "order"`;
    return this.getDb().prepare(sql).all(novelId) as OutlineNode[];
  }

  // 获取指定节点的子节点
  public findChildrenByParentId(parentId: number): OutlineNode[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE parent_id = ? ORDER BY "order"`;
    return this.getDb().prepare(sql).all(parentId) as OutlineNode[];
  }

  // 获取指定层级的所有节点
  public findByLevel(novelId: number, level: number): OutlineNode[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE novel_id = ? AND level = ? ORDER BY "order"`;
    return this.getDb().prepare(sql).all(novelId, level) as OutlineNode[];
  }

  // 获取指定节点的路径上的所有节点
  public findPathById(nodeId: number): OutlineNode[] {
    const node = this.findById(nodeId);
    if (!node) return [];

    const pathIds = node.path.split('/').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (pathIds.length === 0) return [node];

    const placeholders = pathIds.map(() => '?').join(', ');
    const sql = `SELECT * FROM ${this.tableName} WHERE id IN (${placeholders}) ORDER BY level`;
    return this.getDb().prepare(sql).all(...pathIds) as OutlineNode[];
  }

  // 获取下一个可用的排序号
  public getNextOrder(novelId: number, parentId?: number): number {
    let sql = `SELECT MAX("order") as max_order FROM ${this.tableName} WHERE novel_id = ?`;
    const params: any[] = [novelId];

    if (parentId !== undefined) {
      sql += ` AND parent_id = ?`;
      params.push(parentId);
    } else {
      sql += ` AND parent_id IS NULL`;
    }

    const result = this.getDb().prepare(sql).get(...params) as { max_order: number | null };
    return (result.max_order || 0) + 1;
  }

  // 更新节点的更新时间
  public updateUpdatedAt(id: number): number {
    return this.update(id, { updated_at: new Date().toISOString() } as Partial<OutlineNode>);
  }
}

export const outlineNodeDAO = new OutlineNodeDAO();
