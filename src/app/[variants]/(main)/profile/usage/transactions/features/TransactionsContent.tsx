'use client';

import { Flexbox, Tag } from '@lobehub/ui';
import { Button, DatePicker, Empty, Pagination, Table, Typography } from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import { memo, useState } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import { usageService } from '@/services/usage';
import { formatNumber } from '@/utils/format';

const { RangePicker } = DatePicker;

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    max-width: 1400px;
    margin-block: 0;
    margin-inline: auto;
    padding: 24px;
  `,
  filters: css`
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
  `,
  header: css`
    margin-block-end: 24px;
  `,
  subtitle: css`
    margin-block-start: 4px;
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  title: css`
    font-size: 20px;
    font-weight: 600;
    color: ${token.colorText};
  `,
}));

const TransactionsContent = memo(() => {
  const { styles } = useStyles();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [appliedFilters, setAppliedFilters] = useState<{
    dateFrom?: string;
    dateTo?: string;
  }>({});

  const { data, isLoading } = useClientDataSWR(
    ['transactions-full', page, pageSize, appliedFilters],
    async () =>
      usageService.getTransactions({
        ...appliedFilters,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
  );

  const handleSearch = () => {
    setPage(1);
    setAppliedFilters({
      dateFrom: dateRange[0] ? dateRange[0].startOf('day').toISOString() : undefined,
      dateTo: dateRange[1] ? dateRange[1].endOf('day').toISOString() : undefined,
    });
  };

  const handleReset = () => {
    setDateRange([null, null]);
    setPage(1);
    setAppliedFilters({});
  };

  const columns = [
    {
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Typography.Text copyable style={{ color: '#8c8c8c', fontSize: '12px' }}>
          {id}
        </Typography.Text>
      ),
      title: '交易流水号',
      width: 150,
    },
    {
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const categoryMap: any = {
          ADJUSTMENT: { color: 'purple', label: '人工调账' },
          CONSUMPTION: { color: 'orange', label: 'AI消费' },
          DEPOSIT: { color: 'green', label: '赠送/充值' },
          IMAGE_GENERATION: { color: 'gold', label: '图片生成' },
          REFUND: { color: 'blue', label: '退款' },
          RESET: { color: 'default', label: '周期重置' },
        };
        const item = categoryMap[category] || { color: 'default', label: category };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
      title: '业务类别',
      width: 120,
    },
    {
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag>{type}</Tag>,
      title: '交易类型',
      width: 100,
    },
    {
      dataIndex: 'amount',
      key: 'amount',
      render: (value: any) => {
        const num = Number(value);
        const prefix = num > 0 ? '+' : '';
        const color = num > 0 ? 'green' : 'red';
        return (
          <Typography.Text style={{ color }}>
            {prefix}
            {formatNumber(num, 0)}
          </Typography.Text>
        );
      },
      title: '变动数额',
    },
    {
      dataIndex: 'balanceAfter',
      key: 'balanceAfter',
      render: (value: any) => formatNumber(Number(value || 0), 0),
      title: '变动后余额',
    },
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: any) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
      title: '时间',
      width: 180,
    },
  ];

  return (
    <Flexbox className={styles.container} gap={24}>
      <div className={styles.header}>
        <div className={styles.title}>账户流水记录</div>
        <div className={styles.subtitle}>余额变更明细，包含充值、赠送、周期重置及系统扣费流水</div>
      </div>

      {/* Filters */}
      <Flexbox className={styles.filters} gap={12}>
        <Flexbox horizontal gap={12} wrap="wrap">
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            value={dateRange}
            onChange={(dates) => setDateRange(dates ? [dates[0], dates[1]] : [null, null])}
          />
          <Button type="primary" onClick={handleSearch}>
            筛选
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Flexbox>
      </Flexbox>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={data?.list || []}
        loading={isLoading}
        pagination={false}
        rowKey="id"
        size="small"
        locale={{
          emptyText: <Empty description="暂无流水记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        }}
      />

      {/* Pagination */}
      {data && data.total > 0 && (
        <Flexbox horizontal align="center" justify="flex-end">
          <Pagination
            showQuickJumper
            showSizeChanger
            current={page}
            pageSize={pageSize}
            pageSizeOptions={['20', '50', '100']}
            showTotal={(total) => `共 ${total} 条记录`}
            total={data.total}
            onChange={(newPage, newPageSize) => {
              setPage(newPage);
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize);
                setPage(1);
              }
            }}
          />
        </Flexbox>
      )}
    </Flexbox>
  );
});

TransactionsContent.displayName = 'TransactionsContent';

export default TransactionsContent;
