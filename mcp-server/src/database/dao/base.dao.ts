import { getDb } from '../index';
import Database from 'better-sqlite3';

export abstract class BaseDAO<T> {
  protected abstract tableName: string;
  protected abstract primaryKey: string;

  /**
   * 获取数据库实例
   */
  protected getDb(): Database.Database {
    return getDb();
  }

  /**
   * 查询所有记录
   */
  public findAll(where?: Partial<T>, orderBy?: string): T[] {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.keys(where).map(key => {
        params.push((where as any)[key]);
        return `"${key}" = ?`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    return this.getDb().prepare(sql).all(...params) as T[];
  }

  /**
   * 根据主键查询
   */
  public findById(id: number): T | undefined {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    return this.getDb().prepare(sql).get(id) as T | undefined;
  }

  /**
   * 根据条件查询单条记录
   */
  public findOne(where: Partial<T>): T | undefined {
    const conditions = Object.keys(where).map(key => `"${key}" = ?`);
    const params = Object.values(where);
    const sql = `SELECT * FROM ${this.tableName} WHERE ${conditions.join(' AND ')} LIMIT 1`;
    return this.getDb().prepare(sql).get(...params) as T | undefined;
  }

  /**
   * 插入新记录
   */
  public insert(data: Partial<T>): number {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    // 引用所有列名，避免与SQL关键字冲突（如order）
    const quotedKeys = keys.map(key => `"${key}"`).join(', ');
    const sql = `INSERT INTO ${this.tableName} (${quotedKeys}) VALUES (${placeholders})`;

    const result = this.getDb().prepare(sql).run(...values);
    return Number(result.lastInsertRowid);
  }

  /**
   * 更新记录
   */
  public update(id: number, data: Partial<T>): number {
    const sets = Object.keys(data).map(key => `"${key}" = ?`).join(', ');
    const values = [...Object.values(data), id];
    const sql = `UPDATE ${this.tableName} SET ${sets} WHERE "${this.primaryKey}" = ?`;

    const result = this.getDb().prepare(sql).run(...values);
    return result.changes;
  }

  /**
   * 根据条件更新
   */
  public updateBy(where: Partial<T>, data: Partial<T>): number {
    const sets = Object.keys(data).map(key => `"${key}" = ?`).join(', ');
    const conditions = Object.keys(where).map(key => `"${key}" = ?`).join(' AND ');
    const values = [...Object.values(data), ...Object.values(where)];
    const sql = `UPDATE ${this.tableName} SET ${sets} WHERE ${conditions}`;

    const result = this.getDb().prepare(sql).run(...values);
    return result.changes;
  }

  /**
   * 删除记录
   */
  public delete(id: number): number {
    const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    const result = this.getDb().prepare(sql).run(id);
    return result.changes;
  }

  /**
   * 根据条件删除
   */
  public deleteBy(where: Partial<T>): number {
    const conditions = Object.keys(where).map(key => `"${key}" = ?`).join(' AND ');
    const params = Object.values(where);
    const sql = `DELETE FROM ${this.tableName} WHERE ${conditions}`;

    const result = this.getDb().prepare(sql).run(...params);
    return result.changes;
  }

  /**
   * 统计记录数
   */
  public count(where?: Partial<T>): number {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.keys(where).map(key => {
        params.push((where as any)[key]);
        return `${key} = ?`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = this.getDb().prepare(sql).get(...params) as { count: number };
    return result.count;
  }

  /**
   * 执行事务
   */
  public transaction<R>(fn: () => R): R {
    return this.getDb().transaction(fn)();
  }
}
