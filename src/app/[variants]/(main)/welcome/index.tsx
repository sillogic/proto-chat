'use client';

import { Button } from 'antd';
import { createStyles } from 'antd-style';
import { ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Center, Flexbox } from 'react-layout-kit';

import { ProductLogo } from '@/components/Branding';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    position: relative;
    height: 100vh;
    width: 100%;
    background: linear-gradient(
      135deg,
      ${token.colorBgLayout} 0%,
      ${token.colorBgContainer} 50%,
      ${token.colorBgLayout} 100%
    );
  `,
  glassPanel: css`
    padding: 48px;
    border-radius: 24px;
    background: ${token.colorBgElevated}80;
    backdrop-filter: blur(20px);
    border: 1px solid ${token.colorBorderSecondary};
    box-shadow: 0 8px 32px ${token.colorBgMask};
  `,
  logo: css`
    animation: pulse 2s ease-in-out infinite;

    @keyframes pulse {
      0%,
      100% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.05);
        opacity: 0.8;
      }
    }
  `,
  title: css`
    margin: 0;
    font-size: 48px;
    font-weight: 700;
    background: linear-gradient(135deg, ${token.colorPrimary}, ${token.colorInfo});
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;

    @media (max-width: 768px) {
      font-size: 36px;
    }
  `,
  subtitle: css`
    margin: 0;
    font-size: 18px;
    color: ${token.colorTextSecondary};

    @media (max-width: 768px) {
      font-size: 14px;
    }
  `,
  enterButton: css`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 48px;
    padding: 0 32px;
    font-size: 16px;
    font-weight: 500;
    border-radius: 24px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateX(4px);
    }
  `,
  footer: css`
    position: absolute;
    bottom: 24px;
    font-size: 12px;
    color: ${token.colorTextQuaternary};
  `,
}));

const WelcomePage = memo(() => {
  const { styles } = useStyles();
  const navigate = useNavigate();

  const handleEnter = () => {
    navigate('/chat');
  };

  return (
    <Flexbox align="center" className={styles.container} justify="center">
      <Flexbox align="center" className={styles.glassPanel} gap={32}>
        <div className={styles.logo}>
          <ProductLogo size={64} type="combine" />
        </div>
        <Center gap={12}>
          <h1 className={styles.title}>ProtoChat</h1>
          <p className={styles.subtitle}>Your Ultimate Research Companion</p>
        </Center>
        <Button className={styles.enterButton} onClick={handleEnter} type="primary">
          Enter
          <ChevronRight size={20} />
        </Button>
      </Flexbox>
      <div className={styles.footer}>Powered by Gemini • React • LobeHub</div>
    </Flexbox>
  );
});

WelcomePage.displayName = 'WelcomePage';

export const DesktopWelcomePage = WelcomePage;
export const MobileWelcomePage = WelcomePage;
