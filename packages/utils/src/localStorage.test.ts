import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncLocalStorage } from './localStorage';

describe('AsyncLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  describe('constructor', () => {
    it('should create an instance with LOBE_PREFERENCE key', () => {
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      expect(storage).toBeInstanceOf(AsyncLocalStorage);
    });

    it('should create an instance with LOBE_SYSTEM_STATUS key', () => {
      const storage = new AsyncLocalStorage('LOBE_SYSTEM_STATUS');
      expect(storage).toBeInstanceOf(AsyncLocalStorage);
    });

    it('should skip migration when on server side (window is undefined)', () => {
      vi.stubGlobal('window', undefined);
      // Should not throw when window is undefined
      expect(() => new AsyncLocalStorage('LOBE_PREFERENCE')).not.toThrow();
    });

    it('should not run migration when LOBE_GLOBAL key does not exist', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

      new AsyncLocalStorage('LOBE_PREFERENCE');

      // Should not call setItem or removeItem since LOBE_GLOBAL doesn't exist
      expect(setItemSpy).not.toHaveBeenCalled();
      expect(removeItemSpy).not.toHaveBeenCalled();

      setItemSpy.mockRestore();
      removeItemSpy.mockRestore();
    });

    it('should migrate data from LOBE_GLOBAL to LOBE_PREFERENCE when preference exists', () => {
      const oldData = {
        state: {
          preference: { theme: 'dark', language: 'en' },
        },
      };
      localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

      new AsyncLocalStorage('LOBE_PREFERENCE');

      // Should have migrated preference to LOBE_PREFERENCE
      const migratedData = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(migratedData).toEqual({ theme: 'dark', language: 'en' });
    });

    it('should remove LOBE_GLOBAL key after migration', () => {
      const oldData = {
        state: {
          preference: { theme: 'dark' },
        },
      };
      localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

      new AsyncLocalStorage('LOBE_PREFERENCE');

      expect(localStorage.getItem('LOBE_GLOBAL')).toBeNull();
    });

    it('should remove LOBE_GLOBAL even when preference is not present', () => {
      const oldData = {
        state: {
          // no preference field
          otherData: { foo: 'bar' },
        },
      };
      localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

      new AsyncLocalStorage('LOBE_PREFERENCE');

      // LOBE_GLOBAL should be removed
      expect(localStorage.getItem('LOBE_GLOBAL')).toBeNull();
      // LOBE_PREFERENCE should not be set by migration (no preference found)
      expect(localStorage.getItem('LOBE_PREFERENCE')).toBeNull();
    });
  });

  describe('saveToLocalStorage', () => {
    it('should save state to localStorage', async () => {
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');

      await storage.saveToLocalStorage({ theme: 'dark' });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'dark' });
    });

    it('should merge new state with existing data', async () => {
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify({ theme: 'dark', language: 'en' }));
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');

      await storage.saveToLocalStorage({ theme: 'light' });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'light', language: 'en' });
    });

    it('should add new keys to existing data', async () => {
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify({ theme: 'dark' }));
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');

      await storage.saveToLocalStorage({ fontSize: 16 });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'dark', fontSize: 16 });
    });

    it('should save to the correct key based on storageKey', async () => {
      const storage = new AsyncLocalStorage('LOBE_SYSTEM_STATUS');

      await storage.saveToLocalStorage({ sidebarCollapsed: true });

      const stored = JSON.parse(localStorage.getItem('LOBE_SYSTEM_STATUS') || '{}');
      expect(stored).toEqual({ sidebarCollapsed: true });
      // LOBE_PREFERENCE should remain untouched
      expect(localStorage.getItem('LOBE_PREFERENCE')).toBeNull();
    });

    it('should overwrite existing keys with new values', async () => {
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify({ nested: { a: 1, b: 2 }, count: 5 }));
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');

      await storage.saveToLocalStorage({ nested: { a: 99 }, count: 10 });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      // shallow merge: nested is replaced entirely
      expect(stored.count).toBe(10);
      expect(stored.nested).toEqual({ a: 99 });
    });
  });

  describe('getFromLocalStorage', () => {
    it('should return parsed data from localStorage', async () => {
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify({ theme: 'dark', language: 'zh' }));
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');

      const result = await storage.getFromLocalStorage();

      expect(result).toEqual({ theme: 'dark', language: 'zh' });
    });

    it('should return empty object when no data exists', async () => {
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');

      const result = await storage.getFromLocalStorage();

      expect(result).toEqual({});
    });

    it('should return data for the default storageKey', async () => {
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify({ pref: 'value' }));
      localStorage.setItem('LOBE_SYSTEM_STATUS', JSON.stringify({ status: 'active' }));

      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage();

      expect(result).toEqual({ pref: 'value' });
    });

    it('should return data for a different key when specified', async () => {
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify({ pref: 'value' }));
      localStorage.setItem('LOBE_SYSTEM_STATUS', JSON.stringify({ status: 'active' }));

      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage('LOBE_SYSTEM_STATUS');

      expect(result).toEqual({ status: 'active' });
    });

    it('should return empty object when key has empty JSON', async () => {
      localStorage.setItem('LOBE_PREFERENCE', '{}');
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');

      const result = await storage.getFromLocalStorage();

      expect(result).toEqual({});
    });

    it('should return a Promise', () => {
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      const result = storage.getFromLocalStorage();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('integration', () => {
    it('should save and retrieve data correctly', async () => {
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');

      await storage.saveToLocalStorage({ theme: 'dark', fontSize: 14 });
      const result = await storage.getFromLocalStorage();

      expect(result).toEqual({ theme: 'dark', fontSize: 14 });
    });

    it('should handle multiple save operations accumulating state', async () => {
      const storage = new AsyncLocalStorage('LOBE_SYSTEM_STATUS');

      await storage.saveToLocalStorage({ sidebarOpen: true });
      await storage.saveToLocalStorage({ panelWidth: 300 });
      await storage.saveToLocalStorage({ sidebarOpen: false });

      const result = await storage.getFromLocalStorage();

      expect(result).toEqual({ sidebarOpen: false, panelWidth: 300 });
    });

    it('should handle migration and then save/retrieve correctly', async () => {
      // Setup old data
      localStorage.setItem(
        'LOBE_GLOBAL',
        JSON.stringify({ state: { preference: { theme: 'dark' } } }),
      );

      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');

      // After migration, the preference should be set
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual({ theme: 'dark' });

      // Now save new data (should merge)
      await storage.saveToLocalStorage({ language: 'en' });
      const updated = await storage.getFromLocalStorage();
      expect(updated).toEqual({ theme: 'dark', language: 'en' });
    });
  });
});
