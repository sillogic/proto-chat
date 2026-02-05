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
  billingInterval?: 'month' | 'year' | null;
  subscriptionType?: 'recurring' | 'onetime';
  durationMonths?: number | null;
  orderNo?: string;
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
      search: false,
    },
    {
      title: '订阅类型',
      dataIndex: 'subscriptionType',
      width: 140,
      render: (_, record) => {
        if (!record.subscriptionType || record.subscriptionType === 'recurring') {
          // 循环订阅
          const interval = record.billingInterval;
          if (interval === 'year') {
            return <Tag color="cyan">连续包年</Tag>;
          } else if (interval === 'month') {
            return <Tag color="blue">连续包月</Tag>;
          }
          return <Tag color="cyan">循环订阅</Tag>;
        } else {
          // 一次性付款
          return (
            <Space direction="vertical" size={0}>
              <Tag color="purple">一次性</Tag>
              {record.durationMonths && (
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {record.durationMonths}个月
                </Text>
              )}
            </Space>
          );
        }
      },
      valueEnum: {
        recurring: { text: '循环订阅' },
        onetime: { text: '一次性' },
      },
    },
    {
      title: '订阅套餐',
      dataIndex: 'planName',
      width: 160,
      render: (_, record) => {
        const planColorMap: Record<string, string> = {
          free: '#1890ff',
          plan_free: '#1890ff',
          lite: '#52c41a',
          plan_lite: '#52c41a',
          pro: '#faad14',
          plan_pro: '#faad14',
          ultra: '#722ed1',
          plan_ultra: '#722ed1',
        };
        const color = planColorMap[record.slug] || '#faad14';
        return (
          <Space>
            <CrownOutlined style={{ color }} />
            <Text strong>{record.planName}</Text>
          </Space>
        );
      },
      search: false,
    },
    {
      title: '方案级别',
      dataIndex: 'slug',
      width: 100,
      render: (slug) => {
        const levelMap: Record<string, { text: string; color: string }> = {
          free: { text: 'Free', color: 'default' },
          plan_free: { text: 'Free', color: 'default' },
          lite: { text: 'Lite', color: 'green' },
          plan_lite: { text: 'Lite', color: 'green' },
          pro: { text: 'Pro', color: 'gold' },
          plan_pro: { text: 'Pro', color: 'gold' },
          ultra: { text: 'Ultra', color: 'purple' },
          plan_ultra: { text: 'Ultra', color: 'purple' },
        };
        const level = levelMap[slug] || { text: slug, color: 'default' };
        return <Tag color={level.color}>{level.text}</Tag>;
      },
      valueEnum: {
        free: { text: 'Free' },
        plan_free: { text: 'Free' },
        lite: { text: 'Lite' },
        plan_lite: { text: 'Lite' },
        pro: { text: 'Pro' },
        plan_pro: { text: 'Pro' },
        ultra: { text: 'Ultra' },
        plan_ultra: { text: 'Ultra' },
      },
    },
    {
      title: '订阅价格',
      dataIndex: 'price',
      width: 100,
      render: (_, record) => {
        if (record.price == null || record.price === 0) return '-';
        return `¥ ${(record.price / 100).toFixed(2)}`;
      },
      search: false,
    },
    {
      title: '订阅状态',
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
      title: '生效时间',
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
    {
      title: '订单号',
      dataIndex: 'orderNo',
      width: 180,
      render: (_, record) => {
        if (!record.orderNo) return '-';
        return (
          <a
            href={`/payments/orders?search=${record.orderNo}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {record.orderNo}
          </a>
        );
      },
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
              status: params.status,
              subscriptionType: params.subscriptionType,
              slug: params.slug,
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
