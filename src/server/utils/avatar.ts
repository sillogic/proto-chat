/**
 * Default avatar generation utilities
 *
 * Uses DiceBear API to generate tech-style avatars
 * @see https://www.dicebear.com/
 */

// DiceBear avatar styles - tech-oriented options
export type AvatarStyle = 'bottts' | 'identicon' | 'shapes' | 'thumbs' | 'initials';

// Default style for user avatars (bottts = robot style, tech-friendly)
const DEFAULT_AVATAR_STYLE: AvatarStyle = 'bottts';

// DiceBear API base URL
const DICEBEAR_API_BASE = 'https://api.dicebear.com/9.x';

/**
 * Generate a default avatar URL using DiceBear
 *
 * @param seed - Unique identifier for the avatar (e.g., user ID or email)
 * @param style - Avatar style (default: 'bottts' for robot style)
 * @param format - Image format (default: 'svg')
 * @returns Avatar URL
 *
 * @example
 * ```typescript
 * // Generate avatar for a user
 * const avatarUrl = generateDefaultAvatar('user_abc123');
 * // Returns: https://api.dicebear.com/9.x/bottts/svg?seed=user_abc123
 *
 * // Generate with specific style
 * const avatarUrl = generateDefaultAvatar('user@example.com', 'identicon');
 * // Returns: https://api.dicebear.com/9.x/identicon/svg?seed=user@example.com
 * ```
 */
export const generateDefaultAvatar = (
  seed: string,
  style: AvatarStyle = DEFAULT_AVATAR_STYLE,
  format: 'svg' | 'png' = 'svg',
): string => {
  // Encode the seed to handle special characters
  const encodedSeed = encodeURIComponent(seed);

  return `${DICEBEAR_API_BASE}/${style}/${format}?seed=${encodedSeed}`;
};

/**
 * Generate a random default avatar URL
 * Uses current timestamp + random number as seed
 *
 * @param style - Avatar style (default: 'bottts')
 * @returns Random avatar URL
 */
export const generateRandomAvatar = (style: AvatarStyle = DEFAULT_AVATAR_STYLE): string => {
  const randomSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return generateDefaultAvatar(randomSeed, style);
};

/**
 * Check if a string is a valid avatar URL (not empty and looks like a URL)
 *
 * @param avatar - Avatar string to check
 * @returns true if avatar is a valid URL
 */
export const isValidAvatar = (avatar?: string | null): boolean => {
  if (!avatar) return false;
  // Check if it's a URL (http/https) or a relative path starting with /
  return avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('/');
};
