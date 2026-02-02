'use client';

import { Icon, Tag } from '@lobehub/ui';
import { Alert, Button, Card, Empty, Pagination, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createStyles } from 'antd-style';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle,
  CheckCircle2,
  Clock,
  Eye,
  XCircle,
  XCircle as XIcon,
} from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Flexbox } from 'react-layout-kit';
import { useQuery } from '@tanstack/react-query';

import { lambdaClient } from '@/libs/trpc/client';
import { useSubscriptionPlans, PlanFeatures } from '@/app/[variants]/(main)/subscription/hooks/useSubscriptionPlans';

import OrderDetailModal from './features/OrderDetailModal';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  card: css`
    border-radius: 12px;
    background: ${isDarkMode ? token.colorBgElevated : token.colorBgContainer};
  `,
  container: css`
    max-width: 1000px;
    margin: 0 auto;
    padding: 24px;
  `,
  featureItem: css`
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 14px;
    color: ${token.colorText};
  `,
  featureItemDisabled: css`
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 14px;
    color: ${token.colorTextTertiary};
  `,
  header: css`
    margin-block-end: 24px;
  `,
  link: css`
    color: ${token.colorPrimary};
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  `,
  planDescription: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
  `,
  planIcon: css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    font-size: 20px;
    background: ${token.colorPrimaryBg};
    border-radius: 50%;
  `,
  planName: css`
    font-size: 18px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  priceAmount: css`
    font-size: 28px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  priceLabel: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  sectionTitle: css`
    font-size: 16px;
    font-weight: 600;
    color: ${token.colorText};
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
    font-size: 24px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  upgradeButton: css`
    font-weight: 500;
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

// Status badge renderer
const renderStatus = (status: string) => {
  const statusConfig = {
    closed: { color: 'default', icon: XCircle, text: '已关闭' },
    paid: { color: 'success', icon: CheckCircle, text: '已支付' },
    pending: { color: 'processing', icon: Clock, text: '待支付' },
    refunded: { color: 'warning', icon: AlertCircle, text: '已退款' },
  };
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.closed;
  return (
    <Tag color={config.color} icon={<Icon icon={config.icon} size={14} />}>
      {config.text}
    </Tag>
  );
};

// Get plan description based on slug
const getPlanDescription = (slug: string) => {
  const descriptions: Record<string, string> = {
    free: '适合首次使用者',
    lite: '适合轻度使用者',
    pro: '适合专业用户',
    ultra: '适合重度使用者',
  };
  return descriptions[slug] || '';
};

// Get features list for display
const getFeaturesList = (features: PlanFeatures, slug: string) => {
  const included: string[] = [];
  const notIncluded: string[] = [];

  // Resources
  if (features.resources?.credits_per_month) {
    included.push(`${features.resources.credits_per_month} 算力点数 (每月赠送)`);
  }
  if (features.resources?.file_storage_gb) {
    included.push(`${features.resources.file_storage_gb} 文件存储`);
  }
  if (features.resources?.vector_storage_display) {
    included.push(`${features.resources.vector_storage_display} 向量存储`);
  }

  // Model estimates
  if (features.display?.model_estimates) {
    features.display.model_estimates.forEach((estimate) => {
      included.push(`${estimate.model}`);
    });
  }

  // Capabilities
  if (features.capabilities?.custom_api) {
    included.push('全球主流模型自定义 API 服务');
  } else {
    notIncluded.push('全球主流模型自定义 API 服务');
  }

  // Cloud services
  if (features.cloud_services?.unlimited_history) {
    included.push('无限对话历史');
  } else {
    notIncluded.push('无限对话历史');
  }

  if (features.cloud_services?.web_search) {
    included.push('智能网页搜索');
  } else {
    notIncluded.push('智能网页搜索');
  }

  // Free plan specific missing features
  if (slug === 'free') {
    notIncluded.push('精选智能体市场');
    notIncluded.push('专属高级插件');
  }

  return { included, notIncluded };
};

const Client = memo<{ mobile?: boolean }>(({ mobile }) => {
  const { styles, theme } = useStyles();
  const { t } = useTranslation('common');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // Fetch current plan and plans list
  const { currentPlan, plans, isLoading: plansLoading } = useSubscriptionPlans();

  // Fetch orders from backend
  const { data: ordersData, isLoading: ordersLoading, error: ordersError } = useQuery({
    queryFn: () =>
      lambdaClient.payment.getOrderHistory.query({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    queryKey: ['payment', 'orderHistory', page, pageSize],
  });

  // Find current plan details
  const currentPlanDetails = plans.find((p) => p.slug === currentPlan?.planSlug);
  const features = currentPlanDetails?.features || currentPlan?.features || {};
  const featuresList = getFeaturesList(features as PlanFeatures, currentPlan?.planSlug || 'free');

  // Calculate next payment amount
  const getNextPaymentAmount = () => {
    if (!currentPlan || currentPlan.planSlug === 'free') return 0;
    if (currentPlan.subscriptionType === 'onetime') return 0;
    if (currentPlan.billingInterval === 'year') {
      return currentPlanDetails?.yearlyPrice || 0;
    }
    return currentPlanDetails?.monthlyPrice || 0;
  };

  const nextPayment = getNextPaymentAmount();

  // Handle view detail
  const handleViewDetail = (order: OrderRecord) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  // Table columns (simplified for billing history)
  const columns: ColumnsType<OrderRecord> = [
    {
      dataIndex: 'orderNo',
      ellipsis: { showTitle: false },
      key: 'orderNo',
      render: (orderNo: string) => (
        <Tooltip title={orderNo}>
          <span style={{ fontFamily: 'monospace' }}>{orderNo}</span>
        </Tooltip>
      ),
      title: '订单编号',
      width: 220,
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: renderStatus,
      title: '交易状态',
      width: 120,
    },
    {
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `¥${(amount / 100).toFixed(2)}`,
      title: '金额',
      width: 100,
    },
    {
      dataIndex: 'paidAt',
      key: 'paidAt',
      render: (date: string | null) =>
        date ? new Date(date).toLocaleString('zh-CN') : '-',
      title: '付款日期',
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
      width: 80,
    },
  ];

  return (
    <Flexbox className={styles.container} gap={24}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>{t('userPanel.billing')}</div>
      </div>

      {/* 账单摘要 */}
      <Card className={styles.card}>
        <div className={styles.sectionTitle}>账单摘要</div>
        <Flexbox gap={24} horizontal={!mobile} style={{ marginTop: 16 }}>
          <Flexbox flex={1} gap={8}>
            <div className={styles.priceLabel}>您的下次付款</div>
            <div className={styles.priceAmount}>¥{(nextPayment / 100).toFixed(2)}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              此金额仅包含订阅服务费用。
              <Link to="/profile/usage" className={styles.link}>
                查看本月使用情况
              </Link>
            </Typography.Text>
          </Flexbox>
          <Flexbox flex={1} gap={8}>
            <div className={styles.priceLabel}>账单信息</div>
            <Link to="/subscription/plans" className={styles.link}>
              升级计划 <Icon icon={ArrowUpRight} size={14} />
            </Link>
          </Flexbox>
        </Flexbox>
      </Card>

      {/* 当前套餐 */}
      <Card className={styles.card}>
        <Flexbox horizontal justify="space-between" align="center">
          <div className={styles.sectionTitle}>当前套餐</div>
          <Link to="/subscription/plans">
            <Button className={styles.upgradeButton} type="primary">
              升 级
            </Button>
          </Link>
        </Flexbox>
        <Flexbox gap={16} style={{ marginTop: 16 }}>
          {/* Plan header */}
          <Flexbox horizontal gap={12} align="center">
            <div className={styles.planIcon}>
              <CheckCircle2 size={24} color={theme.colorPrimary} />
            </div>
            <Flexbox gap={2}>
              <div className={styles.planName}>
                {currentPlan?.planName || '免费版'}
              </div>
              <div className={styles.planDescription}>
                {getPlanDescription(currentPlan?.planSlug || 'free')}
              </div>
            </Flexbox>
          </Flexbox>

          {/* Features list */}
          <Flexbox
            horizontal={!mobile}
            gap={mobile ? 16 : 48}
            style={{ marginTop: 8 }}
          >
            <Flexbox flex={1} gap={12}>
              {featuresList.included.map((feature, index) => (
                <div key={index} className={styles.featureItem}>
                  <Icon icon={CheckCircle2} size={16} color={theme.colorSuccess} />
                  {feature}
                </div>
              ))}
            </Flexbox>
            <Flexbox flex={1} gap={12}>
              {featuresList.notIncluded.map((feature, index) => (
                <div key={index} className={styles.featureItemDisabled}>
                  <Icon icon={XIcon} size={16} color={theme.colorTextQuaternary} />
                  {feature}
                </div>
              ))}
            </Flexbox>
          </Flexbox>
        </Flexbox>
      </Card>

      {/* 账单历史 */}
      <Card className={styles.card}>
        <div className={styles.sectionTitle}>账单历史</div>

        {/* Error State */}
        {ordersError && (
          <Alert
            description="加载账单记录失败，请稍后重试"
            message="加载失败"
            showIcon
            style={{ marginTop: 16 }}
            type="error"
          />
        )}

        {/* Table */}
        <div className={styles.table} style={{ marginTop: 16 }}>
          <Table
            columns={columns}
            dataSource={ordersData?.orders || []}
            loading={ordersLoading}
            locale={{
              emptyText: (
                <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ),
            }}
            pagination={false}
            rowKey="id"
            scroll={{ x: 700 }}
            size="small"
          />
        </div>

        {/* Pagination */}
        {ordersData && ordersData.total > 0 && (
          <Flexbox align="center" horizontal justify="flex-end" style={{ marginTop: 16 }}>
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
              size="small"
              total={ordersData.total}
            />
          </Flexbox>
        )}
      </Card>

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

Client.displayName = 'ProfileBillingClient';

export default Client;
