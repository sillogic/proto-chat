import { PlusOutlined } from '@ant-design/icons';
import {
  ActionType,
  ModalForm,
  PageContainer,
  ProColumns,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Button, message, Popconfirm, Tag } from 'antd';
import { useRef, useState } from 'react';

import {
  AiProviderConfig,
  deleteGlobalAiProvider,
  getGlobalAiProviders,
  upsertGlobalAiProvider,
} from '@/services/ai-provider';

const ModelProvidersPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRow, setCurrentRow] = useState<AiProviderConfig>();

  const columns: ProColumns<AiProviderConfig>[] = [
    {
      dataIndex: 'id',
      title: '供应商 ID',
      width: 150,
    },
    {
      dataIndex: 'name',
      render: (text, record) => record.name || record.id.toUpperCase(),
      title: '名称',
      width: 150,
    },
    {
      dataIndex: 'enabled',
      render: (enabled) => (
        <Tag color={enabled ? 'green' : 'red'}>{enabled ? '已启用' : '已禁用'}</Tag>
      ),
      title: '状态',
      width: 100,
    },
    {
      dataIndex: 'updatedAt',
      title: '更新时间',
      valueType: 'dateTime',
      width: 200,
    },
    {
      render: (_, record) => [
        <a
          key="edit"
          onClick={() => {
            setCurrentRow(record);
            setModalVisible(true);
          }}
        >
          编辑
        </a>,
        <Popconfirm
          key="delete"
          onConfirm={async () => {
            const res = await deleteGlobalAiProvider(record.id);
            if (res.success) {
              message.success('删除成功');
              actionRef.current?.reload();
            }
          }}
          title="确定删除此全局配置？这可能会导致主项目相关模型失效。"
        >
          <a style={{ color: 'red' }}>删除</a>
        </Popconfirm>,
      ],
      title: '操作',
      valueType: 'option',
      width: 150,
    },
  ];

  const providerOptions = [
    { label: 'OpenAI', value: 'openai' },
    { label: 'Azure OpenAI', value: 'azure' },
    { label: 'Google Gemini', value: 'google' },
    { label: 'Anthropic Claude', value: 'anthropic' },
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'OpenRouter', value: 'openrouter' },
    { label: 'Gitee AI', value: 'gitee' },
    { label: 'ZhiPu (ChatGLM)', value: 'zhipu' },
    { label: 'Moonshot (Kimi)', value: 'moonshot' },
    { label: 'Groq', value: 'groq' },
    { label: 'TogetherAI', value: 'togetherai' },
    { label: 'Mistral', value: 'mistral' },
    { label: 'Perplexity', value: 'perplexity' },
  ];

  return (
    <PageContainer
      header={{
        breadcrumb: {},
        title: '模型供应商配置',
      }}
    >
      <ProTable<AiProviderConfig>
        actionRef={actionRef}
        columns={columns}
        headerTitle="已配置的全局供应商"
        request={async () => {
          const res = await getGlobalAiProviders();
          return {
            data: res.data || [],
            success: res.success,
          };
        }}
        rowKey="id"
        search={false}
        toolBarRender={() => [
          <Button
            icon={<PlusOutlined />}
            key="button"
            onClick={() => {
              setCurrentRow(undefined);
              setModalVisible(true);
            }}
            type="primary"
          >
            添加全局配置
          </Button>,
        ]}
      />

      <ModalForm
        initialValues={currentRow || { enabled: true, fetchOnClient: false }}
        key={currentRow?.id || 'new'}
        modalProps={{ destroyOnClose: true }}
        onFinish={async (values) => {
          const res = await upsertGlobalAiProvider(values);
          if (res.success) {
            message.success('保存成功');
            actionRef.current?.reload();
            return true;
          }
          return false;
        }}
        onOpenChange={setModalVisible}
        open={modalVisible}
        title={currentRow ? '编辑供应商配置' : '添加供应商配置'}
      >
        <ProFormSelect
          disabled={!!currentRow}
          label="供应商"
          name="id"
          options={providerOptions}
          rules={[{ message: '请选择供应商', required: true }]}
        />
        <ProFormText label="显示名称 (可选)" name="name" placeholder="不填则使用默认名称" />
        <ProFormSwitch label="启用状态" name="enabled" />

        <ProFormText.Password
          label="API Key"
          name={['keyVaults', 'apiKey']}
          placeholder="请输入 API Key"
          rules={[{ message: '请输入 API Key', required: true }]}
        />

        <ProFormText
          label="代理地址 (可选)"
          name={['keyVaults', 'proxyUrl']}
          placeholder="例如: https://api.openai.com/v1"
        />

        <ProFormText label="描述" name="description" placeholder="用于后台备注" />
      </ModalForm>
    </PageContainer>
  );
};

export default ModelProvidersPage;