import { ModelIcon } from '@lobehub/icons';
import { Card, Col, Row, Switch, Typography, Empty, message } from 'antd';
import { ModelProvider } from 'model-bank';
import React from 'react';
import { Flexbox } from 'react-layout-kit';
import { AiProviderConfig, upsertGlobalAiProvider } from '@/services/ai-provider';

const { Title, Paragraph } = Typography;

interface ProviderGridProps {
  providers: AiProviderConfig[];
  onRefresh: () => void;
  onSelect: (id: string) => void;
}

const ALL_TARGET_PROVIDERS = [
  { id: 'protochat', desc: 'ProtoChat 是本系统的统一计费网关，聚合多个底层供应商（OpenRouter、DeepSeek等），为用户提供统一的积分计费服务。' },
  { id: ModelProvider.OpenAI, desc: 'OpenAI 是全球领先的人工智能研究机构，其开发的模型如 GPT 系列推动了自然语言处理的发展。' },
  { id: ModelProvider.DeepSeek, desc: 'DeepSeek 是一家专注于人工智能模型研发的中国公司，其推出的 DeepSeek-V3 等模型在多项评测中表现优异。' },
  { id: ModelProvider.ZhiPu, desc: '智谱 AI 提供多模态与语言模型的开放平台，支持广泛的 AI 应用场景。' },
  { id: ModelProvider.Google, desc: 'Google 的 Gemini 系列是其最先进的多模态模型，具有强大的理解和生成能力。' },
  { id: ModelProvider.Anthropic, desc: 'Anthropic 是一家专注于安全性和可解释性 AI 的公司，其 Claude 系列模型深受用户喜爱。' },
  { id: ModelProvider.OpenRouter, desc: 'OpenRouter 是一个 AI 模型聚合平台，提供统一的 API 接口访问多个主流 AI 模型，包括 GPT、Claude、Gemini 等。' },
];

const ProviderGrid: React.FC<ProviderGridProps> = ({ providers, onRefresh, onSelect }) => {
  const handleToggle = async (id: string, enabled: boolean, e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    e.stopPropagation();
    const res = await upsertGlobalAiProvider({ id, enabled });
    if (res.success) {
      message.success(`${enabled ? '启用' : '禁用'}成功`);
      onRefresh();
    }
  };

  const renderProviderCard = (providerId: string, name?: string, desc?: string, enabled = false) => (
    <Col xs={24} sm={12} md={8} lg={6} key={providerId}>
      <Card
        hoverable
        onClick={() => onSelect(providerId)}
        style={{ height: '100%', borderRadius: '12px' }}
        bodyStyle={{ padding: '20px' }}
      >
        <Flexbox gap={16}>
          <Flexbox horizontal align="center" justify="space-between">
            <ModelIcon model={providerId} size={40} />
            <Switch 
              checked={enabled} 
              size="small" 
              onClick={(_, e) => handleToggle(providerId, !enabled, e)} 
            />
          </Flexbox>
          <Flexbox gap={4}>
            <Title level={5} style={{ margin: 0 }}>{name || providerId.toUpperCase()}</Title>
            <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ fontSize: '12px', marginBlockEnd: 0 }}>
              {desc || '暂无描述'}
            </Paragraph>
          </Flexbox>
        </Flexbox>
      </Card>
    </Col>
  );

  const enabledProviders = providers.filter(p => p.enabled);
  const otherProviders = ALL_TARGET_PROVIDERS.filter(tp => !providers.find(p => p.id === tp.id && p.enabled));

  return (
    <Flexbox gap={32}>
      {enabledProviders.length > 0 && (
        <Flexbox gap={16}>
          <Title level={4}>已启用服务商 ({enabledProviders.length})</Title>
          <Row gutter={[16, 16]}>
            {enabledProviders.map(p => {
              const displayName = p.name || (p.id === 'protochat' ? 'ProtoChat' : undefined);
              return renderProviderCard(p.id, displayName, p.description, true);
            })}
          </Row>
        </Flexbox>
      )}

      <Flexbox gap={16}>
        <Title level={4}>未启用服务商</Title>
        <Row gutter={[16, 16]}>
          {otherProviders.map(tp => {
            const config = providers.find(p => p.id === tp.id);
            const displayName = config?.name || (tp.id === 'protochat' ? 'ProtoChat' : undefined);
            return renderProviderCard(tp.id, displayName, tp.desc, config?.enabled);
          })}
        </Row>
      </Flexbox>
    </Flexbox>
  );
};

export default ProviderGrid;
