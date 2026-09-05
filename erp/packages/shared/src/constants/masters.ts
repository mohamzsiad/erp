// ═══════════════════════════════════════════════════════════════════════════════
// Shared master-data rules used by both the API and the UI.
// ═══════════════════════════════════════════════════════════════════════════════

/** Maximum length of any short / trade name across the masters. */
export const SHORT_NAME_LENGTH = 50;

/**
 * Derives a short/trade name from the full name: the same text, trimmed and cut
 * to SHORT_NAME_LENGTH. The UI mirrors the name into the short-name box as the
 * user types (until they edit it themselves) and the API applies the same rule
 * when a short name is left blank, so the two never disagree.
 */
export function deriveShortName(name: string | null | undefined, maxLength = SHORT_NAME_LENGTH): string {
  return (name ?? '').trim().slice(0, maxLength);
}

/**
 * Label for a master row in a lookup: always "CODE — NAME" so every dropdown in
 * the app reads the same way.
 */
export function masterLabel(code: string | null | undefined, name: string | null | undefined): string {
  const c = (code ?? '').trim();
  const n = (name ?? '').trim();
  if (c && n) return `${c} — ${n}`;
  return c || n;
}

/**
 * Checks a VAT registration number against the country's rule.
 * A country with no configured length accepts anything.
 */
export function validateVatNumber(
  vatNo: string | null | undefined,
  rule: { vatPrefix?: string | null; vatLength?: number | null } | null | undefined
): { ok: true } | { ok: false; message: string } {
  const value = (vatNo ?? '').trim();
  if (!value || !rule) return { ok: true };

  if (rule.vatPrefix && !value.toUpperCase().startsWith(rule.vatPrefix.toUpperCase())) {
    return { ok: false, message: `VAT number must start with "${rule.vatPrefix}"` };
  }
  if (rule.vatLength && value.length !== rule.vatLength) {
    return { ok: false, message: `VAT number must be exactly ${rule.vatLength} characters for this country` };
  }
  return { ok: true };
}
