import { Suspense } from 'react';

import SkeletonLoading from '@/components/Loading/SkeletonLoading';

import ConsumptionContent from './features/ConsumptionContent';

const ConsumptionPage = () => {
  return (
    <Suspense fallback={<SkeletonLoading paragraph={{ rows: 8 }} title={false} />}>
      <ConsumptionContent />
    </Suspense>
  );
};

ConsumptionPage.displayName = 'ProfileUsageConsumptionPage';

export default ConsumptionPage;
