import { PageContainer } from '@ant-design/pro-components';
import { ProTable, ProColumns } from '@ant-design/pro-components';
import { Typography, Tag, Space } from 'antd';
import { request } from 'umi';
import React from 'react';
import { UserOutlined, CrownOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface SubscriptionRecord {
  id: string;
  userId: string;
  planName: string;
  planType: string;
  planId?: string;
  slug: string;
  price?: number;
  paymentMethod?: string;
  isActive: boolean;
  status: string;
  autoRenew: boolean;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  fullName?: string;
  email?: string;
}

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '生效中', color: 'green' },
  canceled: { text: '已取消', color: 'orange' },
  expired: { text: '已过期', color: 'default' },
  past_due: { text: '已逾期', color: 'red' },
  upgraded: { text: '已升级', color: 'blue' },
};

const SubscriptionRecords: React.FC = () => {
  const columns: ProColumns<SubscriptionRecord>[] = [
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
      width: 150,
      render: (_, record) => (
        <Space>
          <CrownOutlined style={{ color: '#faad14' }} />
          <Text strong>{record.planName}</Text>
        </Space>
      ),
    },
    {
      title: '套餐类型',
      dataIndex: 'planType',
      width: 100,
      render: (val) => (
        <Tag color={val === 'team' ? 'blue' : 'green'}>
          {val === 'team' ? '团队' : '个人'}
        </Tag>
      ),
      search: false,
    },
    {
      title: '订阅价格',
      dataIndex: 'price',
      width: 100,
      render: (_, record) => {
        if (record.price == null) return '-';
        return `¥ ${(record.price / 100).toFixed(2)}`;
      },
      search: false,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => {
        const s = statusMap[record.status] || { text: record.status, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
      valueEnum: {
        active: { text: '生效中' },
        canceled: { text: '已取消' },
        expired: { text: '已过期' },
        upgraded: { text: '已升级' },
      },
    },
    {
      title: '自动续费',
      dataIndex: 'autoRenew',
      width: 90,
      render: (val) => (
        <Tag color={val ? 'green' : 'default'}>{val ? '是' : '否'}</Tag>
      ),
      search: false,
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      valueType: 'dateTime',
      width: 170,
      search: false,
    },
    {
      title: '到期时间',
      dataIndex: 'endedAt',
      valueType: 'dateTime',
      width: 170,
      search: false,
    },
  ];

  return (
    <PageContainer title="订阅记录" subTitle="查看系统中所有用户的订阅历史记录">
      <ProTable<SubscriptionRecord>
        headerTitle="订阅记录列表"
        columns={columns}
        request={async (params) => {
          const response = await request('/api/admin/subscriptions/records', {
            params: {
              page: params.current,
              limit: params.pageSize,
              search: params.keyword || params.userId || params.planName || '',
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
