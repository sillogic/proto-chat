import Client from './Client';

const MobileProfileUsagePage = () => {
  return <Client mobile={true} />;
};

const DesktopProfileUsagePage = () => {
  return <Client mobile={false} />;
};

export { DesktopProfileUsagePage, MobileProfileUsagePage };
