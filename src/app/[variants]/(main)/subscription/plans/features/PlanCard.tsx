'use client';

import { Icon, Tag } from '@lobehub/ui';
import { Button, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import { Atom, BrainCircuit, Check, CircleHelp, FlaskConical, Sparkles } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Center, Flexbox } from 'react-layout-kit';

import PaymentModal from '@/features/Payment/PaymentModal';
import UpgradePaymentModal from '@/features/Payment/UpgradePaymentModal';

import type { PlanData } from '../../hooks/useSubscriptionPlans';
import { checkUpgradeEligibility, type PlanLevelParams } from '../../utils/planLevel';
import type { BillingCycle } from './BillingToggle';

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
  priceOriginal: css`
    font-size: 13px;
    color: ${token.colorTextQuaternary};
    text-decoration: line-through;
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

interface PlanCardProps {
  billingCycle: BillingCycle;
  currentBillingInterval?: 'month' | 'year' | null;
  currentDurationMonths?: number | null;
  currentPaidAmount?: number; // 当前套餐实付金额（分）- 仅用于显示
  currentPlanExpiresAt?: Date | null;
  currentPlanName?: string;
  currentPlanSlug?: string;
  currentPlanValue?: number; // 当前套餐价值（分）- 用于残值计算
  currentSubscriptionType?: 'recurring' | 'onetime' | null;
  plan: PlanData;
}

const PlanCard = memo<PlanCardProps>(({
  plan,
  billingCycle,
  currentPlanSlug,
  currentSubscriptionType,
  currentBillingInterval,
  currentDurationMonths,
  currentPaidAmount,
  currentPlanValue,
  currentPlanExpiresAt,
  currentPlanName,
}) => {
  const { t } = useTranslation('subscription');
  const { styles, theme } = useStyles();
  const navigate = useNavigate();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const iconConfig = planIcons[plan.slug as keyof typeof planIcons] || planIcons.lite;
  const isYearly = billingCycle === 'yearly';

  // Calculate prices in yuan (divide by 100 since backend stores in cents)
  const monthlyPrice = plan.monthlyPrice / 100;
  const yearlyPrice = plan.yearlyPrice ? plan.yearlyPrice / 100 : null;

  // Determine displayed price
  const currentPrice = isYearly && yearlyPrice ? Math.round(yearlyPrice / 12) : monthlyPrice;
  const yearlyTotal = yearlyPrice;
  const monthlyTotal = monthlyPrice * 12;

  // Check if yearly billing is available and has discount
  const hasYearlyOption = yearlyPrice !== null;
  const showYearlyDiscount = isYearly && yearlyPrice && yearlyPrice < monthlyPrice * 12;

  // Calculate discount for yearly subscriptions (only recurring yearly has discount)
  const yearlyDiscountAmount = isYearly && plan.yearlyPrice && plan.monthlyPrice * 12 > plan.yearlyPrice
    ? plan.monthlyPrice * 12 - plan.yearlyPrice
    : 0;

  const discount = yearlyDiscountAmount > 0
    ? {
        amount: yearlyDiscountAmount,
        label: '年付优惠',
      }
    : undefined;

  // Build current user plan params for level comparison
  const currentPlanParams: PlanLevelParams | null = currentPlanSlug
    ? {
        billingInterval: currentBillingInterval,
        durationMonths: currentDurationMonths,
        planSlug: currentPlanSlug,
        subscriptionType: currentSubscriptionType || 'recurring',
      }
    : null;

  // Build target plan params (this card's plan with recurring subscription)
  const targetPlanParams: PlanLevelParams = {
    billingInterval: isYearly ? 'year' : 'month',
    durationMonths: null,
    planSlug: plan.slug,
    subscriptionType: 'recurring',
  };

  // Check upgrade eligibility using the utility function
  const { canUpgrade, isCurrentPlan, isSameLevelOrLower } = checkUpgradeEligibility(
    currentPlanParams,
    targetPlanParams,
  );

  // Button disabled state
  const isButtonDisabled = isCurrentPlan || isSameLevelOrLower || (!hasYearlyOption && isYearly);

  const getButtonText = () => {
    if (isCurrentPlan) {
      return t('cta.currentSubscription', '我的订阅');
    }
    if (canUpgrade) {
      return t('cta.upgradeSubscription', '订阅升级');
    }
    return t('cta.subscribe', '订阅');
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

  return (
    <Flexbox className={styles.card}>
      {plan.isPopular && <div className={styles.popularBadge}>{t('cta.popular', '推荐')}</div>}

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

        {/* Price */}
        <Flexbox gap={4}>
          <Flexbox align={'baseline'} gap={4} horizontal>
            <span className={styles.price}>¥{currentPrice}</span>
            <span className={styles.priceLabel}>/月</span>
          </Flexbox>
          {showYearlyDiscount && (
            <Flexbox align={'center'} gap={8} horizontal>
              <span className={styles.priceOriginal}>¥{monthlyTotal}/年</span>
              <Tag color="blue" size={'small'}>
                {t('billingCycle.yearlyDiscount', '年付优惠')}
              </Tag>
            </Flexbox>
          )}
          {isYearly && yearlyTotal && (
            <span style={{ color: theme.colorTextTertiary, fontSize: 12 }}>
              实付 ¥{yearlyTotal}/年
            </span>
          )}
        </Flexbox>

        {/* Upgrade Button */}
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

      {/* Body */}
      <Flexbox className={styles.cardBody} gap={20}>
        {/* Credits Section */}
        <Flexbox gap={8}>
          <Flexbox align={'center'} gap={4} horizontal>
            <span className={styles.sectionTitle}>{t('features.credits', '计算积分')}</span>
            <Tooltip title="计算积分用于调用 AI 模型">
              <Icon icon={CircleHelp} size={12} style={{ color: theme.colorTextQuaternary }} />
            </Tooltip>
          </Flexbox>
          <span style={{ color: theme.colorText, fontSize: 15, fontWeight: 600 }}>
            {formatNumber(plan.credits)} {t('features.creditsPerMonth', '/月')}
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
          <span className={styles.sectionTitle}>{t('features.files', '文件存储')}</span>
          <Flexbox gap={6}>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={14} />
              <span className={styles.featureItem}>{t('features.fileStorage', '文件存储')}</span>
              <span className={styles.featureValue}>{formatStorage(plan.storageLimit)}</span>
            </Flexbox>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={14} />
              <span className={styles.featureItem}>
                {t('features.vectorStorage', '向量存储')}
              </span>
              <span className={styles.featureValue}>
                {formatNumber(plan.vectorLimit)} 条{' '}
                <span style={{ color: theme.colorTextQuaternary, fontSize: 12 }}>
                  {plan.features?.resources?.vector_storage_display}
                </span>
              </span>
            </Flexbox>
          </Flexbox>
        </Flexbox>

        {/* Cloud Services - Capabilities */}
        <Flexbox gap={8}>
          <span className={styles.sectionTitle}>{t('features.cloudService', '云服务')}</span>
          <Flexbox gap={6}>
            {plan.features?.cloud_services?.unlimited_history && (
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>
                  {t('features.unlimitedHistory', '无限历史记录')}
                </span>
              </Flexbox>
            )}
            {plan.features?.cloud_services?.global_sync && (
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>
                  {t('features.globalSync', '全球同步')}
                </span>
              </Flexbox>
            )}
            {plan.features?.cloud_services?.web_search && (
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>{t('features.webSearch', '联网搜索')}</span>
              </Flexbox>
            )}
            {plan.features?.capabilities?.custom_api && (
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>{t('features.customApi', '自定义 API')}</span>
              </Flexbox>
            )}
          </Flexbox>
        </Flexbox>

        {/* Support */}
        <Flexbox gap={8}>
          <span className={styles.sectionTitle}>{t('features.support', '技术支持')}</span>
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
            planValue: currentPlanValue,
            subscriptionType: currentSubscriptionType || 'recurring',
          }}
          discount={discount}
          newPlan={{
            billingInterval: isYearly ? 'year' : 'month',
            // 原价：年付按月价*12计算（不含折扣），折扣单独显示
            originalPrice: isYearly ? plan.monthlyPrice * 12 : plan.monthlyPrice,
            planId: plan.id,
            planName: plan.name,
            planSlug: plan.slug,
            subscriptionType: 'recurring',
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
          amount={isYearly && plan.yearlyPrice ? plan.yearlyPrice : plan.monthlyPrice}
          billingCycle={isYearly ? 'year' : 'month'}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={() => {
            setPaymentModalOpen(false);
            navigate('/profile');
          }}
          open={paymentModalOpen}
          planId={plan.id}
          planName={plan.name}
          subscriptionType="recurring"
        />
      )}
    </Flexbox>
  );
});

PlanCard.displayName = 'PlanCard';

export default PlanCard;
