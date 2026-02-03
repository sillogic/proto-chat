'use client';

import { Button, Highlighter, Icon } from '@lobehub/ui';
import { Result } from 'antd';
import { ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseAsString, useQueryState } from 'nuqs';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

const FailedPage = memo(() => {
  const { t } = useTranslation('oauth');
  const [reason] = useQueryState('reason');
  const [errorMessage] = useQueryState<string>('errorMessage', parseAsString);
  const navigate = useNavigate();
  return (
    <Result
      extra={
          <Button onClick={() => navigate('/')} type="primary">{t('error.backToHome')}</Button>
      }
      icon={<Icon icon={ShieldX} />}
      status="error"
      subTitle={
        <Flexbox gap={8}>
          {t('error.desc', {
            reason: t(`error.reason.${reason}` as any, { defaultValue: reason }),
          })}

          {!!errorMessage && <Highlighter language={'log'}>{errorMessage}</Highlighter>}
        </Flexbox>
      }
      title={t('error.title')}
    />
  );
});

FailedPage.displayName = 'FailedPage';

export default FailedPage;
