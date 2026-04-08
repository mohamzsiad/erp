import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
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
  searchSuppliers,
  searchLocations,
  searchItems,
  searchChargeCodes,
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

  const [supplier, setSupplier] = useState<LookupOption | null>(null);
  const [shipToLocation, setShipToLocation] = useState<LookupOption | null>(null);
  const [lineRows, setLineRows] = useState<PoLineRow[]>([]);
  const [lineSearch, setLineSearch] = useState('');
  const rowCounter = useRef(0);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
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
      });
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
        shipToLocationId: shipToLocation?.value ?? values.shipToLocationId,
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
          <Input {...register('currencyId')} placeholder="e.g. USD, AED" />
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
          {watch('currencyId') ?? ''} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
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
                  <input type="number" value={row.orderedQty ?? 1} onChange={(e) => updateLine(row._rowId, 'orderedQty', parseFloat(e.target.value) || 0)} className="erp-input w-full text-right" min={0} step="0.001" disabled={!isDraft} />
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

  const placeholderContent = (label: string) => (
    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">{label} — available in a later release</div>
  );

  const tabs = [
    { id: 'key-info', label: 'Key Info', content: keyInfoPanel },
    { id: 'item-details', label: 'Item Details', badge: lineRows.length, content: itemDetailsContent },
    { id: 'authorization', label: 'Authorization', content: placeholderContent('Authorization') },
    { id: 'ac-details', label: 'A/C Details', content: placeholderContent('A/C Details') },
    { id: 'notes', label: 'Notes', content: placeholderContent('Notes') },
    { id: 'suppliers', label: 'Suppliers', content: placeholderContent('Suppliers') },
    { id: 'warehouse', label: 'Warehouse D.', content: placeholderContent('Warehouse') },
    { id: 'budget', label: 'Budget', content: placeholderContent('Budget') },
    { id: 'short-close', label: 'Short Close', content: placeholderContent('Short Close') },
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
