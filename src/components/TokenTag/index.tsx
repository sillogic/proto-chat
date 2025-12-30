'use client';

import { Button } from '@lobehub/ui';
import { createStyles, keyframes, useResponsive } from 'antd-style';
import { AlertTriangle, Gauge, Zap } from 'lucide-react';
import numeral from 'numeral';
import { CSSProperties, memo, useMemo } from 'react';

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
`;

const useStyles = createStyles(({ css, token }) => ({
  icon: css`
    flex-shrink: 0;
  `,
  low: css`
    color: ${token.colorWarning};
    background: ${token.colorWarningBg};

    &:hover {
      background: ${token.colorWarningBgHover};
    }
  `,
  normal: css`
    color: ${token.colorSuccess};
    background: ${token.colorSuccessBg};

    &:hover {
      background: ${token.colorSuccessBgHover};
    }
  `,
  overload: css`
    color: ${token.colorError};
    background: ${token.colorErrorBg};

    &:hover {
      background: ${token.colorErrorBgHover};
    }
  `,
  pulseIcon: css`
    animation: ${pulse} 1.5s ease-in-out infinite;
  `,
  root: css`
    gap: 4px;
    padding-block: 4px;
    padding-inline: 8px;
    font-size: 12px;
  `,
}));

const format = (number: number) => numeral(number).format('0,0');

export interface TokenTagProps {
  className?: string;
  hideText?: boolean;
  maxValue: number;
  mode?: 'remained' | 'used';
  shape?: 'round' | 'circle' | 'default';
  style?: CSSProperties;
  text?: {
    overload?: string;
    remained?: string;
    used?: string;
  };
  value: number;
}

const TokenTag = memo<TokenTagProps>(
  ({ className, shape = 'round', mode = 'remained', maxValue, value, text, hideText, ...rest }) => {
    const { mobile } = useResponsive();
    const valueLeft = maxValue - value;
    const percent = valueLeft / maxValue;
    const showText = !hideText && !mobile;

    const data = useMemo(() => {
      let type: 'normal' | 'low' | 'overload';
      let Icon: typeof Gauge;
      let animate = false;

      if (percent > 0.3) {
        type = 'normal';
        Icon = Gauge;
      } else if (percent > 0) {
        type = 'low';
        Icon = Zap;
        animate = true;
      } else {
        type = 'overload';
        Icon = AlertTriangle;
        animate = true;
      }

      return { Icon, animate, type };
    }, [percent]);

    const { styles, cx } = useStyles();

    const typeStyle = useMemo(() => {
      switch (data.type) {
        case 'low': {
          return styles.low;
        }
        case 'overload': {
          return styles.overload;
        }
        default: {
          return styles.normal;
        }
      }
    }, [data.type, styles]);

    const IconComponent = data.Icon;

    return (
      <Button
        className={cx(styles.root, typeStyle, className)}
        shape={shape}
        variant="filled"
        {...rest}
      >
        <IconComponent
          className={cx(styles.icon, data.animate && styles.pulseIcon)}
          size={16}
          strokeWidth={2}
        />
        {valueLeft > 0
          ? [
              showText
                ? mode === 'remained'
                  ? text?.remained || 'Remained'
                  : text?.used || 'Used'
                : '',
              mode === 'remained' ? format(valueLeft) : format(value),
            ].join(' ')
          : text?.overload || 'Overload'}
      </Button>
    );
  },
);

TokenTag.displayName = 'TokenTag';

export default TokenTag;
