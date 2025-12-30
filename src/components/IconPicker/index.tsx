'use client';

import { Icon } from '@lobehub/ui';
import { Popover, Tooltip } from 'antd';
import { useTheme } from 'antd-style';
import {
  BarChart3,
  Beaker,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Calculator,
  CheckCircle,
  Clapperboard,
  ClipboardList,
  Code,
  Compass,
  Database,
  Dices,
  Dumbbell,
  Edit3,
  FileText,
  FlaskConical,
  Gamepad2,
  Globe,
  GraduationCap,
  Heart,
  HelpCircle,
  Home,
  Image,
  Joystick,
  Laptop,
  type LucideIcon,
  Mail,
  Map,
  MessageCircle,
  Mic,
  Microscope,
  Music,
  Paintbrush,
  Palette,
  PenTool,
  Plane,
  Rocket,
  Scale,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Spade,
  Sparkles,
  Star,
  Target,
  Terminal,
  TrendingUp,
  User,
  Users,
  UtensilsCrossed,
  Video,
  Wand2,
  Wrench,
  Zap,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { Center, Flexbox } from 'react-layout-kit';

/**
 * Complete mapping of icon identifiers to Lucide icon components
 */
const iconMap: Record<string, LucideIcon> = {
  'bar-chart-3': BarChart3,
  'beaker': Beaker,
  'book-open': BookOpen,
  'bot': Bot,
  'brain': Brain,
  'briefcase': Briefcase,
  'calculator': Calculator,
  'check-circle': CheckCircle,
  'clapperboard': Clapperboard,
  'clipboard-list': ClipboardList,
  'code': Code,
  'compass': Compass,
  'database': Database,
  'dices': Dices,
  'dumbbell': Dumbbell,
  'edit-3': Edit3,
  'file-text': FileText,
  'flask': FlaskConical,
  'gamepad-2': Gamepad2,
  'globe': Globe,
  'graduation-cap': GraduationCap,
  'heart': Heart,
  'help-circle': HelpCircle,
  'home': Home,
  'image': Image,
  'joystick': Joystick,
  'laptop': Laptop,
  'mail': Mail,
  'map': Map,
  'message': MessageCircle,
  'mic': Mic,
  'microscope': Microscope,
  'music': Music,
  'paintbrush': Paintbrush,
  'palette': Palette,
  'pen-tool': PenTool,
  'plane': Plane,
  'rocket': Rocket,
  'scale': Scale,
  'search': Search,
  'settings': Settings,
  'shield': Shield,
  'shopping-cart': ShoppingCart,
  'spade': Spade,
  'sparkles': Sparkles,
  'star': Star,
  'target': Target,
  'terminal': Terminal,
  'trending-up': TrendingUp,
  'user': User,
  'users': Users,
  'utensils': UtensilsCrossed,
  'video': Video,
  'wand-2': Wand2,
  'wrench': Wrench,
  'zap': Zap,
};

// All icon keys for grid display
const allIconKeys = Object.keys(iconMap);

interface IconPickerProps {
  /**
   * Background color for the selected icon display
   */
  background?: string;
  /**
   * Whether the picker is in loading state
   */
  loading?: boolean;
  /**
   * Callback when an icon is selected
   * Returns the icon identifier with 'icon:' prefix
   */
  onChange?: (value: string) => void;
  /**
   * Size of the icon picker button
   * @default 48
   */
  size?: number;
  /**
   * Current selected value (icon identifier with 'icon:' prefix)
   */
  value?: string;
}

/**
 * IconPicker component allows users to select Lucide icons
 * Stores values with 'icon:' prefix to distinguish from emoji
 */
const IconPicker = memo<IconPickerProps>(({ value, onChange, size = 48, background, loading }) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  // Extract icon id from value (remove 'icon:' prefix if present)
  const iconId = useMemo(() => {
    if (!value) return null;
    return value.startsWith('icon:') ? value.slice(5) : value;
  }, [value]);

  const IconComponent = iconId ? iconMap[iconId] : null;

  const handleSelect = (key: string) => {
    onChange?.(`icon:${key}`);
    setOpen(false);
  };

  const pickerContent = (
    <Flexbox gap={8} style={{ maxWidth: 320, padding: 8 }}>
      <Flexbox gap={4} horizontal style={{ flexWrap: 'wrap' }}>
        {allIconKeys.map((key) => {
          const IconItem = iconMap[key];
          const isSelected = iconId === key;
          return (
            <Tooltip key={key} title={key}>
              <Center
                onClick={() => handleSelect(key)}
                style={{
                  background: isSelected ? theme.colorPrimaryBg : 'transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  height: 40,
                  transition: 'background 0.2s',
                  width: 40,
                }}
              >
                <Icon
                  icon={IconItem}
                  size={20}
                  style={{
                    color: isSelected ? theme.colorPrimary : theme.colorTextSecondary,
                  }}
                />
              </Center>
            </Tooltip>
          );
        })}
      </Flexbox>
    </Flexbox>
  );

  return (
    <Popover
      content={pickerContent}
      onOpenChange={setOpen}
      open={open}
      placement="bottomLeft"
      trigger="click"
    >
      <Center
        style={{
          background: background || theme.colorFillTertiary,
          borderRadius: size / 2,
          cursor: 'pointer',
          height: size,
          width: size,
        }}
      >
        {loading ? (
          <Icon icon={Wand2} size={size * 0.5} spin style={{ color: theme.colorTextSecondary }} />
        ) : IconComponent ? (
          <Icon
            icon={IconComponent}
            size={size * 0.5}
            style={{ color: theme.colorTextSecondary }}
          />
        ) : (
          <Icon icon={User} size={size * 0.5} style={{ color: theme.colorTextTertiary }} />
        )}
      </Center>
    </Popover>
  );
});

IconPicker.displayName = 'IconPicker';

export default IconPicker;

/**
 * Export utilities for icon handling
 */
export { iconMap };

/**
 * Check if a value is an icon identifier
 */
export const isIconValue = (value?: string): boolean => {
  return !!value && value.startsWith('icon:');
};

/**
 * Get icon id from value (remove prefix)
 */
export const getIconId = (value?: string): string | null => {
  if (!value) return null;
  return value.startsWith('icon:') ? value.slice(5) : null;
};

/**
 * Get icon component from value
 */
export const getIconComponent = (value?: string): LucideIcon | null => {
  const iconId = getIconId(value);
  return iconId ? iconMap[iconId] || null : null;
};
