import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password';

describe('password utilities', () => {
  describe('validatePasswordStrength', () => {
    it('rejects short passwords', () => {
      expect(validatePasswordStrength('Ab1!')).toEqual({
        valid: false,
        message: 'Password must be at least 8 characters',
      });
    });

    it('rejects passwords without uppercase', () => {
      expect(validatePasswordStrength('admin@123')).toMatchObject({ valid: false });
    });

    it('rejects passwords without lowercase', () => {
      expect(validatePasswordStrength('ADMIN@123')).toMatchObject({ valid: false });
    });

    it('rejects passwords without numbers', () => {
      expect(validatePasswordStrength('Admin@abc')).toMatchObject({ valid: false });
    });

    it('rejects passwords without special characters', () => {
      expect(validatePasswordStrength('Admin1234')).toMatchObject({ valid: false });
    });

    it('accepts valid passwords', () => {
      expect(validatePasswordStrength('Admin@123')).toEqual({ valid: true });
    });
  });

  describe('hashPassword + verifyPassword', () => {
    it('hashes and verifies correctly', async () => {
      const plain = 'Admin@123';
      const hash = await hashPassword(plain);
      expect(hash).not.toBe(plain);
      expect(hash.length).toBeGreaterThan(20);

      const valid = await verifyPassword(plain, hash);
      expect(valid).toBe(true);

      const invalid = await verifyPassword('WrongPassword!', hash);
      expect(invalid).toBe(false);
    });

    it('produces different hashes for same password (salt randomness)', async () => {
      const h1 = await hashPassword('Admin@123');
      const h2 = await hashPassword('Admin@123');
      expect(h1).not.toBe(h2);
    });
  });
});
