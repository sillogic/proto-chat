import { PageContainer } from '@ant-design/pro-components';
import {
  Card,
  Form,
  Select,
  Button,
  message,
  Alert,
  Space,
  Typography,
  Spin,
  Descriptions,
} from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import React, { useState, useEffect, useMemo } from 'react';
import {
  getSystemDefaultModelConfig,
  updateSystemDefaultModelConfig,
  type SystemDefaultModelConfig,
} from '@/services/system-default-model';
import { getProtoChatModels, type ProtoChatModel } from '@/services/protochat';

const { Text } = Typography;

const DefaultModelConfigPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SystemDefaultModelConfig | null>(null);
  const [models, setModels] = useState<ProtoChatModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>();

  // 加载配置和模型列表
  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, modelsRes] = await Promise.all([
        getSystemDefaultModelConfig(),
        getProtoChatModels({ enabled: 'true', type: 'chat' }),
      ]);

      if (configRes.success && configRes.data) {
        setConfig(configRes.data);
        form.setFieldsValue({
          modelId: configRes.data.modelId,
        });
        setSelectedModelId(configRes.data.modelId || undefined);
      }

      if (modelsRes.success) {
        setModels(modelsRes.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 获取选中模型的详细信息
  const selectedModel = useMemo(() => {
    if (!selectedModelId) return null;
    return models.find((m) => m.id === selectedModelId);
  }, [selectedModelId, models]);

  // 保存配置
  const handleSave = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();

      if (!values.modelId) {
        message.warning('请选择一个模型');
        return;
      }

      const model = models.find((m) => m.id === values.modelId);
      if (!model) {
        message.error('未找到选中的模型');
        return;
      }

      setSaving(true);
      const res = await updateSystemDefaultModelConfig({
        displayName: model.displayName,
        modelId: model.id,
        providerId: model.originalProvider,
        providerName: model.originalProvider, // 使用供应商ID作为名称
      });

      if (res.success) {
        message.success('默认模型配置已保存');
        await fetchData();
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请选择一个模型');
      } else {
        message.error(error.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  // 模型选项
  const modelOptions = useMemo(() => {
    return models.map((m) => ({
      label: `${m.displayName} (${m.originalProvider})`,
      value: m.id,
    }));
  }, [models]);

  return (
    <PageContainer
      header={{
        breadcrumb: {},
        title: '默认模型配置',
        subTitle: '配置系统默认使用的AI模型',
      }}
    >
      <Spin spinning={loading}>
        <Space direction="vertical" size="large" style={{ display: 'flex' }}>
          {/* 说明信息 */}
          <Alert
            message="默认模型说明"
            description="此处配置的模型将作为系统默认模型使用。只有在ProtoChat中已启用的chat类型模型才会显示在下拉列表中。"
            type="info"
            showIcon
          />

          {/* 配置表单 */}
          <Card title="选择默认模型" bordered={false}>
            <Form form={form} layout="vertical">
              <Form.Item
                label={
                  <Space>
                    <Text strong>默认模型</Text>
                    {models.length > 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        （共 {models.length} 个已启用的chat模型可选）
                      </Text>
                    )}
                  </Space>
                }
                name="modelId"
                rules={[{ required: true, message: '请选择默认模型' }]}
              >
                <Select
                  showSearch
                  placeholder="搜索并选择模型"
                  optionFilterProp="label"
                  onChange={(value) => setSelectedModelId(value)}
                  options={modelOptions}
                  size="large"
                  disabled={models.length === 0}
                  style={{ maxWidth: 600 }}
                />
              </Form.Item>

              {/* 显示选中模型的详细信息 */}
              {selectedModel && (
                <Descriptions
                  title="模型信息"
                  bordered
                  size="small"
                  column={2}
                  style={{ marginBottom: 24 }}
                >
                  <Descriptions.Item label="模型ID">{selectedModel.id}</Descriptions.Item>
                  <Descriptions.Item label="显示名称">{selectedModel.displayName}</Descriptions.Item>
                  <Descriptions.Item label="原始供应商">{selectedModel.originalProvider}</Descriptions.Item>
                  <Descriptions.Item label="原始模型ID">{selectedModel.originalId}</Descriptions.Item>
                  <Descriptions.Item label="上下文长度">
                    {selectedModel.contextTokens ? `${selectedModel.contextTokens.toLocaleString()} tokens` : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="最大输出">
                    {selectedModel.maxOutput ? `${selectedModel.maxOutput.toLocaleString()} tokens` : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    {selectedModel.enabled ? (
                      <Text type="success">已启用</Text>
                    ) : (
                      <Text type="danger">已禁用</Text>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="类型">{selectedModel.type}</Descriptions.Item>
                </Descriptions>
              )}

              <Form.Item>
                <Space size="large">
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    size="large"
                    loading={saving}
                  >
                    保存配置
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={fetchData} size="large">
                    刷新
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>

          {/* 当前配置显示 */}
          {config && config.modelId && (
            <Card title="当前配置" bordered={false}>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="当前默认模型">{config.displayName || config.modelId}</Descriptions.Item>
                <Descriptions.Item label="模型ID">{config.modelId}</Descriptions.Item>
                <Descriptions.Item label="供应商">{config.providerName || config.providerId}</Descriptions.Item>
                <Descriptions.Item label="最后更新">
                  {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Space>
      </Spin>
    </PageContainer>
  );
};

export default DefaultModelConfigPage;
