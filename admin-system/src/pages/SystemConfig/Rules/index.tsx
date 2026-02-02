import { PageContainer } from '@ant-design/pro-components';
import { Card, Collapse, Descriptions, Tag, Typography, Space, Alert, Table, Divider } from 'antd';
import {
  ClockCircleOutlined,
  CreditCardOutlined,
  SafetyOutlined,
  DatabaseOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import React from 'react';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

// System Rules Data (from src/config/system-rules.json)
const systemRules = {
  version: '1.0.0',
  lastUpdated: '2024-02-02',

  subscription: {
    title: '订阅规则',
    rules: {
      types: {
        title: '订阅类型',
        items: [
          {
            key: 'recurring',
            name: '连续订阅',
            description: '自动续费，支持包月/包年',
            features: ['自动扣款续费', '可随时取消', '到期前自动续期'],
          },
          {
            key: 'onetime',
            name: '一次性付费',
            description: '买断制，到期后自动降级',
            features: ['无自动扣款', '支持1/3/6/12个月', '到期自动降级为免费版'],
          },
        ],
      },
      billingCycles: {
        title: '计费周期',
        items: [
          { key: 'month', name: '月付', discount: null },
          { key: 'year', name: '年付', discount: '享受优惠折扣' },
        ],
      },
      upgrade: {
        title: '升级规则',
        items: [
          '同级或更高级套餐之间不可重复购买',
          '升级时按剩余天数计算残值抵扣',
          '残值计算公式：已付金额 × (剩余天数 / 总天数)',
          '升级后立即生效，原套餐作废',
        ],
      },
      downgrade: {
        title: '降级规则',
        items: [
          '一次性付费到期后自动降级为免费版',
          '连续订阅扣款失败后降级为免费版',
          '降级后积分重置为免费版额度',
          '降级记录保留在用户扩展信息中',
        ],
      },
      credits: {
        title: '积分规则',
        items: ['积分按月发放，每月重置', '积分不累积，月底清零', '升级后立即获得新套餐积分', '降级后重置为免费版积分'],
      },
    },
  },

  payment: {
    title: '支付规则',
    rules: {
      channels: {
        title: '支付渠道',
        items: [
          { key: 'alipay_precreate', name: '支付宝扫码', status: 'enabled' },
          { key: 'alipay_cycle', name: '支付宝周期扣款', status: 'enabled' },
          { key: 'wechat_native', name: '微信支付', status: 'coming_soon' },
        ],
      },
      orderExpiration: {
        title: '订单有效期',
        value: '2小时',
        description: '二维码生成后2小时内有效，过期需重新生成',
      },
      autoDeduct: {
        title: '自动扣款规则',
        items: [
          '到期当天上午 09:00 进行第一次扣款',
          '第一次失败后，中午 12:00 进行第二次扣款',
          '两次都失败则自动降级为免费版',
          '扣款失败原因记录在协议表中',
        ],
      },
      refund: {
        title: '退款政策',
        items: ['虚拟商品一经支付不支持退款', '特殊情况可联系客服处理'],
      },
    },
  },

  dataRetention: {
    title: '数据保留规则',
    rules: {
      orders: {
        title: '订单数据',
        items: [
          { status: 'paid', retention: '永久保留', reason: '财务记录，审计需要' },
          { status: 'pending', retention: '7天', reason: '未支付订单，无保留价值' },
          { status: 'closed', retention: '7天', reason: '已取消订单，无保留价值' },
        ],
      },
      users: {
        title: '用户数据',
        items: [
          { type: '已验证用户', retention: '永久保留', condition: 'emailVerified = true' },
          { type: '未验证用户', retention: '7天', condition: 'emailVerified = false 且无 user_extensions 记录' },
        ],
      },
      agreements: {
        title: '签约协议',
        items: [
          { status: 'signed', retention: '永久保留', reason: '有效协议' },
          { status: 'unsigned', retention: '永久保留', reason: '历史记录' },
          { status: 'pending', retention: '30天', reason: '未完成签约' },
        ],
      },
    },
  },

  cronJobs: {
    title: '定时任务',
    timezone: 'Asia/Shanghai (UTC+8)',
    jobs: [
      {
        name: '自动扣款',
        path: '/api/cron/auto-deduct',
        schedule: '09:00, 12:00',
        scheduleUTC: '01:00, 04:00',
        frequency: '每天两次',
        description: '连续订阅用户自动扣款，两次尝试机会',
      },
      {
        name: '订阅维护',
        path: '/api/cron/subscription',
        schedule: '14:00',
        scheduleUTC: '06:00',
        frequency: '每天',
        description: '每月积分发放、一次性付费过期处理',
      },
      {
        name: '订单清理',
        path: '/api/cron/cleanup-orders',
        schedule: '周日 03:00',
        scheduleUTC: '周六 19:00',
        frequency: '每周',
        description: '清理7天前的 pending/closed 订单',
      },
      {
        name: '用户清理',
        path: '/api/cron/cleanup-unverified-users',
        schedule: '04:00',
        scheduleUTC: '20:00 (前一天)',
        frequency: '每天',
        description: '清理7天前未验证的僵尸账号',
      },
    ],
    executionOrder: ['自动扣款必须在订阅维护之前执行', '确保扣款完成后再处理过期逻辑'],
  },

  security: {
    title: '安全规则',
    rules: {
      authentication: {
        title: '认证规则',
        items: ['所有 Cron 接口需要 CRON_SECRET 验证', '支付回调需验证支付宝签名', '用户操作需要登录态验证'],
      },
      rateLimit: {
        title: '频率限制',
        items: ['支付订单：同一用户同一套餐，复用未过期的 pending 订单', '签约请求：避免重复创建签约记录'],
      },
    },
  },
};

// Helper function to render status tag
const renderStatusTag = (status: string) => {
  const statusConfig: Record<string, { color: string; text: string }> = {
    enabled: { color: 'success', text: '已启用' },
    disabled: { color: 'error', text: '已禁用' },
    coming_soon: { color: 'warning', text: '即将上线' },
  };
  const config = statusConfig[status] || { color: 'default', text: status };
  return <Tag color={config.color}>{config.text}</Tag>;
};

const SystemRulesPage: React.FC = () => {
  return (
    <PageContainer
      header={{
        breadcrumb: {},
        title: '系统规则',
        subTitle: '查看系统的各项业务规则和配置',
      }}
    >
      <Space direction="vertical" size="large" style={{ display: 'flex' }}>
        <Alert
          message="规则说明"
          description={
            <Space direction="vertical">
              <Text>
                本页面展示系统的核心业务规则，包括订阅、支付、数据保留和定时任务等配置。这些规则在代码中实现，此处仅供查阅参考。
              </Text>
              <Text type="secondary">
                版本: {systemRules.version} | 最后更新: {systemRules.lastUpdated}
              </Text>
            </Space>
          }
          type="info"
          showIcon
        />

        {/* 订阅规则 */}
        <Card
          title={
            <Space>
              <CreditCardOutlined />
              {systemRules.subscription.title}
            </Space>
          }
        >
          <Collapse defaultActiveKey={['types', 'upgrade', 'credits']}>
            {/* 订阅类型 */}
            <Panel header={systemRules.subscription.rules.types.title} key="types">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {systemRules.subscription.rules.types.items.map((item) => (
                  <Card key={item.key} size="small" type="inner" title={item.name}>
                    <Paragraph type="secondary">{item.description}</Paragraph>
                    <Space wrap>
                      {item.features.map((feature, idx) => (
                        <Tag key={idx} color="blue">
                          {feature}
                        </Tag>
                      ))}
                    </Space>
                  </Card>
                ))}
              </Space>
            </Panel>

            {/* 计费周期 */}
            <Panel header={systemRules.subscription.rules.billingCycles.title} key="billingCycles">
              <Descriptions column={2} bordered size="small">
                {systemRules.subscription.rules.billingCycles.items.map((item) => (
                  <Descriptions.Item key={item.key} label={item.name}>
                    {item.discount ? <Tag color="gold">{item.discount}</Tag> : <Text type="secondary">标准价格</Text>}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Panel>

            {/* 升级规则 */}
            <Panel header={systemRules.subscription.rules.upgrade.title} key="upgrade">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {systemRules.subscription.rules.upgrade.items.map((item, idx) => (
                  <li key={idx}>
                    <Text>{item}</Text>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* 降级规则 */}
            <Panel header={systemRules.subscription.rules.downgrade.title} key="downgrade">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {systemRules.subscription.rules.downgrade.items.map((item, idx) => (
                  <li key={idx}>
                    <Text>{item}</Text>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* 积分规则 */}
            <Panel header={systemRules.subscription.rules.credits.title} key="credits">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {systemRules.subscription.rules.credits.items.map((item, idx) => (
                  <li key={idx}>
                    <Text>{item}</Text>
                  </li>
                ))}
              </ul>
            </Panel>
          </Collapse>
        </Card>

        {/* 支付规则 */}
        <Card
          title={
            <Space>
              <CreditCardOutlined />
              {systemRules.payment.title}
            </Space>
          }
        >
          <Collapse defaultActiveKey={['channels', 'autoDeduct']}>
            {/* 支付渠道 */}
            <Panel header={systemRules.payment.rules.channels.title} key="channels">
              <Table
                dataSource={systemRules.payment.rules.channels.items}
                rowKey="key"
                pagination={false}
                size="small"
                columns={[
                  { title: '渠道', dataIndex: 'name', key: 'name' },
                  { title: '标识', dataIndex: 'key', key: 'key', render: (v) => <Text code>{v}</Text> },
                  { title: '状态', dataIndex: 'status', key: 'status', render: renderStatusTag },
                ]}
              />
            </Panel>

            {/* 订单有效期 */}
            <Panel header={systemRules.payment.rules.orderExpiration.title} key="orderExpiration">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="有效时长">
                  <Tag color="orange">{systemRules.payment.rules.orderExpiration.value}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="说明">
                  {systemRules.payment.rules.orderExpiration.description}
                </Descriptions.Item>
              </Descriptions>
            </Panel>

            {/* 自动扣款规则 */}
            <Panel header={systemRules.payment.rules.autoDeduct.title} key="autoDeduct">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {systemRules.payment.rules.autoDeduct.items.map((item, idx) => (
                  <li key={idx}>
                    <Text>{item}</Text>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* 退款政策 */}
            <Panel header={systemRules.payment.rules.refund.title} key="refund">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {systemRules.payment.rules.refund.items.map((item, idx) => (
                  <li key={idx}>
                    <Text>{item}</Text>
                  </li>
                ))}
              </ul>
            </Panel>
          </Collapse>
        </Card>

        {/* 数据保留规则 */}
        <Card
          title={
            <Space>
              <DatabaseOutlined />
              {systemRules.dataRetention.title}
            </Space>
          }
        >
          <Collapse defaultActiveKey={['orders']}>
            {/* 订单数据 */}
            <Panel header={systemRules.dataRetention.rules.orders.title} key="orders">
              <Table
                dataSource={systemRules.dataRetention.rules.orders.items}
                rowKey="status"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '订单状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (v) => (
                      <Tag color={v === 'paid' ? 'success' : v === 'pending' ? 'warning' : 'default'}>{v}</Tag>
                    ),
                  },
                  { title: '保留时长', dataIndex: 'retention', key: 'retention' },
                  { title: '原因', dataIndex: 'reason', key: 'reason' },
                ]}
              />
            </Panel>

            {/* 用户数据 */}
            <Panel header={systemRules.dataRetention.rules.users.title} key="users">
              <Table
                dataSource={systemRules.dataRetention.rules.users.items}
                rowKey="type"
                pagination={false}
                size="small"
                columns={[
                  { title: '用户类型', dataIndex: 'type', key: 'type' },
                  { title: '保留时长', dataIndex: 'retention', key: 'retention' },
                  { title: '条件', dataIndex: 'condition', key: 'condition', render: (v) => <Text code>{v}</Text> },
                ]}
              />
            </Panel>

            {/* 签约协议 */}
            <Panel header={systemRules.dataRetention.rules.agreements.title} key="agreements">
              <Table
                dataSource={systemRules.dataRetention.rules.agreements.items}
                rowKey="status"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '协议状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (v) => (
                      <Tag color={v === 'signed' ? 'success' : v === 'pending' ? 'warning' : 'default'}>{v}</Tag>
                    ),
                  },
                  { title: '保留时长', dataIndex: 'retention', key: 'retention' },
                  { title: '原因', dataIndex: 'reason', key: 'reason' },
                ]}
              />
            </Panel>
          </Collapse>
        </Card>

        {/* 定时任务 */}
        <Card
          title={
            <Space>
              <ScheduleOutlined />
              {systemRules.cronJobs.title}
            </Space>
          }
        >
          <Alert
            message={`时区: ${systemRules.cronJobs.timezone}`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Table
            dataSource={systemRules.cronJobs.jobs}
            rowKey="name"
            pagination={false}
            size="small"
            columns={[
              { title: '任务名称', dataIndex: 'name', key: 'name', render: (v) => <Text strong>{v}</Text> },
              { title: '路径', dataIndex: 'path', key: 'path', render: (v) => <Text code>{v}</Text> },
              {
                title: '执行时间 (北京)',
                dataIndex: 'schedule',
                key: 'schedule',
                render: (v) => <Tag color="blue">{v}</Tag>,
              },
              {
                title: 'UTC 时间',
                dataIndex: 'scheduleUTC',
                key: 'scheduleUTC',
                render: (v) => <Tag>{v}</Tag>,
              },
              { title: '频率', dataIndex: 'frequency', key: 'frequency' },
              { title: '说明', dataIndex: 'description', key: 'description' },
            ]}
          />

          <Divider />
          <Title level={5}>执行顺序要求</Title>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {systemRules.cronJobs.executionOrder.map((item, idx) => (
              <li key={idx}>
                <Text type="warning">{item}</Text>
              </li>
            ))}
          </ul>
        </Card>

        {/* 安全规则 */}
        <Card
          title={
            <Space>
              <SafetyOutlined />
              {systemRules.security.title}
            </Space>
          }
        >
          <Collapse defaultActiveKey={['authentication']}>
            {/* 认证规则 */}
            <Panel header={systemRules.security.rules.authentication.title} key="authentication">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {systemRules.security.rules.authentication.items.map((item, idx) => (
                  <li key={idx}>
                    <Text>{item}</Text>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* 频率限制 */}
            <Panel header={systemRules.security.rules.rateLimit.title} key="rateLimit">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {systemRules.security.rules.rateLimit.items.map((item, idx) => (
                  <li key={idx}>
                    <Text>{item}</Text>
                  </li>
                ))}
              </ul>
            </Panel>
          </Collapse>
        </Card>
      </Space>
    </PageContainer>
  );
};

export default SystemRulesPage;
