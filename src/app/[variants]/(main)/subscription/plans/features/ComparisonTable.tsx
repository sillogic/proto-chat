'use client';

import { Icon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Check, Minus } from 'lucide-react';
import { Fragment, memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { PlanData } from '../../hooks/useSubscriptionPlans';
import type { BillingCycle } from './BillingToggle';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  cell: css`
    padding-block: 12px;
    padding-inline: 16px;
    border-block-end: 1px solid
      ${isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)'};

    font-size: 13px;
    color: ${token.colorText};
    text-align: center;
  `,
  checkIcon: css`
    color: ${token.colorSuccess};
  `,
  featureCell: css`
    padding-block: 12px;
    padding-inline: 16px;
    border-block-end: 1px solid
      ${isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)'};

    font-size: 13px;
    color: ${token.colorTextSecondary};
    text-align: start;
  `,
  headerCell: css`
    padding: 16px;
    border-block-end: 1px solid
      ${isDarkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)'};

    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
    text-align: center;

    background: ${isDarkMode ? 'rgba(148, 163, 184, 0.05)' : 'rgba(148, 163, 184, 0.08)'};
  `,
  minusIcon: css`
    color: ${token.colorTextQuaternary};
  `,
  planPrice: css`
    font-size: 12px;
    font-weight: 400;
    color: ${token.colorTextSecondary};
  `,
  sectionHeader: css`
    padding-block: 10px;
    padding-inline: 16px;
    border-block-end: 1px solid
      ${isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)'};

    font-size: 12px;
    font-weight: 600;
    color: ${token.colorTextTertiary};
    text-transform: uppercase;
    letter-spacing: 0.5px;

    background: ${isDarkMode ? 'rgba(148, 163, 184, 0.03)' : 'rgba(148, 163, 184, 0.05)'};
  `,
  table: css`
    overflow: hidden;
    border-collapse: collapse;

    width: 100%;
    border: 1px solid ${isDarkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)'};
    border-radius: 12px;

    background: ${isDarkMode ? token.colorBgElevated : token.colorBgContainer};
  `,
  valueCell: css`
    padding-block: 12px;
    padding-inline: 16px;
    border-block-end: 1px solid
      ${isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)'};

    font-size: 13px;
    font-weight: 500;
    color: ${token.colorText};
    text-align: center;
  `,
}));

// Helper functions
const getModelEstimate = (p: PlanData, modelName: string) => {
  const estimate = p.features?.display?.model_estimates?.find((m) =>
    m.model.includes(modelName),
  );
  return estimate?.count || '-';
};

const formatStorage = (mb: number) => {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
};

interface ComparisonTableProps {
  billingCycle: BillingCycle;
  plans: PlanData[];
}

const ComparisonTable = memo<ComparisonTableProps>(({ plans, billingCycle }) => {
  const { t } = useTranslation('subscription');
  const { styles } = useStyles();

  const isYearly = billingCycle === 'yearly';

  const features = [
    {
      items: [
        {
          key: 'credits',
          label: '计算积分/月',
          values: plans.map((p) => p.features?.resources?.credits_per_month || p.credits),
        },
        {
          key: 'gpt5Mini',
          label: 'GPT-5 mini 对话数',
          values: plans.map((p) => getModelEstimate(p, 'GPT-5 mini')),
        },
        {
          key: 'deepseek',
          label: 'DeepSeek V3.2 对话数',
          values: plans.map((p) => getModelEstimate(p, 'DeepSeek')),
        },
      ],
      section: '计算资源',
    },
    {
      items: [
        {
          key: 'fileStorage',
          label: '文件存储',
          values: plans.map((p) =>
            p.features?.resources?.file_storage_gb
              ? `${p.features.resources.file_storage_gb} GB`
              : formatStorage(p.storageLimit),
          ),
        },
        {
          key: 'vectorStorage',
          label: '向量存储',
          values: plans.map((p) => {
            const count = p.features?.resources?.vector_storage || `${p.vectorLimit} 条`;
            const size = p.features?.resources?.vector_storage_display || '';
            return size ? `${count} (${size})` : count;
          }),
        },
      ],
      section: '存储空间',
    },
    {
      items: [
        {
          key: 'apiService',
          label: '自定义 API 服务',
          values: plans.map((p) => p.features?.capabilities?.custom_api ?? false),
        },
        {
          key: 'unlimitedMsg',
          label: '无限消息请求',
          values: plans.map((p) => p.features?.capabilities?.unlimited_messages ?? false),
        },
      ],
      section: '模型服务',
    },
    {
      items: [
        {
          key: 'history',
          label: '无限对话历史',
          values: plans.map((p) => p.features?.cloud_services?.unlimited_history ?? false),
        },
        {
          key: 'sync',
          label: '全局云同步',
          values: plans.map((p) => p.features?.cloud_services?.global_sync ?? false),
        },
        {
          key: 'webSearch',
          label: '智能联网查询',
          values: plans.map((p) => p.features?.cloud_services?.web_search ?? false),
        },
      ],
      section: '云服务',
    },
    {
      items: [
        {
          key: 'support',
          label: '技术支持',
          values: plans.map((p) => p.features?.support?.level || '-'),
        },
      ],
      section: '服务支持',
    },
  ];

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.headerCell} style={{ textAlign: 'left', width: '30%' }}>
            功能特性
          </th>
          {plans.map((plan) => (
            <th
              className={styles.headerCell}
              key={plan.id}
              style={{ width: `${70 / plans.length}%` }}
            >
              <div>{t(plan.name as any)}</div>
              <div className={styles.planPrice}>
                ¥{isYearly && plan.yearlyPrice ? Math.round(plan.yearlyPrice / 100 / 12) : plan.monthlyPrice / 100}/月
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {features.map((section) => (
          <Fragment key={section.section}>
            <tr>
              <td className={styles.sectionHeader} colSpan={plans.length + 1}>
                {section.section}
              </td>
            </tr>
            {section.items.map((item) => (
              <tr key={item.key}>
                <td className={styles.featureCell}>{item.label}</td>
                {item.values.map((value, index) => (
                  <td className={styles.valueCell} key={index}>
                    {typeof value === 'boolean' ? (
                      value ? (
                        <Icon className={styles.checkIcon} icon={Check} size={16} />
                      ) : (
                        <Icon className={styles.minusIcon} icon={Minus} size={16} />
                      )
                    ) : (
                      value
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
});

ComparisonTable.displayName = 'ComparisonTable';

export default ComparisonTable;
