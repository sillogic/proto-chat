'use client';

import { Avatar, type AvatarProps, Icon } from '@lobehub/ui';
import { useTheme } from 'antd-style';
import { memo, useMemo } from 'react';

import { getIconComponent, isIconValue } from '@/components/IconPicker';

export interface AgentAvatarProps extends Omit<AvatarProps, 'avatar'> {
  /**
   * Avatar value - can be:
   * - An emoji string (e.g., "🤖")
   * - An icon identifier with prefix (e.g., "icon:code")
   * - An image URL
   * - A ReactNode
   */
  avatar?: AvatarProps['avatar'];
}

/**
 * AgentAvatar component that extends the @lobehub/ui Avatar
 * to support both emoji and Lucide icon identifiers.
 *
 * When the avatar value starts with "icon:", it renders the corresponding
 * Lucide icon instead of trying to find an emoji.
 *
 * @example
 * ```tsx
 * // Emoji avatar
 * <AgentAvatar avatar="🤖" size={48} />
 *
 * // Icon avatar
 * <AgentAvatar avatar="icon:code" size={48} />
 *
 * // Image URL avatar
 * <AgentAvatar avatar="https://example.com/avatar.png" size={48} />
 * ```
 */
const AgentAvatar = memo<AgentAvatarProps>(({ avatar, background, size = 48, ...rest }) => {
  const theme = useTheme();

  // If avatar is an icon identifier, render the icon component
  const resolvedAvatar = useMemo(() => {
    if (typeof avatar === 'string' && isIconValue(avatar)) {
      const IconComponent = getIconComponent(avatar);
      if (IconComponent) {
        return (
          <Icon
            icon={IconComponent}
            size={typeof size === 'number' ? size * 0.5 : 24}
            style={{ color: theme.colorTextSecondary }}
          />
        );
      }
    }
    return avatar;
  }, [avatar, size, theme.colorTextSecondary]);

  return (
    <Avatar
      avatar={resolvedAvatar}
      background={background || theme.colorFillTertiary}
      size={size}
      {...rest}
    />
  );
});

AgentAvatar.displayName = 'AgentAvatar';

export default AgentAvatar;
