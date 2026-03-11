import { PageContainer } from '@ant-design/pro-components';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Table,
  message,
  Alert,
  Space,
  Typography,
  Spin,
  Row,
  Col,
  Statistic,
  Modal,
  Divider,
  Tabs,
  Tag,
} from 'antd';
import { SaveOutlined, SyncOutlined, ApiOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import React, { useState, useEffect, useMemo } from 'react';
import {
  getSystemEmbeddingConfig,
  updateSystemEmbeddingConfig,
  getSystemEmbeddingModels,
  syncSystemEmbeddingModels,
  testSystemEmbeddingConnection,
  getMemoryEmbeddingConfig,
  updateMemoryEmbeddingConfig,
  type SystemEmbeddingConfig,
  type SystemEmbeddingModel,
} from '@/services/system-embedding';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Memory Embedding Tab (id='memory') – a simpler standalone form
// ---------------------------------------------------------------------------

const MemoryEmbeddingTab: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<SystemEmbeddingConfig | null>(null);

  const providerOptions = [
    { label: 'OpenRouter', value: 'openrouter' },
    { label: 'SiliconFlow', value: 'siliconflow' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'Cohere', value: 'cohere' },
    { label: 'Jina AI', value: 'jinaai' },
  ];

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await getMemoryEmbeddingConfig();
      if (res.success) {
        setConfig(res.data ?? null);
        if (res.data) {
          form.setFieldsValue({
            providerId: res.data.providerId,
            baseUrl: res.data.baseUrl,
            modelId: res.data.modelId,
            apiKey: res.data.apiKey,
          });
        }
      }
    } catch (e: any) {
      console.error('Failed to load memory embedding config:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const handleSave = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      setSaving(true);
      const res = await updateMemoryEmbeddingConfig(values);
      if (res.success) {
        message.success('记忆Embedding配置保存成功');
        await fetchConfig();
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (e: any) {
      if (e.errorFields) {
        message.error('请填写所有必填项');
      } else {
        message.error(e.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      await form.validateFields(['apiKey', 'baseUrl', 'modelId']);
      const values = form.getFieldsValue();
      if (!values.modelId) { message.warning('请先填写模型ID'); return; }
      setTesting(true);
      const res = await testSystemEmbeddingConnection({
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
        modelId: values.modelId,
      });
      if (res.success && res.data) {
        Modal.success({
          title: '测试成功！',
          width: 500,
          content: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert message="连接配置正确，embedding API工作正常" type="success" showIcon icon={<CheckCircleOutlined />} />
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={8}><Statistic title="响应时间" value={res.data.duration} /></Col>
                <Col span={8}><Statistic title="向量维度" value={res.data.embeddingDimensions} /></Col>
                <Col span={8}><Statistic title="消耗Token" value={res.data.usage?.total_tokens || 0} /></Col>
              </Row>
              <Text type="secondary">模型: {res.data.model}</Text>
            </Space>
          ),
        });
      } else {
        message.error(res.message || '测试失败');
      }
    } catch (e: any) {
      if (e.errorFields) {
        message.error('请填写API Key、Base URL和模型ID');
      } else {
        Modal.error({ title: '测试失败', content: e.message || '无法连接到embedding API' });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size="large" style={{ display: 'flex' }}>
        <Alert
          type="info"
          showIcon
          message="记忆嵌入独立配置"
          description={
            <Space direction="vertical" size={4}>
              <Text>配置专用于用户记忆提取的Embedding模型。与知识库嵌入完全独立，统计数据不会混淆。</Text>
              <Text>若未配置，系统会回落到知识库嵌入配置（id=default）。</Text>
              <Text>记忆提取使用的模型ID需与此处填写的模型ID一致（如 <Text code>qwen/qwen3-embedding-4b</Text>）。</Text>
            </Space>
          }
        />

        <Card title="记忆Embedding供应商与模型配置" bordered={false}>
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="供应商" name="providerId" rules={[{ required: true, message: '请选择供应商' }]}>
                  <Select
                    placeholder="选择供应商"
                    options={providerOptions}
                    onChange={(value) => {
                      if (value === 'openrouter') {
                        form.setFieldsValue({ baseUrl: 'https://openrouter.ai/api/v1' });
                      } else if (value === 'siliconflow') {
                        form.setFieldsValue({ baseUrl: 'https://api.siliconflow.cn/v1' });
                      } else if (value === 'openai') {
                        form.setFieldsValue({ baseUrl: 'https://api.openai.com/v1' });
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Base URL" name="baseUrl" rules={[{ required: true, message: '请输入Base URL' }]}>
                  <Input placeholder="https://openrouter.ai/api/v1" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="模型ID" name="modelId" rules={[{ required: true, message: '请输入模型ID' }]} tooltip="填写供应商侧的模型ID，如 qwen/qwen3-embedding-4b">
                  <Input placeholder="qwen/qwen3-embedding-4b" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={16}>
                <Form.Item label="API Key" name="apiKey" rules={[{ required: true, message: '请输入API Key' }]}>
                  <Input.Password placeholder="输入API Key" size="large" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label=" ">
                  <Button icon={<ApiOutlined />} onClick={handleTest} loading={testing} size="large" block>
                    测试连接
                  </Button>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Space size="large">
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} size="large" loading={saving}>
                  保存记忆Embedding配置
                </Button>
                {config && (
                  <Text type="secondary">
                    当前配置: {config.providerId} / {config.modelId}
                    {config.updatedAt && ` · 更新于 ${new Date(config.updatedAt).toLocaleString()}`}
                  </Text>
                )}
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </Spin>
  );
};

// ---------------------------------------------------------------------------
// Main page (wraps knowledge-base tab + memory tab in Tabs)
// ---------------------------------------------------------------------------

const KnowledgeBaseEmbeddingTab: React.FC = () => {
  const [providerForm] = Form.useForm();
  const [configForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SystemEmbeddingConfig | null>(null);
  const [models, setModels] = useState<SystemEmbeddingModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | undefined>();

  // 加载配置和模型列表
  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, modelsRes] = await Promise.all([
        getSystemEmbeddingConfig(),
        getSystemEmbeddingModels(),
      ]);

      if (configRes.success) {
        setConfig(configRes.data ?? null);
        if (configRes.data) {
          providerForm.setFieldsValue({
            providerId: configRes.data.providerId,
            baseUrl: configRes.data.baseUrl,
            modelsSyncUrl: configRes.data.modelsSyncUrl,
          });
          configForm.setFieldsValue({
            modelId: configRes.data.modelId,
            apiKey: configRes.data.apiKey,
          });
          setSelectedModel(configRes.data.modelId);
        } else {
          // 首次使用，设置默认值
          providerForm.setFieldsValue({
            providerId: 'openrouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            modelsSyncUrl: 'https://openrouter.ai/api/v1/embeddings/models',
          });
        }
      }

      if (modelsRes.success) {
        setModels(modelsRes.data ?? []);
      }
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      // 首次使用时设置默认值
      providerForm.setFieldsValue({
        providerId: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        modelsSyncUrl: 'https://openrouter.ai/api/v1/embeddings/models',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 保存供应商配置
  const handleSaveProvider = async () => {
    try {
      await providerForm.validateFields();
      const providerValues = providerForm.getFieldsValue();

      setSaving(true);
      const res = await updateSystemEmbeddingConfig({
        ...providerValues,
        modelId: config?.modelId || 'placeholder-will-be-replaced',
        apiKey: config?.apiKey,
      });

      if (res.success) {
        message.success('供应商配置已保存');
        await fetchData();
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写完整的供应商配置');
      } else {
        message.error(error.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  // 同步模型列表（不需要API key）
  const handleSync = async () => {
    try {
      await providerForm.validateFields(['providerId', 'modelsSyncUrl']);

      setSyncing(true);

      // 先保存供应商配置（不包含API key）
      const providerValues = providerForm.getFieldsValue();
      await updateSystemEmbeddingConfig({
        ...providerValues,
        modelId: config?.modelId || 'placeholder-will-be-replaced',
        apiKey: config?.apiKey, // 保持原有的API key
      });

      // 再同步模型
      const res = await syncSystemEmbeddingModels();
      if (res.success) {
        message.success(res.message || '同步成功');
        await fetchData();
      } else {
        message.error(res.message || '同步失败');
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请先填写供应商和模型同步地址');
      } else {
        message.error(error.message || '同步失败');
      }
    } finally {
      setSyncing(false);
    }
  };

  // 测试连接
  const handleTest = async () => {
    try {
      await configForm.validateFields(['apiKey']);
      const providerValues = providerForm.getFieldsValue();
      const configValues = configForm.getFieldsValue();

      if (!configValues.modelId) {
        message.warning('请先选择一个模型');
        return;
      }

      setTesting(true);
      const res = await testSystemEmbeddingConnection({
        apiKey: configValues.apiKey,
        baseUrl: providerValues.baseUrl,
        modelId: configValues.modelId,
      });

      if (res.success && res.data) {
        Modal.success({
          title: '测试成功！',
          width: 600,
          content: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="连接配置正确，embedding API工作正常"
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
              />
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={8}>
                  <Statistic title="响应时间" value={res.data.duration} />
                </Col>
                <Col span={8}>
                  <Statistic title="向量维度" value={res.data.embeddingDimensions} />
                </Col>
                <Col span={8}>
                  <Statistic title="消耗Token" value={res.data.usage?.total_tokens || 0} />
                </Col>
              </Row>
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">模型: {res.data.model}</Text>
              </div>
            </Space>
          ),
        });
      } else {
        message.error(res.message || '测试失败');
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写API Key');
      } else {
        Modal.error({
          title: '测试失败',
          content: error.message || '无法连接到embedding API',
        });
      }
    } finally {
      setTesting(false);
    }
  };

  // 保存完整配置
  const handleSave = async () => {
    try {
      await providerForm.validateFields();
      await configForm.validateFields();

      const providerValues = providerForm.getFieldsValue();
      const configValues = configForm.getFieldsValue();

      // 查找选中模型的详细信息
      const selectedModelInfo = models.find((m) => m.modelId === configValues.modelId);

      setLoading(true);
      const res = await updateSystemEmbeddingConfig({
        ...providerValues,
        ...configValues,
        displayName: selectedModelInfo?.displayName,
        inputPrice: selectedModelInfo?.inputPrice,
        contextTokens: selectedModelInfo?.contextTokens,
        dimensions: selectedModelInfo?.dimensions,
      });

      if (res.success) {
        message.success('配置保存成功！主项目将使用此配置生成embeddings');
        await fetchData();
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写完整配置');
      } else {
        message.error(error.message || '保存失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 计算预估美元成本
  const estimatedCost = useMemo(() => {
    if (!selectedModel) return null;

    const model = models.find((m) => m.modelId === selectedModel);
    if (!model || !model.inputPrice) return null;

    // 假设平均chunk大小500 tokens，计算1000个chunks的成本
    const avgChunkTokens = 500;
    const chunksPerBatch = 1000;
    const totalTokens = avgChunkTokens * chunksPerBatch;

    // 计算成本（美元）
    const costUSD = (totalTokens / 1_000_000) * model.inputPrice;

    return {
      costUSD,
      model,
      perChunkUSD: costUSD / chunksPerBatch,
    };
  }, [selectedModel, models]);

  // 模型列表表格列
  const columns = [
    {
      title: '模型ID',
      dataIndex: 'modelId',
      key: 'modelId',
      width: 300,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: '上下文',
      dataIndex: 'contextTokens',
      key: 'contextTokens',
      render: (val: number) => (val ? `${val.toLocaleString()} tokens` : '-'),
      width: 150,
    },
    {
      title: '维度',
      dataIndex: 'dimensions',
      key: 'dimensions',
      width: 100,
    },
    {
      title: '输入价格',
      dataIndex: 'inputPrice',
      key: 'inputPrice',
      render: (val: number) => (val ? `$${val.toFixed(8)}/M tokens` : '-'),
      width: 180,
    },
    {
      title: '最后同步',
      dataIndex: 'syncedAt',
      key: 'syncedAt',
      render: (val: string) => (val ? new Date(val).toLocaleString() : '-'),
      width: 180,
    },
  ];

  // 供应商选项
  const providerOptions = [
    { label: 'OpenRouter', value: 'openrouter' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'Cohere', value: 'cohere' },
    { label: 'Voyage AI', value: 'voyageai' },
    { label: 'Jina AI', value: 'jinaai' },
  ];

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size="large" style={{ display: 'flex' }}>
          {/* Step 1: 供应商配置 */}
          <Card
            title={
              <Space>
                <Text strong>步骤 1: 供应商配置</Text>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>
                  选择供应商并配置同步地址
                </Text>
              </Space>
            }
            bordered={false}
          >
            <Form form={providerForm} layout="vertical">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="供应商"
                    name="providerId"
                    rules={[{ required: true, message: '请选择供应商' }]}
                  >
                    <Select
                      placeholder="选择供应商"
                      options={providerOptions}
                      onChange={(value) => {
                        // 根据供应商自动填充默认值
                        if (value === 'openrouter') {
                          providerForm.setFieldsValue({
                            baseUrl: 'https://openrouter.ai/api/v1',
                            modelsSyncUrl: 'https://openrouter.ai/api/v1/embeddings/models',
                          });
                        } else if (value === 'openai') {
                          providerForm.setFieldsValue({
                            baseUrl: 'https://api.openai.com/v1',
                            modelsSyncUrl: 'https://api.openai.com/v1/models',
                          });
                        }
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Base URL"
                    name="baseUrl"
                    rules={[{ required: true, message: '请输入Base URL' }]}
                    tooltip="Embedding调用的API基础地址"
                  >
                    <Input placeholder="https://openrouter.ai/api/v1" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="模型同步地址"
                    name="modelsSyncUrl"
                    rules={[{ required: true, message: '请输入模型同步地址' }]}
                    tooltip="获取embedding模型列表的API地址（不需要API key）"
                  >
                    <Input placeholder="https://openrouter.ai/api/v1/embeddings/models" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button icon={<SaveOutlined />} onClick={handleSaveProvider} loading={saving}>
                  保存供应商配置
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {/* Step 2: 模型列表 */}
          <Card
            title={
              <Space>
                <Text strong>步骤 2: 同步并选择模型</Text>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>
                  同步模型列表（不需要API key）
                </Text>
              </Space>
            }
            bordered={false}
            extra={
              <Space>
                <Button
                  type="primary"
                  icon={<SyncOutlined />}
                  onClick={handleSync}
                  loading={syncing}
                  size="small"
                >
                  同步模型列表
                </Button>
                <Button icon={<ReloadOutlined />} onClick={fetchData} size="small">
                  刷新
                </Button>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* 选择模型 */}
              <Form form={configForm} layout="vertical">
                <Form.Item
                  label={
                    <Space>
                      <Text strong>选择当前使用的模型</Text>
                      {models.length > 0 && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          （共 {models.length} 个模型可用）
                        </Text>
                      )}
                    </Space>
                  }
                  name="modelId"
                  rules={[{ required: true, message: '请选择模型' }]}
                >
                  <Select
                    showSearch
                    placeholder="搜索并选择模型"
                    optionFilterProp="children"
                    onChange={(value) => setSelectedModel(value)}
                    filterOption={(input, option) =>
                      ((option?.label as string) ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={models.map((m) => ({
                      label: `${m.displayName} - $${m.inputPrice?.toFixed(8) || 0}/M tokens`,
                      value: m.modelId,
                    }))}
                    size="large"
                    disabled={models.length === 0}
                  />
                </Form.Item>
              </Form>

              {/* 预估成本 */}
              {estimatedCost && (
                <Alert
                  type="info"
                  showIcon
                  message={
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Text strong>预估成本（基于平均chunk大小500 tokens）：</Text>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Statistic
                            title="每1000个chunks"
                            value={estimatedCost.costUSD}
                            prefix="$"
                            precision={6}
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="每个chunk"
                            value={estimatedCost.perChunkUSD}
                            prefix="$"
                            precision={8}
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="模型价格"
                            value={estimatedCost.model.inputPrice || 0}
                            prefix="$"
                            suffix="/M tokens"
                            precision={8}
                          />
                        </Col>
                      </Row>
                    </Space>
                  }
                />
              )}

              <Divider />

              {/* 模型列表表格 */}
              <div>
                <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                  所有可用的embedding模型
                  {config?.lastSyncedAt &&
                    ` · 最后同步: ${new Date(config.lastSyncedAt).toLocaleString()}`}
                </Text>
                <Table
                  columns={columns}
                  dataSource={models}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  scroll={{ x: 1000 }}
                  locale={{
                    emptyText: '暂无模型数据，请点击"同步模型列表"按钮',
                  }}
                />
              </div>
            </Space>
          </Card>

          {/* Step 3: API Key和测试 */}
          <Card
            title={
              <Space>
                <Text strong>步骤 3: 配置API Key并测试</Text>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>
                  填写API Key用于调用embedding API
                </Text>
              </Space>
            }
            bordered={false}
          >
            <Form form={configForm} layout="vertical">
              <Alert
                message="API Key用途"
                description="主项目在生成embeddings时会使用此API Key调用选定的embedding模型。建议先测试连接确保配置正确。"
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item
                    label="API Key"
                    name="apiKey"
                    rules={[{ required: true, message: '请输入API Key' }]}
                  >
                    <Input.Password placeholder="输入API Key（如：sk-or-v1-...）" size="large" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label=" ">
                    <Button
                      icon={<ApiOutlined />}
                      onClick={handleTest}
                      loading={testing}
                      size="large"
                      block
                    >
                      测试连接
                    </Button>
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Form.Item>
                <Space size="large">
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    size="large"
                    loading={loading}
                  >
                    保存完整配置
                  </Button>
                  <Text type="secondary">
                    保存后，主项目将使用此配置调用embedding API生成向量
                  </Text>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Space>
      </Spin>
  );
};

const EmbeddingConfigPage: React.FC = () => {
  return (
    <PageContainer
      header={{
        breadcrumb: {},
        title: 'Embedding配置',
        subTitle: '配置全局Embedding模型，用于知识库和记忆提取',
      }}
    >
      <Tabs
        defaultActiveKey="knowledge"
        items={[
          {
            key: 'knowledge',
            label: (
              <Space>
                知识库嵌入
                <Tag color="blue">id=default</Tag>
              </Space>
            ),
            children: <KnowledgeBaseEmbeddingTab />,
          },
          {
            key: 'memory',
            label: (
              <Space>
                记忆嵌入
                <Tag color="purple">id=memory</Tag>
              </Space>
            ),
            children: <MemoryEmbeddingTab />,
          },
        ]}
      />
    </PageContainer>
  );
};

export default EmbeddingConfigPage;
