import { useEffect } from 'react';
import { Flexbox } from 'react-layout-kit';
import { Outlet, useNavigate } from 'react-router-dom';

import { enableAuth } from '@/const/auth';
import { isDesktop } from '@/const/version';
import ProtocolUrlHandler from '@/features/ProtocolUrlHandler';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

import RegisterHotkeys from './RegisterHotkeys';
import SessionPanel from './SessionPanel';
import Workspace from './Workspace';

const Layout = () => {
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
        height={'100%'}
        horizontal
        style={{ maxWidth: '100%', overflow: 'hidden', position: 'relative' }}
        width={'100%'}
      >
        <SessionPanel />
        <Workspace>
          <Outlet />
        </Workspace>
      </Flexbox>
      {/* ↓ cloud slot ↓ */}

      {/* ↑ cloud slot ↑ */}
      <RegisterHotkeys />
      {isDesktop && <ProtocolUrlHandler />}
    </>
  );
};

Layout.displayName = 'DesktopChatLayout';

export default Layout;
