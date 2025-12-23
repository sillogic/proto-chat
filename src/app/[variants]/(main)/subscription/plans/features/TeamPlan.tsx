'use client';

import { Icon } from '@lobehub/ui';
import { Button } from 'antd';
import { createStyles } from 'antd-style';
import { Building2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';
import { Link } from 'react-router-dom';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  card: css`
    flex: 1;

    min-width: 280px;
    padding: 32px;
    border: 1px solid ${isDarkMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)'};
    border-radius: 16px;

    background: ${isDarkMode
      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)'
      : 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)'};

    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      border-color: ${isDarkMode ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.4)'};
      box-shadow: 0 8px 24px ${isDarkMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)'};
    }
  `,
  desc: css`
    font-size: 14px;
    line-height: 1.6;
    color: ${token.colorTextSecondary};
  `,
  iconContainer: css`
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  `,
  title: css`
    font-size: 24px;
    font-weight: 600;
    color: ${token.colorText};
  `,
}));

const TeamPlan = memo(() => {
  const { t } = useTranslation('subscription');
  const { styles } = useStyles();

  return (
    <Flexbox align={'center'} className={styles.card} gap={24} horizontal justify={'space-between'}>
      <Flexbox align={'center'} gap={20} horizontal>
        <Center className={styles.iconContainer}>
          <Icon color="#fff" icon={Building2} size={32} />
        </Center>
        <Flexbox gap={8}>
          <span className={styles.title}>{t('team.title')}</span>
          <span className={styles.desc}>{t('team.desc')}</span>
        </Flexbox>
      </Flexbox>
      <Link to="/contact">
        <Button size="large" type="primary">
          {t('team.contact')}
        </Button>
      </Link>
    </Flexbox>
  );
});

TeamPlan.displayName = 'TeamPlan';

export default TeamPlan;
