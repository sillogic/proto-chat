'use client';

import { Tag } from '@lobehub/ui';
import { Segmented } from 'antd';
import { createStyles } from 'antd-style';
import { memo } from 'react';
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

export type BillingCycle = 'monthly' | 'yearly' | 'onetime';

interface BillingToggleProps {
  onChange: (value: BillingCycle) => void;
  value: BillingCycle;
}

const BillingToggle = memo<BillingToggleProps>(({ value, onChange }) => {
  const { styles } = useStyles();

  return (
    <Flexbox align={'center'} className={styles.container} gap={8} horizontal>
      <Segmented
        onChange={(val) => onChange(val as BillingCycle)}
        options={[
          {
            label: (
              <Flexbox align={'center'} gap={6} horizontal paddingInline={8}>
                <span>年订阅</span>
                <Tag className={styles.discountTag} size={'small'}>
                  优惠
                </Tag>
              </Flexbox>
            ),
            value: 'yearly',
          },
          {
            label: '月订阅',
            value: 'monthly',
          },
          {
            label: '一次性付费',
            value: 'onetime',
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
