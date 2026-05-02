import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * 统一错误格式
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  errorCode?: string;
  details?: any;
  requestId?: string;
}

/**
 * 统一错误处理中间件
 */
export async function errorHandler(
  error: any,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ApiErrorResponse> {
  // 记录错误日志
  console.error(`[${new Date().toISOString()}] 请求错误 ${request.method} ${request.url}:`, error);

  // 处理验证错误（Fastify内置验证）
  if (error.statusCode === 400 && error.validation) {
    return reply.status(400).send({
      success: false,
      message: '请求参数验证失败',
      errorCode: 'VALIDATION_ERROR',
      details: error.validation
    });
  }

  // 处理权限错误
  if (error.statusCode === 403) {
    return reply.status(403).send({
      success: false,
      message: '权限不足，无法执行此操作',
      errorCode: 'PERMISSION_DENIED'
    });
  }

  // 处理资源不存在错误
  if (error.statusCode === 404) {
    return reply.status(404).send({
      success: false,
      message: '请求的资源不存在',
      errorCode: 'NOT_FOUND'
    });
  }

  // 处理冲突错误
  if (error.statusCode === 409) {
    return reply.status(409).send({
      success: false,
      message: '资源冲突',
      errorCode: 'CONFLICT'
    });
  }

  // 默认500错误
  const statusCode = error.statusCode || 500;
  return reply.status(statusCode).send({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? '服务器内部错误，请稍后重试'
      : error.message || '服务器内部错误',
    errorCode: error.code || 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
}
