import { LOBE_DEFAULT_MODEL_LIST, AiModelType } from 'model-bank';
import React, { useState, useMemo, useEffect } from 'react';
import { request } from '@umijs/max';
import { Flexbox } from 'react-layout-kit';
import { Typography, Tabs, Badge, Empty, message, Card, Button, Popconfirm, Input } from 'antd';
import { CloudSyncOutlined, SearchOutlined } from '@ant-design/icons';
import { AiProviderConfig, upsertGlobalAiProvider } from '@/services/ai-provider';
import ModelItem from './ModelItem';
import { LucideMessageSquare, LucideImage, LucideType, LucideMic, LucideScanEye, LucideRefreshCcw } from 'lucide-react';

const { Title, Text } = Typography;

interface ModelListProps {
  id: string;
  config?: AiProviderConfig;
  onRefresh: () => void;
  onSync?: () => void;
  syncing?: boolean;
  lastSyncTime?: string;
  formatLastSync?: (time: string) => string;
}

const ModelList: React.FC<ModelListProps> = ({ id, config, onRefresh, onSync, syncing, lastSyncTime, formatLastSync }) => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [dbModels, setDbModels] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState<string>('');

  // 从数据库获取模型列表
  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      try {
        // ProtoChat使用专用的API查询所有子供应商的模型（不传provider参数）
        const apiPath = id === 'protochat'
          ? `/api/admin/protochat/models`
          : `/api/admin/ai-providers/models?provider=${id}`;

        const res = await request<{ success: boolean; data: any[] }>(apiPath);
        if (res.success && res.data) {
          setDbModels(res.data);
        } else {
          setDbModels([]);
        }
      } catch (error) {
        console.error('Failed to fetch models from DB:', error);
        setDbModels([]);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [id, config]); // 添加 config 作为依赖，同步后会触发 onRefresh，config 会更新

  const models = useMemo(() => {
    // 如果还在加载中，返回空数组
    if (dbModels === null) {
      return [];
    }

    // 优先使用数据库中的模型，如果没有则降级到 model-bank
    if (dbModels.length > 0) {
      return dbModels;
    }

    // Fallback: 从 model-bank 获取
    const filtered = LOBE_DEFAULT_MODEL_LIST.filter((m: any) => m.providerId === id);
    const uniqueMap = new Map();
    filtered.forEach((model: any) => {
      if (!uniqueMap.has(model.id)) {
        uniqueMap.set(model.id, model);
      }
    });
    return Array.from(uniqueMap.values());
  }, [id, dbModels]);

  const enabledModels = useMemo(() => {
    // 统一使用数据库中的 enabled 字段
    return models.filter((m: any) => m.enabled).map((m: any) => m.id);
  }, [models]);

  const filteredModels = useMemo(() => {
    let filtered = models;

    // 按类型过滤
    if (activeTab !== 'all') {
      filtered = filtered.filter((m: any) => m.type === activeTab);
    }

    // 按搜索文本过滤
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      filtered = filtered.filter((m: any) => {
        const displayName = (m.displayName || '').toLowerCase();
        const modelId = (m.id || '').toLowerCase();
        return displayName.includes(searchLower) || modelId.includes(searchLower);
      });
    }

    return filtered;
  }, [models, activeTab, searchText]);

  const groups = useMemo(() => {
    const enabled = filteredModels.filter((m: any) => enabledModels.includes(m.id));
    const disabled = filteredModels.filter((m: any) => !enabledModels.includes(m.id));
    return { enabled, disabled };
  }, [filteredModels, enabledModels]);

  const handleToggle = async (modelId: string, enabled: boolean) => {
    try {
      // ProtoChat使用专用的toggle API直接更新数据库
      if (id === 'protochat') {
        const res = await request<{ success: boolean; data?: { enabled: boolean } }>(
          `/api/admin/protochat/models/${modelId}/toggle`,
          {
            method: 'PUT',
          }
        );
        if (res.success) {
          message.success(`模型已${enabled ? '启用' : '禁用'}`);
          onRefresh();
        }
      } else {
        // 其他供应商使用原有逻辑（settings.enabledModels）
        let nextEnabledModels = [...enabledModels];
        if (enabled) {
          if (!nextEnabledModels.includes(modelId)) {
            nextEnabledModels.push(modelId);
          }
        } else {
          nextEnabledModels = nextEnabledModels.filter(innerId => innerId !== modelId);
        }

        const res = await upsertGlobalAiProvider({
          id,
          enabled: config?.enabled ?? true,
          keyVaults: config?.keyVaults || {},
          settings: {
            ...config?.settings,
            enabledModels: nextEnabledModels,
          }
        });
        if (res.success) {
          onRefresh();
        }
      }
    } catch (e) {
      message.error('更新模型状态失败');
      console.error('Toggle model error:', e);
    }
  };

  const tabs = [
    { key: 'all', label: '全部', icon: null },
    { key: 'chat', label: '对话', icon: <LucideMessageSquare size={14} /> },
    { key: 'image', label: '图片', icon: <LucideImage size={14} /> },
    { key: 'embedding', label: '向量化', icon: <LucideScanEye size={14} /> },
    { key: 'stt', label: 'ASR', icon: <LucideMic size={14} /> },
    { key: 'tts', label: 'TTS', icon: <LucideType size={14} /> },
  ];

  const title = (
    <Flexbox horizontal align="center" justify="space-between" style={{ width: '100%' }}>
      <Flexbox horizontal align="center" gap={8}>
        <span>模型列表</span>
        <Text type="secondary" style={{ fontSize: '14px', fontWeight: 'normal' }}>
          共 {models.length} 个模型可用
        </Text>
      </Flexbox>
      {onSync && (
        <Flexbox horizontal align="center" gap={12}>
          <Input
            placeholder="搜索模型名称或ID"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
          {lastSyncTime && formatLastSync && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              上次同步: {formatLastSync(lastSyncTime)}
            </Text>
          )}
          <Popconfirm
            title={`确定要同步 ${id} 的最新模型列表吗？`}
            description="这将更新模型信息和定价"
            onConfirm={onSync}
          >
            <Button icon={<CloudSyncOutlined />} size="small" type="primary" loading={syncing}>
              同步最新模型列表
            </Button>
          </Popconfirm>
        </Flexbox>
      )}
    </Flexbox>
  );

  return (
    <Card title={title} variant="outlined">
      <Flexbox gap={16}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={tabs.map(tab => ({
            key: tab.key,
            label: (
              <Flexbox horizontal align="center" gap={4}>
                {tab.icon}
                {tab.label}
                <Badge 
                  count={tab.key === 'all' ? models.length : models.filter((m: any) => m.type === tab.key).length} 
                  showZero 
                  color="#eee" 
                  style={{ color: '#999', boxShadow: 'none' }}
                />
              </Flexbox>
            )
          }))}
        />

        <Flexbox gap={24}>
          {groups.enabled.length > 0 && (
            <Flexbox gap={8}>
              <Text type="secondary" strong>已启用</Text>
              <Flexbox>
                {groups.enabled.map((model: any) => (
                  <ModelItem 
                    key={model.id} 
                    model={model} 
                    enabled={true} 
                    onToggle={async (checked: boolean) => handleToggle(model.id, checked)} 
                  />
                ))}
              </Flexbox>
            </Flexbox>
          )}

          {groups.disabled.length > 0 && (
            <Flexbox gap={8}>
              <Text type="secondary" strong>未启用</Text>
              <Flexbox>
                {groups.disabled.map((model: any) => (
                  <ModelItem 
                    key={model.id} 
                    model={model} 
                    enabled={false} 
                    onToggle={async (checked: boolean) => handleToggle(model.id, checked)} 
                  />
                ))}
              </Flexbox>
            </Flexbox>
          )}

          {filteredModels.length === 0 && <Empty description="暂无模型" style={{ marginBlock: 32 }} />}
        </Flexbox>
      </Flexbox>
    </Card>
  );
};

export default ModelList;
