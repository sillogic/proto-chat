import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { globalAgentContextManager } from './GlobalAgentContextManager';

const CONTEXT_KEY = '__LOBE_GLOBAL_AGENT_CONTEXT__';

describe('GlobalAgentContextManager', () => {
  beforeEach(() => {
    // Reset global context before each test
    (window as any)[CONTEXT_KEY] = undefined;
  });

  afterEach(() => {
    // Clean up after each test
    (window as any)[CONTEXT_KEY] = undefined;
  });

  describe('getContext', () => {
    it('should return empty object when context is not initialized', () => {
      const result = globalAgentContextManager.getContext();
      expect(result).toEqual({});
    });

    it('should return the current context', () => {
      (window as any)[CONTEXT_KEY] = { homePath: '/home/user', currentTime: '2024-01-01' };
      const result = globalAgentContextManager.getContext();
      expect(result).toEqual({ homePath: '/home/user', currentTime: '2024-01-01' });
    });

    it('should initialize window context if not set', () => {
      // Ensure context key is not set
      expect((window as any)[CONTEXT_KEY]).toBeUndefined();

      // Accessing context should auto-initialize it
      const result = globalAgentContextManager.getContext();
      expect(result).toEqual({});
      expect((window as any)[CONTEXT_KEY]).toEqual({});
    });
  });

  describe('updateContext', () => {
    it('should merge updates into existing context', () => {
      (window as any)[CONTEXT_KEY] = { homePath: '/home/user' };

      globalAgentContextManager.updateContext({ desktopPath: '/home/user/Desktop' });

      expect((window as any)[CONTEXT_KEY]).toEqual({
        homePath: '/home/user',
        desktopPath: '/home/user/Desktop',
      });
    });

    it('should create context from scratch when not initialized', () => {
      globalAgentContextManager.updateContext({ homePath: '/home/alice' });

      expect((window as any)[CONTEXT_KEY]).toEqual({ homePath: '/home/alice' });
    });

    it('should override existing keys with new values', () => {
      (window as any)[CONTEXT_KEY] = { homePath: '/home/old' };

      globalAgentContextManager.updateContext({ homePath: '/home/new' });

      expect((window as any)[CONTEXT_KEY]).toEqual({ homePath: '/home/new' });
    });

    it('should handle updating multiple fields at once', () => {
      globalAgentContextManager.updateContext({
        homePath: '/home/user',
        desktopPath: '/home/user/Desktop',
        documentsPath: '/home/user/Documents',
        downloadsPath: '/home/user/Downloads',
        currentTime: '2024-01-01T00:00:00Z',
      });

      expect(globalAgentContextManager.getContext()).toEqual({
        homePath: '/home/user',
        desktopPath: '/home/user/Desktop',
        documentsPath: '/home/user/Documents',
        downloadsPath: '/home/user/Downloads',
        currentTime: '2024-01-01T00:00:00Z',
      });
    });

    it('should not affect keys not included in update', () => {
      (window as any)[CONTEXT_KEY] = {
        homePath: '/home/user',
        currentTime: '2024-01-01',
      };

      globalAgentContextManager.updateContext({ desktopPath: '/home/user/Desktop' });

      const ctx = globalAgentContextManager.getContext();
      expect(ctx.homePath).toBe('/home/user');
      expect(ctx.currentTime).toBe('2024-01-01');
      expect(ctx.desktopPath).toBe('/home/user/Desktop');
    });
  });

  describe('setContext', () => {
    it('should replace entire context', () => {
      (window as any)[CONTEXT_KEY] = { homePath: '/home/old', currentTime: '2023' };

      globalAgentContextManager.setContext({ homePath: '/home/new' });

      expect((window as any)[CONTEXT_KEY]).toEqual({ homePath: '/home/new' });
      expect((window as any)[CONTEXT_KEY].currentTime).toBeUndefined();
    });

    it('should set context to empty object', () => {
      (window as any)[CONTEXT_KEY] = { homePath: '/home/user' };

      globalAgentContextManager.setContext({});

      expect((window as any)[CONTEXT_KEY]).toEqual({});
    });

    it('should set all context fields', () => {
      const newContext = {
        homePath: '/home/user',
        desktopPath: '/home/user/Desktop',
        documentsPath: '/home/user/Documents',
        downloadsPath: '/home/user/Downloads',
        musicPath: '/home/user/Music',
        picturesPath: '/home/user/Pictures',
        videosPath: '/home/user/Videos',
        userDataPath: '/home/user/.config/app',
        currentTime: '2024-01-01T00:00:00Z',
      };

      globalAgentContextManager.setContext(newContext);

      expect(globalAgentContextManager.getContext()).toEqual(newContext);
    });
  });

  describe('fillTemplate', () => {
    beforeEach(() => {
      globalAgentContextManager.setContext({
        homePath: '/home/user',
        desktopPath: '/home/user/Desktop',
        documentsPath: '/home/user/Documents',
        currentTime: '2024-01-01T00:00:00Z',
      });
    });

    it('should return empty string when template is undefined', () => {
      expect(globalAgentContextManager.fillTemplate(undefined)).toBe('');
    });

    it('should return empty string when template is empty string', () => {
      expect(globalAgentContextManager.fillTemplate('')).toBe('');
    });

    it('should return template unchanged when no placeholders', () => {
      const template = 'No placeholders here.';
      expect(globalAgentContextManager.fillTemplate(template)).toBe(template);
    });

    it('should replace a single placeholder', () => {
      const template = 'Home directory: {{homePath}}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe(
        'Home directory: /home/user',
      );
    });

    it('should replace multiple different placeholders', () => {
      const template = 'Home: {{homePath}}, Desktop: {{desktopPath}}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe(
        'Home: /home/user, Desktop: /home/user/Desktop',
      );
    });

    it('should replace multiple occurrences of the same placeholder', () => {
      const template = '{{homePath}} and {{homePath}} again';
      expect(globalAgentContextManager.fillTemplate(template)).toBe(
        '/home/user and /home/user again',
      );
    });

    it('should replace placeholder with [N/A] when key is not in context', () => {
      const template = 'Unknown: {{userDataPath}}';
      // userDataPath was not set in beforeEach
      expect(globalAgentContextManager.fillTemplate(template)).toBe('Unknown: [N/A]');
    });

    it('should handle placeholders with whitespace around key', () => {
      const template = 'Home: {{ homePath }}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe('Home: /home/user');
    });

    it('should handle template with only placeholders', () => {
      const template = '{{homePath}}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe('/home/user');
    });

    it('should replace currentTime placeholder', () => {
      const template = 'Current time: {{currentTime}}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe(
        'Current time: 2024-01-01T00:00:00Z',
      );
    });

    it('should handle template with mixed known and unknown placeholders', () => {
      const template = '{{homePath}} | {{unknownKey}}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe('/home/user | [N/A]');
    });

    it('should handle template with complex text around placeholders', () => {
      const template = `
Files saved in {{documentsPath}}.
Desktop at {{desktopPath}}.
Home at {{homePath}}.
`;
      expect(globalAgentContextManager.fillTemplate(template)).toBe(`
Files saved in /home/user/Documents.
Desktop at /home/user/Desktop.
Home at /home/user.
`);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton globalAgentContextManager instance', () => {
      expect(globalAgentContextManager).toBeDefined();
      expect(typeof globalAgentContextManager.getContext).toBe('function');
      expect(typeof globalAgentContextManager.updateContext).toBe('function');
      expect(typeof globalAgentContextManager.setContext).toBe('function');
      expect(typeof globalAgentContextManager.fillTemplate).toBe('function');
    });

    it('should share state across multiple uses of singleton', () => {
      globalAgentContextManager.setContext({ homePath: '/home/shared' });

      // Another "use" of the same singleton
      const ctx = globalAgentContextManager.getContext();
      expect(ctx.homePath).toBe('/home/shared');
    });
  });
});
