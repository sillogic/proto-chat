'use client';

import { createStyles } from 'antd-style';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import ContactCard from './features/ContactCard';

const useStyles = createStyles(({ css, token }) => ({
  cardsContainer: css`
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
  `,
  subtitle: css`
    font-size: 16px;
    color: ${token.colorTextSecondary};
  `,
  title: css`
    font-size: 32px;
    font-weight: 700;
    color: ${token.colorText};
  `,
}));

interface ClientProps {
  mobile?: boolean;
}

const Client = memo<ClientProps>(() => {
  const { t } = useTranslation('contact');
  const { styles } = useStyles();

  return (
    <Flexbox align={'center'} gap={40} width={'100%'}>
      {/* Header */}
      <Flexbox align={'center'} gap={12}>
        <span className={styles.title}>{t('title')}</span>
        <span className={styles.subtitle}>{t('subtitle')}</span>
      </Flexbox>

      {/* Contact Cards */}
      <div className={styles.cardsContainer}>
        <ContactCard icon={Mail} title={t('email.title')} type="email" value={t('email.value')} />
        <ContactCard
          icon={Phone}
          placeholder={t('phone.placeholder')}
          title={t('phone.title')}
          type="phone"
        />
        <ContactCard
          icon={MessageCircle}
          placeholder={t('wechat.placeholder')}
          title={t('wechat.title')}
          type="wechat"
        />
      </div>
    </Flexbox>
  );
});

Client.displayName = 'ContactClient';

export default Client;
