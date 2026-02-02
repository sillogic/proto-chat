'use client';

import { Icon } from '@lobehub/ui';
import { WechatOutlined } from '@ant-design/icons';
import { Alert, Button, message, Modal, Radio, Spin, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { CheckCircle, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import Image from 'next/image';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';
import { QRCodeSVG } from 'qrcode.react';

import { lambdaClient } from '@/libs/trpc/client';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  alipayIcon: css`
    color: #1677ff;
  `,
  body: css`
    padding-block: 24px;
    padding-inline: 32px;
  `,
  confirmButton: css`
    height: 48px;
    font-size: 16px;
    font-weight: 500;
  `,
  divider: css`
    width: 100%;
    height: 1px;
    background: ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
  `,
  errorIcon: css`
    color: ${token.colorError};
  `,
  footer: css`
    padding-block: 16px;
    padding-inline: 32px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    border-block-start: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
  `,
  header: css`
    padding-block: 20px;
    padding-inline: 32px;
    border-block-end: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
  `,
  hint: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
    text-align: center;
  `,
  modal: css`
    .ant-modal-content {
      padding: 0;
    }
  `,
  orderInfo: css`
    padding: 16px;
    border-radius: 8px;
    background: ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'};
  `,
  orderLabel: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  orderValue: css`
    font-size: 14px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  paymentMethodCard: css`
    padding: 12px 16px;
    border: 2px solid transparent;
    border-radius: 8px;
    background: ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'};
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: ${token.colorPrimaryBorderHover};
    }
  `,
  paymentMethodCardSelected: css`
    padding: 12px 16px;
    border: 2px solid ${token.colorPrimary};
    border-radius: 8px;
    background: ${isDarkMode ? 'rgba(22, 119, 255, 0.1)' : 'rgba(22, 119, 255, 0.05)'};
    cursor: pointer;
  `,
  price: css`
    font-size: 32px;
    font-weight: 700;
    color: ${token.colorError};
  `,
  priceCurrency: css`
    font-size: 18px;
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
  subtitle: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  successIcon: css`
    color: ${token.colorSuccess};
  `,
  timer: css`
    font-size: 14px;
    font-weight: 500;
    color: ${token.colorWarning};
  `,
  title: css`
    font-size: 18px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  wechatIcon: css`
    color: #07c160;
  `,
}));

interface PaymentModalProps {
  amount: number;
  billingCycle: 'month' | 'year';
  durationMonths?: number;
  onClose: () => void;
  onSuccess: () => void;
  open: boolean;
  planId: string;
  planName: string;
  subscriptionType?: 'recurring' | 'onetime';
}

type PaymentMethod = 'alipay_precreate' | 'wechat_native';
type PaymentStatus = 'confirm' | 'loading' | 'qrcode' | 'success' | 'error';

// Agreement polling result type
interface AgreementInfo {
  agreementId: string;
  externalAgreementNo: string;
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

// Get period text
const getPeriodText = (
  subscriptionType: 'recurring' | 'onetime',
  billingCycle: 'month' | 'year',
  durationMonths?: number,
): string => {
  if (subscriptionType === 'onetime') {
    return `一次性 ${durationMonths || 1} 个月`;
  }
  return billingCycle === 'year' ? '连续包年' : '连续包月';
};

const PaymentModal = memo<PaymentModalProps>(
  ({
    open,
    planName,
    planId,
    amount,
    billingCycle,
    subscriptionType = 'recurring',
    durationMonths,
    onClose,
    onSuccess,
  }) => {
    const { t } = useTranslation('subscription');
    const { styles, theme } = useStyles();

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay_precreate');
    const [orderNo, setOrderNo] = useState<string>('');
    const [codeUrl, setCodeUrl] = useState<string>('');
    const [expiredAt, setExpiredAt] = useState<Date | null>(null);
    const [status, setStatus] = useState<PaymentStatus>('confirm');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
    const [agreementInfo, setAgreementInfo] = useState<AgreementInfo | null>(null);

    const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const timerIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevOrderRef = useRef<string>('');

    // Is this a recurring subscription (uses sign + pay flow)
    const isRecurring = subscriptionType === 'recurring';

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

    // Stop polling
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
    const startPolling = useCallback(
      (pollOrderNo: string) => {
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
      },
      [onSuccess, stopPolling],
    );

    // Create order - only called when user confirms
    const handleConfirmPayment = useCallback(async () => {
      try {
        setStatus('loading');
        setErrorMessage('');

        // Close previous order if exists (only for onetime orders)
        if (prevOrderRef.current && !isRecurring) {
          try {
            await lambdaClient.payment.closeOrder.mutate({ orderNo: prevOrderRef.current });
          } catch (error) {
            console.error('Failed to close previous order:', error);
          }
        }

        if (isRecurring) {
          // Recurring subscription: use sign + pay flow (周期扣款签约扣款一体化)
          const result = await lambdaClient.payment.createSignPaymentOrder.mutate({
            billingInterval: billingCycle,
            planId,
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
            durationMonths,
            interval: billingCycle,
            payChannel: paymentMethod,
            planId,
            subscriptionType,
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
    }, [billingCycle, durationMonths, isRecurring, paymentMethod, planId, startPolling, subscriptionType]);

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
      // Recurring subscriptions use agreements, not standard orders
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

    // Render confirm step
    const renderConfirmStep = () => (
      <Flexbox gap={24}>
        {/* Order Summary */}
        <Flexbox className={styles.orderInfo} gap={12}>
          <Flexbox horizontal justify="space-between">
            <span className={styles.orderLabel}>订阅方案</span>
            <span className={styles.orderValue}>{planName}</span>
          </Flexbox>
          <Flexbox horizontal justify="space-between">
            <span className={styles.orderLabel}>订阅周期</span>
            <span className={styles.orderValue}>
              {getPeriodText(subscriptionType, billingCycle, durationMonths)}
            </span>
          </Flexbox>
          <div className={styles.divider} />
          <Flexbox align="center" horizontal justify="space-between">
            <span className={styles.orderLabel}>支付金额</span>
            <Flexbox align="baseline" gap={2} horizontal>
              <span className={styles.priceCurrency}>¥</span>
              <span className={styles.price}>{(amount / 100).toFixed(2)}</span>
            </Flexbox>
          </Flexbox>
        </Flexbox>

        {/* Payment Method */}
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
            description={`签约后将按${billingCycle === 'year' ? '年' : '月'}自动续费，您可随时在账户设置中取消`}
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
          {isRecurring ? `签约并支付 ¥${(amount / 100).toFixed(2)}` : `去支付 ¥${(amount / 100).toFixed(2)}`}
        </Button>
      </Flexbox>
    );

    // Render QR code step
    const renderQRCodeStep = () => (
      <Flexbox gap={20}>
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
                    ¥{(amount / 100).toFixed(2)}
                  </Typography.Text>
                </>
              ) : (
                <>
                  请使用支付宝扫码支付{' '}
                  <Typography.Text strong style={{ color: theme.colorError, fontSize: 16 }}>
                    ¥{(amount / 100).toFixed(2)}
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
            isRecurring
              ? '请在支付宝 App 中完成签约并支付首期费用，完成后页面会自动跳转。签约后将按周期自动扣款续费。'
              : '请在支付宝 App 中完成支付，支付完成后页面会自动跳转。'
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
        case 'confirm':
          return renderConfirmStep();

        case 'loading':
          return (
            <Center style={{ minHeight: 300 }}>
              <Spin size="large" tip="正在创建订单..." />
            </Center>
          );

        case 'qrcode':
          return renderQRCodeStep();

        case 'success':
          return (
            <Center style={{ minHeight: 300 }}>
              <Flexbox align="center" gap={16}>
                <Icon className={styles.successIcon} icon={CheckCircle} size={64} />
                <span style={{ fontSize: 20, fontWeight: 600 }}>支付成功！</span>
                <span style={{ color: theme.colorTextSecondary, fontSize: 14 }}>正在跳转...</span>
              </Flexbox>
            </Center>
          );

        case 'error':
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

        default:
          return null;
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
        width={480}
      >
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>
            {status === 'confirm'
              ? '确认订单'
              : status === 'qrcode'
                ? isRecurring
                  ? '签约扣款'
                  : '扫码支付'
                : '订阅支付'}
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

PaymentModal.displayName = 'PaymentModal';

export default PaymentModal;
