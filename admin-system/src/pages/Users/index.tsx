import { ActionType, PageContainer, ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, Form, Input, Modal, Select, Space, Tag, message } from 'antd';
import { Drawer } from 'antd';
import { useRef, useState } from 'react';

import { getUserList, updateUserPlan, updateUserStatus } from '@/services/admin';
import type { User, UserListParams } from '@/services/api.d';

import { UsageStatsView } from '../UsageStatistics';

const { Option } = Select;

const UsersPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [usageDrawerVisible, setUsageDrawerVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  // 编辑用户
  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    form.setFieldsValue({
      planType: user.planType || 'free',
    });
    setEditModalVisible(true);
  };

  // 表格列定义
  const columns: ProColumns<User>[] = [
    {
      title: '邮箱',
      dataIndex: 'keyword',
      width: 200,
      ellipsis: true,
      fixed: 'left',
      render: (_, record) => record.email,
    },
    {
      title: '积分余额',
      dataIndex: 'credit_balance',
      width: 100,
      render: (val) => {
        const balance = parseFloat(String(val || '0'));
        return (
          <span style={{ fontWeight: 'bold', color: balance > 0 ? '#52c41a' : '#f5222d' }}>
            {balance.toLocaleString()}
          </span>
        );
      },
      search: false,
    },
    {
      title: '方案类型',
      dataIndex: 'planType',
      width: 150,
      render: (_, record) => {
        const planType = record.planType || 'free';
        const planName = planType.charAt(0).toUpperCase() + planType.slice(1);
        const isFree = planType.includes('free');
        return <Tag color={isFree ? 'blue' : 'gold'}>{planName}</Tag>;
      },
      valueType: 'select',
      fieldProps: {
        options: [
          { label: 'Free', value: 'free' },
          { label: 'Lite', value: 'lite' },
          { label: 'Pro', value: 'pro' },
          { label: 'Ultra', value: 'ultra' },
        ],
      },
    },
    {
      title: '状态',
      dataIndex: 'banned',
      width: 80,
      render: (banned) => {
        const isBanned = banned === true || banned === 't' || banned === 1;
        return <Tag color={isBanned ? 'red' : 'green'}>{isBanned ? '已封禁' : '正常'}</Tag>;
      },
      search: false,
    },
    {
      title: '到期时间',
      dataIndex: 'plan_expires_at',
      width: 160,
      search: false,
      render: (date: any) => {
        if (!date) return '-';
        try {
          const parsedDate = new Date(date);
          if (isNaN(parsedDate.getTime())) return '-';
          return parsedDate.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        } catch (e) {
          return '-';
        }
      },
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      width: 160,
      search: false,
      render: (date: any) => (date ? new Date(date).toLocaleString() : '-'),
    },
    {
      title: '操作',
      width: 200,
      search: false,
      render: (_, record) => (
        <Space>
          <Button size="small" type="link" onClick={() => handleEditUser(record)}>
            编辑
          </Button>
          <Button
            size="small"
            type="link"
            onClick={() => {
              setCurrentUser(record);
              setUsageDrawerVisible(true);
            }}
          >
            用量
          </Button>
          {record.banned ? (
            <Button
              size="small"
              type="link"
              onClick={() => handleUpdateUserStatus(record.id, false)}
            >
              解封
            </Button>
          ) : (
            <Button
              size="small"
              type="link"
              danger
              onClick={() => handleUpdateUserStatus(record.id, true)}
            >
              封禁
            </Button>
          )}
        </Space>
      ),
    },
  ];

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
    message.info('编辑功能暂未实现');
    setEditModalVisible(false);
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
          <Button key="refresh" onClick={() => actionRef.current?.reload()}>
            刷新
          </Button>,
        ]}
        request={async (params: any) => {
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
          <Form.Item label="用户邮箱">
            <Input disabled value={currentUser?.email} />
          </Form.Item>
          <Form.Item
            label="当前方案类型"
            name="planType"
            rules={[{ required: true, message: '请选择方案类型' }]}
          >
            <Select>
              <Option value="free">Free</Option>
              <Option value="lite">Lite</Option>
              <Option value="pro">Pro</Option>
              <Option value="ultra">Ultra</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title={`用户用量统计 - ${currentUser?.email || currentUser?.username}`}
        width={1000}
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
