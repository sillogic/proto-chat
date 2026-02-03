'use client';

import { Button } from '@lobehub/ui';
import { createStyles, keyframes } from 'antd-style';
import { Search } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Flexbox } from 'react-layout-kit';

import { MAX_WIDTH } from '@/const/layoutTokens';

const searchPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
`;

const useStyles = createStyles(({ css, token }) => ({
  searchIcon: css`
    color: ${token.colorTextSecondary};
    animation: ${searchPulse} 2s ease-in-out infinite;
  `,
}));

const NotFound = memo(() => {
  const { t } = useTranslation('error');
  const { styles } = useStyles();
  const navigate = useNavigate();

  return (
    <Flexbox align={'center'} justify={'center'} style={{ minHeight: '100%', width: '100%' }}>
      <h1
        style={{
          filter: 'blur(8px)',
          fontSize: `min(${MAX_WIDTH / 3}px, 50vw)`,
          fontWeight: 'bolder',
          margin: 0,
          opacity: 0.12,
          position: 'absolute',
          zIndex: 0,
        }}
      >
        404
      </h1>
      <Search className={styles.searchIcon} size={64} strokeWidth={1.5} />
      <h2 style={{ fontWeight: 'bold', marginTop: '1em', textAlign: 'center' }}>
        {t('notFound.title')}
      </h2>
      <div style={{ lineHeight: '1.8', marginBottom: '2em', textAlign: 'center' }}>
        <div>{t('notFound.desc')}</div>
        <div>{t('notFound.check')}</div>
      </div>
      <Button onClick={() => navigate('/')} type={'primary'}>
        {t('notFound.backHome')}
      </Button>
    </Flexbox>
  );
});

NotFound.displayName = 'NotFound';

export default NotFound;
