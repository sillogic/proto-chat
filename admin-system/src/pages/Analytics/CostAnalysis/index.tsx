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
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { getAnalyticsCost } from '../../../services/analytics';
import { getAdminParam } from '../../../services/system-params';

const { Text } = Typography;

type PeriodType = 'day' | 'month' | 'year';
type TokenType = 'input' | 'output';

const COLORS = {
  chat:      '#1677ff',
  image:     '#fa8c16',
  memory:    '#13c2c2',
  title:     '#2f54eb',
  embedding: '#722ed1',
  freeUser:  '#ff4d4f',
  total:     '#cf1322',
};

const formatUSD = (value: number | string | undefined): string => {
  if (value === undefined || value === null) return '$0.000000';
  const num = Number(value);
  if (num === 0) return '$0.000000';
  if (num >= 1)    return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  return `$${num.toFixed(6)}`;
};

const fmt = (n: number): string => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

// ─── Category panel ───────────────────────────────────────────────────────────

interface CatPanelProps {
  color:      string;
  title:      string;
  cost:       string;
  pct:        number;
  rows:       { label: string; value: string }[];
  loading:    boolean;
}

const CatPanel: React.FC<CatPanelProps> = ({ color, title, cost, pct, rows, loading }) => (
  <Card
    loading={loading}
    size="small"
    style={{ height: '100%', borderTop: `3px solid ${color}` }}
    styles={{ body: { padding: '12px 16px' } }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </Text>
      <Text style={{ fontSize: 11, color: '#bfbfbf' }}>{pct.toFixed(1)}%</Text>
    </div>

    <Text style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
      {cost}
    </Text>

    {/* progress bar */}
    <div style={{ height: 3, background: '#f5f5f5', borderRadius: 2, margin: '8px 0 10px' }}>
      <div style={{
        height: '100%',
        width: `${Math.min(pct, 100)}%`,
        background: color,
        borderRadius: 2,
        transition: 'width 0.5s ease',
      }} />
    </div>

    {rows.map((r) => (
      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{r.label}</Text>
        <Text style={{ fontSize: 11, fontWeight: 500 }}>{r.value}</Text>
      </div>
    ))}
  </Card>
);

// ─── Main component ───────────────────────────────────────────────────────────

const CostAnalysis: React.FC = () => {
  const [period,       setPeriod]       = useState<PeriodType>('month');
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [exchangeRate, setExchangeRate] = useState<number>(7.3);
  const [tokenType,    setTokenType]    = useState<TokenType>('input');

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
        : period === 'day'
        ? selectedDate.format('YYYY-MM-DD')
        : selectedDate.format('YYYY-MM');
      return getAnalyticsCost({ month: dateStr, period });
    },
    { refreshDeps: [selectedDate, period] },
  );

  const data = (responseData as any)?.data ?? responseData;
  const ov   = data?.overview ?? {};

  const totalCost = Number(ov.totalCost || 0);
  const pct = (v: number | string) => totalCost > 0 ? (Number(v || 0) / totalCost) * 100 : 0;

  // ── Category panels config ─────────────────────────────────────────────────
  const categories = useMemo<CatPanelProps[]>(() => [
    {
      color:   COLORS.chat,
      title:   'Chat 对话',
      cost:    formatUSD(ov.chatCost),
      pct:     pct(ov.chatCost),
      loading,
      rows: [
        { label: '↑ 输入', value: fmt(ov.chatInputTokens  || 0) + ' tokens' },
        { label: '↓ 输出', value: fmt(ov.chatOutputTokens || 0) + ' tokens' },
        { label: '请求数', value: (ov.requestCount || 0).toLocaleString() },
      ],
    },
    {
      color:   COLORS.image,
      title:   '图片生成',
      cost:    formatUSD(ov.imageCost),
      pct:     pct(ov.imageCost),
      loading,
      rows: [
        { label: '请求数',    value: (ov.imageRequests || 0).toLocaleString() },
        { label: '↑ 输入',   value: fmt(ov.imageInputTokens       || 0) + ' tokens' },
        { label: '↓ 图片输出', value: fmt(ov.imageOutputImageTokens || 0) + ' tokens' },
      ],
    },
    {
      color:   COLORS.memory,
      title:   '记忆提取',
      cost:    formatUSD(ov.memoryCost),
      pct:     pct(ov.memoryCost),
      loading,
      rows: [
        { label: 'LLM 任务数', value: (ov.memoryJobCount || 0).toLocaleString() },
        { label: 'LLM 输入',   value: fmt(ov.memoryLlmInputTokens   || 0) + ' tokens' },
        { label: 'Embedding',  value: fmt(ov.memoryEmbeddingTokens  || 0) + ' tokens' },
      ],
    },
    {
      color:   COLORS.title,
      title:   '标题生成',
      cost:    formatUSD(ov.titleCost),
      pct:     pct(ov.titleCost),
      loading,
      rows: [
        { label: '↑ 输入', value: fmt(ov.titleInputTokens  || 0) + ' tokens' },
        { label: '↓ 输出', value: fmt(ov.titleOutputTokens || 0) + ' tokens' },
      ],
    },
    {
      color:   COLORS.embedding,
      title:   'Embedding',
      cost:    formatUSD(ov.embeddingCost),
      pct:     pct(ov.embeddingCost),
      loading,
      rows: [
        { label: 'Tokens', value: fmt(ov.embeddingTokens || 0) },
      ],
    },
    {
      color:   COLORS.freeUser,
      title:   '免费用户 (纯支出)',
      cost:    formatUSD(ov.freeUserCost),
      pct:     pct(ov.freeUserCost),
      loading,
      rows: [
        { label: '无收入对冲', value: '' },
      ],
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [data, totalCost, loading]);

  // ── Chart config ───────────────────────────────────────────────────────────
  const tokenField  = tokenType === 'input' ? 'inputTokens' : 'outputTokens';
  const chartConfig = {
    data:       data?.dailyTrend || [],
    xField:     'date',
    yField:     tokenField,
    colorField: 'model',
    stack:      true,
    sort:       { reverse: false },
    axis: {
      y: { labelFormatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v) },
    },
    interaction: {
      tooltip: {
        render: (_e: any, { title, items }: { title: string; items: any[] }) => (
          <div style={{ padding: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>{title}</div>
            {items.map((item: any) => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                  {item.name}
                </span>
                <span>{Number(item.value).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ),
      },
    },
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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
            <Tooltip title="收入为人民币计价，成本为美元计价。此汇率用于将人民币收入转换为美元以便统一对比。">
              <Text type="secondary">
                USD/CNY 汇率：<InfoCircleOutlined style={{ marginLeft: 4 }} />
              </Text>
            </Tooltip>
            {rateLoading
              ? <Text type="secondary">加载中...</Text>
              : <Text strong>{exchangeRate}</Text>
            }
          </Space>
        </Space>
      }
    >
      {/* ── 1. Summary strip ─────────────────────────────────────────────── */}
      <Card
        loading={loading}
        style={{ marginBottom: 16, borderLeft: `4px solid ${COLORS.total}` }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Row gutter={0} align="middle" wrap={false}>

          {/* 本期总成本 */}
          <Col flex="none" style={{ paddingRight: 24, borderRight: '1px solid #f0f0f0', minWidth: 160 }}>
            <Statistic
              title={
                <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  本期总成本
                </Text>
              }
              value={totalCost}
              precision={6}
              prefix="$"
              groupSeparator=","
              valueStyle={{ color: COLORS.total, fontSize: 28, fontWeight: 700 }}
            />
          </Col>

          {/* 用户计费成本（扣积分） */}
          <Col flex="1" style={{ padding: '0 24px', borderRight: '1px solid #f0f0f0' }}>
            <div style={{ marginBottom: 8 }}>
              <Space size={4}>
                <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  用户计费成本
                </Text>
                <Tooltip title="用户使用时扣除积分的成本，包括 Chat 对话和图片生成">
                  <InfoCircleOutlined style={{ fontSize: 11, color: '#bfbfbf' }} />
                </Tooltip>
              </Space>
            </div>
            <div style={{
              borderLeft: `3px solid ${COLORS.chat}`,
              paddingLeft: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}>
              {[
                { label: 'Chat 对话',  value: Number(ov.chatCost  || 0), color: COLORS.chat  },
                { label: '图片生成',   value: Number(ov.imageCost || 0), color: COLORS.image },
                {
                  label: '小计',
                  value: Number(ov.chatCost || 0) + Number(ov.imageCost || 0),
                  color: COLORS.total,
                  bold: true,
                },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <Text style={{ fontSize: 11, color: '#8c8c8c', whiteSpace: 'nowrap' }}>{row.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: row.bold ? 700 : 600, color: row.color, fontVariantNumeric: 'tabular-nums' }}>
                    {formatUSD(row.value)}
                  </Text>
                </div>
              ))}
            </div>
          </Col>

          {/* 平台自承成本（不扣积分） */}
          <Col flex="1" style={{ padding: '0 24px', borderRight: '1px solid #f0f0f0' }}>
            <div style={{ marginBottom: 8 }}>
              <Space size={4}>
                <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  平台自承成本
                </Text>
                <Tooltip title="平台内部服务产生的成本，不扣除用户积分，包括记忆提取、标题生成和 Embedding">
                  <InfoCircleOutlined style={{ fontSize: 11, color: '#bfbfbf' }} />
                </Tooltip>
              </Space>
            </div>
            <div style={{
              borderLeft: `3px solid ${COLORS.freeUser}`,
              paddingLeft: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}>
              {[
                { label: '记忆提取',   value: Number(ov.memoryCost    || 0), color: COLORS.memory    },
                { label: '标题生成',   value: Number(ov.titleCost     || 0), color: COLORS.title     },
                { label: 'Embedding', value: Number(ov.embeddingCost || 0), color: COLORS.embedding },
                {
                  label: '小计',
                  value: Number(ov.memoryCost || 0) + Number(ov.titleCost || 0) + Number(ov.embeddingCost || 0),
                  color: '#d46b08',
                  bold: true,
                },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <Text style={{ fontSize: 11, color: '#8c8c8c', whiteSpace: 'nowrap' }}>{row.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: row.bold ? 700 : 600, color: row.color, fontVariantNumeric: 'tabular-nums' }}>
                    {formatUSD(row.value)}
                  </Text>
                </div>
              ))}
            </div>
          </Col>

          {/* 免费用户成本 */}
          <Col flex="none" style={{ padding: '0 24px', borderRight: '1px solid #f0f0f0', minWidth: 140 }}>
            <Statistic
              title={
                <Space size={4}>
                  <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    免费用户成本
                  </Text>
                  <Tooltip title="免费用户产生的成本为平台纯支出，无收入对冲">
                    <InfoCircleOutlined style={{ fontSize: 11, color: '#bfbfbf' }} />
                  </Tooltip>
                </Space>
              }
              value={Number(ov.freeUserCost || 0)}
              precision={6}
              prefix="$"
              groupSeparator=","
              valueStyle={{ color: COLORS.freeUser, fontSize: 20, fontWeight: 700 }}
            />
          </Col>

          {/* 总请求数 */}
          <Col flex="none" style={{ paddingLeft: 24, minWidth: 100 }}>
            <Statistic
              title={
                <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  总请求数
                </Text>
              }
              value={ov.requestCount || 0}
              precision={0}
              groupSeparator=","
              valueStyle={{ fontSize: 20, fontWeight: 700 }}
            />
          </Col>

        </Row>
      </Card>

      {/* ── 2. Category panels (2 rows × 3 cols) ─────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {categories.map((cat) => (
          <Col key={cat.title} xs={24} sm={12} lg={4}>
            <CatPanel {...cat} />
          </Col>
        ))}
      </Row>

      {/* ── 3. Token trend chart ──────────────────────────────────────────── */}
      <ProCard
        title={period === 'year' ? '每月 Token 用量趋势 (按模型)' : '每日 Token 用量趋势 (按模型)'}
        headerBordered
        style={{ marginBottom: 16 }}
        loading={loading}
        extra={
          <Segmented
            size="small"
            value={tokenType}
            onChange={(v) => setTokenType(v as TokenType)}
            options={[
              { label: '上行 (Input)',  value: 'input'  },
              { label: '下行 (Output)', value: 'output' },
            ]}
          />
        }
      >
        <div style={{ height: 300 }}>
          <Column {...chartConfig} />
        </div>
      </ProCard>

      {/* ── 4. Model + Sub-provider tables ───────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* Model breakdown */}
        <Col span={15}>
          <ProTable
            headerTitle="模型用量与成本"
            rowKey="model"
            loading={loading}
            dataSource={data?.modelStats || []}
            search={false}
            pagination={{ pageSize: 8, showSizeChanger: false, size: 'small' }}
            options={false}
            size="small"
            columns={[
              {
                title: '模型',
                dataIndex: 'model',
                ellipsis: true,
                render: (text: string, record: any) => (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>{text}</Text>
                    <br />
                    <Tag color="default" style={{ fontSize: 10, marginTop: 2, lineHeight: '16px' }}>
                      {record.provider}
                    </Tag>
                  </div>
                ),
              },
              {
                title: '输入',
                dataIndex: 'inputTokens',
                width: 80,
                render: (v: number) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text>,
              },
              {
                title: '输出',
                dataIndex: 'outputTokens',
                width: 80,
                render: (v: number) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text>,
              },
              {
                title: '请求数',
                dataIndex: 'requestCount',
                width: 70,
                render: (v: number) => <Text style={{ fontSize: 12 }}>{v?.toLocaleString()}</Text>,
              },
              {
                title: '成本 (USD)',
                dataIndex: 'cost',
                width: 110,
                render: (_: any, r: any) => {
                  const c = Number(r.cost || 0);
                  const col = c > 0.01 ? COLORS.total : c > 0.001 ? '#fa8c16' : '#595959';
                  return <Text style={{ color: col, fontWeight: 600, fontSize: 12 }}>{formatUSD(r.cost)}</Text>;
                },
              },
            ]}
          />
        </Col>

        {/* Sub-provider breakdown */}
        <Col span={9}>
          <ProTable
            headerTitle="子供应商成本"
            rowKey="alias"
            loading={loading}
            dataSource={data?.subProviderStats || []}
            search={false}
            pagination={false}
            options={false}
            size="small"
            columns={[
              {
                title: '供应商',
                dataIndex: 'alias',
                render: (alias: string, record: any) => (
                  <Space direction="vertical" size={0}>
                    <Tag
                      color="blue"
                      style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}
                    >
                      {alias}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>{record.providerName}</Text>
                  </Space>
                ),
              },
              {
                title: 'Tokens',
                dataIndex: 'totalTokens',
                render: (v: number) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text>,
              },
              {
                title: '成本 (USD)',
                dataIndex: 'cost',
                render: (_: any, r: any) => (
                  <Text style={{ color: COLORS.total, fontWeight: 600, fontSize: 12 }}>
                    {formatUSD(r.cost)}
                  </Text>
                ),
              },
            ]}
          />
        </Col>
      </Row>

      {/* ── 5. Free user cost detail ──────────────────────────────────────── */}
      <ProCard
        title="免费用户成本明细"
        headerBordered
        loading={loading}
        style={{ borderTop: `2px solid ${COLORS.freeUser}` }}
      >
        <ProTable
          rowKey="model"
          dataSource={data?.freeUserStats || []}
          search={false}
          pagination={{ pageSize: 8, showSizeChanger: false, size: 'small' }}
          options={false}
          size="small"
          columns={[
            {
              title: '模型',
              dataIndex: 'model',
              render: (text: string, record: any) => (
                <Space direction="vertical" size={0}>
                  <Text style={{ fontSize: 12, fontWeight: 500 }}>{text}</Text>
                  <Tag color="default" style={{ fontSize: 10, lineHeight: '16px' }}>{record.provider}</Tag>
                </Space>
              ),
            },
            {
              title: '输入',
              dataIndex: 'inputTokens',
              render: (v: number) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text>,
            },
            {
              title: '输出',
              dataIndex: 'outputTokens',
              render: (v: number) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text>,
            },
            {
              title: '请求数',
              dataIndex: 'requestCount',
              render: (v: number) => <Text style={{ fontSize: 12 }}>{v?.toLocaleString()}</Text>,
            },
            {
              title: '成本 (USD)',
              dataIndex: 'cost',
              render: (_: any, r: any) => (
                <Text style={{ color: COLORS.freeUser, fontWeight: 600, fontSize: 12 }}>
                  {formatUSD(r.cost)}
                </Text>
              ),
            },
          ]}
          summary={(tableData) => {
            const total = tableData.reduce((sum, row: any) => sum + parseFloat(row.cost || 0), 0);
            return (
              <ProTable.Summary.Row>
                <ProTable.Summary.Cell index={0} colSpan={4}>
                  <Text strong style={{ fontSize: 12 }}>合计</Text>
                </ProTable.Summary.Cell>
                <ProTable.Summary.Cell index={4}>
                  <Text strong style={{ color: COLORS.freeUser, fontSize: 12 }}>{formatUSD(total)}</Text>
                </ProTable.Summary.Cell>
              </ProTable.Summary.Row>
            );
          }}
        />
      </ProCard>
    </PageContainer>
  );
};

export default CostAnalysis;
