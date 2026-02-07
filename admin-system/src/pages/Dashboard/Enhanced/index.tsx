import { PageContainer, ProCard } from '@ant-design/pro-components';
import {
  UserOutlined,
  DollarOutlined,
  ApiOutlined,
  TrophyOutlined,
  LineChartOutlined,
  BarChartOutlined,
  PieChartOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Row, Col, Card, Statistic, Select, Space, Table, Tag, Progress } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRequest } from '@umijs/max';
import { useState } from 'react';
import {
  getEnhancedDashboard,
  type EnhancedDashboardData,
  type DashboardPeriod,
} from '@/services/admin';
import styles from './index.module.less';
import TrendsChart from './components/TrendsChart';

// 存量指标卡片组件
const SnapshotMetricsCard: React.FC<{
  data: EnhancedDashboardData['snapshot'];
  loading?: boolean;
}> = ({ data, loading }) => {
  return (
    <Row gutter={[16, 16]}>
      {/* MRR - 月度经常性收入 */}
      <Col xs={24} sm={12} md={6}>
        <Card loading={loading}>
          <Statistic
            title="MRR (月度收入)"
            value={data.mrr}
            prefix="¥"
            precision={2}
            valueStyle={{ color: '#1890ff' }}
            suffix={
              <Tag color="blue" style={{ marginLeft: 8 }}>
                快照
              </Tag>
            }
          />
          <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            ARR: ¥{data.arr.toLocaleString()}
          </div>
        </Card>
      </Col>

      {/* 活跃订阅数 */}
      <Col xs={24} sm={12} md={6}>
        <Card loading={loading}>
          <Statistic
            title="活跃订阅"
            value={data.activeSubscriptions}
            prefix={<ApiOutlined style={{ color: '#52c41a' }} />}
            valueStyle={{ color: '#52c41a' }}
          />
          <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            持续产生收入
          </div>
        </Card>
      </Col>

      {/* 总用户数 */}
      <Col xs={24} sm={12} md={6}>
        <Card loading={loading}>
          <Statistic
            title="总用户数"
            value={data.totalUsers}
            prefix={<UserOutlined style={{ color: '#722ed1' }} />}
            valueStyle={{ color: '#722ed1' }}
          />
          <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            活跃: {data.activeUsers} (7天)
          </div>
        </Card>
      </Col>

      {/* 今日活跃用户 */}
      <Col xs={24} sm={12} md={6}>
        <Card loading={loading}>
          <Statistic
            title="今日活跃"
            value={data.todayActiveUsers}
            prefix={<TeamOutlined style={{ color: '#fa8c16' }} />}
            valueStyle={{ color: '#fa8c16' }}
          />
          <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            实时用户
          </div>
        </Card>
      </Col>
    </Row>
  );
};

// 套餐分布卡片
const PlanDistributionCard: React.FC<{
  data: EnhancedDashboardData['snapshot']['planDistribution'];
  loading?: boolean;
}> = ({ data, loading }) => {
  const total = data.free + data.lite + data.pro + data.ultra;

  const distribution = [
    { name: 'Free', count: data.free, color: '#d9d9d9', percentage: total > 0 ? (data.free / total) * 100 : 0 },
    { name: 'Lite', count: data.lite, color: '#1890ff', percentage: total > 0 ? (data.lite / total) * 100 : 0 },
    { name: 'Pro', count: data.pro, color: '#722ed1', percentage: total > 0 ? (data.pro / total) * 100 : 0 },
    { name: 'Ultra', count: data.ultra, color: '#fa8c16', percentage: total > 0 ? (data.ultra / total) * 100 : 0 },
  ];

  return (
    <Card title="订阅分布" loading={loading}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {distribution.map((item) => (
          <div key={item.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>
                <Tag color={item.color}>{item.name}</Tag>
                <span style={{ marginLeft: 8 }}>{item.count.toLocaleString()} 用户</span>
              </span>
              <span style={{ color: '#666' }}>{item.percentage.toFixed(1)}%</span>
            </div>
            <Progress
              percent={item.percentage}
              strokeColor={item.color}
              showInfo={false}
              trailColor="#f0f0f0"
            />
          </div>
        ))}
      </Space>
    </Card>
  );
};

// 流量指标卡片组件
const PeriodMetricsCard: React.FC<{
  data: EnhancedDashboardData['period'];
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  loading?: boolean;
}> = ({ data, period, onPeriodChange, loading }) => {
  return (
    <ProCard
      title="流量指标"
      extra={
        <Select
          value={period}
          onChange={onPeriodChange}
          options={[
            { label: '最近 7 天', value: '7d' },
            { label: '最近 30 天', value: '30d' },
            { label: '最近 90 天', value: '90d' },
          ]}
          style={{ width: 120 }}
        />
      }
      headerBordered
      loading={loading}
    >
      <Row gutter={[16, 16]}>
        {/* 总收入 */}
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总收入"
              value={data.totalRevenue}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#cf1322' }}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              新增订阅: {data.newSubscriptions}
            </div>
          </Card>
        </Col>

        {/* 新增用户 */}
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="新增用户"
              value={data.newUsers}
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        {/* API 调用数 */}
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="API 调用"
              value={data.totalApiCalls}
              prefix={<ApiOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
              formatter={(value) => `${Number(value).toLocaleString()}`}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              Tokens: {(data.totalTokens / 1000000).toFixed(2)}M
            </div>
          </Card>
        </Col>

        {/* 流失订阅 */}
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="流失订阅"
              value={data.churnedSubscriptions}
              prefix={<LineChartOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              净增长: {data.newSubscriptions - data.churnedSubscriptions}
            </div>
          </Card>
        </Col>
      </Row>
    </ProCard>
  );
};

// AI 使用统计卡片
const AIUsageStatsCard: React.FC<{
  data: EnhancedDashboardData['aiUsage'];
  loading?: boolean;
}> = ({ data, loading }) => {
  // 按供应商分组的表格列
  const providerColumns: ColumnsType<EnhancedDashboardData['aiUsage']['byProvider'][number]> = [
    {
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => <Tag color="blue">{provider}</Tag>,
      title: '供应商',
    },
    {
      dataIndex: 'calls',
      key: 'calls',
      render: (calls: number) => calls.toLocaleString(),
      title: '调用次数',
    },
    {
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: number) => `${percentage.toFixed(1)}%`,
      title: '占比',
      width: 100,
    },
  ];

  // 热门模型表格列
  const modelColumns: ColumnsType<EnhancedDashboardData['aiUsage']['topModels'][number]> = [
    {
      dataIndex: 'model',
      key: 'model',
      ellipsis: true,
      title: '模型',
    },
    {
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => <Tag>{provider}</Tag>,
      title: '供应商',
      width: 120,
    },
    {
      align: 'right',
      dataIndex: 'calls',
      key: 'calls',
      render: (calls: number) => calls.toLocaleString(),
      title: '调用次数',
      width: 120,
    },
    {
      align: 'right',
      dataIndex: 'tokens',
      key: 'tokens',
      render: (tokens: number) => `${(tokens / 1000000).toFixed(2)}M`,
      title: 'Token数',
      width: 120,
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {/* 按供应商分组 */}
      <Col xs={24} lg={12}>
        <Card
          title={
            <Space>
              <PieChartOutlined />
              AI 供应商分布
            </Space>
          }
          loading={loading}
        >
          <Table
            columns={providerColumns}
            dataSource={data.byProvider}
            pagination={false}
            rowKey="provider"
            size="small"
          />
        </Card>
      </Col>

      {/* 热门模型 TOP 10 */}
      <Col xs={24} lg={12}>
        <Card
          title={
            <Space>
              <TrophyOutlined />
              热门模型 TOP 10
            </Space>
          }
          loading={loading}
        >
          <Table
            columns={modelColumns}
            dataSource={data.topModels}
            pagination={false}
            rowKey={(record) => `${record.provider}-${record.model}`}
            size="small"
          />
        </Card>
      </Col>
    </Row>
  );
};

// 留存率队列表格
const RetentionCohortsCard: React.FC<{
  data: EnhancedDashboardData['retentionCohorts'];
  loading?: boolean;
}> = ({ data, loading }) => {
  const columns: ColumnsType<EnhancedDashboardData['retentionCohorts'][number]> = [
    {
      dataIndex: 'date',
      key: 'date',
      title: '注册日期',
      width: 120,
    },
    {
      align: 'right',
      dataIndex: 'users',
      key: 'users',
      render: (users: number) => users.toLocaleString(),
      title: '用户数',
      width: 100,
    },
    {
      align: 'right',
      dataIndex: 'd1',
      key: 'd1',
      render: (value: number) => `${(value * 100).toFixed(0)}%`,
      title: 'D1 留存',
      width: 100,
    },
    {
      align: 'right',
      dataIndex: 'd7',
      key: 'd7',
      render: (value: number) => `${(value * 100).toFixed(0)}%`,
      title: 'D7 留存',
      width: 100,
    },
    {
      align: 'right',
      dataIndex: 'd30',
      key: 'd30',
      render: (value: number) => `${(value * 100).toFixed(0)}%`,
      title: 'D30 留存',
      width: 100,
    },
  ];

  return (
    <Card
      title={
        <Space>
          <BarChartOutlined />
          用户留存率队列 (最近 30 天)
        </Space>
      }
      loading={loading}
    >
      <Table
        columns={columns}
        dataSource={data}
        pagination={false}
        rowKey="date"
        scroll={{ x: 600 }}
        size="small"
      />
    </Card>
  );
};

// 主 Dashboard 组件
const EnhancedDashboard: React.FC = () => {
  const [period, setPeriod] = useState<DashboardPeriod>('30d');

  // 默认数据
  const defaultData: EnhancedDashboardData = {
    snapshot: {
      totalUsers: 0,
      activeUsers: 0,
      todayActiveUsers: 0,
      activeSubscriptions: 0,
      mrr: 0,
      arr: 0,
      planDistribution: { free: 0, lite: 0, pro: 0, ultra: 0 },
    },
    period: {
      period: '30d',
      totalRevenue: 0,
      newSubscriptions: 0,
      churnedSubscriptions: 0,
      newUsers: 0,
      totalApiCalls: 0,
      totalTokens: 0,
      revenueTrend: [],
      userGrowthTrend: [],
    },
    aiUsage: {
      byProvider: [],
      topModels: [],
      hourlyActivity: Array.from({ length: 24 }, (_, hour) => ({ hour, messages: 0 })),
    },
    retentionCohorts: [],
  };

  // 获取仪表盘数据
  const { data: dashboardResponse, loading } = useRequest(() => getEnhancedDashboard(period), {
    refreshDeps: [period],
  });

  // 提取实际数据
  // 注意：UmiJS 的 useRequest 可能已经自动解包了响应
  // 如果 dashboardResponse 直接是 EnhancedDashboardData，则直接使用
  // 如果是 { data: EnhancedDashboardData, success: boolean }，则提取 .data
  let data: EnhancedDashboardData;
  if (dashboardResponse && 'data' in dashboardResponse && typeof dashboardResponse === 'object') {
    data = ((dashboardResponse as unknown) as { data?: EnhancedDashboardData }).data ?? defaultData;
  } else {
    data = (dashboardResponse as EnhancedDashboardData | undefined) ?? defaultData;
  }
  return (
    <PageContainer
      header={{
        title: '仪表盘',
        breadcrumb: {},
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 第一层：存量指标（快照数据） */}
        <SnapshotMetricsCard data={data.snapshot} loading={loading} />

        <Row gutter={[16, 16]}>
          {/* 套餐分布 */}
          <Col xs={24} lg={8}>
            <PlanDistributionCard data={data.snapshot.planDistribution} loading={loading} />
          </Col>

          {/* 收入趋势和用户增长图表 */}
          <Col xs={24} lg={16}>
            <Card title="趋势分析" bodyStyle={{ padding: 0 }}>
              <TrendsChart data={data.period} loading={loading} />
            </Card>
          </Col>
        </Row>

        {/* 第二层：流量指标（受 period 影响） */}
        <PeriodMetricsCard
          data={data.period}
          period={period}
          onPeriodChange={setPeriod}
          loading={loading}
        />

        {/* 第三层：AI 使用统计 */}
        <AIUsageStatsCard data={data.aiUsage} loading={loading} />

        {/* 第四层：用户留存率队列 */}
        <RetentionCohortsCard data={data.retentionCohorts} loading={loading} />
      </Space>
    </PageContainer>
  );
};

export default EnhancedDashboard;
