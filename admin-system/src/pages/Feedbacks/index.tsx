import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Select,
  Input,
  Popconfirm,
  Typography,
  Descriptions,
  message,
  Card,
  Row,
  Col,
  Form,
} from 'antd';
import {
  EyeOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { request } from '@umijs/max';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

type FeedbackStatus = 'pending' | 'read' | 'resolved';

interface ClientInfo {
  url?: string;
  userAgent?: string;
  language?: string;
  timezone?: string;
}

interface FeedbackItem {
  id: string;
  userId: string;
  userEmail: string | null;
  title: string;
  message: string;
  screenshotUrl: string | null;
  clientInfo: ClientInfo | null;
  status: FeedbackStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  pending: 'orange',
  read: 'blue',
  resolved: 'green',
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: '待处理',
  read: '已查看',
  resolved: '已解决',
};

const FeedbacksPage: React.FC = () => {
  const [data, setData] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  const [detailItem, setDetailItem] = useState<FeedbackItem | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editStatus, setEditStatus] = useState<FeedbackStatus>('pending');
  const [editNote, setEditNote] = useState('');

  const fetchData = useCallback(async (currentPage = page, currentPageSize = pageSize) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: currentPage, pageSize: currentPageSize };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchText.trim()) params.search = searchText.trim();

      const res = await request<{ success: boolean; data: FeedbackItem[]; total: number }>(
        '/api/admin/feedbacks',
        { method: 'GET', params },
      );
      if (res.success) {
        setData(res.data);
        setTotal(res.total);
      }
    } catch {
      message.error('获取反馈列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, searchText]);

  useEffect(() => {
    fetchData(1, pageSize);
    setPage(1);
  }, [statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchData(1, pageSize);
  };

  const openDetail = async (item: FeedbackItem) => {
    setDetailItem(item);
    setEditStatus(item.status);
    setEditNote(item.adminNote ?? '');
    setDetailVisible(true);

    // Mark as read if still pending
    if (item.status === 'pending') {
      try {
        await request(`/api/admin/feedbacks/${item.id}`, {
          method: 'PUT',
          data: { status: 'read', adminNote: item.adminNote ?? '' },
        });
        setData((prev) =>
          prev.map((d) => (d.id === item.id ? { ...d, status: 'read' } : d)),
        );
        setDetailItem((prev) => (prev ? { ...prev, status: 'read' } : prev));
        setEditStatus('read');
      } catch {
        // Non-critical, ignore
      }
    }
  };

  const handleUpdateStatus = async () => {
    if (!detailItem) return;
    setUpdating(true);
    try {
      const res = await request<{ success: boolean; data: FeedbackItem }>(
        `/api/admin/feedbacks/${detailItem.id}`,
        { method: 'PUT', data: { status: editStatus, adminNote: editNote } },
      );
      if (res.success) {
        message.success('已更新');
        setDetailItem(res.data);
        setData((prev) => prev.map((d) => (d.id === detailItem.id ? res.data : d)));
        setDetailVisible(false);
        fetchData();
      }
    } catch {
      message.error('更新失败');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await request(`/api/admin/feedbacks/${id}`, { method: 'DELETE' });
      message.success('已删除');
      fetchData();
    } catch {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<FeedbackItem> = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
      title: '提交时间',
      width: 150,
    },
    {
      dataIndex: 'userEmail',
      key: 'userEmail',
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
      title: '用户邮箱',
      width: 200,
    },
    {
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      title: '标题',
    },
    {
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (v: string) => <Text type="secondary">{v}</Text>,
      title: '内容摘要',
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: (v: FeedbackStatus) => (
        <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v]}</Tag>
      ),
      title: '状态',
      width: 90,
    },
    {
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            type="link"
            onClick={() => openDetail(record)}
          >
            查看
          </Button>
          <Popconfirm title="确定删除该反馈？" onConfirm={() => handleDelete(record.id)}>
            <Button danger icon={<DeleteOutlined />} size="small" type="link" />
          </Popconfirm>
        </Space>
      ),
      title: '操作',
      width: 120,
    },
  ];

  return (
    <>
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Row gutter={12} align="middle">
          <Col>
            <Select
              style={{ width: 120 }}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              options={[
                { label: '全部状态', value: 'all' },
                { label: '待处理', value: 'pending' },
                { label: '已查看', value: 'read' },
                { label: '已解决', value: 'resolved' },
              ]}
            />
          </Col>
          <Col flex={1}>
            <Input
              allowClear
              placeholder="搜索标题 / 内容 / 邮箱"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              style={{ maxWidth: 320 }}
            />
          </Col>
          <Col>
            <Space>
              <Button icon={<SearchOutlined />} type="primary" onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table<FeedbackItem>
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
            fetchData(p, ps);
          },
        }}
      />

      <Modal
        open={detailVisible}
        title="反馈详情"
        width={720}
        onCancel={() => setDetailVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            <Button loading={updating} type="primary" onClick={handleUpdateStatus}>
              保存状态
            </Button>
          </Space>
        }
      >
        {detailItem && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="提交时间" span={1}>
                {dayjs(detailItem.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="用户邮箱" span={1}>
                {detailItem.userEmail || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="用户ID" span={2}>
                <Text code copyable>{detailItem.userId}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>
                {detailItem.title}
              </Descriptions.Item>
              <Descriptions.Item label="反馈内容" span={2}>
                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {detailItem.message}
                </Paragraph>
              </Descriptions.Item>
              {detailItem.screenshotUrl && (
                <Descriptions.Item label="截图" span={2}>
                  <a href={detailItem.screenshotUrl} rel="noreferrer" target="_blank">
                    <img
                      alt="screenshot"
                      src={detailItem.screenshotUrl}
                      style={{ borderRadius: 4, maxHeight: 240, maxWidth: '100%' }}
                    />
                  </a>
                </Descriptions.Item>
              )}
              {detailItem.clientInfo?.url && (
                <Descriptions.Item label="页面 URL" span={2}>
                  <Text code>{detailItem.clientInfo.url}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Form layout="vertical">
              <Form.Item label="处理状态">
                <Select
                  value={editStatus}
                  onChange={(v) => setEditStatus(v)}
                  options={[
                    { label: '待处理', value: 'pending' },
                    { label: '已查看', value: 'read' },
                    { label: '已解决', value: 'resolved' },
                  ]}
                  style={{ width: 160 }}
                />
              </Form.Item>
              <Form.Item label="备注（仅内部可见）">
                <Input.TextArea
                  rows={3}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="添加处理备注..."
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </>
  );
};

export default FeedbacksPage;
