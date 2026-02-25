import { DesktopProfileBillingPage } from '@/app/[variants]/(main)/subscription/billing';

interface BillingProps {
  mobile?: boolean;
}

export default function Billing({ mobile }: BillingProps) {
  return <DesktopProfileBillingPage />;
}
