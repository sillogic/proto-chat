import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Card, Col, Row, Statistic, DatePicker, Segmented, Space, Typography, Tag, Progress, Alert, Tooltip } from 'antd';
import {
  WarningOutlined,
  UserOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  FireOutlined,
  AlertOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useState, useMemo } from 'react';
import React from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { getAnalyticsUsers } from '../../../services/analytics';
import { getAdminParam } from '../../../services/system-params';

const { Text } = Typography;

type PeriodType = 'day' | 'month' | 'year';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatUSD = (value: number | undefined) => {
  if (value === undefined || value === null) return '$0.000000';
  const num = Number(value);
  if (num === 0) return '$0.000000';
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  return `$${num.toFixed(6)}`;
};

const formatTokens = (n: number) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const FREE_USER_WARNING_THRESHOLD = 0.5;

const MONO: React.CSSProperties = {
  fontFamily: '"DM Mono", "Roboto Mono", "Courier New", monospace',
};

// ─── Anomaly type config ──────────────────────────────────────────────────────

const ANOMALY_CFG: Record<string, { label: string; icon: React.ReactNode }> = {
  high_request: { label: '请求量异常', icon: <ThunderboltOutlined /> },
  high_token:   { label: 'Token 异常',  icon: <FireOutlined /> },
  high_cost:    { label: '成本异常',    icon: <AlertOutlined /> },
};

// ─── AnomalyCard ─────────────────────────────────────────────────────────────

const AnomalyCard: React.FC<{ user: any }> = ({ user }) => {
  const cfg = ANOMALY_CFG[user.anomalyType] || { label: user.anomalyType, icon: <WarningOutlined /> };
  return (
    <div
      style={{
        background: 'rgba(207,19,34,0.04)',
        border: '1px solid rgba(207,19,34,0.22)',
        borderLeft: '3px solid #cf1322',
        borderRadius: 6,
        padding: '10px 14px',
        minWidth: 210,
        maxWidth: 260,
        flex: '0 0 auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <Tag color="error" style={{ margin: 0, fontSize: 11 }}>
          {cfg.icon}&nbsp;{cfg.label}
        </Tag>
        <span
          style={{
            background: '#cf1322',
            color: '#fff',
            borderRadius: 3,
            padding: '0 6px',
            fontSize: 11,
            fontWeight: 700,
            ...MONO,
          }}
        >
          {user.deviationMultiple?.toFixed(1)}x
        </span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a1a', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {user.email || user.username || '未知用户'}
      </div>
      <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 7 }}>
        {user.planName || '免费用户'} · ID: {user.userId?.slice(0, 8)}…
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <span style={{ fontSize: 11, color: '#595959' }}>
          请求 <strong style={{ color: '#cf1322', ...MONO }}>{user.requestCount?.toLocaleString()}</strong>
        </span>
        <span style={{ fontSize: 11, color: '#595959' }}>
          Token <strong style={{ color: '#cf1322', ...MONO }}>{formatTokens(user.totalTokens)}</strong>
        </span>
        <span style={{ fontSize: 11, color: '#595959' }}>
          成本 <strong style={{ color: '#cf1322', ...MONO }}>{formatUSD(user.cost)}</strong>
        </span>
      </div>
    </div>
  );
};

// ─── FunnelStep ───────────────────────────────────────────────────────────────

const FunnelStep: React.FC<{
  label: string;
  value: number;
  subLabel?: string;
  color: string;
}> = ({ label, value, subLabel, color }) => (
  <div style={{ textAlign: 'center', flex: 1 }}>
    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, marginBottom: 3, ...MONO }}>
      {value.toLocaleString()}
    </div>
    {subLabel && <div style={{ fontSize: 11, color: '#bfbfbf' }}>{subLabel}</div>}
  </div>
);

// ─── MiniBar ──────────────────────────────────────────────────────────────────

const MiniBar: React.FC<{ pct: number; color: string; gradient?: string }> = ({ pct, color, gradient }) => (
  <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
    <div
      style={{
        height: '100%',
        width: `${Math.min(Math.max(pct, 0), 100)}%`,
        background: gradient || color,
        borderRadius: 2,
        transition: 'width 0.4s ease',
      }}
    />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const UserInsights: React.FC = () => {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [exchangeRate, setExchangeRate] = useState<number>(7.3);

  const { loading: rateLoading } = useRequest(() => getAdminParam('usd_cny_rate'), {
    onSuccess: (result) => {
      const value = (result as any)?.data?.value ?? (result as any)?.value;
      const rate = parseFloat(value || '7.3');
      if (rate > 0) setExchangeRate(rate);
    },
  });

  const { data: responseData, loading } = useRequest(
    async () => {
      const dateStr = period === 'year'
        ? selectedDate.format('YYYY')
        : period === 'day'
        ? selectedDate.format('YYYY-MM-DD')
        : selectedDate.format('YYYY-MM');
      const res = await getAnalyticsUsers({ month: dateStr, period });
      return res;
    },
    { refreshDeps: [selectedDate, period] },
  );

  const rawData = (responseData as any)?.data ?? responseData;

  const data = useMemo(() => {
    if (!rawData) return null;
    return {
      ...rawData,
      paidUserStats: (rawData.paidUserStats || []).map((u: any) => ({
        ...u,
        subscriptionUSD: (parseFloat(u.subscriptionCNY || '0') / exchangeRate).toFixed(2),
      })),
    };
  }, [rawData, exchangeRate]);

  // Derived overview values
  const ov = data?.overview;
  const totalUsers     = ov?.totalUsers       || 0;
  const activeUsers    = ov?.activeUsers      || 0;
  const freeUsers      = ov?.freeUsers        || 0;
  const paidUsers      = ov?.paidUsers        || 0;
  const anomalyCount   = ov?.anomalyUserCount || 0;
  const freeUserDrain  = parseFloat(ov?.freeUserTotalCost || '0');
  const freeUserAvg    = freeUsers > 0 ? freeUserDrain / freeUsers : 0;
  const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;
  const hasAnomalies   = anomalyCount > 0;

  return (
    <PageContainer
      extra={
        <Space size="large">
          <Segmented
            value={period}
            onChange={(v) => setPeriod(v as PeriodType)}
            options={[{ label: '日度', value: 'day' }, { label: '月度', value: 'month' }, { label: '年度', value: 'year' }]}
          />
          <Space>
            <Text type="secondary">{period === 'year' ? '选择年份' : period === 'day' ? '选择日期' : '选择月份'}：</Text>
            <DatePicker
              picker={period === 'year' ? 'year' : period === 'day' ? 'date' : 'month'}
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              allowClear={false}
              style={{ width: 150 }}
            />
          </Space>
          <Space>
            <Tooltip title="用于将付费用户的人民币订阅金额转换为美元，以便与成本对比。">
              <Text type="secondary">
                USD/CNY 汇率：<InfoCircleOutlined style={{ marginLeft: 4 }} />
              </Text>
            </Tooltip>
            {rateLoading ? (
              <Text type="secondary">加载中...</Text>
            ) : (
              <Text strong>{exchangeRate}</Text>
            )}
          </Space>
        </Space>
      }
    >

      {/* ── ANOMALY DANGER ZONE ─────────────────────────────────────────────── */}
      {hasAnomalies && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fff1f0 0%, #fffafa 100%)',
            border: '1px solid #ffa39e',
            borderTop: '3px solid #cf1322',
            borderRadius: 6,
            padding: '14px 18px',
            marginBottom: 16,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* decorative circle */}
          <div
            style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 130,
              height: 130,
              borderRadius: '50%',
              background: 'rgba(207,19,34,0.04)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span
              style={{
                background: '#cf1322',
                color: '#fff',
                borderRadius: 4,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
              }}
            >
              ⚠ 异常监控
            </span>
            <Text style={{ color: '#cf1322', fontWeight: 600, fontSize: 14 }}>
              发现 {anomalyCount} 名用量异常用户（超均值 3σ）
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              超出正常范围，请重点关注
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {(data?.anomalyUsers || []).map((u: any) => (
              <AnomalyCard key={u.userId} user={u} />
            ))}
          </div>
        </div>
      )}

      {/* ── STATUS STRIP: Funnel · Drain · KPIs ────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 200px 1fr',
          gap: 14,
          marginBottom: 16,
        }}
      >
        {/* User Conversion Funnel */}
        <Card
          loading={loading}
          bodyStyle={{ padding: '14px 20px' }}
          style={{ borderRadius: 6, border: '1px solid #f0f0f0' }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#8c8c8c',
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            用户转化漏斗
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
            <FunnelStep label="总用户" value={totalUsers} color="#1a1a1a" />
            <div style={{ color: '#d9d9d9', fontSize: 20, padding: '14px 2px 0', flex: 0 }}>›</div>
            <FunnelStep
              label="活跃"
              value={activeUsers}
              subLabel={totalUsers > 0 ? `${((activeUsers / totalUsers) * 100).toFixed(0)}%` : '—'}
              color="#1677ff"
            />
            <div style={{ color: '#d9d9d9', fontSize: 20, padding: '14px 2px 0', flex: 0 }}>›</div>
            <FunnelStep
              label="付费"
              value={paidUsers}
              subLabel={totalUsers > 0 ? `${conversionRate.toFixed(1)}%` : '—'}
              color="#52c41a"
            />
            <div style={{ width: 1, background: '#f0f0f0', margin: '0 14px', alignSelf: 'stretch' }} />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  color: '#8c8c8c',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                转化率
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  lineHeight: 1,
                  marginBottom: 2,
                  color: conversionRate >= 10 ? '#52c41a' : conversionRate >= 4 ? '#fa8c16' : '#ff4d4f',
                  ...MONO,
                }}
              >
                {conversionRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: '#bfbfbf' }}>付费 / 总用户</div>
            </div>
          </div>
          {/* Proportional bar */}
          <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 14, gap: 1 }}>
            <Tooltip title={`付费 ${paidUsers}`}>
              <div style={{ flex: paidUsers || 0.01, background: '#52c41a' }} />
            </Tooltip>
            <Tooltip title={`免费 ${freeUsers}`}>
              <div style={{ flex: freeUsers || 0.01, background: '#ff7875', opacity: 0.7 }} />
            </Tooltip>
            <Tooltip title={`非活跃 ${totalUsers - activeUsers}`}>
              <div style={{ flex: Math.max(totalUsers - activeUsers, 0) || 0.01, background: '#f0f0f0' }} />
            </Tooltip>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
            {[
              { color: '#52c41a', label: `付费 ${paidUsers}` },
              { color: '#ff7875', label: `免费 ${freeUsers}` },
              { color: '#d9d9d9', label: `非活跃 ${totalUsers - activeUsers}` },
            ].map((item) => (
              <span key={item.label} style={{ fontSize: 11, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: item.color,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </Card>

        {/* Free User Drain — the bleeding metric */}
        <Card
          loading={loading}
          bodyStyle={{ padding: '14px 18px', textAlign: 'center' }}
          style={{
            borderRadius: 6,
            border: '1px solid #ffa39e',
            borderTop: '3px solid #ff4d4f',
            background: freeUserDrain > 0.5 ? '#fff1f0' : '#fff',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: '#ff4d4f',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            免费用户消耗
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: '#cf1322',
              lineHeight: 1,
              marginBottom: 4,
              ...MONO,
            }}
          >
            {formatUSD(freeUserDrain)}
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 12 }}>本月纯支出</div>
          <div style={{ borderTop: '1px solid #ffe0de', paddingTop: 10 }}>
            <div style={{ fontSize: 10, color: '#8c8c8c', marginBottom: 2 }}>人均成本</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ff4d4f', ...MONO }}>
              {formatUSD(freeUserAvg)}
            </div>
          </div>
        </Card>

        {/* Health KPIs */}
        <Card
          loading={loading}
          bodyStyle={{ padding: '14px 20px' }}
          style={{ borderRadius: 6, border: '1px solid #f0f0f0' }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#8c8c8c',
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            平台健康指标
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {[
              {
                label: '付费用户',
                value: paidUsers.toLocaleString(),
                color: '#52c41a',
                sub: '本月有效订阅',
              },
              {
                label: '免费用户',
                value: freeUsers.toLocaleString(),
                color: '#8c8c8c',
                sub: '无收入用户',
              },
              {
                label: '付费转化率',
                value: `${conversionRate.toFixed(1)}%`,
                color: conversionRate >= 10 ? '#52c41a' : conversionRate >= 4 ? '#fa8c16' : '#ff4d4f',
                sub: paidUsers > 0 ? `${paidUsers} 付费 / ${totalUsers} 总` : '暂无数据',
              },
              {
                label: '异常用户',
                value: anomalyCount > 0 ? `${anomalyCount} ⚠` : `${anomalyCount} ✓`,
                color: anomalyCount > 0 ? '#cf1322' : '#52c41a',
                sub: anomalyCount > 0 ? '需关注' : '无异常',
              },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: item.color, lineHeight: 1.1, ...MONO }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 2 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── DATA TABLES: Free Drain Ranking + Paid Profitability ─────────────── */}
      <Row gutter={14} style={{ marginBottom: 14 }}>

        {/* Free User Cost Ranking */}
        <Col xs={24} lg={12}>
          <ProCard
            title={
              <Space>
                <span
                  style={{
                    background: '#ff4d4f',
                    color: '#fff',
                    borderRadius: 3,
                    padding: '1px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  纯支出
                </span>
                <span>免费用户成本排行</span>
              </Space>
            }
            headerBordered
            style={{ marginBottom: 14 }}
          >
            <ProTable
              rowKey="userId"
              loading={loading}
              dataSource={data?.freeUserCostRanking || []}
              search={false}
              pagination={{ pageSize: 10 }}
              options={false}
              columns={[
                {
                  title: '#',
                  width: 44,
                  render: (_: any, __: any, index: number) => (
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 5,
                        background:
                          index === 0
                            ? '#cf1322'
                            : index === 1
                            ? '#ff4d4f'
                            : index === 2
                            ? '#ff7875'
                            : '#f5f5f5',
                        color: index < 3 ? '#fff' : '#8c8c8c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        ...MONO,
                      }}
                    >
                      {index + 1}
                    </div>
                  ),
                },
                {
                  title: '用户',
                  dataIndex: 'email',
                  render: (email: string, record: any) => (
                    <div>
                      <div style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500 }}>
                        {email || record.username || '未知用户'}
                      </div>
                      <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 1 }}>
                        {record.requestCount?.toLocaleString()} 次 · {formatTokens(record.totalTokens)} tokens
                      </div>
                    </div>
                  ),
                },
                {
                  title: '成本 / 占比',
                  dataIndex: 'cost',
                  width: 150,
                  render: (_: any, r: any, index: number) => {
                    const isHigh = r.cost >= FREE_USER_WARNING_THRESHOLD;
                    const pct = parseFloat(r.costPercentage || '0');
                    return (
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: isHigh ? '#cf1322' : index < 3 ? '#ff4d4f' : '#595959',
                            ...MONO,
                          }}
                        >
                          {formatUSD(r.cost)}
                          {isHigh && <WarningOutlined style={{ marginLeft: 4, fontSize: 11 }} />}
                        </div>
                        <MiniBar
                          pct={pct}
                          color="#ffb8b8"
                          gradient={
                            index === 0
                              ? 'linear-gradient(90deg, #cf1322, #ff4d4f)'
                              : index < 3
                              ? 'linear-gradient(90deg, #ff4d4f, #ff7875)'
                              : undefined
                          }
                        />
                        <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>
                          {pct.toFixed(1)}% of free cost
                        </div>
                      </div>
                    );
                  },
                },
              ]}
            />
          </ProCard>
        </Col>

        {/* Paid User Profitability */}
        <Col xs={24} lg={12}>
          <ProCard title="付费用户利润分析" headerBordered style={{ marginBottom: 14 }}>
            <ProTable
              rowKey="userId"
              loading={loading}
              dataSource={data?.paidUserStats || []}
              search={false}
              pagination={{ pageSize: 10 }}
              options={false}
              columns={[
                {
                  title: '用户 / 套餐',
                  dataIndex: 'email',
                  render: (email: string, record: any) => (
                    <div>
                      <div style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500 }}>
                        {email || record.username || '未知用户'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Tag
                          color="green"
                          bordered={false}
                          style={{ fontSize: 11, margin: 0, padding: '0 6px', lineHeight: '18px' }}
                        >
                          {record.planName}
                        </Tag>
                        <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                          {record.requestCount?.toLocaleString()} 次
                        </span>
                      </div>
                    </div>
                  ),
                },
                {
                  title: '收入 / 成本',
                  width: 110,
                  render: (_: any, r: any) => (
                    <div>
                      <div style={{ fontSize: 12, color: '#52c41a', ...MONO }}>
                        +{formatUSD(parseFloat(r.subscriptionUSD || '0'))}
                      </div>
                      <div style={{ fontSize: 12, color: '#ff4d4f', ...MONO }}>
                        −{formatUSD(r.cost)}
                      </div>
                    </div>
                  ),
                },
                {
                  title: '利润贡献',
                  width: 140,
                  render: (_: any, r: any) => {
                    const sub = parseFloat(r.subscriptionUSD || '0');
                    const profit = sub - (r.cost || 0);
                    const margin = sub > 0 ? (profit / sub) * 100 : 0;
                    const positive = profit >= 0;
                    return (
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: positive ? '#52c41a' : '#cf1322',
                            ...MONO,
                          }}
                        >
                          {positive ? '+' : ''}
                          {formatUSD(profit)}
                        </div>
                        <MiniBar
                          pct={Math.abs(margin)}
                          color={positive ? '#b7eb8f' : '#ffb8b8'}
                          gradient={
                            positive
                              ? 'linear-gradient(90deg, #52c41a, #95de64)'
                              : 'linear-gradient(90deg, #cf1322, #ff4d4f)'
                          }
                        />
                        <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>
                          利润率 {margin.toFixed(1)}%
                        </div>
                      </div>
                    );
                  },
                },
              ]}
            />
          </ProCard>
        </Col>
      </Row>

      {/* ── ANOMALY DETAIL TABLE ─────────────────────────────────────────────── */}
      {(data?.anomalyUsers?.length || 0) > 0 && (
        <ProCard
          title={
            <Space>
              <span
                style={{
                  background: '#cf1322',
                  color: '#fff',
                  borderRadius: 3,
                  padding: '1px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                异常详情
              </span>
              <span>完整异常用户数据</span>
            </Space>
          }
          headerBordered
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              用量超过平均值 3 倍标准差被标记为异常
            </Text>
          }
        >
          <ProTable
            rowKey="userId"
            loading={loading}
            dataSource={data?.anomalyUsers || []}
            search={false}
            pagination={{ pageSize: 10 }}
            options={false}
            locale={{ emptyText: '暂无异常用户' }}
            columns={[
              {
                title: '用户',
                dataIndex: 'email',
                render: (email: string, record: any) => (
                  <Space>
                    <WarningOutlined style={{ color: '#cf1322' }} />
                    <div>
                      <div style={{ fontSize: 13 }}>{email || record.username || '未知用户'}</div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>{record.planName || '免费用户'}</div>
                    </div>
                  </Space>
                ),
              },
              {
                title: '异常类型',
                dataIndex: 'anomalyType',
                render: (type: string) => {
                  const cfg = ANOMALY_CFG[type] || { label: type, icon: <WarningOutlined /> };
                  return (
                    <Tag color="error">
                      {cfg.icon}&nbsp;{cfg.label}
                    </Tag>
                  );
                },
              },
              {
                title: '超出倍数',
                dataIndex: 'deviationMultiple',
                render: (val: number) => (
                  <span
                    style={{
                      background: '#cf1322',
                      color: '#fff',
                      borderRadius: 3,
                      padding: '1px 8px',
                      fontSize: 12,
                      fontWeight: 700,
                      ...MONO,
                    }}
                  >
                    {val?.toFixed(1)}x
                  </span>
                ),
              },
              {
                title: '请求数',
                dataIndex: 'requestCount',
                render: (val: number, record: any) => (
                  <Tooltip title={`均值: ${record.avgRequestCount?.toFixed(0) || 0}`}>
                    <Text style={{ color: '#cf1322', ...MONO }}>{val?.toLocaleString()}</Text>
                  </Tooltip>
                ),
              },
              {
                title: 'Token',
                dataIndex: 'totalTokens',
                render: (val: number, record: any) => (
                  <Tooltip title={`均值: ${record.avgTokens?.toLocaleString() || 0}`}>
                    <Text style={{ color: '#cf1322', ...MONO }}>{formatTokens(val)}</Text>
                  </Tooltip>
                ),
              },
              {
                title: '成本 (USD)',
                dataIndex: 'cost',
                render: (_: any, r: any) => (
                  <Text style={{ color: '#cf1322', fontWeight: 700, ...MONO }}>{formatUSD(r.cost)}</Text>
                ),
              },
            ]}
          />
        </ProCard>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&display=swap');
      `}</style>
    </PageContainer>
  );
};

export default UserInsights;
