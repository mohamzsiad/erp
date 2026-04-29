import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, CheckSquare } from 'lucide-react';

import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { KeyInfoItemDetailsTabs } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { FormField, Input } from '../../../components/ui/FormField';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useToast } from '../../../components/ui/Toast';
import { useIssue, useCreateIssue, usePostIssue, useCancelIssue, searchWarehouses, searchItems, searchBins, searchChargeCodes, searchMrls } from '../../../api/inventory';

const schema = z.object({
  warehouseId:  z.string().min(1, 'Warehouse is required'),
  docDate:      z.string().min(1, 'Date is required'),
  chargeCodeId: z.string().min(1, 'Charge code is required'),
  mrlId:        z.string().optional(),
  remarks:      z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface IssueLine { _rowId: string; itemId: string; itemLabel: string; uomId: string; uomCode: string; binId?: string; binLabel?: string; issuedQty: number; avgCost: number; lineNo: number; }
const mkId = () => Math.random().toString(36).slice(2);

export default function IssueFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew   = !id || id === 'new';
  const navigate = useNavigate();
  const toast    = useToast();
  const [saving, setSaving]           = useState(false);
  const [warehouse, setWarehouse]     = useState<LookupOption | null>(null);
  const [chargeCode, setChargeCode]   = useState<LookupOption | null>(null);
  const [mrl, setMrl]                 = useState<LookupOption | null>(null);
  const [lines, setLines]             = useState<IssueLine[]>([]);

  const { data: issueData } = useIssue(isNew ? undefined : id);
  const issue = (issueData as any)?.data ?? issueData;
  const createMutation = useCreateIssue();
  const postMutation   = usePostIssue(id ?? '');
  const cancelMutation = useCancelIssue(id ?? '');

  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const isDraft = !issue || issue.status === 'DRAFT';

  useEffect(() => {
    if (!issue) return;
    setValue('warehouseId', issue.warehouseId);
    setValue('docDate', issue.docDate?.split('T')[0] ?? '');
    setValue('chargeCodeId', issue.chargeCodeId);
    setValue('mrlId', issue.mrlId ?? '');
    setValue('remarks', issue.remarks ?? '');
    if (issue.warehouse) setWarehouse({ value: issue.warehouse.id, label: `${issue.warehouse.code} – ${issue.warehouse.name}` });
    if (issue.chargeCode) setChargeCode({ value: issue.chargeCode.id, label: issue.chargeCode.code });
    if (issue.mrl) setMrl({ value: issue.mrl.id, label: issue.mrl.docNo });
    setLines((issue.lines ?? []).map((l: any, i: number) => ({
      _rowId: mkId(), itemId: l.itemId, itemLabel: `${l.item?.code ?? ''} – ${l.item?.description ?? ''}`,
      uomId: l.uomId, uomCode: l.uom?.code ?? '', binId: l.binId, binLabel: l.bin?.code,
      issuedQty: Number(l.issuedQty ?? 0), avgCost: Number(l.avgCost ?? 0), lineNo: l.lineNo ?? i + 1,
    })));
  }, [issue, setValue]);

  const updateLine = (rowId: string, field: keyof IssueLine, value: any) =>
    setLines((prev) => prev.map((l) => l._rowId === rowId ? { ...l, [field]: value } : l));

  const onSubmit = async (values: FormValues) => {
    if (!lines.length) { toast.error('Add at least one line'); return; }
    setSaving(true);
    try {
      const payload = { ...values, lines: lines.map((l, i) => ({ itemId: l.itemId, uomId: l.uomId, binId: l.binId || undefined, issuedQty: l.issuedQty, lineNo: i + 1 })) };
      const res = await createMutation.mutateAsync(payload);
      toast.success('Issue saved');
      navigate(`/inventory/issue/${(res as any)?.data?.id ?? (res as any)?.id}`, { replace: true });
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const handlePost = async () => {
    if (!window.confirm('Post this Stock Issue? This will deduct stock.')) return;
    try { await postMutation.mutateAsync(); toast.success('Issue posted'); }
    catch (err: any) { toast.error(err?.response?.data?.message ?? 'Post failed'); }
  };

  const keyInfoPanel = (
    <form id="issue-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-4 gap-x-4 gap-y-3">
      <FormField label="Issue No" hint="Auto-generated"><input className="erp-input bg-gray-50" value={issue?.docNo ?? '—'} readOnly /></FormField>
      <FormField label="From Warehouse" required error={errors.warehouseId?.message}>
        <LookupField value={warehouse} onChange={(opt) => { setWarehouse(opt); setValue('warehouseId', opt?.value ?? ''); }} onSearch={searchWarehouses} placeholder="Search warehouse…" disabled={!isDraft} />
      </FormField>
      <FormField label="Doc Date" required error={errors.docDate?.message}>
        <Input type="date" {...register('docDate')} disabled={!isDraft} />
      </FormField>
      <FormField label="Charge Code" required error={errors.chargeCodeId?.message}>
        <LookupField value={chargeCode} onChange={(opt) => { setChargeCode(opt); setValue('chargeCodeId', opt?.value ?? ''); }} onSearch={searchChargeCodes} placeholder="Search charge code…" disabled={!isDraft} />
      </FormField>
      <FormField label="MRL Reference">
        <LookupField value={mrl} onChange={(opt) => { setMrl(opt); setValue('mrlId', opt?.value ?? ''); }} onSearch={searchMrls} placeholder="Optional MRL…" disabled={!isDraft} />
      </FormField>
      <FormField label="Remarks" className="col-span-3">
        <Input {...register('remarks')} placeholder="Optional remarks" disabled={!isDraft} />
      </FormField>
    </form>
  );

  const linesContent = (
    <div className="flex flex-col h-full">
      {isDraft && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
          <button type="button" onClick={() => setLines((p) => [...p, { _rowId: mkId(), itemId: '', itemLabel: '', uomId: '', uomCode: '', issuedQty: 1, avgCost: 0, lineNo: p.length + 1 }])} className="toolbar-btn">
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
              <th className="px-2 py-2 text-right w-24">Issue Qty *</th>
              <th className="px-2 py-2 text-left w-16">UOM</th>
              <th className="px-2 py-2 text-right w-24">Avg Cost</th>
              <th className="px-2 py-2 text-right w-28">Value</th>
              {isDraft && <th className="px-2 py-2 w-8"></th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No lines. Click "Add Line".</td></tr>}
            {lines.map((row, idx) => (
              <tr key={row._rowId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                <td className="px-1 py-1">
                  <LookupField value={row.itemId ? { value: row.itemId, label: row.itemLabel } : null}
                    onChange={(opt) => { updateLine(row._rowId, 'itemId', opt?.value ?? ''); updateLine(row._rowId, 'itemLabel', opt?.label ?? ''); updateLine(row._rowId, 'uomCode', (opt?.meta as any)?.uom?.code ?? ''); updateLine(row._rowId, 'uomId', (opt?.meta as any)?.uomId ?? ''); }}
                    onSearch={searchItems} placeholder="Search item…" disabled={!isDraft} className="min-w-[180px]" />
                </td>
                <td className="px-1 py-1">
                  <LookupField value={row.binId ? { value: row.binId, label: row.binLabel ?? row.binId } : null}
                    onChange={(opt) => { updateLine(row._rowId, 'binId', opt?.value); updateLine(row._rowId, 'binLabel', opt?.label); }}
                    onSearch={(q) => searchBins(q, watch('warehouseId'))} placeholder="Bin…" disabled={!isDraft} className="min-w-[100px]" />
                </td>
                <td className="px-1 py-1">
                  <input type="number" value={row.issuedQty || ''} step="0.001" min={0}
                    onChange={(e) => updateLine(row._rowId, 'issuedQty', parseFloat(e.target.value) || 0)}
                    className="erp-input w-full text-right" disabled={!isDraft} />
                </td>
                <td className="px-2 py-1 text-gray-500">{row.uomCode}</td>
                <td className="px-2 py-1 text-right text-gray-400">{Number(row.avgCost).toFixed(3)}</td>
                <td className="px-2 py-1 text-right font-medium">{(row.issuedQty * row.avgCost).toFixed(3)}</td>
                {isDraft && (
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => setLines((p) => p.filter((l) => l._rowId !== row._rowId))} className="p-1 rounded hover:bg-red-50 hover:text-red-500">
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
                <td colSpan={3} className="px-2 py-1 text-right text-xs font-semibold">Total:</td>
                <td className="px-2 py-1 text-right text-xs font-bold">{lines.reduce((s, l) => s + l.issuedQty, 0).toFixed(3)}</td>
                <td />
                <td />
                <td className="px-2 py-1 text-right text-xs font-bold">{lines.reduce((s, l) => s + l.issuedQty * l.avgCost, 0).toFixed(3)}</td>
                {isDraft && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="Stock Issue"
        docNo={issue?.docNo}
        status={issue ? <StatusBadge status={issue.status} /> : undefined}
        onNew={() => navigate('/inventory/issue/new')}
        onSave={isDraft && isNew ? () => document.getElementById('issue-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })) : undefined}
        saving={saving}
        actions={[
          { id: 'back', label: '← List', onClick: () => navigate('/inventory/issue'), variant: 'secondary' },
          ...(isDraft && !isNew ? [{ id: 'post', label: 'Post Issue', icon: <CheckSquare size={13} />, onClick: handlePost, variant: 'success' as const }] : []),
          ...(isDraft && !isNew ? [{ id: 'cancel', label: 'Cancel', onClick: async () => { if (window.confirm('Cancel?')) { await cancelMutation.mutateAsync(); toast.success('Cancelled'); } }, variant: 'danger' as const }] : []),
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
