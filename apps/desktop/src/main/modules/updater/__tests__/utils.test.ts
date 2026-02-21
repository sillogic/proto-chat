import { describe, expect, it } from 'vitest';

import { shouldUpdateApp } from '../utils';

describe('shouldUpdateApp', () => {
  describe('app suffix override', () => {
    it('should return true when nextVersion contains .app suffix', () => {
      const result = shouldUpdateApp('1.0.0', '1.0.1.app');
      expect(result).toBe(true);
    });

    it('should return true when nextVersion has .app anywhere in string', () => {
      const result = shouldUpdateApp('2.3.4', '2.3.5.app');
      expect(result).toBe(true);
    });

    it('should not treat .app as trigger when only in currentVersion', () => {
      // .app suffix is only checked on nextVersion
      const result = shouldUpdateApp('1.0.0.app', '1.0.1');
      // fallback: semver.parse('1.0.0.app') returns null → returns true
      expect(result).toBe(true);
    });
  });

  describe('major version change', () => {
    it('should return true when major version increases', () => {
      const result = shouldUpdateApp('1.5.3', '2.0.0');
      expect(result).toBe(true);
    });

    it('should return true when major version decreases (downgrade)', () => {
      const result = shouldUpdateApp('2.0.0', '1.9.9');
      expect(result).toBe(true);
    });

    it('should return true for 0.x.x to 1.x.x upgrade', () => {
      const result = shouldUpdateApp('0.9.0', '1.0.0');
      expect(result).toBe(true);
    });
  });

  describe('minor version change', () => {
    it('should return true when minor version increases', () => {
      const result = shouldUpdateApp('1.0.0', '1.1.0');
      expect(result).toBe(true);
    });

    it('should return true when minor version decreases', () => {
      const result = shouldUpdateApp('1.5.0', '1.4.0');
      expect(result).toBe(true);
    });

    it('should return true when minor version changes with same major', () => {
      const result = shouldUpdateApp('2.3.7', '2.4.0');
      expect(result).toBe(true);
    });
  });

  describe('patch-only version change (hot reload preferred)', () => {
    it('should return false when only patch version increases', () => {
      const result = shouldUpdateApp('1.0.0', '1.0.1');
      expect(result).toBe(false);
    });

    it('should return false when only patch version decreases', () => {
      const result = shouldUpdateApp('1.0.5', '1.0.3');
      expect(result).toBe(false);
    });

    it('should return false when patch version goes from 0 to high number', () => {
      const result = shouldUpdateApp('2.3.0', '2.3.99');
      expect(result).toBe(false);
    });

    it('should return false for identical versions (no change needed)', () => {
      const result = shouldUpdateApp('1.2.3', '1.2.3');
      expect(result).toBe(false);
    });
  });

  describe('invalid version strings', () => {
    it('should return true when currentVersion is invalid', () => {
      const result = shouldUpdateApp('not-a-version', '1.0.1');
      expect(result).toBe(true);
    });

    it('should return true when nextVersion is invalid (no .app suffix)', () => {
      const result = shouldUpdateApp('1.0.0', 'not-a-version');
      expect(result).toBe(true);
    });

    it('should return true when both versions are invalid', () => {
      const result = shouldUpdateApp('foo', 'bar');
      expect(result).toBe(true);
    });

    it('should return true when currentVersion is empty string', () => {
      const result = shouldUpdateApp('', '1.0.0');
      expect(result).toBe(true);
    });

    it('should return true when nextVersion is empty string', () => {
      const result = shouldUpdateApp('1.0.0', '');
      expect(result).toBe(true);
    });
  });

  describe('prerelease versions', () => {
    it('should return false when only prerelease tag changes within same major.minor', () => {
      // semver.parse('1.0.0-beta') → major=1, minor=0 — same as '1.0.0'
      const result = shouldUpdateApp('1.0.0', '1.0.0-beta');
      expect(result).toBe(false);
    });

    it('should return true when major changes via prerelease version', () => {
      const result = shouldUpdateApp('1.0.0', '2.0.0-beta');
      expect(result).toBe(true);
    });

    it('should return true when minor changes via prerelease version', () => {
      const result = shouldUpdateApp('1.0.0', '1.1.0-alpha');
      expect(result).toBe(true);
    });
  });

  describe('combined scenarios', () => {
    it('should prioritize .app suffix check before semver parsing', () => {
      // Even if it's also a major change, .app suffix should still trigger true
      const result = shouldUpdateApp('1.0.0', '2.0.0.app');
      expect(result).toBe(true);
    });

    it('should handle version with build metadata', () => {
      // semver.parse handles build metadata
      const result = shouldUpdateApp('1.0.0+build.1', '1.0.1+build.2');
      expect(result).toBe(false);
    });

    it('should return false for patch bump in a large version number', () => {
      const result = shouldUpdateApp('10.20.30', '10.20.31');
      expect(result).toBe(false);
    });

    it('should return true for minor bump in a large version number', () => {
      const result = shouldUpdateApp('10.20.30', '10.21.0');
      expect(result).toBe(true);
    });
  });
});
