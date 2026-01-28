'use client';

import { Icon } from '@lobehub/ui';
import { Skeleton } from 'antd';
import { createStyles } from 'antd-style';
import { GraduationCap } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';

import { useSubscriptionPlans } from '../hooks/useSubscriptionPlans';
import BillingToggle, { type BillingCycle } from './features/BillingToggle';
import ComparisonTable from './features/ComparisonTable';
import PlanCard from './features/PlanCard';
import TeamPlan from './features/TeamPlan';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  cardsContainer: css`
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    justify-content: center;

    width: 100%;
  `,
  divider: css`
    width: 100%;
    height: 1px;
    margin-block: 16px;
    margin-inline: 0;

    background: ${isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)'};
  `,
  headerIcon: css`
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: ${isDarkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.12)'};
  `,
  pageContainer: css`
    max-width: 1200px;
    margin-block: 0;
    margin-inline: auto;
    padding-block: 0;
    padding-inline: 24px;
  `,
  sectionSubtitle: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  sectionTitle: css`
    font-size: 18px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  subtitle: css`
    max-width: 500px;
    font-size: 15px;
    color: ${token.colorTextSecondary};
    text-align: center;
  `,
  title: css`
    font-size: 28px;
    font-weight: 700;
    color: ${token.colorText};
    text-align: center;
  `,
}));

interface ClientProps {
  mobile?: boolean;
}

const Client = memo<ClientProps>(() => {
  const { t } = useTranslation('subscription');
  const { styles, theme } = useStyles();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const { plans, isLoading } = useSubscriptionPlans();

  // Filter plans: separate individual and team plans, exclude free plan from main list
  const { individualPlans, teamPlans } = useMemo(() => {
    const individual = plans.filter(
      (plan) => plan.type === 'individual' && plan.slug !== 'free',
    );
    const team = plans.filter((plan) => plan.type === 'team');
    return { individualPlans: individual, teamPlans: team };
  }, [plans]);

  return (
    <Flexbox className={styles.pageContainer} gap={48} width={'100%'}>
      {/* Header */}
      <Flexbox align={'center'} gap={20}>
        <Center className={styles.headerIcon}>
          <Icon color={theme.colorText} icon={GraduationCap} size={28} />
        </Center>
        <Flexbox align={'center'} gap={8}>
          <span className={styles.title}>{t('title', '订阅方案')}</span>
          <span className={styles.subtitle}>
            {t('subtitle', '选择适合您的 AI 研究助手服务')}
          </span>
        </Flexbox>
        <BillingToggle onChange={setBillingCycle} value={billingCycle} />
      </Flexbox>

      {/* Personal Plans Section */}
      <Flexbox gap={24}>
        <Flexbox align={'center'} gap={4}>
          <span className={styles.sectionTitle}>{t('personal.title', '个人方案')}</span>
          <span className={styles.sectionSubtitle}>为个人用户提供的 AI 研究助手服务</span>
        </Flexbox>

        {isLoading ? (
          <div className={styles.cardsContainer}>
            {[1, 2, 3].map((i) => (
              <Skeleton.Node
                key={i}
                active
                style={{ width: 300, height: 500, borderRadius: 12 }}
              />
            ))}
          </div>
        ) : (
          <div className={styles.cardsContainer}>
            {individualPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                billingCycle={billingCycle}
                plan={plan}
              />
            ))}
          </div>
        )}
      </Flexbox>

      {/* Comparison Table */}
      {!isLoading && individualPlans.length > 0 && (
        <Flexbox gap={24}>
          <Flexbox align={'center'} gap={4}>
            <span className={styles.sectionTitle}>方案对比</span>
            <span className={styles.sectionSubtitle}>详细了解各方案的功能差异</span>
          </Flexbox>
          <ComparisonTable billingCycle={billingCycle} plans={individualPlans} />
        </Flexbox>
      )}

      {/* Team Plan Section - Show if team plans exist, otherwise show TeamPlan component */}
      <Flexbox gap={24}>
        <Flexbox align={'center'} gap={4}>
          <span className={styles.sectionTitle}>{t('team.title', '团队方案')}</span>
          <span className={styles.sectionSubtitle}>为科研团队和企业提供定制化解决方案</span>
        </Flexbox>
        {teamPlans.length > 0 ? (
          <div className={styles.cardsContainer}>
            {teamPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                billingCycle={billingCycle}
                plan={plan}
              />
            ))}
          </div>
        ) : (
          <TeamPlan />
        )}
      </Flexbox>
    </Flexbox>
  );
});

Client.displayName = 'SubscriptionPlansClient';

export default Client;
