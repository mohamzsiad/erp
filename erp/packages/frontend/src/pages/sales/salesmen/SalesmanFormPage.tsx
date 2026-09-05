import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import {
  useSalesman,
  useCreateSalesman,
  useUpdateSalesman,
  useLocations,
} from '../../../api/salesMasters';
import { deriveShortName, masterLabel, SHORT_NAME_LENGTH } from '@clouderp/shared';
import type { UpsertSalesmanInput, SalesmanType } from '@clouderp/shared';

const emptyForm = {
  code: '',
  name: '',
  shortName: '',
  type: 'SALESMAN' as SalesmanType,
  minMarkupPct: 0,
  maxVariancePct: 0,
  locationId: '',
  contactNumber: '',
  email: '',
  isActive: true,
};

export default function SalesmanFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading } = useSalesman(id);
  const { data: locations } = useLocations();
  const createMut = useCreateSalesman();
  const updateMut = useUpdateSalesman(id ?? '');

  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState<string | null>(null);
  // The short description mirrors the name until the user types their own.
  const [shortNameTouched, setShortNameTouched] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setForm({
      code: existing.code ?? '',
      name: existing.name ?? '',
      shortName: existing.shortName ?? '',
      type: existing.type ?? 'SALESMAN',
      minMarkupPct: Number(existing.minMarkupPct ?? 0),
      maxVariancePct: Number(existing.maxVariancePct ?? 0),
      locationId: existing.locationId ?? '',
      contactNumber: existing.contactNumber ?? '',
      email: existing.email ?? '',
      isActive: existing.isActive ?? true,
    });
    setShortNameTouched(!!existing.shortName && existing.shortName !== deriveShortName(existing.name));
  }, [existing]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Typing the name spools the short description across, up to the shared limit.
  const setName = (value: string) =>
    setForm((f) => ({ ...f, name: value, shortName: shortNameTouched ? f.shortName : deriveShortName(value) }));

  // Sales & delivery location only applies to a van salesman.
  const locationEnabled = form.type === 'VAN_SALESMAN';

  const save = async () => {
    setError(null);
    if (!form.name.trim()) { setError('Name is required'); return; }
    const payload: UpsertSalesmanInput = {
      code: form.code || undefined,
      name: form.name.trim(),
      shortName: form.shortName || null,
      type: form.type,
      minMarkupPct: Number(form.minMarkupPct) || 0,
      maxVariancePct: Number(form.maxVariancePct) || 0,
      locationId: locationEnabled ? form.locationId || null : null,
      contactNumber: form.contactNumber || null,
      email: form.email || null,
      isActive: form.isActive,
    };
    try {
      if (isEdit) await updateMut.mutateAsync(payload);
      else await createMut.mutateAsync(payload);
      navigate('/sales/salesmen');
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
        <button onClick={() => navigate('/sales/salesmen')} className="toolbar-btn" title="Back"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">
          {isEdit ? `Salesman: ${form.code} — ${form.name}` : 'New Salesman'}
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

      <div className="flex-1 overflow-auto p-4 bg-gray-50">
        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-2 gap-4 max-w-3xl">
          <Field label="Code"><input className="erp-input" value={form.code} onChange={(e) => set('code', e.target.value)} placeholder={isEdit ? '' : 'Auto-generated if blank'} /></Field>
          <Field label="Type">
            <select className="erp-input" value={form.type} onChange={(e) => set('type', e.target.value as SalesmanType)}>
              <option value="SALESMAN">Salesman</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="VAN_SALESMAN">Van Salesman</option>
              <option value="MANAGER">Manager</option>
            </select>
          </Field>
          <Field label="Description / Name *"><input className="erp-input" value={form.name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Short Description">
            <input
              className="erp-input"
              maxLength={SHORT_NAME_LENGTH}
              value={form.shortName}
              onChange={(e) => { setShortNameTouched(true); set('shortName', e.target.value); }}
            />
          </Field>
          <Field label="Minimum Markup %"><input type="number" step="0.001" className="erp-input" value={form.minMarkupPct} onChange={(e) => set('minMarkupPct', Number(e.target.value))} /></Field>
          <Field label="Maximum Variance %"><input type="number" step="0.001" className="erp-input" value={form.maxVariancePct} onChange={(e) => set('maxVariancePct', Number(e.target.value))} /></Field>
          <Field label="Sales & Delivery Location">
            <select
              className="erp-input disabled:bg-gray-100 disabled:text-gray-400"
              value={locationEnabled ? form.locationId : ''}
              onChange={(e) => set('locationId', e.target.value)}
              disabled={!locationEnabled}
              title={locationEnabled ? '' : 'Only a van salesman carries a sales & delivery location'}
            >
              <option value="">—</option>
              {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{masterLabel(l.code, l.name)}</option>)}
            </select>
            {!locationEnabled && <p className="mt-1 text-[11px] text-gray-500">Van salesmen only.</p>}
          </Field>
          <Field label="Contact Number"><input className="erp-input" value={form.contactNumber} onChange={(e) => set('contactNumber', e.target.value)} /></Field>
          <Field label="Email"><input className="erp-input" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
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
