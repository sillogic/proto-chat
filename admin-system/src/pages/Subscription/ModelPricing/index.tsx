import type { ModelPricing } from '@/services/subscription';
import {
  createModelPricing,
  deleteModelPricing,
  getModelPricings,
  syncModelPricings,
  updateModelPricing,
} from '@/services/subscription';
import {
  ActionType,
  ModalForm,
  PageContainer,
  ProColumns,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space } from 'antd';
import { CloudSyncOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';

const ModelPricingManagement: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRow, setCurrentRow] = useState<ModelPricing | null>(null);

  const handleSync = async () => {
    try {
      const res = await syncModelPricings();
      if (res.success) {
        message.success(`成功同步 ${res.count} 个模型定价`);
        actionRef.current?.reload();
      } else {
        message.error(res.message || '同步失败');
      }
    } catch (error: any) {
      message.error(error.message || '同步出错');
    }
  };

  const columns: ProColumns<ModelPricing>[] = [
    {
      title: '模型标识',
      dataIndex: 'model',
      copyable: true,
      ellipsis: true,
      search: true,
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      copyable: true,
      valueType: 'select',
      valueEnum: {
        openai: { text: 'OpenAI' },
        anthropic: { text: 'Anthropic' },
        google: { text: 'Google' },
        azure: { text: 'Azure' },
        deepseek: { text: 'DeepSeek' },
        zhipu: { text: 'Zhipu' },
        moonshot: { text: 'Moonshot' },
        minimax: { text: 'Minimax' },
        baichuan: { text: 'Baichuan' },
        qwen: { text: 'Qwen' },
        bedrock: { text: 'Bedrock' },
        groq: { text: 'Groq' },
        together: { text: 'Together' },
        mistral: { text: 'Mistral' },
        perplexity: { text: 'Perplexity' },
        novita: { text: 'Novita' },
        openrouter: { text: 'OpenRouter' },
        cloudflare: { text: 'Cloudflare' },
      },
    },
    {
      title: '提示词费率 (积分/1M Tokens)',
      dataIndex: 'inputPrice',
      valueType: 'digit',
      fieldProps: { precision: 2 },
    },
    {
      title: '补全费率 (积分/1M Tokens)',
      dataIndex: 'outputPrice',
      valueType: 'digit',
      fieldProps: { precision: 2 },
    },
    {
      title: '备注',
      dataIndex: 'memo',
      ellipsis: true,
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, record) => (
        <Space>
          <a
            key="edit"
            onClick={() => {
              setCurrentRow(record);
              setModalVisible(true);
            }}
          >
            编辑
          </a>
          <Popconfirm
            key="delete"
            title="确定删除此计费配置吗？"
            onConfirm={async () => {
              const res = await deleteModelPricing(record.id);
              if (res.success) {
                message.success('删除成功');
                actionRef.current?.reload();
              } else {
                message.error('删除失败');
              }
            }}
          >
            <a style={{ color: 'red' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer header={{ title: '模型价格配置' }}>
      <ProTable<ModelPricing>
        columns={columns}
        actionRef={actionRef}
        cardBordered
        request={async (params) => {
          const res = await getModelPricings();
          let data = res.data || [];
          
          // Filter by model and provider if searched
          if (params.model) {
            data = data.filter(item => item.model.toLowerCase().includes(params.model!.toLowerCase()));
          }
          if (params.provider) {
            data = data.filter(item => item.provider === params.provider);
          }

          return {
            data: data,
            success: res.success,
            total: data.length,
          };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 20 }}
        toolBarRender={() => [
          <Popconfirm
            key="sync"
            title="确定要清空并同步已启用供应商的模型定价吗？"
            onConfirm={handleSync}
          >
            <Button
              key="button"
              icon={<CloudSyncOutlined />}
              type="primary"
            >
              初始化/同步模型定价
            </Button>
          </Popconfirm>,
        ]}
      />

      <ModalForm
        title={currentRow ? '编辑模型价格' : '添加模型价格'}
        width="500px"
        open={modalVisible}
        onOpenChange={setModalVisible}
        key={currentRow?.id || 'new'}
        initialValues={currentRow || { inputPrice: 0, outputPrice: 0 }}
        onFinish={async (values) => {
          try {
            if (currentRow) {
              const res = await updateModelPricing(currentRow.id, values);
              if (res.success) {
                message.success('更新成功');
              } else {
                throw new Error(res.message || '更新失败');
              }
            } else {
              const res = await createModelPricing(values);
              if (res.success) {
                message.success('添加成功');
              } else {
                throw new Error(res.message || '添加失败');
              }
            }
            actionRef.current?.reload();
            return true;
          } catch (error: any) {
            message.error(error.message);
            return false;
          }
        }}
      >
        <ProFormText
          name="model"
          label="模型标识"
          placeholder="如: gpt-4o"
          rules={[{ required: true, message: '请输入模型标识' }]}
        />
        <ProFormSelect
          name="provider"
          label="提供商"
          valueEnum={{
            openai: 'OpenAI',
            anthropic: 'Anthropic',
            google: 'Google',
            azure: 'Azure',
            deepseek: 'DeepSeek',
            zhipu: 'Zhipu',
            moonshot: 'Moonshot',
            minimax: 'Minimax',
            baichuan: 'Baichuan',
            qwen: 'Qwen',
            bedrock: 'Bedrock',
            groq: 'Groq',
            together: 'Together',
            mistral: 'Mistral',
            perplexity: 'Perplexity',
            novita: 'Novita',
            openrouter: 'OpenRouter',
            cloudflare: 'Cloudflare',
          }}
          rules={[{ required: true, message: '请选择提供商' }]}
        />
        <ProFormDigit
          name="inputPrice"
          label="提示词费率 (积分 / 1M Tokens)"
          initialValue={0}
          fieldProps={{ precision: 2 }}
          rules={[{ required: true, message: '请输入提示词费率' }]}
        />
        <ProFormDigit
          name="outputPrice"
          label="补全费率 (积分 / 1M Tokens)"
          initialValue={0}
          fieldProps={{ precision: 2 }}
          rules={[{ required: true, message: '请输入补全费率' }]}
        />
        <ProFormTextArea
          name="memo"
          label="备注"
          placeholder="选填，记录调价原因等"
        />
      </ModalForm>
    </PageContainer>
  );
};

export default ModelPricingManagement;
