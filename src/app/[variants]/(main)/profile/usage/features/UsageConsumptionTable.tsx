'use client';

import { Tag } from '@lobehub/ui';
import { Table, TableColumnType, Typography, Space } from 'antd';
import { memo } from 'react';

import { parseAsInteger, useQueryParam } from '@/hooks/useQueryParam';
import { useClientDataSWR } from '@/libs/swr';
import { usageService } from '@/services/usage';
import { formatDate } from '@/utils/format';

import { UsageChartProps } from '../Client';

const { Text } = Typography;

const UsageConsumptionTable = memo<UsageChartProps>(({ dateStrings }) => {

  const [currentPage, setCurrentPage] = useQueryParam('c_current', parseAsInteger.withDefault(1), {
    clearOnDefault: true,
  });
  const [pageSize, setPageSize] = useQueryParam('c_pageSize', parseAsInteger.withDefault(5), {
    clearOnDefault: true,
  });

  const { data, isLoading } = useClientDataSWR(
    ['consumption-details', currentPage, pageSize, dateStrings],
    async () =>
      usageService.getUsageDetails({
        limit: pageSize,
        mo: dateStrings,
        offset: (currentPage - 1) * pageSize,
      }),
  );

  const columns: TableColumnType<any>[] = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => <Text style={{ fontSize: '12px' }} type="secondary">{formatDate(new Date(value))}</Text>,
      title: '使用时间',
      width: 160,
    },
    {
      dataIndex: 'usageType',
      key: 'usageType',
      render: (usageType) => {
        // Use more contrasty colors and remove icons as requested
        const typeMap: Record<string, { color: string; label: string }> = {
          chat: { color: 'processing', label: '文本生成' },
          embedding: { color: 'success', label: '向量化' },
          image: { color: 'warning', label: '文生图' },
        };

        const config = typeMap[usageType?.toLowerCase()] || { color: 'default', label: usageType || '其他' };

        return (
          <Tag bordered={false} color={config.color} style={{ fontWeight: 500 }}>
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
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text strong style={{ fontSize: '13px' }}>{record.model}</Text>
          <Text style={{ fontSize: '10px' }} type="secondary">{record.provider?.toUpperCase()}</Text>
        </div>
      ),
      title: '模型',
    },
    {
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      render: (_, record) => (
        <Space size={8}>
          <Text strong>{Number(record.totalTokens || 0).toLocaleString()}</Text>
          <Text style={{ fontSize: '11px' }} type="secondary">
            = ↓ {record.totalInputTokens || 0} + ↑ {record.totalOutputTokens || 0}
          </Text>
        </Space>
      ),
      title: 'Token 用量',
    },
    {
      align: 'right',
      dataIndex: 'credits',
      key: 'credits',
      render: (val) => (
        <Text strong style={{ color: '#fa8c16' }}>{Number(val).toLocaleString()}</Text>
      ),
      title: '积分',
      width: 100,
    },
    {
        align: 'right',
        dataIndex: 'duration',
        key: 'duration',
        render: (val) => (
          <Text style={{ fontSize: '12px' }} type="secondary">{val ? `${(Number(val) / 1000).toFixed(2)}s` : '-'}</Text>
        ),
        title: '用时',
        width: 80,
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data?.list || []}
      loading={isLoading}
      pagination={{
        current: currentPage,
        onChange: (page) => {
          setCurrentPage(page);
        },
        onShowSizeChange: (current, size) => {
          setCurrentPage(current);
          setPageSize(size);
        },
        pageSize,
        total: data?.total || 0,
      }}
      rowKey="id"
      scroll={{ x: 'max-content' }}
      size="small"
    />
  );
});

export default UsageConsumptionTable;
