import { ModelIcon } from '@lobehub/icons';
import { Tag, Typography, Tooltip, Space, Switch } from 'antd';
import { LucideVideo, LucideEye, ToyBrick, AtomIcon, LucideGlobe, LucideFileJson } from 'lucide-react';
import { LobeDefaultAiModelListItem } from 'model-bank';
import React from 'react';
import { Flexbox } from 'react-layout-kit';

const { Text, Title } = Typography;

interface ModelItemProps {
  model: LobeDefaultAiModelListItem;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
}

const ModelItem: React.FC<ModelItemProps> = ({ model, enabled, onToggle }) => {
  const { id, displayName, pricing, contextWindowTokens, abilities, releasedAt } = model;

  const formatPricing = () => {
    if (!pricing || !pricing.units) return null;
    
    const inputUnit = pricing.units.find((u: any) => u.name === 'textInput');
    const outputUnit = pricing.units.find((u: any) => u.name === 'textOutput');
    
    if (!inputUnit || !outputUnit) return null;

    const getRate = (unit: any) => {
      if (unit.strategy === 'fixed') return unit.rate;
      if (unit.strategy === 'lookup' && unit.lookup && unit.lookup.prices) {
        const prices = Object.values(unit.lookup.prices) as number[];
        return prices[0] || 0;
      }
      return 0;
    };

    let inputRate = getRate(inputUnit);
    let outputRate = getRate(outputUnit);

    // Convert CNY to USD if needed
    if (pricing.currency === 'CNY') {
      inputRate = inputRate / 7.15;
      outputRate = outputRate / 7.15;
    }

    return {
      input: inputRate.toFixed(2),
      output: outputRate.toFixed(2)
    };
  };

  const formatContextWindow = (tokens?: number) => {
    if (!tokens) return null;
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(0)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return tokens.toString();
  };

  const pricingData = formatPricing();
  const contextTag = formatContextWindow(contextWindowTokens);

  return (
    <Flexbox horizontal align="center" justify="space-between" style={{ paddingBlock: "12px", paddingInline: "0", borderBlockEnd: '1px solid #f0f0f0', opacity: enabled ? 1 : 0.6 }}>
      <Flexbox horizontal align="center" gap={12} flex={1}>
        <ModelIcon model={id} size={32} />
        <Flexbox gap={2}>
          <Flexbox horizontal align="center" gap={8}>
            <Title level={5} style={{ margin: 0, fontSize: '16px', fontWeight: 400 }}>{displayName || id}</Title>
            <Tag color="default" style={{ margin: 0, fontSize: '12px', border: 'none', background: '#f5f5f5', color: '#666' }}>{id}</Tag>
          </Flexbox>
          <Flexbox horizontal gap={4} align="center">
            {releasedAt && (
              <Text type="secondary" style={{ fontSize: '12px' }}>发布于 {releasedAt}</Text>
            )}
            {releasedAt && pricingData && (
              <Text type="secondary" style={{ fontSize: '12px' }}>·</Text>
            )}
            {pricingData && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                输入 ${pricingData.input}/M · 输出 ${pricingData.output}/M
              </Text>
            )}
          </Flexbox>
        </Flexbox>
      </Flexbox>

      <Space size={12} align="center">
        <Space size={4}>
          {abilities?.vision && (
            <Tooltip title="支持视觉识别 (Vision)">
              <Tag color="success" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0, margin: 0, border: 'none' }}>
                <LucideEye size={14} style={{ color: '#52c41a' }} />
              </Tag>
            </Tooltip>
          )}
          {abilities?.functionCall && (
            <Tooltip title="支持函数调用 (Function Call)">
              <Tag color="blue" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0, margin: 0, border: 'none' }}>
                <ToyBrick size={14} style={{ color: '#1677ff' }} />
              </Tag>
            </Tooltip>
          )}
          {abilities?.reasoning && (
            <Tooltip title="支持逻辑推理 (Reasoning)">
              <Tag color="purple" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0, margin: 0, border: 'none' }}>
                <AtomIcon size={14} style={{ color: '#722ed1' }} />
              </Tag>
            </Tooltip>
          )}
          {abilities?.search && (
            <Tooltip title="支持联网搜索 (Search)">
              <Tag color="cyan" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0, margin: 0, border: 'none' }}>
                <LucideGlobe size={14} style={{ color: '#13c2c2' }} />
              </Tag>
            </Tooltip>
          )}
          {abilities?.structuredOutput && (
            <Tooltip title="支持结构化输出 (JSON Mode)">
              <Tag color="orange" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0, margin: 0, border: 'none' }}>
                <LucideFileJson size={14} style={{ color: '#fa8c16' }} />
              </Tag>
            </Tooltip>
          )}
          {abilities?.video && (
            <Tooltip title="支持视频分析/生成 (Video)">
              <Tag color="magenta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0, margin: 0, border: 'none' }}>
                <LucideVideo size={14} style={{ color: '#eb2f96' }} />
              </Tag>
            </Tooltip>
          )}
        </Space>
        
        {contextTag && (
          <Tag style={{ margin: 0, border: 'none', background: '#f5f5f5', color: '#666', fontSize: '11px', paddingInline: '6px' }}>
            {contextTag}
          </Tag>
        )}

        <Switch 
          size="small" 
          checked={enabled} 
          onChange={onToggle} 
        />
      </Space>
    </Flexbox>
  );
};

export default ModelItem;
