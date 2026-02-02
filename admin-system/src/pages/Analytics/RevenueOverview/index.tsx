import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Column } from '@ant-design/plots';
import { useRequest } from '@umijs/max';
import { Card, Col, Row, Statistic, DatePicker, Space, Typography, InputNumber, Button, Tooltip, Alert, Segmented } from 'antd';
import { InfoCircleOutlined, ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState, useMemo } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { getAnalyticsRevenue, getExchangeRate } from '../../../services/analytics';

const { Text } = Typography;

type PeriodType = 'month' | 'year';

const RevenueOverview: React.FC = () => {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [exchangeRate, setExchangeRate] = useState<number>(7.3);

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
      const res = await getAnalyticsRevenue({ month: dateStr, period });
      return res;
    },
    {
      refreshDeps: [selectedDate, period],
    },
  );

  // 时间范围文案
  const periodLabel = period === 'year' ? '本年' : '本月';

  // 和原来 SystemUsageView 一样的处理方式
  const data = (responseData as any)?.data ?? responseData;

  // 转换后的数据（收入从人民币转美元）
  const convertedData = useMemo(() => {
    if (!data) return null;

    // 收入：人民币 → 美元
    const revenueUSD = (data.overview?.totalRevenueCNY || 0) / exchangeRate;
    // 成本：已经是美元
    const costUSD = data.overview?.totalCostUSD || 0;
    // 利润
    const profitUSD = revenueUSD - costUSD;
    // 利润率
    const profitMargin = revenueUSD > 0 ? (profitUSD / revenueUSD) * 100 : 0;

    // 转换趋势数据为长格式（用于分组柱状图）
    const dailyTrendRaw = (data.dailyTrend || []).map((item: any) => ({
      ...item,
      revenueUSD: (item.revenueCNY || 0) / exchangeRate,
      costUSD: item.costUSD || 0,
    }));

    // 转换为分组柱状图所需的长格式数据
    const dailyTrend: { date: string; type: string; value: number }[] = [];
    dailyTrendRaw.forEach((item: any) => {
      dailyTrend.push({ date: item.date, type: '收入 (USD)', value: item.revenueUSD });
      dailyTrend.push({ date: item.date, type: '成本 (USD)', value: item.costUSD });
    });

    // 转换订阅收入明细
    const subscriptionRevenue = (data.subscriptionRevenue || []).map((item: any) => ({
      ...item,
      revenueUSD: (item.revenueCNY || 0) / exchangeRate,
    }));

    return {
      overview: {
        revenueUSD,
        revenueCNY: data.overview?.totalRevenueCNY || 0,
        costUSD,
        profitUSD,
        profitMargin,
        subscriberCount: data.overview?.subscriberCount || 0,
        newSubscribers: data.overview?.newSubscribers || 0,
      },
      dailyTrend,
      subscriptionRevenue,
      costBreakdown: data.costBreakdown || [],
    };
  }, [data, exchangeRate]);

  // 收支趋势分组柱状图配置
  const trendConfig = {
    data: convertedData?.dailyTrend || [],
    xField: 'date',
    yField: 'value',
    colorField: 'type',
    group: true,
    style: {
      inset: 5,
    },
    scale: {
      color: {
        range: ['#52c41a', '#ff4d4f'],
      },
    },
    legend: {
      color: {
        position: 'top',
      },
    },
    axis: {
      y: {
        labelFormatter: (v: number) => {
          if (v >= 1) return `$${v.toFixed(2)}`;
          if (v >= 0.01) return `$${v.toFixed(4)}`;
          return `$${v.toFixed(6)}`;
        },
      },
    },
  };

  const formatUSD = (value: number | undefined) => {
    if (value === undefined || value === null) return '$0.000000';
    const num = Number(value);
    if (num === 0) return '$0.000000';
    // 根据数值大小决定精度：大于1显示2位，大于0.01显示4位，否则显示6位
    if (num >= 1) return `$${num.toFixed(2)}`;
    if (num >= 0.01) return `$${num.toFixed(4)}`;
    return `$${num.toFixed(6)}`;
  };

  const isProfitable = (convertedData?.overview?.profitUSD || 0) >= 0;

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
      <Alert
        message="货币说明"
        description={`收入数据为人民币 (CNY)，成本数据为美元 (USD)。当前汇率: ${exchangeRate} CNY = 1 USD。所有统计已转换为美元显示。`}
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="总收入 (USD)"
              value={convertedData?.overview?.revenueUSD || 0}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
              suffix={
                <Tooltip title={`原始金额: ¥${(convertedData?.overview?.revenueCNY || 0).toFixed(2)}`}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    (¥{(convertedData?.overview?.revenueCNY || 0).toFixed(0)})
                  </Text>
                </Tooltip>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="总成本 (USD)"
              value={convertedData?.overview?.costUSD || 0}
              precision={6}
              prefix="$"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="利润 (USD)"
              value={convertedData?.overview?.profitUSD || 0}
              precision={6}
              prefix={isProfitable ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: isProfitable ? '#52c41a' : '#cf1322' }}
              suffix="$"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="利润率"
              value={convertedData?.overview?.profitMargin || 0}
              precision={1}
              suffix="%"
              valueStyle={{ color: isProfitable ? '#52c41a' : '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title={`${periodLabel}付费用户数`}
              value={convertedData?.overview?.subscriberCount || 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title={`${periodLabel}新增付费用户`}
              value={convertedData?.overview?.newSubscribers || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="人均收入 (USD)"
              value={
                convertedData?.overview?.subscriberCount
                  ? (convertedData.overview.revenueUSD / convertedData.overview.subscriberCount)
                  : 0
              }
              precision={4}
              prefix="$"
            />
          </Card>
        </Col>
      </Row>

      {/* 收支趋势图 */}
      <ProCard
        title={period === 'year' ? '每月收支趋势' : '每日收支趋势'}
        headerBordered
        style={{ marginBottom: 24 }}
        loading={loading}
      >
        <div style={{ height: 400 }}>
          <Column {...trendConfig} />
        </div>
      </ProCard>

      {/* 收入与成本明细 */}
      <Row gutter={24}>
        <Col span={12}>
          <ProTable
            headerTitle="订阅收入明细"
            rowKey="planName"
            loading={loading}
            dataSource={convertedData?.subscriptionRevenue || []}
            search={false}
            pagination={false}
            options={false}
            columns={[
              { title: '方案名称', dataIndex: 'planName' },
              { title: '订阅人数', dataIndex: 'count', valueType: 'digit' },
              {
                title: '收入 (CNY)',
                dataIndex: 'revenueCNY',
                render: (_, r: any) => <Text>¥{Number(r.revenueCNY || 0).toFixed(2)}</Text>,
              },
              {
                title: '收入 (USD)',
                dataIndex: 'revenueUSD',
                render: (_, r: any) => (
                  <Text style={{ color: '#52c41a', fontWeight: 500 }}>
                    {formatUSD(r.revenueUSD)}
                  </Text>
                ),
              },
            ]}
            summary={(data) => {
              const totalCNY = data.reduce((sum, row: any) => sum + (row.revenueCNY || 0), 0);
              const totalUSD = data.reduce((sum, row: any) => sum + (row.revenueUSD || 0), 0);
              return (
                <ProTable.Summary.Row>
                  <ProTable.Summary.Cell index={0}>
                    <Text strong>合计</Text>
                  </ProTable.Summary.Cell>
                  <ProTable.Summary.Cell index={1} />
                  <ProTable.Summary.Cell index={2}>
                    <Text strong>¥{totalCNY.toFixed(2)}</Text>
                  </ProTable.Summary.Cell>
                  <ProTable.Summary.Cell index={3}>
                    <Text strong style={{ color: '#52c41a' }}>
                      {formatUSD(totalUSD)}
                    </Text>
                  </ProTable.Summary.Cell>
                </ProTable.Summary.Row>
              );
            }}
          />
        </Col>
        <Col span={12}>
          <ProTable
            headerTitle="成本构成明细"
            rowKey="category"
            loading={loading}
            dataSource={convertedData?.costBreakdown || []}
            search={false}
            pagination={false}
            options={false}
            columns={[
              { title: '类别', dataIndex: 'category' },
              {
                title: '上行 Token',
                dataIndex: 'inputTokens',
                render: (_, r: any) => r.inputTokens ? Number(r.inputTokens).toLocaleString() : '-',
              },
              {
                title: '下行 Token',
                dataIndex: 'outputTokens',
                render: (_, r: any) => r.outputTokens ? Number(r.outputTokens).toLocaleString() : '-',
              },
              {
                title: '成本 (USD)',
                dataIndex: 'costUSD',
                render: (_, r: any) => (
                  <Text style={{ color: '#cf1322', fontWeight: 500 }}>
                    {formatUSD(r.costUSD)}
                  </Text>
                ),
              },
              {
                title: '占比',
                dataIndex: 'percentage',
                render: (_, r: any) => <Text type="secondary">{r.percentage}%</Text>,
              },
            ]}
          />
        </Col>
      </Row>
    </PageContainer>
  );
};

export default RevenueOverview;
