'use client';

import { Icon } from '@lobehub/ui';
import { Alert, Button, Modal, Spin } from 'antd';
import { createStyles } from 'antd-style';
import { CheckCircle, XCircle } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';
import { QRCodeSVG } from 'qrcode.react';

import { lambdaClient } from '@/libs/trpc/client';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  modal: css`
    .ant-modal-content {
      padding: 0;
    }
  `,
  header: css`
    padding-block: 24px;
    padding-inline: 32px;
    border-bottom: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
  `,
  body: css`
    padding-block: 32px;
    padding-inline: 32px;
  `,
  footer: css`
    padding-block: 16px;
    padding-inline: 32px;
    border-top: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
  `,
  qrContainer: css`
    padding: 24px;
    border: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
    border-radius: 12px;
    background: ${isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'};
  `,
  title: css`
    font-size: 18px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  subtitle: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  price: css`
    font-size: 28px;
    font-weight: 700;
    color: ${token.colorPrimary};
  `,
  timer: css`
    font-size: 16px;
    font-weight: 500;
    color: ${token.colorWarning};
  `,
  hint: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
    text-align: center;
  `,
  successIcon: css`
    color: ${token.colorSuccess};
  `,
  errorIcon: css`
    color: ${token.colorError};
  `,
}));

interface PaymentModalProps {
  open: boolean;
  planName: string;
  planId: string;
  amount: number; // in cents
  billingCycle: 'month' | 'year';
  onClose: () => void;
  onSuccess: () => void;
}

const PaymentModal = memo<PaymentModalProps>(
  ({ open, planName, planId, amount, billingCycle, onClose, onSuccess }) => {
    const { t } = useTranslation('subscription');
    const { styles } = useStyles();

    const [orderNo, setOrderNo] = useState<string>('');
    const [codeUrl, setCodeUrl] = useState<string>('');
    const [expiredAt, setExpiredAt] = useState<Date | null>(null);
    const [status, setStatus] = useState<'loading' | 'qrcode' | 'polling' | 'success' | 'error'>(
      'loading',
    );
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Create order when modal opens
    useEffect(() => {
      if (!open) return;

      const createOrder = async () => {
        try {
          setStatus('loading');
          setErrorMessage('');

          const result = await lambdaClient.payment.createOrder.mutate({
            planId,
            interval: billingCycle,
            payChannel: 'wechat_native',
          });

          setOrderNo(result.orderNo);
          setCodeUrl(result.codeUrl || '');
          setExpiredAt(new Date(result.expiredAt));
          setStatus('qrcode');

          // Start polling
          startPolling(result.orderNo);
        } catch (error) {
          console.error('Failed to create order:', error);
          setStatus('error');
          setErrorMessage(
            error instanceof Error ? error.message : t('payment.error.createFailed', '创建订单失败'),
          );
        }
      };

      createOrder();
    }, [open, planId, billingCycle, t]);

    // Countdown timer
    useEffect(() => {
      if (!expiredAt || status === 'success' || status === 'error') return;

      const updateTimer = () => {
        const now = new Date();
        const diff = expiredAt.getTime() - now.getTime();

        if (diff <= 0) {
          setRemainingSeconds(0);
          setStatus('error');
          setErrorMessage(t('payment.error.expired', '二维码已过期'));
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
    }, [expiredAt, status, t]);

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
            // Wait a moment to show success, then call onSuccess
            setTimeout(() => {
              onSuccess();
            }, 1500);
          } else if (result.status === 'closed') {
            setStatus('error');
            setErrorMessage(t('payment.error.closed', '订单已关闭'));
            stopPolling();
          }
        } catch (error) {
          console.error('Failed to query order:', error);
          // Don't stop polling on query error, just log it
        }
      }, 3000); // Poll every 3 seconds
    }, [onSuccess, t]);

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

    // Cleanup on unmount or close
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

      // Close order if still pending
      if (orderNo && (status === 'qrcode' || status === 'polling')) {
        try {
          await lambdaClient.payment.closeOrder.mutate({ orderNo });
        } catch (error) {
          console.error('Failed to close order:', error);
        }
      }

      stopPolling();
      onClose();
    }, [status, orderNo, onClose, stopPolling]);

    const formatTime = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
      return `${minutes}:${String(secs).padStart(2, '0')}`;
    };

    const renderContent = () => {
      if (status === 'loading') {
        return (
          <Center style={{ minHeight: 400 }}>
            <Spin size="large" tip={t('payment.creating', '正在创建订单...')} />
          </Center>
        );
      }

      if (status === 'error') {
        return (
          <Center style={{ minHeight: 400 }}>
            <Flexbox align="center" gap={16}>
              <Icon className={styles.errorIcon} icon={XCircle} size={48} />
              <span style={{ fontSize: 16, fontWeight: 500 }}>
                {errorMessage || t('payment.error.unknown', '支付失败')}
              </span>
              <Button onClick={handleClose} type="primary">
                {t('payment.close', '关闭')}
              </Button>
            </Flexbox>
          </Center>
        );
      }

      if (status === 'success') {
        return (
          <Center style={{ minHeight: 400 }}>
            <Flexbox align="center" gap={16}>
              <Icon className={styles.successIcon} icon={CheckCircle} size={48} />
              <span style={{ fontSize: 18, fontWeight: 600 }}>
                {t('payment.success', '支付成功！')}
              </span>
              <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)' }}>
                {t('payment.successHint', '正在跳转...')}
              </span>
            </Flexbox>
          </Center>
        );
      }

      // QR code display
      return (
        <Flexbox gap={24}>
          {/* QR Code */}
          <Center className={styles.qrContainer}>
            {codeUrl ? (
              <QRCodeSVG value={codeUrl} size={240} level="M" />
            ) : (
              <div style={{ width: 240, height: 240 }}>
                <Center style={{ height: '100%' }}>
                  <Spin />
                </Center>
              </div>
            )}
          </Center>

          {/* Instructions */}
          <Flexbox align="center" gap={8}>
            <span className={styles.hint}>
              {t('payment.scanHint', '请使用微信扫码完成支付')}
            </span>
            {remainingSeconds > 0 && (
              <span className={styles.timer}>
                {t('payment.expireIn', '有效期')}: {formatTime(remainingSeconds)}
              </span>
            )}
          </Flexbox>

          {/* Alert */}
          <Alert
            message={t('payment.alert.title', '支付提示')}
            description={t(
              'payment.alert.description',
              '请在新窗口完成支付，支付完成后会自动跳转。请勿关闭此窗口。',
            )}
            type="info"
            showIcon
          />
        </Flexbox>
      );
    };

    return (
      <Modal
        centered
        className={styles.modal}
        footer={null}
        onCancel={handleClose}
        open={open}
        width={480}
      >
        <div className={styles.header}>
          <Flexbox gap={8}>
            <span className={styles.title}>
              {t('payment.subscribe', '订阅')} {planName}
            </span>
            <span className={styles.subtitle}>
              {billingCycle === 'year'
                ? t('payment.yearlyBilling', '年付')
                : t('payment.monthlyBilling', '月付')}
            </span>
          </Flexbox>
        </div>

        <div className={styles.body}>
          <Flexbox gap={24}>
            <Center>
              <span className={styles.price}>¥{(amount / 100).toFixed(2)}</span>
            </Center>
            {renderContent()}
          </Flexbox>
        </div>

        {status !== 'success' && status !== 'loading' && (
          <div className={styles.footer}>
            <Button block disabled={status === 'polling'} onClick={handleClose}>
              {t('payment.cancel', '取消支付')}
            </Button>
          </div>
        )}
      </Modal>
    );
  },
);

PaymentModal.displayName = 'PaymentModal';

export default PaymentModal;
