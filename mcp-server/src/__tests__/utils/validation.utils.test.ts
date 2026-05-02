import {
  validateRequired,
  validateNumber,
  validateString,
  validateEnum,
  validateBoolean,
  validateArray
} from '../../utils/validation.utils';

describe('validation.utils', () => {
  describe('validateRequired', () => {
    test('should not throw when all required fields are present', () => {
      const params = { name: 'test', age: 25 };
      expect(() => validateRequired(params, ['name', 'age'])).not.toThrow();
    });

    test('should throw when required fields are missing', () => {
      const params = { name: 'test' };
      expect(() => validateRequired(params, ['name', 'age'])).toThrow('缺少必填参数: age');
      expect(() => validateRequired(params, ['name', 'age'])).toThrow(expect.objectContaining({
        statusCode: 400,
        code: 'MISSING_REQUIRED_FIELDS'
      }));
    });

    test('should throw when fields are null', () => {
      const params = { name: null, age: 25 };
      expect(() => validateRequired(params, ['name', 'age'])).toThrow('缺少必填参数: name');
    });

    test('should throw when multiple fields are missing', () => {
      const params = {};
      expect(() => validateRequired(params, ['name', 'age', 'email'])).toThrow('缺少必填参数: name, age, email');
    });
  });

  describe('validateNumber', () => {
    test('should not throw when value is a valid number', () => {
      expect(() => validateNumber(25, 'age')).not.toThrow();
      expect(() => validateNumber(0, 'age')).not.toThrow();
      expect(() => validateNumber(-10, 'age')).not.toThrow();
    });

    test('should throw when value is not a number', () => {
      expect(() => validateNumber('25', 'age')).toThrow('参数 age 必须是数字');
      expect(() => validateNumber(NaN, 'age')).toThrow('参数 age 必须是数字');
      expect(() => validateNumber(null, 'age')).toThrow('参数 age 必须是数字');
      expect(() => validateNumber(undefined, 'age')).toThrow('参数 age 必须是数字');
    });

    test('should throw when value is less than min', () => {
      expect(() => validateNumber(15, 'age', 18)).toThrow('参数 age 不能小于 18');
      expect(() => validateNumber(15, 'age', 18)).toThrow(expect.objectContaining({
        statusCode: 400,
        code: 'NUMBER_TOO_SMALL'
      }));
    });

    test('should throw when value is greater than max', () => {
      expect(() => validateNumber(100, 'age', undefined, 99)).toThrow('参数 age 不能大于 99');
      expect(() => validateNumber(100, 'age', undefined, 99)).toThrow(expect.objectContaining({
        statusCode: 400,
        code: 'NUMBER_TOO_LARGE'
      }));
    });

    test('should not throw when value is within min and max range', () => {
      expect(() => validateNumber(25, 'age', 18, 99)).not.toThrow();
      expect(() => validateNumber(18, 'age', 18, 99)).not.toThrow();
      expect(() => validateNumber(99, 'age', 18, 99)).not.toThrow();
    });
  });

  describe('validateString', () => {
    test('should not throw when value is a valid string', () => {
      expect(() => validateString('test', 'name')).not.toThrow();
      expect(() => validateString('', 'name')).not.toThrow();
    });

    test('should throw when value is not a string', () => {
      expect(() => validateString(25, 'name')).toThrow('参数 name 必须是字符串');
      expect(() => validateString(null, 'name')).toThrow('参数 name 必须是字符串');
      expect(() => validateString(undefined, 'name')).toThrow('参数 name 必须是字符串');
      expect(() => validateString({}, 'name')).toThrow('参数 name 必须是字符串');
    });

    test('should throw when string is shorter than minLength', () => {
      expect(() => validateString('ab', 'name', 3)).toThrow('参数 name 长度不能小于 3 个字符');
      expect(() => validateString('ab', 'name', 3)).toThrow(expect.objectContaining({
        statusCode: 400,
        code: 'STRING_TOO_SHORT'
      }));
    });

    test('should throw when string is longer than maxLength', () => {
      expect(() => validateString('abcde', 'name', undefined, 4)).toThrow('参数 name 长度不能大于 4 个字符');
      expect(() => validateString('abcde', 'name', undefined, 4)).toThrow(expect.objectContaining({
        statusCode: 400,
        code: 'STRING_TOO_LONG'
      }));
    });

    test('should not throw when string length is within range', () => {
      expect(() => validateString('abcd', 'name', 2, 5)).not.toThrow();
      expect(() => validateString('ab', 'name', 2, 5)).not.toThrow();
      expect(() => validateString('abcde', 'name', 2, 5)).not.toThrow();
    });
  });

  describe('validateEnum', () => {
    test('should not throw when value is in allowed values', () => {
      const allowedValues = ['admin', 'user', 'guest'];
      expect(() => validateEnum('user', 'role', allowedValues)).not.toThrow();
      expect(() => validateEnum('admin', 'role', allowedValues)).not.toThrow();
      expect(() => validateEnum('guest', 'role', allowedValues)).not.toThrow();
    });

    test('should throw when value is not in allowed values', () => {
      const allowedValues = ['admin', 'user', 'guest'];
      expect(() => validateEnum('superadmin', 'role', allowedValues)).toThrow('参数 role 的值无效，允许的值为: admin, user, guest');
      expect(() => validateEnum('superadmin', 'role', allowedValues)).toThrow(expect.objectContaining({
        statusCode: 400,
        code: 'INVALID_ENUM_VALUE'
      }));
    });

    test('should work with numeric enums', () => {
      const allowedValues = [1, 2, 3];
      expect(() => validateEnum(2, 'status', allowedValues)).not.toThrow();
      expect(() => validateEnum(4, 'status', allowedValues)).toThrow('参数 status 的值无效，允许的值为: 1, 2, 3');
    });
  });

  describe('validateBoolean', () => {
    test('should not throw when value is a boolean', () => {
      expect(() => validateBoolean(true, 'active')).not.toThrow();
      expect(() => validateBoolean(false, 'active')).not.toThrow();
    });

    test('should throw when value is not a boolean', () => {
      expect(() => validateBoolean('true', 'active')).toThrow('参数 active 必须是布尔值');
      expect(() => validateBoolean(1, 'active')).toThrow('参数 active 必须是布尔值');
      expect(() => validateBoolean(null, 'active')).toThrow('参数 active 必须是布尔值');
      expect(() => validateBoolean(undefined, 'active')).toThrow('参数 active 必须是布尔值');
    });
  });

  describe('validateArray', () => {
    test('should not throw when value is a valid array', () => {
      expect(() => validateArray([1, 2, 3], 'ids')).not.toThrow();
      expect(() => validateArray([], 'ids')).not.toThrow();
    });

    test('should throw when value is not an array', () => {
      expect(() => validateArray('1,2,3', 'ids')).toThrow('参数 ids 必须是数组');
      expect(() => validateArray({}, 'ids')).toThrow('参数 ids 必须是数组');
      expect(() => validateArray(null, 'ids')).toThrow('参数 ids 必须是数组');
    });

    test('should throw when array is shorter than minLength', () => {
      expect(() => validateArray([1, 2], 'ids', 3)).toThrow('参数 ids 长度不能小于 3 项');
      expect(() => validateArray([1, 2], 'ids', 3)).toThrow(expect.objectContaining({
        statusCode: 400,
        code: 'ARRAY_TOO_SHORT'
      }));
    });

    test('should throw when array is longer than maxLength', () => {
      expect(() => validateArray([1, 2, 3, 4], 'ids', undefined, 3)).toThrow('参数 ids 长度不能大于 3 项');
      expect(() => validateArray([1, 2, 3, 4], 'ids', undefined, 3)).toThrow(expect.objectContaining({
        statusCode: 400,
        code: 'ARRAY_TOO_LONG'
      }));
    });

    test('should not throw when array length is within range', () => {
      expect(() => validateArray([1, 2, 3], 'ids', 2, 4)).not.toThrow();
      expect(() => validateArray([1, 2], 'ids', 2, 4)).not.toThrow();
      expect(() => validateArray([1, 2, 3, 4], 'ids', 2, 4)).not.toThrow();
    });

    test('should validate array items with itemValidator', () => {
      const itemValidator = (item: any) => validateNumber(item, 'id');
      expect(() => validateArray([1, 2, 3], 'ids', undefined, undefined, itemValidator)).not.toThrow();

      expect(() => validateArray([1, '2', 3], 'ids', undefined, undefined, itemValidator)).toThrow('ids[1]: 参数 id 必须是数字');
    });

    test('should pass index to itemValidator', () => {
      const itemValidator = jest.fn();
      validateArray([1, 2, 3], 'ids', undefined, undefined, itemValidator);

      expect(itemValidator).toHaveBeenCalledTimes(3);
      expect(itemValidator).toHaveBeenNthCalledWith(1, 1, 0);
      expect(itemValidator).toHaveBeenNthCalledWith(2, 2, 1);
      expect(itemValidator).toHaveBeenNthCalledWith(3, 3, 2);
    });
  });
});
