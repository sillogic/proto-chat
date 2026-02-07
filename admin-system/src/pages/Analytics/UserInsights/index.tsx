import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Card, Col, Row, Statistic, DatePicker, Space, Typography, Tag, Progress, Alert, Tooltip, InputNumber, Button } from 'antd';
import { WarningOutlined, UserOutlined, DollarOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState, useMemo } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { getAnalyticsUsers, getExchangeRate } from '../../../services/analytics';

const { Text } = Typography;

const UserInsights: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
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

  const handleMonthChange = (date: Dayjs | null) => {
    if (date) {
      setSelectedMonth(date);
    }
  };

  const { data: responseData, loading } = useRequest(
    async () => {
      const res = await getAnalyticsUsers({ month: selectedMonth.format('YYYY-MM') });
      return res;
    },
    {
      refreshDeps: [selectedMonth],
    },
  );

  // 和原来 SystemUsageView 一样的处理方式
  const rawData = (responseData as any)?.data ?? responseData;

  // 转换付费用户数据中的订阅金额（人民币转美元）
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

  const formatUSD = (value: number | undefined) => {
    if (value === undefined || value === null) return '$0.000000';
    const num = Number(value);
    if (num === 0) return '$0.000000';
    // 根据数值大小决定精度：大于1显示2位，大于0.01显示4位，否则显示6位
    if (num >= 1) return `$${num.toFixed(2)}`;
    if (num >= 0.01) return `$${num.toFixed(4)}`;
    return `$${num.toFixed(6)}`;
  };

  // 免费用户高消耗警告阈值（USD）
  const FREE_USER_WARNING_THRESHOLD = 0.5;

  return (
    <PageContainer
      extra={
        <Space size="large">
          <Space>
            <Text type="secondary">选择月份：</Text>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              allowClear={false}
              style={{ width: 150 }}
            />
          </Space>
          <Space>
            <Tooltip title="用于将付费用户的人民币订阅金额转换为美元，以便与成本对比。">
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
                  onChange={(v) => setExchangeRate(v || 7.3)}
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
      {/* 用户概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="总用户数"
              value={data?.overview?.totalUsers || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="活跃用户数"
              value={data?.overview?.activeUsers || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="免费用户数"
              value={data?.overview?.freeUsers || 0}
              suffix={
                <Tooltip title="免费用户产生的成本为纯支出">
                  <WarningOutlined style={{ color: '#fa8c16', marginLeft: 4 }} />
                </Tooltip>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="付费用户数"
              value={data?.overview?.paidUsers || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="免费用户总成本 (USD)"
              value={data?.overview?.freeUserTotalCost || 0}
              precision={6}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#fa541c' }}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>纯支出</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="免费用户人均成本"
              value={
                data?.overview?.freeUsers
                  ? (data.overview.freeUserTotalCost / data.overview.freeUsers)
                  : 0
              }
              precision={6}
              prefix="$"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="异常用户数"
              value={data?.overview?.anomalyUserCount || 0}
              valueStyle={{ color: '#cf1322' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="用户付费转化率"
              value={
                data?.overview?.totalUsers
                  ? ((data.overview.paidUsers / data.overview.totalUsers) * 100)
                  : 0
              }
              precision={1}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 异常用户警告 */}
      {(data?.anomalyUsers?.length || 0) > 0 && (
        <Alert
          message="用量异常警告"
          description={`发现 ${data?.anomalyUsers?.length || 0} 名用户存在异常高消耗，请关注以下列表中标红的用户。`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 免费用户成本 Top 排行（纯支出关注） */}
      <ProCard
        title={
          <Space>
            <WarningOutlined style={{ color: '#fa541c' }} />
            <span>免费用户成本排行（纯支出）</span>
          </Space>
        }
        headerBordered
        style={{ marginBottom: 24 }}
        extra={
          <Text type="secondary">
            免费用户产生的成本为平台纯支出，需重点关注高消耗用户
          </Text>
        }
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
              title: '排名',
              dataIndex: 'rank',
              width: 60,
              render: (_, __, index) => (
                <Tag color={index < 3 ? 'red' : 'default'}>{index + 1}</Tag>
              ),
            },
            {
              title: '用户',
              dataIndex: 'email',
              render: (email: string, record: any) => (
                <Space direction="vertical" size={0}>
                  <Text>{email || record.username || '未知用户'}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    ID: {record.userId?.slice(0, 8)}...
                  </Text>
                </Space>
              ),
            },
            {
              title: '请求数',
              dataIndex: 'requestCount',
              valueType: 'digit',
            },
            {
              title: 'Token 用量',
              dataIndex: 'totalTokens',
              valueType: 'digit',
            },
            {
              title: '成本 (USD)',
              dataIndex: 'cost',
              render: (_, r: any) => {
                const isHigh = r.cost >= FREE_USER_WARNING_THRESHOLD;
                return (
                  <Text style={{ color: isHigh ? '#cf1322' : '#fa541c', fontWeight: isHigh ? 'bold' : 'normal' }}>
                    {formatUSD(r.cost)}
                    {isHigh && <WarningOutlined style={{ marginLeft: 4 }} />}
                  </Text>
                );
              },
            },
            {
              title: '成本占比',
              dataIndex: 'costPercentage',
              width: 150,
              render: (_, r: any) => (
                <Progress
                  percent={r.costPercentage || 0}
                  size="small"
                  strokeColor={r.costPercentage > 20 ? '#cf1322' : '#fa541c'}
                />
              ),
            },
          ]}
        />
      </ProCard>

      {/* 付费用户用量分析 */}
      <ProCard title="付费用户用量分析" headerBordered style={{ marginBottom: 24 }}>
        <ProTable
          rowKey="userId"
          loading={loading}
          dataSource={data?.paidUserStats || []}
          search={false}
          pagination={{ pageSize: 10 }}
          options={false}
          columns={[
            {
              title: '用户',
              dataIndex: 'email',
              render: (email: string, record: any) => (
                <Space direction="vertical" size={0}>
                  <Text>{email || record.username || '未知用户'}</Text>
                  <Tag color="green" bordered={false}>{record.planName}</Tag>
                </Space>
              ),
            },
            {
              title: '请求数',
              dataIndex: 'requestCount',
              valueType: 'digit',
            },
            {
              title: 'Token 用量',
              dataIndex: 'totalTokens',
              valueType: 'digit',
            },
            {
              title: '成本 (USD)',
              dataIndex: 'cost',
              render: (_, r: any) => <Text>{formatUSD(r.cost)}</Text>,
            },
            {
              title: '订阅金额 (USD)',
              dataIndex: 'subscriptionUSD',
              render: (_, r: any) => (
                <Text style={{ color: '#52c41a' }}>{formatUSD(r.subscriptionUSD)}</Text>
              ),
            },
            {
              title: '利润贡献',
              dataIndex: 'profit',
              render: (_, r: any) => {
                const profit = (r.subscriptionUSD || 0) - (r.cost || 0);
                return (
                  <Text style={{ color: profit >= 0 ? '#52c41a' : '#cf1322' }}>
                    {profit >= 0 ? '+' : ''}{formatUSD(profit)}
                  </Text>
                );
              },
            },
          ]}
        />
      </ProCard>

      {/* 异常用户列表 */}
      <ProCard
        title={
          <Space>
            <WarningOutlined style={{ color: '#cf1322' }} />
            <span>异常用户监控</span>
          </Space>
        }
        headerBordered
        extra={
          <Text type="secondary">
            用量超过平均值3倍标准差的用户被标记为异常
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
                  <Space direction="vertical" size={0}>
                    <Text>{email || record.username || '未知用户'}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {record.planName || '免费用户'}
                    </Text>
                  </Space>
                </Space>
              ),
            },
            {
              title: '请求数',
              dataIndex: 'requestCount',
              valueType: 'digit',
              render: (val: number, record: any) => (
                <Tooltip title={`平均: ${record.avgRequestCount?.toFixed(0) || 0}`}>
                  <Text style={{ color: '#cf1322' }}>{val?.toLocaleString()}</Text>
                </Tooltip>
              ),
            },
            {
              title: 'Token 用量',
              dataIndex: 'totalTokens',
              valueType: 'digit',
              render: (val: number, record: any) => (
                <Tooltip title={`平均: ${record.avgTokens?.toLocaleString() || 0}`}>
                  <Text style={{ color: '#cf1322' }}>{val?.toLocaleString()}</Text>
                </Tooltip>
              ),
            },
            {
              title: '成本 (USD)',
              dataIndex: 'cost',
              render: (_, r: any) => (
                <Text style={{ color: '#cf1322', fontWeight: 'bold' }}>
                  {formatUSD(r.cost)}
                </Text>
              ),
            },
            {
              title: '超出倍数',
              dataIndex: 'deviationMultiple',
              render: (val: number) => (
                <Tag color="red">{val?.toFixed(1)}x</Tag>
              ),
            },
            {
              title: '异常类型',
              dataIndex: 'anomalyType',
              render: (type: string) => {
                const typeMap: Record<string, { label: string; color: string }> = {
                  high_request: { label: '请求量异常', color: 'orange' },
                  high_token: { label: 'Token异常', color: 'red' },
                  high_cost: { label: '成本异常', color: 'magenta' },
                };
                const item = typeMap[type] || { label: type, color: 'default' };
                return <Tag color={item.color}>{item.label}</Tag>;
              },
            },
          ]}
        />
      </ProCard>
    </PageContainer>
  );
};

export default UserInsights;
