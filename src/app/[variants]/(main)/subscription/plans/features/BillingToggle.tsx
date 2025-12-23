'use client';

import { Tag } from '@lobehub/ui';
import { Segmented } from 'antd';
import { createStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    padding: 4px;
    border-radius: 24px;
    background: ${token.colorFillQuaternary};
  `,
  discountTag: css`
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  `,
}));

export type BillingCycle = 'monthly' | 'yearly';

interface BillingToggleProps {
  onChange: (value: BillingCycle) => void;
  value: BillingCycle;
}

const BillingToggle = memo<BillingToggleProps>(({ value, onChange }) => {
  const { t } = useTranslation('subscription');
  const { styles } = useStyles();

  return (
    <Flexbox align={'center'} className={styles.container} gap={8} horizontal>
      <Segmented
        onChange={(val) => onChange(val as BillingCycle)}
        options={[
          {
            label: (
              <Flexbox align={'center'} gap={6} horizontal paddingInline={8}>
                <span>{t('billingCycle.yearly')}</span>
                <Tag className={styles.discountTag} size={'small'}>
                  {t('billingCycle.yearlyDiscount')}
                </Tag>
              </Flexbox>
            ),
            value: 'yearly',
          },
          {
            label: t('billingCycle.monthly'),
            value: 'monthly',
          },
        ]}
        size="large"
        value={value}
      />
    </Flexbox>
  );
});

BillingToggle.displayName = 'BillingToggle';

export default BillingToggle;
