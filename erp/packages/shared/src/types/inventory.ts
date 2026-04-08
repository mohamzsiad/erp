import type { AuditInfo } from './common.js';

// ── Enums ──────────────────────────────────────────────────────────────────────
export type ItemStatus = 'ACTIVE' | 'INACTIVE' | 'OBSOLETE' | 'DEAD';
export type TrackingType = 'NONE' | 'SERIAL' | 'BATCH' | 'LOT';
export type GrnStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type StockDocStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'CANCELLED';
export type StockTransactionType = 'GRN' | 'ISSUE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';

// ── Item Master ────────────────────────────────────────────────────────────────
export interface ItemCategory {
  id: string;
  companyId: string;
  code: string;
  name: string;
  parentId: string | null;
}

export interface Uom {
  id: string;
  companyId: string;
  code: string;
  name: string;
  symbol: string;
}

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
  // Joins
  uom?: Uom;
  category?: ItemCategory | null;
}

export interface ItemStockDetail {
  item: Item;
  balances: (StockBalance & {
    warehouse: { id: string; code: string; name: string };
    bin?: { id: string; code: string; name: string } | null;
  })[];
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  totalValue: number;
}

export interface ReorderAlert {
  item: Pick<Item, 'id' | 'code' | 'description' | 'status'>;
  uom: Pick<Uom, 'code' | 'symbol'>;
  qtyOnHand: number;
  reorderLevel: number;
  reorderQty: number;
  shortage: number;
}

// ── Warehouse & Bin ────────────────────────────────────────────────────────────
export interface Warehouse {
  id: string;
  companyId: string;
  code: string;
  name: string;
  locationId: string;
  isActive: boolean;
}

export interface Bin {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  capacity: number | null;
}

export interface WarehouseStockSummary {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  totalItems: number;
  totalQtyOnHand: number;
  totalStockValue: number;
  topItems: Array<{
    itemCode: string;
    description: string;
    qtyOnHand: number;
    stockValue: number;
  }>;
}

// ── Stock Engine ───────────────────────────────────────────────────────────────
export interface StockUpdateParams {
  itemId: string;
  warehouseId: string;
  binId: string | null;
  qty: number;            // positive = IN, negative = OUT
  avgCost: number;        // purchase price for GRN; current cost for others
  transactionType: StockTransactionType;
  sourceDocId: string;
  sourceDocNo: string;
  userId: string;
  companyId: string;
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

export interface StockMovement {
  id: string;
  itemId: string;
  warehouseId: string;
  binId: string | null;
  qty: number;
  avgCost: number;
  balanceAfter: number;
  transactionType: StockTransactionType;
  sourceDocId: string;
  sourceDocNo: string;
  companyId: string;
  userId: string;
  createdAt: string;
}

// ── GRN ───────────────────────────────────────────────────────────────────────
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
  // Joins
  item?: Pick<Item, 'id' | 'code' | 'description'>;
  bin?: Pick<Bin, 'id' | 'code'> | null;
}

export interface GrnHeader extends AuditInfo {
  id: string;
  companyId: string;
  docNo: string;
  poId: string | null;
  supplierId: string;
  warehouseId: string;
  locationId: string | null;
  docDate: string;
  remarks: string | null;
  status: GrnStatus;
  postedAt: string | null;
  createdById: string;
  lines: GrnLine[];
}

export interface CreateGrnInput {
  poId: string;
  warehouseId: string;
  locationId?: string;
  docDate: string;
  remarks?: string;
  lines: Array<{
    poLineId: string;
    itemId: string;
    receivedQty: number;
    acceptedQty: number;
    rejectedQty?: number;
    binId?: string;
    lotNo?: string;
    batchNo?: string;
    expiryDate?: string;
    lineNo: number;
  }>;
}

// ── Stock Issue ────────────────────────────────────────────────────────────────
export interface StockIssueLine {
  id: string;
  issueId: string;
  itemId: string;
  binId: string | null;
  issuedQty: number;
  uomId: string;
  avgCost: number;
  lineNo: number;
  item?: Pick<Item, 'id' | 'code' | 'description'>;
}

export interface StockIssue extends AuditInfo {
  id: string;
  companyId: string;
  docNo: string;
  docDate: string;
  warehouseId: string;
  chargeCodeId: string;
  mrlId: string | null;
  status: StockDocStatus;
  remarks: string | null;
  createdById: string;
  lines: StockIssueLine[];
}

export interface CreateIssueInput {
  docDate: string;
  warehouseId: string;
  chargeCodeId: string;
  mrlId?: string;
  remarks?: string;
  lines: Array<{
    itemId: string;
    binId?: string;
    issuedQty: number;
    uomId: string;
    lineNo: number;
  }>;
}

// ── Stock Transfer ─────────────────────────────────────────────────────────────
export interface StockTransferLine {
  id: string;
  transferId: string;
  itemId: string;
  fromBinId: string | null;
  toBinId: string | null;
  transferQty: number;
  uomId: string;
  lineNo: number;
  item?: Pick<Item, 'id' | 'code' | 'description'>;
}

export interface StockTransfer extends AuditInfo {
  id: string;
  companyId: string;
  docNo: string;
  docDate: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: StockDocStatus;
  remarks: string | null;
  createdById: string;
  lines: StockTransferLine[];
}

// ── Stock Adjustment ──────────────────────────────────────────────────────────
export interface StockAdjustmentLine {
  id: string;
  adjustmentId: string;
  itemId: string;
  binId: string | null;
  systemQty: number;
  physicalQty: number;
  varianceQty: number;
  uomId: string;
  avgCost: number;
  lineNo: number;
  item?: Pick<Item, 'id' | 'code' | 'description'>;
}

export interface StockAdjustment extends AuditInfo {
  id: string;
  companyId: string;
  docNo: string;
  docDate: string;
  warehouseId: string;
  reasonId: string;
  status: StockDocStatus;
  approvedById: string | null;
  createdById: string;
  lines: StockAdjustmentLine[];
}

export interface AdjustmentReason {
  id: string;
  companyId: string;
  code: string;
  name: string;
}

// ── Physical Count (uses StockAdjustment as backing model) ────────────────────
export interface PhysicalCountVarianceLine {
  lineId: string;
  itemId: string;
  itemCode: string;
  description: string;
  binCode: string | null;
  systemQty: number;
  physicalQty: number;
  varianceQty: number;
  variancePct: number;
  avgCost: number;
  varianceValue: number;
}

// ── Stock Summary ──────────────────────────────────────────────────────────────
export interface StockSummary {
  obsoleteStock: number;
  inactiveStock: number;
  deadStock: number;
  pendingIssues: number;
  pendingLto: number;
  pendingGrn: number;
}
