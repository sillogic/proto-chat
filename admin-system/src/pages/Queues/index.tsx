import { FundOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Result } from 'antd';

/**
 * Queue Monitor page.
 * Bull Board runs on the Express backend at /queues.
 * Opens in a new tab since it has its own SPA routing.
 */
const QueuesPage: React.FC = () => {
  return (
    <PageContainer>
      <Result
        extra={
          <Button href="/queues" icon={<FundOutlined />} size="large" target="_blank" type="primary">
            打开队列监控面板
          </Button>
        }
        icon={<FundOutlined />}
        subTitle="查看所有 BullMQ 队列的实时状态：待处理、进行中、已完成、失败任务等"
        title="BullMQ 队列监控"
      />
    </PageContainer>
  );
};

export default QueuesPage;
