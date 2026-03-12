import { PageContainer } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Card, Form, InputNumber, message, Space, Spin, Typography } from 'antd';
import { getAdminParams, setAdminParam } from '../../../services/system-params';

const { Text } = Typography;

const BasicParams: React.FC = () => {
  const [form] = Form.useForm();

  const { loading } = useRequest(getAdminParams, {
    onSuccess: (res) => {
      const list: any[] = (res as any)?.data ?? res ?? [];
      const params: Record<string, string> = {};
      for (const p of list) {
        params[p.key] = p.value;
      }
      form.setFieldsValue({ usd_cny_rate: parseFloat(params['usd_cny_rate'] || '7.3') });
    },
  });

  const { loading: saving, run: save } = useRequest(
    async (values: { usd_cny_rate: number }) => {
      await setAdminParam('usd_cny_rate', String(values.usd_cny_rate));
    },
    {
      manual: true,
      onSuccess: () => message.success('保存成功'),
      onError: () => message.error('保存失败'),
    },
  );

  return (
    <PageContainer>
      <Card title="后台基础参数" style={{ maxWidth: 600 }}>
        <Spin spinning={loading}>
          <Form form={form} layout="vertical" onFinish={save}>
            <Form.Item
              label={
                <Space>
                  <span>USD/CNY 汇率</span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    用于数据分析页人民币收入转美元
                  </Text>
                </Space>
              }
              name="usd_cny_rate"
              rules={[{ required: true, message: '请输入汇率' }]}
            >
              <InputNumber min={1} max={20} precision={4} style={{ width: 160 }} addonAfter="CNY / 1 USD" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>
                保存
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </PageContainer>
  );
};

export default BasicParams;
