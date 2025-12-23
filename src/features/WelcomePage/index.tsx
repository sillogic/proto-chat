'use client';

import { Button } from '@lobehub/ui';
import { createStyles, useTheme } from 'antd-style';
import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';

import { BRANDING_LOGO_URL, BRANDING_NAME } from '@/const/branding';

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
  const router = useRouter();
  const { t } = useTranslation('welcome');

  const handleEnter = () => {
    router.push('/chat');
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

          <p className={styles.description}>{t('landing.subtitle')}</p>

          <Button
            icon={<ChevronRight size={16} />}
            iconPosition="end"
            onClick={handleEnter}
            size="large"
            type="primary"
          >
            {t('landing.enterButton')}
          </Button>
        </Flexbox>

        <span className={styles.footer}>{t('landing.footer')}</span>
      </Center>
    </div>
  );
});

WelcomePage.displayName = 'WelcomePage';

export default WelcomePage;
