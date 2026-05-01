import { getDb } from '../index';

export interface OutlineNode {
  id: number;
  novelId: number;
  parentId?: number;
  level: number;
  order: number;
  title: string;
  description?: string;
  characterGoals?: string;
  conflictPoints?: string;
  turningPoints?: string;
  foreshadowingHints?: string;
  wordCountTarget?: number;
  status: 'pending' | 'writing' | 'completed' | 'locked';
  path: string;
  createdAt: string;
  updatedAt: string;
}

// 创建大纲节点
export function createOutlineNode(params: Omit<OutlineNode, 'id' | 'createdAt' | 'updatedAt' | 'path'>) {
  const db = getDb();

  // 生成路径
  let path = '';
  if (params.parentId) {
    const parentStmt = db.prepare('SELECT path FROM outline_nodes WHERE id = ?');
    const parent = parentStmt.get(params.parentId) as OutlineNode | undefined;
    if (parent) {
      path = `${parent.path}/${params.order}`;
    }
  } else {
    path = `${params.order}`;
  }

  const stmt = db.prepare(`
    INSERT INTO outline_nodes (novel_id, parent_id, level, "order", title, description, character_goals, conflict_points, turning_points, foreshadowing_hints, word_count_target, status, path)
    VALUES (@novelId, @parentId, @level, @order, @title, @description, @characterGoals, @conflictPoints, @turningPoints, @foreshadowingHints, @wordCountTarget, @status, @path)
    RETURNING *
  `);

  const result = stmt.get({ ...params, path }) as OutlineNode;
  return result;
}

// 更新大纲节点
export function updateOutlineNode(id: number, updates: Partial<OutlineNode>) {
  const db = getDb();
  const fields = Object.keys(updates)
    .map(key => {
      const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      return `${dbKey} = @${key}`;
    })
    .join(', ');

  const stmt = db.prepare(`
    UPDATE outline_nodes
    SET ${fields}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
    RETURNING *
  `);

  return stmt.get({ ...updates, id }) as OutlineNode;
}

// 移动大纲节点
export function moveOutlineNode(id: number, newParentId?: number, newOrder?: number) {
  const db = getDb();

  // 先获取当前节点
  const currentNode = getOutlineNodeById(id);
  if (!currentNode) throw new Error('节点不存在');

  // 更新父节点和排序
  const updateStmt = db.prepare(`
    UPDATE outline_nodes
    SET parent_id = ?, "order" = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  updateStmt.run(newParentId || null, newOrder || currentNode.order, id);

  // 重新生成路径（需要递归更新所有子节点，简化处理）
  // 这里可以实现更复杂的路径更新逻辑，暂时省略
}

// 根据ID获取节点
export function getOutlineNodeById(id: number) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM outline_nodes WHERE id = ?');
  return stmt.get(id) as OutlineNode | undefined;
}

// 获取小说的大纲树
export function getOutlineTree(novelId: number, maxLevel?: number) {
  const db = getDb();
  let sql = 'SELECT * FROM outline_nodes WHERE novel_id = ?';
  if (maxLevel) {
    sql += ` AND level <= ${maxLevel}`;
  }
  sql += ' ORDER BY level, "order"';

  const stmt = db.prepare(sql);
  const nodes = stmt.all(novelId) as OutlineNode[];

  // 构建树形结构
  const nodeMap = new Map<number, OutlineNode & { children?: OutlineNode[] }>();
  const rootNodes: (OutlineNode & { children?: OutlineNode[] })[] = [];

  nodes.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  nodes.forEach(node => {
    const nodeWithChildren = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId)!;
      if (!parent.children) parent.children = [];
      parent.children.push(nodeWithChildren);
    } else {
      rootNodes.push(nodeWithChildren);
    }
  });

  return rootNodes;
}

// 获取受影响的后续章节（当修改节点时）
export function getImpactedChapterIds(nodeId: number) {
  const db = getDb();
  const node = getOutlineNodeById(nodeId);
  if (!node) return [];

  // 获取该节点路径下的所有章节（level=3）
  const stmt = db.prepare(`
    SELECT id FROM outline_nodes
    WHERE path LIKE ? AND level = 3
  `);
  const result = stmt.all(`${node.path}%`) as { id: number }[];
  return result.map(item => item.id);
}
