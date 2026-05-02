import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

/**
 * 将对象的snake_case键转换为camelCase
 */
function snakeToCamel(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => snakeToCamel(item));
  }

  const camelCaseObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelCaseObj[camelCaseKey] = snakeToCamel(obj[key]);
    }
  }

  return camelCaseObj;
}

/**
 * 响应转换中间件：将所有响应中的snake_case自动转换为camelCase
 */
export function responseTransformHook(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: any,
  done: HookHandlerDoneFunction
) {
  if (payload && typeof payload === 'object' && !Buffer.isBuffer(payload)) {
    try {
      const transformed = snakeToCamel(payload);
      reply.send(transformed);
      return done();
    } catch (error) {
      return done(error as Error);
    }
  }
  done();
}
