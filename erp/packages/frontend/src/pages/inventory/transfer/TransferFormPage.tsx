import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ArrowRightLeft } from 'lucide-react';

import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { KeyInfoItemDetailsTabs } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { FormField, Input } from '../../../components/ui/FormField';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useToast } from '../../../components/ui/Toast';
import { useTransfer, useCreateTransfer, usePostTransfer, useCancelTransfer, searchWarehouses, searchItems, searchBins } from '../../../api/inventory';

const schema = z.object({
  fromWarehouseId: z.string().min(1, 'From Warehouse is required'),
  toWarehouseId:   z.string().min(1, 'To Warehouse is required'),
  docDate:         z.string().min(1, 'Date is required'),
  remarks:         z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface TransferLine { _rowId: string; itemId: string; itemLabel: string; uomId: string; uomCode: string; fromBinId?: string; fromBinLabel?: string; toBinId?: string; toBinLabel?: string; transferQty: number; lineNo: number; }
const mkId = () => Math.random().toString(36).slice(2);

export default function TransferFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew   = !id || id === 'new';
  const navigate = useNavigate();
  const toast    = useToast();
  const [saving, setSaving]           = useState(false);
  const [fromWh, setFromWh]           = useState<LookupOption | null>(null);
  const [toWh, setToWh]               = useState<LookupOption | null>(null);
  const [lines, setLines]             = useState<TransferLine[]>([]);

  const { data: txfData } = useTransfer(isNew ? undefined : id);
  const txf = (txfData as any)?.data ?? txfData;
  const createMutation = useCreateTransfer();
  const postMutation   = usePostTransfer(id ?? '');
  const cancelMutation = useCancelTransfer(id ?? '');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const isDraft = !txf || txf.status === 'DRAFT';

  useEffect(() => {
    if (!txf) return;
    setValue('fromWarehouseId', txf.fromWarehouseId);
    setValue('toWarehouseId', txf.toWarehouseId);
    setValue('docDate', txf.docDate?.split('T')[0] ?? '');
    setValue('remarks', txf.remarks ?? '');
    if (txf.fromWarehouse) setFromWh({ value: txf.fromWarehouse.id, label: `${txf.fromWarehouse.code} – ${txf.fromWarehouse.name}` });
    if (txf.toWarehouse)   setToWh({ value: txf.toWarehouse.id, label: `${txf.toWarehouse.code} – ${txf.toWarehouse.name}` });
    setLines((txf.lines ?? []).map((l: any, i: number) => ({
      _rowId: mkId(), itemId: l.itemId, itemLabel: `${l.item?.code ?? ''} – ${l.item?.description ?? ''}`,
      uomId: l.uomId, uomCode: l.uom?.code ?? '', fromBinId: l.fromBinId, fromBinLabel: l.fromBin?.code,
      toBinId: l.toBinId, toBinLabel: l.toBin?.code, transferQty: Number(l.transferQty ?? 0), lineNo: l.lineNo ?? i + 1,
    })));
  }, [txf, setValue]);

  const updateLine = (rowId: string, field: keyof TransferLine, value: any) =>
    setLines((prev) => prev.map((l) => l._rowId === rowId ? { ...l, [field]: value } : l));

  const onSubmit = async (values: FormValues) => {
    if (!lines.length) { toast.error('Add at least one line'); return; }
    setSaving(true);
    try {
      const payload = { ...values, lines: lines.map((l, i) => ({ itemId: l.itemId, uomId: l.uomId, fromBinId: l.fromBinId || undefined, toBinId: l.toBinId || undefined, transferQty: l.transferQty, lineNo: i + 1 })) };
      const res = await createMutation.mutateAsync(payload);
      toast.success('Transfer saved');
      navigate(`/inventory/transfer/${(res as any)?.data?.id ?? (res as any)?.id}`, { replace: true });
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const handlePost = async () => {
    if (!window.confirm('Post this Transfer? This will move stock between warehouses.')) return;
    try { await postMutation.mutateAsync(); toast.success('Transfer posted'); }
    catch (err: any) { toast.error(err?.response?.data?.message ?? 'Post failed'); }
  };

  const keyInfoPanel = (
    <form id="txf-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-4 gap-x-4 gap-y-3">
      <FormField label="Transfer No" hint="Auto-generated"><input className="erp-input bg-gray-50" value={txf?.docNo ?? '—'} readOnly /></FormField>
      <FormField label="From Warehouse" required error={errors.fromWarehouseId?.message}>
        <LookupField value={fromWh} onChange={(opt) => { setFromWh(opt); setValue('fromWarehouseId', opt?.value ?? ''); }} onSearch={searchWarehouses} placeholder="Search…" disabled={!isDraft} />
      </FormField>
      <FormField label="To Warehouse" required error={errors.toWarehouseId?.message}>
        <LookupField value={toWh} onChange={(opt) => { setToWh(opt); setValue('toWarehouseId', opt?.value ?? ''); }} onSearch={searchWarehouses} placeholder="Search…" disabled={!isDraft} />
      </FormField>
      <FormField label="Doc Date" required error={errors.docDate?.message}>
        <Input type="date" {...register('docDate')} disabled={!isDraft} />
      </FormField>
      <FormField label="Remarks" className="col-span-4">
        <Input {...register('remarks')} placeholder="Optional remarks" disabled={!isDraft} />
      </FormField>
    </form>
  );

  const linesContent = (
    <div className="flex flex-col h-full">
      {isDraft && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
          <button type="button" onClick={() => setLines((p) => [...p, { _rowId: mkId(), itemId: '', itemLabel: '', uomId: '', uomCode: '', transferQty: 1, lineNo: p.length + 1 }])} className="toolbar-btn">
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
              <th className="px-2 py-2 text-left w-24">From Bin</th>
              <th className="px-2 py-2 text-left w-24">To Bin</th>
              <th className="px-2 py-2 text-right w-28">Transfer Qty *</th>
              <th className="px-2 py-2 text-left w-16">UOM</th>
              {isDraft && <th className="px-2 py-2 w-8"></th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No lines. Click "Add Line".</td></tr>}
            {lines.map((row, idx) => (
              <tr key={row._rowId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                <td className="px-1 py-1">
                  <LookupField value={row.itemId ? { value: row.itemId, label: row.itemLabel } : null}
                    onChange={(opt) => { updateLine(row._rowId, 'itemId', opt?.value ?? ''); updateLine(row._rowId, 'itemLabel', opt?.label ?? ''); updateLine(row._rowId, 'uomCode', (opt?.meta as any)?.uom?.code ?? ''); updateLine(row._rowId, 'uomId', (opt?.meta as any)?.uomId ?? ''); }}
                    onSearch={searchItems} placeholder="Search item…" disabled={!isDraft} className="min-w-[180px]" />
                </td>
                <td className="px-1 py-1">
                  <LookupField value={row.fromBinId ? { value: row.fromBinId, label: row.fromBinLabel ?? row.fromBinId } : null}
                    onChange={(opt) => { updateLine(row._rowId, 'fromBinId', opt?.value); updateLine(row._rowId, 'fromBinLabel', opt?.label); }}
                    onSearch={(q) => searchBins(q, watch('fromWarehouseId'))} placeholder="From bin…" disabled={!isDraft} className="min-w-[90px]" />
                </td>
                <td className="px-1 py-1">
                  <LookupField value={row.toBinId ? { value: row.toBinId, label: row.toBinLabel ?? row.toBinId } : null}
                    onChange={(opt) => { updateLine(row._rowId, 'toBinId', opt?.value); updateLine(row._rowId, 'toBinLabel', opt?.label); }}
                    onSearch={(q) => searchBins(q, watch('toWarehouseId'))} placeholder="To bin…" disabled={!isDraft} className="min-w-[90px]" />
                </td>
                <td className="px-1 py-1">
                  <input type="number" value={row.transferQty} step="0.001" min={0}
                    onChange={(e) => updateLine(row._rowId, 'transferQty', parseFloat(e.target.value) || 0)}
                    className="erp-input w-full text-right" disabled={!isDraft} />
                </td>
                <td className="px-2 py-1 text-gray-500">{row.uomCode}</td>
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
                <td colSpan={4} className="px-2 py-1 text-right text-xs font-semibold">Total Qty:</td>
                <td className="px-2 py-1 text-right text-xs font-bold">{lines.reduce((s, l) => s + l.transferQty, 0).toFixed(3)}</td>
                <td colSpan={isDraft ? 2 : 1} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar title="Stock Transfer" docNo={txf?.docNo} status={txf ? <StatusBadge status={txf.status} /> : undefined}
        onNew={() => navigate('/inventory/transfer/new')}
        onSave={isDraft && isNew ? () => document.getElementById('txf-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })) : undefined}
        saving={saving}
        actions={[
          { id: 'back', label: '← List', onClick: () => navigate('/inventory/transfer'), variant: 'secondary' },
          ...(isDraft && !isNew ? [{ id: 'post', label: 'Post Transfer', icon: <ArrowRightLeft size={13} />, onClick: handlePost, variant: 'success' as const }] : []),
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
