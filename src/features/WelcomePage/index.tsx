'use client';

import { Button } from '@lobehub/ui';
import { createStyles, useTheme } from 'antd-style';
import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { memo } from 'react';
import { Center, Flexbox } from 'react-layout-kit';
import { useNavigate } from 'react-router-dom';

import { BRANDING_LOGO_URL, BRANDING_NAME } from '@/const/branding';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';

import ParticleBackground from './ParticleBackground';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  container: css`
    position: relative;
    width: 100%;
    height: 100vh;
    background: ${isDarkMode ? token.colorBgLayout : token.colorBgContainer};
  `,
  content: css`
    position: relative;
    z-index: 10;

    display: flex;
    flex-direction: column;
    align-items: center;

    max-width: 800px;
    padding: 48px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;

    text-align: center;

    background: ${isDarkMode ? `${token.colorBgElevated}cc` : `${token.colorBgContainer}e6`};
    box-shadow: ${token.boxShadowSecondary};
  `,
  description: css`
    margin-block-end: 48px;
    font-size: 18px;
    line-height: 1.6;
    color: ${token.colorTextSecondary};
  `,
  footer: css`
    position: absolute;
    inset-block-end: 32px;
    font-size: 12px;
    color: ${token.colorTextQuaternary};
  `,
  iconWrapper: css`
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    margin-block-end: 24px;
    border-radius: 50%;

    background: #2b2d31;
    box-shadow: ${token.boxShadowTertiary};
  `,
  title: css`
    margin-block-end: 24px;

    font-size: clamp(48px, 8vw, 80px);
    font-weight: 700;
    line-height: 1.1;
    color: transparent;
    letter-spacing: -0.02em;

    background: linear-gradient(
      135deg,
      ${token.colorPrimary},
      ${token.colorPrimaryHover},
      ${token.colorPrimary}
    );
    background-clip: text;
  `,
}));

const WelcomePage = memo(() => {
  const { styles } = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();
  const isLogin = useUserStore((s) => authSelectors.isLogin(s));

  const handleEnter = () => {
    if (isLogin) {
      navigate('/chat');
    } else {
      // 登录成功后直接跳转到 /chat，而不是回到 welcome 页面
      const callbackUrl = `${location.origin}/chat`;
      window.location.href = `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    }
  };

  return (
    <div className={styles.container}>
      <ParticleBackground isDarkMode={theme.isDarkMode} primaryColor={theme.colorPrimary} />

      <Center height="100%" style={{ padding: 16 }} width="100%">
        <Flexbox className={styles.content}>
          <div className={styles.iconWrapper}>
            <Image
              alt={BRANDING_NAME}
              height={64}
              src={BRANDING_LOGO_URL || '/logo.png'}
              width={64}
            />
          </div>

          <h1 className={styles.title}>{BRANDING_NAME}</h1>

          <p className={styles.description}>Your Ultimate Research Companion</p>

          <Button
            icon={<ChevronRight size={16} />}
            iconPosition="end"
            onClick={handleEnter}
            size="large"
            type="primary"
          >
            Enter
          </Button>
        </Flexbox>

        <span className={styles.footer}>Sillogic</span>
      </Center>
    </div>
  );
});

WelcomePage.displayName = 'WelcomePage';

export const DesktopWelcomePage = WelcomePage;
export const MobileWelcomePage = WelcomePage;

export default WelcomePage;
