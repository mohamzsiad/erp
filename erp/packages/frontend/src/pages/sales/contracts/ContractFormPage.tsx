import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { masterLabel } from '@clouderp/shared';
import { ArrowLeft, Save, Plus, Trash2, PlayCircle, GitBranch, Loader2 } from 'lucide-react';
import {
  useContract, useCreateContract, useUpdateContract, contractApi,
  type UpsertContractInput,
} from '../../../api/contracts';
import { useCustomerList } from '../../../api/sales';
import { useUoms } from '../../../api/inventory';

interface BoqRow { id?: string; section: string; subSection: string; itemDescription: string; uomId: string; contractQty: number; rate: number; originalQty?: number | null; }
const money = (v: number) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 });

export default function ContractFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading, refetch } = useContract(id);
  const createMut = useCreateContract();
  const updateMut = useUpdateContract(id ?? '');
  const { data: customers } = useCustomerList({ limit: 200 });
  const { data: uomsResp } = useUoms();
  const uomOptions = (((uomsResp as any)?.data ?? (uomsResp as any) ?? []) as Array<{ id: string; code: string }>);

  const [customerId, setCustomerId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [contractValue, setContractValue] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [rows, setRows] = useState<BoqRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // variation panel state
  const [varLineId, setVarLineId] = useState('');
  const [varDelta, setVarDelta] = useState<number>(0);
  const [varReason, setVarReason] = useState('');

  const status = existing?.status ?? 'DRAFT';
  const editable = !isEdit || status === 'DRAFT';

  useEffect(() => {
    if (!existing) return;
    setCustomerId(existing.customerId);
    setProjectName(existing.projectName ?? '');
    setProjectRef(existing.projectRef ?? '');
    setContractValue(existing.contractValue != null ? Number(existing.contractValue) : '');
    setStartDate(existing.startDate ? existing.startDate.slice(0, 10) : '');
    setEndDate(existing.endDate ? existing.endDate.slice(0, 10) : '');
    setPaymentTerms(existing.paymentTerms ?? '');
    setRows((existing.boqLines ?? []).map((l: any) => ({
      id: l.id, section: l.section ?? '', subSection: l.subSection ?? '', itemDescription: l.itemDescription, uomId: l.uomId ?? '',
      contractQty: Number(l.contractQty), rate: Number(l.rate), originalQty: l.originalQty,
    })));
  }, [existing]);

  const upd = (i: number, patch: Partial<BoqRow>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const summary = useMemo(() => {
    let total = 0; const bySection = new Map<string, number>();
    rows.forEach((r) => { const amt = r.contractQty * r.rate; total += amt; const k = r.section.trim() || 'Ungrouped'; bySection.set(k, (bySection.get(k) ?? 0) + amt); });
    const cv = typeof contractValue === 'number' ? contractValue : 0;
    return { total, sections: [...bySection.entries()], variance: total - cv, matches: Math.abs(total - cv) <= 0.5 };
  }, [rows, contractValue]);

  const payload = (): UpsertContractInput => ({
    customerId, projectName: projectName.trim(), projectRef: projectRef || null,
    contractValue: typeof contractValue === 'number' ? contractValue : undefined,
    startDate: startDate || null, endDate: endDate || null, paymentTerms: paymentTerms || null,
    boqLines: rows.filter((r) => r.itemDescription.trim()).map((r) => ({
      section: r.section || null, subSection: r.subSection || null, itemDescription: r.itemDescription, uomId: r.uomId || null, contractQty: Number(r.contractQty) || 0, rate: Number(r.rate) || 0,
    })),
  });

  const save = async () => {
    setError(null);
    if (!customerId || !projectName.trim()) { setError('Customer and project name are required'); return; }
    try {
      if (isEdit) { await updateMut.mutateAsync(payload()); refetch(); setBanner('Saved.'); }
      else { const c = await createMut.mutateAsync(payload()); navigate(`/sales/contracts/${c.id}`); }
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Save failed'); }
  };

  const runAction = async (fn: () => Promise<any>) => {
    setError(null); setBanner(null);
    try { const r = await fn(); setBanner(`Status: ${r.status ?? 'updated'}`); refetch(); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Action failed'); }
  };

  const applyVariation = async () => {
    if (!id || !varLineId) return;
    await runAction(() => contractApi.applyVariation(id, { reason: varReason || undefined, adjustments: [{ boqLineId: varLineId, deltaQty: Number(varDelta) }] }));
    setVarLineId(''); setVarDelta(0); setVarReason('');
  };

  const saving = createMut.isPending || updateMut.isPending;
  if (isEdit && isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#1F4E79]" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
        <button onClick={() => navigate('/sales/contracts')} className="toolbar-btn"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">{isEdit ? `Contract ${existing?.docNo ?? ''} · ${status}` : 'New Contract'}</h2>
        <div className="flex-1" />
        {isEdit && status === 'DRAFT' && <button onClick={() => runAction(() => contractApi.setStatus(id!, 'ACTIVE'))} className="toolbar-btn"><PlayCircle size={13} /><span>Activate</span></button>}
        {editable && <button onClick={save} disabled={saving} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save</span></button>}
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}
      {banner && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-blue-50 text-[#1F4E79] border border-blue-200 rounded">{banner}</div>}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-4 gap-4">
          <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Customer *</label>
            <select className="erp-input w-full" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={isEdit}>
              <option value="">Select…</option>{(customers?.data ?? []).map((c) => <option key={c.id} value={c.id}>{masterLabel(c.code, c.name)}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Project Ref</label><input className="erp-input w-full" value={projectRef} onChange={(e) => setProjectRef(e.target.value)} disabled={!editable} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Contract Value</label><input type="number" className="erp-input w-full" value={contractValue} onChange={(e) => setContractValue(e.target.value === '' ? '' : Number(e.target.value))} disabled={!editable} /></div>
          <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Project Name *</label><input className="erp-input w-full" value={projectName} onChange={(e) => setProjectName(e.target.value)} disabled={!editable} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Start</label><input type="date" className="erp-input w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!editable} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">End</label><input type="date" className="erp-input w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!editable} /></div>
          <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Payment Terms</label><input className="erp-input w-full" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} disabled={!editable} /></div>
        </div>

        <div className="bg-white border border-gray-200 rounded">
          <div className="flex items-center px-3 py-2 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-700">Bill of Quantities ({rows.length})</span>
            <div className="flex-1" />
            {editable && <button onClick={() => setRows((r) => [...r, { section: '', subSection: '', itemDescription: '', uomId: '', contractQty: 1, rate: 0 }])} className="toolbar-btn"><Plus size={13} /><span>Add line</span></button>}
          </div>
          {rows.length === 0 ? <div className="p-4 text-xs text-gray-400">No BOQ lines.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-1 w-28">Section</th><th className="px-2 py-1">Description</th><th className="px-2 py-1 w-16">UOM</th>
                <th className="px-2 py-1 w-20">Qty</th><th className="px-2 py-1 w-24">Rate</th><th className="px-2 py-1 w-28 text-right">Amount</th>{editable && <th className="w-8" />}
              </tr></thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-2 py-1">{editable ? <input className="erp-input w-24" value={row.section} onChange={(e) => upd(i, { section: e.target.value })} /> : row.section}</td>
                    <td className="px-2 py-1">{editable ? <input className="erp-input w-full" value={row.itemDescription} onChange={(e) => upd(i, { itemDescription: e.target.value })} /> : row.itemDescription}</td>
                    <td className="px-2 py-1">{editable ? <select className="erp-input w-14" value={row.uomId} onChange={(e) => upd(i, { uomId: e.target.value })}><option value="">—</option>{uomOptions.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</select> : ''}</td>
                    <td className="px-2 py-1">{editable ? <input type="number" className="erp-input w-16" value={row.contractQty} onChange={(e) => upd(i, { contractQty: Number(e.target.value) })} /> : (<span className="tabular-nums">{row.contractQty}{row.originalQty != null && row.originalQty !== row.contractQty && <span className="text-amber-600 text-[10px]"> (was {row.originalQty})</span>}</span>)}</td>
                    <td className="px-2 py-1">{editable ? <input type="number" className="erp-input w-20" value={row.rate} onChange={(e) => upd(i, { rate: Number(e.target.value) })} /> : <span className="tabular-nums">{money(row.rate)}</span>}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{money(row.contractQty * row.rate)}</td>
                    {editable && <td className="px-2 py-1"><button onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary + section subtotals */}
        <div className="bg-white border border-gray-200 rounded p-4 max-w-lg text-sm space-y-1">
          <div className="text-xs font-semibold text-gray-700 mb-2">Contract Summary</div>
          {summary.sections.map(([s, sub]) => <div key={s} className="flex justify-between text-gray-500"><span>{s}</span><span className="tabular-nums">{money(sub)}</span></div>)}
          <div className="flex justify-between font-medium text-gray-800 border-t border-gray-100 pt-1"><span>BOQ Total</span><span className="tabular-nums">{money(summary.total)}</span></div>
          <div className="flex justify-between text-gray-500"><span>Contract Value</span><span className="tabular-nums">{money(typeof contractValue === 'number' ? contractValue : 0)}</span></div>
          <div className={`flex justify-between ${summary.matches ? 'text-green-600' : 'text-amber-600'}`}><span>Variance</span><span className="tabular-nums">{money(summary.variance)}{summary.matches ? ' ✓' : ' ⚠'}</span></div>
        </div>

        {/* Variation panel (active contracts) */}
        {isEdit && status === 'ACTIVE' && (
          <div className="bg-white border border-gray-200 rounded p-4 max-w-2xl space-y-3">
            <div className="text-xs font-semibold text-gray-700 flex items-center gap-1"><GitBranch size={13} /> Variation Order</div>
            <div className="flex items-end gap-2 flex-wrap">
              <div><label className="block text-[10px] text-gray-500">BOQ Line</label>
                <select className="erp-input w-64" value={varLineId} onChange={(e) => setVarLineId(e.target.value)}>
                  <option value="">Select line…</option>
                  {rows.map((r) => <option key={r.id} value={r.id}>{r.itemDescription.slice(0, 40)} (qty {r.contractQty})</option>)}
                </select>
              </div>
              <div><label className="block text-[10px] text-gray-500">Delta Qty (+/-)</label><input type="number" className="erp-input w-24" value={varDelta} onChange={(e) => setVarDelta(Number(e.target.value))} /></div>
              <div><label className="block text-[10px] text-gray-500">Reason</label><input className="erp-input w-48" value={varReason} onChange={(e) => setVarReason(e.target.value)} /></div>
              <button onClick={applyVariation} className="toolbar-btn">Apply variation</button>
            </div>
            <div className="text-[11px] text-gray-400">Variations keep the original quantity for reference and recompute the contract value.</div>
          </div>
        )}
      </div>
    </div>
  );
}
