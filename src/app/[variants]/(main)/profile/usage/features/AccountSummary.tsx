'use client';

import { ProCard } from '@ant-design/pro-components';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { Card, Col, Progress, Row, Space, Tag, Tooltip, Typography } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface AccountSummaryProps {
  data?: any;
  isLoading?: boolean;
}

const AccountSummary = memo<AccountSummaryProps>(({ data, isLoading }) => {
  useTranslation('auth');

  if (isLoading) return <Card loading />;
  if (!data) return null;

  return (
    <div style={{ marginBlock: 24 }}>
      <Row gutter={[24, 24]}>
        <Col lg={10} md={24} span={24}>
          <ProCard
            extra={
              <Tooltip title="包含对话、向量化、绘图等所有消耗。每周期重置一次。">
                <QuestionCircleOutlined />
              </Tooltip>
            }
            headerBordered
            style={{ borderRadius: '12px', height: '100%' }}
            title={
              <Space>
                <span aria-label="credits" role="img">
                  💎
                </span>
                <span>计算积分额度</span>
              </Space>
            }
          >
            <div style={{ paddingBlock: '8px' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', marginBlockEnd: 8 }}
              >
                <Text type="secondary">本期已消耗</Text>
                <Text strong style={{ fontSize: '18px' }}>
                  {Number(data.balance?.totalConsumed || 0).toLocaleString()} /{' '}
                  {Number(data.balance?.limit || 0).toLocaleString()}
                </Text>
              </div>
              <Progress
                percent={Math.min(
                  100,
                  (Number(data.balance?.totalConsumed || 0) /
                    Math.max(1, Number(data.balance?.limit || 0))) *
                    100,
                )}
                showInfo={false}
                size={[-1, 12]}
                strokeColor={{ '0%': '#1890ff', '100%': '#36cfc9' }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBlockStart: 12,
                }}
              >
                <Text style={{ fontSize: '12px' }} type="secondary">
                  下一重置日: {data.resetCountdown?.nextResetDate || '-'}
                </Text>
                <Tag bordered={false} color="processing">
                  {data.balance?.currentPlan || '免费版'}
                </Tag>
              </div>
            </div>
          </ProCard>
        </Col>
        <Col lg={14} md={24} span={24}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <ProCard headerBordered style={{ borderRadius: '12px' }} title="文件存储">
                <div
                  style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}
                >
                  <Progress
                    format={(p) => `${p?.toFixed(0)}%`}
                    percent={Math.min(
                      100,
                      (Number(data.storage?.totalSizeMB || 0) /
                        Math.max(1, Number(data.storage?.limitMB || 1))) *
                        100,
                    )}
                    size={60}
                    type="circle"
                  />
                  <div style={{ textAlign: 'right' }}>
                    <Text strong style={{ fontSize: '16px' }}>
                      {data.storage?.totalSizeMB} MB
                    </Text>
                    <br />
                    <Text type="secondary">上限 {data.storage?.limitMB} MB</Text>
                  </div>
                </div>
              </ProCard>
            </Col>
            <Col span={12}>
              <ProCard headerBordered style={{ borderRadius: '12px' }} title="向量存储">
                <div
                  style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}
                >
                  <Progress
                    format={(p) => `${p?.toFixed(0)}%`}
                    percent={Math.min(
                      100,
                      (Number(data.vectors?.count || 0) /
                        Math.max(1, Number(data.vectors?.limit || 1))) *
                        100,
                    )}
                    size={60}
                    strokeColor="#722ed1"
                    type="circle"
                  />
                  <div style={{ textAlign: 'right' }}>
                    <Text strong style={{ fontSize: '16px' }}>
                      {data.vectors?.count || 0}
                    </Text>
                    <br />
                    <Text type="secondary">上限 {data.vectors?.limit || 0} 条</Text>
                  </div>
                </div>
              </ProCard>
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
});

export default AccountSummary;
