'use client';

import { Icon, Tag } from '@lobehub/ui';
import { Button, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import { Atom, BrainCircuit, Check, CircleHelp, FlaskConical } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';

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

interface PlanCardProps {
  billingCycle: BillingCycle;
  credits: string;
  deepseek: string;
  desc: string;
  fileStorage: string;
  gpt5Mini: string;
  id: string;
  name: string;
  onUpgrade: (planId: string) => void;
  popular?: boolean;
  price: {
    monthly: number;
    yearly: number;
  };
  vectorStorage: string;
  vectorStorageSize: string;
}

const PlanCard = memo<PlanCardProps>(
  ({
    id,
    name,
    desc,
    price,
    credits,
    gpt5Mini,
    deepseek,
    fileStorage,
    vectorStorage,
    vectorStorageSize,
    popular,
    billingCycle,
    onUpgrade,
  }) => {
    const { t } = useTranslation('subscription');
    const { styles, theme } = useStyles();

    const iconConfig = planIcons[id as keyof typeof planIcons] || planIcons.lite;
    const isYearly = billingCycle === 'yearly';
    const currentPrice = isYearly ? Math.round(price.yearly / 12) : price.monthly;
    const yearlyTotal = price.yearly;
    const monthlyTotal = price.monthly * 12;

    return (
      <Flexbox className={styles.card}>
        {popular && <div className={styles.popularBadge}>{t('cta.popular', '推荐')}</div>}

        {/* Header */}
        <Flexbox className={styles.cardHeader} gap={16}>
          <Flexbox align={'center'} gap={12} horizontal>
            <Center className={styles.iconContainer}>
              <Icon color={theme.colorText} icon={iconConfig.icon} size={22} />
            </Center>
            <Flexbox gap={2}>
              <span className={styles.title}>{t(name as any)}</span>
              <span className={styles.desc}>{t(desc as any)}</span>
            </Flexbox>
          </Flexbox>

          {/* Price */}
          <Flexbox gap={4}>
            <Flexbox align={'baseline'} gap={4} horizontal>
              <span className={styles.price}>¥{currentPrice}</span>
              <span className={styles.priceLabel}>/月</span>
            </Flexbox>
            {isYearly && (
              <Flexbox align={'center'} gap={8} horizontal>
                <span className={styles.priceOriginal}>¥{monthlyTotal}/年</span>
                <Tag color="blue" size={'small'}>
                  {t('billingCycle.yearlyDiscount')}
                </Tag>
              </Flexbox>
            )}
            {isYearly && (
              <span style={{ color: theme.colorTextTertiary, fontSize: 12 }}>
                实付 ¥{yearlyTotal}/年
              </span>
            )}
          </Flexbox>

          {/* Upgrade Button */}
          <Button
            block
            onClick={() => onUpgrade(id)}
            style={
              popular
                ? { background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }
                : undefined
            }
            type={popular ? 'primary' : 'default'}
          >
            {t('cta.upgrade')}
          </Button>
        </Flexbox>

        {/* Body */}
        <Flexbox className={styles.cardBody} gap={20}>
          {/* Credits Section */}
          <Flexbox gap={8}>
            <Flexbox align={'center'} gap={4} horizontal>
              <span className={styles.sectionTitle}>{t('features.credits')}</span>
              <Tooltip title="计算积分用于调用 AI 模型">
                <Icon icon={CircleHelp} size={12} style={{ color: theme.colorTextQuaternary }} />
              </Tooltip>
            </Flexbox>
            <span style={{ color: theme.colorText, fontSize: 15, fontWeight: 600 }}>
              {credits} {t('features.creditsPerMonth')}
            </span>
            <Flexbox gap={6}>
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>GPT-5 mini</span>
                <span className={styles.featureValue}>{gpt5Mini}</span>
              </Flexbox>
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>DeepSeek V3.2</span>
                <span className={styles.featureValue}>{deepseek}</span>
              </Flexbox>
            </Flexbox>
          </Flexbox>

          {/* Files Section */}
          <Flexbox gap={8}>
            <span className={styles.sectionTitle}>{t('features.files')}</span>
            <Flexbox gap={6}>
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>{t('features.fileStorage')}</span>
                <span className={styles.featureValue}>{fileStorage}</span>
              </Flexbox>
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>{t('features.vectorStorage')}</span>
                <span className={styles.featureValue}>
                  {vectorStorage}{' '}
                  <span style={{ color: theme.colorTextQuaternary, fontSize: 12 }}>
                    {vectorStorageSize}
                  </span>
                </span>
              </Flexbox>
            </Flexbox>
          </Flexbox>

          {/* Services */}
          <Flexbox gap={8}>
            <span className={styles.sectionTitle}>{t('features.cloudService')}</span>
            <Flexbox gap={6}>
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>{t('features.unlimitedHistory')}</span>
              </Flexbox>
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>{t('features.globalSync')}</span>
              </Flexbox>
              <Flexbox align={'center'} gap={8} horizontal>
                <Icon className={styles.checkIcon} icon={Check} size={14} />
                <span className={styles.featureItem}>{t('features.webSearch')}</span>
              </Flexbox>
            </Flexbox>
          </Flexbox>

          {/* Support */}
          <Flexbox gap={8}>
            <span className={styles.sectionTitle}>{t('features.support')}</span>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={14} />
              <span className={styles.featureItem}>
                {id === 'lite'
                  ? t('features.communitySupport')
                  : id === 'pro'
                    ? t('features.priorityEmail')
                    : t('features.priorityChat')}
              </span>
            </Flexbox>
          </Flexbox>
        </Flexbox>
      </Flexbox>
    );
  },
);

PlanCard.displayName = 'PlanCard';

export default PlanCard;
