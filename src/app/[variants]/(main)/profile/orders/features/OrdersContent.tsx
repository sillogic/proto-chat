'use client';

import { Icon, Tag } from '@lobehub/ui';
import { Alert, Button, Empty, Pagination, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createStyles } from 'antd-style';
import { AlertCircle, CheckCircle, Clock, Eye, XCircle } from 'lucide-react';
import { memo, useState } from 'react';
import { Flexbox } from '@lobehub/ui';
import { useQuery } from '@tanstack/react-query';

import { lambdaClient } from '@/libs/trpc/client';

import OrderDetailModal from './OrderDetailModal';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  container: css`
    padding: 24px;
  `,
  header: css`
    margin-block-end: 24px;
  `,
  subtitle: css`
    margin-block-start: 4px;
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  table: css`
    .ant-table {
      background: ${isDarkMode ? token.colorBgElevated : token.colorBgContainer};
    }
  `,
  title: css`
    font-size: 20px;
    font-weight: 600;
    color: ${token.colorText};
  `,
}));

interface OrderRecord {
  amount: number;
  createdAt: string;
  currency: string;
  durationMonths?: number | null;
  expiredAt: string;
  id: string;
  orderNo: string;
  paidAt?: string | null;
  payChannel: string;
  planInterval: string;
  planName: string;
  planSlug: string;
  status: string;
  subscriptionType: string;
}

// Helper functions
const renderPayChannel = (channel: string) => {
  const channelMap = {
    alipay_precreate: '支付宝',
    wechat_native: '微信支付',
  };
  return channelMap[channel as keyof typeof channelMap] || channel;
};

const renderSubscriptionType = (
  type: string,
  durationMonths?: number | null,
  planInterval?: string,
) => {
  if (type === 'onetime') {
    return `一次性（${durationMonths || 1}个月）`;
  }
  return planInterval === 'year' ? '年订阅' : '月订阅';
};

const OrdersContent = memo(() => {
  const { styles } = useStyles();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // Fetch orders from backend
  const { data, isLoading, error } = useQuery({
    queryFn: () =>
      lambdaClient.payment.getOrderHistory.query({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    queryKey: ['payment', 'orderHistory', page, pageSize],
  });

  // Handle view detail
  const handleViewDetail = (order: OrderRecord) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  // Status badge renderer
  const renderStatus = (status: string) => {
    const statusConfig = {
      closed: {
        color: 'default',
        icon: XCircle,
        text: '已关闭',
      },
      paid: {
        color: 'success',
        icon: CheckCircle,
        text: '已支付',
      },
      pending: {
        color: 'processing',
        icon: Clock,
        text: '待支付',
      },
      refunded: {
        color: 'warning',
        icon: AlertCircle,
        text: '已退款',
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.closed;

    return (
      <Tag color={config.color} icon={<Icon icon={config.icon} size={14} />}>
        {config.text}
      </Tag>
    );
  };

  // Table columns
  const columns: ColumnsType<OrderRecord> = [
    {
      dataIndex: 'orderNo',
      ellipsis: {
        showTitle: false,
      },
      key: 'orderNo',
      render: (orderNo: string) => (
        <Tooltip title={orderNo}>
          <span style={{ fontFamily: 'monospace' }}>{orderNo}</span>
        </Tooltip>
      ),
      title: '订单号',
      width: 200,
    },
    {
      dataIndex: 'planName',
      key: 'planName',
      title: '方案',
      width: 120,
    },
    {
      key: 'subscriptionType',
      render: (_, record) =>
        renderSubscriptionType(record.subscriptionType, record.durationMonths, record.planInterval),
      title: '类型',
      width: 150,
    },
    {
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `¥${(amount / 100).toFixed(2)}`,
      title: '金额',
      width: 100,
    },
    {
      dataIndex: 'payChannel',
      key: 'payChannel',
      render: renderPayChannel,
      title: '支付方式',
      width: 100,
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: renderStatus,
      title: '状态',
      width: 100,
    },
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
      title: '创建时间',
      width: 180,
    },
    {
      dataIndex: 'paidAt',
      key: 'paidAt',
      render: (date: string | null) =>
        date ? new Date(date).toLocaleString('zh-CN') : '-',
      title: '支付时间',
      width: 180,
    },
    {
      fixed: 'right',
      key: 'action',
      render: (_, record) => (
        <Button
          icon={<Icon icon={Eye} size={14} />}
          onClick={() => handleViewDetail(record)}
          size="small"
          type="link"
        >
          详情
        </Button>
      ),
      title: '操作',
      width: 100,
    },
  ];

  return (
    <Flexbox className={styles.container} gap={24}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>订单记录</div>
        <div className={styles.subtitle}>查看您的所有支付订单历史</div>
      </div>

      {/* Error State */}
      {error && (
        <Alert
          description="加载订单记录失败，请稍后重试"
          message="加载失败"
          showIcon
          type="error"
        />
      )}

      {/* Table */}
      <div className={styles.table}>
        <Table
          columns={columns}
          dataSource={data?.orders || []}
          loading={isLoading}
          locale={{
            emptyText: (
              <Empty description="暂无订单记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ),
          }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1300 }}
        />
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <Flexbox align="center" horizontal justify="flex-end">
          <Pagination
            current={page}
            onChange={(newPage, newPageSize) => {
              setPage(newPage);
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize);
              }
            }}
            pageSize={pageSize}
            pageSizeOptions={['10', '20', '50']}
            showQuickJumper
            showSizeChanger
            showTotal={(total) => `共 ${total} 条记录`}
            total={data.total}
          />
        </Flexbox>
      )}

      {/* Order Detail Modal */}
      <OrderDetailModal
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedOrder(null);
        }}
        open={detailModalOpen}
        order={selectedOrder}
      />
    </Flexbox>
  );
});

OrdersContent.displayName = 'ProfileOrdersContent';

export default OrdersContent;
