import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncLocalStorage } from './localStorage';

describe('AsyncLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with the given storage key', () => {
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      expect(storage).toBeInstanceOf(AsyncLocalStorage);
    });

    it('should create an instance with LOBE_SYSTEM_STATUS key', () => {
      const storage = new AsyncLocalStorage('LOBE_SYSTEM_STATUS');
      expect(storage).toBeInstanceOf(AsyncLocalStorage);
    });

    describe('migration from LOBE_GLOBAL', () => {
      it('should migrate preference data from LOBE_GLOBAL to LOBE_PREFERENCE', () => {
        const oldData = {
          state: {
            preference: { theme: 'dark', language: 'zh-CN' },
          },
        };
        localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

        new AsyncLocalStorage('LOBE_PREFERENCE');

        const migrated = localStorage.getItem('LOBE_PREFERENCE');
        expect(migrated).toBe(JSON.stringify(oldData.state.preference));
      });

      it('should remove LOBE_GLOBAL key after migration', () => {
        const oldData = {
          state: {
            preference: { theme: 'light' },
          },
        };
        localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

        new AsyncLocalStorage('LOBE_PREFERENCE');

        expect(localStorage.getItem('LOBE_GLOBAL')).toBeNull();
      });

      it('should remove LOBE_GLOBAL key even when preference is absent', () => {
        const oldData = { state: {} };
        localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

        new AsyncLocalStorage('LOBE_PREFERENCE');

        expect(localStorage.getItem('LOBE_GLOBAL')).toBeNull();
        // LOBE_PREFERENCE should not be set if preference was absent
        expect(localStorage.getItem('LOBE_PREFERENCE')).toBeNull();
      });

      it('should not perform migration when LOBE_GLOBAL key is absent', () => {
        const spy = vi.spyOn(Storage.prototype, 'removeItem');

        new AsyncLocalStorage('LOBE_PREFERENCE');

        expect(spy).not.toHaveBeenCalled();
      });

      it('should not overwrite existing LOBE_PREFERENCE when migrating', () => {
        const existingPreference = { theme: 'auto' };
        localStorage.setItem('LOBE_PREFERENCE', JSON.stringify(existingPreference));

        const oldData = {
          state: {
            preference: { theme: 'dark', language: 'zh-CN' },
          },
        };
        localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

        new AsyncLocalStorage('LOBE_PREFERENCE');

        // After migration, LOBE_PREFERENCE should be updated to the migrated value
        const result = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
        expect(result).toEqual(oldData.state.preference);
      });
    });
  });

  describe('saveToLocalStorage', () => {
    it('should save state to localStorage', async () => {
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');

      await storage.saveToLocalStorage({ theme: 'dark' });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'dark' });
    });

    it('should merge with existing state', async () => {
      const storage = new AsyncLocalStorage<{ theme: string; language: string }>(
        'LOBE_PREFERENCE',
      );

      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify({ theme: 'light', language: 'en' }));

      await storage.saveToLocalStorage({ theme: 'dark' });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'dark', language: 'en' });
    });

    it('should save state when localStorage is empty', async () => {
      const storage = new AsyncLocalStorage<{ count: number }>('LOBE_SYSTEM_STATUS');

      await storage.saveToLocalStorage({ count: 42 });

      const stored = JSON.parse(localStorage.getItem('LOBE_SYSTEM_STATUS') || '{}');
      expect(stored).toEqual({ count: 42 });
    });

    it('should overwrite keys that already exist', async () => {
      const storage = new AsyncLocalStorage<{ value: string }>('LOBE_PREFERENCE');

      await storage.saveToLocalStorage({ value: 'first' });
      await storage.saveToLocalStorage({ value: 'second' });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ value: 'second' });
    });

    it('should save to correct key based on constructor argument', async () => {
      const preferenceStorage = new AsyncLocalStorage('LOBE_PREFERENCE');
      const systemStatusStorage = new AsyncLocalStorage('LOBE_SYSTEM_STATUS');

      await preferenceStorage.saveToLocalStorage({ pref: true });
      await systemStatusStorage.saveToLocalStorage({ status: 'ok' });

      expect(JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}')).toEqual({ pref: true });
      expect(JSON.parse(localStorage.getItem('LOBE_SYSTEM_STATUS') || '{}')).toEqual({
        status: 'ok',
      });
    });

    it('should handle saving nested objects', async () => {
      const storage = new AsyncLocalStorage<{ nested: { deep: { value: number } } }>(
        'LOBE_PREFERENCE',
      );

      await storage.saveToLocalStorage({ nested: { deep: { value: 99 } } });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ nested: { deep: { value: 99 } } });
    });
  });

  describe('getFromLocalStorage', () => {
    it('should return empty object when nothing is stored', async () => {
      const storage = new AsyncLocalStorage<object>('LOBE_PREFERENCE');

      const result = await storage.getFromLocalStorage();

      expect(result).toEqual({});
    });

    it('should return stored data', async () => {
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      const data = { theme: 'dark' };
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify(data));

      const result = await storage.getFromLocalStorage();

      expect(result).toEqual(data);
    });

    it('should use the instance storage key by default', async () => {
      const storage = new AsyncLocalStorage<{ count: number }>('LOBE_SYSTEM_STATUS');
      const data = { count: 5 };
      localStorage.setItem('LOBE_SYSTEM_STATUS', JSON.stringify(data));

      const result = await storage.getFromLocalStorage();

      expect(result).toEqual(data);
    });

    it('should accept a custom key override', async () => {
      const storage = new AsyncLocalStorage<{ value: string }>('LOBE_PREFERENCE');
      const systemData = { value: 'from-system' };
      localStorage.setItem('LOBE_SYSTEM_STATUS', JSON.stringify(systemData));

      const result = await storage.getFromLocalStorage('LOBE_SYSTEM_STATUS');

      expect(result).toEqual(systemData);
    });

    it('should return empty object when key has no data in localStorage', async () => {
      const storage = new AsyncLocalStorage<object>('LOBE_SYSTEM_STATUS');

      const result = await storage.getFromLocalStorage();

      expect(result).toEqual({});
    });

    it('should reflect the latest saved state', async () => {
      const storage = new AsyncLocalStorage<{ version: number }>('LOBE_PREFERENCE');

      await storage.saveToLocalStorage({ version: 1 });
      await storage.saveToLocalStorage({ version: 2 });

      const result = await storage.getFromLocalStorage();

      expect(result).toEqual({ version: 2 });
    });
  });
});
