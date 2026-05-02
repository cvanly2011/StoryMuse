/**
 * 参数验证工具
 */

/**
 * 验证必填参数
 * @param params 参数对象
 * @param requiredFields 必填字段列表
 * @throws 如果有字段缺失则抛出错误
 */
export function validateRequired(params: any, requiredFields: string[]): void {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (params[field] === undefined || params[field] === null) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    const error = new Error(`缺少必填参数: ${missingFields.join(', ')}`);
    (error as any).statusCode = 400;
    (error as any).code = 'MISSING_REQUIRED_FIELDS';
    throw error;
  }
}

/**
 * 验证数字类型参数
 * @param value 要验证的值
 * @param fieldName 字段名
 * @param min 最小值（可选）
 * @param max 最大值（可选）
 */
export function validateNumber(value: any, fieldName: string, min?: number, max?: number): void {
  if (typeof value !== 'number' || isNaN(value)) {
    const error = new Error(`参数 ${fieldName} 必须是数字`);
    (error as any).statusCode = 400;
    (error as any).code = 'INVALID_NUMBER';
    throw error;
  }

  if (min !== undefined && value < min) {
    const error = new Error(`参数 ${fieldName} 不能小于 ${min}`);
    (error as any).statusCode = 400;
    (error as any).code = 'NUMBER_TOO_SMALL';
    throw error;
  }

  if (max !== undefined && value > max) {
    const error = new Error(`参数 ${fieldName} 不能大于 ${max}`);
    (error as any).statusCode = 400;
    (error as any).code = 'NUMBER_TOO_LARGE';
    throw error;
  }
}

/**
 * 验证字符串类型参数
 * @param value 要验证的值
 * @param fieldName 字段名
 * @param minLength 最小长度（可选）
 * @param maxLength 最大长度（可选）
 */
export function validateString(value: any, fieldName: string, minLength?: number, maxLength?: number): void {
  if (typeof value !== 'string') {
    const error = new Error(`参数 ${fieldName} 必须是字符串`);
    (error as any).statusCode = 400;
    (error as any).code = 'INVALID_STRING';
    throw error;
  }

  if (minLength !== undefined && value.length < minLength) {
    const error = new Error(`参数 ${fieldName} 长度不能小于 ${minLength} 个字符`);
    (error as any).statusCode = 400;
    (error as any).code = 'STRING_TOO_SHORT';
    throw error;
  }

  if (maxLength !== undefined && value.length > maxLength) {
    const error = new Error(`参数 ${fieldName} 长度不能大于 ${maxLength} 个字符`);
    (error as any).statusCode = 400;
    (error as any).code = 'STRING_TOO_LONG';
    throw error;
  }
}

/**
 * 验证枚举类型参数
 * @param value 要验证的值
 * @param fieldName 字段名
 * @param allowedValues 允许的值列表
 */
export function validateEnum<T>(value: any, fieldName: string, allowedValues: T[]): void {
  if (!allowedValues.includes(value)) {
    const error = new Error(`参数 ${fieldName} 的值无效，允许的值为: ${allowedValues.join(', ')}`);
    (error as any).statusCode = 400;
    (error as any).code = 'INVALID_ENUM_VALUE';
    throw error;
  }
}

/**
 * 验证布尔类型参数
 * @param value 要验证的值
 * @param fieldName 字段名
 */
export function validateBoolean(value: any, fieldName: string): void {
  if (typeof value !== 'boolean') {
    const error = new Error(`参数 ${fieldName} 必须是布尔值`);
    (error as any).statusCode = 400;
    (error as any).code = 'INVALID_BOOLEAN';
    throw error;
  }
}

/**
 * 验证数组类型参数
 * @param value 要验证的值
 * @param fieldName 字段名
 * @param minLength 最小长度（可选）
 * @param maxLength 最大长度（可选）
 * @param itemValidator 数组项验证函数（可选）
 */
export function validateArray<T>(
  value: any,
  fieldName: string,
  minLength?: number,
  maxLength?: number,
  itemValidator?: (item: any, index: number) => void
): void {
  if (!Array.isArray(value)) {
    const error = new Error(`参数 ${fieldName} 必须是数组`);
    (error as any).statusCode = 400;
    (error as any).code = 'INVALID_ARRAY';
    throw error;
  }

  if (minLength !== undefined && value.length < minLength) {
    const error = new Error(`参数 ${fieldName} 长度不能小于 ${minLength} 项`);
    (error as any).statusCode = 400;
    (error as any).code = 'ARRAY_TOO_SHORT';
    throw error;
  }

  if (maxLength !== undefined && value.length > maxLength) {
    const error = new Error(`参数 ${fieldName} 长度不能大于 ${maxLength} 项`);
    (error as any).statusCode = 400;
    (error as any).code = 'ARRAY_TOO_LONG';
    throw error;
  }

  if (itemValidator) {
    value.forEach((item, index) => {
      try {
        itemValidator(item, index);
      } catch (error: any) {
        error.message = `${fieldName}[${index}]: ${error.message}`;
        throw error;
      }
    });
  }
}
