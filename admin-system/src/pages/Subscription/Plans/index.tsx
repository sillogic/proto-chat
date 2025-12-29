import {
  createPlan,
  deletePlan,
  getPlans,
  SubscriptionPlan,
  updatePlan,
} from '@/services/subscription';
import {
  ActionType,
  PageContainer,
  ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Button, message, Popconfirm } from 'antd';
import { useRef, useState } from 'react';

const PlanManagement: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [editingPlan, setEditingPlan] = useState<Partial<SubscriptionPlan> | null>(null);

  const columns: ProColumns<SubscriptionPlan>[] = [
    {
      title: '方案名称',
      dataIndex: 'name',
      copyable: true,
      ellipsis: true,
      formItemProps: {
        rules: [{ required: true, message: '此项为必填项' }],
      },
    },
    {
      title: '标识 (Slug)',
      dataIndex: 'slug',
      copyable: true,
      ellipsis: true,
      search: false,
      formItemProps: {
        rules: [{ required: true, message: '此项为必填项' }],
      },
    },
    {
      title: '类型',
      dataIndex: 'type',
      valueEnum: {
        individual: { text: '个人', status: 'Success' },
        team: { text: '团队', status: 'Processing' },
      },
      formItemProps: {
        rules: [{ required: true, message: '此项为必填项' }],
      },
    },
    {
      title: '价格 (分)',
      dataIndex: 'price',
      valueType: 'money',
      search: false,
      render: (_, record) => `¥ ${(record.price / 100).toFixed(2)}`,
      formItemProps: {
        rules: [{ required: true, message: '此项为必填项' }],
      },
    },
    {
      title: '周期',
      dataIndex: 'interval',
      valueEnum: {
        month: { text: '月付' },
        year: { text: '年付' },
      },
      search: false,
      formItemProps: {
        rules: [{ required: true, message: '此项为必填项' }],
      },
    },
    {
      title: '每月积分',
      dataIndex: 'credits',
      search: false,
      valueType: 'digit',
      fieldProps: { stringMode: true }, // BigInt support-ish
      render: (_, record) => Number(record.credits).toLocaleString(),
      formItemProps: {
        rules: [{ required: true, message: '此项为必填项' }],
      },
    },
    {
      title: '文件存储 (MB)',
      dataIndex: 'storageLimit',
      search: false,
      valueType: 'digit',
      formItemProps: {
        rules: [{ required: true, message: '此项为必填项' }],
      },
    },
    {
      title: '向量存储 (条)',
      dataIndex: 'vectorLimit',
      search: false,
      valueType: 'digit',
      formItemProps: {
        rules: [{ required: true, message: '此项为必填项' }],
      },
    },
    {
      title: '启用',
      dataIndex: 'isActive',
      valueType: 'switch',
      search: false,
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
          title="确定删除此方案吗？"
          onConfirm={async () => {
            const res = await deletePlan(record.id);
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
    <PageContainer header={{ title: '订阅方案管理' }}>
      <ProTable<SubscriptionPlan>
        columns={columns}
        actionRef={actionRef}
        cardBordered
        request={async () => {
          const res = await getPlans();
          return {
            data: res.data || [],
            success: res.success,
            total: res.data?.length || 0,
          };
        }}
        editable={{
          type: 'multiple',
          onSave: async (key: any, row: any) => {
             // For update or create
             if (row.id === 'new' || !key || (typeof key === 'string' && key.startsWith('new-'))) {
                const res = await createPlan(row);
                if (res.success) {
                  message.success('创建成功');
                  actionRef.current?.reload();
                  return true;
                }
                return false;
             } else {
                const res = await updatePlan(row.id, row);
                if (res.success) {
                  message.success('更新成功');
                  return true;
                }
                return false;
             }
          },
          actionRender: (row, config, dom) => [dom.save, dom.cancel],
        }}
        columnsState={{
          persistenceKey: 'pro-table-subscription-plans',
          persistenceType: 'localStorage',
        }}
        rowKey="id"
        search={{
          labelWidth: 'auto',
        }}
        options={{
          setting: {
            listsHeight: 400,
          },
        }}
        pagination={{
            pageSize: 10,
        }}
        dateFormatter="string"
        headerTitle="方案列表"
        toolBarRender={() => [
          <Button
            key="button"
            type="primary"
            onClick={() => {
               // Quick create via list
               actionRef.current?.addEditRecord?.({
                 id: 'new-' + Date.now(),
                 name: 'New Plan',
                 slug: 'new-plan-' + Date.now(),
                 type: 'individual',
                 price: 0,
                 currency: 'CNY',
                 interval: 'month',
                 credits: 0,
                 storageLimit: 1024,
                 vectorLimit: 0,
                 isActive: true,
               });
            }}
          >
            新建方案
          </Button>,
        ]}
      />
    </PageContainer>
  );
};

export default PlanManagement;
