import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
} from '../src/core/utils/permission-matcher';

describe('Permission Matcher', () => {
  describe('hasPermission', () => {
    it('returns false for empty granted list', () => {
      expect(hasPermission([], 'a:b')).toBe(false);
    });

    it('returns true for exact match', () => {
      expect(hasPermission(['operations:read:own'], 'operations:read:own')).toBe(true);
    });

    it('returns true when granted contains global wildcard', () => {
      expect(hasPermission(['*'], 'anything:you:want')).toBe(true);
    });

    it('matches trailing segment wildcard', () => {
      expect(hasPermission(['operations:read:*'], 'operations:read:own')).toBe(true);
    });

    it('matches middle segment wildcard', () => {
      expect(hasPermission(['operations:*:own'], 'operations:read:own')).toBe(true);
    });

    it('matches leading segment wildcard', () => {
      expect(hasPermission(['*:read:own'], 'operations:read:own')).toBe(true);
    });

    it('rejects mismatched segment count', () => {
      expect(hasPermission(['operations:read'], 'operations:read:own')).toBe(false);
      expect(hasPermission(['operations:read:own:extra'], 'operations:read:own')).toBe(false);
    });

    it('rejects different literal segment', () => {
      expect(hasPermission(['operations:write:own'], 'operations:read:own')).toBe(false);
    });

    it('returns false on null/undefined granted', () => {
      expect(hasPermission(undefined as any, 'a:b')).toBe(false);
      expect(hasPermission(null as any, 'a:b')).toBe(false);
    });

    it('matches when at least one granted entry matches', () => {
      expect(
        hasPermission(
          ['users:read:own', 'operations:read:*', 'invoices:read:own'],
          'operations:read:own'
        )
      ).toBe(true);
    });
  });

  describe('hasAllPermissions', () => {
    it('returns true when every required perm matches', () => {
      expect(
        hasAllPermissions(['ops:read:*', 'ops:write:*'], ['ops:read:own', 'ops:write:own'])
      ).toBe(true);
    });

    it('returns false if any required perm missing', () => {
      expect(hasAllPermissions(['ops:read:*'], ['ops:read:own', 'ops:write:own'])).toBe(false);
    });

    it('returns true on empty required list', () => {
      expect(hasAllPermissions(['ops:read:*'], [])).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('returns true if any required perm matches', () => {
      expect(hasAnyPermission(['ops:read:*'], ['ops:read:own', 'ops:write:own'])).toBe(true);
    });

    it('returns false if none match', () => {
      expect(hasAnyPermission(['users:read:*'], ['ops:read:own', 'ops:write:own'])).toBe(false);
    });

    it('returns false on empty required list', () => {
      expect(hasAnyPermission(['ops:read:*'], [])).toBe(false);
    });
  });
});
