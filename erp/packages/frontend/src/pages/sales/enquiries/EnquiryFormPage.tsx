import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, FileUp, Loader2 } from 'lucide-react';
import { useEnquiry, useCreateEnquiry, useUpdateEnquiry, enquiryApi, type UpsertEnquiryInput } from '../../../api/salesDocs';
import { useCustomerList } from '../../../api/sales';
import { useItemList, useUoms } from '../../../api/inventory';

interface LineRow { itemId: string; itemLabel: string; uomId: string; qty: number; targetPrice: number | ''; }

export default function EnquiryFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading } = useEnquiry(id);
  const createMut = useCreateEnquiry();
  const updateMut = useUpdateEnquiry(id ?? '');
  const { data: customers } = useCustomerList({ limit: 200 });
  const { data: itemsResp } = useItemList({ limit: 200 });
  const { data: uomsResp } = useUoms();
  const itemOptions = (((itemsResp as any)?.data ?? []) as Array<{ id: string; code: string; description: string }>);
  const uomOptions = (((uomsResp as any)?.data ?? (uomsResp as any) ?? []) as Array<{ id: string; code: string }>);

  const [customerId, setCustomerId] = useState('');
  const [prospectName, setProspectName] = useState('');
  const [enquiryDate, setEnquiryDate] = useState(new Date().toISOString().slice(0, 10));
  const [requiredByDate, setRequiredByDate] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<LineRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const status = existing?.status ?? 'OPEN';
  const readOnly = isEdit && status !== 'OPEN';

  useEffect(() => {
    if (!existing) return;
    setCustomerId(existing.customerId ?? '');
    setProspectName(existing.prospectName ?? '');
    setEnquiryDate(existing.enquiryDate ? existing.enquiryDate.slice(0, 10) : '');
    setRequiredByDate(existing.requiredByDate ? existing.requiredByDate.slice(0, 10) : '');
    setSource(existing.source ?? '');
    setNotes(existing.notes ?? '');
    setRows((existing.lines ?? []).map((l: any) => ({
      itemId: l.itemId, itemLabel: l.item ? `${l.item.code} — ${l.item.description}` : l.itemId,
      uomId: l.uomId, qty: Number(l.qty), targetPrice: l.targetPrice != null ? Number(l.targetPrice) : '',
    })));
  }, [existing]);

  const addRow = () => setRows((r) => [...r, { itemId: '', itemLabel: '', uomId: '', qty: 1, targetPrice: '' }]);
  const upd = (i: number, patch: Partial<LineRow>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const payload = (): UpsertEnquiryInput => ({
    customerId: customerId || null,
    prospectName: prospectName || null,
    enquiryDate,
    requiredByDate: requiredByDate || null,
    source: source || null,
    notes: notes || null,
    lines: rows.filter((r) => r.itemId && r.uomId).map((r) => ({
      itemId: r.itemId, uomId: r.uomId, qty: Number(r.qty) || 0, targetPrice: r.targetPrice === '' ? null : Number(r.targetPrice),
    })),
  });

  const save = async () => {
    setError(null);
    if (!customerId && !prospectName.trim()) { setError('Pick a customer or enter a prospect name'); return; }
    try {
      if (isEdit) await updateMut.mutateAsync(payload());
      else await createMut.mutateAsync(payload());
      navigate('/sales/enquiries');
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Save failed'); }
  };

  const convert = async () => {
    if (!id) return;
    try {
      const q = await enquiryApi.convert(id);
      navigate(`/sales/quotations/${q.id}`);
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Convert failed'); }
  };

  const saving = createMut.isPending || updateMut.isPending;
  if (isEdit && isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#1F4E79]" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <button onClick={() => navigate('/sales/enquiries')} className="toolbar-btn"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">{isEdit ? `Enquiry ${existing?.docNo ?? ''} · ${status}` : 'New Enquiry'}</h2>
        <div className="flex-1" />
        {isEdit && status === 'OPEN' && <button onClick={convert} className="toolbar-btn"><FileUp size={13} /><span>Convert to Quotation</span></button>}
        {!readOnly && (
          <button onClick={save} disabled={saving} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save</span>
          </button>
        )}
      </div>
      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-3 gap-4">
          <div><label className="block text-xs text-gray-600 mb-1">Customer</label>
            <select className="erp-input w-full" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={readOnly}>
              <option value="">— prospect —</option>
              {(customers?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Prospect Name</label><input className="erp-input w-full" value={prospectName} onChange={(e) => setProspectName(e.target.value)} disabled={readOnly || !!customerId} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Source</label><input className="erp-input w-full" value={source} onChange={(e) => setSource(e.target.value)} disabled={readOnly} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Enquiry Date</label><input type="date" className="erp-input w-full" value={enquiryDate} onChange={(e) => setEnquiryDate(e.target.value)} disabled={readOnly} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Required By</label><input type="date" className="erp-input w-full" value={requiredByDate} onChange={(e) => setRequiredByDate(e.target.value)} disabled={readOnly} /></div>
          <div className="col-span-3"><label className="block text-xs text-gray-600 mb-1">Notes</label><textarea className="erp-input w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} /></div>
        </div>

        <div className="bg-white border border-gray-200 rounded">
          <div className="flex items-center px-3 py-2 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-700">Lines ({rows.length})</span>
            <div className="flex-1" />
            {!readOnly && <button onClick={addRow} className="toolbar-btn"><Plus size={13} /><span>Add line</span></button>}
          </div>
          {rows.length === 0 ? <div className="p-4 text-xs text-gray-400">No lines.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-1">Item</th><th className="px-2 py-1 w-24">UOM</th><th className="px-2 py-1 w-24">Qty</th><th className="px-2 py-1 w-32">Target Price</th><th className="w-10" />
              </tr></thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-2 py-1">
                      <select className="erp-input w-56" value={row.itemId} onChange={(e) => { const it = itemOptions.find((o) => o.id === e.target.value); upd(i, { itemId: e.target.value, itemLabel: it ? `${it.code} — ${it.description}` : '' }); }} disabled={readOnly}>
                        <option value="">Select…</option>
                        {itemOptions.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.description}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1"><select className="erp-input w-20" value={row.uomId} onChange={(e) => upd(i, { uomId: e.target.value })} disabled={readOnly}><option value="">—</option>{uomOptions.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</select></td>
                    <td className="px-2 py-1"><input type="number" className="erp-input w-20" value={row.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} disabled={readOnly} /></td>
                    <td className="px-2 py-1"><input type="number" className="erp-input w-28" value={row.targetPrice} onChange={(e) => upd(i, { targetPrice: e.target.value === '' ? '' : Number(e.target.value) })} disabled={readOnly} /></td>
                    <td className="px-2 py-1">{!readOnly && <button onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>}</td>
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
