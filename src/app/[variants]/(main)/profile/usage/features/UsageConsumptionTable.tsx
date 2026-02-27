'use client';

import { Tag } from '@lobehub/ui';
import { Table, TableColumnType, Typography, Space } from 'antd';
import { memo } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import { usageService } from '@/services/usage';
import { formatDate } from '@/utils/format';

const { Text } = Typography;

const baseColumns: TableColumnType<any>[] = [
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (value) => (
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
    render: (usageType) => {
      const typeMap: Record<string, { color: string; label: string }> = {
        chat: { color: 'processing', label: '文本生成' },
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
    render: (_, record) => {
      if (record.usageType === 'image') {
        const meta = (record.metadata as any) || {};
        if (meta.width && meta.height) {
          return (
            <Text style={{ fontSize: '12px' }} type="secondary">
              {meta.width}×{meta.height}px
            </Text>
          );
        }
        return (
          <Text style={{ fontSize: '11px' }} type="secondary">
            按次计费
          </Text>
        );
      }
      return (
        <Space size={8}>
          <Text strong>{Number(record.totalTokens || 0).toLocaleString()}</Text>
          <Text style={{ fontSize: '11px' }} type="secondary">
            = ↓ {record.totalInputTokens || 0} + ↑ {record.totalOutputTokens || 0}
          </Text>
        </Space>
      );
    },
    title: 'Token / 规格',
  },
  {
    align: 'right',
    dataIndex: 'credits',
    key: 'credits',
    render: (val) => (
      <Text strong style={{ color: '#fa8c16' }}>
        {Number(val).toLocaleString()}
      </Text>
    ),
    title: '积分',
    width: 100,
  },
  {
    align: 'right',
    dataIndex: 'duration',
    key: 'duration',
    render: (val) => (
      <Text style={{ fontSize: '12px' }} type="secondary">
        {val ? `${(Number(val) / 1000).toFixed(2)}s` : '-'}
      </Text>
    ),
    title: '用时',
    width: 80,
  },
];

const UsageConsumptionTable = memo(() => {
  const { data, isLoading } = useClientDataSWR('consumption-preview', async () =>
    usageService.getConsumptionDetails({ limit: 10, offset: 0 }),
  );

  const filteredData = data?.list || [];

  return (
    <Table
      columns={baseColumns}
      dataSource={filteredData}
      loading={isLoading}
      pagination={false}
      rowKey="id"
      scroll={{ x: 'max-content' }}
      size="small"
    />
  );
});

export default UsageConsumptionTable;
