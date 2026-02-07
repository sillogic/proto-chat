import { PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { useParams, history } from '@umijs/max';
import { Card, Button, Tag, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useRequest } from '@umijs/max';
import { getUserDetail } from '@/services/admin';
import type { User } from '@/services/api.d';

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: userData, loading } = useRequest(
    () => getUserDetail(id || ''),
    {
      enabled: !!id,
    }
  );

  const user: User = userData?.data;

  const planTypeConfig = {
    free: { text: '免费版', color: 'default' },
    basic: { text: '基础版', color: 'blue' },
    pro: { text: '专业版', color: 'green' },
    enterprise: { text: '企业版', color: 'gold' },
  };

  const statusConfig = {
    active: { text: '正常', color: 'green' },
    suspended: { text: '已停用', color: 'red' },
    expired: { text: '已过期', color: 'orange' },
  };

  return (
    <PageContainer
      header={{
        title: '用户详情',
        breadcrumb: {
          routes: [
            { path: '/users', breadcrumbName: '用户管理' },
            { path: '', breadcrumbName: '用户详情' },
          ],
        },
        extra: [
          <Button
            key="back"
            icon={<ArrowLeftOutlined />}
            onClick={() => history.push('/users')}
          >
            返回
          </Button>,
        ],
      }}
    >
      <Card loading={loading}>
        {user && (
          <ProDescriptions
            column={2}
            dataSource={user}
            columns={[
              {
                title: '用户ID',
                dataIndex: 'id',
                span: 2,
              },
              {
                title: '邮箱',
                dataIndex: 'email',
                span: 1,
              },
              {
                title: '名称',
                dataIndex: 'name',
                span: 1,
              },
              {
                title: '套餐类型',
                dataIndex: 'planType',
                render: (planType) => {
                  const config = planTypeConfig[planType as keyof typeof planTypeConfig];
                  return <Tag color={config.color}>{config.text}</Tag>;
                },
                span: 1,
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (status) => {
                  const config = statusConfig[status as keyof typeof statusConfig];
                  return <Tag color={config.color}>{config.text}</Tag>;
                },
                span: 1,
              },
              {
                title: '月度Token限制',
                dataIndex: 'monthlyTokenLimit',
                render: (limit) => {
                  return limit > 0 ? `${limit.toLocaleString()}` : '无限制';
                },
                span: 1,
              },
              {
                title: '月度API调用限制',
                dataIndex: 'monthlyApiCallsLimit',
                render: (limit) => {
                  return limit > 0 ? `${limit.toLocaleString()}` : '无限制';
                },
                span: 1,
              },
              {
                title: '注册时间',
                dataIndex: 'createdAt',
                render: (date) => {
                  return new Date(date).toLocaleString();
                },
                span: 1,
              },
              {
                title: '最后登录',
                dataIndex: 'lastLoginAt',
                render: (date) => {
                  return date ? new Date(date).toLocaleString() : '从未登录';
                },
                span: 1,
              },
              {
                title: '功能特性',
                dataIndex: 'features',
                render: (features) => {
                  if (!features) return '-';
                  return (
                    <Space wrap>
                      {Object.entries(features).map(([key, value]) => (
                        <Tag key={key} color="blue">
                          {key}: {String(value)}
                        </Tag>
                      ))}
                    </Space>
                  );
                },
                span: 2,
              },
            ]}
          />
        )}
      </Card>
    </PageContainer>
  );
};

export default UserDetail;