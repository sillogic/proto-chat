'use client';

import { Typography } from 'antd';
import { memo } from 'react';
import { Flexbox } from '@lobehub/ui';

import { useClientDataSWR } from '@/libs/swr';
import { usageService } from '@/services/usage';
import { UsageLog } from '@/types/usage/usageRecord';

import AccountSummary from './features/AccountSummary';
import UsageConsumptionTable from './features/UsageConsumptionTable';
import UsageTable from './features/UsageTable';

export interface UsageChartProps {
  data?: UsageLog[];
  dateStrings?: string;
  groupBy?: GroupBy;
  inShare?: boolean;
  isLoading?: boolean;
  mobile?: boolean;
}

export enum GroupBy {
  Model = 'model',
  Provider = 'provider',
}

const Client = memo<{ mobile?: boolean }>(({ mobile }) => {
  const { data: statsData, isLoading: isStatsLoading } = useClientDataSWR(
    'account-statistics',
    async () => usageService.getAccountStatistics(),
  );

  return (
    <Flexbox gap={mobile ? 0 : 24}>
      <AccountSummary data={statsData} isLoading={isStatsLoading} />
      <Flexbox gap={40}>
        <Flexbox gap={16}>
          <Flexbox align="center" horizontal justify="space-between">
            <Flexbox gap={4}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                计算积分使用明细
              </Typography.Title>
              <Typography.Text style={{ fontSize: '12px' }} type="secondary">
                文本生成、文生图等计算积分使用明细（最新10条）
              </Typography.Text>
            </Flexbox>
            <a href="/profile/usage/consumption" rel="noopener noreferrer" target="_blank">
              <Typography.Link style={{ fontSize: '13px' }}>查看全部 ↗</Typography.Link>
            </a>
          </Flexbox>
          <UsageConsumptionTable />
        </Flexbox>

        <Flexbox gap={16}>
          <Flexbox align="center" horizontal justify="space-between">
            <Flexbox gap={4}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                账户流水记录
              </Typography.Title>
              <Typography.Text style={{ fontSize: '12px' }} type="secondary">
                余额变更明细，包含充值、赠送、周期重置及系统扣费流水（最新10条）
              </Typography.Text>
            </Flexbox>
            <a href="/profile/usage/transactions" rel="noopener noreferrer" target="_blank">
              <Typography.Link style={{ fontSize: '13px' }}>查看全部 ↗</Typography.Link>
            </a>
          </Flexbox>
          <UsageTable />
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

export default Client;
