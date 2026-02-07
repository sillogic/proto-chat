import { PageContainer } from '@ant-design/pro-components';
import { Layout, Menu, theme } from 'antd';
import { ModelProvider } from 'model-bank';
import React, { useState, useEffect } from 'react';
import { getGlobalAiProviders, AiProviderConfig } from '@/services/ai-provider';

import ProviderGrid from './ProviderGrid';
import ProviderDetail from './Detail';

const { Sider, Content } = Layout;

const AiProvidersPage: React.FC = () => {
  const { token } = theme.useToken();
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [providers, setProviders] = useState<AiProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await getGlobalAiProviders();
      if (res.success) {
        setProviders(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  // 构建未启用供应商列表：包括数据库中 enabled=false 的和不在数据库中的预定义供应商
  const disabledProviders = [
    // 数据库中存在但未启用的
    ...providers.filter((p) => !p.enabled).map((p) => ({
      id: p.id,
      label: p.name || (p.id === 'protochat' ? 'ProtoChat' : p.id.toUpperCase()),
    })),
    // 预定义但不在数据库中的（全新的供应商）
    ...[
      'protochat',
      ModelProvider.OpenAI,
      ModelProvider.DeepSeek,
      ModelProvider.ZhiPu,
      ModelProvider.Google,
      ModelProvider.Anthropic,
      ModelProvider.OpenRouter,
    ]
      .filter((id) => !providers.find((p) => p.id === (id as string)))
      .map((id) => ({
        id: id as string,
        label: id === 'protochat' ? 'ProtoChat' : (id as string).toUpperCase(),
      })),
  ];

  const menuItems: any[] = [
    { key: 'all', label: '全部' },
    { type: 'divider' },
    {
      children: providers
        .filter((p) => p.enabled)
        .map((p) => ({ key: p.id, label: p.name || (p.id === 'protochat' ? 'ProtoChat' : p.id.toUpperCase()) })),
      label: '已启用',
      type: 'group',
    },
    {
      children: disabledProviders.map((item) => ({ key: item.id, label: item.label })),
      label: '未启用',
      type: 'group',
    },
  ];

  return (
    <PageContainer
      header={{
        breadcrumb: {},
        title: 'AI 服务商设置',
      }}
    >
      <Layout style={{ background: token.colorBgContainer, borderRadius: token.borderRadiusLG, overflow: 'hidden' }}>
        <Sider width={250} theme="light" style={{ borderInlineEnd: `1px solid ${token.colorSplit}` }}>
          <Menu
            items={menuItems}
            mode="inline"
            onSelect={({ key }) => setSelectedProvider(key)}
            selectedKeys={[selectedProvider]}
            style={{ borderInlineEnd: 0, height: '100%' }}
          />
        </Sider>
        <Content style={{ background: token.colorBgContainer, minHeight: '600px', padding: '24px' }}>
          {selectedProvider === 'all' ? (
            <ProviderGrid onRefresh={fetchProviders} onSelect={setSelectedProvider} providers={providers} />
          ) : (
            <ProviderDetail 
              config={providers.find(p => p.id === selectedProvider)} 
              id={selectedProvider} 
              onRefresh={fetchProviders} 
            />
          )}
        </Content>
      </Layout>
    </PageContainer>
  );
};

export default AiProvidersPage;
