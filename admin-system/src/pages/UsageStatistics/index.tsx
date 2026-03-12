import { PageContainer, ProCard, ProFormSelect } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import { SystemUsageView } from './SystemUsageView';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useRequest } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Pagination,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { getUsageConsumption, getUsageStats, getUsageTransactions } from '../../services/credit';
import { getUserList } from '../../services/admin';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface UsageStatsViewProps {
  userId?: string;
  showSelector?: boolean;
}

export const UsageStatsView: React.FC<UsageStatsViewProps> = ({
  userId: initialUserId,
  showSelector = false,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(initialUserId);

  useMemo(() => {
    if (initialUserId !== undefined) setSelectedUserId(initialUserId);
  }, [initialUserId]);

  // ── Summary ──────────────────────────────────────────────────────────────
  const { data: statsRaw, loading: statsLoading } = useRequest(
    async () => {
      if (!selectedUserId) return null;
      return getUsageStats({ userId: selectedUserId });
    },
    { refreshDeps: [selectedUserId], ready: !!selectedUserId },
  );
  const stats = useMemo(() => {
    const s = (statsRaw as any)?.data ?? statsRaw;
    return s || null;
  }, [statsRaw]);

  // ── Consumption table state ───────────────────────────────────────────────
  const [cPage, setCPage] = useState(1);
  const [cPageSize, setCPageSize] = useState(20);
  const [cDateRange, setCDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [cType, setCType] = useState<string>('');
  const [cModel, setCModel] = useState<string>('');
  const [cFilters, setCFilters] = useState<{
    dateFrom?: string; dateTo?: string; type?: string; model?: string;
  }>({});

  const { data: consumptionRaw, loading: cLoading } = useRequest(
    async () => {
      if (!selectedUserId) return null;
      return getUsageConsumption({
        userId: selectedUserId,
        ...cFilters,
        limit: cPageSize,
        offset: (cPage - 1) * cPageSize,
      });
    },
    { refreshDeps: [selectedUserId, cPage, cPageSize, cFilters], ready: !!selectedUserId },
  );
  const consumptionData = useMemo(() => {
    const d = (consumptionRaw as any)?.data ?? consumptionRaw;
    return d || { list: [], total: 0 };
  }, [consumptionRaw]);

  const handleCSearch = () => {
    setCPage(1);
    setCFilters({
      dateFrom: cDateRange[0] ? cDateRange[0].startOf('day').toISOString() : undefined,
      dateTo: cDateRange[1] ? cDateRange[1].endOf('day').toISOString() : undefined,
      type: cType || undefined,
      model: cModel.trim() || undefined,
    });
  };
  const handleCReset = () => {
    setCDateRange([null, null]);
    setCType('');
    setCModel('');
    setCPage(1);
    setCFilters({});
  };

  // ── Transactions table state ──────────────────────────────────────────────
  const [tPage, setTPage] = useState(1);
  const [tPageSize, setTPageSize] = useState(20);
  const [tDateRange, setTDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [tFilters, setTFilters] = useState<{ dateFrom?: string; dateTo?: string }>({});

  const { data: transactionsRaw, loading: tLoading } = useRequest(
    async () => {
      if (!selectedUserId) return null;
      return getUsageTransactions({
        userId: selectedUserId,
        ...tFilters,
        limit: tPageSize,
        offset: (tPage - 1) * tPageSize,
      });
    },
    { refreshDeps: [selectedUserId, tPage, tPageSize, tFilters], ready: !!selectedUserId },
  );
  const transactionsData = useMemo(() => {
    const d = (transactionsRaw as any)?.data ?? transactionsRaw;
    return d || { list: [], total: 0 };
  }, [transactionsRaw]);

  const handleTSearch = () => {
    setTPage(1);
    setTFilters({
      dateFrom: tDateRange[0] ? tDateRange[0].startOf('day').toISOString() : undefined,
      dateTo: tDateRange[1] ? tDateRange[1].endOf('day').toISOString() : undefined,
    });
  };
  const handleTReset = () => {
    setTDateRange([null, null]);
    setTPage(1);
    setTFilters({});
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const consumptionColumns: any[] = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      title: '使用时间',
      width: 160,
      render: (v: any) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {dayjs(v).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
    },
    {
      dataIndex: 'usageType',
      key: 'usageType',
      title: '类型',
      width: 100,
      render: (t: string) => {
        const map: Record<string, { color: string; label: string }> = {
          chat: { color: 'processing', label: '文本生成' },
          image: { color: 'warning', label: '文生图' },
          embedding: { color: 'success', label: '向量化' },
        };
        const c = map[t?.toLowerCase()] || { color: 'default', label: t || '其他' };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      dataIndex: 'model',
      key: 'model',
      title: '模型',
      render: (_: any, r: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: '13px' }}>{r.model}</Text>
          <Text type="secondary" style={{ fontSize: '10px' }}>{r.provider?.toUpperCase()}</Text>
        </Space>
      ),
    },
    {
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      title: 'Token / 规格',
      render: (_: any, r: any) => {
        const hasTokens = (r.totalInputTokens || 0) > 0 || (r.totalOutputTokens || 0) > 0;
        if (r.usageType === 'image' && !hasTokens) {
          return <Text type="secondary" style={{ fontSize: '11px' }}>-</Text>;
        }
        return (
          <Space size={8}>
            <Text strong>{Number(r.totalTokens || 0).toLocaleString()}</Text>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              = ↑ {r.totalInputTokens || 0} + ↓ {r.totalOutputTokens || 0}
            </Text>
          </Space>
        );
      },
    },
    {
      dataIndex: 'credits',
      key: 'credits',
      title: '积分',
      width: 100,
      align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: '#fa8c16' }}>{Number(v).toLocaleString()}</Text>
      ),
    },
    {
      dataIndex: 'duration',
      key: 'duration',
      title: '用时',
      width: 80,
      align: 'right' as const,
      render: (v: any) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {v ? `${(Number(v) / 1000).toFixed(2)}s` : '-'}
        </Text>
      ),
    },
  ];

  const transactionColumns: any[] = [
    {
      dataIndex: 'id',
      key: 'id',
      title: '交易流水号',
      width: 150,
      render: (id: string) => (
        <Text copyable style={{ color: '#8c8c8c', fontSize: '12px' }}>{id}</Text>
      ),
    },
    {
      dataIndex: 'category',
      key: 'category',
      title: '业务类别',
      width: 120,
      render: (category: string) => {
        const map: any = {
          ADJUSTMENT: { color: 'purple', label: '人工调账' },
          CONSUMPTION: { color: 'orange', label: 'AI消费' },
          DEPOSIT: { color: 'green', label: '赠送/充值' },
          IMAGE_GENERATION: { color: 'gold', label: '图片生成' },
          REFUND: { color: 'blue', label: '退款' },
          RESET: { color: 'default', label: '周期重置' },
        };
        const item = map[category] || { color: 'default', label: category };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      dataIndex: 'type',
      key: 'type',
      title: '交易类型',
      width: 100,
      render: (t: string) => <Tag>{t}</Tag>,
    },
    {
      dataIndex: 'description',
      key: 'description',
      title: '说明',
      ellipsis: true,
      render: (d: string) => <Text type="secondary" style={{ fontSize: '13px' }}>{d}</Text>,
    },
    {
      dataIndex: 'amount',
      key: 'amount',
      title: '变动数额',
      width: 120,
      align: 'right' as const,
      render: (v: any) => {
        const num = Number(v);
        return (
          <Text strong style={{ color: num >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {num >= 0 ? '+' : ''}{Number(num).toLocaleString()}
          </Text>
        );
      },
    },
    {
      dataIndex: 'balanceAfter',
      key: 'balanceAfter',
      title: '变动后余额',
      width: 120,
      align: 'right' as const,
      render: (v: any) => <Text strong>{Number(v || 0).toLocaleString()}</Text>,
    },
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      title: '时间',
      width: 160,
      render: (v: any) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {dayjs(v).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
    },
  ];

  return (
    <div style={{ paddingBlock: '12px' }}>
      {showSelector && (
        <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBlockEnd: 24 }}>
          <div style={{ maxWidth: 400 }}>
            <ProFormSelect
              name="userId"
              label="选择查看用户"
              request={async () => {
                const res = await getUserList({ current: 1, pageSize: 100 });
                return (
                  res.data?.users?.map((u: any) => ({
                    label: u.email || u.username || u.full_name || 'Unknown User',
                    value: u.id,
                  })) || []
                );
              }}
              fieldProps={{ onChange: (val) => setSelectedUserId(val), value: selectedUserId }}
              placeholder="请输入邮箱或用户名搜索"
            />
          </div>
        </Card>
      )}

      {selectedUserId && (
        <Space direction="vertical" size={24} style={{ display: 'flex' }}>
          {/* ── Summary ── */}
          <Row gutter={[24, 24]}>
            <Col span={10}>
              <ProCard
                headerBordered
                style={{ borderRadius: '12px', height: '100%' }}
                title={<Space><span role="img" aria-label="credits">💎</span><span>计算积分额度</span></Space>}
                extra={
                  <Tooltip title="包含对话、向量化、绘图等所有消耗。每周期重置一次。">
                    <QuestionCircleOutlined />
                  </Tooltip>
                }
                loading={statsLoading}
              >
                <div style={{ paddingBlock: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockEnd: 8 }}>
                    <Text type="secondary">本期已消耗</Text>
                    <Text strong style={{ fontSize: '18px' }}>
                      {Number(stats?.balance?.totalConsumed || 0).toLocaleString()}
                      {' / '}
                      {Number(stats?.stats?.credits?.limit ?? stats?.balance?.limit ?? 0).toLocaleString()}
                    </Text>
                  </div>
                  <Progress
                    showInfo={false}
                    strokeWidth={12}
                    strokeColor={{ '0%': '#1890ff', '100%': '#36cfc9' }}
                    percent={Math.min(
                      100,
                      (Number(stats?.balance?.totalConsumed || 0) /
                        Math.max(1, Number(stats?.stats?.credits?.limit ?? stats?.balance?.limit ?? 0))) * 100,
                    )}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockStart: 12 }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      下一重置日: {stats?.stats?.resetCountdown?.nextResetDate || '-'}
                    </Text>
                    <Tag color="processing" bordered={false}>
                      {stats?.balance?.currentPlan || '免费版'}
                    </Tag>
                  </div>
                </div>
              </ProCard>
            </Col>
            <Col span={14}>
              <Row gutter={16}>
                <Col span={12}>
                  <ProCard headerBordered style={{ borderRadius: '12px' }} title="文件存储" loading={statsLoading}>
                    <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                      <Progress
                        type="circle"
                        size={60}
                        format={(p) => `${p?.toFixed(0)}%`}
                        percent={Math.min(
                          100,
                          (Number(stats?.stats?.files?.totalSizeMB || 0) /
                            Math.max(1, Number(stats?.stats?.files?.limit || 1))) * 100,
                        )}
                      />
                      <div style={{ textAlign: 'right' }}>
                        <Text strong style={{ fontSize: '16px' }}>
                          {stats?.stats?.files?.totalSizeMB < 0.1
                            ? `${stats?.stats?.files?.totalSizeKB} KB`
                            : `${stats?.stats?.files?.totalSizeMB} MB`}
                        </Text>
                        <br />
                        <Text type="secondary">上限 {stats?.stats?.files?.limit} MB</Text>
                      </div>
                    </div>
                  </ProCard>
                </Col>
                <Col span={12}>
                  <ProCard headerBordered style={{ borderRadius: '12px' }} title="向量存储" loading={statsLoading}>
                    <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                      <Progress
                        type="circle"
                        size={60}
                        strokeColor="#722ed1"
                        format={(p) => `${p?.toFixed(0)}%`}
                        percent={Math.min(
                          100,
                          (Number(stats?.stats?.vectors?.count || 0) /
                            Math.max(1, Number(stats?.stats?.vectors?.limit || 1))) * 100,
                        )}
                      />
                      <div style={{ textAlign: 'right' }}>
                        <Text strong style={{ fontSize: '16px' }}>{stats?.stats?.vectors?.count || 0}</Text>
                        <br />
                        <Text type="secondary">上限 {stats?.stats?.vectors?.limit} 条</Text>
                      </div>
                    </div>
                  </ProCard>
                </Col>
              </Row>
            </Col>
          </Row>

          {/* ── Consumption Table ── */}
          <ProCard
            headerBordered
            style={{ borderRadius: '12px' }}
            title={
              <div>
                <Text strong style={{ fontSize: '16px' }}>计算积分使用明细</Text>
                <div style={{ color: '#8c8c8c', fontSize: '12px', fontWeight: 'normal' }}>
                  文本生成、向量化、文生图等计算积分使用明细
                </div>
              </div>
            }
          >
            <Space style={{ marginBlockEnd: 12 }} wrap>
              <RangePicker
                placeholder={['开始日期', '结束日期']}
                value={cDateRange}
                onChange={(d) => setCDateRange(d ? [d[0], d[1]] : [null, null])}
              />
              <Select
                allowClear
                placeholder="类型"
                style={{ width: 120 }}
                value={cType || undefined}
                options={[
                  { label: '文本生成', value: 'chat' },
                  { label: '图片生成', value: 'image' },
                  { label: '向量化', value: 'embedding' },
                ]}
                onChange={(v) => setCType(v || '')}
              />
              <Input
                allowClear
                placeholder="模型名称"
                style={{ width: 180 }}
                value={cModel}
                onChange={(e) => setCModel(e.target.value)}
                onPressEnter={handleCSearch}
              />
              <Button type="primary" onClick={handleCSearch}>筛选</Button>
              <Button onClick={handleCReset}>重置</Button>
            </Space>
            <Table
              rowKey="id"
              size="small"
              loading={cLoading}
              columns={consumptionColumns}
              dataSource={consumptionData.list}
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty description="暂无使用记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
            {consumptionData.total > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBlockStart: 16 }}>
                <Pagination
                  showQuickJumper
                  showSizeChanger
                  current={cPage}
                  pageSize={cPageSize}
                  total={consumptionData.total}
                  pageSizeOptions={['20', '50', '100']}
                  showTotal={(t) => `共 ${t} 条记录`}
                  onChange={(p, ps) => {
                    setCPage(p);
                    if (ps !== cPageSize) { setCPageSize(ps); setCPage(1); }
                  }}
                />
              </div>
            )}
          </ProCard>

          {/* ── Transactions Table ── */}
          <ProCard
            headerBordered
            style={{ borderRadius: '12px' }}
            title={
              <div>
                <Text strong style={{ fontSize: '16px' }}>账户流水记录</Text>
                <div style={{ color: '#8c8c8c', fontSize: '12px', fontWeight: 'normal' }}>
                  余额变更明细，包含充值、赠送、周期重置及系统扣费流水
                </div>
              </div>
            }
          >
            <Space style={{ marginBlockEnd: 12 }} wrap>
              <RangePicker
                placeholder={['开始日期', '结束日期']}
                value={tDateRange}
                onChange={(d) => setTDateRange(d ? [d[0], d[1]] : [null, null])}
              />
              <Button type="primary" onClick={handleTSearch}>筛选</Button>
              <Button onClick={handleTReset}>重置</Button>
            </Space>
            <Table
              rowKey="id"
              size="small"
              loading={tLoading}
              columns={transactionColumns}
              dataSource={transactionsData.list}
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty description="暂无流水记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
            {transactionsData.total > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBlockStart: 16 }}>
                <Pagination
                  showQuickJumper
                  showSizeChanger
                  current={tPage}
                  pageSize={tPageSize}
                  total={transactionsData.total}
                  pageSizeOptions={['20', '50', '100']}
                  showTotal={(t) => `共 ${t} 条记录`}
                  onChange={(p, ps) => {
                    setTPage(p);
                    if (ps !== tPageSize) { setTPageSize(ps); setTPage(1); }
                  }}
                />
              </div>
            )}
          </ProCard>
        </Space>
      )}
    </div>
  );
};

const UsageStatisticsPage: React.FC = () => (
  <PageContainer>
    <Tabs
      defaultActiveKey="system"
      items={[
        { key: 'system', label: '系统概览', children: <SystemUsageView /> },
        { key: 'user', label: '用户查询', children: <UsageStatsView showSelector /> },
      ]}
    />
  </PageContainer>
);

export default UsageStatisticsPage;
