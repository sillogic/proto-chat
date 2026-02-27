import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Select,
  Space,
  Spin,
  Typography,
  message,
} from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import React, { useEffect, useMemo, useState } from 'react';

import { getVideoCapableModels, type VideoCapableModel } from '@/services/ai-provider';
import {
  getSystemVideoModelConfig,
  updateSystemVideoModelConfig,
  type SystemVideoModelConfig,
} from '@/services/system-video-model';

const { Text } = Typography;

const VideoDefaultModelConfigPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SystemVideoModelConfig | null>(null);
  const [models, setModels] = useState<VideoCapableModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, modelsRes] = await Promise.all([
        getSystemVideoModelConfig(),
        getVideoCapableModels(),
      ]);

      if (configRes.success && configRes.data) {
        setConfig(configRes.data);
        form.setFieldsValue({ modelId: configRes.data.modelId });
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

  const selectedModel = useMemo(() => {
    if (!selectedModelId) return null;
    return models.find((m) => m.id === selectedModelId);
  }, [selectedModelId, models]);

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
      const res = await updateSystemVideoModelConfig({
        displayName: model.displayName,
        modelId: model.id,
        providerId: model.providerId,
        providerName: model.providerId,
      });

      if (res.success) {
        message.success('视频默认模型配置已保存');
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

  const modelOptions = useMemo(() => {
    return models.map((m) => ({
      label: `${m.displayName} (${m.providerId})`,
      value: m.id,
    }));
  }, [models]);

  return (
    <PageContainer
      header={{
        breadcrumb: {},
        subTitle: '配置视频生成功能使用的默认AI模型',
        title: '视频默认模型配置',
      }}
    >
      <Spin spinning={loading}>
        <Space direction="vertical" size="large" style={{ display: 'flex' }}>
          <Alert
            description="此处配置的模型将作为视频生成功能的默认模型使用。列表中显示的是已在子供应商（如 OpenRouter）中同步、且具备视频生成能力（abilities.video=true）的模型，与模型的启用状态无关。保存后主项目视频页面将自动出现该模型。"
            message="视频默认模型说明"
            showIcon
            type="info"
          />

          <Card bordered={false} title="选择视频默认模型">
            <Form form={form} layout="vertical">
              <Form.Item
                label={
                  <Space>
                    <Text strong>视频默认模型</Text>
                    {models.length > 0 && (
                      <Text style={{ fontSize: 12 }} type="secondary">
                        （共 {models.length} 个具备视频能力的模型可选）
                      </Text>
                    )}
                  </Space>
                }
                name="modelId"
                rules={[{ message: '请选择视频默认模型', required: true }]}
              >
                <Select
                  disabled={models.length === 0}
                  onChange={(value) => setSelectedModelId(value)}
                  optionFilterProp="label"
                  options={modelOptions}
                  placeholder={models.length === 0 ? '暂无具备视频能力的模型，请先在子供应商中同步模型' : '搜索并选择模型'}
                  showSearch
                  size="large"
                  style={{ maxWidth: 600 }}
                />
              </Form.Item>

              {selectedModel && (
                <Descriptions
                  bordered
                  column={2}
                  size="small"
                  style={{ marginBottom: 24 }}
                  title="模型信息"
                >
                  <Descriptions.Item label="模型ID">{selectedModel.id}</Descriptions.Item>
                  <Descriptions.Item label="显示名称">{selectedModel.displayName}</Descriptions.Item>
                  <Descriptions.Item label="所属供应商">{selectedModel.providerId}</Descriptions.Item>
                  <Descriptions.Item label="视频能力">
                    <Text type="success">已具备</Text>
                  </Descriptions.Item>
                </Descriptions>
              )}

              <Form.Item>
                <Space size="large">
                  <Button
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={handleSave}
                    size="large"
                    type="primary"
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

          {config && config.modelId && (
            <Card bordered={false} title="当前配置">
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="当前视频默认模型">
                  {config.displayName || config.modelId}
                </Descriptions.Item>
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

export default VideoDefaultModelConfigPage;
