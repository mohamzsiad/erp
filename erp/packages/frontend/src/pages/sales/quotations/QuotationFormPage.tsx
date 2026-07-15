import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Send, Copy, ShoppingCart, Loader2 } from 'lucide-react';
import { useQuotation, useCreateQuotation, useUpdateQuotation, quotationApi, type UpsertQuotationInput } from '../../../api/salesDocs';
import { useCustomerList, priceListApi } from '../../../api/sales';
import { useItemList, useUoms } from '../../../api/inventory';

interface LineRow {
  itemId: string; itemLabel: string; uomId: string; qty: number; unitPrice: number; minPrice: number | null; discountPct: number;
}

export default function QuotationFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading } = useQuotation(id);
  const createMut = useCreateQuotation();
  const updateMut = useUpdateQuotation(id ?? '');
  const { data: customers } = useCustomerList({ limit: 200 });
  const { data: itemsResp } = useItemList({ limit: 200 });
  const { data: uomsResp } = useUoms();
  const itemOptions = (((itemsResp as any)?.data ?? []) as Array<{ id: string; code: string; description: string }>);
  const uomOptions = (((uomsResp as any)?.data ?? (uomsResp as any) ?? []) as Array<{ id: string; code: string }>);

  const [customerId, setCustomerId] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<LineRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const status = existing?.status ?? 'DRAFT';
  const readOnly = isEdit && !['DRAFT', 'SENT'].includes(status);

  useEffect(() => {
    if (!existing) return;
    setCustomerId(existing.customerId);
    setQuotationDate(existing.quotationDate ? existing.quotationDate.slice(0, 10) : '');
    setValidTo(existing.validTo ? existing.validTo.slice(0, 10) : '');
    setPaymentTerms(existing.paymentTerms ?? '');
    setNotes(existing.notes ?? '');
    setRows((existing.lines ?? []).map((l: any) => ({
      itemId: l.itemId, itemLabel: l.item ? `${l.item.code} — ${l.item.description}` : l.itemId,
      uomId: l.uomId, qty: Number(l.qty), unitPrice: Number(l.unitPrice), minPrice: null, discountPct: Number(l.discountPct),
    })));
  }, [existing]);

  const upd = (i: number, patch: Partial<LineRow>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const prefillPrice = async (i: number, itemId: string, uomId: string) => {
    if (!itemId || !uomId) return;
    try {
      const res = await priceListApi.lookup({ itemId, uomId, customerId: customerId || undefined, date: quotationDate });
      upd(i, { unitPrice: res.unitPrice ?? 0, minPrice: res.minPrice });
    } catch { /* ignore lookup failure */ }
  };

  const totals = useMemo(() => {
    let sub = 0, disc = 0;
    rows.forEach((r) => { const g = r.qty * r.unitPrice; sub += g; disc += g * (r.discountPct / 100); });
    return { sub, disc, net: sub - disc };
  }, [rows]);

  const payload = (): UpsertQuotationInput => ({
    customerId,
    quotationDate,
    validTo: validTo || null,
    paymentTerms: paymentTerms || null,
    notes: notes || null,
    lines: rows.filter((r) => r.itemId && r.uomId).map((r) => ({
      itemId: r.itemId, uomId: r.uomId, qty: Number(r.qty) || 0, unitPrice: Number(r.unitPrice) || 0, discountPct: Number(r.discountPct) || 0,
    })),
  });

  const save = async () => {
    setError(null); setWarnings([]);
    if (!customerId) { setError('Select a customer'); return; }
    if (payload().lines.length === 0) { setError('Add at least one line'); return; }
    try {
      const res = isEdit ? await updateMut.mutateAsync(payload()) : await createMut.mutateAsync(payload());
      if (res?.warnings?.length) { setWarnings(res.warnings); }
      else navigate('/sales/quotations');
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Save failed'); }
  };

  const doAction = async (fn: () => Promise<any>, thenNav = true) => {
    setError(null);
    try { const r = await fn(); if (thenNav) navigate('/sales/quotations'); return r; }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Action failed'); }
  };

  const saving = createMut.isPending || updateMut.isPending;
  if (isEdit && isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#1F4E79]" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <button onClick={() => navigate('/sales/quotations')} className="toolbar-btn"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">{isEdit ? `Quotation ${existing?.docNo ?? ''} · Rev ${existing?.rev ?? 0} · ${status}` : 'New Quotation'}</h2>
        <div className="flex-1" />
        {isEdit && status === 'DRAFT' && <button onClick={() => doAction(() => quotationApi.send(id!))} className="toolbar-btn"><Send size={13} /><span>Send</span></button>}
        {isEdit && ['SENT', 'DRAFT'].includes(status) && <button onClick={() => doAction(() => quotationApi.setStatus(id!, 'ACCEPTED'))} className="toolbar-btn">Mark Accepted</button>}
        {isEdit && status === 'ACCEPTED' && <button onClick={() => doAction(async () => { const o = await quotationApi.convertToOrder(id!); navigate(`/sales/orders/${o.orderId}`); }, false)} className="toolbar-btn"><ShoppingCart size={13} /><span>Convert to Order</span></button>}
        {isEdit && <button onClick={() => doAction(async () => { const q = await quotationApi.revise(id!); navigate(`/sales/quotations/${q.id}`); }, false)} className="toolbar-btn"><Copy size={13} /><span>Revise</span></button>}
        {!readOnly && <button onClick={save} disabled={saving} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save</span></button>}
      </div>
      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}
      {warnings.length > 0 && (
        <div className="mx-4 mt-3 px-3 py-2 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded">
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
          <button onClick={() => navigate('/sales/quotations')} className="mt-1 underline">Continue to list</button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-4 gap-4">
          <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Customer *</label>
            <select className="erp-input w-full" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={readOnly}>
              <option value="">Select…</option>
              {(customers?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Date</label><input type="date" className="erp-input w-full" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} disabled={readOnly} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Valid To</label><input type="date" className="erp-input w-full" value={validTo} onChange={(e) => setValidTo(e.target.value)} disabled={readOnly} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Payment Terms</label><input className="erp-input w-full" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} disabled={readOnly} /></div>
          <div className="col-span-3"><label className="block text-xs text-gray-600 mb-1">Notes</label><input className="erp-input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} /></div>
        </div>

        <div className="bg-white border border-gray-200 rounded">
          <div className="flex items-center px-3 py-2 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-700">Lines ({rows.length})</span>
            <div className="flex-1" />
            {!readOnly && <button onClick={() => setRows((r) => [...r, { itemId: '', itemLabel: '', uomId: '', qty: 1, unitPrice: 0, minPrice: null, discountPct: 0 }])} className="toolbar-btn"><Plus size={13} /><span>Add line</span></button>}
          </div>
          {rows.length === 0 ? <div className="p-4 text-xs text-gray-400">No lines.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-1">Item</th><th className="px-2 py-1 w-20">UOM</th><th className="px-2 py-1 w-20">Qty</th><th className="px-2 py-1 w-28">Unit Price</th><th className="px-2 py-1 w-20">Disc %</th><th className="px-2 py-1 w-28 text-right">Net</th><th className="w-10" />
              </tr></thead>
              <tbody>
                {rows.map((row, i) => {
                  const net = row.qty * row.unitPrice * (1 - row.discountPct / 100);
                  const below = row.minPrice != null && row.unitPrice < row.minPrice;
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-2 py-1">
                        <select className="erp-input w-52" value={row.itemId} onChange={(e) => { const it = itemOptions.find((o) => o.id === e.target.value); upd(i, { itemId: e.target.value, itemLabel: it ? `${it.code} — ${it.description}` : '' }); if (row.uomId) prefillPrice(i, e.target.value, row.uomId); }} disabled={readOnly}>
                          <option value="">Select…</option>
                          {itemOptions.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.description}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1"><select className="erp-input w-16" value={row.uomId} onChange={(e) => { upd(i, { uomId: e.target.value }); if (row.itemId) prefillPrice(i, row.itemId, e.target.value); }} disabled={readOnly}><option value="">—</option>{uomOptions.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</select></td>
                      <td className="px-2 py-1"><input type="number" className="erp-input w-16" value={row.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} disabled={readOnly} /></td>
                      <td className="px-2 py-1">
                        <input type="number" className={`erp-input w-24 ${below ? 'border-amber-400 bg-amber-50' : ''}`} value={row.unitPrice} onChange={(e) => upd(i, { unitPrice: Number(e.target.value) })} disabled={readOnly} title={below ? `Below minimum ${row.minPrice}` : ''} />
                      </td>
                      <td className="px-2 py-1"><input type="number" className="erp-input w-16" value={row.discountPct} onChange={(e) => upd(i, { discountPct: Number(e.target.value) })} disabled={readOnly} /></td>
                      <td className="px-2 py-1 text-right tabular-nums">{net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1">{!readOnly && <button onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>}</td>
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
          <div className="px-4 pb-3 text-[11px] text-gray-400">Tax is applied on the server from each line's tax code; the totals above are pre-tax.</div>
        </div>
      </div>
    </div>
  );
}
