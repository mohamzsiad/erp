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
} as const;

export const STOCK_THRESHOLDS = {
  DEAD_STOCK_DAYS: 180,
  INACTIVE_MOVEMENT_DAYS: 90,
} as const;
