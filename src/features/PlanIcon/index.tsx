import { Plans } from '@lobechat/types';
import { Center, Flexbox, Icon, Tag } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { Atom, Box, CircleSlash, Sparkle, Zap } from 'lucide-react';
import { type CSSProperties, type MouseEvent } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

export const themes = {
  [Plans.Free]: {
    icon: CircleSlash,
    theme: {
      background: undefined,
      color: undefined,
    },
  },
  [Plans.Hobby]: {
    icon: Box,
    theme: {
      background: 'linear-gradient(45deg, #21B2EE, #2271ED)',
      color: '#E5F8FF',
    },
  },
  [Plans.Starter]: {
    icon: Sparkle,
    theme: {
      background: 'linear-gradient(45deg, #C57948, #803718)',
      color: '#FFC385',
    },
  },
  [Plans.Premium]: {
    icon: Zap,
    theme: {
      background: 'linear-gradient(45deg, #A5B4C2, #606E7B)',
      color: '#FCFDFF',
    },
  },
  [Plans.Ultimate]: {
    icon: Atom,
    theme: {
      background: 'linear-gradient(45deg, #F7A82F, #BB7227)',
      color: '#FCFA6E',
    },
  },
};

const styles = createStaticStyles(({ css }) => ({
  icon: css`
    flex: none;
    border-radius: ${cssVar.borderRadiusLG};
    box-shadow: 0 0 0 1px ${cssVar.colorFillSecondary};
  `,
}));

interface PlanIconProps {
  className?: string;
  mono?: boolean;
  onClick?: (e: MouseEvent) => void;
  plan: Plans;
  size?: number;
  style?: CSSProperties;
  type?: 'icon' | 'tag' | 'combine';
}

// ProtoChat plan display names — fixed English labels, no i18n translation
const PROTOCHAT_PLAN_NAMES: Partial<Record<Plans, string>> = {
  [Plans.Hobby]: 'Lite',
  [Plans.Premium]: 'Pro',
  [Plans.Ultimate]: 'Ultra',
};

const PlanIcon = memo<PlanIconProps>(
  ({ type = 'icon', plan, size = 36, mono, style, className, onClick }) => {
    // Fallback to Free theme if plan is not defined in themes
    const planTheme = themes[plan] || themes[Plans.Free];
    const { icon, theme } = planTheme;
    const { t } = useTranslation('subscription');
    const isTag = type === 'tag';
    const isCombine = type === 'combine';
    const isFree = plan === Plans.Free || !themes[plan];

    if (isTag) {
      // For unknown plans, display the plan name directly
      const planTitle = PROTOCHAT_PLAN_NAMES[plan]
        ?? (themes[plan]
          ? t(`plans.plan.${plan}.title`)
          : (plan as string).replaceAll('-', ' ').replaceAll(/\b\w/g, (l) => l.toUpperCase()));

      return (
        <Tag
          className={className}
          variant={'filled'}
          style={{
            ...(theme || { background: cssVar.colorFillSecondary, color: cssVar.colorText }),
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            flex: 'none',
            margin: 0,
            ...style,
          }}
          onClick={onClick}
        >
          {planTitle}
        </Tag>
      );
    }

    const iconContent = (
      <Center
        className={styles.icon}
        height={size}
        width={size}
        style={
          mono
            ? style
            : { ...theme, border: isFree ? undefined : `2px solid ${theme.color}`, ...style }
        }
        onClick={onClick}
      >
        <Icon color={mono ? undefined : theme.color} icon={icon} size={size / 2} />
      </Center>
    );

    if (isCombine) {
      // For unknown plans, display the plan name directly
      const planTitle = PROTOCHAT_PLAN_NAMES[plan]
        ?? (themes[plan]
          ? t(`plans.plan.${plan}.title`)
          : (plan as string).replaceAll('-', ' ').replaceAll(/\b\w/g, (l) => l.toUpperCase()));

      return (
        <Flexbox horizontal align={'center'} gap={8}>
          {iconContent}
          <span>{planTitle}</span>
        </Flexbox>
      );
    }

    return iconContent;
  },
);

export default PlanIcon;
