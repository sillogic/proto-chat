import { Button, message, Space, Typography, Select, FormInstance, Empty } from 'antd';
import { LucideShieldCheck, LucideActivity, LucideAlertCircle } from 'lucide-react';
import { LOBE_DEFAULT_MODEL_LIST } from 'model-bank';
import React, { useState, useEffect } from 'react';
import { Flexbox } from 'react-layout-kit';
import { checkAiProvider, AiProviderConfig } from '@/services/ai-provider';
import { request } from '@umijs/max';

const { Text } = Typography;

interface CheckerProps {
  id: string;
  config?: AiProviderConfig;
  form?: FormInstance;
  apiPrefix?: string;
}

const Checker: React.FC<CheckerProps> = ({ id, config, form, apiPrefix = '/api/admin' }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // 从数据库获取模型列表
  useEffect(() => {
    const fetchModels = async () => {
      setModelsLoading(true);
      console.log(`[AiProviders Checker] Fetching models for provider: ${id}, API: ${apiPrefix}/ai-providers/models?provider=${id}`);

      try {
        const res = await request<{ success: boolean; data: any[] }>(
          `${apiPrefix}/ai-providers/models?provider=${id}`
        );
        console.log(`[AiProviders Checker] API response:`, res);
        if (res.success && res.data) {
          setAvailableModels(res.data);
          console.log(`[AiProviders Checker] Loaded ${res.data.length} models`);
          // 设置默认选中第一个 chat 类型的模型
          const chatModels = res.data.filter((m: any) => m.type === 'chat');
          if (chatModels.length > 0 && !selectedModel) {
            setSelectedModel(chatModels[0].id);
          } else if (res.data.length > 0 && !selectedModel) {
            setSelectedModel(res.data[0].id);
          }
        }
      } catch (error) {
        console.error('[AiProviders Checker] Failed to fetch models:', error);
        // 如果获取失败，降级使用 model-bank
        const bankModels = LOBE_DEFAULT_MODEL_LIST.filter((m: any) => m.providerId === id);
        console.log(`[AiProviders Checker] Fallback to model-bank: ${bankModels.length} models`);
        if (bankModels.length > 0) {
          setAvailableModels(bankModels.map((m: any) => ({
            id: m.id,
            displayName: m.displayName || m.id,
            type: m.type || 'chat',
          })));
          if (!selectedModel) {
            setSelectedModel(bankModels[0].id);
          }
        }
      } finally {
        setModelsLoading(false);
      }
    };

    fetchModels();
  }, [id, apiPrefix]);

  const handleCheck = async () => {
    if (!selectedModel) {
      message.error('请选择要测试的模型');
      return;
    }

    // 准备 keyVaults - 优先使用表单值，其次使用已保存的配置
    let keyVaults: Record<string, any> | undefined;

    if (form) {
      // 从表单获取当前的 API Key 和代理地址
      const formApiKey = form.getFieldValue('apiKey');
      const formProxyUrl = form.getFieldValue('proxyUrl');
      if (formApiKey) {
        keyVaults = {
          apiKey: formApiKey,
          proxyUrl: formProxyUrl,
        };
      }
    }

    // 如果表单没有值，使用已保存的配置（后端会从数据库获取）
    if (!keyVaults && config?.keyVaults?.apiKey) {
      keyVaults = {
        apiKey: config.keyVaults.apiKey,
        proxyUrl: config.keyVaults.proxyUrl,
      };
    }

    // 如果还是没有 API Key，提示用户
    if (!keyVaults?.apiKey) {
      message.error('请先填写并保存 API Key，或直接保存配置后再测试');
      setStatus('error');
      setErrorMsg('缺少 API Key 配置');
      return;
    }

    setLoading(true);
    setStatus('idle');
    setErrorMsg('');
    try {
      const res = await checkAiProvider({
        id,
        model: selectedModel,
        keyVaults,
      });

      if (res.success) {
        setStatus('success');
        message.success('连接测试通过');
      } else {
        setStatus('error');
        const errorMsg = res.message || res.error || '连接测试错误';
        setErrorMsg(errorMsg);
        message.error(errorMsg);
      }
    } catch (e: any) {
      setStatus('error');
      // 提取详细的错误信息
      let errorMessage = '网络连接异常';
      if (e.response?.data) {
        const data = e.response.data;
        errorMessage = data.message || data.error || errorMessage;
      } else if (e.message) {
        errorMessage = e.message;
      }
      console.error('[AiProviders Checker] Connectivity check failed:', e);
      setErrorMsg(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flexbox gap={16}>
      <Flexbox horizontal align="center" justify="space-between">
        <Space>
          {status === 'idle' && <LucideShieldCheck size={20} color="#8c8c8c" />}
          {status === 'success' && <LucideShieldCheck size={20} color="#52c41a" />}
          {status === 'error' && <LucideAlertCircle size={20} color="#ff4d4f" />}
          <Flexbox>
            <Text strong>连通性测试</Text>
            <Text type="secondary">
              {status === 'idle' && '选择模型并测试当前配置是否可正常连接到服务商'}
              {status === 'success' && <span style={{ color: '#52c41a' }}>连接正常</span>}
              {status === 'error' && <span style={{ color: '#ff4d4f' }}>连接失败: {errorMsg}</span>}
            </Text>
          </Flexbox>
        </Space>
      </Flexbox>

      <Flexbox width="100%">
        {modelsLoading ? (
          <Select
            loading
            placeholder="加载模型列表中..."
            style={{ width: '100%' }}
            disabled
          />
        ) : availableModels.length > 0 ? (
          <Space.Compact style={{ width: '100%' }}>
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              placeholder="选择测试模型"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="children"
            >
              {availableModels.map((model: any) => (
                <Select.Option key={model.id} value={model.id}>
                  {model.displayName || model.id}
                </Select.Option>
              ))}
            </Select>
            <Button
              icon={<LucideActivity size={14} />}
              loading={loading}
              onClick={handleCheck}
              type="primary"
              disabled={!selectedModel}
            >
              检查连通性
            </Button>
          </Space.Compact>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="warning">暂无可用模型，请先在下方"模型管理"中同步模型列表</Text>
          </Space>
        )}
      </Flexbox>
    </Flexbox>
  );
};

export default Checker;
