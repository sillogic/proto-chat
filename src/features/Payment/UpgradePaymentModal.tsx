'use client';

import { Icon } from '@lobehub/ui';
import { WechatOutlined } from '@ant-design/icons';
import { Alert, Button, Collapse, message, Modal, Radio, Spin, Tag, Tooltip, Typography } from 'antd';
import { createStyles } from 'antd-style';
import {
  ArrowRight,
  CheckCircle,
  CircleHelp,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Center, Flexbox } from '@lobehub/ui';
import { QRCodeSVG } from 'qrcode.react';

import { lambdaClient } from '@/libs/trpc/client';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  body: css`
    padding-block: 24px;
    padding-inline: 24px;
  `,
  confirmButton: css`
    height: 48px;
    font-size: 16px;
    font-weight: 500;
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
    border-block-start: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};

    font-size: 12px;
    color: ${token.colorTextTertiary};
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
  paymentMethodCard: css`
    cursor: pointer;

    padding-block: 12px;
    padding-inline: 16px;
    border: 2px solid transparent;
    border-radius: 8px;

    background: ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'};

    transition: all 0.2s;

    &:hover {
      border-color: ${token.colorPrimaryBorderHover};
    }
  `,
  paymentMethodCardSelected: css`
    cursor: pointer;

    padding-block: 12px;
    padding-inline: 16px;
    border: 2px solid ${token.colorPrimary};
    border-radius: 8px;

    background: ${isDarkMode ? 'rgba(22, 119, 255, 0.1)' : 'rgba(22, 119, 255, 0.05)'};
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
    padding: 16px;
    border: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
    border-radius: 8px;
    background: #fff;
  `,
  recommendTag: css`
    padding-block: 2px;
    padding-inline: 6px;
    border-radius: 4px;

    font-size: 10px;
    color: #fff;

    background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  `,
  sectionTitle: css`
    font-size: 14px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  successIcon: css`
    color: ${token.colorSuccess};
  `,
  timer: css`
    font-size: 14px;
    font-weight: 500;
    color: ${token.colorWarning};
  `,
  tipItem: css`
    font-size: 13px;
    line-height: 1.8;
    color: ${token.colorTextSecondary};
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
  wechatIcon: css`
    color: #07c160;
  `,
}));

interface CurrentPlanInfo {
  billingInterval?: 'month' | 'year' | null;
  durationMonths?: number | null;
  paidAmount?: number; // 实付金额（分）- 已废弃，仅用于显示
  planExpiresAt?: Date | null;
  planName: string;
  planSlug: string;
  planValue?: number; // 套餐价值（分）- 用于残值计算（原价 - 促销优惠，但不扣除残值）
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
type PaymentStatus = 'confirm' | 'loading' | 'qrcode' | 'success' | 'error';

// Agreement polling result type
interface AgreementInfo {
  agreementId: string;
  externalAgreementNo: string;
}

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
  planValue: number | undefined, // 套餐价值（分）- 原价 - 促销优惠（但不扣除残值）
  paidAmount: number | undefined, // 实付金额（分）- 作为 fallback，仅用于历史数据
  subscriptionType: 'recurring' | 'onetime',
  billingInterval: 'month' | 'year' | null | undefined,
  durationMonths: number | null | undefined,
  expiresAt: Date | null | undefined,
): number => {
  // 优先使用 planValue，如果没有则回退到 paidAmount（历史数据兼容）
  const baseValue = planValue || paidAmount;

  if (!baseValue || baseValue <= 0 || !expiresAt) return 0;

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
  const dailyPrice = Math.ceil((baseValue / totalDays) * 100) / 100;
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
  return `一次性 ${durationMonths ?? 1} 个月`;
};

const UpgradePaymentModal = memo<UpgradePaymentModalProps>(
  ({ open, currentPlan, newPlan, discount, onClose, onSuccess }) => {
    const { styles, theme } = useStyles();

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay_precreate');
    const [, setOrderNo] = useState<string>('');
    const [codeUrl, setCodeUrl] = useState<string>('');
    const [expiredAt, setExpiredAt] = useState<Date | null>(null);
    const [status, setStatus] = useState<PaymentStatus>('confirm');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
    const [, setAgreementInfo] = useState<AgreementInfo | null>(null);

    const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const timerIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevOrderRef = useRef<string>('');

    // Is this a recurring subscription (uses sign + pay flow)
    const isRecurring = newPlan.subscriptionType === 'recurring';

    // 计算价格
    const residualValue = calculateResidualValue(
      currentPlan.planValue,
      currentPlan.paidAmount,
      currentPlan.subscriptionType,
      currentPlan.billingInterval,
      currentPlan.durationMonths,
      currentPlan.planExpiresAt,
    );

    const discountAmount = discount?.amount || 0;
    const finalAmount = Math.max(0, newPlan.originalPrice - discountAmount - residualValue);

    // Reset state when modal closes
    useEffect(() => {
      if (!open) {
        setStatus('confirm');
        setOrderNo('');
        setCodeUrl('');
        setExpiredAt(null);
        setErrorMessage('');
        setRemainingSeconds(0);
        setAgreementInfo(null);
        prevOrderRef.current = '';
      }
    }, [open]);

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

    // Create order - only called when user confirms
    const handleConfirmPayment = useCallback(async () => {
      try {
        setStatus('loading');
        setErrorMessage('');

        // Close previous order if exists (only for onetime orders)
        if (!isRecurring && prevOrderRef.current) {
          try {
            await lambdaClient.payment.closeOrder.mutate({ orderNo: prevOrderRef.current });
          } catch (error) {
            console.error('Failed to close previous order:', error);
          }
        }

        if (isRecurring) {
          // Recurring subscription: use sign + pay flow (周期扣款签约扣款一体化)
          const result = await lambdaClient.payment.createSignPaymentOrder.mutate({
            billingInterval: newPlan.billingInterval,
            planId: newPlan.planId,
          });

          prevOrderRef.current = result.orderNo;
          setOrderNo(result.orderNo);
          setCodeUrl(result.codeUrl || '');
          setExpiredAt(new Date(result.expiredAt));
          setAgreementInfo({
            agreementId: result.agreementId,
            externalAgreementNo: result.externalAgreementNo,
          });
          setStatus('qrcode');

          // For recurring, poll the order status (callback will update it to paid)
          startPolling(result.orderNo);
        } else {
          // One-time payment: use standard order flow
          const result = await lambdaClient.payment.createOrder.mutate({
            discountAmount,
            durationMonths: newPlan.durationMonths,
            interval: newPlan.billingInterval,
            payChannel: paymentMethod,
            planId: newPlan.planId,
            residualValue,
            subscriptionType: newPlan.subscriptionType,
          });

          prevOrderRef.current = result.orderNo;
          setOrderNo(result.orderNo);
          setCodeUrl(result.codeUrl || '');
          setExpiredAt(new Date(result.expiredAt));
          setStatus('qrcode');

          startPolling(result.orderNo);
        }
      } catch (error) {
        console.error('Failed to create order:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : '创建订单失败');
      }
    }, [isRecurring, newPlan, paymentMethod, startPolling]);

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

    const handleClose = useCallback(() => {
      // Stop polling immediately for responsive UI
      stopPolling();

      // Close order in background (fire-and-forget) - only for onetime payments
      if (!isRecurring && prevOrderRef.current && (status === 'qrcode' || status === 'loading')) {
        const orderToClose = prevOrderRef.current;
        lambdaClient.payment.closeOrder.mutate({ orderNo: orderToClose }).catch((error) => {
          console.error('Failed to close order:', error);
        });
      }

      onClose();
    }, [isRecurring, status, onClose, stopPolling]);

    // Go back to confirm step
    const handleBack = useCallback(() => {
      // Stop polling immediately for responsive UI
      stopPolling();

      // Close order in background (fire-and-forget) - only for onetime payments
      if (!isRecurring && prevOrderRef.current) {
        const orderToClose = prevOrderRef.current;
        lambdaClient.payment.closeOrder.mutate({ orderNo: orderToClose }).catch((error) => {
          console.error('Failed to close order:', error);
        });
      }
      prevOrderRef.current = '';

      // Update UI immediately
      setStatus('confirm');
      setOrderNo('');
      setCodeUrl('');
      setExpiredAt(null);
      setAgreementInfo(null);
    }, [isRecurring, stopPolling]);

    // 一次性付费提示
    const onetimeTips = [
      '本次为一次性付费，到期后将自动降级为免费版。',
      '到期前可随时升级至更高方案。',
    ];

    // 连续订阅提示
    const recurringTips = [
      '签约后将按周期自动续费。',
      '您可随时在「账户设置」中取消自动续费。',
    ];

    // Render plan comparison section
    const renderPlanComparison = () => (
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
    );

    // Render price details section
    const renderPriceDetails = () => (
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
                <Flexbox gap={4} style={{ color: theme.colorTextSecondary, fontSize: 12 }}>
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
    );

    // Render confirm step
    const renderConfirmStep = () => (
      <Flexbox gap={20}>
        {/* Plan Comparison */}
        {renderPlanComparison()}

        {/* Price Details */}
        {renderPriceDetails()}

        {/* Payment Method Selection */}
        <Flexbox gap={12}>
          <span className={styles.sectionTitle}>选择支付方式</span>
          <Flexbox gap={8}>
            {/* Alipay */}
            <div
              className={
                paymentMethod === 'alipay_precreate'
                  ? styles.paymentMethodCardSelected
                  : styles.paymentMethodCard
              }
              onClick={() => setPaymentMethod('alipay_precreate')}
            >
              <Flexbox align="center" horizontal justify="space-between">
                <Flexbox align="center" gap={12} horizontal>
                  <Radio checked={paymentMethod === 'alipay_precreate'} />
                  <Image
                    alt="Alipay"
                    height={24}
                    src="/images/payment/alipay-logo.png"
                    width={24}
                  />
                  <span style={{ fontWeight: 500 }}>支付宝</span>
                  <span className={styles.recommendTag}>推荐</span>
                </Flexbox>
              </Flexbox>
            </div>

            {/* WeChat Pay - Coming Soon */}
            <div
              className={styles.paymentMethodCard}
              onClick={() => message.info('微信支付敬请期待')}
              style={{ opacity: 0.6 }}
            >
              <Flexbox align="center" horizontal justify="space-between">
                <Flexbox align="center" gap={12} horizontal>
                  <Radio checked={false} disabled />
                  <WechatOutlined className={styles.wechatIcon} style={{ fontSize: 24 }} />
                  <span style={{ fontWeight: 500 }}>微信支付</span>
                  <span style={{ color: theme.colorTextTertiary, fontSize: 12 }}>即将上线</span>
                </Flexbox>
              </Flexbox>
            </div>
          </Flexbox>
        </Flexbox>

        {/* Security Note */}
        <Flexbox align="center" gap={6} horizontal style={{ justifyContent: 'center' }}>
          <Icon color={theme.colorSuccess} icon={ShieldCheck} size={16} />
          <span style={{ color: theme.colorTextTertiary, fontSize: 12 }}>
            支付由支付宝安全加密处理
          </span>
        </Flexbox>

        {/* Auto-renewal notice for recurring */}
        {isRecurring && (
          <Alert
            description={`签约后将按${newPlan.billingInterval === 'year' ? '年' : '月'}自动续费，您可随时在账户设置中取消`}
            showIcon
            type="warning"
          />
        )}

        {/* Confirm Button */}
        <Button
          block
          className={styles.confirmButton}
          onClick={handleConfirmPayment}
          type="primary"
        >
          {isRecurring ? `签约并支付 ¥${(finalAmount / 100).toFixed(2)}` : `去支付 ¥${(finalAmount / 100).toFixed(2)}`}
        </Button>
      </Flexbox>
    );

    // Render QR code step
    const renderQRCodeStep = () => (
      <Flexbox gap={20}>
        {/* Plan Comparison (compact) */}
        {renderPlanComparison()}

        {/* QR Code */}
        <Center>
          <div className={styles.qrContainer}>
            {codeUrl ? (
              <QRCodeSVG level="M" size={200} value={codeUrl} />
            ) : (
              <Center style={{ height: 200, width: 200 }}>
                <Spin />
              </Center>
            )}
          </div>
        </Center>

        {/* Instructions */}
        <Flexbox align="center" gap={8}>
          <Flexbox align="center" gap={8} horizontal>
            <Image alt="Alipay" height={20} src="/images/payment/alipay-logo.png" width={20} />
            <span style={{ fontSize: 14 }}>
              {isRecurring ? (
                <>
                  请使用支付宝扫码签约并支付{' '}
                  <Typography.Text strong style={{ color: theme.colorError, fontSize: 16 }}>
                    ¥{(finalAmount / 100).toFixed(2)}
                  </Typography.Text>
                </>
              ) : (
                <>
                  请使用支付宝扫码支付{' '}
                  <Typography.Text strong style={{ color: theme.colorError, fontSize: 16 }}>
                    ¥{(finalAmount / 100).toFixed(2)}
                  </Typography.Text>
                </>
              )}
            </span>
          </Flexbox>
          {remainingSeconds > 0 && (
            <span className={styles.timer}>有效期: {formatTime(remainingSeconds)}</span>
          )}
        </Flexbox>

        {/* Back button */}
        <Button block onClick={handleBack}>
          返回修改
        </Button>

        {/* Tips */}
        <Alert
          description={
            <Flexbox gap={4}>
              {(isRecurring ? recurringTips : onetimeTips).map((tip, index) => (
                <div className={styles.tipItem} key={index}>
                  • {tip}
                </div>
              ))}
            </Flexbox>
          }
          message={isRecurring ? '签约提示' : '支付提示'}
          showIcon
          type="info"
        />

        {/* Auto-renewal notice for recurring */}
        {isRecurring && (
          <Flexbox align="center" gap={6} horizontal style={{ justifyContent: 'center' }}>
            <Icon color={theme.colorTextTertiary} icon={RefreshCw} size={14} />
            <span style={{ color: theme.colorTextTertiary, fontSize: 12 }}>
              签约后可随时在「账户设置」中取消自动续费
            </span>
          </Flexbox>
        )}
      </Flexbox>
    );

    // Render content based on status
    const renderContent = () => {
      switch (status) {
        case 'confirm': {
          return renderConfirmStep();
        }

        case 'loading': {
          return (
            <Center style={{ minHeight: 300 }}>
              <Spin size="large" tip="正在创建订单..." />
            </Center>
          );
        }

        case 'qrcode': {
          return renderQRCodeStep();
        }

        case 'success': {
          return (
            <Center style={{ minHeight: 300 }}>
              <Flexbox align="center" gap={16}>
                <Icon className={styles.successIcon} icon={CheckCircle} size={64} />
                <span style={{ fontSize: 20, fontWeight: 600 }}>支付成功！</span>
                <span style={{ color: theme.colorTextSecondary, fontSize: 14 }}>正在跳转...</span>
              </Flexbox>
            </Center>
          );
        }

        case 'error': {
          return (
            <Center style={{ minHeight: 300 }}>
              <Flexbox align="center" gap={16}>
                <Icon className={styles.errorIcon} icon={XCircle} size={64} />
                <span style={{ fontSize: 16, fontWeight: 500 }}>{errorMessage || '支付失败'}</span>
                <Flexbox gap={8} horizontal>
                  <Button onClick={handleBack}>返回重试</Button>
                  <Button onClick={handleClose} type="primary">
                    关闭
                  </Button>
                </Flexbox>
              </Flexbox>
            </Center>
          );
        }

        default: {
          return null;
        }
      }
    };

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
          <span className={styles.title}>
            {status === 'confirm'
              ? '确认升级'
              : status === 'qrcode'
                ? isRecurring
                  ? '签约扣款'
                  : '扫码支付'
                : '订阅升级'}
          </span>
        </div>

        {/* Body */}
        <div className={styles.body}>{renderContent()}</div>

        {/* Footer */}
        {status === 'confirm' && (
          <div className={styles.footer}>
            {isRecurring ? (
              <>
                签约即视为您同意
                <Typography.Link href="/terms" target="_blank">
                  《服务协议》
                </Typography.Link>
                <Typography.Link href="/subscription-terms" target="_blank">
                  《订阅协议》
                </Typography.Link>
                <Typography.Link href="/auto-debit-terms" target="_blank">
                  《自动扣款授权协议》
                </Typography.Link>
                ，到期自动续费，可随时取消
              </>
            ) : (
              <>
                支付即视为您同意
                <Typography.Link href="/terms" target="_blank">
                  《服务协议》
                </Typography.Link>
                <Typography.Link href="/subscription-terms" target="_blank">
                  《订阅协议》
                </Typography.Link>
                ，虚拟商品一经支付不支持退款
              </>
            )}
          </div>
        )}
      </Modal>
    );
  },
);

UpgradePaymentModal.displayName = 'UpgradePaymentModal';

export default UpgradePaymentModal;
