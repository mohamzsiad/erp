export * from './modules.js';
export * from './permissions.js';

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 50,
  MAX_LIMIT: 500,
} as const;

export const DOC_TYPES = {
  MRL: 'MRL',
  PRL: 'PRL',
  PE: 'PE',
  PQ: 'PQ',
  PO: 'PO',
  GRN: 'GRN',
  SI: 'SI',
  ST: 'ST',
  SA: 'SA',
  JE: 'JE',
  API: 'API',
  APY: 'APY',
  ARI: 'ARI',
  ARR: 'ARR',
  // Sales
  SEL: 'SEL',
  SQL: 'SQL',
  SOL: 'SOL',
  DNL: 'DNL',
  SVL: 'SVL',
  SRN: 'SRN',
  CRN: 'CRN',
  SCL: 'SCL',
  PBL: 'PBL',
} as const;

export const STOCK_THRESHOLDS = {
  DEAD_STOCK_DAYS: 180,
  INACTIVE_MOVEMENT_DAYS: 90,
} as const;

// Default Sales module configuration parameters (stored per company in
// Company.salesConfig; admin-editable). Services fall back to these defaults.
export const SALES_CONFIG_DEFAULTS = {
  CREDIT_CHECK_MODE: 'WARN',        // BLOCK | WARN | OFF
  RESERVE_STOCK_ON_ORDER: true,
  ALLOW_NEGATIVE_STOCK: false,
  SO_APPROVAL_REQUIRED: true,
  DEFAULT_TAX_CODE: 'VAT5',
  AUTO_POST_INVOICE: true,
  PRICE_OVERRIDE_ALLOWED: true,
} as const;
