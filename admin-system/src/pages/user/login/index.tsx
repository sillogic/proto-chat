import { LockOutlined, UserOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { useEmotionCss } from '@ant-design/use-emotion-css';
import { Helmet, history, useModel } from '@umijs/max';
import { Alert, Button, message, Tabs, Space, Divider } from 'antd';
import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { adminLogin, getCasdoorAuthUrl } from '@/services/admin';
import type { LoginParams } from '@/services/api.d';

const Lang = () => {
  const lang = useEmotionCss(({ token }) => {
    return {
      width: 42,
      height: 42,
      lineHeight: '42px',
      position: 'fixed',
      right: 16,
      borderRadius: token.borderRadius,
      ':hover': {
        backgroundColor: token.colorBgTextHover,
      },
    };
  });

  return (
    <div className={lang}>
      {/* 可以在这里添加语言切换组件 */}
    </div>
  );
};

const LoginMessage: React.FC<{
  content: string;
  type: 'error' | 'info';
}> = ({ content, type }) => {
  const style = useEmotionCss(({ token }) => {
    return {
      marginBottom: 24,
    };
  });

  return (
    <Alert
      style={style}
      message={content}
      type={type}
      showIcon
      closable
    />
  );
};

const Login: React.FC = () => {
  const [userLoginState, setUserLoginState] = useState<{ status?: string; type?: string }>({});
  const [type, setType] = useState<string>('account');
  const { initialState, setInitialState } = useModel('@@initialState');

  const containerClassName = useEmotionCss(() => {
    return {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'auto',
      backgroundImage:
        "url('https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/V-_oS6r-i7wAAAAAAAAAAAAAFl94AQBr')",
      backgroundSize: '100% 100%',
    };
  });

  const fetchUserInfo = async () => {
    const userInfo = await initialState?.fetchUserInfo?.();
    if (userInfo) {
      flushSync(() => {
        setInitialState((s) => ({
          ...s,
          currentUser: userInfo,
        }));
      });
    }
  };

  const handleSubmit = async (values: LoginParams) => {
    try {
      // 调用管理后台登录API
      const result = await adminLogin(values);

      if (result.success && result.data) {
        message.success('登录成功！');

        // 保存token到localStorage
        localStorage.setItem('admin-token', result.data.token);
        localStorage.setItem('admin-user', JSON.stringify(result.data.user));

        // 获取当前用户信息
        await fetchUserInfo();
        const urlParams = new URL(window.location.href).searchParams;
        history.push(urlParams.get('redirect') || '/dashboard');
        return;
      }

      // 如果失败去设置用户错误信息
      setUserLoginState({ status: 'error', type: 'account' });
      message.error(result.message || '登录失败，请检查用户名和密码');
    } catch (error) {
      const defaultLoginFailureMessage = '登录失败，请重试！';
      console.log(error);
      message.error(defaultLoginFailureMessage);
    }
  };

  const handleCasdoorLogin = async () => {
    try {
      const urlParams = new URL(window.location.href).searchParams;
      const redirectTo = urlParams.get('redirect') || '/dashboard';

      const result = await getCasdoorAuthUrl(redirectTo);

      if (result.success && result.data) {
        // 跳转到Casdoor登录页面
        window.location.href = result.data.authUrl;
      } else {
        message.error('获取Casdoor授权URL失败');
      }
    } catch (error) {
      console.error('Casdoor login error:', error);
      message.error('Casdoor登录失败，请重试');
    }
  };

  return (
    <div className={containerClassName}>
      <Helmet>
        <title>
          登录页 - ProtoChat 后台管理系统
        </title>
      </Helmet>
      <Lang />
      <div
        style={{
          flex: '1',
          padding: '32px 0',
        }}
      >
        <LoginForm
          contentStyle={{
            minWidth: 280,
            maxWidth: '75vw',
          }}
          logo={<img alt="logo" src="/logo.svg" />}
          title="ProtoChat 后台管理系统"
          subTitle={' '}
          initialValues={{
            autoLogin: true,
          }}
          actions={[]}
          onFinish={async (values) => {
            await handleSubmit(values as LoginParams);
          }}
        >
          <Tabs
            activeKey={type}
            onChange={setType}
            centered
            items={[
              {
                key: 'account',
                label: '账户密码登录',
              },
              {
                key: 'casdoor',
                label: 'SSO登录',
              },
            ]}
          />

          {userLoginState.status === 'error' && userLoginState.type === 'account' && (
            <LoginMessage content={'错误的用户名和密码'} type={'error'} />
          )}
          {type === 'account' && (
            <>
              <ProFormText
                name="username"
                fieldProps={{
                  size: 'large',
                  prefix: <UserOutlined />,
                }}
                placeholder={'用户名: admin'}
                rules={[
                  {
                    required: true,
                    message: '用户名是必填项！',
                  },
                ]}
              />
              <ProFormText.Password
                name="password"
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                }}
                placeholder={'密码: admin123'}
                rules={[
                  {
                    required: true,
                    message: '密码是必填项！',
                  },
                ]}
              />

              <div
                style={{
                  marginBottom: 24,
                  textAlign: 'center',
                }}
              >
                默认账号: admin / admin123
              </div>
            </>
          )}

          {type === 'casdoor' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ marginBottom: 16 }}>
                <SafetyCertificateOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              </div>
              <h3 style={{ marginBottom: 8, color: '#262626' }}>Casdoor 单点登录</h3>
              <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
                使用企业统一身份认证系统安全登录
              </p>
              <Button
                type="primary"
                size="large"
                block
                onClick={handleCasdoorLogin}
                style={{ height: 48, fontSize: 16 }}
              >
                使用 Casdoor 登录
              </Button>
            </div>
          )}
        </LoginForm>
      </div>
    </div>
  );
};

export default Login;