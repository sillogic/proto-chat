import { PageContainer } from '@ant-design/pro-components';
import { ProTable, ProColumns } from '@ant-design/pro-components';
import { Typography, Tag, Space, Tooltip } from 'antd';
import { request } from 'umi';
import React from 'react';
import {
  UserOutlined,
  CrownOutlined,
  WechatOutlined,
  AlipayCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface PaymentOrder {
  id: string;
  orderNo: string;
  userId: string;
  userFullName?: string;
  userEmail?: string;
  planId: string;
  planName: string;
  planSlug: string;
  planInterval: 'month' | 'year';
  amount: number;
  currency: string;
  subscriptionType: 'recurring' | 'onetime';
  durationMonths?: number;
  payChannel: string;
  channelOrderNo?: string;
  status: string;
  expiredAt: string;
  paidAt?: string;
  closedAt?: string;
  createdAt: string;
}

const statusMap: Record<string, { text: string; color: string; icon: any }> = {
  pending: { text: '待支付', color: 'orange', icon: <ClockCircleOutlined /> },
  paid: { text: '已支付', color: 'green', icon: <CheckCircleOutlined /> },
  closed: { text: '已关闭', color: 'default', icon: <CloseCircleOutlined /> },
  refunded: { text: '已退款', color: 'red', icon: <CloseCircleOutlined /> },
};

const payChannelMap: Record<string, { text: string; color: string; icon: any }> = {
  wechat_native: { text: '微信支付', color: 'green', icon: <WechatOutlined /> },
  alipay_precreate: { text: '支付宝', color: 'blue', icon: <AlipayCircleOutlined /> },
};

const PaymentOrders: React.FC = () => {
  const columns: ProColumns<PaymentOrder>[] = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      width: 200,
      fixed: 'left',
      copyable: true,
      ellipsis: true,
      render: (_, record) => (
        <Tooltip title={record.orderNo}>
          <Text code style={{ fontSize: '11px' }}>
            {record.orderNo.slice(0, 20)}...
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '关联用户',
      dataIndex: 'userId',
      width: 200,
      render: (_, record) => {
        const displayName = record.userFullName || record.userEmail || record.userId;
        return (
          <Space direction="vertical" size={0}>
            <Space size={4}>
              <UserOutlined style={{ color: '#1890ff' }} />
              <Text strong style={{ fontSize: '12px' }}>
                {displayName.length > 15 ? `${displayName.slice(0, 15)}...` : displayName}
              </Text>
            </Space>
            {record.userFullName && record.userEmail && (
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {record.userEmail}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '订阅方案',
      dataIndex: 'planName',
      width: 150,
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
        const color = planColorMap[record.planSlug] || '#faad14';
        return (
          <Space direction="vertical" size={0}>
            <Space size={4}>
              <CrownOutlined style={{ color }} />
              <Text strong style={{ fontSize: '12px' }}>
                {record.planName}
              </Text>
            </Space>
            <Tag color="blue" style={{ fontSize: '10px', marginTop: 2 }}>
              {record.planInterval === 'year' ? '年付' : '月付'}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: '订阅类型',
      dataIndex: 'subscriptionType',
      width: 100,
      render: (_, record) => {
        if (record.subscriptionType === 'onetime') {
          return (
            <Space direction="vertical" size={0}>
              <Tag color="purple">一次性</Tag>
              {record.durationMonths && (
                <Text type="secondary" style={{ fontSize: '10px' }}>
                  {record.durationMonths}个月
                </Text>
              )}
            </Space>
          );
        }
        return <Tag color="cyan">循环订阅</Tag>;
      },
      valueEnum: {
        onetime: { text: '一次性' },
        recurring: { text: '循环订阅' },
      },
    },
    {
      title: '支付金额',
      dataIndex: 'amount',
      width: 110,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: '#fa8c16', fontSize: '13px' }}>
            ¥ {(record.amount / 100).toFixed(2)}
          </Text>
          <Text type="secondary" style={{ fontSize: '10px' }}>
            {record.currency}
          </Text>
        </Space>
      ),
      search: false,
    },
    {
      title: '支付方式',
      dataIndex: 'payChannel',
      width: 100,
      render: (val) => {
        const channel = payChannelMap[val] || { text: val, color: 'default', icon: null };
        return (
          <Tag icon={channel.icon} color={channel.color}>
            {channel.text}
          </Tag>
        );
      },
      valueEnum: {
        wechat_native: { text: '微信支付' },
        alipay_precreate: { text: '支付宝' },
      },
    },
    {
      title: '订单状态',
      dataIndex: 'status',
      width: 100,
      render: (val) => {
        const s = statusMap[val] || { text: val, color: 'default', icon: null };
        return (
          <Tag icon={s.icon} color={s.color}>
            {s.text}
          </Tag>
        );
      },
      valueEnum: {
        pending: { text: '待支付' },
        paid: { text: '已支付' },
        closed: { text: '已关闭' },
        refunded: { text: '已退款' },
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      width: 160,
      search: false,
      sorter: true,
    },
    {
      title: '支付时间',
      dataIndex: 'paidAt',
      valueType: 'dateTime',
      width: 160,
      search: false,
      render: (val) => {
        if (!val) return <Text type="secondary">-</Text>;
        return val;
      },
    },
    {
      title: '过期时间',
      dataIndex: 'expiredAt',
      valueType: 'dateTime',
      width: 160,
      search: false,
      hideInTable: true,
    },
  ];

  return (
    <PageContainer
      title="支付订单管理"
      subTitle="查看和管理所有支付订单记录（微信、支付宝）"
    >
      <ProTable<PaymentOrder>
        headerTitle="支付订单列表"
        columns={columns}
        request={async (params, sort) => {
          const response = await request('/api/admin/payments/orders', {
            params: {
              page: params.current,
              limit: params.pageSize,
              search: params.keyword || params.orderNo || params.userId || '',
              status: params.status || '',
              payChannel: params.payChannel || '',
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
          showSizeChanger: true,
          pageSize: 20,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        search={{
          labelWidth: 'auto',
          defaultCollapsed: false,
        }}
        options={{
          fullScreen: true,
          setting: true,
          reload: true,
          density: true,
        }}
        scroll={{ x: 1400 }}
        dateFormatter="string"
      />
    </PageContainer>
  );
};

export default PaymentOrders;
