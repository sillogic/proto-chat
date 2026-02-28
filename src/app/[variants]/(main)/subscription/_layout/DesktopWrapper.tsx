'use client';

import { Flexbox } from '@lobehub/ui';
import { useTheme } from 'antd-style';
import type {PropsWithChildren } from 'react';
import { memo } from 'react';
import { Outlet } from 'react-router-dom';

const DesktopSubscriptionWrapper = memo<PropsWithChildren>(() => {
  const theme = useTheme();

  return (
    <Flexbox
      align={'center'}
      width={'100%'}
      style={{
        background: theme.colorBgLayout,
        height: '100%',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >
      <Flexbox
        gap={24}
        paddingBlock={32}
        paddingInline={24}
        style={{
          width: 'min(100%, 1200px)',
        }}
      >
        <Outlet />
      </Flexbox>
    </Flexbox>
  );
});

DesktopSubscriptionWrapper.displayName = 'DesktopSubscriptionWrapper';

export default DesktopSubscriptionWrapper;
