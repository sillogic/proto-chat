'use client';

import { Icon, Segmented } from '@lobehub/ui';
import { Col, DatePicker, DatePickerProps, Row, Typography } from 'antd';
import dayjs from 'dayjs';
import { Brain, Codesandbox } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from '@lobehub/ui';

import { useClientDataSWR } from '@/libs/swr';
import { usageService } from '@/services/usage';
import { UsageLog } from '@/types/usage/usageRecord';

import Welcome from '../stats/features/Welcome';
import AccountSummary from './features/AccountSummary';
import UsageCards from './features/UsageCards';
import UsageConsumptionTable from './features/UsageConsumptionTable';
import UsageTable from './features/UsageTable';
import UsageTrends from './features/UsageTrends';

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
  const { t, i18n } = useTranslation('auth');
  dayjs.locale(i18n.language);

  const [groupBy, setGroupBy] = useState<GroupBy>(GroupBy.Model);
  const [dateRange, setDateRange] = useState<dayjs.Dayjs>(dayjs(new Date()));
  const [dateStrings, setDateStrings] = useState<string>(dayjs().format('YYYY-MM'));

  const { data, isLoading, mutate } = useClientDataSWR(['usage-stat', dateStrings], async () =>
    usageService.findAndGroupByDay(dateStrings),
  );

  const { data: statsData, isLoading: isStatsLoading } = useClientDataSWR(
    ['account-statistics', dateStrings],
    async () => usageService.getAccountStatistics({ mo: dateStrings }),
  );

  useEffect(() => {
    if (dateStrings) {
      mutate();
    }
  }, [dateStrings]);

  const handleDateChange: DatePickerProps['onChange'] = (dates, dateStrings) => {
    setDateRange(dates);
    if (typeof dateStrings === 'string') {
      setDateStrings(dateStrings);
    }
  };

  return (
    <Flexbox gap={mobile ? 0 : 24}>
      <Flexbox>
        <Row>
          <Col span={16}>
            {mobile ? (
              <Welcome mobile />
            ) : (
              <Flexbox align={'flex-start'} gap={16} horizontal justify={'space-between'}>
                <Welcome />
              </Flexbox>
            )}
          </Col>
          <Col span={8}>
            <Flexbox gap={16} horizontal justify={'flex-end'}>
              <Segmented
                onChange={(v) => setGroupBy(v as GroupBy)}
                options={[
                  {
                    icon: <Icon icon={Codesandbox} />,
                    label: t('usage.welcome.model'),
                    value: GroupBy.Model,
                  },
                  {
                    icon: <Icon icon={Brain} />,
                    label: t('usage.welcome.provider'),
                    value: GroupBy.Provider,
                  },
                ]}
                value={groupBy}
              />
              <DatePicker onChange={handleDateChange} picker="month" value={dateRange} />
            </Flexbox>
          </Col>
        </Row>
      </Flexbox>
      <Flexbox>
        <UsageCards data={data} groupBy={groupBy} isLoading={isLoading} />
      </Flexbox>
      <Flexbox>
        <AccountSummary data={statsData} isLoading={isStatsLoading} />
      </Flexbox>
      <Flexbox>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <UsageTrends data={data} groupBy={groupBy} isLoading={isLoading} />
          </Col>
        </Row>
      </Flexbox>
      <Flexbox gap={40}>
        <Flexbox gap={16}>
          <Flexbox gap={4}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              计算积分使用明细
            </Typography.Title>
            <Typography.Text style={{ fontSize: '12px' }} type="secondary">
              文本生成、向量化、文生图等计算积分使用明细
            </Typography.Text>
          </Flexbox>
          <UsageConsumptionTable data={data} groupBy={groupBy} isLoading={isLoading} />
        </Flexbox>

        <Flexbox gap={16}>
          <Flexbox gap={4}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              账户流水记录
            </Typography.Title>
            <Typography.Text style={{ fontSize: '12px' }} type="secondary">
              余额变更明细，包含充值、赠送、周期重置及系统扣费流水
            </Typography.Text>
          </Flexbox>
          <UsageTable dateStrings={dateStrings} />
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

export default Client;
