'use client';

import { Icon } from '@lobehub/ui';
import { AlipayOutlined, WechatOutlined } from '@ant-design/icons';
import { Alert, Button, Collapse, message, Modal, Spin, Tag, Tooltip, Typography } from 'antd';
import { createStyles } from 'antd-style';
import {
  ArrowRight,
  CheckCircle,
  CircleHelp,
  XCircle,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';
import { QRCodeSVG } from 'qrcode.react';

import { lambdaClient } from '@/libs/trpc/client';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  body: css`
    padding-block: 24px;
    padding-inline: 24px;
  `,
  currentPlanCard: css`
    flex: 1;
    padding: 16px;
    border: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
    border-radius: 8px;
    background: ${isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'};
  `,
  divider: css`
    width: 100%;
    height: 1px;
    background: ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
  `,
  errorIcon: css`
    color: ${token.colorError};
  `,
  footer: css`
    padding-block: 16px;
    padding-inline: 24px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    border-block-start: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
  `,
  header: css`
    padding-block: 20px;
    padding-inline: 24px;
    border-block-end: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
  `,
  modal: css`
    .ant-modal-content {
      padding: 0;
    }
  `,
  newPlanCard: css`
    flex: 1;
    padding: 16px;
    border: 2px solid ${token.colorPrimary};
    border-radius: 8px;
    background: ${isDarkMode ? 'rgba(22, 119, 255, 0.1)' : 'rgba(22, 119, 255, 0.05)'};
  `,
  paymentArea: css`
    display: flex;
    gap: 24px;
    padding: 16px;
    border-radius: 8px;
    background: ${isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'};
  `,
  planName: css`
    font-size: 16px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  planPeriod: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
  `,
  planStatus: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  price: css`
    font-size: 20px;
    font-weight: 700;
    color: ${token.colorError};
  `,
  priceLabel: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  priceRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-block: 8px;
  `,
  priceValue: css`
    font-size: 14px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  priceValueDiscount: css`
    font-size: 14px;
    font-weight: 500;
    color: ${token.colorError};
  `,
  qrContainer: css`
    flex-shrink: 0;
    width: 160px;
    height: 160px;
    padding: 12px;
    border: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
    border-radius: 8px;
    background: #fff;
  `,
  successIcon: css`
    color: ${token.colorSuccess};
  `,
  switchButton: css`
    font-size: 13px;
  `,
  tipItem: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
    line-height: 1.8;
  `,
  title: css`
    font-size: 18px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  totalRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-block: 12px;
    border-block-start: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
  `,
}));

interface CurrentPlanInfo {
  billingInterval?: 'month' | 'year' | null;
  durationMonths?: number | null;
  paidAmount?: number; // 实付金额（分）
  planExpiresAt?: Date | null;
  planName: string;
  planSlug: string;
  subscriptionType: 'recurring' | 'onetime';
}

interface NewPlanInfo {
  billingInterval: 'month' | 'year';
  durationMonths?: number; // 一次性付费的月数
  originalPrice: number; // 原价（分）
  planId: string;
  planName: string;
  planSlug: string;
  subscriptionType: 'recurring' | 'onetime';
}

interface UpgradePaymentModalProps {
  currentPlan: CurrentPlanInfo;
  discount?: {
    amount: number; // 优惠金额（分）
    label: string; // 如"首购5折"
  };
  newPlan: NewPlanInfo;
  onClose: () => void;
  onSuccess: () => void;
  open: boolean;
}

type PaymentMethod = 'alipay_precreate' | 'wechat_native';

// Helper function
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

// 计算残值
const calculateResidualValue = (
  paidAmount: number, // 实付金额（分）
  subscriptionType: 'recurring' | 'onetime',
  billingInterval: 'month' | 'year' | null | undefined,
  durationMonths: number | null | undefined,
  expiresAt: Date | null | undefined,
): number => {
  if (!paidAmount || paidAmount <= 0 || !expiresAt) return 0;

  const now = new Date();
  const remainingDays = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  if (remainingDays <= 0) return 0;

  let totalDays: number;

  if (subscriptionType === 'recurring') {
    totalDays = billingInterval === 'year' ? 365 : 30;
  } else {
    // 一次性付费
    const months = durationMonths || 1;
    totalDays = months * 30;
  }

  // 日均价格向上取整到分
  const dailyPrice = Math.ceil((paidAmount / totalDays) * 100) / 100;
  // 残值
  const residual = Math.round(dailyPrice * remainingDays);

  return residual;
};

// 获取周期显示文本
const getPeriodText = (
  subscriptionType: 'recurring' | 'onetime',
  billingInterval?: 'month' | 'year' | null,
  durationMonths?: number | null,
): string => {
  if (subscriptionType === 'recurring') {
    return billingInterval === 'year' ? '连续包年' : '连续包月';
  }
  // 一次性付费
  const months = durationMonths || 1;
  return `一次性 ${months} 个月`;
};

const UpgradePaymentModal = memo<UpgradePaymentModalProps>(
  ({ open, currentPlan, newPlan, discount, onClose, onSuccess }) => {
    const { t } = useTranslation('subscription');
    const { styles, theme } = useStyles();

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay_precreate');
    const [orderNo, setOrderNo] = useState<string>('');
    const [codeUrl, setCodeUrl] = useState<string>('');
    const [expiredAt, setExpiredAt] = useState<Date | null>(null);
    const [status, setStatus] = useState<'loading' | 'qrcode' | 'polling' | 'success' | 'error'>(
      'loading',
    );
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

    const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const timerIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevOrderRef = useRef<string>('');

    // 计算价格
    const residualValue = calculateResidualValue(
      currentPlan.paidAmount || 0,
      currentPlan.subscriptionType,
      currentPlan.billingInterval,
      currentPlan.durationMonths,
      currentPlan.planExpiresAt,
    );

    const discountAmount = discount?.amount || 0;
    const finalAmount = Math.max(0, newPlan.originalPrice - discountAmount - residualValue);

    // Stop polling function
    const stopPolling = useCallback(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }, []);

    // Poll order status
    const startPolling = useCallback((pollOrderNo: string) => {
      if (pollingIntervalRef.current) return;

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const result = await lambdaClient.payment.queryOrder.query({
            orderNo: pollOrderNo,
          });

          if (result.status === 'paid') {
            setStatus('success');
            stopPolling();
            setTimeout(() => {
              onSuccess();
            }, 1500);
          } else if (result.status === 'closed') {
            setStatus('error');
            setErrorMessage('订单已关闭');
            stopPolling();
          }
        } catch (error) {
          console.error('Failed to query order:', error);
        }
      }, 3000);
    }, [onSuccess, stopPolling]);

    // Create order when modal opens or payment method changes
    useEffect(() => {
      if (!open) return;

      const createOrder = async () => {
        try {
          setStatus('loading');
          setErrorMessage('');

          if (prevOrderRef.current) {
            try {
              await lambdaClient.payment.closeOrder.mutate({ orderNo: prevOrderRef.current });
            } catch (error) {
              console.error('Failed to close previous order:', error);
            }
          }

          const result = await lambdaClient.payment.createOrder.mutate({
            durationMonths: newPlan.durationMonths,
            interval: newPlan.billingInterval,
            payChannel: paymentMethod,
            planId: newPlan.planId,
            subscriptionType: newPlan.subscriptionType,
          });

          prevOrderRef.current = result.orderNo;
          setOrderNo(result.orderNo);
          setCodeUrl(result.codeUrl || '');
          setExpiredAt(new Date(result.expiredAt));
          setStatus('qrcode');

          startPolling(result.orderNo);
        } catch (error) {
          console.error('Failed to create order:', error);
          setStatus('error');
          setErrorMessage(
            error instanceof Error ? error.message : '创建订单失败',
          );
        }
      };

      createOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, newPlan.planId, newPlan.billingInterval, paymentMethod, newPlan.subscriptionType, newPlan.durationMonths]);

    // Countdown timer
    useEffect(() => {
      if (!expiredAt || status === 'success' || status === 'error') return;

      const updateTimer = () => {
        const now = new Date();
        const diff = expiredAt.getTime() - now.getTime();

        if (diff <= 0) {
          setRemainingSeconds(0);
          setStatus('error');
          setErrorMessage('二维码已过期');
          stopPolling();
          return;
        }

        setRemainingSeconds(Math.floor(diff / 1000));
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    }, [expiredAt, status, stopPolling]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        stopPolling();
      };
    }, [stopPolling]);

    const handleClose = useCallback(async () => {
      if (status === 'success') {
        onClose();
        return;
      }

      if (prevOrderRef.current && (status === 'qrcode' || status === 'polling')) {
        try {
          await lambdaClient.payment.closeOrder.mutate({ orderNo: prevOrderRef.current });
        } catch (error) {
          console.error('Failed to close order:', error);
        }
      }

      stopPolling();
      onClose();
    }, [status, onClose, stopPolling]);

    const switchPaymentMethod = () => {
      if (paymentMethod === 'alipay_precreate') {
        message.info('微信支付敬请期待');
      } else {
        setPaymentMethod('alipay_precreate');
      }
    };

    // 循环订阅提示
    const recurringTips = [
      `续订将按照「¥${(newPlan.originalPrice / 100).toFixed(0)}/${newPlan.billingInterval === 'year' ? '年' : '月'}」发起自动扣费。`,
      `扣费优先级：优先扣除赠金，再扣余额，再采用${paymentMethod === 'alipay_precreate' ? '支付宝' : '微信'}扣费。`,
      '每月将持续定期扣款，直至您根据我们的服务条款取消服务。',
      '您可在续费日前至少1天，前往「我的编程套餐」关闭自动续费。',
    ];

    // 一次性付费提示
    const onetimeTips = [
      '本次为一次性付费，到期后将自动降级为免费版。',
      '到期前可随时升级至更高方案。',
    ];

    const tips = newPlan.subscriptionType === 'recurring' ? recurringTips : onetimeTips;

    if (status === 'success') {
      return (
        <Modal
          centered
          className={styles.modal}
          footer={null}
          onCancel={handleClose}
          open={open}
          width={600}
        >
          <Center style={{ minHeight: 300, padding: 48 }}>
            <Flexbox align="center" gap={16}>
              <Icon className={styles.successIcon} icon={CheckCircle} size={64} />
              <span style={{ fontSize: 20, fontWeight: 600 }}>支付成功！</span>
              <span style={{ color: theme.colorTextSecondary, fontSize: 14 }}>
                正在跳转...
              </span>
            </Flexbox>
          </Center>
        </Modal>
      );
    }

    if (status === 'error') {
      return (
        <Modal
          centered
          className={styles.modal}
          footer={null}
          onCancel={handleClose}
          open={open}
          width={600}
        >
          <Center style={{ minHeight: 300, padding: 48 }}>
            <Flexbox align="center" gap={16}>
              <Icon className={styles.errorIcon} icon={XCircle} size={64} />
              <span style={{ fontSize: 16, fontWeight: 500 }}>
                {errorMessage || '支付失败'}
              </span>
              <Button onClick={handleClose} type="primary">
                关闭
              </Button>
            </Flexbox>
          </Center>
        </Modal>
      );
    }

    return (
      <Modal
        centered
        className={styles.modal}
        footer={null}
        onCancel={handleClose}
        open={open}
        title={null}
        width={600}
      >
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>订阅升级</span>
        </div>

        <div className={styles.body}>
          <Flexbox gap={20}>
            {/* Plan Comparison */}
            <Flexbox gap={16} horizontal>
              {/* Current Plan */}
              <div className={styles.currentPlanCard}>
                <Flexbox gap={8}>
                  <Flexbox align="center" gap={8} horizontal>
                    <span className={styles.planName}>{currentPlan.planName}</span>
                    <Tag>现有套餐</Tag>
                  </Flexbox>
                  <span className={styles.planPeriod}>
                    {getPeriodText(
                      currentPlan.subscriptionType,
                      currentPlan.billingInterval,
                      currentPlan.durationMonths,
                    )}
                  </span>
                  <span className={styles.planStatus}>失效时间：订阅升级后失效</span>
                </Flexbox>
              </div>

              {/* Arrow */}
              <Center style={{ flexShrink: 0, width: 32 }}>
                <Icon color={theme.colorPrimary} icon={ArrowRight} size={24} />
              </Center>

              {/* New Plan */}
              <div className={styles.newPlanCard}>
                <Flexbox gap={8}>
                  <Flexbox align="center" gap={8} horizontal>
                    <span className={styles.planName}>{newPlan.planName}</span>
                    <Tag color="blue">购买中</Tag>
                  </Flexbox>
                  <span className={styles.planPeriod}>
                    {getPeriodText(
                      newPlan.subscriptionType,
                      newPlan.billingInterval,
                      newPlan.durationMonths,
                    )}
                  </span>
                  <span className={styles.planStatus} style={{ color: theme.colorSuccess }}>
                    生效时间：升级后立即生效
                  </span>
                </Flexbox>
              </div>
            </Flexbox>

            {/* Price Details */}
            <Flexbox gap={0}>
              <div className={styles.priceRow}>
                <span className={styles.priceLabel}>新套餐原价</span>
                <span className={styles.priceValue}>¥{(newPlan.originalPrice / 100).toFixed(2)}</span>
              </div>

              {discountAmount > 0 && (
                <div className={styles.priceRow}>
                  <Flexbox align="center" gap={8} horizontal>
                    <span className={styles.priceLabel}>优惠活动</span>
                    <Tag color="red">{discount?.label}</Tag>
                  </Flexbox>
                  <span className={styles.priceValueDiscount}>-¥{(discountAmount / 100).toFixed(2)}</span>
                </div>
              )}

              {residualValue > 0 && (
                <div className={styles.priceRow}>
                  <Flexbox align="center" gap={4} horizontal>
                    <span className={styles.priceLabel}>现有套餐剩余价值</span>
                    <Tooltip title="现有套餐剩余价值是指您套餐中还没用完、按剩余天数折算出来的金额。">
                      <Icon icon={CircleHelp} size={14} style={{ color: theme.colorTextTertiary }} />
                    </Tooltip>
                  </Flexbox>
                  <span className={styles.priceValueDiscount}>-¥{(residualValue / 100).toFixed(2)}</span>
                </div>
              )}

              <Collapse
                ghost
                items={[
                  {
                    children: (
                      <Flexbox gap={4} style={{ fontSize: 12, color: theme.colorTextSecondary }}>
                        <div>原价：¥{(newPlan.originalPrice / 100).toFixed(2)}</div>
                        {discountAmount > 0 && <div>优惠：-¥{(discountAmount / 100).toFixed(2)}</div>}
                        {residualValue > 0 && <div>残值抵扣：-¥{(residualValue / 100).toFixed(2)}</div>}
                      </Flexbox>
                    ),
                    key: '1',
                    label: (
                      <div className={styles.priceRow} style={{ padding: 0 }}>
                        <span className={styles.priceLabel}>套餐差价</span>
                        <span className={styles.priceValue}>
                          ¥{((newPlan.originalPrice - discountAmount - residualValue) / 100).toFixed(2)}
                        </span>
                      </div>
                    ),
                  },
                ]}
                size="small"
              />

              <div className={styles.totalRow}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>实付金额</span>
                <span className={styles.price}>¥{(finalAmount / 100).toFixed(2)}</span>
              </div>
            </Flexbox>

            {/* Payment Area */}
            {status === 'loading' ? (
              <Center style={{ minHeight: 200 }}>
                <Spin size="large" tip="正在创建订单..." />
              </Center>
            ) : (
              <div className={styles.paymentArea}>
                {/* QR Code */}
                <div className={styles.qrContainer}>
                  {codeUrl ? (
                    <QRCodeSVG level="M" size={136} value={codeUrl} />
                  ) : (
                    <Center style={{ height: '100%' }}>
                      <Spin />
                    </Center>
                  )}
                </div>

                {/* Payment Info */}
                <Flexbox flex={1} gap={12}>
                  <Flexbox align="center" gap={8} horizontal>
                    {paymentMethod === 'alipay_precreate' ? (
                      <AlipayOutlined style={{ color: '#1677ff', fontSize: 20 }} />
                    ) : (
                      <WechatOutlined style={{ color: '#07c160', fontSize: 20 }} />
                    )}
                    <span>
                      请使用{paymentMethod === 'alipay_precreate' ? '支付宝' : '微信'}扫码支付{' '}
                      <Typography.Text strong style={{ color: theme.colorError, fontSize: 18 }}>
                        ¥{(finalAmount / 100).toFixed(2)}
                      </Typography.Text>
                    </span>
                    <Button
                      className={styles.switchButton}
                      onClick={switchPaymentMethod}
                      size="small"
                      type="link"
                    >
                      切换{paymentMethod === 'alipay_precreate' ? '微信支付' : '支付宝'}
                    </Button>
                  </Flexbox>

                  {remainingSeconds > 0 && (
                    <span style={{ color: theme.colorWarning, fontSize: 12 }}>
                      有效期: {formatTime(remainingSeconds)}
                    </span>
                  )}

                  <Flexbox gap={4} style={{ marginTop: 4 }}>
                    {tips.map((tip, index) => (
                      <div className={styles.tipItem} key={index}>
                        • {tip}
                      </div>
                    ))}
                  </Flexbox>
                </Flexbox>
              </div>
            )}
          </Flexbox>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          支付即视您同意
          <Typography.Link href="/terms" target="_blank">《服务协议》</Typography.Link>
          <Typography.Link href="/subscription-terms" target="_blank">《订阅协议》</Typography.Link>
          ，虚拟商品一经支付不支持退款
        </div>
      </Modal>
    );
  },
);

UpgradePaymentModal.displayName = 'UpgradePaymentModal';

export default UpgradePaymentModal;
