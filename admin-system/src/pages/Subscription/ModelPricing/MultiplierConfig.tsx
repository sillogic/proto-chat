import { SaveOutlined } from '@ant-design/icons';
import { Modal, Form, InputNumber, message, Typography, Space } from 'antd';
import React, { useEffect, useState } from 'react';
import { getProtoChatSettings, updateProtoChatSettings } from '@/services/protochat';

const { Text } = Typography;

interface MultiplierConfigProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MultiplierConfig: React.FC<MultiplierConfigProps> = ({ open, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMultiplier();
    }
  }, [open]);

  const fetchMultiplier = async () => {
    setLoading(true);
    try {
      const res = await getProtoChatSettings();
      if (res.success) {
        const multiplier = res.data.pricing_multiplier?.value || 1;
        form.setFieldsValue({ pricing_multiplier: multiplier });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const res = await updateProtoChatSettings({
        id: 'pricing_multiplier',
        value: values.pricing_multiplier,
        description: '定价系数：用户价 = 成本价 x 系数',
      });
      if (res.success) {
        message.success('定价系数保存成功');
        onSuccess();
        onClose();
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (error) {
      // Form validation error
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="定价系数配置"
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      okButtonProps={{ icon: <SaveOutlined /> }}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
        <Form.Item
          label="定价系数"
          name="pricing_multiplier"
          extra={
            <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
              <Text type="secondary">
                用户价格 = 成本价格 x 定价系数
              </Text>
              <Text type="secondary">
                例如：成本价 $1.00/M tokens，系数 1.5，则用户价 = $1.50/M tokens
              </Text>
              <Text type="secondary">
                设为 1.0 表示成本价 = 用户价（无利润）
              </Text>
            </Space>
          }
          rules={[
            { required: true, message: '请输入定价系数' },
            {
              type: 'number',
              min: 0,
              message: '系数必须大于等于0',
            },
          ]}
        >
          <InputNumber
            min={0}
            max={10}
            step={0.1}
            precision={2}
            style={{ width: '100%' }}
            disabled={loading}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MultiplierConfig;
