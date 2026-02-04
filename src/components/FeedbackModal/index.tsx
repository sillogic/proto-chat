'use client';

import { Icon } from '@lobehub/ui';
import { App, Button, Form, Input, Modal, Rate } from 'antd';
import { createStyles } from 'antd-style';
import { MessageSquareHeart } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { BRANDING_NAME } from '@/const/branding';

const { TextArea } = Input;

const useStyles = createStyles(({ css, token }) => ({
  content: css`
    .ant-modal-content {
      padding: 24px;
    }
  `,
  header: css`
    display: flex;
    align-items: center;
    gap: 8px;

    margin-block-end: 16px;

    font-size: 18px;
    font-weight: 600;
  `,
  icon: css`
    color: ${token.colorPrimary};
  `,
}));

interface FeedbackModalProps {
  onClose: () => void;
  open: boolean;
}

const FeedbackModal = memo<FeedbackModalProps>(({ open, onClose }) => {
  const { t } = useTranslation('common');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      await form.validateFields();
      setLoading(true);

      // 模拟提交反馈
      await new Promise((resolve) => setTimeout(resolve, 500));

      message.success(t('feedback.submitSuccess'));
      form.resetFields();
      onClose();
    } catch {
      // 表单验证失败
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      centered
      className={styles.content}
      footer={
        <Flexbox gap={8} horizontal justify="flex-end">
          <Button onClick={handleCancel}>{t('cancel')}</Button>
          <Button loading={loading} onClick={handleSubmit} type="primary">
            {t('feedback.submit')}
          </Button>
        </Flexbox>
      }
      onCancel={handleCancel}
      open={open}
      title={
        <div className={styles.header}>
          <Icon className={styles.icon} icon={MessageSquareHeart} size={24} />
          <span>{t('footer.feedback.title')}</span>
        </div>
      }
      width={480}
    >
      <Flexbox gap={16}>
        <p style={{ color: 'var(--ant-color-text-secondary)', margin: 0 }}>
          {t('footer.feedback.desc', { appName: BRANDING_NAME })}
        </p>

        <Form form={form} layout="vertical">
          <Form.Item label={t('feedback.rating')} name="rating">
            <Rate />
          </Form.Item>

          <Form.Item
            label={t('feedback.content')}
            name="content"
            rules={[
              {
                message: t('feedback.contentRequired'),
                required: true,
              },
            ]}
          >
            <TextArea
              maxLength={1000}
              placeholder={t('feedback.placeholder')}
              rows={4}
              showCount
            />
          </Form.Item>

          <Form.Item label={t('feedback.contact')} name="contact">
            <Input placeholder={t('feedback.contactPlaceholder')} />
          </Form.Item>
        </Form>
      </Flexbox>
    </Modal>
  );
});

FeedbackModal.displayName = 'FeedbackModal';

export default FeedbackModal;
