import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, ThumbsUp, PackageCheck, Lock, Loader2 } from 'lucide-react';
import {
  useReturn, useCreateReturn, returnApi, invoiceApi, useInvoices,
  type UpsertReturnInput,
} from '../../../api/salesDocs';

interface LineRow { itemId: string; itemLabel: string; uomId: string; delivered: number; qty: number; }

export default function ReturnFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading, refetch } = useReturn(id);
  const createMut = useCreateReturn();
  const { data: invoices } = useInvoices({ status: 'POSTED' });

  const [invoiceId, setInvoiceId] = useState('');
  const [salesInvoiceId, setSalesInvoiceId] = useState<string | null>(null);
  const [deliveryNoteId, setDeliveryNoteId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState<LineRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const status = existing?.status ?? 'DRAFT';

  useEffect(() => {
    if (!existing) return;
    setReason(existing.reason ?? '');
    setReturnDate(existing.returnDate ? existing.returnDate.slice(0, 10) : '');
    setRows((existing.lines ?? []).map((l: any) => ({
      itemId: l.itemId, itemLabel: l.item ? `${l.item.code} — ${l.item.description}` : l.itemId, uomId: l.uomId, delivered: 0, qty: Number(l.qty),
    })));
  }, [existing]);

  const loadInvoice = async (iid: string) => {
    setInvoiceId(iid); setError(null);
    if (!iid) { setRows([]); return; }
    try {
      const inv = await invoiceApi.getById(iid);
      setSalesInvoiceId(inv.id); setDeliveryNoteId(inv.deliveryNoteId ?? null); setCustomerId(inv.customerId);
      setRows((inv.lines ?? []).map((l: any) => ({
        itemId: l.itemId, itemLabel: l.item ? `${l.item.code} — ${l.item.description}` : l.itemId, uomId: l.uomId, delivered: Number(l.qty), qty: 0,
      })));
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to load invoice'); }
  };

  const upd = (i: number, qty: number) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, qty } : row)));

  const save = async () => {
    setError(null);
    const lines = rows.filter((r) => r.qty > 0);
    if (!lines.length) { setError('Enter at least one return quantity'); return; }
    const payload: UpsertReturnInput = {
      salesInvoiceId, deliveryNoteId, customerId, returnDate, reason: reason || null,
      lines: lines.map((r) => ({ itemId: r.itemId, uomId: r.uomId, qty: Number(r.qty) })),
    };
    try { const rec = await createMut.mutateAsync(payload); navigate(`/sales/returns/${rec.id}`); }
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
        <button onClick={() => navigate('/sales/returns')} className="toolbar-btn"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">{isEdit ? `Return ${existing?.docNo ?? ''} · ${status}` : 'New Return'}</h2>
        <div className="flex-1" />
        {isEdit && status === 'DRAFT' && <button onClick={() => runAction(() => returnApi.approve(id!))} className="toolbar-btn"><ThumbsUp size={13} /><span>Approve</span></button>}
        {isEdit && status === 'APPROVED' && <button onClick={() => runAction(() => returnApi.receive(id!))} className="toolbar-btn"><PackageCheck size={13} /><span>Receive stock</span></button>}
        {isEdit && status === 'RECEIVED' && <button onClick={() => runAction(() => returnApi.close(id!))} className="toolbar-btn"><Lock size={13} /><span>Close</span></button>}
        {!isEdit && <button onClick={save} disabled={createMut.isPending} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">{createMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save Draft</span></button>}
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}
      {banner && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-blue-50 text-[#1F4E79] border border-blue-200 rounded">{banner}</div>}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-4 gap-4">
          {!isEdit && (
            <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Original Invoice *</label>
              <select className="erp-input w-full" value={invoiceId} onChange={(e) => loadInvoice(e.target.value)}>
                <option value="">Select posted invoice…</option>
                {(invoices?.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.docNo} — {i.customerName}</option>)}
              </select>
            </div>
          )}
          <div><label className="block text-xs text-gray-600 mb-1">Return Date</label><input type="date" className="erp-input w-full" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} disabled={isEdit} /></div>
          <div className="col-span-3"><label className="block text-xs text-gray-600 mb-1">Reason</label><input className="erp-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} disabled={isEdit} /></div>
        </div>

        <div className="bg-white border border-gray-200 rounded">
          <div className="px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-700">Lines ({rows.length})</div>
          {rows.length === 0 ? <div className="p-4 text-xs text-gray-400">{isEdit ? 'No lines.' : 'Select an invoice to load returnable items.'}</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-1">Item</th>{!isEdit && <th className="px-2 py-1 w-32 text-right">Invoiced</th>}<th className="px-2 py-1 w-32">Return Qty</th>
              </tr></thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-2 py-1">{row.itemLabel}</td>
                    {!isEdit && <td className="px-2 py-1 text-right tabular-nums text-gray-500">{row.delivered}</td>}
                    <td className="px-2 py-1">
                      <input type="number" className="erp-input w-28" value={row.qty} max={isEdit ? undefined : row.delivered} disabled={isEdit}
                        onChange={(e) => upd(i, Math.min(Number(e.target.value), isEdit ? Infinity : row.delivered))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
