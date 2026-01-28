import { ProCard, ProTable, ProFormSelect } from '@ant-design/pro-components';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useRequest } from '@umijs/max';
import { Card, Col, Row, Tag, Typography, Progress, Space, Tooltip, Tabs } from 'antd';
import { useState, useMemo } from 'react';
import { getUsageStats } from '../../services/credit';
import { getUserList } from '../../services/admin';

const { Text } = Typography;

interface UsageStatsViewProps {
  userId?: string;
  showSelector?: boolean;
}

export const UsageStatsView: React.FC<UsageStatsViewProps> = ({ userId: initialUserId, showSelector = false }) => {
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(initialUserId);
  const [activeTab, setActiveTab] = useState<string>('all');

  // If initialUserId changes, update selectedUserId
  useMemo(() => {
    if (initialUserId !== undefined) {
      setSelectedUserId(initialUserId);
    }
  }, [initialUserId]);

  const { data: stats, loading } = useRequest(
    async () => {
      if (!selectedUserId) return {};
      const res = await getUsageStats({ userId: selectedUserId });
      return res;
    },
    {
      refreshDeps: [selectedUserId],
      ready: !!selectedUserId,
    }
  );

  // Base columns for all types
  const baseColumns: any[] = [
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      width: 170,
      render: (val: any) => <Text type="secondary" style={{ fontSize: '13px' }}>{val}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'usageType',
      width: 120,
      render: (usageType: any) => {
        const typeMap: Record<string, { color: string; label: string; icon: string }> = {
          chat: { color: 'blue', label: '文本生成', icon: '💬' },
          embedding: { color: 'green', label: '向量化', icon: '🔤' },
          image: { color: 'orange', label: '文生图', icon: '🎨' },
        };
        const config = typeMap[usageType?.toLowerCase()] || { color: 'default', label: usageType || '其他', icon: '📝' };

        return (
          <Tag bordered={false} color={config.color} style={{ borderRadius: '4px', paddingInline: '8px' }}>
             <Space size={4}>
               <span role="img" aria-label={config.label}>{config.icon}</span>
               <span>{config.label}</span>
             </Space>
          </Tag>
        );
      },
    },
    {
      title: '模型',
      dataIndex: 'model',
      width: 220,
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: '14px' }}>{record.model}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>{record.provider?.toUpperCase()}</Text>
        </Space>
      ),
    },
  ];

  // Token-based columns (for chat and embedding)
  const tokenColumns: any[] = [
    ...baseColumns,
    {
      title: 'Token 用量',
      dataIndex: 'totalTokens',
      width: 200,
      render: (_: any, record: any) => (
        <Space size={8}>
          <Text strong>{Number(record.totalTokens || 0).toLocaleString()}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            = ↓ {record.totalInputTokens || 0} + ↑ {record.totalOutputTokens || 0}
          </Text>
        </Space>
      ),
    },
    {
      title: '积分',
      dataIndex: 'credits',
      width: 100,
      align: 'right',
      render: (val: number) => (
        <Text strong style={{ color: '#fa8c16' }}>{Number(val).toLocaleString()}</Text>
      ),
    },
    {
      title: '用时',
      dataIndex: 'duration',
      width: 100,
      align: 'right',
      render: (val: any) => (
        <Text type="secondary">{val ? `${(Number(val) / 1000).toFixed(2)}s` : '-'}</Text>
      ),
    },
  ];

  // Image-specific columns (no token usage or duration)
  const imageColumns: any[] = [
    ...baseColumns,
    {
      title: '积分',
      dataIndex: 'credits',
      width: 100,
      align: 'right',
      render: (val: number) => (
        <Text strong style={{ color: '#fa8c16' }}>{Number(val).toLocaleString()}</Text>
      ),
    },
  ];

  const transactionColumns: any[] = [
    {
      title: '交易流水号',
      dataIndex: 'id',
      width: 150,
      render: (id: string) => (
        <Text copyable style={{ fontSize: '12px', color: '#8c8c8c' }}>{id}</Text>
      ),
    },
    {
      title: '交易类别',
      dataIndex: 'category',
      width: 120,
      render: (category: string) => {
        const categoryMap: any = {
          DEPOSIT: { label: '赠送/充值', color: 'green' },
          CONSUMPTION: { label: 'AI消费', color: 'orange' },
          IMAGE_GENERATION: { label: '图片生成', color: 'gold' },
          REFUND: { label: '退款', color: 'blue' },
          ADJUSTMENT: { label: '人工调账', color: 'purple' },
          RESET: { label: '周期重置', color: 'default' },
        };
        const item = categoryMap[category] || { label: category, color: 'default' };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '说明',
      dataIndex: 'description',
      ellipsis: true,
      render: (desc: string) => <Text type="secondary" style={{ fontSize: '13px' }}>{desc}</Text>,
    },
    {
      title: '数值',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      render: (amount: string) => {
        const val = parseFloat(amount);
        return (
          <Text strong style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {val >= 0 ? '+' : ''}{Number(val).toLocaleString()}
          </Text>
        );
      },
    },
    {
      title: '变更后余额',
      dataIndex: 'balanceAfter',
      width: 120,
      align: 'right',
      render: (val: string) => <Text strong>{Number(val).toLocaleString()}</Text>,
    },
    {
      title: '完成时间',
      dataIndex: 'createdAt',
      width: 170,
      valueType: 'dateTime',
      render: (val: any) => <Text type="secondary" style={{ fontSize: '13px' }}>{val}</Text>,
    },
  ];

  return (
    <div style={{ paddingBlock: '12px' }}>
      {showSelector && (
        <Card style={{ marginBlockEnd: 24, borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ maxWidth: 400 }}>
            <ProFormSelect
              name="userId"
              label="选择查看用户"
              request={async () => {
                const res = await getUserList({ current: 1, pageSize: 100 });
                const users = res.data?.users?.map((u: any) => ({
                  label: u.email || u.username || u.full_name || u.name || 'Unknown User',
                  value: u.id,
                })) || [];
                return users;
              }}
              fieldProps={{
                onChange: (val) => setSelectedUserId(val),
                value: selectedUserId,
              }}
              placeholder="请输入邮箱或用户名搜索"
            />
          </div>
        </Card>
      )}

      {selectedUserId && stats && (
        <Space direction="vertical" size={24} style={{ display: 'flex' }}>
          {/* Dashboard Summary */}
          <Row gutter={24}>
            <Col span={10}>
              <ProCard 
                title={<Space><span role="img" aria-label="credits">💎</span><span>计算积分额度</span></Space>} 
                headerBordered 
                style={{ borderRadius: '12px', height: '100%' }}
                extra={<Tooltip title="包含对话、向量化、绘图等所有消耗。每周期重置一次。"><QuestionCircleOutlined /></Tooltip>}
              >
                <div style={{ paddingBlock: "8px" }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockEnd: 8 }}>
                    <Text type="secondary">本期已消耗</Text>
                    <Text strong style={{ fontSize: '18px' }}>
                      {Number(stats.balance?.totalConsumed || 0).toLocaleString()} / {Number(stats.stats?.credits?.limit ?? stats.balance?.limit ?? 0).toLocaleString()}
                    </Text>
                  </div>
                  <Progress 
                    percent={Math.min(100, (Number(stats.balance?.totalConsumed || 0) / Math.max(1, Number(stats.stats?.credits?.limit ?? stats.balance?.limit ?? 0))) * 100)} 
                    strokeColor={{ '0%': '#1890ff', '100%': '#36cfc9' }}
                    strokeWidth={12}
                    showInfo={false} 
                  />
                   <div style={{ marginBlockStart: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>下一重置日: {stats.stats?.resetCountdown?.nextResetDate || '-'}</Text>
                    <Tag color="processing" bordered={false}>{stats.balance?.currentPlan || '免费版'}</Tag>
                  </div>
                </div>
              </ProCard>
            </Col>
            <Col span={14}>
               <Row gutter={16}>
                  <Col span={12}>
                    <ProCard title="文件存储" headerBordered style={{ borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Progress 
                          type="circle" 
                          size={60} 
                          percent={Math.min(100, (Number(stats.stats?.files?.totalSizeMB || 0) / Math.max(1, Number(stats.stats?.files?.limit || 1))) * 100)} 
                          format={p => `${p?.toFixed(0)}%`}
                        />
                        <div style={{ textAlign: 'right' }}>
                          <Text strong style={{ fontSize: '16px' }}>{stats.stats?.files?.totalSizeMB < 0.1 ? `${stats.stats?.files?.totalSizeKB} KB` : `${stats.stats?.files?.totalSizeMB} MB`}</Text>
                          <br />
                          <Text type="secondary">上限 {stats.stats?.files?.limit} MB</Text>
                        </div>
                      </div>
                    </ProCard>
                  </Col>
                  <Col span={12}>
                    <ProCard title="向量存储" headerBordered style={{ borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                         <Progress 
                          type="circle" 
                          size={60} 
                          percent={Math.min(100, (Number(stats.stats?.vectors?.count || 0) / Math.max(1, Number(stats.stats?.vectors?.limit || 1))) * 100)} 
                          strokeColor="#722ed1"
                          format={p => `${p?.toFixed(0)}%`}
                        />
                         <div style={{ textAlign: 'right' }}>
                          <Text strong style={{ fontSize: '16px' }}>{stats.stats?.vectors?.count || 0}</Text>
                          <br />
                          <Text type="secondary">上限 {stats.stats?.vectors?.limit} 条</Text>
                        </div>
                      </div>
                    </ProCard>
                  </Col>
               </Row>
            </Col>
          </Row>

          {/* Table 1: Detailed Consumption */}
          <ProCard
            title={
              <div style={{ paddingBlock: '8px' }}>
                <Text strong style={{ fontSize: '16px' }}>计算积分使用明细</Text>
                <div style={{ fontSize: '12px', color: '#8c8c8c', fontWeight: 'normal' }}>文本生成、向量化、文生图等计算积分使用明细</div>
              </div>
            }
            headerBordered
            style={{ borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}
          >
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'all',
                  label: '全部',
                  children: (
                    <ProTable
                      rowKey="id"
                      loading={loading}
                      dataSource={stats?.usage || []}
                      columns={tokenColumns}
                      search={false}
                      ghost
                      pagination={{ pageSize: 5 }}
                      scroll={{ x: 'max-content' }}
                    />
                  ),
                },
                {
                  key: 'text',
                  label: '文本/向量',
                  children: (
                    <ProTable
                      rowKey="id"
                      loading={loading}
                      dataSource={(stats?.usage || []).filter((item: any) => item.usageType === 'chat' || item.usageType === 'embedding')}
                      columns={tokenColumns}
                      search={false}
                      ghost
                      pagination={{ pageSize: 5 }}
                      scroll={{ x: 'max-content' }}
                    />
                  ),
                },
                {
                  key: 'image',
                  label: '图片生成',
                  children: (
                    <ProTable
                      rowKey="id"
                      loading={loading}
                      dataSource={(stats?.usage || []).filter((item: any) => item.usageType === 'image')}
                      columns={imageColumns}
                      search={false}
                      ghost
                      pagination={{ pageSize: 5 }}
                      scroll={{ x: 'max-content' }}
                    />
                  ),
                },
              ]}
            />
          </ProCard>

          {/* Table 2: Account Transactions */}
          <ProCard 
            title={
              <div style={{ paddingBlock: '8px' }}>
                <Text strong style={{ fontSize: '16px' }}>账户流水记录</Text>
                <div style={{ fontSize: '12px', color: '#8c8c8c', fontWeight: 'normal' }}>余额变更明细，包含充值、赠送、周期重置及系统扣费流水</div>
              </div>
            }
            headerBordered
            style={{ borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}
          >
            <ProTable
              rowKey="id"
              loading={loading}
              dataSource={stats?.transactions || []}
              columns={transactionColumns}
              search={false}
              ghost
              pagination={{ pageSize: 5 }}
              scroll={{ x: 'max-content' }}
            />
          </ProCard>
        </Space>
      )}
    </div>
  );
};

// Main Page Component
import { PageContainer } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import { SystemUsageView } from './SystemUsageView';

const UsageStatisticsPage: React.FC = () => {
  return (
    <PageContainer>
      <Tabs
        defaultActiveKey="system"
        items={[
          {
            key: 'system',
            label: '系统概览',
            children: <SystemUsageView />,
          },
          {
            key: 'user',
            label: '用户查询',
            children: <UsageStatsView showSelector={true} />,
          },
        ]}
      />
    </PageContainer>
  );
};

export default UsageStatisticsPage;
