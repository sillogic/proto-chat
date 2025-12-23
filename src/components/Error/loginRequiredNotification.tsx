import { t } from 'i18next';
import { ShieldAlert } from 'lucide-react';

import { notification } from '@/components/AntdStaticMethods';

import RedirectLogin from './RedirectLogin';

export const loginRequired = {
  redirect: ({ timeout = 2000 }: { timeout?: number } = {}) => {
    notification.error({
      description: <RedirectLogin timeout={timeout} />,
      duration: timeout / 1000,
      icon: <ShieldAlert size={24} style={{ color: '#faad14' }} />,
      message: t('loginRequired.title', { ns: 'error' }),
      showProgress: true,
      type: 'warning',
    });
  },
};
