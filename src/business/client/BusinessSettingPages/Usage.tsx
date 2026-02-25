import { DesktopProfileUsagePage } from '@/app/[variants]/(main)/subscription/usage';

interface UsageProps {
  mobile?: boolean;
}

export default function Usage({ mobile }: UsageProps) {
  return <DesktopProfileUsagePage />;
}
