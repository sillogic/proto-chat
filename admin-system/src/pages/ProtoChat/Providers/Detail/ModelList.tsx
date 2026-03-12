import { LOBE_DEFAULT_MODEL_LIST } from 'model-bank';
import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { request } from '@umijs/max';
import { Flexbox } from 'react-layout-kit';
import { Typography, Tabs, Badge, Empty, message, Card, Button, Popconfirm, Input, Skeleton, Pagination } from 'antd';
import { CloudSyncOutlined, SearchOutlined } from '@ant-design/icons';
import type { AiProviderConfig } from '@/services/ai-provider';
import ModelItem from './ModelItem';
import { LucideMessageSquare, LucideImage, LucideType, LucideMic } from 'lucide-react';

const { Text } = Typography;

interface ModelListProps {
  id: string;
  config?: AiProviderConfig;
  onRefresh: () => void;
  apiPrefix?: string;
  onSync?: () => void;
  syncing?: boolean;
  lastSyncTime?: string;
  formatLastSync?: (time: string) => string;
}

// 纯函数，移到组件外避免每次渲染重新创建
const filterByTab = (list: any[], tab: string) => {
  if (tab === 'all') return list;
  if (tab === 'chat') return list.filter((m: any) => m.type === 'chat' && !m.abilities?.imageOutput);
  if (tab === 'image') return list.filter((m: any) => m.type === 'image' || m.abilities?.imageOutput);
  if (tab === 'stt') return list.filter((m: any) => m.type === 'stt' || m.abilities?.audioInput);
  if (tab === 'tts') return list.filter((m: any) => m.type === 'tts' || m.abilities?.audioOutput);
  return list.filter((m: any) => m.type === tab);
};

const TAB_DEFS = [
  { key: 'all',   label: '全部',   icon: null,                        alwaysShow: true },
  { key: 'chat',  label: '对话',   icon: <LucideMessageSquare size={14} />, alwaysShow: true },
  { key: 'image', label: '图片生成', icon: <LucideImage size={14} />,  alwaysShow: false },
  { key: 'stt',   label: '语音识别', icon: <LucideMic size={14} />,   alwaysShow: false },
  { key: 'tts',   label: '语音合成', icon: <LucideType size={14} />,  alwaysShow: false },
];

const ModelList: React.FC<ModelListProps> = ({ id, config, onRefresh, apiPrefix = '/api/admin', onSync, syncing, lastSyncTime, formatLastSync }) => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [dbModels, setDbModels] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const [disabledPage, setDisabledPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      try {
        const res = await request<{ success: boolean; data: any[] }>(
          `${apiPrefix}/models?provider=${id}`
        );
        setDbModels(res.success && res.data ? res.data : []);
      } catch (error) {
        console.error('Failed to fetch models from DB:', error);
        setDbModels([]);
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, [id, apiPrefix, config]);

  const models = useMemo(() => {
    if (dbModels === null) return [];
    if (dbModels.length > 0) return dbModels;
    // Fallback: model-bank
    const filtered = LOBE_DEFAULT_MODEL_LIST.filter((m: any) => m.providerId === id);
    const uniqueMap = new Map();
    filtered.forEach((model: any) => {
      if (!uniqueMap.has(model.id)) uniqueMap.set(model.id, model);
    });
    return Array.from(uniqueMap.values());
  }, [id, dbModels]);

  const enabledSet = useMemo(
    () => new Set(models.filter((m: any) => m.enabled).map((m: any) => m.id)),
    [models],
  );

  // 预计算每个 tab 的数量，badge 和 tab 可见性共用
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: models.length };
    for (const t of TAB_DEFS) {
      if (t.key !== 'all') counts[t.key] = filterByTab(models, t.key).length;
    }
    return counts;
  }, [models]);

  const visibleTabs = useMemo(
    () => TAB_DEFS.filter((t) => t.alwaysShow || tabCounts[t.key] > 0),
    [tabCounts],
  );

  const filteredModels = useMemo(() => {
    setDisabledPage(1);
    let list = filterByTab(models, activeTab);
    if (searchText.trim()) {
      const lower = searchText.toLowerCase().trim();
      list = list.filter(
        (m: any) =>
          (m.displayName || '').toLowerCase().includes(lower) ||
          (m.id || '').toLowerCase().includes(lower),
      );
    }
    return list;
  }, [models, activeTab, searchText]);

  const groups = useMemo(() => {
    const enabled = filteredModels.filter((m: any) => enabledSet.has(m.id));
    const allDisabled = filteredModels.filter((m: any) => !enabledSet.has(m.id));
    const disabledTotal = allDisabled.length;
    const disabledSlice = allDisabled.slice((disabledPage - 1) * PAGE_SIZE, disabledPage * PAGE_SIZE);
    return { enabled, disabled: disabledSlice, disabledTotal };
  }, [filteredModels, enabledSet, disabledPage]);

  const handleTabChange = (key: string) => {
    startTransition(() => setActiveTab(key));
  };

  const handleToggle = async (modelId: string, enabled: boolean) => {
    try {
      const res = await request<{ success: boolean }>(
        `${apiPrefix}/models/${encodeURIComponent(modelId)}/toggle`,
        { method: 'PUT' },
      );
      if (res.success) {
        message.success(`模型已${enabled ? '启用' : '禁用'}`);
        onRefresh();
      }
    } catch {
      message.error('更新模型状态失败');
    }
  };

  const title = (
    <Flexbox horizontal align="center" justify="space-between" style={{ width: '100%' }}>
      <Flexbox horizontal align="center" gap={8}>
        <span>模型列表</span>
        <Text type="secondary" style={{ fontSize: '14px', fontWeight: 'normal' }}>
          共 {models.length} 个模型可用
        </Text>
      </Flexbox>
      <Flexbox horizontal align="center" gap={12}>
        <Input
          placeholder="搜索模型名称或ID"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ width: 200 }}
        />
        {onSync && (
          <>
            {lastSyncTime && formatLastSync && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                上次同步: {formatLastSync(lastSyncTime)}
              </Text>
            )}
            <Popconfirm
              title={`确定要同步 ${id} 的最新模型列表吗？`}
              description="这将更新模型信息、定价和缓存价格（支持Cache的模型将标记⚡）"
              onConfirm={onSync}
            >
              <Button icon={<CloudSyncOutlined />} size="small" type="primary" loading={syncing}>
                同步最新模型列表
              </Button>
            </Popconfirm>
          </>
        )}
      </Flexbox>
    </Flexbox>
  );

  return (
    <Card title={title} variant="outlined">
      <Flexbox gap={16}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={visibleTabs.map((tab) => ({
            key: tab.key,
            label: (
              <Flexbox horizontal align="center" gap={4}>
                {tab.icon}
                {tab.label}
                <Badge
                  count={tabCounts[tab.key] ?? 0}
                  showZero
                  color="#eee"
                  style={{ color: '#999', boxShadow: 'none' }}
                />
              </Flexbox>
            ),
          }))}
        />

        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Flexbox gap={24} style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            {groups.enabled.length > 0 && (
              <Flexbox gap={8}>
                <Text type="secondary" strong>已启用</Text>
                <Flexbox>
                  {groups.enabled.map((model: any) => (
                    <ModelItem
                      key={model.id}
                      model={model}
                      enabled={true}
                      onToggle={(checked: boolean) => handleToggle(model.id, checked)}
                    />
                  ))}
                </Flexbox>
              </Flexbox>
            )}
            {groups.disabledTotal > 0 && (
              <Flexbox gap={8}>
                <Text type="secondary" strong>未启用（{groups.disabledTotal} 个）</Text>
                <Flexbox>
                  {groups.disabled.map((model: any) => (
                    <ModelItem
                      key={model.id}
                      model={model}
                      enabled={false}
                      onToggle={(checked: boolean) => handleToggle(model.id, checked)}
                    />
                  ))}
                </Flexbox>
                {groups.disabledTotal > PAGE_SIZE && (
                  <Flexbox horizontal justify="flex-end" style={{ paddingTop: 8 }}>
                    <Pagination
                      current={disabledPage}
                      pageSize={PAGE_SIZE}
                      total={groups.disabledTotal}
                      onChange={setDisabledPage}
                      showSizeChanger={false}
                      showTotal={(total) => `共 ${total} 个未启用模型`}
                      size="small"
                    />
                  </Flexbox>
                )}
              </Flexbox>
            )}
            {filteredModels.length === 0 && <Empty description="暂无模型" style={{ marginBlock: 32 }} />}
          </Flexbox>
        )}
      </Flexbox>
    </Card>
  );
};

export default ModelList;
