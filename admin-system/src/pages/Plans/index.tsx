/**
 * Admin 后台 - 订阅方案管理页面
 *
 * 功能：
 * - 方案列表展示
 * - 创建/编辑方案
 * - 启用/禁用优惠
 * - 设置推荐标签
 * - 排序调整
 */

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';

// 方案数据结构
interface Plan {
  id: string;
  slug: string;
  name: string;
  type: 'individual' | 'team';
  monthlyPrice: number; // 分
  yearlyPrice: number | null; // 分
  credits: string;
  storageLimit: number; // MB
  vectorLimit: number;
  features: {
    display: {
      description: string;
      support_level: 'community' | 'priority_email' | 'dedicated';
      model_estimates: Array<{
        model: string;
        count: string;
      }>;
      vector_storage_display: string;
    };
    capabilities: {
      custom_api: boolean;
      unlimited_messages: boolean;
      unlimited_history: boolean;
      global_sync: boolean;
      agent_market: boolean;
      premium_plugins: boolean;
      web_search: boolean;
      file_upload: boolean;
      tts: boolean;
    };
  };
  displayOrder: number;
  isPopular: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [form] = Form.useForm();

  // 加载方案列表
  const loadPlans = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/plans');
      setPlans(response.data);
    } catch (error) {
      message.error('加载方案失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  // 计算统计数据
  const stats = {
    total: plans.length,
    active: plans.filter(p => p.isActive).length,
    individual: plans.filter(p => p.type === 'individual').length,
    team: plans.filter(p => p.type === 'team').length,
  };

  // 计算年付优惠百分比
  const calculateDiscount = (monthlyPrice: number, yearlyPrice: number | null): string => {
    if (!yearlyPrice) return '-';
    const yearlyTotal = monthlyPrice * 12;
    const discount = ((yearlyTotal - yearlyPrice) / yearlyTotal * 100).toFixed(0);
    return `${discount}%`;
  };

  // 打开编辑弹窗
  const handleEdit = (plan: Plan) => {
    setCurrentPlan(plan);
    form.setFieldsValue({
      ...plan,
      monthlyPrice: plan.monthlyPrice / 100, // 转为元
      yearlyPrice: plan.yearlyPrice ? plan.yearlyPrice / 100 : null,
      description: plan.features.display.description,
      supportLevel: plan.features.display.support_level,
    });
    setEditModalVisible(true);
  };

  // 创建新方案
  const handleCreate = () => {
    setCurrentPlan(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'individual',
      isActive: true,
      isPopular: false,
      displayOrder: 0,
    });
    setEditModalVisible(true);
  };

  // 保存方案
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // 转换价格为分
      const data = {
        ...values,
        monthlyPrice: Math.round(values.monthlyPrice * 100),
        yearlyPrice: values.yearlyPrice ? Math.round(values.yearlyPrice * 100) : null,
        features: {
          display: {
            description: values.description,
            support_level: values.supportLevel,
            model_estimates: currentPlan?.features.display.model_estimates || [],
            vector_storage_display: currentPlan?.features.display.vector_storage_display || '',
          },
          capabilities: currentPlan?.features.capabilities || {},
        },
      };

      if (currentPlan) {
        // 更新
        await axios.put(`/api/plans/${currentPlan.id}`, data);
        message.success('方案更新成功');
      } else {
        // 创建
        await axios.post('/api/plans', data);
        message.success('方案创建成功');
      }

      setEditModalVisible(false);
      loadPlans();
    } catch (error) {
      message.error('保存失败');
      console.error(error);
    }
  };

  // 删除方案
  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/plans/${id}`);
      message.success('方案删除成功');
      loadPlans();
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  // 切换启用状态
  const handleToggleActive = async (plan: Plan) => {
    try {
      await axios.put(`/api/plans/${plan.id}`, {
        ...plan,
        isActive: !plan.isActive,
      });
      message.success(`方案已${plan.isActive ? '停用' : '启用'}`);
      loadPlans();
    } catch (error) {
      message.error('操作失败');
      console.error(error);
    }
  };

  // 切换推荐标签
  const handleTogglePopular = async (plan: Plan) => {
    try {
      await axios.put(`/api/plans/${plan.id}`, {
        ...plan,
        isPopular: !plan.isPopular,
      });
      message.success(`推荐标签已${plan.isPopular ? '移除' : '设置'}`);
      loadPlans();
    } catch (error) {
      message.error('操作失败');
      console.error(error);
    }
  };

  // 表格列定义
  const columns: ColumnsType<Plan> = [
    {
      title: '排序',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: 80,
      sorter: (a, b) => b.displayOrder - a.displayOrder,
    },
    {
      title: '方案名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <strong>{name}</strong>
          {record.isPopular && <StarFilled style={{ color: '#faad14' }} />}
        </Space>
      ),
    },
    {
      title: '代号',
      dataIndex: 'slug',
      key: 'slug',
      render: (slug) => <Tag>{slug}</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'individual' ? 'blue' : 'green'}>
          {type === 'individual' ? '个人' : '团队'}
        </Tag>
      ),
    },
    {
      title: '月价',
      dataIndex: 'monthlyPrice',
      key: 'monthlyPrice',
      render: (price) => `¥${(price / 100).toFixed(2)}`,
      sorter: (a, b) => a.monthlyPrice - b.monthlyPrice,
    },
    {
      title: '年价',
      dataIndex: 'yearlyPrice',
      key: 'yearlyPrice',
      render: (price, record) => {
        if (!price) return <Tag>不支持</Tag>;
        const discount = calculateDiscount(record.monthlyPrice, price);
        return (
          <Space direction="vertical" size={0}>
            <span>¥{(price / 100).toFixed(2)}</span>
            {discount !== '-' && <Tag color="green">省 {discount}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '积分',
      dataIndex: 'credits',
      key: 'credits',
      render: (credits) => {
        const num = parseInt(credits);
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
        return credits;
      },
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Switch
            checked={record.isActive}
            onChange={() => handleToggleActive(record)}
            checkedChildren={<CheckCircleOutlined />}
            unCheckedChildren={<CloseCircleOutlined />}
          />
          {record.isActive ? (
            <Tag color="success">启用</Tag>
          ) : (
            <Tag color="default">停用</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '推荐',
      key: 'popular',
      width: 100,
      render: (_, record) => (
        <Button
          type={record.isPopular ? 'primary' : 'default'}
          icon={record.isPopular ? <StarFilled /> : <StarOutlined />}
          onClick={() => handleTogglePopular(record)}
          size="small"
        >
          {record.isPopular ? '已推荐' : '推荐'}
        </Button>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个方案吗？"
            description="删除后无法恢复，请谨慎操作！"
            onConfirm={() => handleDelete(record.id)}
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
            <Statistic title="方案总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="启用方案"
              value={stats.active}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="个人方案" value={stats.individual} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="团队方案" value={stats.team} />
          </Card>
        </Col>
      </Row>

      {/* 提示 */}
      <Alert
        message="方案管理说明"
        description={
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>年付价格 &lt; 月付价格 × 12 时，会自动显示优惠标签</li>
            <li>displayOrder 数值越大，前端展示排序越靠前</li>
            <li>推荐标签会在方案卡片上显示"推荐"角标</li>
            <li>停用的方案不会在前端显示</li>
          </ul>
        }
        type="info"
        showIcon
        closable
        style={{ marginBottom: 24 }}
      />

      {/* 操作栏 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
        >
          创建新方案
        </Button>
      </div>

      {/* 方案列表表格 */}
      <Table
        columns={columns}
        dataSource={plans}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 个方案`,
        }}
      />

      {/* 编辑/创建弹窗 */}
      <Modal
        title={currentPlan ? '编辑方案' : '创建新方案'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: 'individual',
            isActive: true,
            isPopular: false,
            displayOrder: 0,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="方案名称"
                name="name"
                rules={[{ required: true, message: '请输入方案名称' }]}
              >
                <Input placeholder="例如：Pro" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="方案代号"
                name="slug"
                rules={[
                  { required: true, message: '请输入方案代号' },
                  { pattern: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字和连字符' },
                ]}
              >
                <Input placeholder="例如：pro" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="类型"
                name="type"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="individual">个人方案</Select.Option>
                  <Select.Option value="team">团队方案</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="月价（元）"
                name="monthlyPrice"
                rules={[{ required: true, message: '请输入月价' }]}
              >
                <InputNumber
                  min={0}
                  step={1}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="例如：299"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="年价（元）"
                name="yearlyPrice"
                tooltip="留空表示不支持年付"
              >
                <InputNumber
                  min={0}
                  step={1}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="例如：2870（可选）"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="每月积分"
                name="credits"
                rules={[{ required: true, message: '请输入积分数量' }]}
              >
                <Input placeholder="例如：15000000" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="文件存储 (MB)"
                name="storageLimit"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="例如：2048" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="向量存储 (条)"
                name="vectorLimit"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="例如：10000" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="方案描述"
            name="description"
            rules={[{ required: true, message: '请输入方案描述' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="例如：为频繁使用 AI 的专业用户设计"
            />
          </Form.Item>

          <Form.Item
            label="技术支持级别"
            name="supportLevel"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="community">社区支持</Select.Option>
              <Select.Option value="priority_email">优先邮件支持</Select.Option>
              <Select.Option value="dedicated">专属客服</Select.Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="排序"
                name="displayOrder"
                tooltip="数值越大越靠前"
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="推荐标签"
                name="isPopular"
                valuePropName="checked"
              >
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="启用状态"
                name="isActive"
                valuePropName="checked"
              >
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Col>
          </Row>

          <Alert
            message="高级配置"
            description="模型估算、功能开关等高级配置请使用详细编辑页面"
            type="info"
            showIcon
          />
        </Form>
      </Modal>
    </div>
  );
};

export default PlansPage;
