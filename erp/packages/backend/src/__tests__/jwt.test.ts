// Set required env vars before importing config
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test_secret_that_is_at_least_32_characters_long_ok';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_minimum_ok_yes';

import { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken } from '../utils/jwt';

describe('JWT utilities', () => {
  const payload = {
    userId: 'user_123',
    companyId: 'company_456',
    roleId: 'role_789',
    email: 'admin@demo.com',
  };

  describe('signAccessToken + verifyAccessToken', () => {
    it('signs and verifies a token correctly', () => {
      const token = signAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format

      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.companyId).toBe(payload.companyId);
      expect(decoded.email).toBe(payload.email);
    });

    it('throws on tampered token', () => {
      const token = signAccessToken(payload);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });

  describe('generateRefreshToken + hashRefreshToken', () => {
    it('generates a 128-char hex string', () => {
      const token = generateRefreshToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(128); // 64 bytes = 128 hex chars
    });

    it('hashes deterministically', () => {
      const token = generateRefreshToken();
      const h1 = hashRefreshToken(token);
      const h2 = hashRefreshToken(token);
      expect(h1).toBe(h2);
    });

    it('produces different tokens each call', () => {
      const t1 = generateRefreshToken();
      const t2 = generateRefreshToken();
      expect(t1).not.toBe(t2);
    });
  });
});
