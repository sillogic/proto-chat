import { t } from 'i18next';
import { AlertTriangle } from 'lucide-react';

import { notification } from '@/components/AntdStaticMethods';

import Description from './Description';

export const fetchErrorNotification = {
  error: ({ status, errorMessage }: { errorMessage: string; status: number }) => {
    notification.error({
      description: <Description message={errorMessage} status={status} />,
      icon: <AlertTriangle size={24} style={{ color: '#ff4d4f' }} />,
      message: t('fetchError.title', { ns: 'error' }),
      type: 'error',
    });
  },
};
