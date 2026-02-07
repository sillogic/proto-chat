import dotenv from 'dotenv';

import fetch from 'node-fetch';
import crypto from 'node:crypto';

dotenv.config({ override: true });

// Casdoor配置
interface CasdoorConfig {
  adminPassword: string;
  adminUsername: string;
  applicationName: string;
  clientId: string;
  clientSecret: string;
  issuer: string;
  organizationName: string;
}

export class CasdoorSyncService {
  private config: CasdoorConfig;

  constructor() {
    const orgName = process.env.CASDOOR_ORG_NAME || 'protochat-admin';
    const appName = process.env.CASDOOR_APP_NAME || 'protochat-admin';

    this.config = {
      adminPassword: process.env.CASDOOR_ADMIN_PASSWORD || '123456',
      adminUsername: process.env.CASDOOR_ADMIN_USERNAME || 'admin',
      applicationName: appName,
      clientId: process.env.AUTH_CASDOOR_ID || 'admin-client-id',
      clientSecret: process.env.AUTH_CASDOOR_SECRET || 'ade8f7659114685d60f3147a185ebe307a92ee18',
      issuer: process.env.AUTH_CASDOOR_ISSUER || 'http://localhost:8000',
      organizationName: orgName
    };

    console.log('🔍 Casdoor config initialized:', {
      adminUsername: this.config.adminUsername,
      applicationName: this.config.applicationName,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret ? '[REDACTED]' : 'missing',
      issuer: this.config.issuer,
      organizationName: this.config.organizationName
    });
  }

  // 获取Casdoor访问令牌
  private async getAccessToken(): Promise<string> {
    try {
      const response = await fetch(`${this.config.issuer}/api/login/oauth/access_token`, {
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'client_credentials',
          scope: 'admin',
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error: any) {
      console.error('Casdoor access token error:', error);
      throw error;
    }
  }

  // 创建用户到Casdoor
  async createCasdoorUser(userData: {
    displayName: string;
    email: string;
    name: string;
    password: string;
    phone?: string;
    userType: 'user' | 'admin' | 'super_admin';
  }): Promise<{ data?: any; error?: string, success: boolean; }> {
    try {
      const accessToken = await this.getAccessToken();

      // 生成用户ID（使用UUID确保唯一性）
      const userId = crypto.randomUUID();

      // 分配角色
      const roles = userData.userType === 'super_admin'
        ? ['super_admin', 'admin', 'user']
        : userData.userType === 'admin'
          ? ['admin', 'user']
          : ['user'];

      // 准备用户数据
      const casdoorUser = {

        address: [],

        affiliation: userData.userType,

        avatar: '',

        bio: '',

        birthday: '',

        createdTime: new Date().toISOString(),

        displayName: userData.displayName,

        education: '',

        email: userData.email,

        gender: '',

        homepage: '',

        is_admin: userData.userType !== 'user',

        is_deleted: false,

        is_forbidden: false,

        is_online: false,

        karma: 0,

        language: '',
        // 使用后台管理组织
        name: userId,
        owner: this.config.organizationName,
        phone: userData.phone || '',
        preferredMfaType: '',
        properties: {
          createdAt: new Date().toISOString(),
          userType: userData.userType,
        },
        ranking: 0,
        score: 0,
        signupApplication: this.config.organizationName,
        tag: userData.userType,
        title: '',
        webdavEndpoint: '',
        webdavPassword: '',
        webdavUsername: '',
      };

      // 创建用户
      const userResponse = await fetch(`${this.config.issuer}/api/users`, {
        body: JSON.stringify(casdoorUser),
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to create Casdoor user: ${userResponse.statusText}`);
      }

      const createdUser = await userResponse.json();

      // 设置密码
      const passwordResponse = await fetch(`${this.config.issuer}/api/set-password`, {
        body: JSON.stringify({
          newPassword: userData.password,
          oldPassword: '',
          userName: userId,
          userOwner: this.config.organizationName,
        }),
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!passwordResponse.ok) {
        throw new Error(`Failed to set password: ${passwordResponse.statusText}`);
      }

      // 分配角色
      for (const role of roles) {
        await this.assignRoleToUser(userId, role, accessToken);
      }

      return {
        data: {
          casdoorId: userId,
          roles,
          userType: userData.userType,
          ...createdUser.data,
        },
        success: true,
      };
    } catch (error: any) {
      console.error('Create Casdoor user error:', error);
      return {
        error: error.message || 'Unknown error',
        success: false,
      };
    }
  }

  // 分配角色给用户
  private async assignRoleToUser(userId: string, roleName: string, accessToken: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.issuer}/api/add-role-user`, {
        body: JSON.stringify({
          name: roleName,
          owner: this.config.organizationName,
          userName: userId,
          userOwner: this.config.organizationName,
        }),
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to assign role ${roleName}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error(`Assign role ${roleName} error:`, error);
      throw error;
    }
  }

  // 从Casdoor获取用户信息（通过授权码）
  async getCasdoorUserInfo(code: string): Promise<any> {
    try {
      console.log('🔍 Getting Casdoor user info with code:', code ? 'provided' : 'missing');
      console.log('🔍 Redirect URI:', process.env.CASDOOR_REDIRECT_URI);
      console.log('🔍 Client ID:', this.config.clientId);
      console.log('🔍 Issuer:', this.config.issuer);

      // 使用授权码获取访问令牌
      const tokenResponse = await fetch(`${this.config.issuer}/api/login/oauth/access_token`, {
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.CASDOOR_REDIRECT_URI || 'http://localhost:8002/api/auth/casdoor/callback',
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
      });

      console.log('🔍 Token response status:', tokenResponse.status, tokenResponse.statusText);

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('🔍 Token response error:', errorText);
        throw new Error(`Failed to get access token: ${tokenResponse.statusText} - ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      console.log('🔍 Token data received:', { ...tokenData, access_token: tokenData.access_token ? '[REDACTED]' : 'missing' });

      const accessToken = tokenData.access_token;
      if (!accessToken) {
        throw new Error('No access token in response');
      }

      // 获取用户信息
      const userInfoResponse = await fetch(`${this.config.issuer}/api/userinfo`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        method: 'GET',
      });

      console.log('🔍 Userinfo response status:', userInfoResponse.status, userInfoResponse.statusText);

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.error('🔍 Userinfo response error:', errorText);
        throw new Error(`Failed to get user info: ${userInfoResponse.statusText} - ${errorText}`);
      }

      const userInfo = await userInfoResponse.json();
      console.log('🔍 User info received:', { ...userInfo, access_token: '[REDACTED]' });

      return userInfo;
    } catch (error: any) {
      console.error('Get Casdoor user info error:', error);
      throw error;
    }
  }

  // 通过ID获取Casdoor用户信息（用于管理操作）
  async getCasdoorUserById(casdoorId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.config.issuer}/api/get-user?id=${casdoorId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to get Casdoor user: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'ok') {
        throw new Error(`Casdoor API error: ${data.msg}`);
      }

      return data.data;
    } catch (error: any) {
      console.error('Get Casdoor user by ID error:', error);
      throw error;
    }
  }

  // 更新Casdoor用户信息
  async updateCasdoorUser(casdoorId: string, updates: {
    displayName?: string;
    email?: string;
    phone?: string;
    roles?: string[];
  }): Promise<{ error?: string, success: boolean; }> {
    try {
      const accessToken = await this.getAccessToken();

      // 更新用户基本信息
      const userUpdates: any = {};
      if (updates.displayName) userUpdates.displayName = updates.displayName;
      if (updates.email) userUpdates.email = updates.email;
      if (updates.phone) userUpdates.phone = updates.phone;

      if (Object.keys(userUpdates).length > 0) {
        const response = await fetch(`${this.config.issuer}/api/users`, {
          body: JSON.stringify({
            ...userUpdates,
            id: casdoorId,
          }),
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          method: 'PUT',
        });

        if (!response.ok) {
          throw new Error(`Failed to update Casdoor user: ${response.statusText}`);
        }
      }

      // 更新角色
      if (updates.roles && updates.roles.length > 0) {
        // 先移除所有角色
        await fetch(`${this.config.issuer}/api/delete-role-users`, {
          body: JSON.stringify({
            owner: this.config.organizationName,
            userName: casdoorId,
            userOwner: this.config.organizationName,
          }),
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          method: 'DELETE',
        });

        // 添加新角色
        for (const role of updates.roles) {
          await this.assignRoleToUser(casdoorId, role, accessToken);
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('Update Casdoor user error:', error);
      return {
        error: error.message || 'Unknown error',
        success: false,
      };
    }
  }

  // 删除Casdoor用户
  async deleteCasdoorUser(casdoorId: string): Promise<{ error?: string, success: boolean; }> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.config.issuer}/api/users`, {
        body: JSON.stringify({
          id: casdoorId,
          owner: this.config.organizationName,
        }),
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete Casdoor user: ${response.statusText}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Delete Casdoor user error:', error);
      return {
        error: error.message || 'Unknown error',
        success: false,
      };
    }
  }

  // 测试Casdoor连接
  async testConnection(): Promise<{ error?: string, success: boolean; }> {
    try {
      const accessToken = await this.getAccessToken();
      return { success: true };
    } catch (error: any) {
      return {
        error: error.message || 'Connection failed',
        success: false,
      };
    }
  }
}

export const casdoorSyncService = new CasdoorSyncService();