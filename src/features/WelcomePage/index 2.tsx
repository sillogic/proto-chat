'use client';

import { Icon } from '@lobehub/ui';
import { createStyles, useTheme } from 'antd-style';
import { BrainCircuit, ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';
import { useNavigate } from 'react-router-dom';

import { BRANDING_NAME } from '@/const/branding';

import ParticleBackground from './ParticleBackground';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  button: css`
    cursor: pointer;

    position: relative;

    overflow: hidden;
    display: flex;
    gap: 8px;
    align-items: center;

    padding-block: 16px;
    padding-inline: 32px;
    border: none;
    border-radius: 9999px;

    font-size: 18px;
    font-weight: 600;
    color: ${isDarkMode ? token.colorBgLayout : token.colorTextLightSolid};

    background: ${isDarkMode ? token.colorTextLightSolid : token.colorText};
    box-shadow: ${token.boxShadowSecondary};

    transition: all 0.3s ease;

    &:hover {
      background: ${isDarkMode ? token.colorBgElevated : token.colorTextSecondary};
      box-shadow: ${token.boxShadow};

      .arrow-icon {
        transform: translateX(4px);
      }
    }
  `,
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
    border: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.05)'};
    border-radius: 24px;

    text-align: center;

    background: ${isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
    backdrop-filter: blur(12px);
    box-shadow: ${token.boxShadowSecondary};
  `,
  description: css`
    margin-block-end: 48px;
    font-size: 18px;
    line-height: 1.6;
    color: ${isDarkMode ? token.colorTextSecondary : token.colorTextDescription};
  `,
  footer: css`
    position: absolute;
    inset-block-end: 32px;

    font-family: monospace;
    font-size: 12px;
    color: ${token.colorTextQuaternary};
  `,
  iconWrapper: css`
    display: flex;
    align-items: center;
    justify-content: center;

    margin-block-end: 24px;
    padding: 16px;
    border: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
    border-radius: 50%;

    background: ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.5)'};
    box-shadow: ${isDarkMode ? 'none' : token.boxShadowTertiary};

    animation: pulse 2s infinite;

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }

      50% {
        opacity: 0.7;
      }
    }
  `,
  title: css`
    margin-block-end: 24px;

    font-family: monospace;
    font-size: clamp(48px, 8vw, 80px);
    font-weight: bold;
    line-height: 1.1;
    color: transparent;
    letter-spacing: -0.02em;

    background: linear-gradient(
      to right,
      ${token.colorPrimary},
      ${isDarkMode ? token.colorTextLightSolid : token.colorText},
      ${token.colorPrimary}
    );
    background-clip: text;
  `,
}));

const WelcomePage = memo(() => {
  const { styles } = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation('welcome');

  const handleEnter = () => {
    navigate('/chat');
  };

  return (
    <div className={styles.container}>
      <ParticleBackground isDarkMode={theme.isDarkMode} />

      <Center height="100%" style={{ padding: 16 }} width="100%">
        <Flexbox className={styles.content}>
          <div className={styles.iconWrapper}>
            <Icon icon={BrainCircuit} size={48} style={{ color: theme.colorPrimary }} />
          </div>

          <h1 className={styles.title}>{BRANDING_NAME}</h1>

          <p className={styles.description}>{t('landing.subtitle')}</p>

          <button className={styles.button} onClick={handleEnter} type="button">
            <span>{t('landing.enterButton')}</span>
            <Icon
              className="arrow-icon"
              icon={ChevronRight}
              size={20}
              style={{ transition: 'transform 0.3s ease' }}
            />
          </button>
        </Flexbox>

        <span className={styles.footer}>{t('landing.footer')}</span>
      </Center>
    </div>
  );
});

WelcomePage.displayName = 'WelcomePage';

export default WelcomePage;
