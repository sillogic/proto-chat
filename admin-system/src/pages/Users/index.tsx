import { PageContainer, ProTable, ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, message, Modal, Form, Select, Dropdown, MenuProps } from 'antd';
import { useRef, useState, useEffect } from 'react';
import { Drawer } from 'antd';
import { UsageStatsView } from '../UsageStatistics';
import { getUserList, updateUserPlan, updateUserStatus, upgradeSubscription, schedulePlanChange, simulateExpiry } from '@/services/admin';
import { getPlans, SubscriptionPlan } from '@/services/subscription';
import type { User, UserListParams } from '@/services/api.d';

const { Option } = Select;

const UsersPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [usageDrawerVisible, setUsageDrawerVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [form] = Form.useForm();

  // 获取方案列表
  const fetchPlans = async () => {
    try {
      const res = await getPlans();
      if (res.success) {
        setPlans(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  // 仿真操作处理
  const handleSimulation = async (action: string, record: User, extra?: any) => {
    try {
      let res;
      if (action === 'upgrade') {
        res = await upgradeSubscription(record.id, extra);
      } else if (action === 'schedule') {
        res = await schedulePlanChange(record.id, extra);
      } else if (action === 'cancel') {
        const freePlan = plans.find(p => p.slug === 'free' || p.slug === 'plan_free');
        res = await schedulePlanChange(record.id, freePlan?.id || null);
      } else if (action === 'expiry') {
        res = await simulateExpiry(record.id);
      }

      if (res?.success) {
        message.success(res.message || '操作成功');
        actionRef.current?.reload();
      } else {
        message.error(res?.message || '操作失败');
      }
    } catch (error) {
      message.error('请求失败');
    }
  };

  // 表格列定义
  const columns: ProColumns<User>[] = [
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '积分余额',
      dataIndex: 'credit_balance',
      width: 100,
      render: (val) => {
        const balance = parseFloat(String(val || '0'));
        return <span style={{ fontWeight: 'bold', color: balance > 0 ? '#52c41a' : '#f5222d' }}>
          {balance.toLocaleString()}
        </span>;
      },
      search: false,
    },
    {
      title: '方案类型',
      dataIndex: 'plan_name',
      width: 150,
      render: (planName, record) => {
        const color = record.planType === 'free' ? 'blue' : 'gold';
        return (
          <Space direction="vertical" size={0}>
            <Tag color={color}>{planName || 'Free Trial'}</Tag>
            {record.nextPlanId && (
              <Tag color="orange" style={{ fontSize: '10px' }}>
                次月: {plans.find(p => p.id === record.nextPlanId)?.name || '免费'}
              </Tag>
            )}
          </Space>
        );
      },
      valueType: 'select',
      fieldProps: {
        options: plans.map(p => ({ label: p.name, value: p.slug }))
      }
    },
    {
      title: '状态',
      dataIndex: 'banned',
      width: 80,
      render: (banned) => {
        const isBanned = banned === true || banned === 't' || banned === 1;
        return <Tag color={isBanned ? 'red' : 'green'}>{isBanned ? '已封禁' : '正常'}</Tag>;
      },
      filters: [
        { text: '正常', value: false },
        { text: '已封禁', value: true },
      ],
    },
    {
      title: '到期时间',
      dataIndex: 'plan_expires_at',
      width: 160,
      render: (date: any) => {
        if (!date) return '-';
        return new Date(date).toLocaleString();
      },
      search: false,
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      width: 160,
      render: (date: any) => date ? new Date(date).toLocaleString() : '-',
      search: false,
    },
    {
      title: '操作',
      width: 250,
      fixed: 'right',
      render: (_, record) => {
        const simMenu: MenuProps['items'] = [
          {
            key: 'upgrade',
            label: '立即升级 (仿真)',
            children: plans.filter(p => p.slug !== 'free').map(p => ({
              key: `up_${p.id}`,
              label: p.name,
              onClick: () => handleSimulation('upgrade', record, p.id),
            })),
          },
          {
            key: 'schedule',
            label: '预设次月降级 (仿真)',
            children: plans.map(p => ({
              key: `sch_${p.id}`,
              label: p.name,
              onClick: () => handleSimulation('schedule', record, p.id),
            })),
          },
          {
            key: 'cancel',
            label: '取消订阅 (不再续费)',
            onClick: () => handleSimulation('cancel', record),
          },
          {
            type: 'divider',
          },
          {
            key: 'expiry',
            label: '仿真周期结束 (触发结算)',
            danger: true,
            onClick: () => handleSimulation('expiry', record),
          },
        ];

        return (
          <Space>
            <Button size="small" type="link" onClick={() => handleEditUser(record)}>编辑</Button>
            <Button size="small" type="link" onClick={() => { setCurrentUser(record); setUsageDrawerVisible(true); }}>用量</Button>
            <Dropdown menu={{ items: simMenu }}>
              <Button size="small" type="link">仿真测试</Button>
            </Dropdown>
            {record.banned ? (
              <Button size="small" type="link" onClick={() => handleUpdateUserStatus(record.id, false)}>解封</Button>
            ) : (
              <Button size="small" type="link" danger onClick={() => handleUpdateUserStatus(record.id, true)}>封禁</Button>
            )}
          </Space>
        );
      },
    },
  ];

  // 编辑用户
  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    const currentPlan = plans.find(p => p.slug === user.planType);
    form.setFieldsValue({
      planId: currentPlan?.id,
    });
    setEditModalVisible(true);
  };

  // 更新用户状态
  const handleUpdateUserStatus = async (userId: string, banned: boolean) => {
    try {
      const action = banned ? '封禁' : '解封';
      await updateUserStatus(userId, { banned, banReason: banned ? '管理员操作' : undefined });
      message.success(`用户${action}成功`);
      actionRef.current?.reload();
    } catch (error) {
      message.error('用户状态更新失败');
    }
  };

  // 提交编辑表单
  const handleEditSubmit = async (values: any) => {
    if (!currentUser) return;

    try {
      await updateUserPlan({
        userId: currentUser.id,
        ...values,
      });
      message.success('用户方案更新成功');
      setEditModalVisible(false);
      actionRef.current?.reload();
    } catch (error) {
      message.error('用户方案更新失败');
    }
  };

  return (
    <PageContainer>
      <ProTable<User, UserListParams>
        headerTitle="用户管理"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        toolBarRender={() => [
          <Button key="refresh" onClick={() => actionRef.current?.reload()}>刷新</Button>,
        ]}
        request={async (params) => {
          const response = await getUserList(params);
          return {
            data: response.data?.users || [],
            success: response.success,
            total: response.data?.pagination?.total || 0,
          };
        }}
        columns={columns}
        scroll={{ x: 1300 }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      />

      <Modal
        title="编辑用户方案"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => form.submit()}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            label="当前计费方案"
            name="planId"
            rules={[{ required: true, message: '请选择订阅方案' }]}
            help="编辑此处将立即变更用户的当前方案。如需模拟降级，请使用列表中的“仿真”功能。"
          >
            <Select placeholder="请选择订阅方案">
              {plans.map(plan => (
                <Option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.slug})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title={`用户用量统计 - ${currentUser?.email || currentUser?.username}`}
        width={1000}
        open={usageDrawerVisible}
        onClose={() => { setUsageDrawerVisible(false); setCurrentUser(null); }}
        destroyOnClose
      >
        {currentUser && <UsageStatsView userId={currentUser.id} />}
      </Drawer>
    </PageContainer>
  );
};

export default UsersPage;
