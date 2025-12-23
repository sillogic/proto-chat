'use client';

import { Icon } from '@lobehub/ui';
import { Button } from 'antd';
import { createStyles } from 'antd-style';
import { Building2, GraduationCap, Users } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';
import { Link } from 'react-router-dom';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  card: css`
    position: relative;

    overflow: hidden;

    padding: 32px;
    border: 1px solid ${isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)'};
    border-radius: 12px;

    background: ${isDarkMode
      ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(29, 78, 216, 0.08) 100%)'
      : 'linear-gradient(135deg, rgba(59, 130, 246, 0.04) 0%, rgba(29, 78, 216, 0.04) 100%)'};

    transition: all 0.3s ease;

    &:hover {
      border-color: ${isDarkMode ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.3)'};
      box-shadow: 0 4px 20px ${isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)'};
    }
  `,
  desc: css`
    font-size: 14px;
    line-height: 1.6;
    color: ${token.colorTextSecondary};
  `,
  feature: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
  `,
  featureIcon: css`
    color: ${token.colorPrimary};
  `,
  iconContainer: css`
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  `,
  title: css`
    font-size: 20px;
    font-weight: 600;
    color: ${token.colorText};
  `,
}));

const TeamPlan = memo(() => {
  const { t } = useTranslation('subscription');
  const { styles } = useStyles();

  const features = [
    { icon: Users, text: '支持多人协作与权限管理' },
    { icon: GraduationCap, text: '科研团队专属定制服务' },
    { icon: Building2, text: '企业级安全与合规保障' },
  ];

  return (
    <Flexbox className={styles.card} gap={24} horizontal justify={'space-between'} wrap={'wrap'}>
      <Flexbox gap={20} style={{ flex: 1, minWidth: 280 }}>
        <Flexbox align={'center'} gap={16} horizontal>
          <Center className={styles.iconContainer}>
            <Icon color="#fff" icon={Building2} size={26} />
          </Center>
          <Flexbox gap={4}>
            <span className={styles.title}>{t('team.title')}</span>
            <span className={styles.desc}>{t('team.desc')}</span>
          </Flexbox>
        </Flexbox>

        <Flexbox gap={12} horizontal wrap={'wrap'}>
          {features.map((feature, index) => (
            <Flexbox align={'center'} gap={8} horizontal key={index}>
              <Icon className={styles.featureIcon} icon={feature.icon} size={16} />
              <span className={styles.feature}>{feature.text}</span>
            </Flexbox>
          ))}
        </Flexbox>
      </Flexbox>

      <Flexbox align={'center'} justify={'center'}>
        <Link to="/contact">
          <Button
            size="large"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              border: 'none',
              minWidth: 140,
            }}
            type="primary"
          >
            {t('team.contact')}
          </Button>
        </Link>
      </Flexbox>
    </Flexbox>
  );
});

TeamPlan.displayName = 'TeamPlan';

export default TeamPlan;
