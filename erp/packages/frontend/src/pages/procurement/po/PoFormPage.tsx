import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, CheckCircle, XCircle, Clock, Building2, Phone, Mail, CreditCard, Warehouse, FileText, TrendingUp, X } from 'lucide-react';
import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { KeyInfoItemDetailsTabs } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { FormField, Input, Select } from '../../../components/ui/FormField';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useToast } from '../../../components/ui/Toast';
import { useUiStore } from '../../../store/uiStore';
import {
  usePo,
  useCreatePo,
  useUpdatePo,
  useSubmitPo,
  useApprovePo,
  useRejectPo,
  useCancelPo,
  useShortClosePo,
  searchSuppliers,
  searchLocations,
  searchItems,
  searchChargeCodes,
  searchCurrencies,
  searchWarehouses,
} from '../../../api/procurement';
import { format } from 'date-fns';
import type { PoLine } from '@clouderp/shared';

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  docDate: z.string().min(1, 'Doc date is required'),
  currencyId: z.string().optional(),
  exchangeRate: z.coerce.number().min(0).default(1),
  paymentTerms: z.string().optional(),
  incoterms: z.string().optional(),
  deliveryDate: z.string().optional(),
  shipToLocationId: z.string().optional(),
  warehouseId: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface PoLineRow extends Partial<PoLine> {
  _rowId: string;
  itemLabel?: string;
}

const PAYMENT_TERMS = [
  { value: 'NET_30', label: 'Net 30' },
  { value: 'NET_60', label: 'Net 60' },
  { value: 'NET_90', label: 'Net 90' },
  { value: 'ADVANCE', label: 'Advance' },
  { value: 'COD', label: 'Cash on Delivery' },
];

const INCOTERMS = [
  { value: 'EXW', label: 'EXW – Ex Works' },
  { value: 'FOB', label: 'FOB – Free on Board' },
  { value: 'CIF', label: 'CIF – Cost, Insurance and Freight' },
  { value: 'DDP', label: 'DDP – Delivered Duty Paid' },
  { value: 'DAP', label: 'DAP – Delivered at Place' },
];

export default function PoFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const { setTabDirty } = useUiStore();

  const { data: doc, isLoading } = usePo(isNew ? undefined : id);
  const createMutation = useCreatePo();
  const updateMutation = useUpdatePo(id ?? '');
  const submitMutation = useSubmitPo(id ?? '');
  const approveMutation = useApprovePo(id ?? '');
  const rejectMutation = useRejectPo(id ?? '');
  const cancelMutation = useCancelPo(id ?? '');
  const shortCloseMutation = useShortClosePo(id ?? '');

  const [supplier, setSupplier] = useState<LookupOption | null>(null);
  const [currency, setCurrency] = useState<LookupOption | null>(null);
  const [shipToLocation, setShipToLocation] = useState<LookupOption | null>(null);
  const [warehouse, setWarehouse] = useState<LookupOption | null>(null);
  const [lineRows, setLineRows] = useState<PoLineRow[]>([]);
  const [lineSearch, setLineSearch] = useState('');
  const rowCounter = useRef(0);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      docDate: format(new Date(), 'yyyy-MM-dd'),
      exchangeRate: 1,
    },
  });

  useEffect(() => {
    setTabDirty(isNew ? 'new-po' : `po-${id}`, isDirty);
  }, [isDirty, id, isNew, setTabDirty]);

  useEffect(() => {
    if (doc) {
      reset({
        supplierId: doc.supplierId,
        docDate: doc.docDate,
        currencyId: doc.currencyId ?? undefined,
        exchangeRate: doc.exchangeRate,
        paymentTerms: doc.paymentTerms ?? undefined,
        incoterms: doc.incoterms ?? undefined,
        deliveryDate: doc.deliveryDate ?? undefined,
        shipToLocationId: doc.shipToLocationId ?? undefined,
        warehouseId: doc.warehouseId ?? undefined,
        notes: doc.notes ?? undefined,
      });
      if (doc.supplier) {
        setSupplier({ value: doc.supplierId, label: doc.supplier.name, subLabel: doc.supplier.code });
      }
      if (doc.currency) {
        setCurrency({ value: doc.currencyId, label: doc.currency.code });
      }
      if (doc.shipToLocationId && doc.shipToLocation) {
        setShipToLocation({ value: doc.shipToLocationId, label: doc.shipToLocation.name, subLabel: doc.shipToLocation.code });
      }
      if (doc.warehouseId && doc.warehouse) {
        setWarehouse({ value: doc.warehouseId, label: doc.warehouse.name, subLabel: doc.warehouse.code });
      }
      if (doc.lines) {
        setLineRows(doc.lines.map((l) => ({ ...l, _rowId: l.id })));
      }
    }
  }, [doc, reset]);

  const addLine = () => {
    const _rowId = `new-${++rowCounter.current}`;
    setLineRows((prev) => [
      ...prev,
      { _rowId, lineNo: prev.length + 1, orderedQty: 1, receivedQty: 0, invoicedQty: 0, unitPrice: 0, discountPct: 0, taxPct: 0, netAmount: 0 },
    ]);
  };

  const removeLine = (rowId: string) =>
    setLineRows((prev) => prev.filter((r) => r._rowId !== rowId));

  const updateLine = (rowId: string, field: keyof PoLineRow, value: unknown) =>
    setLineRows((prev) => prev.map((r) => (r._rowId === rowId ? { ...r, [field]: value } : r)));

  const calcNetAmount = (row: PoLineRow) => {
    const gross = (row.orderedQty ?? 0) * (row.unitPrice ?? 0);
    const discount = gross * ((row.discountPct ?? 0) / 100);
    const net = gross - discount;
    return net + net * ((row.taxPct ?? 0) / 100);
  };

  const totalAmount = lineRows.reduce((sum, r) => sum + calcNetAmount(r), 0);

  const filteredLines = lineSearch
    ? lineRows.filter((r) => r.itemLabel?.toLowerCase().includes(lineSearch.toLowerCase()))
    : lineRows;

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        ...values,
        supplierId: supplier?.value ?? values.supplierId,
        currencyId: currency?.value ?? values.currencyId,
        shipToLocationId: shipToLocation?.value ?? values.shipToLocationId,
        warehouseId: warehouse?.value ?? values.warehouseId,
        lines: lineRows.map((r, i) => ({
          itemId: r.itemId ?? '',
          uomId: r.uomId ?? '',
          orderedQty: r.orderedQty ?? 1,
          unitPrice: r.unitPrice ?? 0,
          discountPct: r.discountPct ?? 0,
          taxPct: r.taxPct ?? 0,
          chargeCodeId: r.chargeCodeId ?? '',
          lineNo: i + 1,
        })),
      };

      if (isNew) {
        const created = await createMutation.mutateAsync(payload);
        toast.success('PO created', created.docNo);
        navigate(`/procurement/po/${created.id}`, { replace: true });
      } else {
        await updateMutation.mutateAsync(payload);
        toast.success('PO saved');
      }
    } catch (err: unknown) {
      toast.error('Error', (err as { message?: string })?.message ?? 'Save failed');
    }
  };

  const handleSubmitDoc = async () => {
    try {
      await submitMutation.mutateAsync();
      toast.success('PO submitted for approval');
    } catch (err: unknown) {
      toast.error('Submit failed', (err as { message?: string })?.message);
    }
  };

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ action: 'approve' });
      toast.success('PO approved');
    } catch (err: unknown) {
      toast.error('Approve failed', (err as { message?: string })?.message);
    }
  };

  const handleReject = async () => {
    const comment = window.prompt('Rejection reason:');
    if (!comment) return;
    try {
      await rejectMutation.mutateAsync({ action: 'reject', comment });
      toast.success('PO rejected');
    } catch (err: unknown) {
      toast.error('Reject failed', (err as { message?: string })?.message);
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt('Cancellation reason:');
    if (!reason) return;
    try {
      await cancelMutation.mutateAsync(reason);
      toast.success('PO cancelled');
    } catch (err: unknown) {
      toast.error('Cancel failed', (err as { message?: string })?.message);
    }
  };

  const handleShortClose = async () => {
    if (!window.confirm('Short-close this PO? All remaining pending quantities will be closed without delivery.')) return;
    try {
      await shortCloseMutation.mutateAsync();
      toast.success('PO short-closed');
    } catch (err: unknown) {
      toast.error('Short close failed', (err as { message?: string })?.message);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const isDraft = !doc || doc.status === 'DRAFT';
  const isSubmitted = doc?.status === 'SUBMITTED';
  const canCancel = doc && ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(doc.status);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleSubmit, onSubmit]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isNew && isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-sm">Loading…</p></div>;
  }

  // ── Key Info Panel ─────────────────────────────────────────────────────────
  const keyInfoPanel = (
    <form id="po-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2">
        {/* Col 1 */}
        <FormField label="Supplier" required error={errors.supplierId?.message}>
          <Controller
            name="supplierId"
            control={control}
            render={() => (
              <LookupField
                value={supplier}
                onChange={setSupplier}
                onSearch={searchSuppliers}
                placeholder="Search supplier…"
                error={!!errors.supplierId}
              />
            )}
          />
        </FormField>

        <FormField label="Doc Date" required error={errors.docDate?.message}>
          <Input type="date" {...register('docDate')} error={!!errors.docDate} />
        </FormField>

        <FormField label="Currency">
          <Controller
            name="currencyId"
            control={control}
            render={({ field }) => (
              <LookupField
                value={currency}
                onChange={(opt) => { setCurrency(opt); field.onChange(opt?.value ?? ''); }}
                onSearch={searchCurrencies}
                placeholder="Search currency…"
                disabled={!isDraft}
              />
            )}
          />
        </FormField>

        <FormField label="Exchange Rate" error={errors.exchangeRate?.message}>
          <Input type="number" step="0.0001" {...register('exchangeRate')} error={!!errors.exchangeRate} className="text-right" />
        </FormField>

        <FormField label="Payment Terms">
          <Select
            options={PAYMENT_TERMS}
            placeholder="— Select —"
            {...register('paymentTerms')}
          />
        </FormField>

        <FormField label="Incoterms">
          <Select
            options={INCOTERMS}
            placeholder="— Select —"
            {...register('incoterms')}
          />
        </FormField>

        <FormField label="Delivery Date">
          <Input type="date" {...register('deliveryDate')} />
        </FormField>

        <FormField label="Ship To Address">
          <Controller
            name="shipToLocationId"
            control={control}
            render={() => (
              <LookupField
                value={shipToLocation}
                onChange={setShipToLocation}
                onSearch={searchLocations}
                placeholder="Search ship-to location…"
              />
            )}
          />
        </FormField>
      </div>

      {/* Document total */}
      <div className="mt-3 flex items-center justify-end gap-3">
        <span className="text-xs text-gray-500">Total Amount:</span>
        <span className="text-sm font-bold text-gray-800">
          {currency?.label ?? ''} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
        </span>
      </div>
    </form>
  );

  // ── Line Items tab ─────────────────────────────────────────────────────────
  const itemDetailsContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <button type="button" onClick={addLine} className="toolbar-btn" disabled={!isDraft}>
          <Plus size={12} /> Add Line
        </button>
        <input
          type="text"
          placeholder="Search all columns…"
          value={lineSearch}
          onChange={(e) => setLineSearch(e.target.value)}
          className="erp-input w-52"
        />
        <span className="text-xs text-gray-400 ml-auto">Lines: {lineRows.length}</span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left w-6">#</th>
              <th className="px-2 py-2 text-left min-w-[180px]">Item *</th>
              <th className="px-2 py-2 text-left w-20">UOM *</th>
              <th className="px-2 py-2 text-right w-28">Ordered Qty *</th>
              <th className="px-2 py-2 text-right w-28">Unit Price</th>
              <th className="px-2 py-2 text-right w-20">Disc %</th>
              <th className="px-2 py-2 text-right w-20">Tax %</th>
              <th className="px-2 py-2 text-right w-28">Net Amount</th>
              <th className="px-2 py-2 text-right w-24">Rcv Qty</th>
              <th className="px-2 py-2 text-right w-24">Inv Qty</th>
              <th className="px-2 py-2 text-left w-32">Charge Code</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-400">No lines. Click "Add Line" to begin.</td>
              </tr>
            )}
            {filteredLines.map((row, idx) => (
              <tr key={row._rowId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                <td className="px-1 py-1">
                  <LookupField
                    value={row.itemId ? { value: row.itemId, label: row.itemLabel ?? row.itemId } : null}
                    onChange={(opt) => { updateLine(row._rowId, 'itemId', opt?.value); updateLine(row._rowId, 'itemLabel', opt?.label); }}
                    onSearch={searchItems}
                    placeholder="Search item…"
                    disabled={!isDraft}
                    className="min-w-[160px]"
                  />
                </td>
                <td className="px-1 py-1">
                  <input type="text" value={row.uomId ?? ''} onChange={(e) => updateLine(row._rowId, 'uomId', e.target.value)} className="erp-input w-full" disabled={!isDraft} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" value={row.orderedQty || ''} onChange={(e) => updateLine(row._rowId, 'orderedQty', parseFloat(e.target.value) || 0)} className="erp-input w-full text-right" min={0} step="0.001" disabled={!isDraft} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" value={row.unitPrice ?? 0} onChange={(e) => updateLine(row._rowId, 'unitPrice', parseFloat(e.target.value) || 0)} className="erp-input w-full text-right" min={0} step="0.001" disabled={!isDraft} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" value={row.discountPct ?? 0} onChange={(e) => updateLine(row._rowId, 'discountPct', parseFloat(e.target.value) || 0)} className="erp-input w-full text-right" min={0} max={100} step="0.01" disabled={!isDraft} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" value={row.taxPct ?? 0} onChange={(e) => updateLine(row._rowId, 'taxPct', parseFloat(e.target.value) || 0)} className="erp-input w-full text-right" min={0} max={100} step="0.01" disabled={!isDraft} />
                </td>
                <td className="px-2 py-1 text-right font-medium text-gray-800">
                  {calcNetAmount(row).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </td>
                <td className="px-2 py-1 text-right text-gray-500">{(row.receivedQty ?? 0).toLocaleString()}</td>
                <td className="px-2 py-1 text-right text-gray-500">{(row.invoicedQty ?? 0).toLocaleString()}</td>
                <td className="px-1 py-1">
                  <LookupField
                    value={row.chargeCodeId ? { value: row.chargeCodeId, label: row.chargeCodeId } : null}
                    onChange={(opt) => updateLine(row._rowId, 'chargeCodeId', opt?.value)}
                    onSearch={searchChargeCodes}
                    placeholder="Charge code…"
                    disabled={!isDraft}
                    className="min-w-[120px]"
                  />
                </td>
                <td className="px-1 py-1">
                  {isDraft && (
                    <button type="button" onClick={() => removeLine(row._rowId)} className="p-1 rounded hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {lineRows.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={7} className="px-2 py-1 text-right text-xs font-semibold text-gray-600">Total Amount:</td>
                <td className="px-2 py-1 text-right text-xs font-bold text-gray-800">
                  {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  // ── Workflow tab ───────────────────────────────────────────────────────────
  const workflowContent = (
    <div className="p-4">
      <p className="text-xs text-gray-500 mb-3">Approval workflow history for this Purchase Order:</p>
      {doc?.status === 'DRAFT' ? (
        <p className="text-gray-400 text-sm">Submit the PO to start the approval workflow.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
            <StatusBadge status={doc?.status ?? 'DRAFT'} />
            <div>
              <p className="text-xs font-medium text-gray-700">Current Status</p>
              <p className="text-xs text-gray-400">
                {doc?.approvedById ? `Approved by: ${doc.approvedById}` : 'Pending approval'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── Authorization tab ──────────────────────────────────────────────────────
  const authorizationContent = (
    <div className="p-4 space-y-4">
      <p className="text-xs text-gray-500">Document authorization and signatory information:</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={14} className="text-blue-500" />
            <span className="text-xs font-semibold text-gray-700">Created By</span>
          </div>
          {doc?.createdBy ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">{doc.createdBy.firstName} {doc.createdBy.lastName}</p>
              <p className="text-xs text-gray-500">{doc.createdBy.email}</p>
              <p className="text-xs text-gray-400">
                {doc.createdAt ? format(new Date(doc.createdAt), 'dd MMM yyyy, HH:mm') : '—'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">—</p>
          )}
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            {doc?.approvedById ? (
              <CheckCircle size={14} className="text-green-500" />
            ) : doc?.status === 'SUBMITTED' ? (
              <Clock size={14} className="text-amber-500" />
            ) : doc?.status === 'CANCELLED' ? (
              <XCircle size={14} className="text-red-500" />
            ) : (
              <Clock size={14} className="text-gray-400" />
            )}
            <span className="text-xs font-semibold text-gray-700">Approved By</span>
          </div>
          {doc?.approvedBy ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">{doc.approvedBy.firstName} {doc.approvedBy.lastName}</p>
              <p className="text-xs text-gray-500">{doc.approvedBy.email}</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              {doc?.status === 'SUBMITTED' ? 'Pending approval' : doc?.status === 'DRAFT' ? 'Not yet submitted' : '—'}
            </p>
          )}
        </div>
      </div>
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-gray-700">Approval Status</span>
          {doc && <StatusBadge status={doc.status} />}
        </div>
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <span>Total Amount: <strong className="text-gray-800">{doc?.currency?.code ?? ''} {(doc?.totalAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}</strong></span>
          <span>Doc No: <strong className="text-gray-800">{doc?.docNo ?? '—'}</strong></span>
        </div>
      </div>
    </div>
  );

  // ── A/C Details tab ────────────────────────────────────────────────────────
  const acDetailsContent = (
    <div className="p-4">
      <p className="text-xs text-gray-500 mb-3">GL account distribution by line item:</p>
      {lineRows.length === 0 ? (
        <p className="text-sm text-gray-400">No lines added. Add items in the Item Details tab.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-left">Charge Code</th>
              <th className="px-3 py-2 text-right">Net Amount</th>
              <th className="px-3 py-2 text-right">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {lineRows.map((row, idx) => {
              const net = calcNetAmount(row);
              const pct = totalAmount > 0 ? (net / totalAmount) * 100 : 0;
              return (
                <tr key={row._rowId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2">{row.itemLabel ?? row.itemId ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-blue-600">{row.chargeCodeId ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">{net.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-100 border-t border-gray-200">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold">Total:</td>
              <td className="px-3 py-2 text-right font-bold">{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
              <td className="px-3 py-2 text-right font-bold">100%</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );

  // ── Notes tab ──────────────────────────────────────────────────────────────
  const notesContent = (
    <div className="p-4 h-full flex flex-col">
      <p className="text-xs text-gray-500 mb-2">Internal notes for this Purchase Order:</p>
      <Controller
        name="notes"
        control={control}
        render={({ field }) => (
          <textarea
            {...field}
            rows={12}
            className="erp-input flex-1 w-full resize-none font-mono text-sm"
            placeholder="Add internal notes, special instructions, or remarks…"
            disabled={!isDraft}
          />
        )}
      />
      {isDraft && (
        <p className="text-xs text-gray-400 mt-2">Notes are saved with the document when you click Save.</p>
      )}
    </div>
  );

  // ── Suppliers tab ──────────────────────────────────────────────────────────
  const suppliersContent = (
    <div className="p-4 space-y-4">
      {!doc?.supplier ? (
        <p className="text-sm text-gray-400">Select a supplier to view details.</p>
      ) : (
        <>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={14} className="text-blue-500" />
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Supplier Details</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-gray-500">Name:</span> <span className="font-medium text-gray-800">{doc.supplier.name}</span></div>
              <div><span className="text-gray-500">Code:</span> <span className="font-medium font-mono text-gray-800">{doc.supplier.code}</span></div>
              {doc.paymentTerms && <div><span className="text-gray-500">Payment Terms:</span> <span className="font-medium text-gray-800">{doc.paymentTerms}</span></div>}
              {doc.incoterms && <div><span className="text-gray-500">Incoterms:</span> <span className="font-medium text-gray-800">{doc.incoterms}</span></div>}
            </div>
          </div>

          {(doc.supplier.contacts?.length ?? 0) > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Phone size={14} className="text-green-500" />
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Contacts</span>
              </div>
              <div className="space-y-3">
                {doc.supplier.contacts!.map((c) => (
                  <div key={c.id} className="flex items-start gap-4 text-xs">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{c.name} {c.isPrimary && <span className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-[10px]">Primary</span>}</p>
                      {c.designation && <p className="text-gray-500">{c.designation}</p>}
                    </div>
                    {c.email && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Mail size={11} />
                        <span>{c.email}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Phone size={11} />
                        <span>{c.phone}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(doc.supplier.bankDetails?.length ?? 0) > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={14} className="text-purple-500" />
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Bank Details</span>
              </div>
              <div className="space-y-3">
                {doc.supplier.bankDetails!.filter((b) => b.isActive).map((b) => (
                  <div key={b.id} className="grid grid-cols-2 gap-2 text-xs border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div><span className="text-gray-500">Bank:</span> <span className="font-medium text-gray-800">{b.bankName}</span></div>
                    <div><span className="text-gray-500">Account No:</span> <span className="font-mono text-gray-800">{b.accountNo}</span></div>
                    {b.iban && <div><span className="text-gray-500">IBAN:</span> <span className="font-mono text-gray-800">{b.iban}</span></div>}
                    {b.swiftCode && <div><span className="text-gray-500">SWIFT:</span> <span className="font-mono text-gray-800">{b.swiftCode}</span></div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── Warehouse tab ──────────────────────────────────────────────────────────
  const warehouseContent = (
    <div className="p-4 space-y-4">
      <p className="text-xs text-gray-500 mb-2">Default receiving warehouse for this Purchase Order:</p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 max-w-lg">
        <FormField label="Receiving Warehouse">
          <Controller
            name="warehouseId"
            control={control}
            render={() => (
              <LookupField
                value={warehouse}
                onChange={(opt) => { setWarehouse(opt); }}
                onSearch={searchWarehouses}
                placeholder="Search warehouse…"
                disabled={!isDraft}
              />
            )}
          />
        </FormField>
      </div>
      {warehouse && (
        <div className="border border-gray-200 rounded-lg p-4 max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <Warehouse size={14} className="text-blue-500" />
            <span className="text-xs font-semibold text-gray-700">Selected Warehouse</span>
          </div>
          <div className="space-y-1 text-xs">
            <p className="font-medium text-gray-800">{warehouse.label}</p>
            <p className="font-mono text-gray-500">{warehouse.subLabel}</p>
          </div>
        </div>
      )}
      {(doc?.grnHeaders?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Goods Receipt Notes (GRN):</p>
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">GRN No</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {doc!.grnHeaders!.map((grn, idx) => (
                <tr key={grn.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-mono text-blue-600">{grn.docNo}</td>
                  <td className="px-3 py-2">{grn.docDate ? format(new Date(grn.docDate), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-3 py-2"><StatusBadge status={grn.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Budget tab ─────────────────────────────────────────────────────────────
  const budgetContent = (
    <div className="p-4">
      <p className="text-xs text-gray-500 mb-3">Budget commitment by charge code:</p>
      {lineRows.length === 0 ? (
        <p className="text-sm text-gray-400">No lines added. Add items to see budget allocation.</p>
      ) : (
        <>
          <table className="w-full text-xs mb-4">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Charge Code</th>
                <th className="px-3 py-2 text-right">Committed Amount</th>
                <th className="px-3 py-2 text-right">Lines</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(
                lineRows.reduce<Record<string, { amount: number; count: number }>>((acc, row) => {
                  const code = row.chargeCodeId ?? 'Unassigned';
                  if (!acc[code]) acc[code] = { amount: 0, count: 0 };
                  acc[code].amount += calcNetAmount(row);
                  acc[code].count += 1;
                  return acc;
                }, {})
              ).map(([code, { amount, count }], idx) => (
                <tr key={code} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-mono text-blue-600">{code}</td>
                  <td className="px-3 py-2 text-right font-medium">{amount.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 border-t border-gray-200">
              <tr>
                <td className="px-3 py-2 text-right text-xs font-semibold">Total PO Value:</td>
                <td className="px-3 py-2 text-right font-bold">{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            <TrendingUp size={13} />
            <span>Budget vs. actual comparison is available in the Finance &gt; Budget module.</span>
          </div>
        </>
      )}
    </div>
  );

  // ── Short Close tab ────────────────────────────────────────────────────────
  const canShortClose = doc && ['APPROVED', 'PARTIAL'].includes(doc.status);
  const pendingLines = lineRows.filter((r) => (r.orderedQty ?? 0) > (r.receivedQty ?? 0));

  const shortCloseContent = (
    <div className="p-4 space-y-4">
      <p className="text-xs text-gray-500">Short-close marks this PO as CLOSED without full delivery of all ordered quantities.</p>
      {!canShortClose ? (
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
          <X size={14} />
          <span>Short close is only available for APPROVED or PARTIAL POs. Current status: <strong>{doc?.status ?? 'DRAFT'}</strong></span>
        </div>
      ) : (
        <>
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-amber-800 mb-2">Pending Lines ({pendingLines.length})</p>
            {pendingLines.length === 0 ? (
              <p className="text-xs text-amber-600">All lines fully received. Use normal close instead.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-amber-700">
                    <th className="py-1 text-left">#</th>
                    <th className="py-1 text-left">Item</th>
                    <th className="py-1 text-right">Ordered</th>
                    <th className="py-1 text-right">Received</th>
                    <th className="py-1 text-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingLines.map((row, idx) => (
                    <tr key={row._rowId} className="border-t border-amber-100">
                      <td className="py-1 text-amber-600">{idx + 1}</td>
                      <td className="py-1 text-amber-800">{row.itemLabel ?? row.itemId ?? '—'}</td>
                      <td className="py-1 text-right">{(row.orderedQty ?? 0).toLocaleString()}</td>
                      <td className="py-1 text-right">{(row.receivedQty ?? 0).toLocaleString()}</td>
                      <td className="py-1 text-right font-medium text-amber-700">{((row.orderedQty ?? 0) - (row.receivedQty ?? 0)).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <button
            type="button"
            onClick={handleShortClose}
            disabled={shortCloseMutation.isPending || pendingLines.length === 0}
            className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {shortCloseMutation.isPending ? 'Closing…' : 'Short Close PO'}
          </button>
        </>
      )}
    </div>
  );

  const tabs = [
    { id: 'key-info', label: 'Key Info', content: keyInfoPanel },
    { id: 'item-details', label: 'Item Details', badge: lineRows.length, content: itemDetailsContent },
    { id: 'authorization', label: 'Authorization', content: authorizationContent },
    { id: 'ac-details', label: 'A/C Details', content: acDetailsContent },
    { id: 'notes', label: 'Notes', content: notesContent },
    { id: 'suppliers', label: 'Suppliers', content: suppliersContent },
    { id: 'warehouse', label: 'Warehouse D.', content: warehouseContent },
    { id: 'budget', label: 'Budget', content: budgetContent },
    { id: 'short-close', label: 'Short Close', content: shortCloseContent },
    { id: 'workflow', label: 'Workflow', content: workflowContent },
  ];

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="Purchase Order"
        docNo={doc?.docNo}
        status={doc ? <StatusBadge status={doc.status} /> : undefined}
        onNew={() => navigate('/procurement/po/new')}
        onSave={handleSubmit(onSubmit)}
        onSubmit={isDraft && !isNew ? handleSubmitDoc : undefined}
        onApprove={isSubmitted ? handleApprove : undefined}
        onReject={isSubmitted ? handleReject : undefined}
        onPrint={() => window.print()}
        onReset={() => reset()}
        saving={saving}
        actions={
          canCancel
            ? [{ id: 'cancel', label: 'Cancel PO', onClick: handleCancel, variant: 'danger' as const }]
            : []
        }
      />

      <div className="flex-1 overflow-auto">
        <KeyInfoItemDetailsTabs tabs={tabs} defaultTabId="key-info" className="min-h-full" />
      </div>
    </div>
  );
}
