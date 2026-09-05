import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  usePaymentTerm,
  useCreatePaymentTerm,
  useUpdatePaymentTerm,
} from '../../../api/salesMasters';
import { deriveShortName, SHORT_NAME_LENGTH } from '@clouderp/shared';
import type { UpsertPaymentTermInput, PaymentMode, DueDateBasis } from '@clouderp/shared';

interface LineRow {
  paymentPct: number;
  addMonths: number;
  creditDays: number;
  cashDiscountDays: string;
  cashDiscountPct: string;
  isActive: boolean;
}

const emptyForm = {
  code: '',
  name: '',
  shortName: '',
  paymentMode: 'NORMAL' as PaymentMode,
  dueDateBasis: 'DOCUMENT_DATE' as DueDateBasis,
  dueDateAfterAdvance: false,
  isActive: true,
};

const newLine = (pct: number): LineRow => ({
  paymentPct: pct, addMonths: 0, creditDays: 0, cashDiscountDays: '', cashDiscountPct: '', isActive: true,
});

export default function PaymentTermFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading } = usePaymentTerm(id);
  const createMut = useCreatePaymentTerm();
  const updateMut = useUpdatePaymentTerm(id ?? '');

  const [form, setForm] = useState({ ...emptyForm });
  const [lines, setLines] = useState<LineRow[]>([newLine(100)]);
  const [error, setError] = useState<string | null>(null);
  // The short description mirrors the description until edited by hand.
  const [shortNameTouched, setShortNameTouched] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setForm({
      code: existing.code ?? '',
      name: existing.name ?? '',
      shortName: existing.shortName ?? '',
      paymentMode: existing.paymentMode ?? 'NORMAL',
      dueDateBasis: existing.dueDateBasis ?? 'DOCUMENT_DATE',
      dueDateAfterAdvance: existing.dueDateAfterAdvance ?? false,
      isActive: existing.isActive ?? true,
    });
    setShortNameTouched(!!existing.shortName && existing.shortName !== deriveShortName(existing.name));
    setLines((existing.lines ?? []).map((l) => ({
      paymentPct: Number(l.paymentPct),
      addMonths: l.addMonths,
      creditDays: l.creditDays,
      cashDiscountDays: l.cashDiscountDays == null ? '' : String(l.cashDiscountDays),
      cashDiscountPct: l.cashDiscountPct == null ? '' : String(l.cashDiscountPct),
      isActive: l.isActive,
    })));
  }, [existing]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const setName = (value: string) =>
    setForm((f) => ({ ...f, name: value, shortName: shortNameTouched ? f.shortName : deriveShortName(value) }));
  const upd = (i: number, patch: Partial<LineRow>) => setLines((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const totalPct = useMemo(() => lines.reduce((s, l) => s + (Number(l.paymentPct) || 0), 0), [lines]);
  // The last instalment sets the document due date.
  const effectiveCreditDays = useMemo(() => {
    if (!lines.length) return 0;
    const last = lines[lines.length - 1];
    return (Number(last.addMonths) || 0) * 30 + (Number(last.creditDays) || 0);
  }, [lines]);

  const save = async () => {
    setError(null);
    if (!form.name.trim()) { setError('Description is required'); return; }
    if (lines.length && Math.abs(totalPct - 100) > 0.01) {
      setError(`The payment schedule must total 100% (currently ${totalPct.toFixed(2)}%)`); return;
    }
    const payload: UpsertPaymentTermInput = {
      code: form.code || undefined,
      name: form.name.trim(),
      shortName: form.shortName || null,
      paymentMode: form.paymentMode,
      dueDateBasis: form.dueDateBasis,
      dueDateAfterAdvance: form.dueDateAfterAdvance,
      isActive: form.isActive,
      lines: lines.map((l) => ({
        paymentPct: Number(l.paymentPct) || 0,
        addMonths: Number(l.addMonths) || 0,
        creditDays: Number(l.creditDays) || 0,
        cashDiscountDays: l.cashDiscountDays === '' ? null : Number(l.cashDiscountDays),
        cashDiscountPct: l.cashDiscountPct === '' ? null : Number(l.cashDiscountPct),
        isActive: l.isActive,
      })),
    };
    try {
      if (isEdit) await updateMut.mutateAsync(payload);
      else await createMut.mutateAsync(payload);
      navigate('/sales/payment-terms');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Save failed');
    }
  };

  const saving = createMut.isPending || updateMut.isPending;
  if (isEdit && isLoading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#1F4E79]" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <button onClick={() => navigate('/sales/payment-terms')} className="toolbar-btn" title="Back"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">
          {isEdit ? `Payment Term: ${form.code} — ${form.name}` : 'New Payment Term'}
        </h2>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-xs text-gray-600 mr-2">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          <span>Active</span>
        </label>
        <button onClick={save} disabled={saving} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save</span>
        </button>
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-2 gap-4 max-w-3xl">
          <Field label="Payment Term Code"><input className="erp-input" value={form.code} onChange={(e) => set('code', e.target.value)} placeholder={isEdit ? '' : 'Auto-generated if blank'} /></Field>
          <Field label="Description *"><input className="erp-input" value={form.name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Short Description">
            <input
              className="erp-input"
              maxLength={SHORT_NAME_LENGTH}
              value={form.shortName}
              onChange={(e) => { setShortNameTouched(true); set('shortName', e.target.value); }}
            />
          </Field>
          <Field label="Payment Mode">
            <select className="erp-input" value={form.paymentMode} onChange={(e) => set('paymentMode', e.target.value as PaymentMode)}>
              <option value="NORMAL">Normal</option>
              <option value="ADVANCE">Advance</option>
              <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
              <option value="CREDIT">Credit</option>
            </select>
          </Field>
          <Field label="Due Date Basis">
            <select className="erp-input" value={form.dueDateBasis} onChange={(e) => set('dueDateBasis', e.target.value as DueDateBasis)}>
              <option value="DOCUMENT_DATE">Document Date</option>
              <option value="DELIVERY_DATE">Delivery Date</option>
              <option value="MONTH_END">Month End</option>
              <option value="INVOICE_DATE">Invoice Date</option>
            </select>
          </Field>
          <Field label="Due Date After Advance">
            <label className="flex items-center gap-2 text-sm h-[30px]">
              <input type="checkbox" checked={form.dueDateAfterAdvance} onChange={(e) => set('dueDateAfterAdvance', e.target.checked)} />
              <span className="text-gray-700">Count the due date from the advance</span>
            </label>
          </Field>
          <div className="col-span-2 text-xs text-gray-500">
            Effective credit days (from the final instalment): <b className="text-gray-700">{effectiveCreditDays}</b>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded">
          <div className="flex items-center px-3 py-2 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-700">Payment schedule</span>
            <span className={`ml-3 text-xs ${Math.abs(totalPct - 100) > 0.01 ? 'text-red-600' : 'text-gray-500'}`}>
              Total {totalPct.toFixed(2)}% {Math.abs(totalPct - 100) > 0.01 ? '— must be 100%' : ''}
            </span>
            <div className="flex-1" />
            <button onClick={() => setLines((r) => [...r, newLine(Math.max(0, 100 - totalPct))])} className="toolbar-btn">
              <Plus size={13} /><span>Add instalment</span>
            </button>
          </div>
          {lines.length === 0 ? (
            <div className="p-4 text-xs text-gray-400">No instalments — the term will carry no credit days.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-2 py-1 font-medium">Payment %</th>
                  <th className="px-2 py-1 font-medium">Add Months</th>
                  <th className="px-2 py-1 font-medium">Credit Days</th>
                  <th className="px-2 py-1 font-medium">Cash Discount Days</th>
                  <th className="px-2 py-1 font-medium">Cash Discount %</th>
                  <th className="px-2 py-1 font-medium">Active</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-2 py-1"><input type="number" step="0.01" className="erp-input w-24" value={l.paymentPct} onChange={(e) => upd(i, { paymentPct: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><input type="number" className="erp-input w-20" value={l.addMonths} onChange={(e) => upd(i, { addMonths: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><input type="number" className="erp-input w-20" value={l.creditDays} onChange={(e) => upd(i, { creditDays: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><input type="number" className="erp-input w-24" value={l.cashDiscountDays} onChange={(e) => upd(i, { cashDiscountDays: e.target.value })} /></td>
                    <td className="px-2 py-1"><input type="number" step="0.01" className="erp-input w-24" value={l.cashDiscountPct} onChange={(e) => upd(i, { cashDiscountPct: e.target.value })} /></td>
                    <td className="px-2 py-1 text-center"><input type="checkbox" checked={l.isActive} onChange={(e) => upd(i, { isActive: e.target.checked })} /></td>
                    <td className="px-2 py-1">
                      <button onClick={() => setLines((r) => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
