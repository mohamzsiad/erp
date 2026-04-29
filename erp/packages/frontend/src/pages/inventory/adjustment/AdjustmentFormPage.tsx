import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Send, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { KeyInfoItemDetailsTabs } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { FormField, Input } from '../../../components/ui/FormField';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useToast } from '../../../components/ui/Toast';
import {
  useAdjustment, useCreateAdjustment, useSubmitAdjustment, useApproveAdjustment, useRejectAdjustment,
  useAdjustmentReasons, searchWarehouses, searchItems, searchBins,
} from '../../../api/inventory';

const schema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  reasonId:    z.string().min(1, 'Reason is required'),
  docDate:     z.string().min(1, 'Date is required'),
});
type FormValues = z.infer<typeof schema>;

interface AdjLine { _rowId: string; itemId: string; itemLabel: string; uomId: string; uomCode: string; binId?: string; binLabel?: string; systemQty: number; physicalQty: number; avgCost: number; lineNo: number; }
const mkId = () => Math.random().toString(36).slice(2);

export default function AdjustmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew   = !id || id === 'new';
  const navigate = useNavigate();
  const toast    = useToast();
  const [saving, setSaving]       = useState(false);
  const [warehouse, setWarehouse] = useState<LookupOption | null>(null);
  const [lines, setLines]         = useState<AdjLine[]>([]);

  const { data: adjData }     = useAdjustment(isNew ? undefined : id);
  const { data: reasonsData } = useAdjustmentReasons();
  const adj     = (adjData as any)?.data ?? adjData;
  const reasons: any[] = (reasonsData as any)?.data ?? [];

  const createMutation  = useCreateAdjustment();
  const submitMutation  = useSubmitAdjustment(id ?? '');
  const approveMutation = useApproveAdjustment(id ?? '');
  const rejectMutation  = useRejectAdjustment(id ?? '');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const isDraft     = !adj || adj.status === 'DRAFT';
  const isSubmitted = adj?.status === 'SUBMITTED';
  const isEditable  = isDraft;

  useEffect(() => {
    if (!adj) return;
    setValue('warehouseId', adj.warehouseId);
    setValue('reasonId', adj.reasonId);
    setValue('docDate', adj.docDate?.split('T')[0] ?? '');
    if (adj.warehouse) setWarehouse({ value: adj.warehouse.id, label: `${adj.warehouse.code} – ${adj.warehouse.name}` });
    setLines((adj.lines ?? []).map((l: any, i: number) => ({
      _rowId: mkId(), itemId: l.itemId, itemLabel: `${l.item?.code ?? ''} – ${l.item?.description ?? ''}`,
      uomId: l.uomId, uomCode: l.uom?.code ?? '', binId: l.binId, binLabel: l.bin?.code,
      systemQty: Number(l.systemQty ?? 0), physicalQty: Number(l.physicalQty ?? 0),
      avgCost: Number(l.avgCost ?? 0), lineNo: l.lineNo ?? i + 1,
    })));
  }, [adj, setValue]);

  const updateLine = (rowId: string, field: keyof AdjLine, value: any) =>
    setLines((prev) => prev.map((l) => l._rowId === rowId ? { ...l, [field]: value } : l));

  const onSubmit = async (values: FormValues) => {
    if (!lines.length) { toast.error('Add at least one line'); return; }
    setSaving(true);
    try {
      const payload = { ...values, lines: lines.map((l, i) => ({ itemId: l.itemId, uomId: l.uomId, binId: l.binId || undefined, systemQty: l.systemQty, physicalQty: l.physicalQty, lineNo: i + 1 })) };
      const res = await createMutation.mutateAsync(payload);
      toast.success('Adjustment saved');
      navigate(`/inventory/adjustment/${(res as any)?.data?.id ?? (res as any)?.id}`, { replace: true });
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleSubmitAdj = async () => {
    try { await submitMutation.mutateAsync(); toast.success('Submitted for approval'); }
    catch (err: any) { toast.error(err?.response?.data?.message ?? 'Submit failed'); }
  };
  const handleApprove = async () => {
    try { await approveMutation.mutateAsync(); toast.success('Adjustment approved & posted'); }
    catch (err: any) { toast.error(err?.response?.data?.message ?? 'Approve failed'); }
  };
  const handleReject = async () => {
    try { await rejectMutation.mutateAsync(); toast.success('Adjustment rejected'); }
    catch (err: any) { toast.error(err?.response?.data?.message ?? 'Reject failed'); }
  };

  const keyInfoPanel = (
    <form id="adj-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-4 gap-x-4 gap-y-3">
      <FormField label="Adj No" hint="Auto-generated"><input className="erp-input bg-gray-50" value={adj?.docNo ?? '—'} readOnly /></FormField>
      <FormField label="Warehouse" required error={errors.warehouseId?.message}>
        <LookupField value={warehouse} onChange={(opt) => { setWarehouse(opt); setValue('warehouseId', opt?.value ?? ''); }} onSearch={searchWarehouses} placeholder="Search warehouse…" disabled={!isEditable} />
      </FormField>
      <FormField label="Doc Date" required error={errors.docDate?.message}>
        <Input type="date" {...register('docDate')} disabled={!isEditable} />
      </FormField>
      <FormField label="Reason" required error={errors.reasonId?.message}>
        <select {...register('reasonId')} className={`erp-input ${errors.reasonId ? 'border-red-400' : ''}`} disabled={!isEditable}>
          <option value="">-- Select Reason --</option>
          {reasons.filter((r) => r.code !== 'PHYS_COUNT').map((r: any) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </FormField>
    </form>
  );

  const linesContent = (
    <div className="flex flex-col h-full">
      {isEditable && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
          <button type="button" onClick={() => setLines((p) => [...p, { _rowId: mkId(), itemId: '', itemLabel: '', uomId: '', uomCode: '', systemQty: 0, physicalQty: 0, avgCost: 0, lineNo: p.length + 1 }])} className="toolbar-btn">
            <Plus size={12} /> Add Line
          </button>
          <span className="text-xs text-gray-400 ml-auto">Lines: {lines.length}</span>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left w-7">#</th>
              <th className="px-2 py-2 text-left min-w-[200px]">Item *</th>
              <th className="px-2 py-2 text-left w-24">Bin</th>
              <th className="px-2 py-2 text-right w-28">System Qty</th>
              <th className="px-2 py-2 text-right w-28">Physical Qty *</th>
              <th className="px-2 py-2 text-right w-24">Variance</th>
              <th className="px-2 py-2 text-left w-16">UOM</th>
              <th className="px-2 py-2 text-right w-24">Avg Cost</th>
              <th className="px-2 py-2 text-right w-28">Variance Value</th>
              {isEditable && <th className="px-2 py-2 w-8"></th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No lines. Click "Add Line".</td></tr>}
            {lines.map((row, idx) => {
              const variance = row.physicalQty - row.systemQty;
              return (
                <tr key={row._rowId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                  <td className="px-1 py-1">
                    <LookupField value={row.itemId ? { value: row.itemId, label: row.itemLabel } : null}
                      onChange={(opt) => { updateLine(row._rowId, 'itemId', opt?.value ?? ''); updateLine(row._rowId, 'itemLabel', opt?.label ?? ''); updateLine(row._rowId, 'uomCode', (opt?.meta as any)?.uom?.code ?? ''); updateLine(row._rowId, 'uomId', (opt?.meta as any)?.uomId ?? ''); }}
                      onSearch={searchItems} placeholder="Search item…" disabled={!isEditable} className="min-w-[180px]" />
                  </td>
                  <td className="px-1 py-1">
                    <LookupField value={row.binId ? { value: row.binId, label: row.binLabel ?? row.binId } : null}
                      onChange={(opt) => { updateLine(row._rowId, 'binId', opt?.value); updateLine(row._rowId, 'binLabel', opt?.label); }}
                      onSearch={(q) => searchBins(q, watch('warehouseId'))} placeholder="Bin…" disabled={!isEditable} className="min-w-[90px]" />
                  </td>
                  <td className="px-2 py-1 text-right bg-gray-50 text-gray-500">{row.systemQty.toFixed(3)}</td>
                  <td className="px-1 py-1">
                    <input type="number" value={row.physicalQty || ''} step="0.001" min={0}
                      onChange={(e) => updateLine(row._rowId, 'physicalQty', parseFloat(e.target.value) || 0)}
                      className="erp-input w-full text-right" disabled={!isEditable} />
                  </td>
                  <td className={clsx('px-2 py-1 text-right font-medium', variance > 0 ? 'text-green-700' : variance < 0 ? 'text-red-600' : 'text-gray-400')}>
                    {variance > 0 ? '+' : ''}{variance.toFixed(3)}
                  </td>
                  <td className="px-2 py-1 text-gray-500">{row.uomCode}</td>
                  <td className="px-2 py-1 text-right text-gray-400">{row.avgCost.toFixed(3)}</td>
                  <td className={clsx('px-2 py-1 text-right font-medium', variance !== 0 ? (variance > 0 ? 'text-green-700' : 'text-red-600') : 'text-gray-400')}>
                    {variance !== 0 ? (variance > 0 ? '+' : '') : ''}{(variance * row.avgCost).toFixed(3)}
                  </td>
                  {isEditable && (
                    <td className="px-1 py-1">
                      <button type="button" onClick={() => setLines((p) => p.filter((l) => l._rowId !== row._rowId))} className="p-1 rounded hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={5} className="px-2 py-1 text-right text-xs font-semibold">Total Variance Value:</td>
                <td colSpan={3} />
                <td className="px-2 py-1 text-right text-xs font-bold">
                  {lines.reduce((s, l) => s + (l.physicalQty - l.systemQty) * l.avgCost, 0).toFixed(3)}
                </td>
                {isEditable && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar title="Stock Adjustment" docNo={adj?.docNo} status={adj ? <StatusBadge status={adj.status} /> : undefined}
        onNew={() => navigate('/inventory/adjustment/new')}
        onSave={isDraft && isNew ? () => document.getElementById('adj-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })) : undefined}
        saving={saving}
        actions={[
          { id: 'back', label: '← List', onClick: () => navigate('/inventory/adjustment'), variant: 'secondary' },
          ...(isDraft && !isNew ? [{ id: 'submit', label: 'Submit', icon: <Send size={13} />, onClick: handleSubmitAdj, variant: 'primary' as const }] : []),
          ...(isSubmitted ? [{ id: 'approve', label: 'Approve & Post', icon: <CheckCircle size={13} />, onClick: handleApprove, variant: 'success' as const }] : []),
          ...(isSubmitted ? [{ id: 'reject', label: 'Reject', onClick: handleReject, variant: 'danger' as const }] : []),
        ]}
      />
      <div className="flex-1 overflow-auto">
        <KeyInfoItemDetailsTabs tabs={[
          { id: 'key-info', label: 'Key Info', content: keyInfoPanel },
          { id: 'lines', label: 'Lines', badge: lines.length, content: linesContent },
        ]} defaultTabId="key-info" className="min-h-full" />
      </div>
    </div>
  );
}
