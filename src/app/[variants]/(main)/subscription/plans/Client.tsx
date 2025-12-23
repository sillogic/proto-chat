'use client';

import { createStyles } from 'antd-style';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { useSubscriptionPlans } from '../hooks/useSubscriptionPlans';
import BillingToggle, { type BillingCycle } from './features/BillingToggle';
import PlanCard from './features/PlanCard';
import TeamPlan from './features/TeamPlan';

const useStyles = createStyles(({ css, token }) => ({
  cardsContainer: css`
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: center;
  `,
  subtitle: css`
    font-size: 16px;
    color: ${token.colorTextSecondary};
  `,
  title: css`
    font-size: 32px;
    font-weight: 700;
    color: ${token.colorText};
  `,
}));

interface ClientProps {
  mobile?: boolean;
}

const Client = memo<ClientProps>(() => {
  const { t } = useTranslation('subscription');
  const { styles } = useStyles();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const { plans, handleUpgrade } = useSubscriptionPlans();

  return (
    <Flexbox gap={32} width={'100%'}>
      {/* Header */}
      <Flexbox align={'center'} gap={16}>
        <span className={styles.title}>{t('title')}</span>
        <span className={styles.subtitle}>{t('subtitle')}</span>
        <BillingToggle onChange={setBillingCycle} value={billingCycle} />
      </Flexbox>

      {/* Personal Plans */}
      <Flexbox gap={16}>
        <Flexbox
          align={'center'}
          style={{ color: 'var(--leva-colors-text)', fontSize: 14, fontWeight: 500 }}
        >
          {t('personal.title')}
        </Flexbox>
        <div className={styles.cardsContainer}>
          {plans.map((plan) => (
            <PlanCard
              billingCycle={billingCycle}
              credits={plan.credits}
              deepseek={plan.deepseek}
              desc={plan.desc}
              fileStorage={plan.fileStorage}
              gpt5Mini={plan.gpt5Mini}
              id={plan.id}
              key={plan.id}
              name={plan.name}
              onUpgrade={handleUpgrade}
              popular={plan.popular}
              price={plan.price}
              vectorStorage={plan.vectorStorage}
              vectorStorageSize={plan.vectorStorageSize}
            />
          ))}
        </div>
      </Flexbox>

      {/* Team Plan */}
      <Flexbox gap={16}>
        <TeamPlan />
      </Flexbox>
    </Flexbox>
  );
});

Client.displayName = 'SubscriptionPlansClient';

export default Client;
