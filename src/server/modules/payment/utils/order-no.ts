/**
 * Generate unique order numbers for payment orders
 * Format: PC + YYYYMMDDHHMMSS + 6-digit random number
 * Example: PC202601270930451234567
 */

export function generateOrderNo(): string {
  const now = new Date();

  // Format: YYYYMMDDHHMMSS
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

  // 6-digit random number
  const random = Math.floor(100000 + Math.random() * 900000);

  return `PC${timestamp}${random}`;
}
