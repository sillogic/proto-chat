'use client';

import { Icon, Tag } from '@lobehub/ui';
import { Button, Select, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import { Atom, BrainCircuit, Check, CircleHelp, FlaskConical, Sparkles } from 'lucide-react';
import { memo, useState } from 'react';
import { Center, Flexbox } from 'react-layout-kit';

import PaymentModal from '@/features/Payment/PaymentModal';

import type { PlanData } from '../../hooks/useSubscriptionPlans';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  card: css`
    position: relative;

    overflow: hidden;
    flex: 1;

    min-width: 280px;
    max-width: 340px;
    padding: 0;
    border: 1px solid ${isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'};
    border-radius: 12px;

    background: ${isDarkMode ? token.colorBgElevated : token.colorBgContainer};

    transition: all 0.3s ease;

    &:hover {
      border-color: ${token.colorPrimary};
      box-shadow: 0 4px 20px ${isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'};
    }
  `,
  cardBody: css`
    padding-block: 20px 24px;
    padding-inline: 24px;
  `,
  cardHeader: css`
    padding-block: 24px 20px;
    padding-inline: 24px;
    border-block-end: 1px solid
      ${isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)'};
  `,
  checkIcon: css`
    flex-shrink: 0;
    color: ${token.colorSuccess};
  `,
  desc: css`
    font-size: 13px;
    line-height: 1.5;
    color: ${token.colorTextSecondary};
  `,
  discountTag: css`
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  `,
  featureItem: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
  `,
  featureValue: css`
    font-size: 13px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  iconContainer: css`
    flex-shrink: 0;

    width: 44px;
    height: 44px;
    border-radius: 10px;

    background: ${isDarkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.12)'};
  `,
  popularBadge: css`
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 24px;

    padding-block: 4px;
    padding-inline: 12px;
    border-radius: 0 0 8px 8px;

    font-size: 11px;
    font-weight: 500;
    color: #fff;

    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  `,
  price: css`
    font-size: 32px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    color: ${token.colorText};
  `,
  priceLabel: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
  `,
  sectionTitle: css`
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorTextTertiary};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `,
  title: css`
    font-size: 18px;
    font-weight: 600;
    color: ${token.colorText};
  `,
}));

const planIcons = {
  enterprise: {
    icon: Atom,
  },
  free: {
    icon: Sparkles,
  },
  lite: {
    icon: FlaskConical,
  },
  pro: {
    icon: BrainCircuit,
  },
  ultra: {
    icon: Atom,
  },
};

// Helper functions
const formatStorage = (mb: number) => {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
};

const formatNumber = (num: number | string) => {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
};

interface OnetimePlanCardProps {
  currentPlanSlug?: string;
  currentSubscriptionType?: string;
  plan: PlanData;
}

const OnetimePlanCard = memo<OnetimePlanCardProps>(({
  plan,
  currentPlanSlug,
  currentSubscriptionType,
}) => {
  const { styles, theme } = useStyles();
  const [selectedDuration, setSelectedDuration] = useState<number>(3); // Default to 3 months
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const iconConfig = planIcons[plan.slug as keyof typeof planIcons] || planIcons.lite;

  // Calculate prices in yuan (divide by 100 since backend stores in cents)
  const monthlyPrice = plan.monthlyPrice / 100;
  const yearlyPrice = plan.yearlyPrice ? plan.yearlyPrice / 100 : null;

  // Calculate amount based on selected duration
  const calculateAmount = (months: number) => {
    if (months === 12 && yearlyPrice) {
      return yearlyPrice;
    }
    return monthlyPrice * months;
  };

  // Calculate discount for 12 months
  const monthlyTotal = monthlyPrice * 12;
  const yearlyDiscount = yearlyPrice && monthlyTotal > yearlyPrice
    ? Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100)
    : 0;

  const currentAmount = calculateAmount(selectedDuration);

  // Check if this is the current plan
  const isCurrentPlan =
    currentPlanSlug === plan.slug && currentSubscriptionType === 'onetime';

  const getButtonText = () => {
    if (isCurrentPlan) {
      return '当前方案';
    }
    return '立即购买';
  };

  // Duration options
  const durationOptions = [
    { label: `1个月 - ¥${monthlyPrice}`, value: 1 },
    { label: `3个月 - ¥${monthlyPrice * 3}`, value: 3 },
    { label: `6个月 - ¥${monthlyPrice * 6}`, value: 6 },
    {
      label: (
        <Flexbox align={'center'} gap={6} horizontal>
          <span>12个月 - ¥{yearlyPrice}</span>
          {yearlyDiscount > 0 && (
            <Tag className={styles.discountTag} size={'small'}>
              省{yearlyDiscount}%
            </Tag>
          )}
        </Flexbox>
      ),
      value: 12,
    },
  ];

  return (
    <Flexbox className={styles.card}>
      {plan.isPopular && <div className={styles.popularBadge}>推荐</div>}

      {/* Header */}
      <Flexbox className={styles.cardHeader} gap={16}>
        <Flexbox align={'center'} gap={12} horizontal>
          <Center className={styles.iconContainer}>
            <Icon color={theme.colorText} icon={iconConfig.icon} size={22} />
          </Center>
          <Flexbox gap={2}>
            <span className={styles.title}>{plan.name}</span>
            <span className={styles.desc}>{plan.features?.display?.description}</span>
          </Flexbox>
        </Flexbox>

        {/* Duration Selector */}
        <Flexbox gap={4}>
          <span style={{ color: theme.colorTextSecondary, fontSize: 13 }}>
            选择购买时长
          </span>
          <Select
            onChange={setSelectedDuration}
            options={durationOptions}
            size="large"
            style={{ width: '100%' }}
            value={selectedDuration}
          />
        </Flexbox>

        {/* Total Price */}
        <Flexbox gap={4}>
          <Flexbox align={'baseline'} gap={4} horizontal>
            <span className={styles.price}>¥{currentAmount}</span>
            <span className={styles.priceLabel}>总计</span>
          </Flexbox>
          <span style={{ color: theme.colorTextTertiary, fontSize: 12 }}>
            {selectedDuration === 12 && yearlyDiscount > 0
              ? `立省 ¥${monthlyTotal - (yearlyPrice || 0)}`
              : '无需自动续订'}
          </span>
        </Flexbox>

        {/* Purchase Button */}
        <Button
          block
          disabled={isCurrentPlan}
          onClick={() => setPaymentModalOpen(true)}
          style={
            plan.isPopular && !isCurrentPlan
              ? { background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }
              : undefined
          }
          type={plan.isPopular && !isCurrentPlan ? 'primary' : 'default'}
        >
          {getButtonText()}
        </Button>
      </Flexbox>

      {/* Body - Same features as PlanCard */}
      <Flexbox className={styles.cardBody} gap={20}>
        {/* Credits Section */}
        <Flexbox gap={8}>
          <Flexbox align={'center'} gap={4} horizontal>
            <span className={styles.sectionTitle}>计算积分</span>
            <Tooltip title="计算积分用于调用 AI 模型">
              <Icon icon={CircleHelp} size={12} style={{ color: theme.colorTextQuaternary }} />
            </Tooltip>
          </Flexbox>
          <span style={{ color: theme.colorText, fontSize: 15, fontWeight: 600 }}>
            {formatNumber(plan.credits)} /月
          </span>
          <Flexbox gap={6}>
            {(plan.features?.display?.model_estimates || []).map((estimate, index) => (
              <Flexbox align={'center'} gap={8} horizontal key={index}>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>{estimate.model}</span>
                <span className={styles.featureValue}>{estimate.count}</span>
              </Flexbox>
            ))}
          </Flexbox>
        </Flexbox>

        {/* Files Section */}
        <Flexbox gap={8}>
          <span className={styles.sectionTitle}>文件存储</span>
          <Flexbox gap={6}>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={14} />
              <span className={styles.featureItem}>文件存储</span>
              <span className={styles.featureValue}>{formatStorage(plan.storageLimit)}</span>
            </Flexbox>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={14} />
              <span className={styles.featureItem}>向量存储</span>
              <span className={styles.featureValue}>
                {formatNumber(plan.vectorLimit)} 条{' '}
                <span style={{ color: theme.colorTextQuaternary, fontSize: 12 }}>
                  {plan.features?.resources?.vector_storage_display}
                </span>
              </span>
            </Flexbox>
          </Flexbox>
        </Flexbox>

        {/* Cloud Services */}
        <Flexbox gap={8}>
          <span className={styles.sectionTitle}>云服务</span>
          <Flexbox gap={6}>
            {plan.features?.cloud_services?.unlimited_history && (
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>无限历史记录</span>
              </Flexbox>
            )}
            {plan.features?.cloud_services?.global_sync && (
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>全球同步</span>
              </Flexbox>
            )}
            {plan.features?.cloud_services?.web_search && (
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>联网搜索</span>
              </Flexbox>
            )}
            {plan.features?.capabilities?.custom_api && (
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>自定义 API</span>
              </Flexbox>
            )}
          </Flexbox>
        </Flexbox>

        {/* Support */}
        <Flexbox gap={8}>
          <span className={styles.sectionTitle}>技术支持</span>
          <Flexbox align={'center'} gap={8} horizontal>
            <Icon className={styles.checkIcon} icon={Check} size={14} />
            <span className={styles.featureItem}>
              {plan.features?.support?.level || '-'}
            </span>
          </Flexbox>
        </Flexbox>
      </Flexbox>

      {/* Payment Modal */}
      <PaymentModal
        amount={calculateAmount(selectedDuration) * 100} // Convert back to cents
        billingCycle="month" // Use month as base interval
        durationMonths={selectedDuration}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={() => {
          setPaymentModalOpen(false);
          window.location.reload();
        }}
        open={paymentModalOpen}
        planId={plan.id}
        planName={plan.name}
        subscriptionType="onetime"
      />
    </Flexbox>
  );
});

OnetimePlanCard.displayName = 'OnetimePlanCard';

export default OnetimePlanCard;
