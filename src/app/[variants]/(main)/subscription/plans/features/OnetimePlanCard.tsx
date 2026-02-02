'use client';

import { Icon, Tag } from '@lobehub/ui';
import { Button, Select, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import { Atom, BrainCircuit, Check, CircleHelp, FlaskConical, Sparkles } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Center, Flexbox } from 'react-layout-kit';

import PaymentModal from '@/features/Payment/PaymentModal';
import UpgradePaymentModal from '@/features/Payment/UpgradePaymentModal';

import type { PlanData } from '../../hooks/useSubscriptionPlans';
import { checkUpgradeEligibility, type PlanLevelParams } from '../../utils/planLevel';

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
  currentTag: css`
    padding-inline: 6px;
    border-radius: 4px;

    font-size: 11px;
    color: ${token.colorPrimary};

    background: ${token.colorPrimaryBg};
  `,
  desc: css`
    font-size: 13px;
    line-height: 1.5;
    color: ${token.colorTextSecondary};
  `,
  disabledTag: css`
    padding-inline: 6px;
    border-radius: 4px;

    font-size: 11px;
    color: ${token.colorTextQuaternary};

    background: ${isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)'};
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
  upgradeTag: css`
    padding-inline: 6px;
    border-radius: 4px;

    font-size: 11px;
    color: ${token.colorSuccess};

    background: ${token.colorSuccessBg};
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
  currentBillingInterval?: 'month' | 'year' | null;
  currentDurationMonths?: number | null;
  currentPaidAmount?: number; // 当前套餐实付金额（分）
  currentPlanExpiresAt?: Date | null;
  currentPlanName?: string;
  currentPlanSlug?: string;
  currentSubscriptionType?: 'recurring' | 'onetime' | null;
  plan: PlanData;
}

const OnetimePlanCard = memo<OnetimePlanCardProps>(({
  plan,
  currentPlanSlug,
  currentSubscriptionType,
  currentBillingInterval,
  currentDurationMonths,
  currentPaidAmount,
  currentPlanExpiresAt,
  currentPlanName,
}) => {
  const { styles, theme } = useStyles();
  const navigate = useNavigate();
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

  // Calculate discount amount for 12-month one-time payment (in cents)
  const yearlyDiscountAmount = selectedDuration === 12 && plan.yearlyPrice && plan.monthlyPrice * 12 > plan.yearlyPrice
    ? plan.monthlyPrice * 12 - plan.yearlyPrice
    : 0;

  const discount = yearlyDiscountAmount > 0
    ? {
        amount: yearlyDiscountAmount,
        label: '年付优惠',
      }
    : undefined;

  const currentAmount = calculateAmount(selectedDuration);

  // Build current user plan params for level comparison
  const currentPlanParams: PlanLevelParams | null = currentPlanSlug
    ? {
        billingInterval: currentBillingInterval,
        durationMonths: currentDurationMonths,
        planSlug: currentPlanSlug,
        subscriptionType: currentSubscriptionType || 'recurring',
      }
    : null;

  // Calculate eligibility for each duration option
  const durationEligibility = useMemo(() => {
    const durations = [1, 3, 6, 12] as const;
    return durations.reduce(
      (acc, duration) => {
        const targetParams: PlanLevelParams = {
          billingInterval: null,
          durationMonths: duration,
          planSlug: plan.slug,
          subscriptionType: 'onetime',
        };
        acc[duration] = checkUpgradeEligibility(currentPlanParams, targetParams);
        return acc;
      },
      {} as Record<number, ReturnType<typeof checkUpgradeEligibility>>,
    );
  }, [currentPlanParams, plan.slug]);

  // Get eligibility for selected duration
  const { canUpgrade, isCurrentPlan, isSameLevelOrLower } =
    durationEligibility[selectedDuration] || {
      canUpgrade: true,
      isCurrentPlan: false,
      isSameLevelOrLower: false,
    };

  // Button disabled state
  const isButtonDisabled = isCurrentPlan || isSameLevelOrLower;

  const getButtonText = () => {
    if (isCurrentPlan) {
      return '我的订阅';
    }
    if (canUpgrade) {
      return '订阅升级';
    }
    return '订阅';
  };

  const getButtonType = () => {
    if (isCurrentPlan || isSameLevelOrLower) {
      return 'default';
    }
    if (canUpgrade || plan.isPopular) {
      return 'primary';
    }
    return 'default';
  };

  // Tooltip for disabled lower-level plans
  const getTooltipTitle = () => {
    if (isSameLevelOrLower && !isCurrentPlan) {
      return '您已开通同级或更高等级订阅，无需再订阅此套餐';
    }
    return '';
  };

  // Helper function to get status tag for duration option
  const getStatusTag = (duration: number) => {
    const eligibility = durationEligibility[duration];
    if (!eligibility) return null;

    if (eligibility.isCurrentPlan) {
      return <span className={styles.currentTag}>当前方案</span>;
    }
    if (eligibility.canUpgrade) {
      return <span className={styles.upgradeTag}>可升级</span>;
    }
    if (eligibility.isSameLevelOrLower) {
      return <span className={styles.disabledTag}>不可用</span>;
    }
    return null;
  };

  // Duration options with status labels
  const durationOptions = [
    {
      disabled: durationEligibility[1]?.isSameLevelOrLower && !durationEligibility[1]?.isCurrentPlan,
      label: (
        <Flexbox align={'center'} gap={6} horizontal justify={'space-between'} style={{ width: '100%' }}>
          <span>1个月 - ¥{monthlyPrice}</span>
          {getStatusTag(1)}
        </Flexbox>
      ),
      value: 1,
    },
    {
      disabled: durationEligibility[3]?.isSameLevelOrLower && !durationEligibility[3]?.isCurrentPlan,
      label: (
        <Flexbox align={'center'} gap={6} horizontal justify={'space-between'} style={{ width: '100%' }}>
          <span>3个月 - ¥{monthlyPrice * 3}</span>
          {getStatusTag(3)}
        </Flexbox>
      ),
      value: 3,
    },
    {
      disabled: durationEligibility[6]?.isSameLevelOrLower && !durationEligibility[6]?.isCurrentPlan,
      label: (
        <Flexbox align={'center'} gap={6} horizontal justify={'space-between'} style={{ width: '100%' }}>
          <span>6个月 - ¥{monthlyPrice * 6}</span>
          {getStatusTag(6)}
        </Flexbox>
      ),
      value: 6,
    },
    {
      disabled: durationEligibility[12]?.isSameLevelOrLower && !durationEligibility[12]?.isCurrentPlan,
      label: (
        <Flexbox align={'center'} gap={6} horizontal justify={'space-between'} style={{ width: '100%' }}>
          <Flexbox align={'center'} gap={6} horizontal>
            <span>12个月 - ¥{yearlyPrice}</span>
            {yearlyDiscount > 0 && (
              <Tag className={styles.discountTag} size={'small'}>
                省{yearlyDiscount}%
              </Tag>
            )}
          </Flexbox>
          {getStatusTag(12)}
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
        <Tooltip title={getTooltipTitle()}>
          <span style={{ display: 'block' }}>
            <Button
              block
              disabled={isButtonDisabled && !isCurrentPlan}
              onClick={() => !isCurrentPlan && setPaymentModalOpen(true)}
              style={
                isCurrentPlan
                  ? {
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderColor: 'rgba(59, 130, 246, 0.3)',
                      color: '#1d4ed8',
                      cursor: 'default',
                    }
                  : canUpgrade || (plan.isPopular && !isButtonDisabled)
                    ? { background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }
                    : undefined
              }
              type={isCurrentPlan ? 'default' : getButtonType()}
            >
              {getButtonText()}
            </Button>
          </span>
        </Tooltip>
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

      {/* Payment Modal - Use UpgradePaymentModal for upgrades, PaymentModal for new subscriptions */}
      {canUpgrade && currentPlanSlug && currentPlanSlug !== 'free' ? (
        <UpgradePaymentModal
          currentPlan={{
            billingInterval: currentBillingInterval,
            durationMonths: currentDurationMonths,
            paidAmount: currentPaidAmount,
            planExpiresAt: currentPlanExpiresAt,
            planName: currentPlanName || currentPlanSlug,
            planSlug: currentPlanSlug,
            subscriptionType: currentSubscriptionType || 'recurring',
          }}
          discount={discount}
          newPlan={{
            billingInterval: 'month',
            durationMonths: selectedDuration,
            // 原价始终按月价计算（不含折扣），折扣单独显示
            originalPrice: plan.monthlyPrice * selectedDuration,
            planId: plan.id,
            planName: plan.name,
            planSlug: plan.slug,
            subscriptionType: 'onetime',
          }}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={() => {
            setPaymentModalOpen(false);
            navigate('/profile');
          }}
          open={paymentModalOpen}
        />
      ) : (
        <PaymentModal
          amount={calculateAmount(selectedDuration) * 100}
          billingCycle="month"
          durationMonths={selectedDuration}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={() => {
            setPaymentModalOpen(false);
            navigate('/profile');
          }}
          open={paymentModalOpen}
          planId={plan.id}
          planName={plan.name}
          subscriptionType="onetime"
        />
      )}
    </Flexbox>
  );
});

OnetimePlanCard.displayName = 'OnetimePlanCard';

export default OnetimePlanCard;
