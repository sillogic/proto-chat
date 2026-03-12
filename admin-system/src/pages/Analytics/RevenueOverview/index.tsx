import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Column } from '@ant-design/plots';
import { useRequest } from '@umijs/max';
import {
  Card,
  Col,
  DatePicker,
  Row,
  Segmented,
  Space,
  Statistic,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useMemo, useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { getAnalyticsRevenue } from '../../../services/analytics';
import { getAdminParam } from '../../../services/system-params';

const { Text } = Typography;

type PeriodType = 'month' | 'year';

// ─── Cost category color map ──────────────────────────────────────────────────
const COST_COLORS: Record<string, string> = {
  'Chat 对话':       '#1677ff',
  'Embedding 向量化': '#722ed1',
  '图片生成':         '#fa8c16',
  '记忆提取':         '#13c2c2',
  '标题生成':         '#2f54eb',
};

const REVENUE_COLOR = '#52c41a';
const COST_COLOR    = '#ff4d4f';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtUSD = (v: number | undefined): string => {
  if (!v) return '$0.00';
  if (v >= 1)    return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
};

// ─── Cost row with inline progress bar ───────────────────────────────────────
interface CostRowProps {
  category:   string;
  costUSD:    string;
  percentage: string;
  detail:     string;
}

const CostRow: React.FC<CostRowProps> = ({ category, costUSD, percentage, detail }) => {
  const color = COST_COLORS[category] ?? '#8c8c8c';
  const pct   = parseFloat(percentage || '0');

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <Space size={6}>
          <span style={{ display: 'inline-block', width: 3, height: 14, background: color, borderRadius: 2, verticalAlign: 'middle' }} />
          <Text style={{ fontSize: 13, fontWeight: 500 }}>{category}</Text>
          {detail && <Text type="secondary" style={{ fontSize: 11 }}>({detail})</Text>}
        </Space>
        <Space size={16}>
          <Text type="secondary" style={{ fontSize: 12, width: 36, textAlign: 'right' }}>{pct.toFixed(1)}%</Text>
          <Text style={{ fontSize: 13, fontWeight: 600, color: COST_COLOR, width: 80, textAlign: 'right' }}>
            {fmtUSD(parseFloat(costUSD || '0'))}
          </Text>
        </Space>
      </div>
      <div style={{ height: 4, background: '#f5f5f5', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(pct, 100)}%`,
          background: `linear-gradient(90deg, ${color}aa, ${color})`,
          borderRadius: 2,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const RevenueOverview: React.FC = () => {
  const [period,       setPeriod]       = useState<PeriodType>('month');
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [exchangeRate, setExchangeRate] = useState<number>(7.3);

  const { loading: rateLoading } = useRequest(() => getAdminParam('usd_cny_rate'), {
    onSuccess: (result) => {
      const value = (result as any)?.data?.value ?? (result as any)?.value;
      const rate  = parseFloat(value || '7.3');
      if (rate > 0) setExchangeRate(rate);
    },
  });

  const { data: responseData, loading } = useRequest(
    async () => {
      const dateStr = period === 'year'
        ? selectedDate.format('YYYY')
        : selectedDate.format('YYYY-MM');
      return getAnalyticsRevenue({ month: dateStr, period });
    },
    { refreshDeps: [selectedDate, period] },
  );

  const periodLabel = period === 'year' ? '本年' : '本月';
  const raw = (responseData as any)?.data ?? responseData;

  // Convert CNY → USD using live exchange rate
  const overview = useMemo(() => {
    if (!raw) return null;
    const revenueUSD   = (raw.overview?.totalRevenueCNY || 0) / exchangeRate;
    const costUSD      = raw.overview?.totalCostUSD || 0;
    const profitUSD    = revenueUSD - costUSD;
    const profitMargin = revenueUSD > 0 ? (profitUSD / revenueUSD) * 100 : 0;
    return {
      revenueUSD,
      revenueCNY:       raw.overview?.totalRevenueCNY || 0,
      costUSD,
      profitUSD,
      profitMargin,
      subscriberCount:  raw.overview?.subscriberCount || 0,
      newSubscribers:   raw.overview?.newSubscribers  || 0,
    };
  }, [raw, exchangeRate]);

  // Daily trend — long format for grouped bar chart
  const dailyTrend = useMemo(() => {
    const result: { date: string; type: string; value: number }[] = [];
    (raw?.dailyTrend || []).forEach((item: any) => {
      result.push({ date: item.date, type: '收入 (USD)', value: (item.revenueCNY || 0) / exchangeRate });
      result.push({ date: item.date, type: '成本 (USD)', value: item.costUSD || 0 });
    });
    return result;
  }, [raw, exchangeRate]);

  // Subscription revenue rows with USD conversion
  const subscriptionRevenue = useMemo(
    () => (raw?.subscriptionRevenue || []).map((r: any) => ({
      ...r,
      revenueUSD: (parseFloat(r.revenueCNY || '0') / exchangeRate).toFixed(2),
    })),
    [raw, exchangeRate],
  );

  const isProfitable = (overview?.profitUSD ?? 0) >= 0;

  // Chart config
  const trendConfig = {
    data:       dailyTrend,
    xField:     'date',
    yField:     'value',
    colorField: 'type',
    group:      true,
    style:      { inset: 4 },
    scale: { color: { range: [REVENUE_COLOR, COST_COLOR] } },
    legend: { color: { position: 'top' } },
    axis: {
      y: {
        labelFormatter: (v: number) => {
          if (v >= 1)    return `$${v.toFixed(2)}`;
          if (v >= 0.01) return `$${v.toFixed(3)}`;
          return `$${v.toFixed(5)}`;
        },
      },
    },
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageContainer
      extra={
        <Space size="large">
          <Segmented
            value={period}
            onChange={(v) => setPeriod(v as PeriodType)}
            options={[{ label: '月度', value: 'month' }, { label: '年度', value: 'year' }]}
          />
          <Space>
            <Text type="secondary">{period === 'year' ? '选择年份' : '选择月份'}：</Text>
            <DatePicker
              picker={period === 'year' ? 'year' : 'month'}
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              allowClear={false}
              style={{ width: 150 }}
            />
          </Space>
          <Space>
            <Tooltip title="收入为人民币计价，成本为美元计价。此汇率用于将人民币收入转换为美元以便统一对比。">
              <Text type="secondary">
                汇率 USD/CNY：{' '}
                <Text strong>{rateLoading ? '…' : exchangeRate}</Text>
                <InfoCircleOutlined style={{ marginLeft: 6, color: '#bfbfbf', fontSize: 12 }} />
              </Text>
            </Tooltip>
          </Space>
        </Space>
      }
    >
      {/* ── 1. P&L Hero ──────────────────────────────────────────────────── */}
      <Card
        loading={loading}
        style={{ marginBottom: 16, overflow: 'hidden' }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch' }}>

          {/* Revenue */}
          <div style={{
            flex: 1,
            padding: '24px 28px',
            borderRight: '1px solid #f0f0f0',
            borderLeft: `4px solid ${REVENUE_COLOR}`,
          }}>
            <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {periodLabel}收入
            </Text>
            <div style={{ fontSize: 26, fontWeight: 700, color: REVENUE_COLOR, lineHeight: 1.2, margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums' }}>
              ¥{(overview?.revenueCNY || 0).toFixed(2)}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ≈ {fmtUSD(overview?.revenueUSD)} USD
            </Text>
          </div>

          {/* Profit — center hero */}
          <div style={{
            flex: 1.4,
            padding: '24px 28px',
            borderRight: '1px solid #f0f0f0',
            background: isProfitable ? '#f6ffed' : '#fff2f0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}>
            <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              净利润
            </Text>
            <div style={{
              fontSize: 36,
              fontWeight: 800,
              color: isProfitable ? '#389e0d' : '#cf1322',
              lineHeight: 1.1,
              margin: '6px 0 4px',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}>
              {isProfitable ? <ArrowUpOutlined style={{ fontSize: 24 }} /> : <ArrowDownOutlined style={{ fontSize: 24 }} />}
              {' '}{fmtUSD(Math.abs(overview?.profitUSD ?? 0))}
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 12px',
              borderRadius: 100,
              background: isProfitable ? '#b7eb8f' : '#ffa39e',
              marginTop: 4,
            }}>
              <Text style={{ fontSize: 13, fontWeight: 700, color: isProfitable ? '#237804' : '#a8071a' }}>
                利润率 {(overview?.profitMargin ?? 0).toFixed(1)}%
              </Text>
            </div>
          </div>

          {/* Cost */}
          <div style={{
            flex: 1,
            padding: '24px 28px',
            borderRight: `4px solid ${COST_COLOR}`,
          }}>
            <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {periodLabel}成本
            </Text>
            <div style={{ fontSize: 26, fontWeight: 700, color: COST_COLOR, lineHeight: 1.2, margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums' }}>
              {fmtUSD(overview?.costUSD)}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>USD</Text>
          </div>

        </div>
      </Card>

      {/* ── 2. KPI row ───────────────────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          {
            label: `${periodLabel}付费用户`,
            value: overview?.subscriberCount ?? 0,
            isNum: true,
            note:  '当前活跃付费用户总数',
          },
          {
            label: `${periodLabel}新增付费`,
            value: overview?.newSubscribers ?? 0,
            isNum: true,
            color: '#1677ff',
            note:  '本期新完成付费订阅',
          },
          {
            label: '人均收入 (CNY)',
            value: overview?.subscriberCount
              ? (overview.revenueCNY / overview.subscriberCount).toFixed(2)
              : '0.00',
            prefix: '¥',
            note: '总收入 ÷ 付费用户数',
          },
          {
            label: '人均成本 (USD)',
            value: (overview?.subscriberCount ?? 0) > 0
              ? fmtUSD((overview!.costUSD) / overview!.subscriberCount)
              : '$0.00',
            raw:  true,
            note: '总成本 ÷ 付费用户数',
          },
        ].map((kpi, i) => (
          <Col key={i} xs={12} sm={6}>
            <Card size="small" loading={loading} styles={{ body: { padding: '14px 18px' } }}>
              <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                {kpi.label}
              </Text>
              <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, fontVariantNumeric: 'tabular-nums' }}>
                {kpi.raw ? kpi.value : kpi.isNum
                  ? (kpi.value as number).toLocaleString()
                  : `${kpi.prefix ?? ''}${kpi.value}`
                }
              </div>
              {kpi.note && <Text type="secondary" style={{ fontSize: 11 }}>{kpi.note}</Text>}
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── 3. Trend chart ───────────────────────────────────────────────── */}
      <ProCard
        title={period === 'year' ? '每月收支趋势 (USD)' : '每日收支趋势 (USD)'}
        headerBordered
        style={{ marginBottom: 16 }}
        loading={loading}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            收入已按汇率 {exchangeRate} 换算为 USD
          </Text>
        }
      >
        <div style={{ height: 300 }}>
          <Column {...trendConfig} />
        </div>
      </ProCard>

      {/* ── 4. Detail tables ─────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        {/* Subscription plan breakdown */}
        <Col span={12}>
          <ProTable
            headerTitle="订阅收入明细"
            rowKey="planName"
            loading={loading}
            dataSource={subscriptionRevenue}
            search={false}
            pagination={false}
            options={false}
            size="small"
            columns={[
              {
                title: '方案',
                dataIndex: 'planName',
                render: (name: string) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{name}</Text>,
              },
              {
                title: '订阅人数',
                dataIndex: 'count',
                width: 80,
                render: (v: number) => <Text style={{ fontSize: 13 }}>{v?.toLocaleString()}</Text>,
              },
              {
                title: '收入 (CNY)',
                dataIndex: 'revenueCNY',
                render: (_: any, r: any) => (
                  <Text style={{ color: REVENUE_COLOR, fontWeight: 600, fontSize: 13 }}>
                    ¥{Number(r.revenueCNY || 0).toFixed(2)}
                  </Text>
                ),
              },
              {
                title: '收入 (USD)',
                dataIndex: 'revenueUSD',
                render: (_: any, r: any) => (
                  <Text style={{ color: '#389e0d', fontSize: 12 }}>
                    {fmtUSD(parseFloat(r.revenueUSD || '0'))}
                  </Text>
                ),
              },
            ]}
            summary={(rows) => {
              const totalCNY = rows.reduce((s, r: any) => s + (r.revenueCNY || 0), 0);
              const totalUSD = rows.reduce((s, r: any) => s + parseFloat(r.revenueUSD || '0'), 0);
              return (
                <ProTable.Summary.Row>
                  <ProTable.Summary.Cell index={0}>
                    <Text strong style={{ fontSize: 12 }}>合计</Text>
                  </ProTable.Summary.Cell>
                  <ProTable.Summary.Cell index={1} />
                  <ProTable.Summary.Cell index={2}>
                    <Text strong style={{ color: REVENUE_COLOR, fontSize: 12 }}>¥{totalCNY.toFixed(2)}</Text>
                  </ProTable.Summary.Cell>
                  <ProTable.Summary.Cell index={3}>
                    <Text strong style={{ color: '#389e0d', fontSize: 12 }}>{fmtUSD(totalUSD)}</Text>
                  </ProTable.Summary.Cell>
                </ProTable.Summary.Row>
              );
            }}
          />
        </Col>

        {/* Cost breakdown with visual bars */}
        <Col span={12}>
          <Card
            title={<Text style={{ fontSize: 14, fontWeight: 600 }}>成本构成</Text>}
            size="small"
            loading={loading}
            styles={{ body: { padding: '8px 16px 12px' } }}
            style={{ height: '100%' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0 6px', borderBottom: '1px solid #f0f0f0', marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: '#8c8c8c' }}>类别</Text>
              <Space size={16}>
                <Text style={{ fontSize: 11, color: '#8c8c8c', width: 36, textAlign: 'right' }}>占比</Text>
                <Text style={{ fontSize: 11, color: '#8c8c8c', width: 80, textAlign: 'right' }}>成本 (USD)</Text>
              </Space>
            </div>

            {(raw?.costBreakdown || []).map((row: any) => {
              const detail = row.requestCount !== undefined
                ? `${Number(row.requestCount).toLocaleString()} 次`
                : row.jobCount !== undefined
                  ? `${Number(row.jobCount).toLocaleString()} 次提取`
                  : row.inputTokens
                    ? `${Number(row.inputTokens).toLocaleString()} tokens`
                    : '';
              return (
                <CostRow
                  key={row.category}
                  category={row.category}
                  costUSD={row.costUSD}
                  percentage={row.percentage}
                  detail={detail}
                />
              );
            })}

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 4, borderTop: '2px solid #f0f0f0' }}>
              <Text strong style={{ fontSize: 13 }}>合计</Text>
              <Text strong style={{ fontSize: 13, color: COST_COLOR }}>
                {fmtUSD(overview?.costUSD)}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default RevenueOverview;
