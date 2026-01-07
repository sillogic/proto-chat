import { PageContainer } from '@ant-design/pro-components';
import { ProTable, ProColumns } from '@ant-design/pro-components';
import { Typography, Tag, Space, Card, Statistic, Row, Col } from 'antd';
import { request } from 'umi';
import React from 'react';
import { ClockCircleOutlined, UserOutlined, CrownOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface SubscriptionRecord {
  id: string;
  userId: string;
  fullName?: string;
  email?: string;
  amount: string;
  type: string;
  category: string;
  description: string;
  createdAt: string;
  metadata?: any;
}

const SubscriptionRecords: React.FC = () => {
  const columns: ProColumns<SubscriptionRecord>[] = [
    {
      title: '交易 ID',
      dataIndex: 'id',
      copyable: true,
      ellipsis: true,
      width: 150,
      search: false,
    },
    {
      title: '关联用户',
      dataIndex: 'userId',
      width: 220,
      render: (_, record) => {
        const displayName = record.fullName || record.email || record.userId;
        return (
          <Space direction="vertical" size={0}>
            <Space>
              <UserOutlined style={{ color: '#1890ff' }} />
              <Text strong>{displayName}</Text>
            </Space>
            {record.fullName && record.email && (
               <Text type="secondary" style={{ fontSize: '11px' }}>{record.email}</Text>
            )}
            {displayName !== record.userId && (
               <Text type="secondary" style={{ fontSize: '10px' }}>ID: {record.userId}</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '订阅套餐',
      dataIndex: 'planName',
      render: (_, record) => {
        const name = record.metadata?.planName || record.description.replace('Plan Subscription Grant: ', '') || '-';
        return (
          <Space>
            <CrownOutlined style={{ color: '#faad14' }} />
            <Text strong>{name}</Text>
          </Space>
        );
      },
      width: 150,
    },
    {
      title: '订阅价格',
      dataIndex: 'price',
      width: 120,
      render: (_, record) => {
        if (!record.metadata?.price) return '-';
        return `${record.metadata.currency || 'CNY'} ${record.metadata.price}`;
      },
      search: false,
    },
    {
      title: '重置额度 (积分)',
      dataIndex: 'amount',
      width: 130,
      align: 'right',
      render: (val) => (
        <Text strong style={{ color: '#52c41a' }}>
          {Number(val).toLocaleString()}
        </Text>
      ),
      search: false,
    },
    {
      title: '变更内容',
      dataIndex: 'description',
      ellipsis: true,
      render: (_, record) => {
        const isGrant = record.type === 'SUBSCRIPTION_GRANT';
        return (
          <Space direction="vertical" size={2}>
            <Space>
              <Tag color={isGrant ? 'gold' : 'blue'}>
                {isGrant ? '套餐订阅' : record.type.replace('_', ' ')}
              </Tag>
              <Text>{record.description}</Text>
            </Space>
            {record.category && <Text type="secondary" style={{ fontSize: '12px' }}>分类: {record.category}</Text>}
          </Space>
        );
      },
    },
    {
      title: '订阅时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      width: 170,
      search: false,
    },
    {
      title: '到期时间',
      dataIndex: ['metadata', 'expiresAt'],
      valueType: 'dateTime',
      width: 170,
      search: false,
    },
  ];

  return (
    <PageContainer title="订阅与赠送记录" subTitle="查看系统中所有套餐变更和额度赠送的历史流水">
      <ProTable<SubscriptionRecord>
        headerTitle="流水记录"
        columns={columns}
        request={async (params) => {
          const response = await request('/api/admin/subscriptions/records', {
            params: {
              page: params.current,
              limit: params.pageSize,
              search: params.keyword || params.userId || '',
            },
          });
          return {
            data: response.data.list,
            success: response.success,
            total: response.data.pagination.total,
          };
        }}
        rowKey="id"
        pagination={{
          showQuickJumper: true,
          pageSize: 20,
        }}
        search={{
            labelWidth: 'auto',
        }}
        options={{
          fullScreen: true,
          setting: true,
          reload: true,
        }}
      />
    </PageContainer>
  );
};

export default SubscriptionRecords;
