import fetch from 'node-fetch';
import crypto from 'crypto';
import { UserPermissions } from '../db/user-permissions';

// Casdoor配置
interface CasdoorConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  adminUsername: string;
  adminPassword: string;
}

export class CasdoorSyncService {
  private config: CasdoorConfig;

  constructor() {
    this.config = {
      issuer: process.env.AUTH_CASDOOR_ISSUER || 'http://localhost:8000',
      clientId: process.env.AUTH_CASDOOR_ID || 'admin-client-id',
      clientSecret: process.env.AUTH_CASDOOR_SECRET || 'ade8f7659114685d60f3147a185ebe307a92ee18',
      adminUsername: process.env.CASDOOR_ADMIN_USERNAME || 'admin',
      adminPassword: process.env.CASDOOR_ADMIN_PASSWORD || '123456'
    };

    console.log('🔍 Casdoor config initialized:', {
      issuer: this.config.issuer,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret ? '[REDACTED]' : 'missing',
      adminUsername: this.config.adminUsername
    });
  }

  // 获取Casdoor访问令牌
  private async getAccessToken(): Promise<string> {
    try {
      const response = await fetch(`${this.config.issuer}/api/login/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: 'admin',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Casdoor access token error:', error);
      throw error;
    }
  }

  // 创建用户到Casdoor
  async createCasdoorUser(userData: {
    name: string;
    displayName: string;
    email: string;
    password: string;
    phone?: string;
    userType: 'user' | 'admin' | 'super_admin';
  }): Promise<{ success: boolean; data?: any; error?: string }> {
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
        owner: 'protochat-admin', // 使用后台管理组织
        name: userId,
        createdTime: new Date().toISOString(),
        displayName: userData.displayName,
        avatar: '',
        email: userData.email,
        phone: userData.phone || '',
        address: [],
        affiliation: userData.userType,
        title: '',
        homepage: '',
        bio: '',
        tag: userData.userType,
        language: '',
        gender: '',
        birthday: '',
        education: '',
        score: 0,
        karma: 0,
        ranking: 0,
        is_online: false,
        is_admin: userData.userType !== 'user',
        is_forbidden: false,
        is_deleted: false,
        signupApplication: 'protochat-admin',
        preferredMfaType: '',
        webdavEndpoint: '',
        webdavUsername: '',
        webdavPassword: '',
        properties: {
          userType: userData.userType,
          createdAt: new Date().toISOString(),
        },
      };

      // 创建用户
      const userResponse = await fetch(`${this.config.issuer}/api/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(casdoorUser),
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to create Casdoor user: ${userResponse.statusText}`);
      }

      const createdUser = await userResponse.json();

      // 设置密码
      const passwordResponse = await fetch(`${this.config.issuer}/api/set-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userOwner: 'protochat-admin',
          userName: userId,
          oldPassword: '',
          newPassword: userData.password,
        }),
      });

      if (!passwordResponse.ok) {
        throw new Error(`Failed to set password: ${passwordResponse.statusText}`);
      }

      // 分配角色
      for (const role of roles) {
        await this.assignRoleToUser(userId, role, accessToken);
      }

      return {
        success: true,
        data: {
          casdoorId: userId,
          roles,
          userType: userData.userType,
          ...createdUser.data,
        },
      };
    } catch (error) {
      console.error('Create Casdoor user error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  // 分配角色给用户
  private async assignRoleToUser(userId: string, roleName: string, accessToken: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.issuer}/api/add-role-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userOwner: 'protochat-admin',
          userName: userId,
          owner: 'protochat-admin',
          name: roleName,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to assign role ${roleName}: ${response.statusText}`);
      }
    } catch (error) {
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: code,
          redirect_uri: process.env.CASDOOR_REDIRECT_URI || 'http://localhost:8002/api/auth/casdoor/callback',
        }),
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
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
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
    } catch (error) {
      console.error('Get Casdoor user info error:', error);
      throw error;
    }
  }

  // 通过ID获取Casdoor用户信息（用于管理操作）
  async getCasdoorUserById(casdoorId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.config.issuer}/api/get-user?id=${casdoorId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get Casdoor user: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'ok') {
        throw new Error(`Casdoor API error: ${data.msg}`);
      }

      return data.data;
    } catch (error) {
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
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await this.getAccessToken();

      // 更新用户基本信息
      const userUpdates: any = {};
      if (updates.displayName) userUpdates.displayName = updates.displayName;
      if (updates.email) userUpdates.email = updates.email;
      if (updates.phone) userUpdates.phone = updates.phone;

      if (Object.keys(userUpdates).length > 0) {
        const response = await fetch(`${this.config.issuer}/api/users`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...userUpdates,
            id: casdoorId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update Casdoor user: ${response.statusText}`);
        }
      }

      // 更新角色
      if (updates.roles && updates.roles.length > 0) {
        // 先移除所有角色
        await fetch(`${this.config.issuer}/api/delete-role-users`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userOwner: 'protochat-admin',
            userName: casdoorId,
            owner: 'protochat-admin',
          }),
        });

        // 添加新角色
        for (const role of updates.roles) {
          await this.assignRoleToUser(casdoorId, role, accessToken);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Update Casdoor user error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  // 删除Casdoor用户
  async deleteCasdoorUser(casdoorId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.config.issuer}/api/users`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: 'protochat-admin',
          id: casdoorId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete Casdoor user: ${response.statusText}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Delete Casdoor user error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  // 测试Casdoor连接
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await this.getAccessToken();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Connection failed',
      };
    }
  }
}

export const casdoorSyncService = new CasdoorSyncService();