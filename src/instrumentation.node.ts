// @ts-expect-error - global-agent doesn't have type definitions
import { bootstrap } from 'global-agent';

import { register } from '@lobechat/observability-otel/node';

import { version } from '../package.json';

// 启用全局代理支持（读取 GLOBAL_AGENT_HTTP_PROXY 环境变量）
if (process.env.GLOBAL_AGENT_HTTP_PROXY) {
  bootstrap();
}

register({ version });
