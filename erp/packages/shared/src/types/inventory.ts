import type { AuditInfo } from './common.js';

export type ItemStatus = 'ACTIVE' | 'INACTIVE' | 'OBSOLETE' | 'DEAD';
export type TrackingType = 'NONE' | 'SERIAL' | 'BATCH' | 'LOT';
export type GrnStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface Item extends AuditInfo {
  id: string;
  companyId: string;
  code: string;
  description: string;
  shortDescription: string | null;
  categoryId: string | null;
  uomId: string;
  grade1Options: string[];
  grade2Options: string[];
  reorderLevel: number;
  reorderQty: number;
  minStock: number;
  maxStock: number;
  standardCost: number;
  trackingType: TrackingType;
  status: ItemStatus;
}

export interface StockBalance {
  id: string;
  itemId: string;
  warehouseId: string;
  binId: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  avgCost: number;
  updatedAt: string;
  // Computed
  qtyAvailable?: number;
  stockValue?: number;
}

export interface Warehouse {
  id: string;
  companyId: string;
  code: string;
  name: string;
  locationId: string;
  isActive: boolean;
}

export interface GrnLine {
  id: string;
  grnId: string;
  itemId: string;
  poLineId: string | null;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  binId: string | null;
  lotNo: string | null;
  batchNo: string | null;
  expiryDate: string | null;
  lineNo: number;
}

export interface StockMovement {
  id: string;
  itemId: string;
  warehouseId: string;
  binId: string | null;
  qty: number;
  avgCost: number;
  transactionType: 'GRN' | 'ISSUE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';
  sourceDocId: string;
  sourceDocNo: string;
  balance: number;
  createdAt: string;
}

export interface StockSummary {
  obsoleteStock: number;
  inactiveStock: number;
  deadStock: number;
  pendingIssues: number;
  pendingLto: number;
  pendingGrn: number;
}
