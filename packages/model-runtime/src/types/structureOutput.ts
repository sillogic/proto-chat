import type { ChatCompletionTool } from './chat';

interface GenerateObjectMessage {
  content: string;
  name?: string;
  role: 'user' | 'system' | 'assistant';
}

export interface GenerateObjectSchema {
  description?: string;
  name: string;
  schema: {
    additionalProperties?: boolean;
    properties: Record<string, any>;
    required?: string[];
    type: 'object';
  };
  strict?: boolean;
}

export interface GenerateObjectPayload {
  messages: GenerateObjectMessage[];
  model: string;
  responseApi?: boolean;
  schema?: GenerateObjectSchema;
  tools?: ChatCompletionTool[];
}

export interface GenerateObjectOptions {
  /**
   * response headers
   */
  headers?: Record<string, any>;

  /**
   * Callback invoked with token usage after a successful generateObject call.
   * inputTokens = prompt tokens, outputTokens = completion tokens.
   */
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;

  signal?: AbortSignal;
  /**
   * userId for the GenerateObject
   */
  user?: string;
}
