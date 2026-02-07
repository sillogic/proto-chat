import { ProCard, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Card, Col, Row, Statistic, Tabs } from 'antd';
import { Column } from '@ant-design/plots'; // Using Column for daily trend
import { getUsageStats } from '../../services/credit';

// Define data types based on API response
interface SystemStats {
  overview: {
    totalCost: string;
    totalTokens: number;
    requestCount: number;
    totalStorageBytes: number;
    fileCount: number;
    vectorCount: number;
  };
  dailyTrend: {
    date: string;
    model: string;
    totalTokens: number;
  }[];
  modelStats: {
    model: string;
    totalTokens: number;
    requestCount: number;
    cost: string;
  }[];
  providerStats: {
    provider: string;
    totalTokens: number;
    requestCount: number;
    cost: string;
  }[];
}

export const SystemUsageView: React.FC = () => {
  const { data, loading } = useRequest<{ data: SystemStats }>(async () => {
    const res = await getUsageStats({ userId: 'system_dashboard' });
    return res;
  });
  
  const stats = data as unknown as SystemStats;

  const dailyTrendConfig = {
    data: stats?.dailyTrend || [],
    xField: 'date',
    yField: 'totalTokens',
    colorField: 'model',
    stack: true, // Stacked column chart
    sort: {
      reverse: false,
    },
    axis: {
      y: { labelFormatter: (v: number) => (v / 1000).toFixed(0) + 'k' }
    },
    interaction: {
        tooltip: {
            render: (e: any, { title, items }: { title: string; items: any[] }) => {
                return (
                    <div style={{ padding: 10 }}>
                        <div>{title}</div>
                        {items.map((item: any) => (
                            <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: item.color }}></span>
                                    {item.name}:
                                </span>
                                <span>{Number(item.value).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                );
            }
        }
    }
  };

  const formatStorage = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div>
      <Row gutter={16} wrap={false} style={{ marginBottom: 24 }}>
        <Col flex={1}>
          <Card loading={loading} style={{ height: '100%' }}>
            <Statistic title="本月总预估成本 (USD)" value={stats?.overview?.totalCost} prefix="$" precision={4} />
          </Card>
        </Col>
        <Col flex={1}>
          <Card loading={loading} style={{ height: '100%' }}>
            <Statistic title="本月总 Token 用量" value={stats?.overview?.totalTokens} groupSeparator="," />
          </Card>
        </Col>
        <Col flex={1}>
          <Card loading={loading} style={{ height: '100%' }}>
            <Statistic title="本月总请求数" value={stats?.overview?.requestCount} groupSeparator="," />
          </Card>
        </Col>
        <Col flex={1}>
          <Card loading={loading} style={{ height: '100%' }}>
             <Statistic 
                title="系统文件存储" 
                value={formatStorage(stats?.overview?.totalStorageBytes || 0)} 
                suffix={<span style={{fontSize: 12, color: '#888'}}>({stats?.overview?.fileCount || 0} files)</span>}
            />
          </Card>
        </Col>
        <Col flex={1}>
          <Card loading={loading} style={{ height: '100%' }}>
            <Statistic 
                title="系统向量存储" 
                value={stats?.overview?.vectorCount || 0} 
                suffix={<span style={{fontSize: 12, color: '#888'}}>chunks</span>}
            />
          </Card>
        </Col>
      </Row>

      <ProCard title="每日 Token 用量趋势 (按模型)" headerBordered style={{ marginBottom: 24 }} loading={loading}>
         <div style={{ height: 400 }}>
             <Column {...dailyTrendConfig} />
         </div>
      </ProCard>

      <Row gutter={24}>
        <Col span={14}>
          <ProTable
            headerTitle="模型用量分析"
            rowKey="model"
            loading={loading}
            dataSource={stats?.modelStats || []}
            search={false}
            pagination={false}
            options={false}
            columns={[
              { title: '模型名称', dataIndex: 'model' },
              { title: '总 Token', dataIndex: 'totalTokens', valueType: 'digit' },
              { title: '请求数', dataIndex: 'requestCount', valueType: 'digit' },
              { title: '预估成本 ($)', dataIndex: 'cost', valueType: 'money', render: (_, r) => `$${Number(r.cost).toFixed(4)}` },
            ]}
          />
        </Col>
        <Col span={10}>
          <ProTable
             headerTitle="供应商用量分析"
             rowKey="provider"
             loading={loading}
             dataSource={stats?.providerStats || []}
             search={false}
             pagination={false}
             options={false}
             columns={[
               { title: '供应商', dataIndex: 'provider' },
               { title: '总 Token', dataIndex: 'totalTokens', valueType: 'digit' },
               { title: '预估成本 ($)', dataIndex: 'cost', valueType: 'money', render: (_, r) => `$${Number(r.cost).toFixed(4)}` },
             ]}
          />
        </Col>
      </Row>
    </div>
  );
};
