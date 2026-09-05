import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Send, BadgeCheck, CheckCircle, Loader2 } from 'lucide-react';
import {
  useProgressBill, useCreateProgressBill, progressBillApi,
  type UpsertProgressBillInput, type PrepareLine,
} from '../../../api/progressBills';
import { useContracts } from '../../../api/contracts';

interface Row {
  boqLineId: string; section: string | null; itemDescription: string; uomCode?: string;
  contractQty: number; rate: number; previousValue: number; cumQty: number;
}
const money = (v: number) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 });

export default function ProgressBillFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading, refetch } = useProgressBill(id);
  const createMut = useCreateProgressBill();
  const { data: contracts } = useContracts({ status: 'ACTIVE' });

  const [contractId, setContractId] = useState('');
  const [contractValue, setContractValue] = useState(0);
  const [period, setPeriod] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const status = existing?.status ?? 'DRAFT';

  useEffect(() => {
    if (!existing) return;
    setContractValue(Number(existing.summary?.contractValue ?? existing.contract?.contractValue ?? 0));
    setPeriod(existing.period ?? '');
    setBillDate(existing.billDate ? existing.billDate.slice(0, 10) : '');
    setRows((existing.lines ?? []).map((l: any) => ({
      boqLineId: l.boqLineId, section: l.section, itemDescription: l.itemDescription, contractQty: Number(l.contractQty), rate: Number(l.rate),
      previousValue: Number(l.previousValue), cumQty: Number(l.cumQty),
    })));
  }, [existing]);

  const loadContract = async (cid: string) => {
    setContractId(cid); setError(null);
    if (!cid) { setRows([]); return; }
    try {
      const p = await progressBillApi.prepare(cid);
      setContractValue(p.contractValue);
      setRows(p.lines.map((l: PrepareLine) => ({
        boqLineId: l.boqLineId, section: l.section, itemDescription: l.itemDescription, uomCode: l.uomCode,
        contractQty: l.contractQty, rate: l.rate, previousValue: l.previousValue, cumQty: l.previousCumQty,
      })));
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to load contract BOQ'); }
  };

  const setCum = (i: number, cumQty: number) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, cumQty } : row)));
  const setPct = (i: number, pct: number) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, cumQty: Math.round(row.contractQty * (pct / 100) * 1000) / 1000 } : row)));

  const summary = useMemo(() => {
    let certifiedToDate = 0, thisBill = 0;
    rows.forEach((r) => { const cumValue = r.cumQty * r.rate; certifiedToDate += cumValue; thisBill += cumValue - r.previousValue; });
    const pct = contractValue > 0 ? (certifiedToDate / contractValue) * 100 : 0;
    return { certifiedToDate, thisBill, balance: contractValue - certifiedToDate, pct };
  }, [rows, contractValue]);

  const save = async () => {
    setError(null);
    if (!contractId) { setError('Select a contract'); return; }
    if (!period.trim()) { setError('Enter a period label'); return; }
    const over = rows.find((r) => r.cumQty > r.contractQty + 1e-6);
    if (over) { setError(`Cumulative qty exceeds contract qty on "${over.itemDescription}"`); return; }
    const payload: UpsertProgressBillInput = { contractId, period, billDate, lines: rows.map((r) => ({ boqLineId: r.boqLineId, cumQty: Number(r.cumQty) })) };
    try { const b = await createMut.mutateAsync(payload); navigate(`/sales/progress-bills/${b.id}`); }
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
        <button onClick={() => navigate('/sales/progress-bills')} className="toolbar-btn"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">{isEdit ? `${existing?.docNo ?? ''} · ${existing?.period ?? ''} · ${status}` : 'New Progress Bill'}</h2>
        <div className="flex-1" />
        {isEdit && status === 'DRAFT' && <button onClick={() => runAction(() => progressBillApi.submit(id!))} className="toolbar-btn"><Send size={13} /><span>Submit</span></button>}
        {isEdit && status === 'SUBMITTED' && <button onClick={() => runAction(() => progressBillApi.certify(id!))} className="toolbar-btn"><BadgeCheck size={13} /><span>Certify</span></button>}
        {isEdit && status === 'CERTIFIED' && <button onClick={() => runAction(() => progressBillApi.post(id!))} className="toolbar-btn"><CheckCircle size={13} /><span>Post to AR</span></button>}
        {!isEdit && <button onClick={save} disabled={createMut.isPending} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">{createMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save Draft</span></button>}
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}
      {banner && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-blue-50 text-[#1F4E79] border border-blue-200 rounded">{banner}</div>}
      {isEdit && existing?.journalId && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-green-50 text-green-800 border border-green-200 rounded">Certified &amp; posted — contract revenue + VAT recognised in the GL.</div>}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-4 gap-4">
          {!isEdit && (
            <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Contract *</label>
              <select className="erp-input w-full" value={contractId} onChange={(e) => loadContract(e.target.value)}>
                <option value="">Select active contract…</option>
                {(contracts?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.docNo} — {c.projectName}</option>)}
              </select>
            </div>
          )}
          <div><label className="block text-xs text-gray-600 mb-1">Period *</label><input className="erp-input w-full" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. IPC-01 / Jan 2026" disabled={isEdit} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Bill Date</label><input type="date" className="erp-input w-full" value={billDate} onChange={(e) => setBillDate(e.target.value)} disabled={isEdit} /></div>
        </div>

        <div className="bg-white border border-gray-200 rounded">
          <div className="px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-700">BOQ Certification ({rows.length})</div>
          {rows.length === 0 ? <div className="p-4 text-xs text-gray-400">{isEdit ? 'No lines.' : 'Select a contract to load its BOQ.'}</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-1">Item</th><th className="px-2 py-1 w-20 text-right">Contract Qty</th><th className="px-2 py-1 w-20 text-right">Rate</th>
                <th className="px-2 py-1 w-24 text-right">Prev. Value</th><th className="px-2 py-1 w-24">Cum. Qty</th><th className="px-2 py-1 w-16">%</th>
                <th className="px-2 py-1 w-24 text-right">Cum. Value</th><th className="px-2 py-1 w-24 text-right">This Bill</th>
              </tr></thead>
              <tbody>
                {rows.map((row, i) => {
                  const cumValue = row.cumQty * row.rate;
                  const thisValue = cumValue - row.previousValue;
                  const over = row.cumQty > row.contractQty + 1e-6;
                  const pct = row.contractQty > 0 ? (row.cumQty / row.contractQty) * 100 : 0;
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-2 py-1">{row.section ? <span className="text-gray-400">{row.section} · </span> : null}{row.itemDescription}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-gray-500">{row.contractQty}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-gray-500">{money(row.rate)}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-gray-500">{money(row.previousValue)}</td>
                      <td className="px-2 py-1"><input type="number" className={`erp-input w-20 ${over ? 'border-red-400 bg-red-50' : ''}`} value={row.cumQty} disabled={isEdit} onChange={(e) => setCum(i, Number(e.target.value))} title={over ? 'Exceeds contract qty' : ''} /></td>
                      <td className="px-2 py-1"><input type="number" className="erp-input w-14" value={Math.round(pct * 10) / 10} disabled={isEdit} onChange={(e) => setPct(i, Number(e.target.value))} /></td>
                      <td className="px-2 py-1 text-right tabular-nums">{money(cumValue)}</td>
                      <td className="px-2 py-1 text-right tabular-nums font-medium">{money(thisValue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded p-4 max-w-md text-sm space-y-1">
          <div className="text-xs font-semibold text-gray-700 mb-2">Progress Summary</div>
          <div className="flex justify-between text-gray-500"><span>Contract Value</span><span className="tabular-nums">{money(contractValue)}</span></div>
          <div className="flex justify-between text-gray-500"><span>Certified to Date</span><span className="tabular-nums">{money(summary.certifiedToDate)}</span></div>
          <div className="flex justify-between text-gray-500"><span>Balance to Complete</span><span className="tabular-nums">{money(summary.balance)}</span></div>
          <div className="flex justify-between font-semibold text-[#1F4E79] border-t border-gray-100 pt-1"><span>This Bill (net)</span><span className="tabular-nums">{money(summary.thisBill)}</span></div>
          <div className="mt-2">
            <div className="h-2 bg-gray-100 rounded overflow-hidden"><div className="h-full bg-[#2E75B6]" style={{ width: `${Math.min(100, Math.max(0, summary.pct))}%` }} /></div>
            <div className="text-[11px] text-gray-500 mt-1">{(Math.round(summary.pct * 10) / 10)}% complete</div>
          </div>
        </div>
      </div>
    </div>
  );
}
