import { Button, message, Space, Typography, Select, FormInstance } from 'antd';
import { LucideShieldCheck, LucideActivity, LucideAlertCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { request } from '@umijs/max';
import { Flexbox } from 'react-layout-kit';
import type { AiProviderConfig } from '@/services/ai-provider';

const { Text } = Typography;

interface CheckerProps {
  id: string;
  config?: AiProviderConfig;
  apiPrefix?: string;
  form?: FormInstance;
}

const Checker: React.FC<CheckerProps> = ({ id, config, apiPrefix = '/api/admin', form }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);

  // 从数据库获取模型列表
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await request<{ success: boolean; data: any[] }>(
          `${apiPrefix}/models?provider=${id}`
        );
        if (res.success && res.data) {
          setAvailableModels(res.data);
          // 设置默认选中第一个 chat 类型的模型
          const chatModels = res.data.filter((m: any) => m.type === 'chat');
          if (chatModels.length > 0 && !selectedModel) {
            setSelectedModel(chatModels[0].id);
          } else if (res.data.length > 0 && !selectedModel) {
            setSelectedModel(res.data[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };

    fetchModels();
  }, [id, apiPrefix, config]); // 添加 config 作为依赖，同步后会更新

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
        proxyUrl: config.keyVaults.proxyUrl || config.settings?.baseUrl,
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
    try {
      // 获取选中的模型对象，包含 originalId
      const selectedModelObj = availableModels.find((m: any) => m.id === selectedModel);

      const res = await request<{ success: boolean; message?: string; error?: any }>(`${apiPrefix}/ai-providers/check`, {
        method: 'POST',
        data: {
          id,
          model: selectedModel,
          originalId: selectedModelObj?.originalId,
          keyVaults,
        },
      });

      if (res.success) {
        setStatus('success');
        message.success('连接测试通过');
      } else {
        setStatus('error');
        setErrorMsg(res.message || '连接测试错误');
      }
    } catch (e: any) {
      setStatus('error');
      const errorMessage = e.response?.data?.message || e.message || '网络连接异常';
      setErrorMsg(errorMessage);
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

      <Flexbox horizontal align="center" gap={8}>
        <Select
          value={selectedModel}
          onChange={setSelectedModel}
          placeholder="选择测试模型"
          style={{ flex: 1 }}
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
          disabled={!selectedModel || availableModels.length === 0}
        >
          检查连通性
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

export default Checker;
