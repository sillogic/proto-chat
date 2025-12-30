'use client';

import { Icon } from '@lobehub/ui';
import { Button, QRCode } from 'antd';
import { createStyles } from 'antd-style';
import { Copy, Mail } from 'lucide-react';
import { memo } from 'react';
import { Center, Flexbox } from 'react-layout-kit';

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  card: css`
    flex: 1;

    min-width: 200px;
    padding: 24px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 16px;

    background: ${isDarkMode ? token.colorBgElevated : token.colorBgContainer};

    transition: all 0.3s ease;

    &:hover {
      border-color: ${token.colorPrimary};
      box-shadow: 0 4px 12px ${isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'};
    }
  `,
  iconContainer: css`
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: ${token.colorPrimaryBg};
  `,
  placeholder: css`
    padding-block: 16px;
    padding-inline: 24px;
    border-radius: 8px;

    font-size: 14px;
    color: ${token.colorTextQuaternary};

    background: ${token.colorFillQuaternary};
  `,
  title: css`
    font-size: 14px;
    font-weight: 500;
    color: ${token.colorTextSecondary};
  `,
  value: css`
    font-size: 16px;
    font-weight: 500;
    color: ${token.colorText};
  `,
}));

interface ContactCardProps {
  icon: typeof Mail;
  onClick?: () => void;
  placeholder?: string;
  qrCode?: string;
  title: string;
  type: 'email' | 'phone' | 'wechat';
  value?: string;
}

const ContactCard = memo<ContactCardProps>(({ title, value, placeholder, icon, qrCode }) => {
  const { styles, theme } = useStyles();

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
    }
  };

  return (
    <Flexbox className={styles.card} gap={16}>
      <Flexbox align={'center'} gap={12} horizontal>
        <Center className={styles.iconContainer}>
          <Icon color={theme.colorPrimary} icon={icon} size={24} />
        </Center>
        <span className={styles.title}>{title}</span>
      </Flexbox>

      {value ? (
        <Flexbox align={'center'} gap={8} horizontal justify={'space-between'}>
          <span className={styles.value}>{value}</span>
          <Button
            icon={<Icon icon={Copy} size={16} />}
            onClick={handleCopy}
            size="small"
            type="text"
          />
        </Flexbox>
      ) : qrCode ? (
        <Center>
          <QRCode size={160} value={qrCode} />
        </Center>
      ) : (
        <div className={styles.placeholder}>{placeholder}</div>
      )}
    </Flexbox>
  );
});

ContactCard.displayName = 'ContactCard';

export default ContactCard;
