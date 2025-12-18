import { PageContainer, ProTable, ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, message, Modal, Form, Select, InputNumber } from 'antd';
import { UserOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { useRequest } from '@umijs/max';
import { getUserList, updateUserPlan, updateUserStatus } from '@/services/admin';
import type { User, UserListParams } from '@/services/api.d';

const { Option } = Select;

const UsersPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  // 套餐类型配置
  const planTypeConfig = {
    free: { text: '免费版', color: 'default' },
    basic: { text: '基础版', color: 'blue' },
    pro: { text: '专业版', color: 'green' },
    enterprise: { text: '企业版', color: 'gold' },
  };

  // 用户状态配置
  const statusConfig = {
    active: { text: '正常', color: 'green' },
    suspended: { text: '已停用', color: 'red' },
    expired: { text: '已过期', color: 'orange' },
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
      title: '套餐类型',
      dataIndex: 'planType',
      width: 120,
      render: (planType) => {
        const config = planTypeConfig[planType as keyof typeof planTypeConfig] || planTypeConfig.free;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
      valueType: 'select',
      valueEnum: {
        free: { text: '免费版', status: 'Default' },
        basic: { text: '基础版', status: 'Processing' },
        pro: { text: '专业版', status: 'Success' },
        enterprise: { text: '企业版', status: 'Warning' },
      },
    },
    {
      title: 'Token限制',
      dataIndex: 'monthlyTokenLimit',
      width: 120,
      render: (limit) => {
        const numLimit = parseInt(limit) || 0;
        return numLimit > 0 ? `${numLimit.toLocaleString()}` : '无限制';
      },
    },
    {
      title: 'API调用限制',
      dataIndex: 'monthlyApiCallsLimit',
      width: 120,
      render: (limit) => {
        const numLimit = parseInt(limit) || 0;
        return numLimit > 0 ? `${numLimit.toLocaleString()}` : '无限制';
      },
    },
    {
      title: '状态',
      dataIndex: 'banned',
      width: 100,
      render: (banned) => {
        // 处理数据库中的布尔值 f/t
        const isBanned = banned === true || banned === 't' || banned === 1;
        if (isBanned) {
          return <Tag color="red">已封禁</Tag>;
        }
        return <Tag color="green">正常</Tag>;
      },
      filters: [
        {
          text: '正常',
          value: false,
        },
        {
          text: '已封禁',
          value: true,
        },
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
      render: (date) => {
        if (!date) return '-';
        try {
          // 处理可能的时间格式
          const dateObj = new Date(date);
          if (isNaN(dateObj.getTime())) {
            // 如果Date解析失败，尝试其他格式
            const dateStr = String(date);
            // 移除时区部分再尝试
            const dateWithoutTimezone = dateStr.replace(/[+-]\d{2}:\d{2}$/, '');
            const fallbackDate = new Date(dateWithoutTimezone);
            return isNaN(fallbackDate.getTime()) ? '-' : fallbackDate.toLocaleString();
          }
          return dateObj.toLocaleString();
        } catch (error) {
          console.error('时间解析错误:', error, '原始值:', date);
          return '-';
        }
      },
    },
    {
      title: '最后活跃',
      dataIndex: 'last_active_at',
      width: 180,
      render: (date) => {
        if (!date) return '-';
        try {
          // 处理可能的时间格式
          const dateObj = new Date(date);
          if (isNaN(dateObj.getTime())) {
            // 如果Date解析失败，尝试其他格式
            const dateStr = String(date);
            // 移除时区部分再尝试
            const dateWithoutTimezone = dateStr.replace(/[+-]\d{2}:\d{2}$/, '');
            const fallbackDate = new Date(dateWithoutTimezone);
            return isNaN(fallbackDate.getTime()) ? '-' : fallbackDate.toLocaleString();
          }
          return dateObj.toLocaleString();
        } catch (error) {
          console.error('时间解析错误:', error, '原始值:', date);
          return '-';
        }
      },
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right', // 固定在右侧
      render: (_, record) => {
        return (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEditUser(record)}
            >
              编辑套餐
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
                icon={<StopOutlined />}
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
      monthlyApiCallsLimit: user.monthlyApiCallsLimit,
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
      message.success('用户套餐更新成功');
      setEditModalVisible(false);
      actionRef.current?.reload();
    } catch (error) {
      message.error('用户套餐更新失败');
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
        scroll={{ x: 1200 }} // 启用横向滚动
      sticky={{ offsetHeader: 0 }} // 启用粘性表头
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
      />

      {/* 编辑用户模态框 */}
      <Modal
        title="编辑用户套餐"
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
            label="套餐类型"
            name="planType"
            rules={[{ required: true, message: '请选择套餐类型' }]}
          >
            <Select placeholder="请选择套餐类型">
              <Option value="free">免费版</Option>
              <Option value="basic">基础版</Option>
              <Option value="pro">专业版</Option>
              <Option value="enterprise">企业版</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="月度Token限制"
            name="monthlyTokenLimit"
            help="设置为0表示无限制"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={999999999}
              placeholder="请输入月度Token限制"
            />
          </Form.Item>

          <Form.Item
            label="月度API调用限制"
            name="monthlyApiCallsLimit"
            help="设置为0表示无限制"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={999999}
              placeholder="请输入月度API调用限制"
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default UsersPage;