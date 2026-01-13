import type { ModelPricing } from '@/services/subscription';
import {
  createModelPricing,
  deleteModelPricing,
  getModelPricings,
  syncModelPricings,
  updateModelPricing,
} from '@/services/subscription';
import { getProtoChatSettings } from '@/services/protochat';
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
import { Button, message, Popconfirm, Space, Tag } from 'antd';
import { CloudSyncOutlined, SettingOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';
import MultiplierConfig from './MultiplierConfig';

const ModelPricingManagement: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRow, setCurrentRow] = useState<ModelPricing | null>(null);
  const [multiplierModalVisible, setMultiplierModalVisible] = useState(false);
  const [multiplier, setMultiplier] = useState<number>(1);

  // Fetch multiplier on component mount
  useEffect(() => {
    fetchMultiplier();
  }, []);

  const fetchMultiplier = async () => {
    try {
      const res = await getProtoChatSettings();
      if (res.success) {
        const mult = res.data.pricing_multiplier?.value || 1;
        setMultiplier(mult);
      }
    } catch (error) {
      console.error('Failed to fetch multiplier:', error);
    }
  };

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
        protochat: { text: 'ProtoChat' },
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
      title: '子供应商',
      dataIndex: 'subProvider',
      copyable: true,
      search: false,
      render: (_, record) => {
        if (record.provider === 'protochat' && record.subProvider) {
          return record.subProvider.toUpperCase();
        }
        return '-';
      },
    },
    {
      title: '提示词成本价 (积分/1M Tokens)',
      dataIndex: 'inputPrice',
      valueType: 'digit',
      fieldProps: { precision: 2 },
      render: (_, record) => parseFloat(record.inputPrice as string).toFixed(2),
    },
    {
      title: '补全成本价 (积分/1M Tokens)',
      dataIndex: 'outputPrice',
      valueType: 'digit',
      fieldProps: { precision: 2 },
      render: (_, record) => parseFloat(record.outputPrice as string).toFixed(2),
    },
    {
      title: (
        <Space>
          <span>提示词用户价 (积分/1M Tokens)</span>
          {multiplier !== 1 && <Tag color="green">×{multiplier}</Tag>}
        </Space>
      ),
      dataIndex: 'userInputPrice',
      search: false,
      render: (_, record) => {
        // 直接从数据库读取预先计算好的用户价
        const userPrice = parseFloat(record.userInputPrice as string);
        return <Tag color="green">{userPrice.toFixed(2)}</Tag>;
      },
    },
    {
      title: (
        <Space>
          <span>补全用户价 (积分/1M Tokens)</span>
          {multiplier !== 1 && <Tag color="green">×{multiplier}</Tag>}
        </Space>
      ),
      dataIndex: 'userOutputPrice',
      search: false,
      render: (_, record) => {
        // 直接从数据库读取预先计算好的用户价
        const userPrice = parseFloat(record.userOutputPrice as string);
        return <Tag color="green">{userPrice.toFixed(2)}</Tag>;
      },
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
          <Button
            key="multiplier"
            icon={<SettingOutlined />}
            onClick={() => setMultiplierModalVisible(true)}
          >
            定价系数配置 (当前: ×{multiplier})
          </Button>,
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
            protochat: 'ProtoChat',
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

      <MultiplierConfig
        open={multiplierModalVisible}
        onClose={() => setMultiplierModalVisible(false)}
        onSuccess={() => {
          fetchMultiplier();
          actionRef.current?.reload();
        }}
      />
    </PageContainer>
  );
};

export default ModelPricingManagement;
