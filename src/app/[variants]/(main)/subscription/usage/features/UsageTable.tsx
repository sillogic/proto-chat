import { Tag } from '@lobehub/ui';
import type { TableColumnType} from 'antd';
import { Table, Typography } from 'antd';
import { memo } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import { usageService } from '@/services/usage';
import dayjs from 'dayjs';

import { formatNumber } from '@/utils/format';

const UsageTable = memo(() => {
  const { data, isLoading } = useClientDataSWR('transactions-preview', async () =>
    usageService.getTransactions({ limit: 10, offset: 0 }),
  );

  const columns: TableColumnType<any>[] = [
    {
      dataIndex: 'id',
      key: 'id',
      render: (id) => (
        <Typography.Text copyable style={{ color: '#8c8c8c', fontSize: '12px' }}>
          {id}
        </Typography.Text>
      ),
      title: '交易流水号',
      width: 150,
    },
    {
      dataIndex: 'category',
      key: 'category',
      render: (category) => {
        const categoryMap: any = {
          ADJUSTMENT: { color: 'purple', label: '人工调账' },
          CONSUMPTION: { color: 'orange', label: 'AI消费' },
          DEPOSIT: { color: 'green', label: '赠送/充值' },
          IMAGE_GENERATION: { color: 'gold', label: '图片生成' },
          REFUND: { color: 'blue', label: '退款' },
          RESET: { color: 'default', label: '周期重置' },
        };
        const item = categoryMap[category] || { color: 'default', label: category };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
      title: '业务类别',
      width: 120,
    },
    {
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag>{type}</Tag>,
      title: '交易类型',
      width: 100,
    },
    {
      dataIndex: 'amount',
      key: 'amount',
      render: (value) => {
        const num = Number(value);
        const prefix = num > 0 ? '+' : '';
        const color = num > 0 ? 'green' : 'red';
        return (
          <Typography.Text style={{ color }}>
            {prefix}
            {formatNumber(num, 0)}
          </Typography.Text>
        );
      },
      title: '变动数额',
    },
    {
      dataIndex: 'balanceAfter',
      key: 'balanceAfter',
      render: (value) => formatNumber(Number(value || 0), 0),
      title: '变动后余额',
    },
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
      title: '时间',
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data?.list || []}
      loading={isLoading}
      pagination={false}
      rowKey="id"
      size="small"
    />
  );
});

export default UsageTable;
