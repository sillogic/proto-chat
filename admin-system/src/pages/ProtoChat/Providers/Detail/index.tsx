import { ActionIcon } from '@lobehub/ui';
import { Button, Card, Divider, Form, Input, message, Switch, Typography, Space, Modal, Descriptions } from 'antd';
// import { TestTube2, CloudSync } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { request } from '@umijs/max';
import { Flexbox } from 'react-layout-kit';
import type { AiProviderConfig } from '@/services/ai-provider';

import Checker from './Checker';
import ModelList from './ModelList';

const { Title, Text } = Typography;

interface ProviderDetailProps {
  id: string;
  config?: AiProviderConfig;
  onRefresh: () => void;
  apiPrefix?: string; // e.g., "/api/admin/protochat"
}

const ProviderDetail: React.FC<ProviderDetailProps> = ({ id, config, onRefresh, apiPrefix = '/api/admin' }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // 格式化上次同步时间
  const formatLastSync = (isoString?: string): string => {
    if (!isoString) return '未同步';

    try {
      const now = new Date();
      const syncTime = new Date(isoString);
      const diffMs = now.getTime() - syncTime.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return `${diffMins}分钟前`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}小时前`;

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}天前`;

      // 超过7天显示具体日期
      return syncTime.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return '未同步';
    }
  };

  const lastSyncTime = config?.settings?.lastSyncedAt as string | undefined;

  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        name: config.name,
        enabled: config.enabled,
        apiKey: config.keyVaults?.apiKey,
        proxyUrl: config.keyVaults?.proxyUrl || config.settings?.baseUrl,
        pricingApiUrl: config.settings?.pricingApiUrl || '',
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ enabled: true });
    }
  }, [config, id, form]);

  const handleTestApi = async () => {
    const apiUrl = form.getFieldValue('pricingApiUrl');
    if (!apiUrl || !apiUrl.trim()) {
      message.error('请先填写在线同步地址');
      return;
    }

    setTesting(true);
    try {
      const res = await request<{ success: boolean; data: any; message: string }>(
        `${apiPrefix}/providers/${id}/test-api`,
        {
          method: 'POST',
          data: { apiUrl },
        }
      );

      if (res.success) {
        Modal.success({
          title: 'API 测试成功',
          width: 600,
          content: (
            <Descriptions column={1} size="small">
              <Descriptions.Item label="总模型数">{res.data.totalModels}</Descriptions.Item>
              <Descriptions.Item label="免费模型">{res.data.freeModels}</Descriptions.Item>
              <Descriptions.Item label="付费模型">{res.data.paidModels}</Descriptions.Item>
              <Descriptions.Item label="响应时间">{res.data.duration}</Descriptions.Item>
              <Descriptions.Item label="适配器">{res.data.adapter}</Descriptions.Item>
              <Descriptions.Item label="模型类型">
                {Object.entries(res.data.modelTypes).map(([type, count]) => `${type}: ${count}`).join(', ')}
              </Descriptions.Item>
            </Descriptions>
          ),
        });
      } else {
        message.error(res.message || 'API 测试失败');
      }
    } catch (error: any) {
      message.error(`API 测试失败: ${error.message || error.data?.message || '未知错误'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    Modal.confirm({
      title: '确认同步',
      content: '确定要同步最新模型列表吗？这将更新模型信息和定价。',
      onOk: async () => {
        setSyncing(true);
        try {
          const res = await request<{ success: boolean; message: string; data: any }>(
            `${apiPrefix}/providers/${id}/sync`,
            {
              method: 'POST',
            }
          );

          if (res.success) {
            message.success(res.message || '同步成功');
            onRefresh();
          } else {
            message.error(res.message || '同步失败');
          }
        } catch (error: any) {
          message.error(`同步失败: ${error.message || error.data?.message || '未知错误'}`);
        } finally {
          setSyncing(false);
        }
      },
    });
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await request<{ success: boolean }>(`${apiPrefix}/ai-providers`, {
        method: 'POST',
        data: {
          id,
          name: values.name,
          enabled: values.enabled,
          keyVaults: {
            apiKey: values.apiKey,
          },
          settings: {
            // 保留原有的 settings，特别是 enabledModels
            ...config?.settings,
            baseUrl: values.proxyUrl,
            pricingApiUrl: values.pricingApiUrl,
          },
        },
      });
      if (res.success) {
        message.success('保存成功');
        onRefresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flexbox gap={24}>
      <Flexbox horizontal align="center" justify="space-between">
        <Title level={3} style={{ margin: 0 }}>{id.toUpperCase()}</Title>
        <Space>
           <Text type="secondary">启用服务商</Text>
           <Switch 
             checked={config?.enabled} 
             onChange={(checked) => onFinish({ ...form.getFieldsValue(), enabled: checked })} 
           />
        </Space>
      </Flexbox>

      <Card title="基础配置" variant="outlined">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ enabled: true }}
        >
          <Form.Item label="API Key" name="apiKey" extra="您的密钥与代理地址等将使用 AES-GCM 加密算法进行加密">
            <Input.Password placeholder={`${id.toUpperCase()} API Key`} />
          </Form.Item>
          <Form.Item label="API 代理地址" name="proxyUrl" extra="必须包含 http(s)://">
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item
            label="在线同步地址"
            extra="填写后可从 API 实时同步模型列表和定价，如: https://openrouter.ai/api/v1/models"
          >
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="pricingApiUrl" noStyle>
                <Input placeholder="例如: https://openrouter.ai/api/v1/models" />
              </Form.Item>
              <Button
                loading={testing}
                onClick={handleTestApi}
              >
                测试
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="显示名称 (可选)" name="name">
            <Input placeholder="如果不填，将使用默认名称" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存配置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="连通性检查" variant="outlined">
        <Checker id={id} config={config} apiPrefix={apiPrefix} />
      </Card>

      <Card title="模型管理" variant="outlined">
        <ModelList
          id={id}
          config={config}
          onRefresh={onRefresh}
          apiPrefix={apiPrefix}
          onSync={handleSync}
          syncing={syncing}
          lastSyncTime={lastSyncTime}
          formatLastSync={formatLastSync}
        />
      </Card>
    </Flexbox>
  );
};

export default ProviderDetail;
