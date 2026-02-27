import { Suspense } from 'react';

import SkeletonLoading from '@/components/Loading/SkeletonLoading';

import TransactionsContent from './features/TransactionsContent';

const TransactionsPage = () => {
  return (
    <Suspense fallback={<SkeletonLoading paragraph={{ rows: 8 }} title={false} />}>
      <TransactionsContent />
    </Suspense>
  );
};

TransactionsPage.displayName = 'ProfileUsageTransactionsPage';

export default TransactionsPage;
