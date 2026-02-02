'use client';

import { Icon, Tag } from '@lobehub/ui';
import { Descriptions, Modal, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  modal: css`
    .ant-modal-content {
      background: ${isDarkMode ? token.colorBgElevated : token.colorBgContainer};
    }
  `,
  orderNo: css`
    font-family: monospace;
    font-size: 13px;
    color: ${token.colorTextSecondary};
  `,
  section: css`
    margin-block-end: 24px;
  `,
  sectionTitle: css`
    margin-block-end: 16px;
    font-size: 16px;
    font-weight: 600;
    color: ${token.colorText};
  `,
}));

// Helper function
const renderPayChannel = (channel: string) => {
  const channelMap = {
    alipay_precreate: '支付宝',
    wechat_native: '微信支付',
  };
  return channelMap[channel as keyof typeof channelMap] || channel;
};

interface OrderDetailModalProps {
  onClose: () => void;
  open: boolean;
  order: {
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
  } | null;
}

const OrderDetailModal = memo<OrderDetailModalProps>(({ open, onClose, order }) => {
  const { styles } = useStyles();

  if (!order) return null;

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

  // Subscription type renderer
  const renderSubscriptionType = (
    type: string,
    durationMonths?: number | null,
    planInterval?: string,
  ) => {
    if (type === 'onetime') {
      return (
        <Flexbox gap={4}>
          <span>一次性付费</span>
          <Tag color="blue">{durationMonths || 1}个月</Tag>
        </Flexbox>
      );
    }
    return (
      <Flexbox gap={4}>
        <span>循环订阅</span>
        <Tag color="green">{planInterval === 'year' ? '年付' : '月付'}</Tag>
      </Flexbox>
    );
  };

  return (
    <Modal
      className={styles.modal}
      footer={null}
      onCancel={onClose}
      open={open}
      title="订单详情"
      width={700}
    >
      <Flexbox gap={24} style={{ paddingTop: 16 }}>
        {/* 基本信息 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>基本信息</div>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="订单号">
              <Typography.Text className={styles.orderNo} copyable>
                {order.orderNo}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="订单状态">{renderStatus(order.status)}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(order.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
            {order.paidAt && (
              <Descriptions.Item label="支付时间">
                {new Date(order.paidAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="订单有效期至">
              {new Date(order.expiredAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* 方案信息 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>方案信息</div>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="方案名称">{order.planName}</Descriptions.Item>
            <Descriptions.Item label="方案标识">
              <Typography.Text code>{order.planSlug}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="订阅类型">
              {renderSubscriptionType(
                order.subscriptionType,
                order.durationMonths,
                order.planInterval,
              )}
            </Descriptions.Item>
            {order.subscriptionType === 'onetime' && (
              <Descriptions.Item label="购买时长">{order.durationMonths || 1}个月</Descriptions.Item>
            )}
            {order.subscriptionType === 'recurring' && (
              <Descriptions.Item label="计费周期">
                {order.planInterval === 'year' ? '按年' : '按月'}
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>

        {/* 支付信息 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>支付信息</div>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="支付方式">
              {renderPayChannel(order.payChannel)}
            </Descriptions.Item>
            <Descriptions.Item label="订单金额">
              <Typography.Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>
                ¥{(order.amount / 100).toFixed(2)}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="货币类型">{order.currency}</Descriptions.Item>
          </Descriptions>
        </div>

        {/* 说明信息 */}
        {order.subscriptionType === 'onetime' && (
          <div style={{ background: 'rgba(24, 144, 255, 0.1)', borderRadius: 8, padding: 12 }}>
            <Typography.Text style={{ fontSize: 13 }} type="secondary">
              一次性付费订单不会自动续订，到期后需要重新购买。
            </Typography.Text>
          </div>
        )}

        {order.subscriptionType === 'recurring' && (
          <div style={{ background: 'rgba(82, 196, 26, 0.1)', borderRadius: 8, padding: 12 }}>
            <Typography.Text style={{ fontSize: 13 }} type="secondary">
              循环订阅将在到期前自动续订，确保服务不中断。
            </Typography.Text>
          </div>
        )}
      </Flexbox>
    </Modal>
  );
});

OrderDetailModal.displayName = 'OrderDetailModal';

export default OrderDetailModal;
