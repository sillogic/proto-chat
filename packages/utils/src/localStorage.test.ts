import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AsyncLocalStorage } from './localStorage';

const PREV_KEY = 'LOBE_GLOBAL';

describe('AsyncLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('constructor', () => {
    it('should set the storage key', () => {
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      expect(storage['storageKey']).toBe('LOBE_PREFERENCE');
    });

    it('should set the storage key for LOBE_SYSTEM_STATUS', () => {
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_SYSTEM_STATUS');
      expect(storage['storageKey']).toBe('LOBE_SYSTEM_STATUS');
    });

    it('should not migrate when old key does not exist', () => {
      new AsyncLocalStorage('LOBE_PREFERENCE');
      expect(localStorage.getItem('LOBE_PREFERENCE')).toBeNull();
      expect(localStorage.getItem(PREV_KEY)).toBeNull();
    });

    it('should migrate preference data from old key when state.preference exists', () => {
      const oldData = {
        state: {
          preference: { theme: 'dark', language: 'en' },
          other: 'data',
        },
      };
      localStorage.setItem(PREV_KEY, JSON.stringify(oldData));

      new AsyncLocalStorage('LOBE_PREFERENCE');

      // Old key should be removed
      expect(localStorage.getItem(PREV_KEY)).toBeNull();
      // Preference data should be migrated to LOBE_PREFERENCE
      const migrated = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(migrated).toEqual({ theme: 'dark', language: 'en' });
    });

    it('should remove old key but not set LOBE_PREFERENCE when state.preference is missing', () => {
      const oldData = {
        state: {
          other: 'data',
        },
      };
      localStorage.setItem(PREV_KEY, JSON.stringify(oldData));

      new AsyncLocalStorage('LOBE_PREFERENCE');

      // Old key should be removed
      expect(localStorage.getItem(PREV_KEY)).toBeNull();
      // LOBE_PREFERENCE should not be set since there was no preference
      expect(localStorage.getItem('LOBE_PREFERENCE')).toBeNull();
    });

    it('should remove old key and not set LOBE_PREFERENCE when state.preference is null', () => {
      const oldData = {
        state: {
          preference: null,
        },
      };
      localStorage.setItem(PREV_KEY, JSON.stringify(oldData));

      new AsyncLocalStorage('LOBE_PREFERENCE');

      expect(localStorage.getItem(PREV_KEY)).toBeNull();
      expect(localStorage.getItem('LOBE_PREFERENCE')).toBeNull();
    });

    it('should only migrate LOBE_PREFERENCE key regardless of storageKey constructor param', () => {
      const oldData = {
        state: {
          preference: { theme: 'light' },
        },
      };
      localStorage.setItem(PREV_KEY, JSON.stringify(oldData));

      new AsyncLocalStorage('LOBE_SYSTEM_STATUS');

      expect(localStorage.getItem(PREV_KEY)).toBeNull();
      // Migration always writes to LOBE_PREFERENCE
      const migrated = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(migrated).toEqual({ theme: 'light' });
      // LOBE_SYSTEM_STATUS is not touched
      expect(localStorage.getItem('LOBE_SYSTEM_STATUS')).toBeNull();
    });
  });

  describe('getFromLocalStorage', () => {
    it('should return empty object when nothing is stored', async () => {
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual({});
    });

    it('should return stored data', async () => {
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify({ theme: 'dark' }));
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual({ theme: 'dark' });
    });

    it('should return data from explicit key parameter', async () => {
      localStorage.setItem('LOBE_SYSTEM_STATUS', JSON.stringify({ sidebarOpen: true }));
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage('LOBE_SYSTEM_STATUS');
      expect(result).toEqual({ sidebarOpen: true });
    });

    it('should return empty object when explicit key has no data', async () => {
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage('LOBE_SYSTEM_STATUS');
      expect(result).toEqual({});
    });

    it('should return nested data correctly', async () => {
      const data = { settings: { theme: 'dark', fontSize: 14 }, version: 2 };
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify(data));
      const storage = new AsyncLocalStorage<typeof data>('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual(data);
    });
  });

  describe('saveToLocalStorage', () => {
    it('should save state to localStorage', async () => {
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      await storage.saveToLocalStorage({ theme: 'dark' });
      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'dark' });
    });

    it('should merge new state with existing state', async () => {
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify({ theme: 'light', language: 'en' }));
      const storage = new AsyncLocalStorage<{ theme: string; language: string }>('LOBE_PREFERENCE');
      await storage.saveToLocalStorage({ theme: 'dark' });
      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'dark', language: 'en' });
    });

    it('should add new fields to existing state', async () => {
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify({ theme: 'light' }));
      const storage = new AsyncLocalStorage<{ theme: string; fontSize?: number }>(
        'LOBE_PREFERENCE',
      );
      await storage.saveToLocalStorage({ fontSize: 16 });
      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'light', fontSize: 16 });
    });

    it('should save to the configured storageKey', async () => {
      const storage = new AsyncLocalStorage<{ open: boolean }>('LOBE_SYSTEM_STATUS');
      await storage.saveToLocalStorage({ open: true });
      expect(localStorage.getItem('LOBE_SYSTEM_STATUS')).toBe(JSON.stringify({ open: true }));
      expect(localStorage.getItem('LOBE_PREFERENCE')).toBeNull();
    });

    it('should overwrite existing fields with new state values', async () => {
      localStorage.setItem(
        'LOBE_PREFERENCE',
        JSON.stringify({ theme: 'light', language: 'zh-CN', fontSize: 14 }),
      );
      const storage = new AsyncLocalStorage<{ theme: string; language: string; fontSize: number }>(
        'LOBE_PREFERENCE',
      );
      await storage.saveToLocalStorage({ theme: 'dark', fontSize: 16 });
      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'dark', language: 'zh-CN', fontSize: 16 });
    });

    it('should save and retrieve multiple times correctly', async () => {
      const storage = new AsyncLocalStorage<{ count: number }>('LOBE_PREFERENCE');
      await storage.saveToLocalStorage({ count: 1 });
      await storage.saveToLocalStorage({ count: 2 });
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual({ count: 2 });
    });
  });
});
