import { PageContainer, ProCard, StatisticCard } from '@ant-design/pro-components';
import {
  UserOutlined,
  CrownOutlined,
  KeyOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { Row, Col, Card, Statistic } from 'antd';
import { useRequest } from '@umijs/max';
import { getDashboardStats } from '@/services/admin';
import type { DashboardStats } from '@/services/api.d';

const Dashboard: React.FC = () => {
  // 获取仪表盘统计数据
  const { data: statsData, loading } = useRequest<{ data: DashboardStats; success: boolean }>(getDashboardStats, {
    initialData: {
      data: {
        totalUsers: 0,
        activeUsers: 0,
        totalPlans: 0,
        totalApiKeys: 0,
        todayTokenUsage: 0,
        monthlyRevenue: 0,
      },
      success: true,
    },
  });

  const stats = statsData?.data;

  return (
    <PageContainer
      header={{
        title: '仪表盘',
        breadcrumb: {},
      }}
    >
      <Row gutter={[16, 16]}>
        {/* 用户统计 */}
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            statistic={{
              title: '总用户数',
              value: stats?.totalUsers || 0,
              icon: <UserOutlined style={{ color: '#1890ff' }} />,
            }}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            statistic={{
              title: '活跃用户',
              value: stats?.activeUsers || 0,
              icon: <UserOutlined style={{ color: '#52c41a' }} />,
            }}
            loading={loading}
          />
        </Col>

        {/* 套餐统计 */}
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            statistic={{
              title: '套餐总数',
              value: stats?.totalPlans || 0,
              icon: <CrownOutlined style={{ color: '#722ed1' }} />,
            }}
            loading={loading}
          />
        </Col>

        {/* API Key 统计 */}
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            statistic={{
              title: 'API Key 数量',
              value: stats?.totalApiKeys || 0,
              icon: <KeyOutlined style={{ color: '#fa8c16' }} />,
            }}
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {/* Token 使用统计 */}
        <Col xs={24} md={12}>
          <Card>
            <Statistic
              title="今日 Token 使用量"
              value={stats?.todayTokenUsage || 0}
              suffix="Tokens"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>

        {/* 收入统计 */}
        <Col xs={24} md={12}>
          <Card>
            <Statistic
              title="本月收入"
              value={stats?.monthlyRevenue || 0}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 快捷操作 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <ProCard title="快捷操作" headerBordered>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Card
                  hoverable
                  onClick={() => (window.location.href = '/users')}
                  style={{ textAlign: 'center' }}
                >
                  <UserOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                  <div style={{ marginTop: 8 }}>用户管理</div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card
                  hoverable
                  onClick={() => (window.location.href = '/plans')}
                  style={{ textAlign: 'center' }}
                >
                  <CrownOutlined style={{ fontSize: 32, color: '#722ed1' }} />
                  <div style={{ marginTop: 8 }}>套餐管理</div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card
                  hoverable
                  onClick={() => (window.location.href = '/api-keys')}
                  style={{ textAlign: 'center' }}
                >
                  <KeyOutlined style={{ fontSize: 32, color: '#fa8c16' }} />
                  <div style={{ marginTop: 8 }}>API Key 管理</div>
                </Card>
              </Col>
            </Row>
          </ProCard>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default Dashboard;