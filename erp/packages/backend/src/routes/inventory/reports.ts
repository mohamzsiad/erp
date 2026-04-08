import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InventoryReportService, type InvReportFilters } from '../../services/inventory/InventoryReportService.js';
import { exportToExcel, type ExcelColumn } from '../../utils/ExcelExporter.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = requirePermission('INVENTORY', 'REPORTS', 'VIEW');

interface ReportQS {
  dateFrom?:       string;
  dateTo?:         string;
  asOfDate?:       string;
  itemId?:         string;
  warehouseId?:    string;
  categoryId?:     string;
  supplierId?:     string;
  noMovementDays?: string;
  export?:         string; // 'xlsx'
}

const QS_SCHEMA = {
  type: 'object',
  properties: {
    dateFrom:       { type: 'string' },
    dateTo:         { type: 'string' },
    asOfDate:       { type: 'string' },
    itemId:         { type: 'string' },
    warehouseId:    { type: 'string' },
    categoryId:     { type: 'string' },
    supplierId:     { type: 'string' },
    noMovementDays: { type: 'string' },
    export:         { type: 'string' },
  },
};

export default async function inventoryReportRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new InventoryReportService(req.server.prisma);

  function buildFilters(companyId: string, q: ReportQS): InvReportFilters {
    return {
      companyId,
      dateFrom:       q.dateFrom       || undefined,
      dateTo:         q.dateTo         || undefined,
      asOfDate:       q.asOfDate       || undefined,
      itemId:         q.itemId         || undefined,
      warehouseId:    q.warehouseId    || undefined,
      categoryId:     q.categoryId     || undefined,
      supplierId:     q.supplierId     || undefined,
      noMovementDays: q.noMovementDays ? parseInt(q.noMovementDays, 10) : undefined,
    };
  }

  // ── 1. Stock Balance ───────────────────────────────────────────────────────
  fastify.get('/stock-balance', {
    schema: { tags: ['Inventory - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getStockBalance(buildFilters(req.user.companyId, req.query));

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'itemCode',      header: 'Item Code',      width: 16 },
        { key: 'description',   header: 'Description',    width: 32 },
        { key: 'category',      header: 'Category',       width: 18 },
        { key: 'uom',           header: 'UOM',            width: 10 },
        { key: 'warehouseCode', header: 'Warehouse',      width: 14 },
        { key: 'binCode',       header: 'Bin',            width: 10 },
        { key: 'qtyOnHand',     header: 'On Hand',        type: 'number', width: 14 },
        { key: 'qtyReserved',   header: 'Reserved',       type: 'number', width: 14 },
        { key: 'qtyAvailable',  header: 'Available',      type: 'number', width: 14 },
        { key: 'avgCost',       header: 'Avg Cost',       type: 'number', width: 14 },
        { key: 'stockValue',    header: 'Stock Value',    type: 'currency', width: 16 },
        { key: 'status',        header: 'Status',         width: 12 },
      ];
      return exportToExcel(data, columns, { title: 'Stock Balance Report', filters: { 'Warehouse': req.query.warehouseId, 'Category': req.query.categoryId } }, reply);
    }
    return reply.send(data);
  });

  // ── 2. Stock Aging ─────────────────────────────────────────────────────────
  fastify.get('/stock-aging', {
    schema: { tags: ['Inventory - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getStockAging(buildFilters(req.user.companyId, req.query));

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'itemCode',      header: 'Item Code',     width: 16 },
        { key: 'description',   header: 'Description',   width: 32 },
        { key: 'category',      header: 'Category',      width: 18 },
        { key: 'uom',           header: 'UOM',           width: 10 },
        { key: 'warehouseCode', header: 'Warehouse',     width: 14 },
        { key: 'binCode',       header: 'Bin',           width: 10 },
        { key: 'qtyOnHand',     header: 'On Hand',       type: 'number',   width: 14 },
        { key: 'avgCost',       header: 'Avg Cost',      type: 'number',   width: 14 },
        { key: 'stockValue',    header: 'Stock Value',   type: 'currency', width: 16 },
        { key: 'lastMovement',  header: 'Last Movement', type: 'date',     width: 16 },
        { key: 'ageDays',       header: 'Age (Days)',    type: 'number',   width: 12 },
        { key: 'ageBucket',     header: 'Age Bucket',   width: 16 },
        { key: 'status',        header: 'Status',        width: 12 },
      ];
      return exportToExcel(data, columns, { title: 'Stock Aging Report' }, reply);
    }
    return reply.send(data);
  });

  // ── 3. Dead / Inactive / Obsolete ─────────────────────────────────────────
  fastify.get('/dead-inactive-obsolete', {
    schema: { tags: ['Inventory - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getDeadInactiveObsolete(buildFilters(req.user.companyId, req.query));

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'itemCode',     header: 'Item Code',     width: 16 },
        { key: 'description',  header: 'Description',   width: 32 },
        { key: 'category',     header: 'Category',      width: 18 },
        { key: 'uom',          header: 'UOM',           width: 10 },
        { key: 'warehouseCode',header: 'Warehouse',     width: 14 },
        { key: 'qtyOnHand',    header: 'On Hand',       type: 'number',   width: 14 },
        { key: 'avgCost',      header: 'Avg Cost',      type: 'number',   width: 14 },
        { key: 'stockValue',   header: 'Stock Value',   type: 'currency', width: 16 },
        { key: 'lastMovement', header: 'Last Movement', type: 'date',     width: 16 },
        { key: 'ageDays',      header: 'Age (Days)',    type: 'number',   width: 12 },
        { key: 'status',       header: 'Status',        width: 12 },
      ];
      // Export all three combined for xlsx
      const allRows = [
        ...data.dead.map((r: any) => ({ ...r, classification: 'Dead' })),
        ...data.inactive.map((r: any) => ({ ...r, classification: 'Inactive' })),
        ...data.obsolete.map((r: any) => ({ ...r, classification: 'Obsolete' })),
      ];
      return exportToExcel(allRows, [{ key: 'classification', header: 'Classification', width: 14 }, ...columns],
        { title: 'Dead-Inactive-Obsolete Stock Report', filters: { 'No Movement Days': String(data.thresholdDays) } }, reply);
    }
    return reply.send(data);
  });

  // ── 4. GRN Summary ────────────────────────────────────────────────────────
  fastify.get('/grn-summary', {
    schema: { tags: ['Inventory - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getGrnSummary(buildFilters(req.user.companyId, req.query));

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'grnNo',        header: 'GRN No',          width: 16 },
        { key: 'docDate',      header: 'Date',            type: 'date',     width: 14 },
        { key: 'poNo',         header: 'PO No',           width: 16 },
        { key: 'supplierCode', header: 'Supplier Code',   width: 16 },
        { key: 'supplierName', header: 'Supplier Name',   width: 28 },
        { key: 'warehouse',    header: 'Warehouse',       width: 16 },
        { key: 'itemCode',     header: 'Item Code',       width: 16 },
        { key: 'description',  header: 'Description',     width: 32 },
        { key: 'category',     header: 'Category',        width: 18 },
        { key: 'uom',          header: 'UOM',             width: 10 },
        { key: 'receivedQty',  header: 'Received Qty',    type: 'number',   width: 14 },
        { key: 'acceptedQty',  header: 'Accepted Qty',    type: 'number',   width: 14 },
        { key: 'rejectedQty',  header: 'Rejected Qty',    type: 'number',   width: 14 },
        { key: 'unitCost',     header: 'Unit Cost',       type: 'number',   width: 14 },
        { key: 'lineValue',    header: 'Line Value',      type: 'currency', width: 16 },
      ];
      return exportToExcel(data, columns, {
        title: 'GRN Summary Report',
        filters: { 'Date From': req.query.dateFrom, 'Date To': req.query.dateTo, 'Supplier': req.query.supplierId },
      }, reply);
    }
    return reply.send(data);
  });

  // ── 5. Stock Movement ─────────────────────────────────────────────────────
  fastify.get('/stock-movement', {
    schema: { tags: ['Inventory - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getStockMovement(buildFilters(req.user.companyId, req.query));

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'date',            header: 'Date',           type: 'date',     width: 14 },
        { key: 'transactionType', header: 'Type',           width: 14 },
        { key: 'sourceDocNo',     header: 'Doc No',         width: 16 },
        { key: 'itemCode',        header: 'Item Code',      width: 16 },
        { key: 'description',     header: 'Description',    width: 30 },
        { key: 'uom',             header: 'UOM',            width: 10 },
        { key: 'warehouse',       header: 'Warehouse',      width: 16 },
        { key: 'bin',             header: 'Bin',            width: 10 },
        { key: 'inQty',           header: 'In Qty',         type: 'number',   width: 12 },
        { key: 'outQty',          header: 'Out Qty',        type: 'number',   width: 12 },
        { key: 'balance',         header: 'Balance',        type: 'number',   width: 12 },
        { key: 'avgCost',         header: 'Avg Cost',       type: 'number',   width: 14 },
        { key: 'movementValue',   header: 'Movement Value', type: 'currency', width: 16 },
      ];
      return exportToExcel(data, columns, {
        title: 'Stock Movement Report',
        filters: { 'Item': req.query.itemId, 'Warehouse': req.query.warehouseId, 'From': req.query.dateFrom, 'To': req.query.dateTo },
      }, reply);
    }
    return reply.send(data);
  });

  // ── 6. Reorder Report ─────────────────────────────────────────────────────
  fastify.get('/reorder-report', {
    schema: { tags: ['Inventory - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getReorderReport(buildFilters(req.user.companyId, req.query));

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'itemCode',         header: 'Item Code',       width: 16 },
        { key: 'description',      header: 'Description',     width: 32 },
        { key: 'category',         header: 'Category',        width: 18 },
        { key: 'uom',              header: 'UOM',             width: 10 },
        { key: 'reorderLevel',     header: 'Reorder Level',   type: 'number', width: 14 },
        { key: 'reorderQty',       header: 'Reorder Qty',     type: 'number', width: 14 },
        { key: 'qtyOnHand',        header: 'On Hand',         type: 'number', width: 14 },
        { key: 'qtyReserved',      header: 'Reserved',        type: 'number', width: 14 },
        { key: 'qtyAvailable',     header: 'Available',       type: 'number', width: 14 },
        { key: 'shortage',         header: 'Shortage',        type: 'number', width: 14 },
        { key: 'suggestedOrderQty',header: 'Suggested Order', type: 'number', width: 16 },
        { key: 'leadTimeDays',     header: 'Lead Time (Days)',type: 'number', width: 14 },
        { key: 'standardCost',     header: 'Std Cost',        type: 'number', width: 14 },
        { key: 'estimatedValue',   header: 'Est. Order Value',type: 'currency',width: 16 },
      ];
      return exportToExcel(data, columns, { title: 'Reorder Report' }, reply);
    }
    return reply.send(data);
  });

  // ── 7. Valuation Report ───────────────────────────────────────────────────
  fastify.get('/valuation', {
    schema: { tags: ['Inventory - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const result = await svc(req).getValuation(buildFilters(req.user.companyId, req.query));

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'category',      header: 'Category',      width: 18 },
        { key: 'itemCode',      header: 'Item Code',      width: 16 },
        { key: 'description',   header: 'Description',   width: 32 },
        { key: 'uom',           header: 'UOM',           width: 10 },
        { key: 'warehouseCode', header: 'Warehouse',     width: 14 },
        { key: 'warehouseName', header: 'Wh. Name',      width: 20 },
        { key: 'qtyOnHand',     header: 'On Hand',       type: 'number',   width: 14 },
        { key: 'avgCost',       header: 'Avg Cost',      type: 'number',   width: 14 },
        { key: 'stockValue',    header: 'Stock Value',   type: 'currency', width: 16 },
        { key: 'status',        header: 'Status',        width: 12 },
      ];
      return exportToExcel(result.rows, columns, { title: 'Stock Valuation Report', filters: { 'Warehouse': req.query.warehouseId, 'Category': req.query.categoryId } }, reply);
    }
    return reply.send(result);
  });
}
