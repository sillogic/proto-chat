import { PageContainer } from '@ant-design/pro-components';

/**
 * Embeds Bull Board UI via iframe.
 * Bull Board is served by the Express backend at /queues.
 */
const QueuesPage: React.FC = () => {
  return (
    <PageContainer title={false} style={{ height: '100%' }}>
      <iframe
        src="/queues"
        style={{
          border: 'none',
          height: 'calc(100vh - 120px)',
          width: '100%',
        }}
        title="Bull Board"
      />
    </PageContainer>
  );
};

export default QueuesPage;
