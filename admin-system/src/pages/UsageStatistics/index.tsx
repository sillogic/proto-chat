import { PageContainer, ProCard, ProTable, ProFormSelect } from '@ant-design/pro-components';
import { QuestionCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useRequest } from '@umijs/max';
import { Card, Col, Row, Statistic, Tag, Typography, Progress, Space, Tooltip } from 'antd';
import { useState } from 'react';
import { getUsageStats } from '../../services/credit';
import { getUserList } from '../../services/admin';

const { Text } = Typography;

const UsageStatistics: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string>();


  // Fetch Stats when user is selected
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

  const columns: any[] = [
    {
      title: '模型',
      dataIndex: 'model',
      render: (_: any, record: any) => <Tag>{record.model}</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (_: any, record: any) => <Tag color="blue">{record.type}</Tag>,
    },
    {
      title: 'Token 用量',
      dataIndex: 'totalTokens',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.totalTokens}</Text>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBlockStart: -2 }}>
            <span style={{ marginInlineEnd: 8 }}>Prompt: {record.totalInputTokens}</span>
            <span>Completion: {record.totalOutputTokens}</span>
          </div>
        </Space>
      ),
    },
    {
      title: '积分',
      dataIndex: 'credits',
      render: (_: any, record: any) => (
        <Text strong style={{ color: '#fa8c16' }}>{Number(record.credits || 0).toLocaleString()}</Text>
      ),
    },
    {
      title: 'TPS',
      dataIndex: 'tps',
      render: (_: any, record: any) => (record.tps ? Number(record.tps).toFixed(2) : '-'),
    },
    {
      title: 'TTFT',
      dataIndex: 'ttft',
      render: (_: any, record: any) => (record.ttft ? `${Number(record.ttft).toFixed(2)}ms` : '-'),
    },
    {
      title: '花费',
      dataIndex: 'spend',
      render: (_: any, record: any) => (record.spend ? `$${Number(record.spend).toFixed(6)}` : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      sorter: (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
  ];


  return (
    <PageContainer>
      <Card style={{ marginBlockEnd: 24 }}>
        <div style={{ maxWidth: 400 }}>
          <ProFormSelect
            name="userId"
            label="选择用户"
            request={async () => {
              const res = await getUserList({ current: 1, pageSize: 100 });
              const users = res.data?.users?.map((u: any) => ({
                label: u.email || u.username || u.full_name || u.name || 'Unknown User',
                value: u.id,
              })) || [];
              return [
                { label: '所有用户 (全局统计)', value: 'all' },
                ...users
              ];
            }}
            fieldProps={{
              onChange: (val) => setSelectedUserId(val),
              value: selectedUserId,
            }}
            placeholder="请选择要查看的用户"
          />
        </div>
      </Card>

      {selectedUserId && stats && (
        <>
          <Row gutter={24} style={{ marginBlockEnd: 24 }}>
            <Col span={24}>
              <ProCard title="当前周期用量统计" headerBordered style={{ marginBlockEnd: 24 }}>
                <div style={{ paddingBlock: "0", paddingInline: "16px" }}>
                  {/* 计算积分 */}
                  <div style={{ marginBlockEnd: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockEnd: 8 }}>
                      <Space>
                        <Tag color="cyan">计算积分用量</Tag>
                        <Tooltip title="用于 AI 对话、文生图、语音合成的积分用量 (当前计费周期)">
                           <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                        </Tooltip>
                      </Space>
                      <Text strong>
                        {Number(stats.balance?.totalConsumed || 0).toLocaleString()} / {Number(stats.stats?.userExtension?.monthlyTokenLimit || 0).toLocaleString()} 已使用
                      </Text>
                    </div>
                    <Progress 
                      percent={Math.min(100, (Number(stats.balance?.totalConsumed || 0) / Math.max(1, Number(stats.stats?.userExtension?.monthlyTokenLimit || 0))) * 100)} 
                      showInfo={false} 
                      strokeColor="#1890ff"
                    />
                    <div style={{ marginBlockStart: 4 }}>
                      <Text type="secondary">
                        配额将于 {stats.stats?.resetCountdown?.nextResetDate || '-'} 重置
                      </Text>
                    </div>
                  </div>
                </div>
              </ProCard>

              <ProCard title="存储用量" headerBordered>
                <div style={{ paddingBlock: "0", paddingInline: "16px" }}>
                  {/* 文件用量 */}
                  <div style={{ marginBlockEnd: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockEnd: 8 }}>
                      <Space>
                        <Tag color="blue">文件用量</Tag>
                        <Tooltip title="文件存储用于存储文件、图片等数据">
                           <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                        </Tooltip>
                      </Space>
                      <Text strong>
                        {stats.stats?.files?.totalSizeMB || 0} MB / {stats.stats?.userExtension?.monthlyStorageLimit || 0} MB 已使用
                      </Text>
                    </div>
                    <Progress 
                      percent={Math.min(100, (Number(stats.stats?.files?.totalSizeMB || 0) / Math.max(1, Number(stats.stats?.userExtension?.monthlyStorageLimit || 1))) * 100)} 
                      showInfo={false} 
                      strokeColor="#52c41a"
                    />
                  </div>

                  {/* 向量存储 */}
                  <div style={{ marginBlockEnd: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockEnd: 8 }}>
                      <Space>
                        <Tag color="purple">向量存储</Tag>
                        <Tooltip title="一页文档 (1000~1500 字符) 约生成 1 条向量。(使用 OpenAI Embeddings 进行估计，不同模型可能有所不同)">
                           <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                        </Tooltip>
                      </Space>
                      <Text strong>
                        {stats.stats?.vectors?.count || 0} / {stats.stats?.userExtension?.monthlyVectorLimit || 0} 已使用
                      </Text>
                    </div>
                    <Progress 
                      percent={Math.min(100, (Number(stats.stats?.vectors?.count || 0) / Math.max(1, Number(stats.stats?.userExtension?.monthlyVectorLimit || 1))) * 100)} 
                      showInfo={false} 
                      strokeColor="#722ed1"
                    />
                  </div>
                </div>
              </ProCard>
            </Col>
          </Row>

          <ProTable
            headerTitle="使用历史明细 (全部)"
            rowKey="id"
            loading={loading}
            dataSource={stats?.usage || []}
            columns={columns}
            search={false}
            pagination={{ pageSize: 15 }}
          />
        </>
      )}
    </PageContainer>
  );
};

export default UsageStatistics;
