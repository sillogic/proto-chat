// 用户权限管理模块
export class UserPermissions {

  // 根据Casdoor角色判断用户类型
  static getUserType(casdoorRoles: string[]): 'user' | 'admin' | 'super_admin' {
    if (casdoorRoles.includes('super_admin')) return 'super_admin';
    if (casdoorRoles.includes('admin')) return 'admin';
    return 'user';
  }

  // 根据用户类型生成权限
  static getPermissionsByUserType(userType: 'user' | 'admin' | 'super_admin'): string[] {
    switch (userType) {
      case 'super_admin':
        return [
          // 主项目权限
          'chat.read', 'chat.write', 'chat.history',
          'api.read', 'api.write',
          'files.read', 'files.write',

          // 后台系统权限
          'admin.read', 'admin.write',
          'users.read', 'users.write',
          'plans.read', 'plans.write',
          'stats.read', 'stats.write',
          'feedbacks.read', 'feedbacks.write',
          'system.admin'
        ];

      case 'admin':
        return [
          // 主项目权限
          'chat.read', 'chat.write', 'chat.history',
          'api.read', 'api.write',
          'files.read', 'files.write',

          // 后台系统权限
          'users.read', 'stats.read',
          'feedbacks.read'
        ];

      case 'user':
        return [
          // 仅主项目权限
          'chat.read', 'chat.write', 'chat.history',
          'api.read', 'api.write',
          'files.read', 'files.write'
        ];

      default:
        return [];
    }
  }

  // 判断是否可以访问后台系统
  static canAccessAdminSystem(userType: 'user' | 'admin' | 'super_admin'): boolean {
    return userType === 'admin' || userType === 'super_admin';
  }

  // 判断是否可以管理其他用户
  static canManageUsers(userType: 'user' | 'admin' | 'super_admin'): boolean {
    return userType === 'super_admin';
  }
}

export default UserPermissions;