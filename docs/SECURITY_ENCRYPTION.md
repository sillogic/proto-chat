# API Key 安全加密实现文档

## 概述

本系统采用 **AES-256-GCM** 加密算法对所有 API Key 进行端到端加密，确保敏感信息在存储和传输过程中的安全性。

## 1. 加密算法

### 加密标准
- **算法**: AES-GCM (Advanced Encryption Standard - Galois/Counter Mode)
- **密钥长度**: 256 位
- **IV 长度**: 12 字节 (96 位)
- **认证标签**: 16 字节 (128 位)

### 优势
- ✅ **机密性**: AES-256 提供军事级加密强度
- ✅ **完整性**: GCM 模式内置认证，防止篡改
- ✅ **性能**: GCM 模式支持硬件加速，性能优异
- ✅ **标准化**: NIST 推荐，广泛应用于 TLS 1.3、IPsec 等

## 2. 密钥管理

### 环境变量配置

**主项目** (`src/server/modules/KeyVaultsEncrypt/index.ts`):
```bash
KEY_VAULTS_SECRET=<base64编码的32字节密钥>
```

**后台系统** (`admin-system/server/src/utils/encryption.ts`):
```bash
KEY_VAULTS_SECRET=<base64编码的32字节密钥>
```

### 生成密钥

```bash
# 生成 256 位随机密钥并 base64 编码
openssl rand -base64 32
```

**⚠️ 重要**:
- 主项目和后台系统**必须使用相同的密钥**
- 密钥**绝不能**提交到版本控制系统
- 密钥应存储在安全的密钥管理服务中（如 AWS KMS、HashiCorp Vault）
- 定期轮换密钥（建议每 90 天）

## 3. 加密数据格式

### 存储格式

加密后的数据以十六进制字符串存储，格式为：
```
IV:AuthTag:EncryptedData
```

示例：
```
a1b2c3d4e5f6g7h8i9j0k1l2:m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8:c9d0e1f2g3h4...
```

### 加密流程

```typescript
// 1. 生成随机 IV
const iv = crypto.getRandomValues(new Uint8Array(12));

// 2. 加密数据
const encryptedData = await crypto.subtle.encrypt(
  { iv: iv, name: 'AES-GCM' },
  aesKey,
  encodedData
);

// 3. 提取认证标签
const buffer = Buffer.from(encryptedData);
const authTag = buffer.slice(-16);
const encrypted = buffer.slice(0, -16);

// 4. 拼接存储
return `${iv.hex}:${authTag.hex}:${encrypted.hex}`;
```

## 4. 数据库存储

### 后台系统

**全局 AI 供应商** (`ai_providers` 表):
```sql
CREATE TABLE ai_providers (
    id VARCHAR(64),
    key_vaults TEXT,  -- 加密存储的 JSON 字符串
    -- ...
);
```

**ProtoChat 子供应商** (`protochat_providers` 表):
```sql
CREATE TABLE protochat_providers (
    id VARCHAR(64),
    api_key TEXT,  -- 加密存储的 keyVaults JSON 字符串
    -- ...
);
```

### 主项目

**用户 AI 供应商** (`ai_providers` 表):
```sql
CREATE TABLE ai_providers (
    id VARCHAR(150),
    user_id TEXT,
    key_vaults TEXT,  -- 加密存储的 JSON 字符串
    -- ...
);
```

## 5. API 传输安全

### HTTPS/TLS 保护

所有 API 请求**必须**通过 HTTPS 传输，确保：
- ✅ 数据在网络传输中加密（TLS 1.2+）
- ✅ 防止中间人攻击（MITM）
- ✅ 服务器身份验证

### 后台系统 API 端点

#### 全局 AI 供应商

**GET** `/api/admin/ai-providers`
```typescript
// 返回解密后的 keyVaults 供前端编辑
{
  "data": [{
    "id": "openai",
    "keyVaults": {
      "apiKey": "sk-...",  // 解密后的明文
      "proxyUrl": "https://..."
    }
  }]
}
```

**POST** `/api/admin/ai-providers`
```typescript
// 接收明文 keyVaults，加密后存储
{
  "id": "openai",
  "keyVaults": {
    "apiKey": "sk-...",  // 明文传输（HTTPS保护）
    "proxyUrl": "https://..."
  }
}
// 后端加密后存储：
// keyVaults = await gateKeeper.encrypt(JSON.stringify(keyVaults));
```

#### ProtoChat 子供应商

**GET** `/api/admin/protochat/ai-providers`
```typescript
// 返回解密后的 keyVaults
{
  "data": [{
    "id": "openrouter",
    "keyVaults": {
      "apiKey": "sk-or-v1-...",  // 解密后的明文
    }
  }]
}
```

**POST** `/api/admin/protochat/ai-providers`
```typescript
// 接收明文 keyVaults，加密后存储到 api_key 字段
{
  "id": "openrouter",
  "keyVaults": {
    "apiKey": "sk-or-v1-...",  // 明文传输（HTTPS保护）
  }
}
// 后端加密：
// providerData.apiKey = await gateKeeper.encrypt(JSON.stringify(keyVaults));
```

### 主项目 API 端点

用户提交 API Key 时：
```typescript
// POST /api/aiProvider
{
  "id": "openai",
  "keyVaults": {
    "apiKey": "sk-...",  // 明文传输（HTTPS保护）
  }
}
// 后端加密后存储到数据库
```

## 6. 代码实现

### 后台系统加密工具

**文件**: `admin-system/server/src/utils/encryption.ts`

```typescript
export class KeyVaultsGateKeeper {
  // 初始化
  static initWithEnvKey = async () => {
    const KEY_VAULTS_SECRET = process.env.KEY_VAULTS_SECRET;
    if (!KEY_VAULTS_SECRET) {
      throw new Error('KEY_VAULTS_SECRET is not set');
    }
    const rawKey = Buffer.from(KEY_VAULTS_SECRET, 'base64');
    const aesKey = await crypto.subtle.importKey(
      'raw', rawKey,
      { length: 256, name: 'AES-GCM' },
      false, ['encrypt', 'decrypt']
    );
    return new KeyVaultsGateKeeper(aesKey);
  };

  // 加密
  encrypt = async (keyVault: string): Promise<string> => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt(
      { iv: iv, name: 'AES-GCM' },
      this.aesKey,
      new TextEncoder().encode(keyVault)
    );
    // 返回格式：IV:AuthTag:EncryptedData
    return `${Buffer.from(iv).toString('hex')}:${authTag}:${encrypted}`;
  };

  // 解密
  decrypt = async (encryptedData: string): Promise<DecryptionResult> => {
    const [iv, authTag, encrypted] = encryptedData.split(':').map(hex => Buffer.from(hex, 'hex'));
    const decryptedBuffer = await crypto.subtle.decrypt(
      { iv: iv, name: 'AES-GCM' },
      this.aesKey,
      Buffer.concat([encrypted, authTag])
    );
    return {
      plaintext: new TextDecoder().decode(decryptedBuffer),
      wasAuthentic: true
    };
  };
}
```

### 使用示例

**保存 API Key (加密)**:
```typescript
// admin-system/server/src/routes/protochat.ts
const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
providerData.apiKey = await gateKeeper.encrypt(JSON.stringify(keyVaults));
await db.insert(protochatProviders).values(providerData);
```

**读取 API Key (解密)**:
```typescript
// admin-system/server/src/routes/protochat.ts
const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
const result = await gateKeeper.decrypt(provider.apiKey);
if (result.wasAuthentic) {
  const keyVaults = JSON.parse(result.plaintext);
  // 使用 keyVaults.apiKey
}
```

## 7. 安全最佳实践

### ✅ 已实现

1. **数据库加密存储**: 所有 API Key 使用 AES-256-GCM 加密后存储
2. **HTTPS 传输**: 所有 API 通过 HTTPS/TLS 保护
3. **日志脱敏**: 日志中不记录明文 API Key
   ```typescript
   console.log('[ProtoChat POST] Received request:', {
     keyVaults: keyVaults ? '[REDACTED]' : null  // 脱敏
   });
   ```
4. **认证授权**: 所有敏感 API 需要管理员权限
   ```typescript
   router.post('/ai-providers', authenticateToken, requirePermission('system.admin'), ...)
   ```
5. **完整性校验**: GCM 模式自动验证数据完整性

### 🔒 部署建议

1. **网络隔离**:
   - 后台系统应限制 IP 访问（如只允许特定管理员 IP）
   - 使用防火墙规则限制端口访问
   - 考虑使用 VPN 访问后台系统

2. **HTTPS 配置**:
   ```nginx
   # Nginx 配置示例
   server {
     listen 443 ssl http2;
     ssl_certificate /path/to/cert.pem;
     ssl_certificate_key /path/to/key.pem;
     ssl_protocols TLSv1.2 TLSv1.3;
     ssl_ciphers HIGH:!aNULL:!MD5;

     # 仅允许特定 IP 访问后台
     location /api/admin {
       allow 1.2.3.4;  # 管理员 IP
       deny all;
     }
   }
   ```

3. **环境变量管理**:
   - 使用 `.env` 文件（确保在 `.gitignore` 中）
   - 生产环境使用密钥管理服务（AWS Secrets Manager、HashiCorp Vault）
   - 容器化部署使用 Kubernetes Secrets

4. **审计日志**:
   - 记录所有 API Key 的创建、更新、删除操作
   - 监控异常访问模式
   - 定期审查访问日志

5. **密钥轮换**:
   - 定期更换 `KEY_VAULTS_SECRET`
   - 实现密钥版本管理
   - 提供密钥迁移工具

## 8. 安全检查清单

部署前请确认：

- [ ] `KEY_VAULTS_SECRET` 已设置且长度为 32 字节（base64 后约 44 字符）
- [ ] 主项目和后台系统使用相同的 `KEY_VAULTS_SECRET`
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] HTTPS/TLS 已启用（生产环境）
- [ ] 后台系统已配置 IP 白名单
- [ ] 日志中没有记录明文 API Key
- [ ] 数据库备份已加密
- [ ] 已配置定期密钥轮换计划

## 9. 常见问题

**Q: 如果忘记了 `KEY_VAULTS_SECRET` 怎么办？**

A: 如果丢失密钥，**所有已加密的 API Key 将无法恢复**。必须：
1. 生成新的 `KEY_VAULTS_SECRET`
2. 清空数据库中所有加密字段
3. 要求用户重新配置 API Key

**Q: 可以在开发环境使用明文存储吗？**

A: **不推荐**。即使在开发环境，也应该使用加密存储，养成良好的安全习惯。

**Q: HTTPS 是否足够安全，还需要数据库加密吗？**

A: **需要**。HTTPS 只保护传输过程，数据库加密保护静态数据（at-rest）。如果数据库被泄露，加密可以防止 API Key 被窃取。

**Q: 如何验证加密是否正常工作？**

A: 检查数据库中的 `key_vaults` 或 `api_key` 字段，应该看到格式为 `hex:hex:hex` 的密文，而不是明文 API Key。

## 10. 总结

本系统采用业界最佳实践实现 API Key 安全管理：

| 层级 | 保护措施 | 技术 |
|------|---------|------|
| **传输层** | 加密传输 | HTTPS/TLS 1.2+ |
| **应用层** | 访问控制 | JWT 认证 + 权限检查 |
| **存储层** | 数据库加密 | AES-256-GCM |
| **网络层** | IP 限制 | 防火墙 + Nginx 配置 |
| **运维层** | 密钥管理 | 环境变量 + 密钥轮换 |

**关键原则**: 深度防御（Defense in Depth）- 即使某一层被突破，其他层仍能保护数据安全。
