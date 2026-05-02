/**
 * 简单的token计数工具，近似Claude的token计算方式
 * 大致规则：1个token ≈ 0.75个英文单词 ≈ 1.3个中文字符
 * 这是一个近似计算，实际token数以Claude API返回为准
 */

/**
 * 计算文本的近似token数量
 * @param text 要计算的文本
 * @returns 近似token数量
 */
export function countTokens(text: string): number {
  if (!text) return 0;

  // 统计中文字符数量
  const chineseChars = (text.match(/[一-龥]/g) || []).length;
  // 剩余字符数（包含英文、数字、标点等）
  const remainingChars = text.length - chineseChars;
  // 英文部分按4个字符≈1个token计算（近似0.75单词 = 3个字符）
  const englishTokens = Math.ceil(remainingChars / 4);
  // 中文部分按1.3个字符≈1个token计算
  const chineseTokens = Math.ceil(chineseChars / 1.3);

  return englishTokens + chineseTokens;
}

/**
 * 检查文本是否超过指定token限制
 * @param text 要检查的文本
 * @param maxTokens 最大token数量
 * @returns 是否超过限制
 */
export function exceedsTokenLimit(text: string, maxTokens: number = 2000): boolean {
  return countTokens(text) > maxTokens;
}

/**
 * 截断文本到指定token数量
 * @param text 要截断的文本
 * @param maxTokens 最大token数量
 * @returns 截断后的文本
 */
export function truncateToTokenLimit(text: string, maxTokens: number = 2000): string {
  if (!text) return '';

  // 先尝试完整文本
  if (!exceedsTokenLimit(text, maxTokens)) {
    return text;
  }

  // 二分法截断
  let low = 0;
  let high = text.length;
  let bestLength = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const substring = text.slice(0, mid);
    if (!exceedsTokenLimit(substring, maxTokens)) {
      bestLength = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // 截断到最近的完整句子（如果可能）
  let truncated = text.slice(0, bestLength);
  // 查找句子结束标记的最后位置
  const sentenceEndMarkers = ['。', '！', '？', '.', '!', '?'];
  let lastSentenceEnd = -1;
  for (const marker of sentenceEndMarkers) {
    const pos = truncated.lastIndexOf(marker);
    if (pos > lastSentenceEnd) {
      lastSentenceEnd = pos;
    }
  }
  if (lastSentenceEnd > 0 && lastSentenceEnd > truncated.length * 0.8) {
    truncated = truncated.slice(0, lastSentenceEnd + 1);
  }

  return truncated + '...';
}
