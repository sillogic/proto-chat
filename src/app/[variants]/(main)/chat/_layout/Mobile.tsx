'use client';

import { createStyles } from 'antd-style';
import { memo, useEffect } from 'react';
import { Flexbox } from 'react-layout-kit';
import { Outlet, useNavigate } from 'react-router-dom';

import { withSuspense } from '@/components/withSuspense';
import { enableAuth } from '@/const/auth';
import { useShowMobileWorkspace } from '@/hooks/useShowMobileWorkspace';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

import SessionPanelContent from '../components/SessionPanel';

const useStyles = createStyles(({ css, token }) => ({
  main: css`
    position: relative;
    overflow: hidden;
    background: ${token.colorBgLayout};
  `,
}));

const Layout = memo(() => {
  const showMobileWorkspace = useShowMobileWorkspace();
  const { styles } = useStyles();
  const navigate = useNavigate();
  const [isLogin, isLoaded] = useUserStore((s) => [
    authSelectors.isLogin(s),
    authSelectors.isLoaded(s),
  ]);

  // Redirect to signin page if not logged in
  useEffect(() => {
    // Wait for auth state to be loaded
    if (!isLoaded) return;

    // Redirect to signin if auth is enabled and user is not logged in
    if (enableAuth && !isLogin) {
      const currentUrl = window.location.href;
      window.location.href = `/signin?callbackUrl=${encodeURIComponent(currentUrl)}`;
    }
  }, [isLoaded, isLogin, navigate]);

  // Don't render content while checking auth or if not logged in
  if (enableAuth && (!isLoaded || !isLogin)) {
    return null;
  }

  return (
    <>
      <Flexbox
        className={styles.main}
        height="100%"
        style={showMobileWorkspace ? { display: 'none' } : undefined}
        width="100%"
      >
        <SessionPanelContent mobile />
      </Flexbox>
      <Flexbox
        className={styles.main}
        height="100%"
        style={showMobileWorkspace ? undefined : { display: 'none' }}
        width="100%"
      >
        <Outlet />
      </Flexbox>
    </>
  );
});

Layout.displayName = 'MobileChatLayout';

export default withSuspense(Layout);
