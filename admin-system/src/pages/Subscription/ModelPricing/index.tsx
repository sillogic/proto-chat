import type { ModelPricing } from '@/services/subscription';
import {
  createModelPricing,
  deleteModelPricing,
  getModelPricings,
  syncImageOutputPricings,
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
import { Alert, Button, message, Popconfirm, Space, Tag, Tabs, Tooltip, Typography } from 'antd';
import { CloudSyncOutlined, SettingOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';
import MultiplierConfig from './MultiplierConfig';

const { Text } = Typography;

// 1 USD = 500,000 Credits
const CREDITS_PER_USD = 500000;

/** 从 model ID 派生可读名称（去掉日期版本后缀） */
const getModelDisplayName = (modelId: string) => {
  return modelId
    .replace(/-\d{4}-\d{2}-\d{2}$/, '') // remove -YYYY-MM-DD
    .replace(/-\d{8}$/, '');             // remove -YYYYMMDD
};

/** credits/1M tokens → USD/1M tokens */
const creditsToUSD = (credits: number | string | undefined | null): number => {
  const c = parseFloat(credits as string) || 0;
  return c / CREDITS_PER_USD;
};

const formatUSD = (usd: number) => {
  if (usd === 0) return '$0';
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(6)}`;
};

const ModelPricingManagement: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRow, setCurrentRow] = useState<ModelPricing | null>(null);
  const [multiplierModalVisible, setMultiplierModalVisible] = useState(false);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<string>('token');

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

  const handleSyncImageOutput = async () => {
    try {
      const res = await syncImageOutputPricings();
      if (res.success) {
        const failedCount = res.failed?.length ?? 0;
        if (failedCount > 0) {
          message.warning(`同步完成：更新 ${res.updated} 个模型，${failedCount} 个失败`);
        } else {
          message.success(`成功同步 ${res.updated} 个图片生成模型的输出定价`);
        }
        actionRef.current?.reload();
      } else {
        message.error('同步图片生成价格失败');
      }
    } catch (error: any) {
      message.error(error.message || '同步出错');
    }
  };


  // 前两列：模型名（冻结）+ 模型标识
  const modelColumns: ProColumns<ModelPricing>[] = [
    {
      title: '模型名',
      dataIndex: 'displayName',
      fixed: 'left',
      width: 180,
      search: false,
      render: (_, record) => {
        const name = (record as any).displayName || getModelDisplayName(record.model);
        return (
          <Tooltip title={record.model}>
            <Text strong style={{ whiteSpace: 'nowrap' }}>
              {name}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: '模型标识',
      dataIndex: 'model',
      key: 'modelId',
      copyable: true,
      ellipsis: true,
      width: 240,
      search: true,
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      width: 120,
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
      width: 110,
      search: false,
      render: (_, record) => {
        if (record.provider === 'protochat' && record.subProvider) {
          return record.subProvider.toUpperCase();
        }
        return '-';
      },
    },
  ];

  // Token 模型列（对账优先：USD成本紧跟积分成本，最后用户价）
  const tokenColumns: ProColumns<ModelPricing>[] = [
    ...modelColumns,
    {
      title: '输入成本(USD)',
      dataIndex: 'inputPrice',
      key: 'inputPriceUSD',
      width: 120,
      search: false,
      render: (_, record) => (
        <Text type="secondary">{formatUSD(creditsToUSD(record.inputPrice))}</Text>
      ),
    },
    {
      title: '输入成本(积分)',
      dataIndex: 'inputPrice',
      width: 110,
      search: false,
      render: (_, record) => Math.round(parseFloat(record.inputPrice as string)),
    },
    {
      title: '输出成本(USD)',
      dataIndex: 'outputPrice',
      key: 'outputPriceUSD',
      width: 120,
      search: false,
      render: (_, record) => (
        <Text type="secondary">{formatUSD(creditsToUSD(record.outputPrice))}</Text>
      ),
    },
    {
      title: '输出成本(积分)',
      dataIndex: 'outputPrice',
      width: 110,
      search: false,
      render: (_, record) => Math.round(parseFloat(record.outputPrice as string)),
    },
    {
      title: 'Cache成本(USD)',
      dataIndex: 'cacheReadPrice',
      key: 'cacheReadPriceUSD',
      width: 125,
      search: false,
      render: (_, record) => {
        const usd = creditsToUSD((record as any).cacheReadPrice);
        return usd > 0 ? <Text type="secondary">{formatUSD(usd)}</Text> : '-';
      },
    },
    {
      title: 'Cache成本(积分)',
      dataIndex: 'cacheReadPrice',
      key: 'cacheReadPrice',
      width: 115,
      search: false,
      render: (_, record) => {
        const price = Math.round(parseFloat((record as any).cacheReadPrice || '0'));
        return price > 0 ? price : '-';
      },
    },
    {
      title: (
        <Space size={4}>
          <span>用户输入(积分)</span>
          {multiplier !== 1 && <Tag color="green">×{multiplier}</Tag>}
        </Space>
      ),
      dataIndex: 'userInputPrice',
      width: 130,
      search: false,
      render: (_, record) => (
        <Tag color="green">{Math.round(parseFloat(record.userInputPrice as string))}</Tag>
      ),
    },
    {
      title: (
        <Space size={4}>
          <span>用户输出(积分)</span>
          {multiplier !== 1 && <Tag color="green">×{multiplier}</Tag>}
        </Space>
      ),
      dataIndex: 'userOutputPrice',
      width: 130,
      search: false,
      render: (_, record) => (
        <Tag color="green">{Math.round(parseFloat(record.userOutputPrice as string))}</Tag>
      ),
    },
    {
      title: (
        <Space size={4}>
          <span>用户Cache(积分)</span>
          {multiplier !== 1 && <Tag color="gold">×{multiplier}</Tag>}
        </Space>
      ),
      dataIndex: 'userCacheReadPrice',
      width: 135,
      search: false,
      render: (_, record) => {
        const price = Math.round(parseFloat((record as any).userCacheReadPrice || '0'));
        return price > 0 ? <Tag color="gold">{price}</Tag> : '-';
      },
    },
    {
      title: '备注',
      dataIndex: 'memo',
      width: 150,
      ellipsis: true,
      search: false,
    },
  ];

  // 图片模型列
  const imageColumns: ProColumns<ModelPricing>[] = [
    ...modelColumns,
    {
      title: '图片输出成本价 (积分/1M)',
      dataIndex: 'imageOutputPrice',
      width: 210,
      valueType: 'digit',
      fieldProps: { precision: 2 },
      render: (_, record) => {
        const price = parseFloat(record.imageOutputPrice as string || '0');
        return price > 0 ? price.toFixed(2) : '-';
      },
    },
    {
      title: '图片输出成本价 (USD/1M)',
      dataIndex: 'imageOutputPrice',
      key: 'imageOutputPriceUSD',
      width: 210,
      search: false,
      render: (_, record) => {
        const usd = creditsToUSD(record.imageOutputPrice);
        return usd > 0 ? <Text type="secondary">{formatUSD(usd)}</Text> : '-';
      },
    },
    {
      title: (
        <Space>
          <span>图片输出用户价 (积分/1M)</span>
          {multiplier !== 1 && <Tag color="green">×{multiplier}</Tag>}
        </Space>
      ),
      dataIndex: 'userImageOutputPrice',
      width: 230,
      search: false,
      render: (_, record) => {
        const price = parseFloat(record.userImageOutputPrice as string || '0');
        return price > 0 ? <Tag color="green">{price.toFixed(2)}</Tag> : '-';
      },
    },
    {
      title: '备注',
      dataIndex: 'memo',
      width: 160,
      ellipsis: true,
      search: false,
    },
  ];

  const toolBarRenderToken = () => [
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
      <Button icon={<CloudSyncOutlined />} type="primary">
        初始化/同步模型定价
      </Button>
    </Popconfirm>,
  ];

  const toolBarRenderImage = () => [
    <Button
      key="multiplier"
      icon={<SettingOutlined />}
      onClick={() => setMultiplierModalVisible(true)}
    >
      定价系数配置 (当前: ×{multiplier})
    </Button>,
    <Popconfirm
      key="sync-image-output"
      title="从 OpenRouter 同步图片生成模型的 image_output 定价？"
      description="需要先完成「初始化/同步模型定价」，再执行此操作。"
      onConfirm={handleSyncImageOutput}
    >
      <Button icon={<CloudSyncOutlined />}>同步图片生成价格</Button>
    </Popconfirm>,
  ];

  return (
    <PageContainer header={{ title: '模型价格配置' }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={
          <Space size="large">
            <span>
              积分汇率：<Tag color="blue">1 USD = {CREDITS_PER_USD.toLocaleString()} 积分</Tag>
            </span>
            <span style={{ color: '#8c8c8c', fontSize: 12 }}>
              表中「USD/1M」列由积分价格除以 {CREDITS_PER_USD.toLocaleString()} 自动换算，仅供对账参考
            </span>
          </Space>
        }
      />
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'token',
            label: '全部',
            children: (
              <ProTable<ModelPricing>
                columns={tokenColumns}
                actionRef={actionRef}
                cardBordered
                scroll={{ x: 'max-content' }}
                request={async (params) => {
                  const res = await getModelPricings();
                  let data = res.data || [];
                  if (params.model) {
                    data = data.filter(item => item.model.toLowerCase().includes(params.model!.toLowerCase()));
                  }
                  if (params.provider) {
                    data = data.filter(item => item.provider === params.provider);
                  }
                  return { data, success: res.success, total: data.length };
                }}
                rowKey="id"
                search={{ labelWidth: 'auto' }}
                pagination={{ pageSize: 20 }}
                toolBarRender={toolBarRenderToken}
              />
            ),
          },
          {
            key: 'image',
            label: '图片生成模型',
            children: (
              <ProTable<ModelPricing>
                columns={imageColumns}
                actionRef={actionRef}
                cardBordered
                scroll={{ x: 'max-content' }}
                request={async (params) => {
                  const res = await getModelPricings();
                  let data = res.data || [];
                  data = data.filter(item =>
                    (item.memo && item.memo.startsWith('[auto-image]')) ||
                    (item.imageOutputPrice && parseFloat(item.imageOutputPrice) > 0) ||
                    (item.perRequestPrice && parseFloat(item.perRequestPrice) > 0)
                  );
                  if (params.model) {
                    data = data.filter(item => item.model.toLowerCase().includes(params.model!.toLowerCase()));
                  }
                  if (params.provider) {
                    data = data.filter(item => item.provider === params.provider);
                  }
                  return { data, success: res.success, total: data.length };
                }}
                rowKey="id"
                search={{ labelWidth: 'auto' }}
                pagination={{ pageSize: 20 }}
                toolBarRender={toolBarRenderImage}
              />
            ),
          },
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
        {(!currentRow || (!currentRow.perRequestPrice || parseFloat(currentRow.perRequestPrice) === 0)) && (
          <>
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
          </>
        )}
        {(!currentRow || (currentRow.perRequestPrice && parseFloat(currentRow.perRequestPrice) > 0)) && (
          <ProFormDigit
            name="perRequestPrice"
            label="按次计费 (积分 / 次)"
            initialValue={0}
            fieldProps={{ precision: 2 }}
            tooltip="用于图片生成等按次计费的模型。如果大于0，则忽略Token费率"
          />
        )}
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
