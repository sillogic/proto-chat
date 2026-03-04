import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Column } from '@ant-design/plots';
import { useRequest } from '@umijs/max';
import { Card, Col, Row, Statistic, DatePicker, Space, Tag, Typography, InputNumber, Button, Tooltip, Segmented } from 'antd';
import { InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { getAnalyticsCost, getExchangeRate } from '../../../services/analytics';

const { Text } = Typography;

type PeriodType = 'month' | 'year';

type TokenType = 'input' | 'output';

const CostAnalysis: React.FC = () => {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [exchangeRate, setExchangeRate] = useState<number>(1.000000);
  const [tokenType, setTokenType] = useState<TokenType>('input');

  // Fetch real-time exchange rate on mount (force refresh)
  const { loading: rateLoading, run: fetchRate } = useRequest(getExchangeRate, {
    onSuccess: (result) => {
      const rate = result?.data?.rate || 7.3;
      setExchangeRate(rate);
    },
    defaultParams: [true],
    ready: true,
  });

  const handleRefreshRate = () => {
    fetchRate(true); 
  };

  const handleDateChange = (date: Dayjs | null) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const { data: responseData, loading } = useRequest(
    async () => {
      const dateStr = period === 'year' ? selectedDate.format('YYYY') : selectedDate.format('YYYY-MM');
      const res = await getAnalyticsCost({ month: dateStr, period });
      return res;
    },
    {
      refreshDeps: [selectedDate, period],
    },
  );

  // 和原来 SystemUsageView 一样的处理方式
  const data = (responseData as any)?.data ?? responseData;

  // Token trend chart config - 根据 tokenType 动态选择字段
  const tokenField = tokenType === 'input' ? 'inputTokens' : 'outputTokens';
  const dailyTrendConfig = {
    data: data?.dailyTrend || [],
    xField: 'date',
    yField: tokenField,
    colorField: 'model',
    stack: true,
    sort: { reverse: false },
    axis: {
      y: { labelFormatter: (v: number) => (v / 1000).toFixed(0) + 'k' },
    },
    interaction: {
      tooltip: {
        render: (e: any, { title, items }: { title: string; items: any[] }) => (
          <div style={{ padding: 10 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{title}</div>
            {items.map((item: any) => (
              <div
                key={item.name}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: item.color,
                    }}
                  />
                  {item.name}:
                </span>
                <span>{Number(item.value).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ),
      },
    },
  };

  const formatUSD = (value: number | string | undefined) => {
    if (value === undefined || value === null) return '$0.000000';
    const num = Number(value);
    if (num === 0) return '$0.000000';
    // 根据数值大小决定精度：大于1显示2位，大于0.01显示4位，否则显示6位
    if (num >= 1) return `$${num.toFixed(2)}`;
    if (num >= 0.01) return `$${num.toFixed(4)}`;
    return `$${num.toFixed(6)}`;
  };

  return (
    <PageContainer
      extra={
        <Space size="large">
          <Segmented
            value={period}
            onChange={(v) => setPeriod(v as PeriodType)}
            options={[
              { label: '月度', value: 'month' },
              { label: '年度', value: 'year' },
            ]}
          />
          <Space>
            <Text type="secondary">{period === 'year' ? '选择年份' : '选择月份'}：</Text>
            <DatePicker
              picker={period === 'year' ? 'year' : 'month'}
              value={selectedDate}
              onChange={handleDateChange}
              allowClear={false}
              style={{ width: 150 }}
            />
          </Space>
          <Space>
            <Tooltip title="收入为人民币计价，成本为美元计价。此汇率用于将人民币收入转换为美元，以便统一对比。">
              <Text type="secondary">
                USD/CNY 汇率：
                <InfoCircleOutlined style={{ marginLeft: 4 }} />
              </Text>
            </Tooltip>
            {rateLoading ? (
              <Text type="secondary">加载中...</Text>
            ) : (
              <>
                <InputNumber
                  value={exchangeRate}
                  onChange={(v) => {
                    setExchangeRate(v || 7.3);
                  }}
                  min={1}
                  max={20}
                  precision={6}
                  style={{ width: 100 }}
                  disabled
                />
                <Tooltip title="刷新实时汇率">
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={handleRefreshRate}
                    loading={rateLoading}
                  />
                </Tooltip>
              </>
            )}
          </Space>
        </Space>
      }
    >
      {/* Overview Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <span>Chat 输入 Tokens</span>
                  <Tag color="blue">input</Tag>
                </Space>
              }
              value={data?.overview?.chatInputTokens || 0}
              groupSeparator=","
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <span>Chat 输出 Tokens</span>
                  <Tag color="green">output</Tag>
                </Space>
              }
              value={data?.overview?.chatOutputTokens || 0}
              groupSeparator=","
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="Chat 成本 (USD)"
              value={data?.overview?.chatCost || 0}
              precision={6}
              prefix="$"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="总请求数"
              value={data?.overview?.requestCount || 0}
              groupSeparator=","
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <span>Embedding Tokens</span>
                  <Tag color="purple">向量化</Tag>
                </Space>
              }
              value={data?.overview?.embeddingTokens || 0}
              groupSeparator=","
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="Embedding 成本 (USD)"
              value={data?.overview?.embeddingCost || 0}
              precision={6}
              prefix="$"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <span>图片生成成本 (USD)</span>
                  <Tag color="gold">按次</Tag>
                </Space>
              }
              value={data?.overview?.imageCost || 0}
              precision={6}
              prefix="$"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="免费用户成本 (USD)"
              value={data?.overview?.freeUserCost || 0}
              precision={6}
              prefix="$"
              valueStyle={{ color: '#fa541c' }}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>纯支出</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="总成本 (USD)"
              value={data?.overview?.totalCost || 0}
              precision={6}
              prefix="$"
              valueStyle={{ color: '#cf1322', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <span>记忆提取任务数</span>
                  <Tag color="cyan">记忆</Tag>
                </Space>
              }
              value={data?.overview?.memoryJobCount || 0}
              groupSeparator=","
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <span>记忆条目数</span>
                  <Tag color="cyan">新增</Tag>
                </Space>
              }
              value={data?.overview?.memoryRecordCount || 0}
              groupSeparator=","
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <span>记忆 LLM 输入 Tokens</span>
                  <Tag color="cyan">LLM</Tag>
                </Space>
              }
              value={data?.overview?.memoryLlmInputTokens || 0}
              groupSeparator=","
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <span>记忆 LLM 输出 Tokens</span>
                  <Tag color="cyan">LLM</Tag>
                </Space>
              }
              value={data?.overview?.memoryLlmOutputTokens || 0}
              groupSeparator=","
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <span>记忆 Embedding Tokens</span>
                  <Tag color="cyan">向量化</Tag>
                </Space>
              }
              value={data?.overview?.memoryEmbeddingTokens || 0}
              groupSeparator=","
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="记忆 LLM 成本 (USD)"
              value={data?.overview?.memoryLlmCost || 0}
              precision={6}
              prefix="$"
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="记忆总成本 (USD)"
              value={data?.overview?.memoryCost || 0}
              precision={6}
              prefix="$"
              valueStyle={{ color: '#13c2c2', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Token Trend Chart */}
      <ProCard
        title={period === 'year' ? '每月 Token 用量趋势 (按模型)' : '每日 Token 用量趋势 (按模型)'}
        headerBordered
        style={{ marginBottom: 24 }}
        loading={loading}
        extra={
          <Segmented
            value={tokenType}
            onChange={(v) => setTokenType(v as TokenType)}
            options={[
              { label: '上行 (Input)', value: 'input' },
              { label: '下行 (Output)', value: 'output' },
            ]}
          />
        }
      >
        <div style={{ height: 400 }}>
          <Column {...dailyTrendConfig} />
        </div>
      </ProCard>

      {/* Model Usage Analysis Table */}
      <Row gutter={24}>
        <Col span={14}>
          <ProTable
            headerTitle="模型用量与成本分析"
            rowKey="model"
            loading={loading}
            dataSource={data?.modelStats || []}
            search={false}
            pagination={false}
            options={false}
            columns={[
              {
                title: '模型名称',
                dataIndex: 'model',
                render: (text: string, record: any) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>{text}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {record.provider?.toUpperCase()}
                    </Text>
                  </Space>
                ),
              },
              { title: '输入 Tokens', dataIndex: 'inputTokens', valueType: 'digit' },
              { title: '输出 Tokens', dataIndex: 'outputTokens', valueType: 'digit' },
              { title: '请求数', dataIndex: 'requestCount', valueType: 'digit' },
              {
                title: '成本 (USD)',
                dataIndex: 'cost',
                render: (_, r: any) => (
                  <Text style={{ color: '#cf1322', fontWeight: 500 }}>
                    {formatUSD(r.cost)}
                  </Text>
                ),
              },
            ]}
          />
        </Col>
        <Col span={10}>
          <ProTable
            headerTitle="供应商成本分析"
            rowKey="provider"
            loading={loading}
            dataSource={data?.providerStats || []}
            search={false}
            pagination={false}
            options={false}
            columns={[
              { title: '供应商', dataIndex: 'provider' },
              { title: '总 Tokens', dataIndex: 'totalTokens', valueType: 'digit' },
              {
                title: '成本 (USD)',
                dataIndex: 'cost',
                render: (_, r: any) => (
                  <Text style={{ color: '#cf1322', fontWeight: 500 }}>
                    {formatUSD(r.cost)}
                  </Text>
                ),
              },
            ]}
          />
        </Col>
      </Row>

      {/* Free Users Cost Breakdown */}
      <ProCard title="免费用户成本明细" headerBordered style={{ marginTop: 24 }} loading={loading}>
        <ProTable
          rowKey="model"
          dataSource={data?.freeUserStats || []}
          search={false}
          pagination={{ pageSize: 10 }}
          options={false}
          columns={[
            { title: '模型', dataIndex: 'model' },
            { title: '输入 Tokens', dataIndex: 'inputTokens', valueType: 'digit' },
            { title: '输出 Tokens', dataIndex: 'outputTokens', valueType: 'digit' },
            { title: '请求数', dataIndex: 'requestCount', valueType: 'digit' },
            {
              title: '成本 (USD)',
              dataIndex: 'cost',
              render: (_, r: any) => (
                <Text style={{ color: '#fa541c', fontWeight: 500 }}>
                  {formatUSD(r.cost)}
                </Text>
              ),
            },
          ]}
          summary={(data) => {
            const totalCost = data.reduce((sum, row: any) => sum + parseFloat(row.cost || 0), 0);
            return (
              <ProTable.Summary.Row>
                <ProTable.Summary.Cell index={0} colSpan={4}>
                  <Text strong>合计</Text>
                </ProTable.Summary.Cell>
                <ProTable.Summary.Cell index={4}>
                  <Text strong style={{ color: '#fa541c' }}>
                    {formatUSD(totalCost)}
                  </Text>
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
