import { Button, message, Space, Typography, Tag } from 'antd';
import { LucideShieldCheck, LucideActivity, LucideAlertCircle } from 'lucide-react';
import { LOBE_DEFAULT_MODEL_LIST } from 'model-bank';
import React, { useState } from 'react';
import { Flexbox } from 'react-layout-kit';
import { checkAiProvider, AiProviderConfig } from '@/services/ai-provider';

const { Text } = Typography;

interface CheckerProps {
  id: string;
  config?: AiProviderConfig;
}

const Checker: React.FC<CheckerProps> = ({ id, config }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleCheck = async () => {
    // Find a default model for this provider
    const defaultModel = LOBE_DEFAULT_MODEL_LIST.find((m: any) => m.providerId === id)?.id;
    
    if (!defaultModel) {
      message.error('未找到可用于测试的模型');
      return;
    }

    setLoading(true);
    setStatus('idle');
    try {
      const res = await checkAiProvider({
        id,
        model: defaultModel,
        // 如果 config 为空，则从表单数据检查（这里简化为只检查已保存的）
      });
      
      if (res.success) {
        setStatus('success');
        message.success('连接测试通过');
      } else {
        setStatus('error');
        setErrorMsg(res.message || '连接测试错误');
      }
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e.message || '网络连接异常');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flexbox horizontal align="center" justify="space-between">
      <Space>
        {status === 'idle' && <LucideShieldCheck size={20} color="#8c8c8c" />}
        {status === 'success' && <LucideShieldCheck size={20} color="#52c41a" />}
        {status === 'error' && <LucideAlertCircle size={20} color="#ff4d4f" />}
        <Flexbox>
          <Text strong>连通性测试</Text>
          <Text type="secondary">
            {status === 'idle' && '测试当前配置是否可正常连接到服务商'}
            {status === 'success' && <span style={{ color: '#52c41a' }}>连接正常</span>}
            {status === 'error' && <span style={{ color: '#ff4d4f' }}>连接失败: {errorMsg}</span>}
          </Text>
        </Flexbox>
      </Space>
      <Button 
        icon={<LucideActivity size={14} />} 
        loading={loading} 
        onClick={handleCheck}
      >
        检查
      </Button>
    </Flexbox>
  );
};

export default Checker;
