import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  message,
  Popconfirm,
  Tag,
  Card,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserOutlined,
  TeamOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import {
  getUserManagementList,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
} from '@/services/admin';

const { Option } = Select;

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  avatar?: string;
  banned: boolean;
  userType: 'user' | 'admin' | 'super_admin';
  createdAt: string;
  updatedAt: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    banned: 0,
    admins: 0,
  });

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const result = await getUserManagementList({
        page: currentPage,
        limit: pageSize,
        search: searchText,
        userType: userTypeFilter,
      });

      if (result.success && result.data) {
        setUsers(result.data.users);
        setTotal(result.data.pagination.total);

        // 计算统计数据
        const userList = result.data.users;
        setStats({
          total: userList.length,
          active: userList.filter((u: User) => !u.banned).length,
          banned: userList.filter((u: User) => u.banned).length,
          admins: userList.filter((u: User) => u.userType === 'admin' || u.userType === 'super_admin').length,
        });
      }
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, pageSize, searchText, userTypeFilter]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    setCurrentPage(1);
  };

  // 处理用户类型过滤
  const handleUserTypeFilter = (value: string) => {
    setUserTypeFilter(value);
    setCurrentPage(1);
  };

  // 打开新增用户模态框
  const handleAddUser = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑用户模态框
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
    });
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      if (editingUser) {
        // 更新用户
        const result = await updateUser(editingUser.id, {
          displayName: values.displayName,
          email: values.email,
          phone: values.phone,
        });

        if (result.success) {
          message.success('用户信息更新成功');
          setModalVisible(false);
          fetchUsers();
        } else {
          message.error(result.message || '更新失败');
        }
      } else {
        // 新增用户
        const result = await createUser({
          username: values.username,
          displayName: values.displayName,
          email: values.email,
          password: values.password,
          phone: values.phone,
          userType: values.userType,
        });

        if (result.success) {
          message.success('用户创建成功');
          setModalVisible(false);
          form.resetFields();
          fetchUsers();
        } else {
          message.error(result.message || '创建失败');
        }
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: string) => {
    try {
      const result = await deleteUser(userId);
      if (result.success) {
        message.success('用户删除成功');
        fetchUsers();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 更新用户状态
  const handleUpdateUserStatus = async (userId: string, banned: boolean) => {
    try {
      const result = await updateUserStatus(userId, banned);
      if (result.success) {
        message.success(`用户已${banned ? '禁用' : '启用'}`);
        fetchUsers();
      } else {
        message.error(result.message || '状态更新失败');
      }
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => <span>{text}</span>,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      render: (text: string) => text || '-',
    },
    {
      title: '用户类型',
      dataIndex: 'userType',
      key: 'userType',
      render: (type: string) => {
        const colorMap = {
          user: 'blue',
          admin: 'green',
          super_admin: 'red',
        };
        const textMap = {
          user: '普通用户',
          admin: '管理员',
          super_admin: '超级管理员',
        };
        return <Tag color={colorMap[type as keyof typeof colorMap]}>{textMap[type as keyof typeof textMap]}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'banned',
      key: 'banned',
      render: (banned: boolean) => (
        <Tag color={banned ? 'red' : 'green'}>
          {banned ? '已禁用' : '正常'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: User) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={record.banned ? <UnlockOutlined /> : <LockOutlined />}
            onClick={() => handleUpdateUserStatus(record.id, !record.banned)}
          >
            {record.banned ? '启用' : '禁用'}
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={total}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={stats.active}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已禁用用户"
              value={stats.banned}
              prefix={<LockOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="管理员"
              value={stats.admins}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索和操作栏 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input.Search
              placeholder="搜索用户名、邮箱或显示名称"
              onSearch={handleSearch}
              enterButton={<SearchOutlined />}
            />
          </Col>
          <Col span={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="用户类型"
              allowClear
              onChange={handleUserTypeFilter}
            >
              <Option value="">全部</Option>
              <Option value="user">普通用户</Option>
              <Option value="admin">管理员</Option>
              <Option value="super_admin">超级管理员</Option>
            </Select>
          </Col>
          <Col span={4} offset={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddUser}
              block
            >
              新增用户
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 用户表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
        />
      </Card>

      {/* 新增/编辑用户模态框 */}
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
            ]}
          >
            <Input placeholder="请输入用户名" disabled={!!editingUser} />
          </Form.Item>

          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="请输入显示名称" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item name="phone" label="手机号">
            <Input placeholder="请输入手机号（可选）" />
          </Form.Item>

          {!editingUser && (
            <>
              <Form.Item
                name="password"
                label="密码"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '密码至少8个字符' },
                ]}
              >
                <Input.Password placeholder="请输入密码" />
              </Form.Item>

              <Form.Item
                name="userType"
                label="用户类型"
                initialValue="user"
                rules={[{ required: true, message: '请选择用户类型' }]}
              >
                <Select placeholder="请选择用户类型">
                  <Option value="user">普通用户</Option>
                  <Option value="admin">管理员</Option>
                  <Option value="super_admin">超级管理员</Option>
                </Select>
              </Form.Item>
            </>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingUser ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;