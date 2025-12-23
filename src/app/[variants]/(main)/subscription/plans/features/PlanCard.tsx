'use client';

import { Icon, Tag } from '@lobehub/ui';
import { Button, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import { Box, Check, CircleHelp, Sparkle, Zap } from 'lucide-react';
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
    max-width: 360px;
    padding: 24px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 16px;

    background: ${isDarkMode ? token.colorBgElevated : token.colorBgContainer};

    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      border-color: ${token.colorPrimary};
      box-shadow: 0 8px 24px ${isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'};
    }
  `,
  checkIcon: css`
    color: ${token.colorSuccess};
  `,
  desc: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
  `,
  featureItem: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
  `,
  featureTitle: css`
    font-size: 13px;
    font-weight: 500;
    color: ${token.colorTextSecondary};
  `,
  featureValue: css`
    font-size: 13px;
    color: ${token.colorText};
  `,
  iconContainer: css`
    width: 48px;
    height: 48px;
    border-radius: 12px;
  `,
  popularBadge: css`
    position: absolute;
    inset-block-start: 12px;
    inset-inline-end: 12px;

    padding-block: 4px;
    padding-inline: 12px;
    border-radius: 12px;

    font-size: 12px;
    color: #fff;

    background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  `,
  price: css`
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
    color: ${token.colorText};
  `,
  priceLabel: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  priceOriginal: css`
    font-size: 14px;
    color: ${token.colorTextQuaternary};
    text-decoration: line-through;
  `,
  sectionTitle: css`
    font-size: 12px;
    font-weight: 500;
    color: ${token.colorTextTertiary};
  `,
  title: css`
    font-size: 18px;
    font-weight: 600;
    color: ${token.colorText};
  `,
}));

const planIcons = {
  lite: { background: 'linear-gradient(45deg, #21B2EE, #2271ED)', color: '#E5F8FF', icon: Box },
  pro: { background: 'linear-gradient(45deg, #C57948, #803718)', color: '#FFC385', icon: Sparkle },
  ultra: { background: 'linear-gradient(45deg, #F7A82F, #BB7227)', color: '#FCFA6E', icon: Zap },
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
      <Flexbox className={styles.card} gap={20}>
        {popular && <div className={styles.popularBadge}>{t('cta.popular', '最多选择')}</div>}

        {/* Icon and Title */}
        <Flexbox gap={12}>
          <Center
            className={styles.iconContainer}
            style={{
              background: iconConfig.background,
              border: `2px solid ${iconConfig.color}`,
            }}
          >
            <Icon color={iconConfig.color} icon={iconConfig.icon} size={24} />
          </Center>
          <Flexbox gap={4}>
            <span className={styles.title}>{t(name as any)}</span>
            <span className={styles.desc}>{t(desc as any)}</span>
          </Flexbox>
        </Flexbox>

        {/* Price */}
        <Flexbox gap={4}>
          <Flexbox align={'baseline'} gap={4} horizontal>
            <span className={styles.price}>¥{currentPrice}</span>
            <span className={styles.priceLabel}>
              /{t('billingCycle.monthly', '每月')} (
              {isYearly ? t('billingCycle.yearly') : t('billingCycle.monthly')})
            </span>
          </Flexbox>
          {isYearly && (
            <Flexbox align={'center'} gap={8} horizontal>
              <span className={styles.priceOriginal}>¥{monthlyTotal} /每年</span>
              <Tag color="green" size={'small'}>
                {t('billingCycle.yearlyDiscount')}
              </Tag>
            </Flexbox>
          )}
          {isYearly && (
            <span style={{ color: theme.colorTextSecondary, fontSize: 13 }}>
              ¥{yearlyTotal} /每年
            </span>
          )}
        </Flexbox>

        {/* Upgrade Button */}
        <Button
          block
          onClick={() => onUpgrade(id)}
          size="large"
          type={popular ? 'primary' : 'default'}
        >
          {t('cta.upgrade')}
        </Button>

        {/* Credits Section */}
        <Flexbox gap={8}>
          <Flexbox align={'center'} gap={4} horizontal>
            <span className={styles.sectionTitle}>{t('features.credits')}</span>
            <Tooltip title="计算积分用于调用 AI 模型">
              <Icon icon={CircleHelp} size={14} style={{ color: theme.colorTextQuaternary }} />
            </Tooltip>
          </Flexbox>
          <span style={{ color: theme.colorText, fontSize: 16, fontWeight: 600 }}>
            {credits} {t('features.creditsPerMonth')}
          </span>
          <Flexbox gap={4}>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>
                GPT-5 mini{' '}
                <Tooltip title="基于 GPT-5 mini 模型计算">
                  <Icon icon={CircleHelp} size={12} style={{ color: theme.colorTextQuaternary }} />
                </Tooltip>
              </span>
              <span className={styles.featureValue}>{gpt5Mini}</span>
            </Flexbox>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>
                DeepSeek V3.2 Thinking{' '}
                <Tooltip title="基于 DeepSeek V3.2 Thinking 模型计算">
                  <Icon icon={CircleHelp} size={12} style={{ color: theme.colorTextQuaternary }} />
                </Tooltip>
              </span>
              <span className={styles.featureValue}>{deepseek}</span>
            </Flexbox>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>{t('features.moreModels')}</span>
            </Flexbox>
          </Flexbox>
        </Flexbox>

        {/* Files Section */}
        <Flexbox gap={8}>
          <Flexbox align={'center'} gap={4} horizontal>
            <span className={styles.sectionTitle}>{t('features.files')}</span>
            <Tooltip title={t('features.filesDesc')}>
              <Icon icon={CircleHelp} size={14} style={{ color: theme.colorTextQuaternary }} />
            </Tooltip>
          </Flexbox>
          <span className={styles.featureItem}>{t('features.filesSupport')}</span>
          <Flexbox gap={4}>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>
                {t('features.fileStorage')}{' '}
                <Tooltip title="文件存储空间">
                  <Icon icon={CircleHelp} size={12} style={{ color: theme.colorTextQuaternary }} />
                </Tooltip>
              </span>
              <span className={styles.featureValue}>{fileStorage}</span>
            </Flexbox>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>
                {t('features.vectorStorage')}{' '}
                <Tooltip title="向量存储用于知识库检索">
                  <Icon icon={CircleHelp} size={12} style={{ color: theme.colorTextQuaternary }} />
                </Tooltip>
              </span>
              <span className={styles.featureValue}>
                {vectorStorage}{' '}
                <span style={{ color: theme.colorTextQuaternary }}>{vectorStorageSize}</span>
              </span>
            </Flexbox>
          </Flexbox>
        </Flexbox>

        {/* Model Service */}
        <Flexbox gap={8}>
          <Flexbox align={'center'} gap={4} horizontal>
            <span className={styles.sectionTitle}>{t('features.modelService')}</span>
            <Tooltip title="支持的 AI 模型服务">
              <Icon icon={CircleHelp} size={14} style={{ color: theme.colorTextQuaternary }} />
            </Tooltip>
          </Flexbox>
          <Flexbox gap={4}>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>{t('features.mainModelApi')}</span>
            </Flexbox>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>{t('features.unlimitedMessages')}</span>
            </Flexbox>
          </Flexbox>
        </Flexbox>

        {/* Cloud Service */}
        <Flexbox gap={8}>
          <span className={styles.sectionTitle}>{t('features.cloudService')}</span>
          <Flexbox gap={4}>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>{t('features.unlimitedHistory')}</span>
            </Flexbox>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>{t('features.globalSync')}</span>
            </Flexbox>
          </Flexbox>
        </Flexbox>

        {/* Advanced Features */}
        <Flexbox gap={8}>
          <span className={styles.sectionTitle}>{t('features.advancedFeatures')}</span>
          <Flexbox gap={4}>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>{t('features.assistantMarket')}</span>
            </Flexbox>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>{t('features.advancedPlugins')}</span>
            </Flexbox>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
              <span className={styles.featureItem}>{t('features.webSearch')}</span>
            </Flexbox>
          </Flexbox>
        </Flexbox>

        {/* Support */}
        <Flexbox gap={8}>
          <span className={styles.sectionTitle}>{t('features.support')}</span>
          <Flexbox gap={4}>
            <Flexbox align={'center'} gap={8} horizontal>
              <Icon className={styles.checkIcon} icon={Check} size={16} />
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
