import { FundOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Result } from 'antd';

/**
 * Queue Monitor page.
 * Bull Board runs on the Express backend at /queues.
 * Opens in a new tab since it has its own SPA routing.
 *
 * URL logic:
 *  - Dev (port 8001): frontend and backend are separate → link to http://localhost:8002/queues
 *  - Prod (port 8002): Express serves both frontend and Bull Board → relative /queues
 */
const QueuesPage: React.FC = () => {
  // Dev: frontend on 8001, backend on 8002 → need to cross to backend port
  // Prod: everything on 8002 → relative path works
  const isDev = window.location.port === '8001';
  const bullBoardUrl = isDev
    ? `${window.location.protocol}//${window.location.hostname}:8002/queues`
    : '/queues';

  return (
    <PageContainer>
      <Result
        extra={
          <Button href={bullBoardUrl} icon={<FundOutlined />} size="large" target="_blank" type="primary">
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
