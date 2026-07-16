import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, CheckCircle, ThumbsUp, ThumbsDown, Unlock, XCircle, MinusCircle, Loader2 } from 'lucide-react';
import {
  useOrder, useOrderAvailability, useCreateOrder, useUpdateOrder, orderApi,
  type UpsertOrderInput, type CreditCheck,
} from '../../../api/salesDocs';
import { useCustomerList, priceListApi } from '../../../api/sales';
import { useItemList, useUoms, useWarehouseList } from '../../../api/inventory';

interface LineRow {
  lineId?: string; itemId: string; itemLabel: string; uomId: string;
  orderedQty: number; unitPrice: number; minPrice: number | null; discountPct: number;
}

const ACTIVE = ['APPROVED', 'IN_PROGRESS'];

export default function OrderFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading, refetch } = useOrder(id);
  const { data: availability } = useOrderAvailability(id);
  const createMut = useCreateOrder();
  const updateMut = useUpdateOrder(id ?? '');
  const { data: customers } = useCustomerList({ limit: 200 });
  const { data: itemsResp } = useItemList({ limit: 200 });
  const { data: uomsResp } = useUoms();
  const { data: whResp } = useWarehouseList({ limit: 200 });
  const itemOptions = (((itemsResp as any)?.data ?? []) as Array<{ id: string; code: string; description: string }>);
  const uomOptions = (((uomsResp as any)?.data ?? (uomsResp as any) ?? []) as Array<{ id: string; code: string }>);
  const whOptions = (((whResp as any)?.data ?? (whResp as any) ?? []) as Array<{ id: string; code: string; name: string }>);

  const [customerId, setCustomerId] = useState('');
  const [orderType, setOrderType] = useState<'STOCK' | 'SERVICE' | 'PROJECT' | 'DIRECT'>('STOCK');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [requestedDate, setRequestedDate] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<LineRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [credit, setCredit] = useState<CreditCheck | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const status = existing?.status ?? 'DRAFT';
  const editable = !isEdit || status === 'DRAFT';

  useEffect(() => {
    if (!existing) return;
    setCustomerId(existing.customerId);
    setOrderType(existing.orderType);
    setOrderDate(existing.orderDate ? existing.orderDate.slice(0, 10) : '');
    setRequestedDate(existing.requestedDate ? existing.requestedDate.slice(0, 10) : '');
    setWarehouseId(existing.warehouseId ?? '');
    setPaymentTerms(existing.paymentTerms ?? '');
    setNotes(existing.notes ?? '');
    setRows((existing.lines ?? []).map((l: any) => ({
      lineId: l.id, itemId: l.itemId, itemLabel: l.item ? `${l.item.code} — ${l.item.description}` : l.itemId,
      uomId: l.uomId, orderedQty: Number(l.orderedQty), unitPrice: Number(l.unitPrice), minPrice: null, discountPct: Number(l.discountPct),
    })));
  }, [existing]);

  const atpByLine = useMemo(() => {
    const m: Record<string, number> = {};
    (availability?.lines ?? []).forEach((a) => { m[a.lineId] = a.availableToPromise; });
    return m;
  }, [availability]);

  const upd = (i: number, patch: Partial<LineRow>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const prefill = async (i: number, itemId: string, uomId: string) => {
    if (!itemId || !uomId) return;
    try {
      const res = await priceListApi.lookup({ itemId, uomId, customerId: customerId || undefined, date: orderDate });
      upd(i, { unitPrice: res.unitPrice ?? 0, minPrice: res.minPrice });
    } catch { /* ignore */ }
  };

  const totals = useMemo(() => {
    let sub = 0, disc = 0;
    rows.forEach((r) => { const g = r.orderedQty * r.unitPrice; sub += g; disc += g * (r.discountPct / 100); });
    return { sub, disc, net: sub - disc };
  }, [rows]);

  const payload = (): UpsertOrderInput => ({
    customerId, orderType, orderDate, requestedDate: requestedDate || null,
    warehouseId: warehouseId || null, paymentTerms: paymentTerms || null, notes: notes || null,
    lines: rows.filter((r) => r.itemId && r.uomId).map((r) => ({
      itemId: r.itemId, uomId: r.uomId, orderedQty: Number(r.orderedQty) || 0, unitPrice: Number(r.unitPrice) || 0, discountPct: Number(r.discountPct) || 0,
    })),
  });

  const save = async () => {
    setError(null);
    if (!customerId) { setError('Select a customer'); return; }
    if (payload().lines.length === 0) { setError('Add at least one line'); return; }
    try {
      if (isEdit) { await updateMut.mutateAsync(payload()); refetch(); setBanner('Saved.'); }
      else { const o = await createMut.mutateAsync(payload()); navigate(`/sales/orders/${o.id}`); }
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Save failed'); }
  };

  const runAction = async (fn: () => Promise<any>, captureCredit = false) => {
    setError(null); setBanner(null);
    try {
      const r = await fn();
      if (captureCredit && r?.creditCheck) setCredit(r.creditCheck);
      if (r?.status) setBanner(`Status: ${r.status}${r?.warnings?.length ? ' — ' + r.warnings.join('; ') : ''}`);
      refetch();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Action failed'); }
  };

  const saving = createMut.isPending || updateMut.isPending;
  if (isEdit && isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#1F4E79]" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
        <button onClick={() => navigate('/sales/orders')} className="toolbar-btn"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">{isEdit ? `Order ${existing?.docNo ?? ''} · ${status}` : 'New Order'}</h2>
        <div className="flex-1" />
        {isEdit && status === 'DRAFT' && <button onClick={() => runAction(() => orderApi.confirm(id!), true)} className="toolbar-btn"><CheckCircle size={13} /><span>Confirm</span></button>}
        {isEdit && status === 'PENDING_APPROVAL' && <>
          <button onClick={() => runAction(() => orderApi.approve(id!))} className="toolbar-btn"><ThumbsUp size={13} /><span>Approve</span></button>
          <button onClick={() => runAction(() => orderApi.reject(id!))} className="toolbar-btn"><ThumbsDown size={13} /><span>Reject</span></button>
        </>}
        {isEdit && status === 'CREDIT_HOLD' && <button onClick={() => runAction(() => orderApi.releaseHold(id!))} className="toolbar-btn"><Unlock size={13} /><span>Release Hold</span></button>}
        {isEdit && ACTIVE.includes(status) && <button onClick={() => runAction(() => orderApi.shortClose(id!))} className="toolbar-btn"><MinusCircle size={13} /><span>Short-Close</span></button>}
        {isEdit && !['CLOSED', 'CANCELLED'].includes(status) && <button onClick={() => runAction(() => orderApi.cancel(id!))} className="toolbar-btn"><XCircle size={13} /><span>Cancel</span></button>}
        {editable && <button onClick={save} disabled={saving} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save</span></button>}
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}
      {banner && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-blue-50 text-[#1F4E79] border border-blue-200 rounded">{banner}</div>}
      {(existing?.creditHoldReason || credit) && (
        <div className="mx-4 mt-3 px-3 py-2 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded flex flex-wrap gap-4">
          {credit && <span>Available credit: <b>{credit.availableCredit.toLocaleString()}</b></span>}
          {credit?.hasOverdue && <span>Customer has overdue balance</span>}
          {(existing?.creditHoldReason || credit?.reason) && <span>Hold reason: {existing?.creditHoldReason ?? credit?.reason}</span>}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-4 gap-4">
          <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Customer *</label>
            <select className="erp-input w-full" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={!editable}>
              <option value="">Select…</option>
              {(customers?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Order Type</label>
            <select className="erp-input w-full" value={orderType} onChange={(e) => setOrderType(e.target.value as any)} disabled={!editable}>
              {['STOCK', 'SERVICE', 'PROJECT', 'DIRECT'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Warehouse</label>
            <select className="erp-input w-full" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!editable}>
              <option value="">—</option>
              {whOptions.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Order Date</label><input type="date" className="erp-input w-full" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} disabled={!editable} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Requested Date</label><input type="date" className="erp-input w-full" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} disabled={!editable} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Payment Terms</label><input className="erp-input w-full" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} disabled={!editable} /></div>
          {existing?.quotationId && <div className="flex items-end text-xs text-gray-500">From quotation</div>}
          <div className="col-span-4"><label className="block text-xs text-gray-600 mb-1">Notes</label><input className="erp-input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} /></div>
        </div>

        <div className="bg-white border border-gray-200 rounded">
          <div className="flex items-center px-3 py-2 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-700">Lines ({rows.length})</span>
            <div className="flex-1" />
            {editable && <button onClick={() => setRows((r) => [...r, { itemId: '', itemLabel: '', uomId: '', orderedQty: 1, unitPrice: 0, minPrice: null, discountPct: 0 }])} className="toolbar-btn"><Plus size={13} /><span>Add line</span></button>}
          </div>
          {rows.length === 0 ? <div className="p-4 text-xs text-gray-400">No lines.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-1">Item</th><th className="px-2 py-1 w-16">UOM</th><th className="px-2 py-1 w-16">Qty</th>
                <th className="px-2 py-1 w-24">Unit Price</th><th className="px-2 py-1 w-16">Disc %</th><th className="px-2 py-1 w-24 text-right">Net</th>
                {isEdit && <th className="px-2 py-1 w-24 text-right">ATP</th>}<th className="w-8" />
              </tr></thead>
              <tbody>
                {rows.map((row, i) => {
                  const net = row.orderedQty * row.unitPrice * (1 - row.discountPct / 100);
                  const below = row.minPrice != null && row.unitPrice < row.minPrice;
                  const atp = row.lineId != null ? atpByLine[row.lineId] : undefined;
                  const short = atp != null && row.orderedQty > atp;
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-2 py-1">
                        <select className="erp-input w-52" value={row.itemId} onChange={(e) => { const it = itemOptions.find((o) => o.id === e.target.value); upd(i, { itemId: e.target.value, itemLabel: it ? `${it.code} — ${it.description}` : '' }); if (row.uomId) prefill(i, e.target.value, row.uomId); }} disabled={!editable}>
                          <option value="">Select…</option>{itemOptions.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.description}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1"><select className="erp-input w-14" value={row.uomId} onChange={(e) => { upd(i, { uomId: e.target.value }); if (row.itemId) prefill(i, row.itemId, e.target.value); }} disabled={!editable}><option value="">—</option>{uomOptions.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</select></td>
                      <td className="px-2 py-1"><input type="number" className="erp-input w-14" value={row.orderedQty} onChange={(e) => upd(i, { orderedQty: Number(e.target.value) })} disabled={!editable} /></td>
                      <td className="px-2 py-1"><input type="number" className={`erp-input w-20 ${below ? 'border-amber-400 bg-amber-50' : ''}`} value={row.unitPrice} onChange={(e) => upd(i, { unitPrice: Number(e.target.value) })} disabled={!editable} title={below ? `Below minimum ${row.minPrice}` : ''} /></td>
                      <td className="px-2 py-1"><input type="number" className="erp-input w-14" value={row.discountPct} onChange={(e) => upd(i, { discountPct: Number(e.target.value) })} disabled={!editable} /></td>
                      <td className="px-2 py-1 text-right tabular-nums">{net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      {isEdit && <td className={`px-2 py-1 text-right tabular-nums ${short ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{atp != null ? atp : '—'}</td>}
                      <td className="px-2 py-1">{editable && <button onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="flex justify-end gap-6 px-4 py-2 border-t border-gray-200 text-sm">
            <div className="text-gray-500">Sub-total: <span className="text-gray-800 font-medium tabular-nums">{totals.sub.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="text-gray-500">Discount: <span className="text-gray-800 font-medium tabular-nums">{totals.disc.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="text-gray-500">Net: <span className="text-[#1F4E79] font-semibold tabular-nums">{totals.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
