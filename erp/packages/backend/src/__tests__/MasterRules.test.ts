import { deriveShortName, masterLabel, validateVatNumber, SHORT_NAME_LENGTH } from '@clouderp/shared';

describe('deriveShortName', () => {
  it('mirrors a short name unchanged', () => {
    expect(deriveShortName('ACME TRADING')).toBe('ACME TRADING');
  });

  it('truncates to the shared limit', () => {
    const long = 'THE SULTAN S SPECIAL FORCE PROCUREMENT AND LOGISTICS DIVISION (SSF)';
    const short = deriveShortName(long);
    expect(short).toHaveLength(SHORT_NAME_LENGTH);
    expect(long.startsWith(short)).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(deriveShortName('  ACME  ')).toBe('ACME');
  });

  it('handles a missing name', () => {
    expect(deriveShortName(null)).toBe('');
    expect(deriveShortName(undefined)).toBe('');
  });
});

describe('masterLabel', () => {
  it('renders CODE — NAME', () => {
    expect(masterLabel('STD_PL', 'Standard Price List')).toBe('STD_PL — Standard Price List');
  });

  it('falls back to whichever half is present', () => {
    expect(masterLabel('SM0001', null)).toBe('SM0001');
    expect(masterLabel(null, 'Muscat')).toBe('Muscat');
    expect(masterLabel(null, null)).toBe('');
  });
});

describe('validateVatNumber', () => {
  const oman = { vatPrefix: 'OM', vatLength: 15 };
  const uae = { vatPrefix: null, vatLength: 15 };
  const kuwait = { vatPrefix: null, vatLength: null };

  it('accepts a correctly formed Oman number', () => {
    expect(validateVatNumber('OM1234567890123', oman).ok).toBe(true);
  });

  it('rejects the wrong length', () => {
    const r = validateVatNumber('OM123', oman);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/exactly 15/);
  });

  it('rejects a missing country prefix', () => {
    const r = validateVatNumber('AE1234567890123', oman);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/must start with "OM"/);
  });

  it('checks length alone where no prefix is mandated', () => {
    expect(validateVatNumber('123456789012345', uae).ok).toBe(true);
    expect(validateVatNumber('12345', uae).ok).toBe(false);
  });

  it('accepts anything for a country with no rule', () => {
    expect(validateVatNumber('WHATEVER', kuwait).ok).toBe(true);
  });

  it('accepts a blank number — the field itself is optional', () => {
    expect(validateVatNumber('', oman).ok).toBe(true);
    expect(validateVatNumber(null, oman).ok).toBe(true);
  });

  it('accepts anything when the country is unknown', () => {
    expect(validateVatNumber('X', null).ok).toBe(true);
  });
});
