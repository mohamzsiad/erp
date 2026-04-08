import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ReportService } from '../../services/procurement/ReportService.js';
import { exportToExcel, type ExcelColumn } from '../../utils/ExcelExporter.js';
import { requirePermission } from '../../middleware/authenticate.js';

const PERM = requirePermission('PROCUREMENT', 'REPORTS', 'VIEW');

interface ReportQS {
  dateFrom?: string;
  dateTo?: string;
  locationId?: string;
  supplierId?: string;
  itemId?: string;
  status?: string;
  export?: string; // 'xlsx'
}

const QS_SCHEMA = {
  type: 'object',
  properties: {
    dateFrom:   { type: 'string' },
    dateTo:     { type: 'string' },
    locationId: { type: 'string' },
    supplierId: { type: 'string' },
    itemId:     { type: 'string' },
    status:     { type: 'string' },
    export:     { type: 'string' },
  },
};

export default async function reportRoutes(fastify: FastifyInstance) {
  const svc = (req: FastifyRequest) => new ReportService(req.server.prisma);

  // ── 1. PR Status ──────────────────────────────────────────────────────────
  fastify.get('/pr-status', {
    schema: { tags: ['Procurement - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getPrStatus({ companyId: req.user.companyId, ...req.query });

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'docNo',            header: 'Doc No',            width: 18 },
        { key: 'docDate',          header: 'Date',              type: 'date', width: 14 },
        { key: 'location',         header: 'Location',          width: 16 },
        { key: 'itemCode',         header: 'Item Code',         width: 16 },
        { key: 'itemDescription',  header: 'Description',       width: 30 },
        { key: 'requestedQty',     header: 'Req. Qty',          type: 'number', width: 14 },
        { key: 'approvedQty',      header: 'Appr. Qty',         type: 'number', width: 14 },
        { key: 'pendingQty',       header: 'Pending Qty',       type: 'number', width: 14 },
        { key: 'poStatus',         header: 'PO Status',         width: 14 },
        { key: 'status',           header: 'PR Status',         width: 14 },
      ];
      return exportToExcel(
        data.map((r) => ({ ...r, _overdue: false })),
        columns,
        { title: 'PR Status Report', filters: { 'Date From': req.query.dateFrom, 'Date To': req.query.dateTo, Location: req.query.locationId, Status: req.query.status } },
        reply
      );
    }
    return reply.send(data);
  });

  // ── 2. PO Status ──────────────────────────────────────────────────────────
  fastify.get('/po-status', {
    schema: { tags: ['Procurement - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getPoStatus({ companyId: req.user.companyId, ...req.query });

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'docNo',           header: 'PO Number',          width: 18 },
        { key: 'docDate',         header: 'Date',               type: 'date', width: 14 },
        { key: 'supplier',        header: 'Supplier',           width: 28 },
        { key: 'itemCode',        header: 'Item Code',          width: 16 },
        { key: 'itemDescription', header: 'Description',        width: 30 },
        { key: 'orderedQty',      header: 'Ordered',            type: 'number', width: 14 },
        { key: 'receivedQty',     header: 'Received',           type: 'number', width: 14 },
        { key: 'invoicedQty',     header: 'Invoiced',           type: 'number', width: 14 },
        { key: 'balanceQty',      header: 'Balance',            type: 'number', width: 14 },
        { key: 'netAmount',       header: 'Net Amount',         type: 'currency', width: 16 },
        { key: 'deliveryDate',    header: 'Delivery Date',      type: 'date', width: 14 },
        { key: 'status',          header: 'Status',             width: 14 },
      ];
      return exportToExcel(
        data.map((r) => ({ ...r, _overdue: r.overdue })),
        columns,
        { title: 'PO Status Report', filters: { Supplier: req.query.supplierId, Status: req.query.status } },
        reply
      );
    }
    return reply.send(data);
  });

  // ── 3. PO History by Supplier ─────────────────────────────────────────────
  fastify.get('/po-history-by-supplier', {
    schema: { tags: ['Procurement - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getPoHistoryBySupplier({ companyId: req.user.companyId, ...req.query });

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'supplierCode',     header: 'Code',              width: 14 },
        { key: 'supplierName',     header: 'Supplier Name',     width: 30 },
        { key: 'totalOrders',      header: 'Total Orders',      type: 'number', width: 14 },
        { key: 'totalValue',       header: 'Total Value',       type: 'currency', width: 18 },
        { key: 'avgLeadTimeDays',  header: 'Avg Lead Days',     type: 'number', width: 14 },
        { key: 'lastOrderDate',    header: 'Last Order Date',   type: 'date', width: 16 },
      ];
      return exportToExcel(
        data.map((r) => ({ ...r, _overdue: false })),
        columns,
        { title: 'PO History by Supplier', filters: { Supplier: req.query.supplierId } },
        reply
      );
    }
    return reply.send(data);
  });

  // ── 4. Procurement Tracking ───────────────────────────────────────────────
  fastify.get('/procurement-tracking', {
    schema: { tags: ['Procurement - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getProcurementTracking({ companyId: req.user.companyId, ...req.query });

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'docNo',       header: 'PR Number',      width: 18 },
        { key: 'prDate',      header: 'PR Date',        type: 'date', width: 14 },
        { key: 'poDocNo',     header: 'PO Number',      width: 18 },
        { key: 'poDate',      header: 'PO Date',        type: 'date', width: 14 },
        { key: 'location',    header: 'Location',       width: 16 },
        { key: 'daysElapsed', header: 'Days Elapsed',   type: 'number', width: 14 },
        { key: 'status',      header: 'Status',         width: 14 },
      ];
      return exportToExcel(
        data.map((r) => ({ ...r, _overdue: r.daysElapsed > 30 })),
        columns,
        { title: 'Procurement Tracking Report' },
        reply
      );
    }
    return reply.send(data);
  });

  // ── 5. Lead Time Variance ─────────────────────────────────────────────────
  fastify.get('/lead-time-variance', {
    schema: { tags: ['Procurement - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getLeadTimeVariance({ companyId: req.user.companyId, ...req.query });

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'supplierCode',      header: 'Supplier Code',   width: 16 },
        { key: 'supplierName',      header: 'Supplier',        width: 28 },
        { key: 'itemCode',          header: 'Item Code',       width: 16 },
        { key: 'itemDescription',   header: 'Description',     width: 30 },
        { key: 'plannedLeadDays',   header: 'Planned Days',    type: 'number', width: 14 },
        { key: 'actualLeadDays',    header: 'Actual Days',     type: 'number', width: 14 },
        { key: 'variance',          header: 'Variance',        type: 'number', width: 14 },
        { key: 'poCount',           header: 'PO Count',        type: 'number', width: 12 },
      ];
      return exportToExcel(
        data.map((r) => ({ ...r, _overdue: r.variance > 0 })),
        columns,
        { title: 'Lead Time Variance Report', filters: { Supplier: req.query.supplierId } },
        reply
      );
    }
    return reply.send(data);
  });

  // ── 6. Price Comparison ───────────────────────────────────────────────────
  fastify.get('/price-comparison', {
    schema: { tags: ['Procurement - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getPriceComparison({ companyId: req.user.companyId, ...req.query });

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'itemCode',         header: 'Item Code',    width: 16 },
        { key: 'itemDescription',  header: 'Description',  width: 30 },
        { key: 'uom',              header: 'UOM',          width: 10 },
        { key: 'supplierCode',     header: 'Supplier',     width: 14 },
        { key: 'supplierName',     header: 'Supplier Name',width: 26 },
        { key: 'price1',           header: 'Price 1',      type: 'currency', width: 14 },
        { key: 'price2',           header: 'Price 2',      type: 'currency', width: 14 },
        { key: 'price3',           header: 'Price 3',      type: 'currency', width: 14 },
        { key: 'price4',           header: 'Price 4',      type: 'currency', width: 14 },
        { key: 'price5',           header: 'Price 5',      type: 'currency', width: 14 },
        { key: 'avgPrice',         header: 'Avg Price',    type: 'currency', width: 14 },
        { key: 'minPrice',         header: 'Min Price',    type: 'currency', width: 14 },
        { key: 'maxPrice',         header: 'Max Price',    type: 'currency', width: 14 },
      ];
      return exportToExcel(
        data.map((r) => ({ ...r, _overdue: false })),
        columns,
        { title: 'Price Comparison Report', filters: { Item: req.query.itemId } },
        reply
      );
    }
    return reply.send(data);
  });

  // ── 7. Pending PR ─────────────────────────────────────────────────────────
  fastify.get('/pending-pr', {
    schema: { tags: ['Procurement - Reports'], querystring: QS_SCHEMA },
    preHandler: [PERM],
  }, async (req: FastifyRequest<{ Querystring: ReportQS }>, reply: FastifyReply) => {
    const data = await svc(req).getPendingPr({ companyId: req.user.companyId, ...req.query });

    if (req.query.export === 'xlsx') {
      const columns: ExcelColumn[] = [
        { key: 'docNo',               header: 'Doc No',           width: 18 },
        { key: 'docDate',             header: 'Date',             type: 'date', width: 14 },
        { key: 'location',            header: 'Location',         width: 16 },
        { key: 'ageDays',             header: 'Age (Days)',        type: 'number', width: 12 },
        { key: 'ageBucket',           header: 'Age Bucket',        width: 14 },
        { key: 'itemCount',           header: 'Items',             type: 'number', width: 10 },
        { key: 'totalRequestedQty',   header: 'Total Req. Qty',    type: 'number', width: 16 },
        { key: 'status',              header: 'Status',            width: 14 },
      ];
      return exportToExcel(
        data.map((r) => ({ ...r, _overdue: r.ageDays > 30 })),
        columns,
        { title: 'Pending PR Report', filters: { Location: req.query.locationId } },
        reply
      );
    }
    return reply.send(data);
  });
}
