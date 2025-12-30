import { PageContainer, ProTable, ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, message, Modal, Form, Select, InputNumber } from 'antd';
import { EditOutlined, StopOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { Drawer } from 'antd';
import { UsageStatsView } from '../UsageStatistics';
import { getUserList, updateUserPlan, updateUserStatus } from '@/services/admin';
import type { User, UserListParams } from '@/services/api.d';

const { Option } = Select;

const UsersPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [usageDrawerVisible, setUsageDrawerVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  // 方案类型配置
  const planTypeConfig = {
    free: { text: 'Free Trial', color: 'blue' },
    basic: { text: '基础版', color: 'blue' },
    pro: { text: '专业版', color: 'green' },
    enterprise: { text: '企业版', color: 'gold' },
  };

  // 表格列定义
  const columns: ProColumns<User>[] = [
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 220,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '显示名',
      dataIndex: 'full_name',
      width: 150,
      ellipsis: true,
      render: (_, record) => {
        return record.full_name || '未设置';
      },
    },
    {
      title: '方案类型',
      dataIndex: 'planType',
      width: 120,
      render: (planType) => {
        const config = planTypeConfig[planType as keyof typeof planTypeConfig] || planTypeConfig.free;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
      valueType: 'select',
      valueEnum: {
        free: { text: 'Free Trial', status: 'Processing' },
        basic: { text: '基础版', status: 'Processing' },
        pro: { text: '专业版', status: 'Success' },
        enterprise: { text: '企业版', status: 'Warning' },
      },
    },
    {
      title: '状态',
      dataIndex: 'banned',
      width: 100,
      render: (banned) => {
        const isBanned = banned === true || banned === 't' || banned === 1;
        if (isBanned) {
          return <Tag color="red">已封禁</Tag>;
        }
        return <Tag color="green">正常</Tag>;
      },
      filters: [
        { text: '正常', value: false },
        { text: '已封禁', value: true },
      ],
      onFilter: (value, record) => {
        const isBanned = record.banned === true || record.banned === 't' || record.banned === 1;
        return isBanned === value;
      },
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      width: 180,
      render: (date: any) => {
        if (!date) return '-';
        try {
          const dateObj = new Date(date);
          return isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleString();
        } catch (error) {
          return '-';
        }
      },
    },
    {
      title: '最后活跃',
      dataIndex: 'last_active_at',
      width: 180,
      render: (date: any) => {
        if (!date) return '-';
        try {
          const dateObj = new Date(date);
          return isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleString();
        } catch (error) {
          return '-';
        }
      },
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => {
        return (
          <Space>
            <Button
              type="link"
              onClick={() => handleEditUser(record)}
            >
              编辑方案
            </Button>
            <Button
              type="link"
              onClick={() => {
                setCurrentUser(record);
                setUsageDrawerVisible(true);
              }}
            >
              用量统计
            </Button>
            {record.banned ? (
              <Button
                type="link"
                onClick={() => handleUpdateUserStatus(record.id, false)}
              >
                解封
              </Button>
            ) : (
              <Button
                type="link"
                danger
                onClick={() => handleUpdateUserStatus(record.id, true)}
              >
                封禁
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  // 编辑用户
  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    form.setFieldsValue({
      planType: user.planType,
      monthlyTokenLimit: user.monthlyTokenLimit,
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
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <Button
            key="refresh"
            onClick={() => {
              actionRef.current?.reload();
            }}
          >
            刷新
          </Button>,
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
        scroll={{ x: 1200 }}
        sticky={{ offsetHeader: 0 }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
      />

      <Modal
        title="编辑用户方案"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEditSubmit}
        >
          <Form.Item
            label="方案类型"
            name="planType"
            rules={[{ required: true, message: '请选择方案类型' }]}
          >
            <Select placeholder="请选择方案类型">
              <Option value="free">Free Trial</Option>
              <Option value="basic">基础版</Option>
              <Option value="pro">专业版</Option>
              <Option value="enterprise">企业版</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="月度积分额度"
            name="monthlyTokenLimit"
            help="设置为0表示无限制"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={999999999}
              placeholder="请输入月度积分额度"
            />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title={`用户用量统计 - ${currentUser?.email || currentUser?.username}`}
        width={800}
        open={usageDrawerVisible}
        onClose={() => {
          setUsageDrawerVisible(false);
          setCurrentUser(null);
        }}
        destroyOnClose
      >
        {currentUser && <UsageStatsView userId={currentUser.id} />}
      </Drawer>
    </PageContainer>
  );
};

export default UsersPage;