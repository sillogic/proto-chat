-- ============================================================================
-- 用户数据完整清理脚本
-- 用于 Casdoor -> Better Auth 迁移
--
-- 警告：此脚本会删除所有用户数据，请确保已备份！
-- 执行前请先备份数据库：pg_dump -h host -U user -d dbname > backup.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Better Auth 认证相关表
-- ============================================================================
DELETE FROM passkey;
DELETE FROM two_factor;
DELETE FROM verifications;
DELETE FROM accounts;
DELETE FROM auth_sessions;

-- ============================================================================
-- 2. NextAuth 遗留表（如果存在）
-- ============================================================================
DELETE FROM authenticators WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'authenticators');
DELETE FROM nextauth_sessions WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nextauth_sessions');
DELETE FROM nextauth_accounts WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nextauth_accounts');

-- ============================================================================
-- 3. 图片生成相关（AI 绘图）
-- ============================================================================
DELETE FROM generations;
DELETE FROM generation_batches;
DELETE FROM generation_topics;

-- ============================================================================
-- 4. RAG/Embedding 相关
-- ============================================================================
DELETE FROM embedding_usage_logs;
DELETE FROM document_chunks;
DELETE FROM embeddings;
DELETE FROM unstructured_chunks;
DELETE FROM chunks;

-- ============================================================================
-- 5. RAG 评估相关（如果存在）
-- ============================================================================
-- DELETE FROM rag_eval_records;
-- DELETE FROM rag_eval_runs;
-- DELETE FROM rag_eval_datasets;

-- ============================================================================
-- 6. 用户记忆相关
-- ============================================================================
DELETE FROM user_memories_experiences;
DELETE FROM user_memories_identities;
DELETE FROM user_memories_preferences;
DELETE FROM user_memories_contexts;
DELETE FROM user_memories;

-- ============================================================================
-- 7. 消息相关
-- ============================================================================
DELETE FROM message_semantic_search_chunks;
DELETE FROM message_query_chunks;
DELETE FROM message_queries;
DELETE FROM message_translates;
DELETE FROM message_tts;
DELETE FROM message_plugins;
DELETE FROM messages;
DELETE FROM message_groups;

-- ============================================================================
-- 8. 话题/线程相关
-- ============================================================================
DELETE FROM thread_messages;
DELETE FROM threads;
DELETE FROM topics;

-- ============================================================================
-- 9. 会话相关（聊天会话，非 auth session）
-- ============================================================================
DELETE FROM sessions;
DELETE FROM session_groups;

-- ============================================================================
-- 10. 聊天组相关
-- ============================================================================
DELETE FROM chat_groups_agents;
DELETE FROM chat_groups;

-- ============================================================================
-- 11. Agent 相关
-- ============================================================================
DELETE FROM agents_files;
DELETE FROM agents_tags;
DELETE FROM agents;

-- ============================================================================
-- 12. 文件/知识库相关
-- ============================================================================
DELETE FROM knowledge_base_files;
DELETE FROM knowledge_bases;
DELETE FROM files;
DELETE FROM documents;

-- ============================================================================
-- 13. AI 模型/提供商配置
-- ============================================================================
DELETE FROM ai_models;
DELETE FROM ai_providers;

-- ============================================================================
-- 14. 积分/支付相关
-- ============================================================================
DELETE FROM user_transactions;
DELETE FROM user_balances;
DELETE FROM payment_orders;

-- ============================================================================
-- 15. 用户扩展相关
-- ============================================================================
DELETE FROM user_installed_plugins;
DELETE FROM user_settings;
DELETE FROM user_extensions;

-- ============================================================================
-- 16. RBAC 相关
-- ============================================================================
DELETE FROM rbac_user_roles;

-- ============================================================================
-- 17. API Keys
-- ============================================================================
DELETE FROM api_keys;

-- ============================================================================
-- 18. 异步任务
-- ============================================================================
DELETE FROM async_tasks;

-- ============================================================================
-- 19. OIDC 相关（如果存在）
-- ============================================================================
-- DELETE FROM oidc_user_consents;
-- DELETE FROM oidc_authorization_codes;
-- DELETE FROM oidc_access_tokens;
-- DELETE FROM oidc_refresh_tokens;

-- ============================================================================
-- 20. 最后删除用户表
-- ============================================================================
DELETE FROM users;

-- ============================================================================
-- 验证清理结果
-- ============================================================================
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'auth_sessions', COUNT(*) FROM auth_sessions
UNION ALL SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL SELECT 'user_extensions', COUNT(*) FROM user_extensions
UNION ALL SELECT 'user_balances', COUNT(*) FROM user_balances
UNION ALL SELECT 'messages', COUNT(*) FROM messages
UNION ALL SELECT 'generations', COUNT(*) FROM generations
UNION ALL SELECT 'embeddings', COUNT(*) FROM embeddings;

COMMIT;

-- ============================================================================
-- 执行说明：
--
-- 1. 备份数据库：
--    pg_dump -h pgm-wz9d9326yqi0j9i27o.pg.rds.aliyuncs.com -U Sillogic -d lobechat > backup_$(date +%Y%m%d).sql
--
-- 2. 执行此脚本：
--    psql -h pgm-wz9d9326yqi0j9i27o.pg.rds.aliyuncs.com -U Sillogic -d lobechat -f scripts/clear-user-data.sql
--
-- 3. 或者使用 bun run db:studio 进入数据库管理界面手动执行
-- ============================================================================
