/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { contentBlocksToString } from '@/server/services/mcp/contentProcessor';
import { truncateToolResult } from '@/server/utils/truncateToolResult';

import { DiscoverService } from '../discover';
import { ToolExecutionService } from './index';
import type { ToolExecutionContext } from './types';

// Mock debug to avoid side effects
vi.mock('debug', () => ({ default: () => () => {} }));

// Mock contentBlocksToString
vi.mock('@/server/services/mcp/contentProcessor', () => ({
  contentBlocksToString: vi.fn(),
}));

// Mock truncateToolResult
vi.mock('@/server/utils/truncateToolResult', () => ({
  DEFAULT_TOOL_RESULT_MAX_LENGTH: 25_000,
  truncateToolResult: vi.fn((content: string, maxLength?: number) => {
    const limit = maxLength ?? 25_000;
    if (!content || content.length <= limit) return content;
    return content.slice(0, limit) + '[truncated]';
  }),
}));

// Mock DiscoverService
vi.mock('../discover', () => ({
  DiscoverService: vi.fn(),
}));

describe('ToolExecutionService', () => {
  let service: ToolExecutionService;
  let mockBuiltinExecutor: { execute: ReturnType<typeof vi.fn> };
  let mockMcpService: { callTool: ReturnType<typeof vi.fn> };
  let mockPluginGatewayService: { execute: ReturnType<typeof vi.fn> };

  const baseContext: ToolExecutionContext = {
    toolManifestMap: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBuiltinExecutor = { execute: vi.fn() };
    mockMcpService = { callTool: vi.fn() };
    mockPluginGatewayService = { execute: vi.fn() };

    service = new ToolExecutionService({
      builtinToolsExecutor: mockBuiltinExecutor as any,
      mcpService: mockMcpService as any,
      pluginGatewayService: mockPluginGatewayService as any,
    });
  });

  describe('executeTool', () => {
    describe('builtin type', () => {
      it('should call builtinToolsExecutor for builtin type', async () => {
        const payload = {
          identifier: 'search',
          apiName: 'webSearch',
          type: 'builtin',
          arguments: '{}',
        } as any;

        mockBuiltinExecutor.execute.mockResolvedValue({
          content: 'search result',
          success: true,
        });

        const result = await service.executeTool(payload, baseContext);

        expect(mockBuiltinExecutor.execute).toHaveBeenCalledWith(payload, baseContext);
        expect(result.content).toBe('search result');
        expect(result.success).toBe(true);
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      });

      it('should include executionTime in result', async () => {
        const payload = {
          identifier: 'search',
          apiName: 'webSearch',
          type: 'builtin',
          arguments: '{}',
        } as any;

        mockBuiltinExecutor.execute.mockResolvedValue({
          content: 'result',
          success: true,
        });

        const result = await service.executeTool(payload, baseContext);

        expect(typeof result.executionTime).toBe('number');
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      });

      it('should truncate long builtin results', async () => {
        const longContent = 'x'.repeat(30_000);
        const payload = {
          identifier: 'tool',
          apiName: 'run',
          type: 'builtin',
          arguments: '{}',
        } as any;

        mockBuiltinExecutor.execute.mockResolvedValue({
          content: longContent,
          success: true,
        });

        await service.executeTool(payload, baseContext);

        expect(truncateToolResult).toHaveBeenCalledWith(longContent, undefined);
      });

      it('should use context.toolResultMaxLength for truncation', async () => {
        const payload = {
          identifier: 'tool',
          apiName: 'run',
          type: 'builtin',
          arguments: '{}',
        } as any;
        const context = { ...baseContext, toolResultMaxLength: 1000 };

        mockBuiltinExecutor.execute.mockResolvedValue({
          content: 'some content',
          success: true,
        });

        await service.executeTool(payload, context);

        expect(truncateToolResult).toHaveBeenCalledWith('some content', 1000);
      });
    });

    describe('default (plugin gateway) type', () => {
      it('should call pluginGatewayService for default type', async () => {
        const payload = {
          identifier: 'my-plugin',
          apiName: 'run',
          type: 'default',
          arguments: '{}',
        } as any;

        mockPluginGatewayService.execute.mockResolvedValue({
          content: 'plugin result',
          success: true,
        });

        const result = await service.executeTool(payload, baseContext);

        expect(mockPluginGatewayService.execute).toHaveBeenCalledWith(payload, baseContext);
        expect(result.content).toBe('plugin result');
        expect(result.success).toBe(true);
      });

      it('should call pluginGatewayService for standalone type', async () => {
        const payload = {
          identifier: 'my-plugin',
          apiName: 'run',
          type: 'standalone',
          arguments: '{}',
        } as any;

        mockPluginGatewayService.execute.mockResolvedValue({
          content: 'standalone result',
          success: true,
        });

        const result = await service.executeTool(payload, baseContext);

        expect(mockPluginGatewayService.execute).toHaveBeenCalledWith(payload, baseContext);
        expect(result.content).toBe('standalone result');
      });
    });

    describe('error handling', () => {
      it('should catch errors from builtinToolsExecutor and return error response', async () => {
        const payload = {
          identifier: 'tool',
          apiName: 'run',
          type: 'builtin',
          arguments: '{}',
        } as any;

        mockBuiltinExecutor.execute.mockRejectedValue(new Error('Tool crashed'));

        const result = await service.executeTool(payload, baseContext);

        expect(result.success).toBe(false);
        expect(result.content).toContain('Tool crashed');
        expect(result.error).toBeDefined();
        expect(result.error.message).toBe('Tool crashed');
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      });

      it('should catch errors from pluginGatewayService', async () => {
        const payload = {
          identifier: 'plugin',
          apiName: 'action',
          type: 'default',
          arguments: '{}',
        } as any;

        mockPluginGatewayService.execute.mockRejectedValue(new Error('Plugin error'));

        const result = await service.executeTool(payload, baseContext);

        expect(result.success).toBe(false);
        expect(result.content).toContain('Plugin error');
      });

      it('should truncate error messages via truncateToolResult', async () => {
        const payload = {
          identifier: 'tool',
          apiName: 'run',
          type: 'builtin',
          arguments: '{}',
        } as any;

        mockBuiltinExecutor.execute.mockRejectedValue(new Error('some error'));

        await service.executeTool(payload, baseContext);

        // truncateToolResult should be called for error messages too
        expect(truncateToolResult).toHaveBeenCalledWith('some error');
      });
    });
  });

  describe('executeMCPTool (via executeTool with type=mcp)', () => {
    const mcpPayload = {
      identifier: 'my-mcp-tool',
      apiName: 'doSomething',
      type: 'mcp',
      arguments: '{"key":"value"}',
    } as any;

    it('should return error when manifest not found', async () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {}, // no manifest for 'my-mcp-tool'
      };

      const result = await service.executeTool(mcpPayload, context);

      expect(result.success).toBe(false);
      expect(result.content).toContain('Manifest not found for tool: my-mcp-tool');
      expect(result.error?.code).toBe('MANIFEST_NOT_FOUND');
    });

    it('should return error when MCP config (mcpParams) not found in manifest', async () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {
          'my-mcp-tool': { identifier: 'my-mcp-tool' } as any, // no mcpParams
        },
      };

      const result = await service.executeTool(mcpPayload, context);

      expect(result.success).toBe(false);
      expect(result.content).toContain('MCP configuration not found for tool: my-mcp-tool');
      expect(result.error?.code).toBe('MCP_CONFIG_NOT_FOUND');
    });

    it('should call mcpService.callTool for stdio/http type', async () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {
          'my-mcp-tool': {
            identifier: 'my-mcp-tool',
            mcpParams: { type: 'stdio', command: 'npx tool' },
          } as any,
        },
      };

      mockMcpService.callTool.mockResolvedValue('mcp tool result');

      const result = await service.executeTool(mcpPayload, context);

      expect(mockMcpService.callTool).toHaveBeenCalledWith({
        argsStr: '{"key":"value"}',
        clientParams: { type: 'stdio', command: 'npx tool' },
        toolName: 'doSomething',
      });
      expect(result.success).toBe(true);
      expect(result.content).toBe('mcp tool result');
    });

    it('should JSON.stringify non-string mcp tool results', async () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {
          'my-mcp-tool': {
            identifier: 'my-mcp-tool',
            mcpParams: { type: 'http', url: 'http://localhost' },
          } as any,
        },
      };

      const objectResult = { data: 'some data', count: 42 };
      mockMcpService.callTool.mockResolvedValue(objectResult);

      const result = await service.executeTool(mcpPayload, context);

      expect(result.content).toBe(JSON.stringify(objectResult));
      expect(result.state).toEqual(objectResult);
      expect(result.success).toBe(true);
    });

    it('should handle errors from mcpService.callTool', async () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {
          'my-mcp-tool': {
            identifier: 'my-mcp-tool',
            mcpParams: { type: 'sse', url: 'http://localhost/sse' },
          } as any,
        },
      };

      mockMcpService.callTool.mockRejectedValue(new Error('MCP connection failed'));

      const result = await service.executeTool(mcpPayload, context);

      expect(result.success).toBe(false);
      expect(result.content).toContain('MCP connection failed');
      expect(result.error?.code).toBe('MCP_EXECUTION_ERROR');
    });

    describe('cloud MCP type', () => {
      it('should call DiscoverService for cloud MCP tools', async () => {
        const cloudPayload = {
          identifier: 'cloud-mcp-tool',
          apiName: 'cloudAction',
          type: 'mcp',
          arguments: '{"param":"test"}',
        } as any;

        const context: ToolExecutionContext = {
          toolManifestMap: {
            'cloud-mcp-tool': {
              identifier: 'cloud-mcp-tool',
              mcpParams: { type: 'cloud' },
            } as any,
          },
          userId: 'user-123',
        };

        const mockDiscoverInstance = {
          callCloudMcpEndpoint: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'cloud result' }],
            isError: false,
          }),
        };
        vi.mocked(DiscoverService).mockImplementation(() => mockDiscoverInstance as any);
        vi.mocked(contentBlocksToString).mockReturnValue('cloud result');

        const result = await service.executeTool(cloudPayload, context);

        expect(DiscoverService).toHaveBeenCalledWith({
          userInfo: { userId: 'user-123' },
        });
        expect(mockDiscoverInstance.callCloudMcpEndpoint).toHaveBeenCalledWith({
          apiParams: { param: 'test' },
          identifier: 'cloud-mcp-tool',
          toolName: 'cloudAction',
        });
        expect(result.success).toBe(true);
        expect(result.content).toBe('cloud result');
      });

      it('should set success=false when cloud result has isError=true', async () => {
        const cloudPayload = {
          identifier: 'cloud-mcp-tool',
          apiName: 'failAction',
          type: 'mcp',
          arguments: '{}',
        } as any;

        const context: ToolExecutionContext = {
          toolManifestMap: {
            'cloud-mcp-tool': {
              identifier: 'cloud-mcp-tool',
              mcpParams: { type: 'cloud' },
            } as any,
          },
        };

        const mockDiscoverInstance = {
          callCloudMcpEndpoint: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'error occurred' }],
            isError: true,
          }),
        };
        vi.mocked(DiscoverService).mockImplementation(() => mockDiscoverInstance as any);
        vi.mocked(contentBlocksToString).mockReturnValue('error occurred');

        const result = await service.executeTool(cloudPayload, context);

        expect(result.success).toBe(false);
      });

      it('should handle null/undefined cloud result content gracefully', async () => {
        const cloudPayload = {
          identifier: 'cloud-mcp-tool',
          apiName: 'nullAction',
          type: 'mcp',
          arguments: '{}',
        } as any;

        const context: ToolExecutionContext = {
          toolManifestMap: {
            'cloud-mcp-tool': {
              identifier: 'cloud-mcp-tool',
              mcpParams: { type: 'cloud' },
            } as any,
          },
        };

        const mockDiscoverInstance = {
          callCloudMcpEndpoint: vi.fn().mockResolvedValue({
            content: null,
            isError: false,
          }),
        };
        vi.mocked(DiscoverService).mockImplementation(() => mockDiscoverInstance as any);
        vi.mocked(contentBlocksToString).mockReturnValue('');

        const result = await service.executeTool(cloudPayload, context);

        expect(contentBlocksToString).toHaveBeenCalledWith([]);
        expect(result.success).toBe(true);
      });

      it('should handle errors thrown by DiscoverService.callCloudMcpEndpoint', async () => {
        const cloudPayload = {
          identifier: 'cloud-mcp-tool',
          apiName: 'errorAction',
          type: 'mcp',
          arguments: '{}',
        } as any;

        const context: ToolExecutionContext = {
          toolManifestMap: {
            'cloud-mcp-tool': {
              identifier: 'cloud-mcp-tool',
              mcpParams: { type: 'cloud' },
            } as any,
          },
        };

        const mockDiscoverInstance = {
          callCloudMcpEndpoint: vi.fn().mockRejectedValue(new Error('Cloud gateway timeout')),
        };
        vi.mocked(DiscoverService).mockImplementation(() => mockDiscoverInstance as any);

        const result = await service.executeTool(cloudPayload, context);

        expect(result.success).toBe(false);
        expect(result.content).toContain('Cloud gateway timeout');
        expect(result.error?.code).toBe('CLOUD_MCP_EXECUTION_ERROR');
      });

      it('should pass undefined userInfo when no userId in context', async () => {
        const cloudPayload = {
          identifier: 'cloud-mcp-tool',
          apiName: 'action',
          type: 'mcp',
          arguments: '{}',
        } as any;

        const context: ToolExecutionContext = {
          toolManifestMap: {
            'cloud-mcp-tool': {
              identifier: 'cloud-mcp-tool',
              mcpParams: { type: 'cloud' },
            } as any,
          },
          // no userId
        };

        const mockDiscoverInstance = {
          callCloudMcpEndpoint: vi.fn().mockResolvedValue({
            content: [],
            isError: false,
          }),
        };
        vi.mocked(DiscoverService).mockImplementation(() => mockDiscoverInstance as any);
        vi.mocked(contentBlocksToString).mockReturnValue('');

        await service.executeTool(cloudPayload, context);

        expect(DiscoverService).toHaveBeenCalledWith({
          userInfo: undefined,
        });
      });
    });
  });
});
