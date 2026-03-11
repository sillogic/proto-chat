'use client';

import { Flexbox, Tag } from '@lobehub/ui';
import { Button, DatePicker, Empty, Input, Pagination, Select, Space, Table, Typography } from 'antd';
import { createStyles } from 'antd-style';
import type dayjs from 'dayjs';
import { memo, useState } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import { usageService } from '@/services/usage';
import { formatDate } from '@/utils/format';

const { Text } = Typography;
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

const ConsumptionContent = memo(() => {
  const { styles } = useStyles();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filter state
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [type, setType] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [appliedFilters, setAppliedFilters] = useState<{
    dateFrom?: string;
    dateTo?: string;
    model?: string;
    type?: string;
  }>({});

  const { data, isLoading } = useClientDataSWR(
    ['consumption-details-full', page, pageSize, appliedFilters],
    async () =>
      usageService.getConsumptionDetails({
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
      model: model.trim() || undefined,
      type: type || undefined,
    });
  };

  const handleReset = () => {
    setDateRange([null, null]);
    setType('');
    setModel('');
    setPage(1);
    setAppliedFilters({});
  };

  const columns = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: any) => (
        <Text style={{ fontSize: '12px' }} type="secondary">
          {formatDate(new Date(value))}
        </Text>
      ),
      title: '使用时间',
      width: 160,
    },
    {
      dataIndex: 'usageType',
      key: 'usageType',
      render: (usageType: string) => {
        const typeMap: Record<string, { color: string; label: string }> = {
          chat: { color: 'processing', label: '文本生成' },
          image: { color: 'warning', label: '文生图' },
        };
        const config = typeMap[usageType?.toLowerCase()] || { color: 'default', label: usageType || '其他' };
        return (
          <Tag color={config.color} style={{ fontWeight: 500 }} variant="filled">
            {config.label}
          </Tag>
        );
      },
      title: '类型',
      width: 100,
    },
    {
      dataIndex: 'model',
      key: 'model',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text strong style={{ fontSize: '13px' }}>
            {record.model}
          </Text>
          <Text style={{ fontSize: '10px' }} type="secondary">
            {record.provider?.toUpperCase()}
          </Text>
        </div>
      ),
      title: '模型',
    },
    {
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      render: (_: any, record: any) => {
        const hasTokens = (record.totalInputTokens || 0) > 0 || (record.totalOutputTokens || 0) > 0;

        if (record.usageType === 'image' && !hasTokens) {
          return <Text style={{ fontSize: '11px' }} type="secondary">-</Text>;
        }

        return (
          <Space size={8}>
            <Text strong>{Number(record.totalTokens || 0).toLocaleString()}</Text>
            <Text style={{ fontSize: '11px' }} type="secondary">
              = ↑ {record.totalInputTokens || 0} + ↓ {record.totalOutputTokens || 0}
            </Text>
          </Space>
        );
      },
      title: 'Token / 规格',
    },
    {
      align: 'right' as const,
      dataIndex: 'credits',
      key: 'credits',
      render: (val: any) => (
        <Text strong style={{ color: '#fa8c16' }}>
          {Number(val).toLocaleString()}
        </Text>
      ),
      title: '积分',
      width: 100,
    },
    {
      align: 'right' as const,
      dataIndex: 'duration',
      key: 'duration',
      render: (val: any) => (
        <Text style={{ fontSize: '12px' }} type="secondary">
          {val ? `${(Number(val) / 1000).toFixed(2)}s` : '-'}
        </Text>
      ),
      title: '用时',
      width: 80,
    },
  ];

  return (
    <Flexbox className={styles.container} gap={24}>
      <div className={styles.header}>
        <div className={styles.title}>计算积分使用明细</div>
        <div className={styles.subtitle}>文本生成、文生图等所有计算积分使用记录</div>
      </div>

      {/* Filters */}
      <Flexbox className={styles.filters} gap={12}>
        <Flexbox horizontal gap={12} wrap="wrap">
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            value={dateRange}
            onChange={(dates) => setDateRange(dates ? [dates[0], dates[1]] : [null, null])}
          />
          <Select
            allowClear
            placeholder="类型筛选"
            style={{ width: 130 }}
            value={type || undefined}
            options={[
              { label: '文本生成', value: 'chat' },
              { label: '图片生成', value: 'image' },
            ]}
            onChange={(val) => setType(val || '')}
          />
          <Input
            allowClear
            placeholder="模型名称"
            style={{ width: 200 }}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onPressEnter={handleSearch}
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
        scroll={{ x: 'max-content' }}
        size="small"
        locale={{
          emptyText: <Empty description="暂无使用记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
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

ConsumptionContent.displayName = 'ConsumptionContent';

export default ConsumptionContent;
