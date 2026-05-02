import { countTokens, exceedsTokenLimit, truncateToTokenLimit } from '../../utils/token.utils';

describe('token.utils', () => {
  describe('countTokens', () => {
    test('should return 0 for empty text', () => {
      expect(countTokens('')).toBe(0);
      expect(countTokens(null as any)).toBe(0);
      expect(countTokens(undefined as any)).toBe(0);
    });

    test('should calculate tokens for English text correctly', () => {
      // 4 characters = 1 token
      expect(countTokens('test')).toBe(1); // 4 chars
      expect(countTokens('hello')).toBe(2); // 5 chars → ceil(5/4) = 2
      expect(countTokens('hello world')).toBe(3); // 11 chars → ceil(11/4) = 3
      expect(countTokens('The quick brown fox jumps over the lazy dog')).toBe(11); // 43 chars → ceil(43/4) = 11
    });

    test('should calculate tokens for Chinese text correctly', () => {
      // 1.3 characters = 1 token
      expect(countTokens('你好')).toBe(2); // 2 chars → ceil(2/1.3) = 2
      expect(countTokens('你好世界')).toBe(4); // 4 chars → ceil(4/1.3) = 4
      expect(countTokens('这是一个测试文本')).toBe(7); // 8 chars → ceil(8/1.3) = 7
    });

    test('should calculate tokens for mixed Chinese and English text correctly', () => {
      // 中文：你好世界 (4 chars → 4 tokens)
      // 英文：hello world (11 chars → 3 tokens)
      expect(countTokens('你好世界 hello world')).toBe(7);

      // 中文：测试 (2 chars → 2 tokens)
      // 英文：test (4 chars → 1 token)
      expect(countTokens('测试test')).toBe(3);
    });

    test('should handle punctuation correctly', () => {
      expect(countTokens('Hello, World!')).toBe(4); // 13 chars → ceil(13/4) = 4
      // 4 Chinese chars + 2 punctuation:
      // Chinese chars: 4 → ceil(4/1.3) = 4
      // Remaining chars: 2 (，！) → ceil(2/4) = 1
      // Total: 5
      expect(countTokens('你好，世界！')).toBe(5);
    });
  });

  describe('exceedsTokenLimit', () => {
    test('should return false when text is within token limit', () => {
      const text = 'a'.repeat(4 * 10); // 40 chars → 10 tokens
      expect(exceedsTokenLimit(text, 10)).toBe(false);
      expect(exceedsTokenLimit(text, 11)).toBe(false);
    });

    test('should return true when text exceeds token limit', () => {
      const text = 'a'.repeat(4 * 10 + 1); // 41 chars → 11 tokens
      expect(exceedsTokenLimit(text, 10)).toBe(true);
      expect(exceedsTokenLimit(text, 11)).toBe(false);
    });

    test('should use default maxTokens of 2000 when not provided', () => {
      const text = 'a'.repeat(4 * 2000); // 8000 chars → 2000 tokens
      expect(exceedsTokenLimit(text)).toBe(false);

      const longText = 'a'.repeat(4 * 2000 + 1); // 8001 chars → 2001 tokens
      expect(exceedsTokenLimit(longText)).toBe(true);
    });
  });

  describe('truncateToTokenLimit', () => {
    test('should return original text when within token limit', () => {
      const text = 'Hello, World!';
      expect(truncateToTokenLimit(text, 100)).toBe(text);
    });

    test('should return empty string for empty input', () => {
      expect(truncateToTokenLimit('', 100)).toBe('');
      expect(truncateToTokenLimit(null as any, 100)).toBe('');
    });

    test('should truncate text that exceeds token limit', () => {
      // Create text with 10 tokens: 4 * 10 = 40 chars
      const text = 'a'.repeat(4 * 10);
      // Truncate to 5 tokens → should get ~20 chars + '...'
      const truncated = truncateToTokenLimit(text, 5);
      expect(truncated.endsWith('...')).toBe(true);
      expect(countTokens(truncated.slice(0, -3))).toBeLessThanOrEqual(5);
    });

    test('should truncate to nearest complete sentence when possible', () => {
      // Text with a sentence end that is >80% of the truncated length
      // 31 A's + 。 + 10 B's → total 42 chars
      const text = 'A'.repeat(31) + '。' + 'B'.repeat(10);
      // Truncate to 9 tokens:
      // Max length is 36 chars (36/4=9 tokens): 'A'*31 + '。' + 'B'*4 → length 36
      // Last sentence end is at 31 (the 。), which is > 36 * 0.8 = 28.8 → should truncate to sentence end
      const truncated = truncateToTokenLimit(text, 9);
      expect(truncated).toBe('A'.repeat(31) + '。...');
    });

    test('should not truncate to less than 80% of best length when finding sentence end', () => {
      // Text with a sentence end early in the string
      const text = '你好。' + 'a'.repeat(100); // 2 Chinese chars + 。 + 100 a's
      const truncated = truncateToTokenLimit(text, 10);
      // Should not truncate just at "你好。" because that's way less than 80% of the best length
      expect(truncated.length).toBeGreaterThan('你好。...'.length);
    });

    test('should use default maxTokens of 2000 when not provided', () => {
      const text = 'a'.repeat(4 * 2000 + 100); // 8100 chars → 2025 tokens
      const truncated = truncateToTokenLimit(text);
      expect(countTokens(truncated.slice(0, -3))).toBeLessThanOrEqual(2000);
    });
  });
});
