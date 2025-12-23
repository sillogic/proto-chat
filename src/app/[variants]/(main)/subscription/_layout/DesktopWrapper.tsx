'use client';

import { useTheme } from 'antd-style';
import { PropsWithChildren, memo } from 'react';
import { Flexbox } from 'react-layout-kit';
import { Outlet } from 'react-router-dom';

const DesktopSubscriptionWrapper = memo<PropsWithChildren>(() => {
  const theme = useTheme();

  return (
    <Flexbox
      align={'center'}
      style={{
        background: theme.colorBgLayout,
        height: '100%',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
      width={'100%'}
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
