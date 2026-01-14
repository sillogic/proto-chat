import { DynamicLayoutProps } from '@/types/next';
import { RouteVariants } from '@/utils/server/routeVariants';

import DesktopRouter from '../DesktopRouter';
import MobileRouter from '../MobileRouter';

export default async (props: DynamicLayoutProps) => {
  const isMobile = await RouteVariants.getIsMobile(props);
  const { locale } = await RouteVariants.getVariantsFromProps(props);

  if (isMobile) {
    return <MobileRouter locale={locale} />;
  }

  return <DesktopRouter locale={locale} />;
};
