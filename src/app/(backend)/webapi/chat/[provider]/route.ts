import {
  AGENT_RUNTIME_ERROR_SET,
  type ChatCompletionErrorPayload,
  type ModelRuntime,
} from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { createTraceOptions, initModelRuntimeFromDB, initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';
import { type ChatStreamPayload } from '@/types/openai/chat';
import { createErrorResponse } from '@/utils/errorResponse';
import { getTracePayload } from '@/utils/trace';
import { ProtoChatService } from '@/server/services/protochat';

// If user don't use fluid compute, will build  failed
// this enforce user to enable fluid compute
export const maxDuration = 300;

export const POST = checkAuth(
  async (req: Request, { params, userId, serverDB, createRuntime, jwtPayload }) => {
    const provider = (await params)!.provider!;

    // ============  1. Read request data first  ============ //
    // ProtoChat needs model ID to determine the actual provider
    const data = (await req.json()) as ChatStreamPayload;

    // ============  2. Init services with model info  ============ //

    try {
      let modelRuntime: ModelRuntime;
      let actualModel: string | undefined;

      if (createRuntime) {
        modelRuntime = createRuntime(jwtPayload);
      } else {
        // Special handling for ProtoChat provider
        if (ProtoChatService.isProtoChatProvider(provider)) {
          // Pass model info to runtime initialization for ProtoChat routing
          const result = await initModelRuntimeWithUserPayload(provider, jwtPayload, { model: data.model });
          modelRuntime = result.runtime;
          actualModel = result.actualModel;
        } else {
          // Regular providers: read user's provider config from database
          modelRuntime = await initModelRuntimeFromDB(serverDB, userId, provider);
        }
      }

      // ============  3. Create chat completion  ============ //

      // For ProtoChat, replace model ID with the actual underlying model ID
      const requestData = actualModel ? { ...data, model: actualModel } : data;

      const tracePayload = getTracePayload(req);

      let traceOptions = {};
      // If user enable trace
      if (tracePayload?.enabled) {
        traceOptions = createTraceOptions(requestData, { provider, trace: tracePayload });
      }

      return await modelRuntime.chat(requestData, {
        user: userId,
        ...traceOptions,
        signal: req.signal,
      });
    } catch (e) {
      const {
        errorType = ChatErrorType.InternalServerError,
        error: errorContent,
        ...res
      } = e as ChatCompletionErrorPayload;

      const error = errorContent || e;

      const logMethod = AGENT_RUNTIME_ERROR_SET.has(errorType as string) ? 'warn' : 'error';
      // track the error at server side
      console[logMethod](`Route: [${provider}] ${errorType}:`, error);

      return createErrorResponse(errorType, { error, ...res, provider });
    }
  },
);
