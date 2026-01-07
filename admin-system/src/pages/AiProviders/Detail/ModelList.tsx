import { LOBE_DEFAULT_MODEL_LIST, AiModelType } from 'model-bank';
import React, { useState, useMemo } from 'react';
import { Flexbox } from 'react-layout-kit';
import { Typography, Tabs, Badge, Empty, message, Card } from 'antd';
import { AiProviderConfig, upsertGlobalAiProvider } from '@/services/ai-provider';
import ModelItem from './ModelItem';
import { LucideMessageSquare, LucideImage, LucideType, LucideMic, LucideScanEye, LucideRefreshCcw } from 'lucide-react';

const { Title, Text } = Typography;

interface ModelListProps {
  id: string;
  config?: AiProviderConfig;
  onRefresh: () => void;
}

const ModelList: React.FC<ModelListProps> = ({ id, config, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<string>('all');

  const models = useMemo(() => LOBE_DEFAULT_MODEL_LIST.filter((m: any) => m.providerId === id), [id]);

  const enabledModels = useMemo(() => {
    // If settings.enabledModels exists, use it. Otherwise use defaults from model-bank
    if (config?.settings?.enabledModels) {
      return config.settings.enabledModels as string[];
    }
    return models.filter((m: any) => m.enabled).map((m: any) => m.id);
  }, [config?.settings?.enabledModels, models]);

  const filteredModels = useMemo(() => {
    if (activeTab === 'all') return models;
    return models.filter((m: any) => m.type === activeTab);
  }, [models, activeTab]);

  const groups = useMemo(() => {
    const enabled = filteredModels.filter((m: any) => enabledModels.includes(m.id));
    const disabled = filteredModels.filter((m: any) => !enabledModels.includes(m.id));
    return { enabled, disabled };
  }, [filteredModels, enabledModels]);

  const handleToggle = async (modelId: string, enabled: boolean) => {
    let nextEnabledModels = [...enabledModels];
    if (enabled) {
      if (!nextEnabledModels.includes(modelId)) {
        nextEnabledModels.push(modelId);
      }
    } else {
      nextEnabledModels = nextEnabledModels.filter(innerId => innerId !== modelId);
    }

    try {
      const res = await upsertGlobalAiProvider({
        id,
        settings: {
          ...config?.settings,
          enabledModels: nextEnabledModels,
        }
      });
      if (res.success) {
        onRefresh();
      }
    } catch (e) {
      message.error('更新模型状态失败');
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
    <Flexbox horizontal align="center" gap={8}>
      <span>模型列表</span>
      <Text type="secondary" style={{ fontSize: '14px', fontWeight: 'normal' }}>
        共 {models.length} 个模型可用
      </Text>
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
