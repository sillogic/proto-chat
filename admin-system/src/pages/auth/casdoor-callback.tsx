import React, { useEffect, useState } from 'react';
import { useModel, history } from '@umijs/max';
import { Spin, Result, Button } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';

const CasdoorCallback: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { setInitialState } = useModel('@@initialState');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URL(window.location.href);
        const code = urlParams.searchParams.get('code');
        const state = urlParams.searchParams.get('state');
        const error = urlParams.searchParams.get('error');
        const errorDescription = urlParams.searchParams.get('error_description');

        console.log('🔍 Casdoor callback params:', {
          code: code ? 'provided' : 'missing',
          state: state ? 'provided' : 'missing',
          error,
          errorDescription
        });

        if (error) {
          throw new Error(errorDescription || error);
        }

        if (!code || !state) {
          throw new Error('授权码或状态参数缺失');
        }

        // 调用后端API处理回调
        const response = await fetch(`/api/auth/casdoor/callback?code=${code}&state=${state}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || '登录失败');
        }

        // 保存token和用户信息
        localStorage.setItem('admin-token', result.data.token);
        localStorage.setItem('admin-user', JSON.stringify(result.data.user));

        // 更新全局状态
        if (setInitialState) {
          setInitialState((s) => ({
            ...s,
            currentUser: result.data.user,
          }));
        }

        // 跳转到目标页面
        const redirectTo = result.data.redirectTo || '/dashboard';
        console.log('🔍 Redirecting to:', redirectTo);
        history.replace(redirectTo);

      } catch (err) {
        console.error('Casdoor callback error:', err);
        setError(err.message || '认证失败，请重试');
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [setInitialState]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
          正在完成认证...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="error"
        title="认证失败"
        subTitle={error}
        icon={<SafetyCertificateOutlined />}
        extra={[
          <Button type="primary" key="retry" onClick={() => history.push('/login')}>
            返回登录页
          </Button>,
          <Button key="home" onClick={() => history.push('/')}>
            返回首页
          </Button>,
        ]}
      />
    );
  }

  return null; // 成功时会自动跳转，不显示任何内容
};

export default CasdoorCallback;