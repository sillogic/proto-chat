import { DesktopSubscriptionPlansPage } from '@/app/[variants]/(main)/subscription/plans';

interface PlansProps {
  mobile?: boolean;
}

export default function Plans({ mobile }: PlansProps) {
  return <DesktopSubscriptionPlansPage />;
}
