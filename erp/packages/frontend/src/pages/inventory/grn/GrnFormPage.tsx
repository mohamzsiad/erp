import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, BookOpen } from 'lucide-react';

import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { KeyInfoItemDetailsTabs } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { FormField, Input, Textarea } from '../../../components/ui/FormField';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useToast } from '../../../components/ui/Toast';

import {
  useGrn, useCreateGrn, useUpdateGrn, usePostGrn, useCancelGrn,
  searchOpenPos, searchWarehouses, searchBins, fetchPoLines, searchItems,
} from '../../../api/inventory';

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  poId:        z.string().min(1, 'PO is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  docDate:     z.string().min(1, 'Date is required'),
  remarks:     z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface GrnLine {
  _rowId:      string;
  itemId:      string;
  itemCode:    string;
  description: string;
  poLineId:    string;
  uomCode:     string;
  uomId:       string;
  orderedQty:  number;
  prevReceived:number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  binId?:      string;
  binLabel?:   string;
  lotNo?:      string;
  batchNo?:    string;
  expiryDate?: string;
  lineNo:      number;
}

function makeRowId() { return Math.random().toString(36).slice(2); }

export default function GrnFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew   = !id || id === 'new';
  const navigate = useNavigate();
  const toast    = useToast();

  const { data: grnData, isLoading } = useGrn(isNew ? undefined : id);
  const grn = (grnData as any)?.data ?? grnData;

  const createMutation = useCreateGrn();
  const updateMutation = useUpdateGrn(id ?? '');
  const postMutation   = usePostGrn(id ?? '');
  const cancelMutation = useCancelGrn(id ?? '');

  const [saving, setSaving]           = useState(false);
  const [po, setPo]                   = useState<LookupOption | null>(null);
  const [warehouse, setWarehouse]     = useState<LookupOption | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [lines, setLines]             = useState<GrnLine[]>([]);
  const [loadingPo, setLoadingPo]     = useState(false);

  const {
    register, control, handleSubmit, setValue, watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const isDraft    = !grn || grn.status === 'DRAFT';
  const isPosted   = grn?.status === 'POSTED';

  // ── Load existing GRN ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!grn) return;
    setValue('poId', grn.poId);
    setValue('warehouseId', grn.warehouseId);
    setValue('docDate', grn.docDate?.split('T')[0] ?? '');
    setValue('remarks', grn.remarks ?? '');

    if (grn.po) setPo({ value: grn.po.id, label: grn.po.docNo });
    if (grn.warehouse) setWarehouse({ value: grn.warehouse.id, label: `${grn.warehouse.code} – ${grn.warehouse.name}` });
    if (grn.po?.supplier) setSupplierName(grn.po.supplier.name ?? '');

    const loadedLines: GrnLine[] = (grn.lines ?? []).map((l: any, idx: number) => ({
      _rowId:       makeRowId(),
      itemId:       l.itemId,
      itemCode:     l.item?.code ?? '',
      description:  l.item?.description ?? '',
      poLineId:     l.poLineId,
      uomCode:      l.uom?.code ?? l.uomId ?? '',
      uomId:        l.uomId,
      orderedQty:   Number(l.orderedQty ?? 0),
      prevReceived: Number(l.prevReceived ?? 0),
      receivedQty:  Number(l.receivedQty ?? 0),
      acceptedQty:  Number(l.acceptedQty ?? 0),
      rejectedQty:  Number(l.rejectedQty ?? 0),
      binId:        l.binId ?? undefined,
      binLabel:     l.bin?.code ?? undefined,
      lotNo:        l.lotNo ?? '',
      batchNo:      l.batchNo ?? '',
      expiryDate:   l.expiryDate?.split('T')[0] ?? '',
      lineNo:       l.lineNo ?? idx + 1,
    }));
    setLines(loadedLines);
  }, [grn, setValue]);

  // ── Auto-populate lines from selected PO ────────────────────────────────────
  const handlePoChange = useCallback(async (opt: LookupOption | null) => {
    setPo(opt);
    setValue('poId', opt?.value ?? '');

    if (opt?.meta?.supplier) setSupplierName(opt.meta.supplier as string);
    if (opt?.meta) {
      const meta = opt.meta as any;
      if (meta.supplier?.name) setSupplierName(meta.supplier.name);
    }

    if (!opt) { setLines([]); return; }

    setLoadingPo(true);
    try {
      const poLines = await fetchPoLines(opt.value);
      const newLines: GrnLine[] = poLines.map((l: any, idx: number) => ({
        _rowId:       makeRowId(),
        itemId:       l.itemId,
        itemCode:     l.item?.code ?? '',
        description:  l.item?.description ?? '',
        poLineId:     l.id,
        uomCode:      l.uom?.code ?? l.uomId ?? '',
        uomId:        l.uomId,
        orderedQty:   Number(l.orderedQty ?? 0),
        prevReceived: Number(l.receivedQty ?? 0),
        receivedQty:  Math.max(0, Number(l.orderedQty ?? 0) - Number(l.receivedQty ?? 0)),
        acceptedQty:  Math.max(0, Number(l.orderedQty ?? 0) - Number(l.receivedQty ?? 0)),
        rejectedQty:  0,
        lineNo:       idx + 1,
      }));
      setLines(newLines);
    } catch (err) {
      toast.error('Failed to load PO lines');
    } finally {
      setLoadingPo(false);
    }
  }, [setValue, toast]);

  const updateLine = (rowId: string, field: keyof GrnLine, value: any) => {
    setLines((prev) => prev.map((l) => {
      if (l._rowId !== rowId) return l;
      const updated = { ...l, [field]: value };
      // Auto-sync acceptedQty = receivedQty - rejectedQty
      if (field === 'receivedQty') updated.acceptedQty = Math.max(0, Number(value) - updated.rejectedQty);
      if (field === 'rejectedQty') updated.acceptedQty = Math.max(0, updated.receivedQty - Number(value));
      return updated;
    }));
  };

  const removeLine = (rowId: string) => setLines((prev) => prev.filter((l) => l._rowId !== rowId));

  const addLine = () => {
    setLines((prev) => [...prev, {
      _rowId: makeRowId(), itemId: '', itemCode: '', description: '', poLineId: '',
      uomCode: '', uomId: '', orderedQty: 0, prevReceived: 0, receivedQty: 0,
      acceptedQty: 0, rejectedQty: 0, lineNo: prev.length + 1,
    }]);
  };

  // ── Save / Post / Cancel ────────────────────────────────────────────────────
  const onSubmit = async (values: FormValues) => {
    if (!lines.length) { toast.error('Add at least one line'); return; }
    setSaving(true);
    try {
      const payload = {
        ...values,
        lines: lines.map((l, i) => ({
          itemId:      l.itemId,
          poLineId:    l.poLineId,
          uomId:       l.uomId,
          receivedQty: l.receivedQty,
          acceptedQty: l.acceptedQty,
          rejectedQty: l.rejectedQty,
          binId:       l.binId || undefined,
          lotNo:       l.lotNo || undefined,
          batchNo:     l.batchNo || undefined,
          expiryDate:  l.expiryDate || undefined,
          lineNo:      i + 1,
        })),
      };
      if (isNew) {
        const res = await createMutation.mutateAsync(payload);
        toast.success('GRN saved');
        navigate(`/inventory/grn/${(res as any)?.data?.id ?? (res as any)?.id}`, { replace: true });
      } else {
        await updateMutation.mutateAsync(payload);
        toast.success('GRN saved');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    if (!window.confirm('Post this GRN? This action is irreversible and will update stock balances.')) return;
    try {
      await postMutation.mutateAsync();
      toast.success('GRN posted — stock updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Post failed');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this GRN?')) return;
    try {
      await cancelMutation.mutateAsync();
      toast.success('GRN cancelled');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Cancel failed');
    }
  };

  // ── Key Info panel ──────────────────────────────────────────────────────────
  const keyInfoPanel = (
    <form id="grn-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-4 gap-x-4 gap-y-3">
      <FormField label="GRN No" hint="Auto-generated">
        <input className="erp-input bg-gray-50" value={grn?.docNo ?? '—'} readOnly />
      </FormField>

      <FormField label="PO No" required error={errors.poId?.message}>
        <LookupField
          value={po}
          onChange={handlePoChange}
          onSearch={searchOpenPos}
          placeholder="Search open POs…"
          disabled={!isDraft}
        />
      </FormField>

      <FormField label="Supplier">
        <input className="erp-input bg-gray-50" value={supplierName || ((po?.meta as any)?.supplier?.name ?? '')} readOnly />
      </FormField>

      <FormField label="Warehouse" required error={errors.warehouseId?.message}>
        <Controller
          name="warehouseId"
          control={control}
          render={() => (
            <LookupField
              value={warehouse}
              onChange={(opt) => { setWarehouse(opt); setValue('warehouseId', opt?.value ?? ''); }}
              onSearch={searchWarehouses}
              placeholder="Search warehouse…"
              disabled={!isDraft}
            />
          )}
        />
      </FormField>

      <FormField label="Doc Date" required error={errors.docDate?.message}>
        <Input type="date" {...register('docDate')} disabled={!isDraft} />
      </FormField>

      <FormField label="Remarks" className="col-span-3">
        <Input {...register('remarks')} placeholder="Optional remarks" disabled={!isDraft} />
      </FormField>
    </form>
  );

  // ── Lines tab ───────────────────────────────────────────────────────────────
  const linesContent = (
    <div className="flex flex-col h-full">
      {isDraft && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
          <button type="button" onClick={addLine} className="toolbar-btn" disabled={loadingPo}>
            <Plus size={12} /> Add Line
          </button>
          {loadingPo && <span className="text-xs text-gray-400">Loading PO lines…</span>}
          <span className="text-xs text-gray-400 ml-auto">Lines: {lines.length}</span>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left w-7">#</th>
              <th className="px-2 py-2 text-left w-24">Item Code</th>
              <th className="px-2 py-2 text-left min-w-[160px]">Description</th>
              <th className="px-2 py-2 text-left w-16">UOM</th>
              <th className="px-2 py-2 text-right w-24">PO Qty</th>
              <th className="px-2 py-2 text-right w-24">Prev Rcvd</th>
              <th className="px-2 py-2 text-right w-28">This Receipt *</th>
              <th className="px-2 py-2 text-right w-24">Accepted *</th>
              <th className="px-2 py-2 text-right w-24">Rejected</th>
              <th className="px-2 py-2 text-left w-32">Bin</th>
              <th className="px-2 py-2 text-left w-24">Lot/Batch</th>
              <th className="px-2 py-2 text-left w-28">Expiry</th>
              {isDraft && <th className="px-2 py-2 w-8"></th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                {po ? 'No lines — PO lines loaded, click "Add Line" to add manually.' : 'Select a PO to auto-populate lines.'}
              </td></tr>
            )}
            {lines.map((row, idx) => (
              <tr key={row._rowId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                <td className="px-1 py-1">
                  {row.poLineId ? (
                    <span className="px-1 font-mono text-gray-700">{row.itemCode}</span>
                  ) : (
                    <LookupField
                      value={row.itemId ? { value: row.itemId, label: row.itemCode } : null}
                      onChange={(opt) => {
                        const meta = opt?.meta as any;
                        setLines(prev => prev.map(l => l._rowId !== row._rowId ? l : {
                          ...l,
                          itemId:      opt?.value ?? '',
                          itemCode:    meta?.code ?? '',
                          description: meta?.description ?? '',
                          uomCode:     meta?.uom?.code ?? '',
                          uomId:       meta?.uomId ?? '',
                        }));
                      }}
                      onSearch={searchItems}
                      placeholder="Item…"
                      disabled={!isDraft}
                      className="min-w-[100px]"
                    />
                  )}
                </td>
                <td className="px-2 py-1 text-gray-600">{row.description}</td>
                <td className="px-2 py-1 text-gray-500">{row.uomCode}</td>
                <td className="px-2 py-1 text-right text-gray-500">{row.orderedQty.toFixed(3)}</td>
                <td className="px-2 py-1 text-right text-gray-400">{row.prevReceived.toFixed(3)}</td>
                <td className="px-1 py-1">
                  <input type="number" value={row.receivedQty || ''} step="0.001" min={0}
                    onChange={(e) => updateLine(row._rowId, 'receivedQty', parseFloat(e.target.value) || 0)}
                    className="erp-input w-full text-right" disabled={!isDraft} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" value={row.acceptedQty || ''} step="0.001" min={0}
                    onChange={(e) => updateLine(row._rowId, 'acceptedQty', parseFloat(e.target.value) || 0)}
                    className="erp-input w-full text-right" disabled={!isDraft} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" value={row.rejectedQty || ''} step="0.001" min={0}
                    onChange={(e) => updateLine(row._rowId, 'rejectedQty', parseFloat(e.target.value) || 0)}
                    className="erp-input w-full text-right text-red-600" disabled={!isDraft} />
                </td>
                <td className="px-1 py-1">
                  <LookupField
                    value={row.binId ? { value: row.binId, label: row.binLabel ?? row.binId } : null}
                    onChange={(opt) => { updateLine(row._rowId, 'binId', opt?.value); updateLine(row._rowId, 'binLabel', opt?.label); }}
                    onSearch={(q) => searchBins(q, watch('warehouseId'))}
                    placeholder="Bin…"
                    disabled={!isDraft}
                    className="min-w-[110px]"
                  />
                </td>
                <td className="px-1 py-1">
                  <input type="text" value={row.lotNo ?? ''} placeholder="Lot/Batch"
                    onChange={(e) => updateLine(row._rowId, 'lotNo', e.target.value)}
                    className="erp-input w-full" disabled={!isDraft} />
                </td>
                <td className="px-1 py-1">
                  <input type="date" value={row.expiryDate ?? ''}
                    onChange={(e) => updateLine(row._rowId, 'expiryDate', e.target.value)}
                    className="erp-input w-full" disabled={!isDraft} />
                </td>
                {isDraft && (
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removeLine(row._rowId)} className="p-1 rounded hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={6} className="px-2 py-1 text-right text-xs font-semibold text-gray-600">Totals:</td>
                <td className="px-2 py-1 text-right text-xs font-bold">{lines.reduce((s, l) => s + l.receivedQty, 0).toFixed(3)}</td>
                <td className="px-2 py-1 text-right text-xs font-bold text-green-700">{lines.reduce((s, l) => s + l.acceptedQty, 0).toFixed(3)}</td>
                <td className="px-2 py-1 text-right text-xs font-bold text-red-600">{lines.reduce((s, l) => s + l.rejectedQty, 0).toFixed(3)}</td>
                <td colSpan={isDraft ? 4 : 3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  const tabs = [
    { id: 'key-info', label: 'Key Info',     content: keyInfoPanel },
    { id: 'lines',    label: 'Item Details', badge: lines.length, content: linesContent },
  ];

  if (isLoading && !isNew) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="Goods Receipt Note"
        docNo={grn?.docNo}
        status={grn ? <StatusBadge status={grn.status} /> : undefined}
        onNew={() => navigate('/inventory/grn/new')}
        onSave={isDraft ? () => document.getElementById('grn-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })) : undefined}
        saving={saving}
        actions={[
          { id: 'back', label: '← List', onClick: () => navigate('/inventory/grn'), variant: 'secondary' },
          ...(isDraft && !isNew ? [{ id: 'post', label: 'Post GRN', icon: <BookOpen size={13} />, onClick: handlePost, variant: 'success' as const }] : []),
          ...(isDraft && !isNew ? [{ id: 'cancel', label: 'Cancel', onClick: handleCancel, variant: 'danger' as const }] : []),
          ...(isPosted ? [{ id: 'print', label: 'Print', onClick: () => window.print(), variant: 'secondary' as const }] : []),
        ]}
      />
      <div className="flex-1 overflow-auto">
        <KeyInfoItemDetailsTabs tabs={tabs} defaultTabId="key-info" className="min-h-full" />
      </div>
    </div>
  );
}
