'use client';

import Client from './Client';

const MobileProfileBillingPage = () => {
  return <Client mobile />;
};

const DesktopProfileBillingPage = () => {
  return <Client mobile={false} />;
};

export { DesktopProfileBillingPage, MobileProfileBillingPage };
