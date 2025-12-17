import { useEffect, useState } from 'react';
import { history, useModel } from '@umijs/max';
import { Spin, Result, Button } from 'antd';
import { handleCasdoorCallback } from '@/services/admin';

const CasdoorCallback: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setInitialState } = useModel('@@initialState');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URL(window.location.href).searchParams;
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (!code) {
          setError('授权码缺失');
          setLoading(false);
          return;
        }

        // 调用后端处理回调
        const result = await handleCasdoorCallback(code, state || '');

        if (result.success && result.data) {
          // 保存token和用户信息
          localStorage.setItem('admin-token', result.data.token);
          localStorage.setItem('admin-user', JSON.stringify(result.data.user));

          // 更新全局状态
          setInitialState((s: any) => ({
            ...s,
            currentUser: result.data.user,
          }));

          // 跳转到目标页面
          const redirectTo = result.data.redirectTo || '/dashboard';
          history.push(redirectTo);
        } else {
          setError(result.message || '登录失败');
          setLoading(false);
        }
      } catch (err) {
        console.error('Casdoor callback error:', err);
        setError('处理登录回调时发生错误');
        setLoading(false);
      }
    };

    handleCallback();
  }, [history, setInitialState]);

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
          正在处理登录...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh'
    }}>
      <Result
        status="error"
        title="登录失败"
        subTitle={error}
        extra={[
          <Button type="primary" key="retry" onClick={() => history.push('/user/login')}>
            返回登录页面
          </Button>,
        ]}
      />
    </div>
  );
};

export default CasdoorCallback;