import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, CheckCircle, XCircle, Printer, FileUp, Loader2 } from 'lucide-react';
import {
  useInvoice, useCreateInvoice, invoiceApi, useDeliveries,
  type UpsertInvoiceInput,
} from '../../../api/salesDocs';
import { useCustomerList } from '../../../api/sales';
import { useItemList, useUoms } from '../../../api/inventory';

interface LineRow { itemId: string; itemLabel: string; uomId: string; qty: number; unitPrice: number; discountPct: number; }
const money = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2 });

export default function InvoiceFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading, refetch } = useInvoice(id);
  const createMut = useCreateInvoice();
  const { data: customers } = useCustomerList({ limit: 200 });
  const { data: itemsResp } = useItemList({ limit: 200 });
  const { data: uomsResp } = useUoms();
  const { data: deliveries } = useDeliveries({});
  const itemOptions = (((itemsResp as any)?.data ?? []) as Array<{ id: string; code: string; description: string }>);
  const uomOptions = (((uomsResp as any)?.data ?? (uomsResp as any) ?? []) as Array<{ id: string; code: string }>);
  const openDeliveries = (deliveries?.data ?? []).filter((d) => ['DISPATCHED', 'DELIVERED'].includes(d.status));

  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<LineRow[]>([]);
  const [deliveryId, setDeliveryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const status = existing?.status ?? 'DRAFT';

  useEffect(() => {
    if (!existing) return;
    setCustomerId(existing.customerId);
    setInvoiceDate(existing.invoiceDate ? existing.invoiceDate.slice(0, 10) : '');
    setDueDate(existing.dueDate ? existing.dueDate.slice(0, 10) : '');
    setDescription(existing.description ?? '');
    setRows((existing.lines ?? []).map((l: any) => ({
      itemId: l.itemId, itemLabel: l.item ? `${l.item.code} — ${l.item.description}` : l.itemId,
      uomId: l.uomId, qty: Number(l.qty), unitPrice: Number(l.unitPrice), discountPct: Number(l.discountPct),
    })));
  }, [existing]);

  const upd = (i: number, patch: Partial<LineRow>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const totals = useMemo(() => {
    let sub = 0, disc = 0;
    rows.forEach((r) => { const g = r.qty * r.unitPrice; sub += g; disc += g * (r.discountPct / 100); });
    return { sub, disc, net: sub - disc };
  }, [rows]);

  const taxSummary = useMemo(() => {
    // from persisted invoice lines (server-computed tax by code/rate)
    const m: Record<string, { rate: number; net: number; tax: number }> = {};
    (existing?.lines ?? []).forEach((l: any) => {
      const rate = l.taxCode?.rate != null ? Number(l.taxCode.rate) : 0;
      const key = String(rate);
      if (!m[key]) m[key] = { rate, net: 0, tax: 0 };
      m[key].net += Number(l.netAmount); m[key].tax += Number(l.taxAmount);
    });
    return Object.values(m);
  }, [existing]);

  const createFromDelivery = async () => {
    if (!deliveryId) return;
    setError(null);
    try { const inv = await invoiceApi.createFromDelivery(deliveryId); navigate(`/sales/invoices/${inv.id}`); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to create from delivery'); }
  };

  const saveManual = async () => {
    setError(null);
    if (!customerId) { setError('Select a customer'); return; }
    const lines = rows.filter((r) => r.itemId && r.uomId && r.qty > 0);
    if (!lines.length) { setError('Add at least one line'); return; }
    const payload: UpsertInvoiceInput = {
      customerId, invoiceDate, dueDate: dueDate || null, description: description || null,
      lines: lines.map((r) => ({ itemId: r.itemId, uomId: r.uomId, qty: Number(r.qty), unitPrice: Number(r.unitPrice), discountPct: Number(r.discountPct) })),
    };
    try { const inv = await createMut.mutateAsync(payload); navigate(`/sales/invoices/${inv.id}`); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Save failed'); }
  };

  const runAction = async (fn: () => Promise<any>) => {
    setError(null); setBanner(null);
    try { const r = await fn(); setBanner(`Status: ${r.status}`); refetch(); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Action failed'); }
  };

  if (isEdit && isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#1F4E79]" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
        <button onClick={() => navigate('/sales/invoices')} className="toolbar-btn"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">{isEdit ? `Invoice ${existing?.docNo ?? ''} · ${status}` : 'New Invoice'}</h2>
        <div className="flex-1" />
        {isEdit && status === 'DRAFT' && <button onClick={() => runAction(() => invoiceApi.post(id!))} className="toolbar-btn"><CheckCircle size={13} /><span>Post</span></button>}
        {isEdit && status === 'POSTED' && <button onClick={() => runAction(() => invoiceApi.cancel(id!))} className="toolbar-btn"><XCircle size={13} /><span>Cancel</span></button>}
        {isEdit && <button onClick={() => window.print()} className="toolbar-btn"><Printer size={13} /><span>Print</span></button>}
        {!isEdit && <button onClick={saveManual} disabled={createMut.isPending} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">{createMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save Draft</span></button>}
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}
      {banner && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-blue-50 text-[#1F4E79] border border-blue-200 rounded">{banner}</div>}
      {isEdit && existing?.journalId && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-green-50 text-green-800 border border-green-200 rounded">Posted to AR &amp; GL — journal linked.</div>}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        {!isEdit && (
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="text-xs font-semibold text-gray-700 mb-2">Create from a dispatched delivery</div>
            <div className="flex items-end gap-2">
              <select className="erp-input w-80" value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
                <option value="">Select delivery note…</option>
                {openDeliveries.map((d) => <option key={d.id} value={d.id}>{d.docNo} — {d.customerName}</option>)}
              </select>
              <button onClick={createFromDelivery} className="toolbar-btn"><FileUp size={13} /><span>Create from delivery</span></button>
              <span className="text-xs text-gray-400">— or build a manual invoice below —</span>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-4 gap-4">
          <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Customer *</label>
            <select className="erp-input w-full" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={isEdit}>
              <option value="">Select…</option>
              {(customers?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Invoice Date</label><input type="date" className="erp-input w-full" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} disabled={isEdit} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Due Date</label><input type="date" className="erp-input w-full" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isEdit} /></div>
          <div className="col-span-4"><label className="block text-xs text-gray-600 mb-1">Description</label><input className="erp-input w-full" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isEdit} /></div>
        </div>

        <div className="bg-white border border-gray-200 rounded">
          <div className="flex items-center px-3 py-2 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-700">Lines ({rows.length})</span>
            <div className="flex-1" />
            {!isEdit && <button onClick={() => setRows((r) => [...r, { itemId: '', itemLabel: '', uomId: '', qty: 1, unitPrice: 0, discountPct: 0 }])} className="toolbar-btn"><Plus size={13} /><span>Add line</span></button>}
          </div>
          {rows.length === 0 ? <div className="p-4 text-xs text-gray-400">No lines.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-1">Item</th><th className="px-2 py-1 w-16">UOM</th><th className="px-2 py-1 w-16">Qty</th>
                <th className="px-2 py-1 w-24">Unit Price</th><th className="px-2 py-1 w-16">Disc %</th><th className="px-2 py-1 w-24 text-right">Net</th>
              </tr></thead>
              <tbody>
                {rows.map((row, i) => {
                  const net = row.qty * row.unitPrice * (1 - row.discountPct / 100);
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-2 py-1">
                        {isEdit ? row.itemLabel : (
                          <select className="erp-input w-52" value={row.itemId} onChange={(e) => { const it = itemOptions.find((o) => o.id === e.target.value); upd(i, { itemId: e.target.value, itemLabel: it ? `${it.code} — ${it.description}` : '' }); }}>
                            <option value="">Select…</option>{itemOptions.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.description}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-1">{isEdit ? '' : <select className="erp-input w-16" value={row.uomId} onChange={(e) => upd(i, { uomId: e.target.value })}><option value="">—</option>{uomOptions.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</select>}</td>
                      <td className="px-2 py-1">{isEdit ? row.qty : <input type="number" className="erp-input w-16" value={row.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} />}</td>
                      <td className="px-2 py-1">{isEdit ? money(row.unitPrice) : <input type="number" className="erp-input w-20" value={row.unitPrice} onChange={(e) => upd(i, { unitPrice: Number(e.target.value) })} />}</td>
                      <td className="px-2 py-1">{isEdit ? row.discountPct : <input type="number" className="erp-input w-14" value={row.discountPct} onChange={(e) => upd(i, { discountPct: Number(e.target.value) })} />}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{money(net)}</td>
                      {!isEdit && <td className="px-2 py-1"><button onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="flex justify-end px-4 py-3 border-t border-gray-200">
            {isEdit ? (
              <div className="w-72 text-sm space-y-1">
                {taxSummary.map((t) => (
                  <div key={t.rate} className="flex justify-between text-gray-500"><span>VAT {t.rate}%</span><span className="tabular-nums">{money(t.tax)}</span></div>
                ))}
                <div className="flex justify-between text-gray-500"><span>Net</span><span className="tabular-nums">{money(Number(existing?.amount ?? 0))}</span></div>
                <div className="flex justify-between text-gray-500"><span>VAT</span><span className="tabular-nums">{money(Number(existing?.taxAmount ?? 0))}</span></div>
                <div className="flex justify-between font-semibold text-[#1F4E79] border-t border-gray-100 pt-1"><span>Total</span><span className="tabular-nums">{money(Number(existing?.totalAmount ?? 0))}</span></div>
              </div>
            ) : (
              <div className="flex gap-6 text-sm">
                <div className="text-gray-500">Sub-total: <span className="text-gray-800 font-medium tabular-nums">{money(totals.sub)}</span></div>
                <div className="text-gray-500">Discount: <span className="text-gray-800 font-medium tabular-nums">{money(totals.disc)}</span></div>
                <div className="text-gray-500">Net: <span className="text-[#1F4E79] font-semibold tabular-nums">{money(totals.net)}</span></div>
              </div>
            )}
          </div>
          {!isEdit && <div className="px-4 pb-3 text-[11px] text-gray-400">VAT is applied on the server from each line's tax code; posting creates the AR invoice + GL journal.</div>}
        </div>
      </div>
    </div>
  );
}
