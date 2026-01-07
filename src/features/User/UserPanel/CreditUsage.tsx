'use client';

import { Progress } from 'antd';
import { createStyles } from 'antd-style';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useClientDataSWR } from '@/libs/swr';
import { usageService } from '@/services/usage';
import { formatShortenNumber } from '@/utils/format';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    padding-block: 8px 12px;
    padding-inline: 16px;
    border-block-end: 1px solid ${token.colorBorderSecondary};
  `,
  label: css`
    font-size: 12px;
    color: ${token.colorTextDescription};
  `,
  value: css`
    font-size: 13px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  `,
}));

const CreditUsage = memo(() => {
  const { styles } = useStyles();

  const { data: stats, isLoading } = useClientDataSWR('getAccountStatistics', () =>
    usageService.getAccountStatistics(),
  );

  if (isLoading || !stats) return null;

  const { totalConsumed, limit } = stats.balance;
  const percent = limit > 0 ? Math.min(100, (totalConsumed / limit) * 100) : 0;

  return (
    <Flexbox className={styles.container} gap={8}>
      <Flexbox align={'center'} horizontal justify={'space-between'}>
        <div className={styles.label}>积分额度</div>
        <div className={styles.value}>
          {formatShortenNumber(totalConsumed)} / {formatShortenNumber(limit)}
        </div>
      </Flexbox>
      <Progress
        percent={percent}
        showInfo={false}
        size={['100%', 6]}
        strokeColor={{ '0%': '#1890ff', '100%': '#36cfc9' }}
      />
    </Flexbox>
  );
});

export default CreditUsage;
