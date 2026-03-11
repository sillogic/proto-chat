'use client';

import { Tag } from '@lobehub/ui';
import type { TableColumnType} from 'antd';
import { Space,Table, Typography } from 'antd';
import { memo } from 'react';
import { LOBE_DEFAULT_MODEL_LIST } from 'model-bank';

import { useClientDataSWR } from '@/libs/swr';
import { usageService } from '@/services/usage';
import { formatDate } from '@/utils/format';

// Resolve internal model IDs to user-friendly display names.
// ProtoChat IDs have the format: protochat::{alias}::{cleanModelId}
const resolveModelDisplayName = (modelId: string): string => {
  if (!modelId || modelId === '-') return modelId;
  const parts = modelId.split('::');
  const cleanId = parts.length >= 3 ? parts.slice(2).join('::') : modelId;
  const entry = (LOBE_DEFAULT_MODEL_LIST as any[]).find((m: any) => m.id === cleanId || m.id === `${cleanId}:image`);
  return entry?.displayName || cleanId;
};

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
    render: (_, record) => (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Text strong style={{ fontSize: '13px' }}>
          {resolveModelDisplayName(record.model)}
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
