import React, { useState, useEffect } from 'react';
import { request } from '@umijs/max';
import { Card, Tabs, Typography, Badge, Empty, message, Spin } from 'antd';
import { Flexbox } from 'react-layout-kit';
import ModelList from '../../ProtoChat/Providers/Detail/ModelList';

const { Text } = Typography;

interface ProtoChatProvider {
  id: string;
  name: string;
  enabled: boolean;
  keyVaults?: {
    apiKey?: string;
    proxyUrl?: string;
  };
  settings?: {
    baseUrl?: string;
    pricingSyncStrategy?: string;
    lastSyncedAt?: string;
  };
}

interface ProtoChatModelListProps {
  onRefresh: () => void;
}

const ProtoChatModelList: React.FC<ProtoChatModelListProps> = ({ onRefresh }) => {
  const [providers, setProviders] = useState<ProtoChatProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await request<{ data: ProtoChatProvider[]; success: boolean }>(
        '/api/admin/protochat/ai-providers',
        {
          method: 'GET',
        }
      );
      if (res.success) {
        const enabledProviders = res.data.filter((p) => p.enabled);
        setProviders(enabledProviders);

        // Set first provider as active tab
        if (enabledProviders.length > 0 && !activeTab) {
          setActiveTab(enabledProviders[0].id);
        }
      }
    } catch (error) {
      message.error('获取ProtoChat子供应商列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  if (loading) {
    return (
      <Card variant="outlined">
        <Flexbox align="center" justify="center" style={{ minHeight: 400 }}>
          <Spin size="large" />
        </Flexbox>
      </Card>
    );
  }

  if (providers.length === 0) {
    return (
      <Card title="ProtoChat 模型列表" variant="outlined">
        <Empty
          description={
            <Flexbox gap={8}>
              <Text type="secondary">暂无已启用的子供应商</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                请前往 ProtoChat 管理后台启用并配置子供应商（OpenRouter、DeepSeek 等）
              </Text>
            </Flexbox>
          }
          style={{ marginBlock: 64 }}
        />
      </Card>
    );
  }

  const tabItems = providers.map((provider) => {
    // 构建一个兼容的config对象，用于ModelList组件
    const providerConfig = {
      id: provider.id,
      name: provider.name,
      enabled: true,
      fetchOnClient: false,
      isGlobal: true,
      // 使用从后端获取的 keyVaults，保留 API Key
      keyVaults: provider.keyVaults || {},
      settings: provider.settings || {},
      config: {},
    };

    return {
      key: provider.id,
      label: (
        <Flexbox horizontal align="center" gap={8}>
          <span>{provider.name || provider.id.toUpperCase()}</span>
        </Flexbox>
      ),
      children: (
        <ModelList
          id={provider.id}
          config={providerConfig}
          onRefresh={() => {
            fetchProviders();
            onRefresh();
          }}
          apiPrefix="/api/admin/protochat"
        />
      ),
    };
  });

  return (
    <Card
      title={
        <Flexbox horizontal align="center" gap={8}>
          <span>ProtoChat 模型列表</span>
          <Text type="secondary" style={{ fontSize: '14px', fontWeight: 'normal' }}>
            共 {providers.length} 个子供应商
          </Text>
        </Flexbox>
      }
      variant="outlined"
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
    </Card>
  );
};

export default ProtoChatModelList;
