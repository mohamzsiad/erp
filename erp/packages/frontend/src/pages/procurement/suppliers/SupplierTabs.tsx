import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Star, Phone, Mail, Building2, MapPin, Globe, FileText, CreditCard, Anchor, Layers, Tag } from 'lucide-react';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormField';
import type { SupplierBankDetail, SupplierContact } from '@clouderp/shared';

// ── Shared helpers ─────────────────────────────────────────────────────────────
let _rowKey = 0;
const tempId = () => `__new_${++_rowKey}`;

// ══════════════════════════════════════════════════════════════════════════════
// 1. Company Tab — Contact persons
// ══════════════════════════════════════════════════════════════════════════════
interface CompanyTabProps {
  contacts: SupplierContact[];
  onChange: (contacts: SupplierContact[]) => void;
}

export function CompanyTab({ contacts, onChange }: CompanyTabProps) {
  const [rows, setRows] = useState(
    contacts.map((c) => ({ ...c, _key: c.id ?? tempId() }))
  );

  useEffect(() => {
    setRows(contacts.map((c) => ({ ...c, _key: c.id ?? tempId() })));
  }, [contacts]);

  const update = (key: string, field: keyof SupplierContact, value: unknown) => {
    const next = rows.map((r) => (r._key === key ? { ...r, [field]: value } : r));
    setRows(next);
    onChange(next);
  };

  const addRow = () => {
    const row = {
      _key: tempId(),
      id: tempId(),
      supplierId: '',
      name: '',
      designation: null,
      email: null,
      phone: null,
      isPrimary: rows.length === 0,
    };
    const next = [...rows, row];
    setRows(next);
    onChange(next);
  };

  const removeRow = (key: string) => {
    const next = rows.filter((r) => r._key !== key);
    setRows(next);
    onChange(next);
  };

  const setPrimary = (key: string) => {
    const next = rows.map((r) => ({ ...r, isPrimary: r._key === key }));
    setRows(next);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
          <Phone size={12} /> Contact Persons
        </p>
        <button type="button" onClick={addRow} className="toolbar-btn">
          <Plus size={11} /> Add Contact
        </button>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs border border-gray-200 rounded">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-center w-8 text-gray-500">Primary</th>
              <th className="px-2 py-1.5 text-left">Name *</th>
              <th className="px-2 py-1.5 text-left w-36">Designation</th>
              <th className="px-2 py-1.5 text-left w-44">Email</th>
              <th className="px-2 py-1.5 text-left w-32">Phone</th>
              <th className="w-7" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No contacts. Click "+ Add Contact" to add one.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row._key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-2 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => setPrimary(row._key)}
                    title={row.isPrimary ? 'Primary contact' : 'Set as primary'}
                  >
                    <Star
                      size={13}
                      className={row.isPrimary ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                    />
                  </button>
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => update(row._key, 'name', e.target.value)}
                    className="erp-input w-full text-xs"
                    placeholder="Full name"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.designation ?? ''}
                    onChange={(e) => update(row._key, 'designation', e.target.value || null)}
                    className="erp-input w-full text-xs"
                    placeholder="e.g. Manager"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="email"
                    value={row.email ?? ''}
                    onChange={(e) => update(row._key, 'email', e.target.value || null)}
                    className="erp-input w-full text-xs"
                    placeholder="email@example.com"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.phone ?? ''}
                    onChange={(e) => update(row._key, 'phone', e.target.value || null)}
                    className="erp-input w-full text-xs"
                    placeholder="+1 555 0000"
                  />
                </td>
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => removeRow(row._key)}
                    className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Payment Terms Tab
// ══════════════════════════════════════════════════════════════════════════════
export interface PaymentTermsData {
  creditDays: number;
  creditAmount: number;
  paymentMethod: string;
  discountDays: number;
  discountPct: number;
  dueDateBasis: string;
  remarks: string;
}

interface PaymentTermsTabProps {
  data: PaymentTermsData;
  onChange: (data: PaymentTermsData) => void;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
  { value: 'LC', label: 'Letter of Credit' },
  { value: 'PDC', label: 'Post-Dated Cheque' },
  { value: 'DD', label: 'Demand Draft' },
];

const DUE_DATE_BASIS_OPTIONS = [
  { value: 'INVOICE_DATE', label: 'Invoice Date' },
  { value: 'DELIVERY_DATE', label: 'Delivery Date' },
  { value: 'GRN_DATE', label: 'GRN Date' },
  { value: 'MONTH_END', label: 'End of Month' },
];

export function PaymentTermsTab({ data, onChange }: PaymentTermsTabProps) {
  const set = (field: keyof PaymentTermsData, value: unknown) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
        <CreditCard size={12} /> Payment Configuration
      </p>
      <div className="grid grid-cols-3 gap-x-8 gap-y-3">
        <FormField label="Credit Days">
          <Input
            type="number"
            min={0}
            value={data.creditDays}
            onChange={(e) => set('creditDays', Number(e.target.value))}
          />
        </FormField>

        <FormField label="Credit Amount Limit">
          <Input
            type="number"
            min={0}
            step="0.001"
            value={data.creditAmount}
            onChange={(e) => set('creditAmount', Number(e.target.value))}
            className="text-right"
          />
        </FormField>

        <FormField label="Payment Method">
          <Select
            options={PAYMENT_METHOD_OPTIONS}
            placeholder="Select method"
            value={data.paymentMethod}
            onChange={(e) => set('paymentMethod', e.target.value)}
          />
        </FormField>

        <FormField label="Due Date Basis">
          <Select
            options={DUE_DATE_BASIS_OPTIONS}
            placeholder="Select basis"
            value={data.dueDateBasis}
            onChange={(e) => set('dueDateBasis', e.target.value)}
          />
        </FormField>

        <FormField label="Early Payment Discount Days">
          <Input
            type="number"
            min={0}
            value={data.discountDays}
            onChange={(e) => set('discountDays', Number(e.target.value))}
          />
        </FormField>

        <FormField label="Early Payment Discount %">
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={data.discountPct}
            onChange={(e) => set('discountPct', Number(e.target.value))}
            className="text-right"
          />
        </FormField>

        <FormField label="Remarks" className="col-span-3">
          <Textarea
            rows={2}
            value={data.remarks}
            onChange={(e) => set('remarks', e.target.value)}
            placeholder="Payment instructions or notes…"
          />
        </FormField>
      </div>

      {data.discountDays > 0 && data.discountPct > 0 && (
        <div className="rounded bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
          Terms: {data.discountPct}% discount if paid within {data.discountDays} days,
          net due in {data.creditDays} days.
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Bank Details Tab
// ══════════════════════════════════════════════════════════════════════════════
interface BankDetailsTabProps {
  bankDetails: SupplierBankDetail[];
  onChange: (details: SupplierBankDetail[]) => void;
}

export function BankDetailsTab({ bankDetails, onChange }: BankDetailsTabProps) {
  const [rows, setRows] = useState(
    bankDetails.map((b) => ({ ...b, _key: b.id ?? tempId() }))
  );

  useEffect(() => {
    setRows(bankDetails.map((b) => ({ ...b, _key: b.id ?? tempId() })));
  }, [bankDetails]);

  const update = (key: string, field: keyof SupplierBankDetail, value: unknown) => {
    const next = rows.map((r) => (r._key === key ? { ...r, [field]: value } : r));
    setRows(next);
    onChange(next);
  };

  const addRow = () => {
    const row = {
      _key: tempId(),
      id: tempId(),
      supplierId: '',
      bankName: '',
      accountNo: '',
      iban: null,
      swiftCode: null,
      isActive: true,
    };
    const next = [...rows, row];
    setRows(next);
    onChange(next);
  };

  const removeRow = (key: string) => {
    const next = rows.filter((r) => r._key !== key);
    setRows(next);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
          <Building2 size={12} /> Bank Accounts
        </p>
        <button type="button" onClick={addRow} className="toolbar-btn">
          <Plus size={11} /> Add Bank
        </button>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs border border-gray-200 rounded">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left">Bank Name *</th>
              <th className="px-2 py-1.5 text-left w-40">Account No *</th>
              <th className="px-2 py-1.5 text-left w-40">IBAN</th>
              <th className="px-2 py-1.5 text-left w-32">SWIFT / BIC</th>
              <th className="px-2 py-1.5 text-center w-16">Active</th>
              <th className="w-7" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No bank accounts. Click "+ Add Bank" to add one.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row._key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.bankName}
                    onChange={(e) => update(row._key, 'bankName', e.target.value)}
                    className="erp-input w-full text-xs"
                    placeholder="Bank name"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.accountNo}
                    onChange={(e) => update(row._key, 'accountNo', e.target.value)}
                    className="erp-input w-full text-xs font-mono"
                    placeholder="Account number"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.iban ?? ''}
                    onChange={(e) => update(row._key, 'iban', e.target.value || null)}
                    className="erp-input w-full text-xs font-mono"
                    placeholder="e.g. SA03 8000 0000 6080 1016 7519"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.swiftCode ?? ''}
                    onChange={(e) => update(row._key, 'swiftCode', e.target.value || null)}
                    className="erp-input w-full text-xs font-mono uppercase"
                    placeholder="e.g. RIBLSARI"
                  />
                </td>
                <td className="px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={row.isActive}
                    onChange={(e) => update(row._key, 'isActive', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => removeRow(row._key)}
                    className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. Notes Tab
// ══════════════════════════════════════════════════════════════════════════════
export interface NotesData {
  internalNotes: string;
  externalNotes: string;
  termsAndConditions: string;
}

interface NotesTabProps {
  data: NotesData;
  onChange: (data: NotesData) => void;
}

export function NotesTab({ data, onChange }: NotesTabProps) {
  const set = (field: keyof NotesData, value: string) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
        <FileText size={12} /> Notes &amp; Instructions
      </p>
      <div className="grid grid-cols-1 gap-4">
        <FormField label="Internal Notes" hint="Visible to internal staff only">
          <Textarea
            rows={4}
            value={data.internalNotes}
            onChange={(e) => set('internalNotes', e.target.value)}
            placeholder="Internal remarks about this supplier…"
          />
        </FormField>

        <FormField label="External Notes / Instructions" hint="Printed on purchase orders sent to the supplier">
          <Textarea
            rows={4}
            value={data.externalNotes}
            onChange={(e) => set('externalNotes', e.target.value)}
            placeholder="Instructions visible to the supplier…"
          />
        </FormField>

        <FormField label="Terms &amp; Conditions">
          <Textarea
            rows={3}
            value={data.termsAndConditions}
            onChange={(e) => set('termsAndConditions', e.target.value)}
            placeholder="Standard terms and conditions…"
          />
        </FormField>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. Currency Tab
// ══════════════════════════════════════════════════════════════════════════════
export interface CurrencyData {
  defaultCurrency: string;
  exchangeRate: number;
  lockExchangeRate: boolean;
  currencyNotes: string;
}

interface CurrencyTabProps {
  data: CurrencyData;
  onChange: (data: CurrencyData) => void;
}

const CURRENCY_OPTIONS = [
  { value: 'SAR', label: 'SAR – Saudi Riyal' },
  { value: 'USD', label: 'USD – US Dollar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'GBP', label: 'GBP – British Pound' },
  { value: 'AED', label: 'AED – UAE Dirham' },
  { value: 'QAR', label: 'QAR – Qatari Riyal' },
  { value: 'KWD', label: 'KWD – Kuwaiti Dinar' },
  { value: 'BHD', label: 'BHD – Bahraini Dinar' },
  { value: 'OMR', label: 'OMR – Omani Rial' },
  { value: 'INR', label: 'INR – Indian Rupee' },
  { value: 'CNY', label: 'CNY – Chinese Yuan' },
  { value: 'JPY', label: 'JPY – Japanese Yen' },
];

export function CurrencyTab({ data, onChange }: CurrencyTabProps) {
  const set = (field: keyof CurrencyData, value: unknown) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-gray-600">Currency Settings</p>
      <div className="grid grid-cols-3 gap-x-8 gap-y-3">
        <FormField label="Default Currency">
          <Select
            options={CURRENCY_OPTIONS}
            placeholder="Select currency"
            value={data.defaultCurrency}
            onChange={(e) => set('defaultCurrency', e.target.value)}
          />
        </FormField>

        <FormField label="Default Exchange Rate" hint="Rate against base currency">
          <Input
            type="number"
            min={0}
            step="0.000001"
            value={data.exchangeRate}
            onChange={(e) => set('exchangeRate', Number(e.target.value))}
            className="text-right"
          />
        </FormField>

        <FormField label="Lock Exchange Rate">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={data.lockExchangeRate}
              onChange={(e) => set('lockExchangeRate', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-xs text-gray-600">Use fixed rate for all transactions</span>
          </label>
        </FormField>

        <FormField label="Currency Notes" className="col-span-3">
          <Textarea
            rows={2}
            value={data.currencyNotes}
            onChange={(e) => set('currencyNotes', e.target.value)}
            placeholder="e.g. Invoice in USD, pay in SAR at monthly rate…"
          />
        </FormField>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. Product Supply Tab
// ══════════════════════════════════════════════════════════════════════════════
export interface ProductSupplyRow {
  _key: string;
  itemCode: string;
  description: string;
  category: string;
  leadTimeDays: number;
  minOrderQty: number;
  unitPrice: number;
  uom: string;
}

interface ProductSupplyTabProps {
  rows: ProductSupplyRow[];
  onChange: (rows: ProductSupplyRow[]) => void;
}

export function ProductSupplyTab({ rows, onChange }: ProductSupplyTabProps) {
  const addRow = () => {
    onChange([
      ...rows,
      { _key: tempId(), itemCode: '', description: '', category: '', leadTimeDays: 0, minOrderQty: 1, unitPrice: 0, uom: '' },
    ]);
  };

  const removeRow = (key: string) => onChange(rows.filter((r) => r._key !== key));

  const update = (key: string, field: keyof ProductSupplyRow, value: unknown) =>
    onChange(rows.map((r) => (r._key === key ? { ...r, [field]: value } : r)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
          <Layers size={12} /> Supplied Products &amp; Materials
        </p>
        <button type="button" onClick={addRow} className="toolbar-btn">
          <Plus size={11} /> Add Item
        </button>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs border border-gray-200 rounded">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left w-28">Item Code</th>
              <th className="px-2 py-1.5 text-left">Description</th>
              <th className="px-2 py-1.5 text-left w-28">Category</th>
              <th className="px-2 py-1.5 text-right w-24">Lead Time (d)</th>
              <th className="px-2 py-1.5 text-right w-24">Min Qty</th>
              <th className="px-2 py-1.5 text-right w-28">Unit Price</th>
              <th className="px-2 py-1.5 text-left w-16">UOM</th>
              <th className="w-7" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  No items listed. Click "+ Add Item" to add products this supplier can supply.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row._key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.itemCode}
                    onChange={(e) => update(row._key, 'itemCode', e.target.value)}
                    className="erp-input w-full text-xs font-mono"
                    placeholder="Code"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) => update(row._key, 'description', e.target.value)}
                    className="erp-input w-full text-xs"
                    placeholder="Item description"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.category}
                    onChange={(e) => update(row._key, 'category', e.target.value)}
                    className="erp-input w-full text-xs"
                    placeholder="Category"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    value={row.leadTimeDays}
                    min={0}
                    onChange={(e) => update(row._key, 'leadTimeDays', Number(e.target.value))}
                    className="erp-input w-full text-right text-xs"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    value={row.minOrderQty}
                    min={0}
                    onChange={(e) => update(row._key, 'minOrderQty', Number(e.target.value))}
                    className="erp-input w-full text-right text-xs"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    value={row.unitPrice}
                    min={0}
                    step="0.001"
                    onChange={(e) => update(row._key, 'unitPrice', Number(e.target.value))}
                    className="erp-input w-full text-right text-xs"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.uom}
                    onChange={(e) => update(row._key, 'uom', e.target.value)}
                    className="erp-input w-full text-xs"
                    placeholder="Nos"
                  />
                </td>
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => removeRow(row._key)}
                    className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. Bank Payment Tab
// ══════════════════════════════════════════════════════════════════════════════
export interface BankPaymentData {
  preferredBankId: string;
  paymentReferenceFormat: string;
  autoPayment: boolean;
  paymentApprovalRequired: boolean;
  maxSinglePayment: number;
  paymentInstructions: string;
}

interface BankPaymentTabProps {
  data: BankPaymentData;
  bankNames: string[];
  onChange: (data: BankPaymentData) => void;
}

export function BankPaymentTab({ data, bankNames, onChange }: BankPaymentTabProps) {
  const set = (field: keyof BankPaymentData, value: unknown) =>
    onChange({ ...data, [field]: value });

  const bankOptions = bankNames.length
    ? bankNames.map((n) => ({ value: n, label: n }))
    : [{ value: '', label: '— No banks on file —' }];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
        <Building2 size={12} /> Bank Payment Settings
      </p>
      <div className="grid grid-cols-3 gap-x-8 gap-y-3">
        <FormField label="Preferred Bank Account" hint="From Bank Details tab">
          <Select
            options={bankOptions}
            placeholder="Select bank"
            value={data.preferredBankId}
            onChange={(e) => set('preferredBankId', e.target.value)}
          />
        </FormField>

        <FormField label="Payment Reference Format" hint="e.g. {SUPPLIER_CODE}-{INVOICE_NO}">
          <Input
            type="text"
            value={data.paymentReferenceFormat}
            onChange={(e) => set('paymentReferenceFormat', e.target.value)}
            placeholder="{SUPPLIER_CODE}-{INVOICE_NO}"
          />
        </FormField>

        <FormField label="Max Single Payment Amount">
          <Input
            type="number"
            min={0}
            step="0.001"
            value={data.maxSinglePayment}
            onChange={(e) => set('maxSinglePayment', Number(e.target.value))}
            className="text-right"
          />
        </FormField>

        <FormField label="Auto Payment">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={data.autoPayment}
              onChange={(e) => set('autoPayment', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-xs text-gray-600">Generate payments automatically on due date</span>
          </label>
        </FormField>

        <FormField label="Approval Required">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={data.paymentApprovalRequired}
              onChange={(e) => set('paymentApprovalRequired', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-xs text-gray-600">Require approval before releasing payment</span>
          </label>
        </FormField>

        <FormField label="Payment Instructions" className="col-span-3">
          <Textarea
            rows={3}
            value={data.paymentInstructions}
            onChange={(e) => set('paymentInstructions', e.target.value)}
            placeholder="Special instructions for the accounts team…"
          />
        </FormField>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. Incoterm Tab
// ══════════════════════════════════════════════════════════════════════════════
export interface IncotermData {
  incoterm: string;
  deliveryPort: string;
  freightTerms: string;
  insuranceBy: string;
  customsClearanceBy: string;
  incotermNotes: string;
}

interface IncotermTabProps {
  data: IncotermData;
  onChange: (data: IncotermData) => void;
}

const INCOTERM_OPTIONS = [
  { value: 'EXW', label: 'EXW – Ex Works' },
  { value: 'FCA', label: 'FCA – Free Carrier' },
  { value: 'CPT', label: 'CPT – Carriage Paid To' },
  { value: 'CIP', label: 'CIP – Carriage and Insurance Paid To' },
  { value: 'DAP', label: 'DAP – Delivered at Place' },
  { value: 'DPU', label: 'DPU – Delivered at Place Unloaded' },
  { value: 'DDP', label: 'DDP – Delivered Duty Paid' },
  { value: 'FAS', label: 'FAS – Free Alongside Ship' },
  { value: 'FOB', label: 'FOB – Free on Board' },
  { value: 'CFR', label: 'CFR – Cost and Freight' },
  { value: 'CIF', label: 'CIF – Cost, Insurance and Freight' },
];

const PARTY_OPTIONS = [
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'BUYER', label: 'Buyer / Us' },
  { value: 'SHARED', label: 'Shared' },
];

export function IncotermTab({ data, onChange }: IncotermTabProps) {
  const set = (field: keyof IncotermData, value: string) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
        <Anchor size={12} /> Trade &amp; Delivery Terms (Incoterms 2020)
      </p>
      <div className="grid grid-cols-3 gap-x-8 gap-y-3">
        <FormField label="Default Incoterm">
          <Select
            options={INCOTERM_OPTIONS}
            placeholder="Select incoterm"
            value={data.incoterm}
            onChange={(e) => set('incoterm', e.target.value)}
          />
        </FormField>

        <FormField label="Delivery Port / Place">
          <Input
            type="text"
            value={data.deliveryPort}
            onChange={(e) => set('deliveryPort', e.target.value)}
            placeholder="e.g. Jeddah Islamic Port"
          />
        </FormField>

        <FormField label="Freight Terms">
          <Input
            type="text"
            value={data.freightTerms}
            onChange={(e) => set('freightTerms', e.target.value)}
            placeholder="e.g. Freight included"
          />
        </FormField>

        <FormField label="Insurance By">
          <Select
            options={PARTY_OPTIONS}
            placeholder="Select party"
            value={data.insuranceBy}
            onChange={(e) => set('insuranceBy', e.target.value)}
          />
        </FormField>

        <FormField label="Customs Clearance By">
          <Select
            options={PARTY_OPTIONS}
            placeholder="Select party"
            value={data.customsClearanceBy}
            onChange={(e) => set('customsClearanceBy', e.target.value)}
          />
        </FormField>

        <FormField label="Notes" className="col-span-3">
          <Textarea
            rows={2}
            value={data.incotermNotes}
            onChange={(e) => set('incotermNotes', e.target.value)}
            placeholder="Additional trade term notes…"
          />
        </FormField>
      </div>

      {data.incoterm && (
        <div className="rounded bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
          <strong>{data.incoterm}</strong>
          {data.deliveryPort && ` — ${data.deliveryPort}`}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. Finance Group Tab
// ══════════════════════════════════════════════════════════════════════════════
export interface FinanceGroupData {
  financeGroup: string;
  costCentre: string;
  budgetCategory: string;
  taxGroup: string;
  vatRegistrationNo: string;
  taxExempt: boolean;
  withholdingTaxGroup: string;
}

interface FinanceGroupTabProps {
  data: FinanceGroupData;
  onChange: (data: FinanceGroupData) => void;
}

const FINANCE_GROUP_OPTIONS = [
  { value: 'LOCAL', label: 'Local Supplier' },
  { value: 'FOREIGN', label: 'Foreign Supplier' },
  { value: 'INTERCOMPANY', label: 'Inter-Company' },
  { value: 'GOVERNMENT', label: 'Government / Semi-Govt.' },
  { value: 'INDIVIDUAL', label: 'Individual / Proprietor' },
];

const TAX_GROUP_OPTIONS = [
  { value: 'STANDARD', label: 'Standard Rate (15%)' },
  { value: 'ZERO', label: 'Zero Rated' },
  { value: 'EXEMPT', label: 'Exempt' },
  { value: 'OUT_OF_SCOPE', label: 'Out of Scope' },
];

export function FinanceGroupTab({ data, onChange }: FinanceGroupTabProps) {
  const set = (field: keyof FinanceGroupData, value: unknown) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
        <Layers size={12} /> Finance Classification
      </p>
      <div className="grid grid-cols-3 gap-x-8 gap-y-3">
        <FormField label="Finance Group">
          <Select
            options={FINANCE_GROUP_OPTIONS}
            placeholder="Select group"
            value={data.financeGroup}
            onChange={(e) => set('financeGroup', e.target.value)}
          />
        </FormField>

        <FormField label="Cost Centre" hint="Default cost centre for this supplier">
          <Input
            type="text"
            value={data.costCentre}
            onChange={(e) => set('costCentre', e.target.value)}
            placeholder="Cost centre code"
          />
        </FormField>

        <FormField label="Budget Category">
          <Input
            type="text"
            value={data.budgetCategory}
            onChange={(e) => set('budgetCategory', e.target.value)}
            placeholder="e.g. CAPEX, OPEX"
          />
        </FormField>

        <FormField label="VAT / Tax Group">
          <Select
            options={TAX_GROUP_OPTIONS}
            placeholder="Select tax group"
            value={data.taxGroup}
            onChange={(e) => set('taxGroup', e.target.value)}
          />
        </FormField>

        <FormField label="VAT Registration No.">
          <Input
            type="text"
            value={data.vatRegistrationNo}
            onChange={(e) => set('vatRegistrationNo', e.target.value)}
            placeholder="e.g. 300XXXXXXXXXXX003"
          />
        </FormField>

        <FormField label="Withholding Tax Group">
          <Input
            type="text"
            value={data.withholdingTaxGroup}
            onChange={(e) => set('withholdingTaxGroup', e.target.value)}
            placeholder="WHT group code"
          />
        </FormField>

        <FormField label="Tax Exempt" className="col-span-3">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={data.taxExempt}
              onChange={(e) => set('taxExempt', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-xs text-gray-600">This supplier is tax exempt — do not calculate VAT on purchases</span>
          </label>
        </FormField>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. Address Tab
// ══════════════════════════════════════════════════════════════════════════════
export interface AddressData {
  billingStreet: string;
  billingCity: string;
  billingState: string;
  billingCountry: string;
  billingPostalCode: string;
  shippingSameAsBilling: boolean;
  shippingStreet: string;
  shippingCity: string;
  shippingState: string;
  shippingCountry: string;
  shippingPostalCode: string;
}

interface AddressTabProps {
  data: AddressData;
  onChange: (data: AddressData) => void;
}

export function AddressTab({ data, onChange }: AddressTabProps) {
  const set = (field: keyof AddressData, value: unknown) =>
    onChange({ ...data, [field]: value });

  const copyBillingToShipping = () => {
    onChange({
      ...data,
      shippingStreet: data.billingStreet,
      shippingCity: data.billingCity,
      shippingState: data.billingState,
      shippingCountry: data.billingCountry,
      shippingPostalCode: data.billingPostalCode,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
        <MapPin size={12} /> Supplier Addresses
      </p>

      {/* Billing Address */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Billing / Registered Address</p>
        <div className="grid grid-cols-3 gap-x-6 gap-y-3">
          <FormField label="Street / P.O. Box" className="col-span-3">
            <Input
              type="text"
              value={data.billingStreet}
              onChange={(e) => set('billingStreet', e.target.value)}
              placeholder="Street address or P.O. Box"
            />
          </FormField>
          <FormField label="City">
            <Input
              type="text"
              value={data.billingCity}
              onChange={(e) => set('billingCity', e.target.value)}
              placeholder="City"
            />
          </FormField>
          <FormField label="State / Province">
            <Input
              type="text"
              value={data.billingState}
              onChange={(e) => set('billingState', e.target.value)}
              placeholder="State"
            />
          </FormField>
          <FormField label="Postal Code">
            <Input
              type="text"
              value={data.billingPostalCode}
              onChange={(e) => set('billingPostalCode', e.target.value)}
              placeholder="Postal / ZIP code"
            />
          </FormField>
          <FormField label="Country">
            <Input
              type="text"
              value={data.billingCountry}
              onChange={(e) => set('billingCountry', e.target.value)}
              placeholder="Country"
            />
          </FormField>
        </div>
      </div>

      {/* Shipping Address */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Shipping / Delivery Address</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
              <input
                type="checkbox"
                checked={data.shippingSameAsBilling}
                onChange={(e) => {
                  set('shippingSameAsBilling', e.target.checked);
                  if (e.target.checked) copyBillingToShipping();
                }}
                className="rounded border-gray-300"
              />
              Same as billing
            </label>
            {!data.shippingSameAsBilling && (
              <button type="button" onClick={copyBillingToShipping} className="toolbar-btn text-xs">
                Copy from Billing
              </button>
            )}
          </div>
        </div>
        <div className={`grid grid-cols-3 gap-x-6 gap-y-3 ${data.shippingSameAsBilling ? 'opacity-40 pointer-events-none' : ''}`}>
          <FormField label="Street / P.O. Box" className="col-span-3">
            <Input
              type="text"
              value={data.shippingSameAsBilling ? data.billingStreet : data.shippingStreet}
              onChange={(e) => set('shippingStreet', e.target.value)}
              placeholder="Street address or P.O. Box"
              readOnly={data.shippingSameAsBilling}
            />
          </FormField>
          <FormField label="City">
            <Input
              type="text"
              value={data.shippingSameAsBilling ? data.billingCity : data.shippingCity}
              onChange={(e) => set('shippingCity', e.target.value)}
              placeholder="City"
              readOnly={data.shippingSameAsBilling}
            />
          </FormField>
          <FormField label="State / Province">
            <Input
              type="text"
              value={data.shippingSameAsBilling ? data.billingState : data.shippingState}
              onChange={(e) => set('shippingState', e.target.value)}
              placeholder="State"
              readOnly={data.shippingSameAsBilling}
            />
          </FormField>
          <FormField label="Postal Code">
            <Input
              type="text"
              value={data.shippingSameAsBilling ? data.billingPostalCode : data.shippingPostalCode}
              onChange={(e) => set('shippingPostalCode', e.target.value)}
              placeholder="Postal / ZIP code"
              readOnly={data.shippingSameAsBilling}
            />
          </FormField>
          <FormField label="Country">
            <Input
              type="text"
              value={data.shippingSameAsBilling ? data.billingCountry : data.shippingCountry}
              onChange={(e) => set('shippingCountry', e.target.value)}
              placeholder="Country"
              readOnly={data.shippingSameAsBilling}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 11. More Tab (additional/misc fields)
// ══════════════════════════════════════════════════════════════════════════════
export interface MoreData {
  website: string;
  taxRegNo: string;
  tradeLicenseNo: string;
  tradeLicenseExpiry: string;
  isoCertification: string;
  isoExpiry: string;
  supplierCategory: string;
  ratingScore: number;
  blacklisted: boolean;
  blacklistReason: string;
}

interface MoreTabProps {
  data: MoreData;
  onChange: (data: MoreData) => void;
}

const SUPPLIER_CATEGORY_OPTIONS = [
  { value: 'A', label: 'A – Strategic' },
  { value: 'B', label: 'B – Preferred' },
  { value: 'C', label: 'C – Approved' },
  { value: 'D', label: 'D – Provisional' },
];

export function MoreTab({ data, onChange }: MoreTabProps) {
  const set = (field: keyof MoreData, value: unknown) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
        <Globe size={12} /> Additional Information
      </p>

      <div className="grid grid-cols-3 gap-x-8 gap-y-3">
        <FormField label="Website">
          <Input
            type="url"
            value={data.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="https://supplier.com"
          />
        </FormField>

        <FormField label="Tax Registration No.">
          <Input
            type="text"
            value={data.taxRegNo}
            onChange={(e) => set('taxRegNo', e.target.value)}
            placeholder="Tax / CRN number"
          />
        </FormField>

        <FormField label="Trade License No.">
          <Input
            type="text"
            value={data.tradeLicenseNo}
            onChange={(e) => set('tradeLicenseNo', e.target.value)}
            placeholder="Trade license number"
          />
        </FormField>

        <FormField label="Trade License Expiry">
          <Input
            type="date"
            value={data.tradeLicenseExpiry}
            onChange={(e) => set('tradeLicenseExpiry', e.target.value)}
          />
        </FormField>

        <FormField label="ISO Certification">
          <Input
            type="text"
            value={data.isoCertification}
            onChange={(e) => set('isoCertification', e.target.value)}
            placeholder="e.g. ISO 9001:2015"
          />
        </FormField>

        <FormField label="ISO Expiry Date">
          <Input
            type="date"
            value={data.isoExpiry}
            onChange={(e) => set('isoExpiry', e.target.value)}
          />
        </FormField>

        <FormField label="Supplier Category">
          <Select
            options={SUPPLIER_CATEGORY_OPTIONS}
            placeholder="Select category"
            value={data.supplierCategory}
            onChange={(e) => set('supplierCategory', e.target.value)}
          />
        </FormField>

        <FormField label="Rating Score (0–100)">
          <Input
            type="number"
            min={0}
            max={100}
            value={data.ratingScore}
            onChange={(e) => set('ratingScore', Number(e.target.value))}
            className="text-right"
          />
        </FormField>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <FormField label="Blacklisted">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={data.blacklisted}
              onChange={(e) => set('blacklisted', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-xs text-red-600 font-medium">Mark supplier as blacklisted</span>
          </label>
        </FormField>
        {data.blacklisted && (
          <FormField label="Blacklist Reason" className="mt-3">
            <Textarea
              rows={2}
              value={data.blacklistReason}
              onChange={(e) => set('blacklistReason', e.target.value)}
              placeholder="Reason for blacklisting…"
            />
          </FormField>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 12. Applicable Tab
// ══════════════════════════════════════════════════════════════════════════════
export interface ApplicableData {
  applicableGoods: boolean;
  applicableServices: boolean;
  applicableWorks: boolean;
  applicableTrade: boolean;
  applicableConsulting: boolean;
  applicableLogistics: boolean;
  approvedFor: string[];
  tags: string;
  effectiveFrom: string;
  effectiveTo: string;
}

interface ApplicableTabProps {
  data: ApplicableData;
  onChange: (data: ApplicableData) => void;
}

export function ApplicableTab({ data, onChange }: ApplicableTabProps) {
  const set = (field: keyof ApplicableData, value: unknown) =>
    onChange({ ...data, [field]: value });

  const categories = [
    { field: 'applicableGoods' as const, label: 'Goods / Materials', desc: 'Supply of physical goods, raw materials, spare parts' },
    { field: 'applicableServices' as const, label: 'Services', desc: 'Provision of services (maintenance, repair, professional)' },
    { field: 'applicableWorks' as const, label: 'Civil / Mechanical Works', desc: 'Construction, civil, or mechanical works contracts' },
    { field: 'applicableTrade' as const, label: 'Trading / Resale', desc: 'Trading of goods for resale' },
    { field: 'applicableConsulting' as const, label: 'Consulting / Advisory', desc: 'Consulting, advisory, and management services' },
    { field: 'applicableLogistics' as const, label: 'Logistics / Transport', desc: 'Freight, logistics, clearing and forwarding' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
        <Tag size={12} /> Supplier Applicability
      </p>

      <div>
        <p className="text-xs text-gray-500 mb-2">Select the categories this supplier is applicable for:</p>
        <div className="grid grid-cols-2 gap-2">
          {categories.map(({ field, label, desc }) => (
            <label
              key={field}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                data[field]
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={!!data[field]}
                onChange={(e) => set(field, e.target.checked)}
                className="rounded border-gray-300 mt-0.5"
              />
              <div>
                <p className="text-xs font-medium text-gray-800">{label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-8 gap-y-3 border-t border-gray-200 pt-4">
        <FormField label="Tags" hint="Comma-separated keywords" className="col-span-2">
          <Input
            type="text"
            value={data.tags}
            onChange={(e) => set('tags', e.target.value)}
            placeholder="e.g. electrical, approved, ISO-certified"
          />
        </FormField>

        <div />

        <FormField label="Effective From">
          <Input
            type="date"
            value={data.effectiveFrom}
            onChange={(e) => set('effectiveFrom', e.target.value)}
          />
        </FormField>

        <FormField label="Effective To" hint="Leave blank for no expiry">
          <Input
            type="date"
            value={data.effectiveTo}
            onChange={(e) => set('effectiveTo', e.target.value)}
          />
        </FormField>
      </div>
    </div>
  );
}
