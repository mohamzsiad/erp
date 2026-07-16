import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, CheckCircle, XCircle, Printer, FileUp, Loader2 } from 'lucide-react';
import { useCreditNote, creditNoteApi, useReturns } from '../../../api/salesDocs';

const money = (v: number) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 });

export default function CreditNoteFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: cn, isLoading, refetch } = useCreditNote(id);
  const { data: returns } = useReturns({ status: 'RECEIVED' });

  const [returnId, setReturnId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const status = cn?.status ?? 'DRAFT';

  useEffect(() => { setError(null); }, [id]);

  const createFromReturn = async () => {
    if (!returnId) return;
    setError(null);
    try { const created = await creditNoteApi.createFromReturn(returnId); navigate(`/sales/credit-notes/${created.id}`); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to create from return'); }
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
        <button onClick={() => navigate('/sales/credit-notes')} className="toolbar-btn"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">{isEdit ? `Credit Note ${cn?.docNo ?? ''} · ${status}` : 'New Credit Note'}</h2>
        <div className="flex-1" />
        {isEdit && status === 'DRAFT' && <button onClick={() => runAction(() => creditNoteApi.approve(id!))} className="toolbar-btn"><ThumbsUp size={13} /><span>Approve</span></button>}
        {isEdit && status === 'APPROVED' && <button onClick={() => runAction(() => creditNoteApi.post(id!))} className="toolbar-btn"><CheckCircle size={13} /><span>Post</span></button>}
        {isEdit && ['DRAFT', 'APPROVED'].includes(status) && <button onClick={() => runAction(() => creditNoteApi.cancel(id!))} className="toolbar-btn"><XCircle size={13} /><span>Cancel</span></button>}
        {isEdit && <button onClick={() => window.print()} className="toolbar-btn"><Printer size={13} /><span>Print</span></button>}
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}
      {banner && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-blue-50 text-[#1F4E79] border border-blue-200 rounded">{banner}</div>}
      {isEdit && cn?.journalId && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-green-50 text-green-800 border border-green-200 rounded">Posted — receivable reduced, revenue/VAT reversed in the GL.</div>}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        {!isEdit && (
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="text-xs font-semibold text-gray-700 mb-2">Create from a received return</div>
            <div className="flex items-end gap-2">
              <select className="erp-input w-80" value={returnId} onChange={(e) => setReturnId(e.target.value)}>
                <option value="">Select received return…</option>
                {(returns?.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.docNo}</option>)}
              </select>
              <button onClick={createFromReturn} className="toolbar-btn"><FileUp size={13} /><span>Create from return</span></button>
            </div>
            <div className="mt-2 text-[11px] text-gray-400">The credit note is priced from the return's original invoice and posts as the reversal of that invoice.</div>
          </div>
        )}

        {isEdit && cn && (
          <>
            <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-4 gap-4 text-sm">
              <div><div className="text-xs text-gray-500">Customer</div><div className="text-gray-800">{cn.customer?.code} — {cn.customer?.name}</div></div>
              <div><div className="text-xs text-gray-500">Credit Date</div><div className="text-gray-800">{cn.creditDate?.slice(0, 10)}</div></div>
              <div className="col-span-2"><div className="text-xs text-gray-500">Reason</div><div className="text-gray-800">{cn.reason ?? '—'}</div></div>
            </div>
            <div className="bg-white border border-gray-200 rounded">
              <div className="px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-700">Lines ({cn.lines?.length ?? 0})</div>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-2 py-1">Item</th><th className="px-2 py-1 w-16">Qty</th><th className="px-2 py-1 w-24">Unit Price</th><th className="px-2 py-1 w-24 text-right">Net</th><th className="px-2 py-1 w-24 text-right">VAT</th>
                </tr></thead>
                <tbody>
                  {(cn.lines ?? []).map((l: any) => (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="px-2 py-1">{l.item ? `${l.item.code} — ${l.item.description}` : l.itemId}</td>
                      <td className="px-2 py-1 tabular-nums">{Number(l.qty)}</td>
                      <td className="px-2 py-1 tabular-nums">{money(Number(l.unitPrice))}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{money(Number(l.netAmount))}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{money(Number(l.taxAmount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end px-4 py-3 border-t border-gray-200">
                <div className="w-64 text-sm space-y-1">
                  <div className="flex justify-between text-gray-500"><span>Net</span><span className="tabular-nums">{money(cn.amount)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>VAT</span><span className="tabular-nums">{money(cn.taxAmount)}</span></div>
                  <div className="flex justify-between font-semibold text-[#1F4E79] border-t border-gray-100 pt-1"><span>Total credit</span><span className="tabular-nums">{money(cn.totalAmount)}</span></div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
