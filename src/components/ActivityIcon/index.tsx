'use client';

import { Icon } from '@lobehub/ui';
import { useTheme } from 'antd-style';
import {
  BarChart3,
  Beaker,
  BookOpen,
  Brain,
  Briefcase,
  Calculator,
  CheckCircle,
  Clapperboard,
  ClipboardList,
  Code,
  Dices,
  Dumbbell,
  Edit3,
  FlaskConical,
  Gamepad2,
  Globe,
  Joystick,
  Lightbulb,
  type LucideIcon,
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
  Spade,
  Target,
  TrendingUp,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import { memo } from 'react';

/**
 * Mapping of icon identifiers to Lucide icon components
 * Used to replace emoji with neutral, monochrome icons
 */
const iconMap: Record<string, LucideIcon> = {
  'bar-chart': BarChart3,
  'bar-chart-3': BarChart3,
  'beaker': Beaker,
  'book-open': BookOpen,
  'brain': Brain,
  'briefcase': Briefcase,
  'calculator': Calculator,
  'checkmark-circle': CheckCircle,
  'clapperboard': Clapperboard,
  'clipboard': ClipboardList,
  'clipboard-list': ClipboardList,
  'code': Code,
  'dices': Dices,
  'dumbbell': Dumbbell,
  'edit-3': Edit3,
  'flask': FlaskConical,
  'gamepad-2': Gamepad2,
  'globe': Globe,
  'joystick': Joystick,
  'lightbulb': Lightbulb,
  'message': MessageCircle,
  'mic-2': Mic,
  'microscope': Microscope,
  'music': Music,
  'paintbrush': Paintbrush,
  'palette': Palette,
  'pen': PenTool,
  'pen-tool': PenTool,
  'plane': Plane,
  'rocket': Rocket,
  'scale': Scale,
  'spade': Spade,
  'target': Target,
  'trending-up': TrendingUp,
  'user': User,
  'utensils': UtensilsCrossed,
};

interface ActivityIconProps {
  /**
   * Icon identifier string (e.g., 'code', 'brain', 'rocket')
   */
  icon: string;
  /**
   * Icon size in pixels
   * @default 24
   */
  size?: number;
}

/**
 * ActivityIcon component renders Lucide icons based on string identifiers.
 * Used to display activity/category icons in a neutral, monochrome style.
 *
 * @example
 * ```tsx
 * <ActivityIcon icon="code" size={24} />
 * <ActivityIcon icon="brain" />
 * ```
 */
const ActivityIcon = memo<ActivityIconProps>(({ icon, size = 24 }) => {
  const theme = useTheme();
  const IconComponent = iconMap[icon];

  if (!IconComponent) {
    // Fallback to a default icon if the identifier is not found
    return <Icon icon={User} size={size} style={{ color: theme.colorTextSecondary }} />;
  }

  return <Icon icon={IconComponent} size={size} style={{ color: theme.colorTextSecondary }} />;
});

export default ActivityIcon;

/**
 * Export icon map for reference
 */
export { iconMap };
