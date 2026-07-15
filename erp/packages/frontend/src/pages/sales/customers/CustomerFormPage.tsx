import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  useCustomer,
  useCustomerFinancialSummary,
  useCreateCustomer,
  useUpdateCustomer,
} from '../../../api/sales';
import type { UpsertCustomerInput } from '@clouderp/shared';

type Tab = 'general' | 'contacts' | 'addresses' | 'commercial' | 'financial';

interface ContactRow { name: string; role: string; email: string; phone: string; isPrimary: boolean; }
interface AddressRow { type: 'BILL_TO' | 'SHIP_TO'; line1: string; line2: string; city: string; country: string; isDefault: boolean; }

const emptyForm = {
  code: '',
  name: '',
  tradeName: '',
  type: 'COMPANY' as 'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT',
  trn: '',
  defaultTaxCodeId: '',
  isTaxExempt: false,
  paymentTerms: '',
  creditLimit: 0,
  creditHold: false,
  priceListId: '',
  salespersonId: '',
  categoryId: '',
  notes: '',
  isActive: true,
};

export default function CustomerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading } = useCustomer(id);
  const { data: financial } = useCustomerFinancialSummary(id);
  const createMut = useCreateCustomer();
  const updateMut = useUpdateCustomer(id ?? '');

  const [tab, setTab] = useState<Tab>('general');
  const [form, setForm] = useState({ ...emptyForm });
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!existing) return;
    setForm({
      code: existing.code ?? '',
      name: existing.name ?? '',
      tradeName: existing.tradeName ?? '',
      type: (existing.type ?? 'COMPANY') as typeof emptyForm.type,
      trn: existing.trn ?? '',
      defaultTaxCodeId: existing.defaultTaxCodeId ?? '',
      isTaxExempt: existing.isTaxExempt ?? false,
      paymentTerms: existing.paymentTerms ?? '',
      creditLimit: Number(existing.creditLimit ?? 0),
      creditHold: existing.creditHold ?? false,
      priceListId: existing.priceListId ?? '',
      salespersonId: existing.salespersonId ?? '',
      categoryId: existing.categoryId ?? '',
      notes: existing.notes ?? '',
      isActive: existing.isActive ?? true,
    });
    setContacts((existing.contacts ?? []).map((c) => ({
      name: c.name, role: c.role ?? '', email: c.email ?? '', phone: c.phone ?? '', isPrimary: c.isPrimary,
    })));
    setAddresses((existing.addresses ?? []).map((a) => ({
      type: a.type, line1: a.line1, line2: a.line2 ?? '', city: a.city ?? '', country: a.country ?? '', isDefault: a.isDefault,
    })));
  }, [existing]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const buildPayload = (): UpsertCustomerInput => ({
    code: form.code || undefined,
    name: form.name.trim(),
    tradeName: form.tradeName || undefined,
    type: form.type,
    trn: form.trn || undefined,
    defaultTaxCodeId: form.defaultTaxCodeId || undefined,
    isTaxExempt: form.isTaxExempt,
    paymentTerms: form.paymentTerms || undefined,
    creditLimit: Number(form.creditLimit) || 0,
    creditHold: form.creditHold,
    priceListId: form.priceListId || undefined,
    salespersonId: form.salespersonId || undefined,
    categoryId: form.categoryId || undefined,
    notes: form.notes || undefined,
    isActive: form.isActive,
    contacts: contacts.filter((c) => c.name.trim()).map((c) => ({
      name: c.name, role: c.role || null, email: c.email || null, phone: c.phone || null, isPrimary: c.isPrimary,
    })),
    addresses: addresses.filter((a) => a.line1.trim()).map((a) => ({
      type: a.type, line1: a.line1, line2: a.line2 || null, city: a.city || null, country: a.country || null, isDefault: a.isDefault,
    })),
  });

  const handleSave = async () => {
    setError(null);
    setWarnings([]);
    if (!form.name.trim()) { setError('Customer name is required'); setTab('general'); return; }
    try {
      if (isEdit) {
        await updateMut.mutateAsync(buildPayload());
        navigate('/sales/customers');
      } else {
        const res = await createMut.mutateAsync(buildPayload());
        const w: string[] = [];
        if (res.pendingCreditApproval) w.push('Credit limit exceeds the threshold — customer created inactive, pending Credit Controller approval.');
        (res.warnings ?? []).forEach((d) => w.push(`Possible duplicate: ${d.code} — ${d.name}`));
        if (w.length) { setWarnings(w); }
        else navigate('/sales/customers');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Save failed');
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  if (isEdit && isLoading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#1F4E79]" /></div>;
  }

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'general', label: 'General' },
    { id: 'contacts', label: `Contacts (${contacts.length})` },
    { id: 'addresses', label: `Addresses (${addresses.length})` },
    { id: 'commercial', label: 'Commercial & Credit' },
    ...(isEdit ? [{ id: 'financial' as Tab, label: 'Financial' }] : []),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <button onClick={() => navigate('/sales/customers')} className="toolbar-btn" title="Back">
          <ArrowLeft size={13} />
        </button>
        <h2 className="text-sm font-semibold text-gray-800">
          {isEdit ? `Customer: ${form.name || existing?.code}` : 'New Customer'}
        </h2>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          <span>Save</span>
        </button>
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}
      {warnings.length > 0 && (
        <div className="mx-4 mt-3 px-3 py-2 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded">
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
          <button onClick={() => navigate('/sales/customers')} className="mt-1 underline">Continue to list</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-t ${tab === t.id ? 'bg-white border border-b-white border-gray-200 font-medium text-[#1F4E79]' : 'text-gray-500 hover:text-gray-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 bg-gray-50">
        {tab === 'general' && (
          <div className="grid grid-cols-2 gap-4 max-w-3xl">
            <Field label="Code"><input className="erp-input" value={form.code} onChange={(e) => set('code', e.target.value)} placeholder={isEdit ? '' : 'Auto-generated if blank'} /></Field>
            <Field label="Type">
              <select className="erp-input" value={form.type} onChange={(e) => set('type', e.target.value as typeof form.type)}>
                <option value="COMPANY">Company</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="GOVERNMENT">Government</option>
              </select>
            </Field>
            <Field label="Name *"><input className="erp-input" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Trade Name"><input className="erp-input" value={form.tradeName} onChange={(e) => set('tradeName', e.target.value)} /></Field>
            <Field label="Tax Reg. No (TRN)"><input className="erp-input" value={form.trn} onChange={(e) => set('trn', e.target.value)} /></Field>
            <Field label="Active">
              <select className="erp-input" value={String(form.isActive)} onChange={(e) => set('isActive', e.target.value === 'true')}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
            <Field label="Notes" full><textarea className="erp-input" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          </div>
        )}

        {tab === 'contacts' && (
          <EditableList
            title="Contacts"
            rows={contacts}
            onAdd={() => setContacts((r) => [...r, { name: '', role: '', email: '', phone: '', isPrimary: r.length === 0 }])}
            onRemove={(i) => setContacts((r) => r.filter((_, idx) => idx !== i))}
            columns={[
              { key: 'name', label: 'Name', render: (row, i) => <input className="erp-input" value={row.name} onChange={(e) => updateRow(setContacts, i, 'name', e.target.value)} /> },
              { key: 'role', label: 'Role', render: (row, i) => <input className="erp-input" value={row.role} onChange={(e) => updateRow(setContacts, i, 'role', e.target.value)} /> },
              { key: 'email', label: 'Email', render: (row, i) => <input className="erp-input" value={row.email} onChange={(e) => updateRow(setContacts, i, 'email', e.target.value)} /> },
              { key: 'phone', label: 'Phone', render: (row, i) => <input className="erp-input" value={row.phone} onChange={(e) => updateRow(setContacts, i, 'phone', e.target.value)} /> },
              { key: 'isPrimary', label: 'Primary', render: (row, i) => <input type="checkbox" checked={row.isPrimary} onChange={(e) => updateRow(setContacts, i, 'isPrimary', e.target.checked)} /> },
            ]}
          />
        )}

        {tab === 'addresses' && (
          <EditableList
            title="Addresses"
            rows={addresses}
            onAdd={() => setAddresses((r) => [...r, { type: 'BILL_TO', line1: '', line2: '', city: '', country: '', isDefault: false }])}
            onRemove={(i) => setAddresses((r) => r.filter((_, idx) => idx !== i))}
            columns={[
              { key: 'type', label: 'Type', render: (row, i) => (
                <select className="erp-input" value={row.type} onChange={(e) => updateRow(setAddresses, i, 'type', e.target.value as AddressRow['type'])}>
                  <option value="BILL_TO">Bill To</option>
                  <option value="SHIP_TO">Ship To</option>
                </select>
              ) },
              { key: 'line1', label: 'Address', render: (row, i) => <input className="erp-input" value={row.line1} onChange={(e) => updateRow(setAddresses, i, 'line1', e.target.value)} /> },
              { key: 'city', label: 'City', render: (row, i) => <input className="erp-input" value={row.city} onChange={(e) => updateRow(setAddresses, i, 'city', e.target.value)} /> },
              { key: 'country', label: 'Country', render: (row, i) => <input className="erp-input" value={row.country} onChange={(e) => updateRow(setAddresses, i, 'country', e.target.value)} /> },
              { key: 'isDefault', label: 'Default', render: (row, i) => <input type="checkbox" checked={row.isDefault} onChange={(e) => updateRow(setAddresses, i, 'isDefault', e.target.checked)} /> },
            ]}
          />
        )}

        {tab === 'commercial' && (
          <div className="grid grid-cols-2 gap-4 max-w-3xl">
            <Field label="Payment Terms"><input className="erp-input" value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} placeholder="e.g. Net 30" /></Field>
            <Field label="Credit Limit"><input type="number" className="erp-input" value={form.creditLimit} onChange={(e) => set('creditLimit', Number(e.target.value))} /></Field>
            <Field label="Credit Hold">
              <select className="erp-input" value={String(form.creditHold)} onChange={(e) => set('creditHold', e.target.value === 'true')}>
                <option value="false">No</option>
                <option value="true">On Hold</option>
              </select>
            </Field>
            <Field label="Tax Exempt">
              <select className="erp-input" value={String(form.isTaxExempt)} onChange={(e) => set('isTaxExempt', e.target.value === 'true')}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </Field>
            <Field label="Default Tax Code ID"><input className="erp-input" value={form.defaultTaxCodeId} onChange={(e) => set('defaultTaxCodeId', e.target.value)} /></Field>
            <Field label="Price List ID"><input className="erp-input" value={form.priceListId} onChange={(e) => set('priceListId', e.target.value)} /></Field>
            <Field label="Category ID"><input className="erp-input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} /></Field>
            <Field label="Salesperson (User ID)"><input className="erp-input" value={form.salespersonId} onChange={(e) => set('salespersonId', e.target.value)} /></Field>
          </div>
        )}

        {tab === 'financial' && (
          <div className="max-w-lg space-y-2">
            {financial ? (
              <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Credit Limit" value={financial.creditLimit} />
                <Metric label="Outstanding Balance" value={financial.outstandingBalance} />
                <Metric label="Overdue Amount" value={financial.overdueAmount} danger={financial.overdueAmount > 0} />
                <Metric label="Open Order Value" value={financial.openOrderValue} />
                <Metric label="Available Credit" value={financial.availableCredit} danger={financial.availableCredit < 0} />
              </div>
            ) : (
              <div className="text-xs text-gray-500">Loading financial summary…</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function updateRow<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number, key: keyof T, value: T[keyof T]) {
  setter((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-base font-semibold ${danger ? 'text-red-600' : 'text-gray-800'}`}>
        {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}

interface EditableColumn<T> { key: string; label: string; render: (row: T, i: number) => React.ReactNode; }
function EditableList<T>({ title, rows, columns, onAdd, onRemove }: {
  title: string; rows: T[]; columns: EditableColumn<T>[]; onAdd: () => void; onRemove: (i: number) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="flex items-center px-3 py-2 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <div className="flex-1" />
        <button onClick={onAdd} className="toolbar-btn"><Plus size={13} /><span>Add</span></button>
      </div>
      {rows.length === 0 ? (
        <div className="p-4 text-xs text-gray-400">No {title.toLowerCase()} yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              {columns.map((c) => <th key={c.key} className="px-2 py-1 font-medium">{c.label}</th>)}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50">
                {columns.map((c) => <td key={c.key} className="px-2 py-1">{c.render(row, i)}</td>)}
                <td className="px-2 py-1">
                  <button onClick={() => onRemove(i)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
