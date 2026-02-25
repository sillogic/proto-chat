'use client';

import { Tag } from '@lobehub/ui';
import { Table, TableColumnType, Typography, Space, Tabs } from 'antd';
import { memo, useState } from 'react';

import { parseAsInteger, useQueryParam } from '@/hooks/useQueryParam';
import { useClientDataSWR } from '@/libs/swr';
import { usageService } from '@/services/usage';
import { formatDate } from '@/utils/format';

import { UsageChartProps } from '../../types';

const { Text } = Typography;

const UsageConsumptionTable = memo<UsageChartProps>(({ dateStrings }) => {
  const [activeTab, setActiveTab] = useState<string>('all');

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

  // Common columns for all types
  const baseColumns: TableColumnType<any>[] = [
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
      render: (usageType, record) => {
        const typeMap: Record<string, { color: string; label: string }> = {
          chat: { color: 'processing', label: '文本生成' },
          embedding: { color: 'success', label: '向量化' },
          image: { color: 'warning', label: '文生图' },
        };

        // For embedding type, check operationType for more specific labeling
        if (usageType?.toLowerCase() === 'embedding' && record.operationType) {
          const embeddingTypeMap: Record<string, { color: string; label: string }> = {
            file_embedding: { color: 'success', label: '文件向量化' },
            semantic_search: { color: 'cyan', label: '语义搜索' },
            memory_search: { color: 'purple', label: '记忆搜索' },
          };
          const embeddingConfig = embeddingTypeMap[record.operationType];
          if (embeddingConfig) {
            return (
              <Tag bordered={false} color={embeddingConfig.color} style={{ fontWeight: 500 }}>
                {embeddingConfig.label}
              </Tag>
            );
          }
        }

        const config = typeMap[usageType?.toLowerCase()] || { color: 'default', label: usageType || '其他' };

        return (
          <Tag bordered={false} color={config.color} style={{ fontWeight: 500 }}>
            {config.label}
          </Tag>
        );
      },
      title: '类型',
      width: 120,
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
  ];

  // Token-based columns (for chat and embedding)
  const tokenColumns: TableColumnType<any>[] = [
    ...baseColumns,
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
      render: (val, record) => {
        const credits = Number(val);
        // For embedding operations, show as free but indicate backend cost if available
        if (record.usageType === 'embedding' && record.metadata?.costPrice) {
          return (
            <Space direction="vertical" size={0}>
              <Text strong style={{ color: '#52c41a' }}>免费</Text>
              <Text type="secondary" style={{ fontSize: '10px' }}>
                成本: ${Number(record.metadata.costPrice).toFixed(6)}
              </Text>
            </Space>
          );
        }
        return (
          <Text strong style={{ color: credits > 0 ? '#fa8c16' : '#52c41a' }}>
            {credits > 0 ? credits.toLocaleString() : '免费'}
          </Text>
        );
      },
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

  // Image-specific columns (no token usage or duration)
  const imageColumns: TableColumnType<any>[] = [
    ...baseColumns,
    {
      align: 'right',
      dataIndex: 'credits',
      key: 'credits',
      render: (val, record) => {
        const credits = Number(val);
        return (
          <Text strong style={{ color: credits > 0 ? '#fa8c16' : '#52c41a' }}>
            {credits > 0 ? credits.toLocaleString() : '免费'}
          </Text>
        );
      },
      title: '积分',
      width: 100,
    },
  ];

  // Filter data based on active tab
  const filteredData = data?.list?.filter((item: any) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'text') return item.usageType === 'chat' || item.usageType === 'embedding';
    if (activeTab === 'image') return item.usageType === 'image';
    return true;
  }) || [];

  return (
    <Tabs
      activeKey={activeTab}
      items={[
        {
          children: (
            <Table
              columns={tokenColumns}
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
          ),
          key: 'all',
          label: '全部',
        },
        {
          children: (
            <Table
              columns={tokenColumns}
              dataSource={filteredData}
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
                total: filteredData.length,
              }}
              rowKey="id"
              scroll={{ x: 'max-content' }}
              size="small"
            />
          ),
          key: 'text',
          label: '文本/向量',
        },
        {
          children: (
            <Table
              columns={imageColumns}
              dataSource={filteredData}
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
                total: filteredData.length,
              }}
              rowKey="id"
              scroll={{ x: 'max-content' }}
              size="small"
            />
          ),
          key: 'image',
          label: '图片生成',
        },
      ]}
      onChange={setActiveTab}
    />
  );
});

export default UsageConsumptionTable;
