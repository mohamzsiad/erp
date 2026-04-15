import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { useCreateApPayment, useApInvoiceList, searchGlAccounts } from '../../../api/finance';
import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { useToast } from '../../../components/ui/Toast';
import api from '../../../api/client';
import { CreditCard, CheckCircle } from 'lucide-react';

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE',        label: 'Cheque' },
  { value: 'CASH',          label: 'Cash' },
];

export default function ApPaymentFormPage() {
  const navigate    = useNavigate();
  const toast = useToast();
  const createMut   = useCreateApPayment();

  const today = format(new Date(), 'yyyy-MM-dd');

  // ── Header state ───────────────────────────────────────────────────────────
  const [supplier,      setSupplier]      = useState<LookupOption | null>(null);
  const [paymentDate,   setPaymentDate]   = useState(today);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [bankAccount,   setBankAccount]   = useState<LookupOption | null>(null);
  const [chequeNo,      setChequeNo]      = useState('');
  const [notes,         setNotes]         = useState('');

  // ── Invoice allocation ─────────────────────────────────────────────────────
  const [selectedInvoices, setSelectedInvoices] = useState<Record<string, number>>({});

  const { data: invoiceData } = useApInvoiceList({
    supplierId: supplier?.value,
    status: 'APPROVED',
    page: 1, limit: 100,
  });

  const openInvoices: any[] = useMemo(() =>
    (invoiceData?.data ?? []).filter((inv: any) => !['PAID', 'CANCELLED'].includes(inv.status)),
    [invoiceData],
  );

  const totalAllocated = useMemo(() =>
    Object.values(selectedInvoices).reduce((s, a) => s + a, 0),
    [selectedInvoices],
  );

  // ── Helpers ────────────────────────────────────────────────────────────────
  const searchSuppliers = async (q: string) => {
    const r = await api.get('/procurement/suppliers', { params: { search: q, limit: 20 } });
    return (r.data?.data ?? []).map((s: any) => ({ value: s.id, label: `${s.code} – ${s.name}`, meta: s }));
  };

  const toggleInvoice = (inv: any) => {
    setSelectedInvoices((prev) => {
      const next = { ...prev };
      if (next[inv.id] !== undefined) {
        delete next[inv.id];
      } else {
        next[inv.id] = Number(inv.totalAmount) - Number(inv.paidAmount ?? 0);
      }
      return next;
    });
  };

  const setAllocation = (invoiceId: string, val: number) => {
    setSelectedInvoices((prev) => ({ ...prev, [invoiceId]: val }));
  };

  const selectAll = () => {
    const next: Record<string, number> = {};
    openInvoices.forEach((inv) => {
      next[inv.id] = Number(inv.totalAmount) - Number(inv.paidAmount ?? 0);
    });
    setSelectedInvoices(next);
  };
  const clearAll = () => setSelectedInvoices({});

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!supplier)           { toast.error('Supplier is required'); return; }
    if (totalAllocated <= 0) { toast.error('Select at least one invoice to allocate'); return; }
    if (paymentMethod === 'BANK_TRANSFER' && !bankAccount) {
      toast.error('Bank account is required for bank transfer'); return;
    }

    const allocations = Object.entries(selectedInvoices)
      .filter(([, amt]) => amt > 0)
      .map(([invoiceId, amount]) => ({ invoiceId, amount }));

    try {
      const pmt = await createMut.mutateAsync({
        supplierId:    supplier.value,
        paymentDate,
        amount:        totalAllocated,
        paymentMethod,
        bankAccountId: bankAccount?.value,
        notes:         notes || undefined,
        allocations,
      });
      toast.success(`Payment ${pmt?.docNo ?? ''} posted`);
      navigate('/finance/ap/payments');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Payment failed');
    }
  };

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 3 });

  const selectedCount = Object.keys(selectedInvoices).length;

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="New AP Payment"
        actions={[{
          id: 'save',
          label: createMut.isPending ? 'Posting…' : 'Post Payment',
          onClick: handleSubmit,
          variant: 'primary',
          disabled: createMut.isPending || !supplier || totalAllocated <= 0,
        }]}
        onNew={() => {
          setSupplier(null);
          setBankAccount(null);
          setSelectedInvoices({});
          setNotes('');
          setChequeNo('');
        }}
      />

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* ── Payment Details ── */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
              <CreditCard size={13} className="text-[#1F4E79]" /> Payment Details
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="erp-label">Supplier <span className="erp-required-star">*</span></label>
                <LookupField
                  value={supplier}
                  onChange={(opt) => { setSupplier(opt); setSelectedInvoices({}); }}
                  onSearch={searchSuppliers}
                  placeholder="Search supplier…"
                />
              </div>
              <div>
                <label className="erp-label">Payment Date <span className="erp-required-star">*</span></label>
                <input
                  type="date"
                  className="erp-input"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div>
                <label className="erp-label">Payment Method <span className="erp-required-star">*</span></label>
                <select
                  className="erp-input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Bank Account — required for BANK_TRANSFER */}
              <div>
                <label className="erp-label">
                  Bank Account {paymentMethod === 'BANK_TRANSFER' && <span className="erp-required-star">*</span>}
                </label>
                <LookupField
                  value={bankAccount}
                  onChange={setBankAccount}
                  onSearch={searchGlAccounts}
                  placeholder="Search bank GL account…"
                />
              </div>

              {/* Cheque No — shown for CHEQUE */}
              {paymentMethod === 'CHEQUE' && (
                <div>
                  <label className="erp-label">Cheque No</label>
                  <input
                    className="erp-input"
                    value={chequeNo}
                    onChange={(e) => setChequeNo(e.target.value)}
                    placeholder="e.g. CHQ-00123"
                  />
                </div>
              )}

              <div className={clsx(paymentMethod === 'CHEQUE' ? 'col-span-1' : 'col-span-2')}>
                <label className="erp-label">Notes / Reference</label>
                <input
                  className="erp-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Payment reference or memo"
                />
              </div>
            </div>
          </div>

          {/* ── Invoice Allocation ── */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-1">
                Allocate to Invoices
              </h3>
              {openInvoices.length > 0 && (
                <>
                  <button onClick={selectAll} className="toolbar-btn text-xs">Select All</button>
                  <button onClick={clearAll}  className="toolbar-btn text-xs">Clear</button>
                </>
              )}
            </div>

            {!supplier ? (
              <div className="py-10 text-center text-sm text-gray-400">
                Select a supplier to view open invoices
              </div>
            ) : openInvoices.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                No approved/outstanding invoices for this supplier
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left w-8" />
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Invoice No</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Supplier Inv No</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Invoice Date</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Due Date</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Total</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Outstanding</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 w-36">Allocate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {openInvoices.map((inv) => {
                      const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount ?? 0);
                      const isSelected  = selectedInvoices[inv.id] !== undefined;
                      const isOverdue   = inv.daysOverdue > 0;
                      return (
                        <tr key={inv.id} className={clsx(isSelected ? 'bg-blue-50' : 'hover:bg-gray-50')}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleInvoice(inv)}
                              className="rounded border-gray-300 text-[#1F4E79] accent-[#1F4E79]"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-blue-700 font-medium">{inv.docNo}</td>
                          <td className="px-3 py-2 text-gray-600">{inv.supplierInvoiceNo}</td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {format(new Date(inv.invoiceDate), 'dd/MM/yyyy')}
                          </td>
                          <td className={clsx('px-3 py-2 text-right font-medium', isOverdue ? 'text-red-600' : 'text-gray-600')}>
                            {format(new Date(inv.dueDate), 'dd/MM/yyyy')}
                            {isOverdue && <span className="ml-1 text-[10px]">({inv.daysOverdue}d)</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(Number(inv.totalAmount))}</td>
                          <td className={clsx('px-3 py-2 text-right tabular-nums font-medium', outstanding > 0 ? 'text-orange-600' : 'text-green-600')}>
                            {fmt(outstanding)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {isSelected ? (
                              <input
                                type="number"
                                className="erp-input text-right w-full py-1"
                                value={selectedInvoices[inv.id] || ''}
                                onChange={(e) => setAllocation(inv.id, Number(e.target.value))}
                                step="0.001"
                                min="0"
                                max={outstanding}
                              />
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Payment summary footer */}
            {totalAllocated > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-blue-50">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle size={15} className="text-blue-600" />
                  <span>
                    <strong>{selectedCount}</strong> invoice{selectedCount !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">
                    Method: <strong>{PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label}</strong>
                  </span>
                  <span className="text-sm font-bold text-[#1F4E79]">
                    Payment Total: {fmt(totalAllocated)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
