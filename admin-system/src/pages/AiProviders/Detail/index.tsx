import { ActionIcon } from '@lobehub/ui';
import { Button, Card, Divider, Form, Input, message, Switch, Typography, Space } from 'antd';
import { LucideShieldCheck, LucideRefreshCcw } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Flexbox } from 'react-layout-kit';
import { AiProviderConfig, upsertGlobalAiProvider, checkAiProvider } from '@/services/ai-provider';

import Checker from './Checker';
import ModelList from './ModelList';

const { Title, Text } = Typography;

interface ProviderDetailProps {
  id: string;
  config?: AiProviderConfig;
  onRefresh: () => void;
}

const ProviderDetail: React.FC<ProviderDetailProps> = ({ id, config, onRefresh }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        name: config.name,
        enabled: config.enabled,
        apiKey: config.keyVaults?.apiKey,
        proxyUrl: config.keyVaults?.proxyUrl,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ enabled: true });
    }
  }, [config, id]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await upsertGlobalAiProvider({
        id,
        name: values.name,
        enabled: values.enabled,
        keyVaults: {
          apiKey: values.apiKey,
          proxyUrl: values.proxyUrl,
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
        <Checker id={id} config={config} />
      </Card>



      <ModelList id={id} config={config} onRefresh={onRefresh} />
    </Flexbox>
  );
};

export default ProviderDetail;
