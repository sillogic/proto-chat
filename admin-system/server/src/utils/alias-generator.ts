/**
 * ProtoChat 供应商别名生成器
 *
 * 生成无意义的短 ID 作为供应商别名，用于隐藏实际供应商信息
 * 格式：1个字母 + 1-2位数字，如 a1, b12, z99
 */

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * 生成供应商别名
 * @returns 格式为 {letter}{digit} 的别名，如 a1, b12, z99
 */
export function generateProviderAlias(): string {
  const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const digit = Math.floor(Math.random() * 100); // 0-99
  return `${letter}${digit}`;
}

/**
 * 生成唯一别名
 * @param existingAliases 已存在的别名集合
 * @param maxAttempts 最大尝试次数
 * @returns 唯一的别名
 */
export function generateUniqueAlias(
  existingAliases: Set<string>,
  maxAttempts: number = 100,
): string {
  for (let i = 0; i < maxAttempts; i++) {
    const alias = generateProviderAlias();
    if (!existingAliases.has(alias)) {
      return alias;
    }
  }

  // 回退：使用时间戳后4位
  return `z${Date.now() % 10000}`;
}
