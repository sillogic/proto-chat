import { Suspense } from 'react';

import SkeletonLoading from '@/components/Loading/SkeletonLoading';

import OrdersContent from './features/OrdersContent';

const OrdersPage = () => {
  return (
    <Suspense fallback={<SkeletonLoading paragraph={{ rows: 8 }} title={false} />}>
      <OrdersContent />
    </Suspense>
  );
};

OrdersPage.displayName = 'ProfileOrdersPage';

export default OrdersPage;
