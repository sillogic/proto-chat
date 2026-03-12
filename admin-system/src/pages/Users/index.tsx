import { ActionType, PageContainer, ProColumns, ProTable } from '@ant-design/pro-components';
import { Alert, Button, DatePicker, Descriptions, Divider, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tabs, Tag, Typography, message } from 'antd';
import { Drawer } from 'antd';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';

const { Text } = Typography;

const TABS = [
  { key: 'all',    label: '全部' },
  { key: 'active', label: '正常' },
  { key: 'paid',   label: '付费用户' },
  { key: 'free',   label: '免费用户' },
  { key: 'purged', label: '已注销' },
];

import { adminForceEdit, getUserList, updateUserPlan, updateUserStatus, purgeUser } from '@/services/admin';
import type { User, UserListParams } from '@/services/api.d';

import { UsageStatsView } from '../UsageStatistics';

const { Option } = Select;

const UsersPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [usageDrawerVisible, setUsageDrawerVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [purgingUserId, setPurgingUserId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [form] = Form.useForm();
  const [creditForm] = Form.useForm();

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
      render: (banned, record) => {
        if (record.email?.endsWith('@deleted.invalid')) {
          return <Tag color="default">已注销</Tag>;
        }
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
      render: (_, record) => {
        const isPurged = record.email?.endsWith('@deleted.invalid');
        return (
        <Space>
          {!isPurged && (
          <Button size="small" type="link" onClick={() => handleEditUser(record)}>
            编辑
          </Button>
          )}
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
          {!isPurged && (record.banned ? (
            <Button size="small" type="link" onClick={() => handleUpdateUserStatus(record.id, false)}>
              解封
            </Button>
          ) : (
            <Button size="small" type="link" danger onClick={() => handleUpdateUserStatus(record.id, true)}>
              封禁
            </Button>
          ))}
          {!isPurged && <Popconfirm
            title="注销账号"
            description={
              <div style={{ maxWidth: 260 }}>
                <div>将清理该用户的<Text strong>聊天记录、知识库、文件</Text>，并释放邮箱。</div>
                <div style={{ marginTop: 4 }}>积分及交易记录<Text strong>会保留</Text>。此操作不可恢复。</div>
              </div>
            }
            okText="确认注销"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handlePurgeUser(record.id)}
          >
            <Button
              size="small"
              type="link"
              danger
              loading={purgingUserId === record.id}
            >
              注销
            </Button>
          </Popconfirm>}
        </Space>
        );
      },
    },
  ];

  // 注销用户
  const handlePurgeUser = async (userId: string) => {
    setPurgingUserId(userId);
    try {
      const res = await purgeUser(userId);
      if (res.success) {
        message.success(`账号已注销（消息 ${res.data?.deletedMessages ?? 0} 条，文件 ${res.data?.deletedFiles ?? 0} 个，OSS 对象 ${res.data?.deletedOssObjects ?? 0} 个）`);
        actionRef.current?.reload();
      } else {
        message.error(res.message || '注销失败');
      }
    } catch {
      message.error('注销用户失败');
    } finally {
      setPurgingUserId(null);
    }
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

  const forceAction = async (action: Parameters<typeof adminForceEdit>[1]) => {
    if (!currentUser) return;
    setEditLoading(true);
    try {
      const res = await adminForceEdit(currentUser.id, action);
      if (res.success) {
        message.success(res.message || '操作成功');
        actionRef.current?.reload();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch {
      message.error('请求失败');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <PageContainer>
      <ProTable<User, UserListParams>
        headerTitle={
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key);
              actionRef.current?.reload();
            }}
            items={TABS.map((t) => ({ key: t.key, label: t.label }))}
            style={{ marginBottom: -12 }}
          />
        }
        actionRef={actionRef}
        rowKey="id"
        params={{ accountStatus: activeTab }}
        search={{ labelWidth: 120 }}
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
        title="用户编辑（测试工具）"
        open={editModalVisible}
        onCancel={() => { setEditModalVisible(false); form.resetFields(); creditForm.resetFields(); }}
        footer={null}
        width={520}
      >
        <Alert
          message="以下操作直接修改数据库，绕过支付/订阅业务流程，不会产生支付记录或订阅历史。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="邮箱">{currentUser?.email}</Descriptions.Item>
          <Descriptions.Item label="当前方案">{currentUser?.planType || 'free'}</Descriptions.Item>
          <Descriptions.Item label="待定变更">
            {(currentUser as any)?.nextPlanId ? (
              <span>
                {(currentUser as any).nextPlanId}
                {(currentUser as any)?.nextPlanReason && (
                  <Tag
                    color={(currentUser as any).nextPlanReason === 'payment_failed' ? 'red' : 'orange'}
                    style={{ marginLeft: 6, fontSize: 11 }}
                  >
                    {(currentUser as any).nextPlanReason === 'payment_failed' ? '支付失败' : '到期降级'}
                  </Tag>
                )}
              </span>
            ) : '无'}
          </Descriptions.Item>
          <Descriptions.Item label="积分余额">{(currentUser as any)?.credit_balance ?? '-'}</Descriptions.Item>
        </Descriptions>

        <Divider orientation="left" plain>强制切换方案</Divider>
        <Form form={form} layout="inline" style={{ marginBottom: 12 }}>
          <Form.Item name="planType" initialValue={currentUser?.planType || 'free'}>
            <Select style={{ width: 110 }}>
              <Option value="free">Free</Option>
              <Option value="lite">Lite</Option>
              <Option value="pro">Pro</Option>
              <Option value="ultra">Ultra</Option>
            </Select>
          </Form.Item>
          <Form.Item name="planExpiresAt" label="到期时间">
            <DatePicker
              showTime
              placeholder="不填则不限期"
              style={{ width: 180 }}
              value={form.getFieldValue('planExpiresAt') ? dayjs(form.getFieldValue('planExpiresAt')) : null}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              loading={editLoading}
              onClick={() => {
                const vals = form.getFieldsValue();
                forceAction({
                  action: 'forcePlan',
                  planType: vals.planType,
                  planExpiresAt: vals.planExpiresAt ? dayjs(vals.planExpiresAt).toISOString() : undefined,
                });
              }}
            >
              执行
            </Button>
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          切换到 free 会同时清除到期时间和待定变更。
        </Text>

        <Divider orientation="left" plain>积分调整</Divider>
        <Form form={creditForm} layout="inline" style={{ marginBottom: 4 }}>
          <Form.Item name="creditDelta" label="调整量">
            <InputNumber style={{ width: 140 }} placeholder="+100 或 -50" />
          </Form.Item>
          <Form.Item>
            <Button
              loading={editLoading}
              onClick={() => {
                const delta = creditForm.getFieldValue('creditDelta');
                if (!delta) return message.warning('请填写调整量');
                forceAction({ action: 'adjustCredits', creditDelta: delta });
                creditForm.resetFields();
              }}
            >
              执行
            </Button>
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          调整记录会标注"管理员测试调整"，余额不会低于 0。
        </Text>

        <Divider orientation="left" plain>其他操作</Divider>
        <Popconfirm
          title="重置月度用量"
          description="将 lastUsageReset 设为当前时间，月度计数器从零开始。"
          onConfirm={() => forceAction({ action: 'resetUsage' })}
        >
          <Button size="small" loading={editLoading}>重置月度用量</Button>
        </Popconfirm>
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
