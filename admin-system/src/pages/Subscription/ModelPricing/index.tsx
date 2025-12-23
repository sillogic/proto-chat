import {
    createModelPricing,
    deleteModelPricing,
    getModelPricings,
    ModelPricing,
    updateModelPricing,
  } from '@/services/subscription';
  import {
    ActionType,
    PageContainer,
    ProColumns,
    ProTable,
  } from '@ant-design/pro-components';
  import { Button, message, Popconfirm } from 'antd';
  import { useRef } from 'react';
  
  const ModelPricingManagement: React.FC = () => {
    const actionRef = useRef<ActionType>();
  
    const columns: ProColumns<ModelPricing>[] = [
      {
        title: '模型标识',
        dataIndex: 'model',
        copyable: true,
        ellipsis: true,
        formItemProps: {
          rules: [{ required: true, message: '必填' }],
        },
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
        },
        formItemProps: {
          rules: [{ required: true, message: '必填' }],
        },
      },
      {
        title: '输入价格 (Credits/1k tokens)',
        dataIndex: 'inputPrice',
        valueType: 'digit',
        fieldProps: { precision: 6, step: 0.001 },
      },
      {
        title: '输出价格 (Credits/1k tokens)',
        dataIndex: 'outputPrice',
        valueType: 'digit',
        fieldProps: { precision: 6, step: 0.001 },
      },
      {
        title: '单次请求价格 (Credits)',
        dataIndex: 'perRequestPrice',
        valueType: 'digit',
        fieldProps: { precision: 6, step: 0.01 },
      },
      {
        title: '操作',
        valueType: 'option',
        render: (text, record, _, action) => [
          <a
            key="editable"
            onClick={() => {
              action?.startEditable?.(record.id);
            }}
          >
            编辑
          </a>,
          <Popconfirm
            key="delete"
            title="确定删除？"
            onConfirm={async () => {
              const res = await deleteModelPricing(record.id);
              if (res.success) {
                message.success('删除成功');
                actionRef.current?.reload();
              }
            }}
          >
            <a style={{ color: 'red' }}>删除</a>
          </Popconfirm>,
        ],
      },
    ];
  
    return (
      <PageContainer header={{ title: '模型价格配置 (系数)' }}>
        <ProTable<ModelPricing>
          columns={columns}
          actionRef={actionRef}
          cardBordered
          request={async () => {
            const res = await getModelPricings();
            return {
              data: res.data || [],
              success: res.success,
              total: res.data?.length || 0,
            };
          }}
          editable={{
            type: 'multiple',
            onSave: async (key, row) => {
               const res = await updateModelPricing(row.id, row);
               if (res.success) {
                 message.success('更新成功');
                 return true;
               }
               return false;
            },
          }}
          rowKey="id"
          search={{ labelWidth: 'auto' }}
          pagination={{ pageSize: 20 }}
          headerTitle="模型系数列表"
          recordCreatorProps={{
              record: () => ({ 
                  id: (Math.random() * 1000000).toFixed(0), 
                  model: 'gpt-4', 
                  provider: 'openai', 
                  inputPrice: 30, 
                  outputPrice: 60, 
                  perRequestPrice: 0 
              }),
              creatorButtonText: '添加模型系数',
              onSave: async (key, row) => {
                   const res = await createModelPricing(row);
                   if (res.success) {
                      message.success('创建成功');
                      return true;
                   }
                   return false;
              }
          }}
        />
      </PageContainer>
    );
  };
  
  export default ModelPricingManagement;
