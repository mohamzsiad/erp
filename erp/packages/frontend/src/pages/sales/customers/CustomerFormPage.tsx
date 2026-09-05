import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Loader2, Copy } from 'lucide-react';
import {
  useCustomer,
  useCustomerFinancialSummary,
  useCreateCustomer,
  useUpdateCustomer,
  useGroupCompaniesLookup,
  usePriceLists,
} from '../../../api/sales';
import {
  useSalesmen, usePaymentTerms, useCurrencies, useCountries, lookupApi,
  type Country, type City,
} from '../../../api/salesMasters';
import { deriveShortName, masterLabel, validateVatNumber, SHORT_NAME_LENGTH } from '@clouderp/shared';
import type { UpsertCustomerInput } from '@clouderp/shared';

type Tab = 'general' | 'addresses' | 'commercial' | 'companies' | 'financial';

/**
 * An address row carries its own contact details and registration numbers —
 * bill-to and ship-to each have their own, so there is no separate contacts tab.
 */
interface AddressRow {
  type: 'BILL_TO' | 'SHIP_TO';
  name: string;
  line1: string; line2: string; line3: string; line4: string; line5: string;
  countryId: string; cityId: string; postalCode: string; street: string;
  contactPerson: string; email: string; phone: string; mobile: string; fax: string;
  vatNo: string; crNo: string; taxCardNo: string;
  isDefault: boolean;
}

interface CompanyTermRow {
  companyId: string;
  salesmanId: string;
  priceListId: string;
  paymentTermId: string;
  creditLimit: number;
  creditExposureLimit: number;
  closeToExpiryDays: string;
  isBlackListed: boolean;
  isGreyListed: boolean;
  isActive: boolean;
}

const emptyAddress = (type: AddressRow['type']): AddressRow => ({
  type, name: '',
  line1: '', line2: '', line3: '', line4: '', line5: '',
  countryId: '', cityId: '', postalCode: '', street: '',
  contactPerson: '', email: '', phone: '', mobile: '', fax: '',
  vatNo: '', crNo: '', taxCardNo: '',
  isDefault: false,
});

const emptyForm = {
  code: '',
  name: '',
  tradeName: '',
  type: 'COMPANY' as 'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT',
  defaultTaxCodeId: '',
  isTaxExempt: false,
  paymentTermId: '',
  currencyId: '',
  creditHold: false,
  isBlackListed: false,
  priceListId: '',
  salesmanId: '',
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

  const { data: companies } = useGroupCompaniesLookup();
  const { data: salesmen } = useSalesmen({ isActive: true });
  const { data: paymentTerms } = usePaymentTerms({ isActive: true });
  const { data: currencies } = useCurrencies();
  const { data: countries } = useCountries();
  const { data: priceLists } = usePriceLists({ isActive: true });

  const [tab, setTab] = useState<Tab>('general');
  const [form, setForm] = useState({ ...emptyForm });
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [companyTerms, setCompanyTerms] = useState<CompanyTermRow[]>([]);
  const [currencyIds, setCurrencyIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  // The trade name mirrors the name until the user types their own.
  const [tradeNameTouched, setTradeNameTouched] = useState(false);
  // Cities are loaded per country as each address picks one.
  const [citiesByCountry, setCitiesByCountry] = useState<Record<string, City[]>>({});

  useEffect(() => {
    if (!existing) return;
    setForm({
      code: existing.code ?? '',
      name: existing.name ?? '',
      tradeName: existing.tradeName ?? '',
      type: (existing.type ?? 'COMPANY') as typeof emptyForm.type,
      defaultTaxCodeId: existing.defaultTaxCodeId ?? '',
      isTaxExempt: existing.isTaxExempt ?? false,
      paymentTermId: existing.paymentTermId ?? '',
      currencyId: existing.currencyId ?? '',
      creditHold: existing.creditHold ?? false,
      isBlackListed: existing.isBlackListed ?? false,
      priceListId: existing.priceListId ?? '',
      salesmanId: existing.salesmanId ?? '',
      categoryId: existing.categoryId ?? '',
      notes: existing.notes ?? '',
      isActive: existing.isActive ?? true,
    });
    setTradeNameTouched(!!existing.tradeName && existing.tradeName !== deriveShortName(existing.name));
    setCurrencyIds(existing.currencyIds ?? []);
    setAddresses((existing.addresses ?? []).map((a) => ({
      type: a.type, name: a.name ?? '',
      line1: a.line1, line2: a.line2 ?? '', line3: a.line3 ?? '', line4: a.line4 ?? '', line5: a.line5 ?? '',
      countryId: a.countryId ?? '', cityId: a.cityId ?? '', postalCode: a.postalCode ?? '', street: a.street ?? '',
      contactPerson: a.contactPerson ?? '', email: a.email ?? '', phone: a.phone ?? '',
      mobile: a.mobile ?? '', fax: a.fax ?? '',
      vatNo: a.vatNo ?? '', crNo: a.crNo ?? '', taxCardNo: a.taxCardNo ?? '',
      isDefault: a.isDefault,
    })));
    setCompanyTerms((existing.companyTerms ?? []).map((t) => ({
      companyId: t.companyId,
      salesmanId: t.salesmanId ?? '',
      priceListId: t.priceListId ?? '',
      paymentTermId: t.paymentTermId ?? '',
      creditLimit: Number(t.creditLimit ?? 0),
      creditExposureLimit: Number(t.creditExposureLimit ?? 0),
      closeToExpiryDays: t.closeToExpiryDays == null ? '' : String(t.closeToExpiryDays),
      isBlackListed: t.isBlackListed,
      isGreyListed: t.isGreyListed,
      isActive: t.isActive,
    })));
  }, [existing]);

  // Pull the city list for every country already referenced by an address.
  useEffect(() => {
    const needed = Array.from(new Set(addresses.map((a) => a.countryId).filter(Boolean)));
    needed.forEach((countryId) => {
      if (citiesByCountry[countryId]) return;
      lookupApi.cities(countryId)
        .then((rows) => setCitiesByCountry((m) => ({ ...m, [countryId]: rows })))
        .catch(() => { /* dropdown simply stays empty */ });
    });
  }, [addresses, citiesByCountry]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Typing the name spools the short/trade name across, up to the shared limit.
  const setName = (value: string) =>
    setForm((f) => ({ ...f, name: value, tradeName: tradeNameTouched ? f.tradeName : deriveShortName(value) }));

  const countryById = (cid: string): Country | undefined => (countries ?? []).find((c) => c.id === cid);

  const buildPayload = (): UpsertCustomerInput => ({
    code: form.code || undefined,
    name: form.name.trim(),
    tradeName: form.tradeName || undefined,
    type: form.type,
    defaultTaxCodeId: form.defaultTaxCodeId || undefined,
    isTaxExempt: form.isTaxExempt,
    paymentTermId: form.paymentTermId || undefined,
    // Keep the legacy label in step with the selected term for existing reports.
    paymentTerms: paymentTerms?.find((t) => t.id === form.paymentTermId)?.name || undefined,
    currencyId: form.currencyId || undefined,
    currencyIds,
    creditHold: form.creditHold,
    isBlackListed: form.isBlackListed,
    priceListId: form.priceListId || undefined,
    salesmanId: form.salesmanId || undefined,
    categoryId: form.categoryId || undefined,
    notes: form.notes || undefined,
    isActive: form.isActive,
    addresses: addresses.filter((a) => a.line1.trim()).map((a) => ({
      type: a.type, name: a.name || null,
      line1: a.line1, line2: a.line2 || null, line3: a.line3 || null, line4: a.line4 || null, line5: a.line5 || null,
      countryId: a.countryId || null,
      country: countryById(a.countryId)?.name ?? null,
      cityId: a.cityId || null,
      city: (citiesByCountry[a.countryId] ?? []).find((c) => c.id === a.cityId)?.name ?? null,
      postalCode: a.postalCode || null,
      street: a.street || null,
      contactPerson: a.contactPerson || null, email: a.email || null, phone: a.phone || null,
      mobile: a.mobile || null, fax: a.fax || null,
      vatNo: a.vatNo || null, crNo: a.crNo || null, taxCardNo: a.taxCardNo || null,
      isDefault: a.isDefault,
    })),
    companyTerms: companyTerms.filter((t) => t.companyId).map((t) => ({
      companyId: t.companyId,
      salesmanId: t.salesmanId || null,
      priceListId: t.priceListId || null,
      paymentTermId: t.paymentTermId || null,
      creditLimit: Number(t.creditLimit) || 0,
      creditExposureLimit: Number(t.creditExposureLimit) || 0,
      closeToExpiryDays: t.closeToExpiryDays === '' ? null : Number(t.closeToExpiryDays),
      isBlackListed: t.isBlackListed,
      isGreyListed: t.isGreyListed,
      isActive: t.isActive,
    })),
  });

  const handleSave = async () => {
    setError(null);
    setWarnings([]);
    if (!form.name.trim()) { setError('Customer name is required'); setTab('general'); return; }

    const dupCompany = companyTerms.map((t) => t.companyId).filter(Boolean);
    if (new Set(dupCompany).size !== dupCompany.length) {
      setError('Each company may appear only once in the Companies grid'); setTab('companies'); return;
    }
    // VAT numbers must match the length their country mandates.
    for (const a of addresses) {
      const verdict = validateVatNumber(a.vatNo, countryById(a.countryId));
      if (!verdict.ok) {
        setError(`${a.type === 'SHIP_TO' ? 'Ship to' : 'Bill to'} address: ${verdict.message}`);
        setTab('addresses');
        return;
      }
    }

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
    { id: 'addresses', label: `Addresses (${addresses.length})` },
    { id: 'commercial', label: 'Commercial & Credit' },
    { id: 'companies', label: `Companies (${companyTerms.length})` },
    ...(isEdit ? [{ id: 'financial' as Tab, label: 'Financial' }] : []),
  ];

  const updAddr = (i: number, patch: Partial<AddressRow>) =>
    setAddresses((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updTerm = (i: number, patch: Partial<CompanyTermRow>) =>
    setCompanyTerms((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  /** Copies the default bill-to address onto a ship-to row. */
  const copyBillTo = (i: number) => {
    const billTo = addresses.find((a) => a.type === 'BILL_TO' && a.isDefault) ?? addresses.find((a) => a.type === 'BILL_TO');
    if (!billTo) { setError('There is no Bill To address to copy from'); return; }
    setError(null);
    setAddresses((rows) => rows.map((r, idx) => (
      idx === i ? { ...billTo, type: 'SHIP_TO', name: r.name || billTo.name, isDefault: r.isDefault } : r
    )));
  };

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
        <label className="flex items-center gap-1.5 text-xs text-gray-600 mr-2">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          <span>Active</span>
        </label>
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
            <Field label="Name *"><input className="erp-input" value={form.name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Short / Trade Name">
              <input
                className="erp-input"
                maxLength={SHORT_NAME_LENGTH}
                value={form.tradeName}
                onChange={(e) => { setTradeNameTouched(true); set('tradeName', e.target.value); }}
              />
            </Field>
            <Field label="Salesman">
              <select className="erp-input" value={form.salesmanId} onChange={(e) => set('salesmanId', e.target.value)}>
                <option value="">—</option>
                {(salesmen ?? []).map((s) => <option key={s.id} value={s.id}>{masterLabel(s.code, s.name)}</option>)}
              </select>
            </Field>
            <Field label="Default Currency">
              <select className="erp-input" value={form.currencyId} onChange={(e) => set('currencyId', e.target.value)}>
                <option value="">—</option>
                {/* Only a currency the customer is allowed to pay in can be the default */}
                {(currencies ?? [])
                  .filter((c) => currencyIds.length === 0 || currencyIds.includes(c.id))
                  .map((c) => <option key={c.id} value={c.id}>{masterLabel(c.code, c.name)}</option>)}
              </select>
            </Field>
            <Field label="Currencies Allowed" full>
              <div className="flex flex-wrap gap-3 bg-white border border-gray-200 rounded px-3 py-2">
                {(currencies ?? []).length === 0 && <span className="text-xs text-gray-400">No currencies configured.</span>}
                {(currencies ?? []).map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={currencyIds.includes(c.id)}
                      onChange={(e) => {
                        setCurrencyIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id)));
                        // Dropping the currency that was the default leaves no default behind.
                        if (!e.target.checked && form.currencyId === c.id) set('currencyId', '');
                      }}
                    />
                    <span>{masterLabel(c.code, c.name)}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                Tick every currency this customer may pay in — e.g. both OMR and AED. A sales order
                can then be raised in any of them, defaulting to the one above. Leave empty to allow all.
              </p>
            </Field>
            <Field label="Notes" full><textarea className="erp-input" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
            <p className="col-span-2 text-xs text-gray-500">
              VAT / CR registration numbers are held per address — see the Addresses tab.
            </p>
          </div>
        )}

        {tab === 'addresses' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setAddresses((r) => [...r, { ...emptyAddress('BILL_TO'), isDefault: !r.some((x) => x.type === 'BILL_TO') }])} className="toolbar-btn">
                <Plus size={13} /><span>Add Bill To</span>
              </button>
              <button onClick={() => setAddresses((r) => [...r, { ...emptyAddress('SHIP_TO'), isDefault: !r.some((x) => x.type === 'SHIP_TO') }])} className="toolbar-btn">
                <Plus size={13} /><span>Add Ship To</span>
              </button>
            </div>
            {addresses.length === 0 && <div className="text-xs text-gray-400">No addresses yet.</div>}
            {addresses.map((a, i) => {
              const country = countryById(a.countryId);
              const cities = citiesByCountry[a.countryId] ?? [];
              const vatVerdict = validateVatNumber(a.vatNo, country);
              return (
                <div key={i} className="bg-white border border-gray-200 rounded">
                  <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-200">
                    <select className="erp-input w-28" value={a.type} onChange={(e) => updAddr(i, { type: e.target.value as AddressRow['type'] })}>
                      <option value="BILL_TO">Bill To</option>
                      <option value="SHIP_TO">Ship To</option>
                    </select>
                    <input className="erp-input flex-1" placeholder="Address description" value={a.name} onChange={(e) => updAddr(i, { name: e.target.value })} />
                    {a.type === 'SHIP_TO' && (
                      <button onClick={() => copyBillTo(i)} className="toolbar-btn" title="Copy the Bill To address into this Ship To">
                        <Copy size={13} /><span>Same as Bill To</span>
                      </button>
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={a.isDefault}
                        onChange={(e) => setAddresses((rows) => rows.map((r, idx) =>
                          // Only one default per address type.
                          idx === i ? { ...r, isDefault: e.target.checked } : (r.type === a.type && e.target.checked ? { ...r, isDefault: false } : r)
                        ))}
                      />
                      <span>Default</span>
                    </label>
                    <button onClick={() => setAddresses((r) => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                  <div className="p-3 grid grid-cols-4 gap-3">
                    <Field label="Address Line 1 *"><input className="erp-input" value={a.line1} onChange={(e) => updAddr(i, { line1: e.target.value })} /></Field>
                    <Field label="Address Line 2"><input className="erp-input" value={a.line2} onChange={(e) => updAddr(i, { line2: e.target.value })} /></Field>
                    <Field label="Address Line 3"><input className="erp-input" value={a.line3} onChange={(e) => updAddr(i, { line3: e.target.value })} /></Field>
                    <Field label="Address Line 4"><input className="erp-input" value={a.line4} onChange={(e) => updAddr(i, { line4: e.target.value })} /></Field>
                    <Field label="Address Line 5"><input className="erp-input" value={a.line5} onChange={(e) => updAddr(i, { line5: e.target.value })} /></Field>

                    {/* Country → City → Postal Code → Street, in that order */}
                    <Field label="Country">
                      <select
                        className="erp-input"
                        value={a.countryId}
                        onChange={(e) => updAddr(i, { countryId: e.target.value, cityId: '' })}
                      >
                        <option value="">—</option>
                        {(countries ?? []).map((c) => <option key={c.id} value={c.id}>{masterLabel(c.code, c.name)}</option>)}
                      </select>
                    </Field>
                    <Field label="City">
                      <select
                        className="erp-input disabled:bg-gray-100"
                        value={a.cityId}
                        onChange={(e) => updAddr(i, { cityId: e.target.value })}
                        disabled={!a.countryId}
                        title={a.countryId ? '' : 'Pick a country first'}
                      >
                        <option value="">—</option>
                        {cities.map((c) => <option key={c.id} value={c.id}>{masterLabel(c.code, c.name)}</option>)}
                      </select>
                    </Field>
                    <Field label="Postal Code"><input className="erp-input" value={a.postalCode} onChange={(e) => updAddr(i, { postalCode: e.target.value })} /></Field>
                    <Field label="Street"><input className="erp-input" value={a.street} onChange={(e) => updAddr(i, { street: e.target.value })} /></Field>

                    <div className="col-span-4 border-t border-gray-100 pt-2 text-xs font-semibold text-gray-600">Contact</div>
                    <Field label="Contact Person"><input className="erp-input" value={a.contactPerson} onChange={(e) => updAddr(i, { contactPerson: e.target.value })} /></Field>
                    <Field label="Email"><input className="erp-input" value={a.email} onChange={(e) => updAddr(i, { email: e.target.value })} /></Field>
                    <Field label="Phone"><input className="erp-input" value={a.phone} onChange={(e) => updAddr(i, { phone: e.target.value })} /></Field>
                    <Field label="Mobile"><input className="erp-input" value={a.mobile} onChange={(e) => updAddr(i, { mobile: e.target.value })} /></Field>
                    <Field label="Fax"><input className="erp-input" value={a.fax} onChange={(e) => updAddr(i, { fax: e.target.value })} /></Field>

                    <div className="col-span-4 border-t border-gray-100 pt-2 text-xs font-semibold text-gray-600">Registration</div>
                    <Field label="VAT Registration No">
                      <input
                        className={`erp-input ${!vatVerdict.ok ? 'border-red-400 bg-red-50' : ''}`}
                        value={a.vatNo}
                        onChange={(e) => updAddr(i, { vatNo: e.target.value })}
                        maxLength={country?.vatLength ?? undefined}
                      />
                      {!vatVerdict.ok
                        ? <p className="mt-1 text-[11px] text-red-600">{vatVerdict.message}</p>
                        : country?.vatFormatHint
                          ? <p className="mt-1 text-[11px] text-gray-500">{country.vatFormatHint}</p>
                          : null}
                    </Field>
                    <Field label="Company Registration (CR) No"><input className="erp-input" value={a.crNo} onChange={(e) => updAddr(i, { crNo: e.target.value })} /></Field>
                    <Field label="Tax Card No"><input className="erp-input" value={a.taxCardNo} onChange={(e) => updAddr(i, { taxCardNo: e.target.value })} /></Field>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'commercial' && (
          <div className="grid grid-cols-2 gap-4 max-w-3xl">
            <Field label="Payment Terms">
              <select className="erp-input" value={form.paymentTermId} onChange={(e) => set('paymentTermId', e.target.value)}>
                <option value="">—</option>
                {(paymentTerms ?? []).map((t) => <option key={t.id} value={t.id}>{masterLabel(t.code, t.name)}</option>)}
              </select>
            </Field>
            <Field label="Price List">
              <select className="erp-input" value={form.priceListId} onChange={(e) => set('priceListId', e.target.value)}>
                <option value="">—</option>
                {(priceLists ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {masterLabel(p.code, p.name)}{p.type === 'CUSTOMER_SPECIFIC' ? ' (customer-specific)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Credit Hold">
              <label className="flex items-center gap-2 text-sm h-[30px]">
                <input type="checkbox" checked={form.creditHold} onChange={(e) => set('creditHold', e.target.checked)} />
                <span className="text-gray-700">On hold</span>
              </label>
            </Field>
            <Field label="Black Listed">
              <label className="flex items-center gap-2 text-sm h-[30px]">
                <input type="checkbox" checked={form.isBlackListed} onChange={(e) => set('isBlackListed', e.target.checked)} />
                <span className="text-gray-700">Blocked from trading</span>
              </label>
            </Field>
            <Field label="Tax Exempt">
              <label className="flex items-center gap-2 text-sm h-[30px]">
                <input type="checkbox" checked={form.isTaxExempt} onChange={(e) => set('isTaxExempt', e.target.checked)} />
                <span className="text-gray-700">Exempt from VAT</span>
              </label>
            </Field>
            <Field label="Default Tax Code ID"><input className="erp-input" value={form.defaultTaxCodeId} onChange={(e) => set('defaultTaxCodeId', e.target.value)} /></Field>
            <Field label="Category ID"><input className="erp-input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} /></Field>
            <p className="col-span-2 text-xs text-gray-500">
              Credit limits are set per company on the Companies tab, along with the payment terms,
              price list and salesman that apply when this customer buys from that company.
            </p>
          </div>
        )}

        {tab === 'companies' && (
          <div className="bg-white border border-gray-200 rounded">
            <div className="flex items-center px-3 py-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">Company-wise terms</span>
              <span className="ml-3 text-xs text-gray-500">One row per company this customer may buy from.</span>
              <div className="flex-1" />
              <button
                onClick={() => setCompanyTerms((r) => [...r, {
                  companyId: '', salesmanId: '', priceListId: '', paymentTermId: '',
                  creditLimit: 0, creditExposureLimit: 0, closeToExpiryDays: '',
                  isBlackListed: false, isGreyListed: false, isActive: true,
                }])}
                className="toolbar-btn"
              >
                <Plus size={13} /><span>Add</span>
              </button>
            </div>
            {companyTerms.length === 0 ? (
              <div className="p-4 text-xs text-gray-400">
                No company rows yet — add one to set this customer&apos;s credit limit and terms for that company.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="px-2 py-1 font-medium">Company *</th>
                      <th className="px-2 py-1 font-medium">Salesman</th>
                      <th className="px-2 py-1 font-medium">Price List</th>
                      <th className="px-2 py-1 font-medium">Payment Terms</th>
                      <th className="px-2 py-1 font-medium text-right">Credit Limit</th>
                      <th className="px-2 py-1 font-medium text-right">Credit Exposure</th>
                      <th className="px-2 py-1 font-medium text-right">Close To Expiry</th>
                      <th className="px-2 py-1 font-medium">Black</th>
                      <th className="px-2 py-1 font-medium">Grey</th>
                      <th className="px-2 py-1 font-medium">Active</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {companyTerms.map((t, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="px-2 py-1">
                          <select className="erp-input w-44" value={t.companyId} onChange={(e) => updTerm(i, { companyId: e.target.value })}>
                            <option value="">Select…</option>
                            {(companies ?? []).map((c) => <option key={c.id} value={c.id}>{masterLabel(c.code, c.name)}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select className="erp-input w-36" value={t.salesmanId} onChange={(e) => updTerm(i, { salesmanId: e.target.value })}>
                            <option value="">—</option>
                            {(salesmen ?? []).map((s) => <option key={s.id} value={s.id}>{masterLabel(s.code, s.name)}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select className="erp-input w-36" value={t.priceListId} onChange={(e) => updTerm(i, { priceListId: e.target.value })}>
                            <option value="">—</option>
                            {(priceLists ?? []).map((p) => <option key={p.id} value={p.id}>{masterLabel(p.code, p.name)}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select className="erp-input w-36" value={t.paymentTermId} onChange={(e) => updTerm(i, { paymentTermId: e.target.value })}>
                            <option value="">—</option>
                            {(paymentTerms ?? []).map((p) => <option key={p.id} value={p.id}>{masterLabel(p.code, p.name)}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1"><input type="number" className="erp-input w-24 text-right" value={t.creditLimit} onChange={(e) => updTerm(i, { creditLimit: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1"><input type="number" className="erp-input w-24 text-right" value={t.creditExposureLimit} onChange={(e) => updTerm(i, { creditExposureLimit: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1"><input type="number" className="erp-input w-20 text-right" value={t.closeToExpiryDays} onChange={(e) => updTerm(i, { closeToExpiryDays: e.target.value })} /></td>
                        <td className="px-2 py-1 text-center"><input type="checkbox" checked={t.isBlackListed} onChange={(e) => updTerm(i, { isBlackListed: e.target.checked })} /></td>
                        <td className="px-2 py-1 text-center"><input type="checkbox" checked={t.isGreyListed} onChange={(e) => updTerm(i, { isGreyListed: e.target.checked })} /></td>
                        <td className="px-2 py-1 text-center"><input type="checkbox" checked={t.isActive} onChange={(e) => updTerm(i, { isActive: e.target.checked })} /></td>
                        <td className="px-2 py-1">
                          <button onClick={() => setCompanyTerms((r) => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
