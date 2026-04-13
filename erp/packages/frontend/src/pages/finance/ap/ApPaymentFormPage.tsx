import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { useCreateApPayment, useApInvoiceList } from '../../../api/finance';
import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { useToast } from '../../../components/ui/Toast';
import api from '../../../api/client';

const PAYMENT_METHODS = ['BANK_TRANSFER', 'CHEQUE', 'CASH'];

export default function ApPaymentFormPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const createMut = useCreateApPayment();

  const today = format(new Date(), 'yyyy-MM-dd');
  const [supplier,       setSupplier]       = useState<LookupOption | null>(null);
  const [paymentDate,    setPaymentDate]     = useState(today);
  const [paymentMethod,  setPaymentMethod]   = useState('BANK_TRANSFER');
  const [notes,          setNotes]           = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Record<string, number>>({});

  // Load unpaid invoices for selected supplier
  const { data: invoiceData } = useApInvoiceList({
    supplierId: supplier?.value,
    status: 'APPROVED',
    page: 1, limit: 100,
  });

  const openInvoices: any[] = useMemo(() =>
    (invoiceData?.data ?? []).filter((inv: any) => !['PAID', 'CANCELLED'].includes(inv.status)),
    [invoiceData]
  );

  const totalAllocated = useMemo(() =>
    Object.values(selectedInvoices).reduce((s, a) => s + a, 0),
    [selectedInvoices]
  );

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
        // Default allocation = outstanding balance
        next[inv.id] = Number(inv.totalAmount) - Number(inv.paidAmount ?? 0);
      }
      return next;
    });
  };

  const setAllocation = (invoiceId: string, val: number) => {
    setSelectedInvoices((prev) => ({ ...prev, [invoiceId]: val }));
  };

  // Select all open invoices
  const selectAll = () => {
    const next: Record<string, number> = {};
    openInvoices.forEach((inv) => {
      next[inv.id] = Number(inv.totalAmount) - Number(inv.paidAmount ?? 0);
    });
    setSelectedInvoices(next);
  };
  const clearAll = () => setSelectedInvoices({});

  const handleSubmit = async () => {
    if (!supplier) { addToast({ type: 'error', message: 'Supplier is required' }); return; }
    if (totalAllocated <= 0) { addToast({ type: 'error', message: 'Select at least one invoice to allocate' }); return; }
    const allocations = Object.entries(selectedInvoices)
      .filter(([, amt]) => amt > 0)
      .map(([invoiceId, amount]) => ({ invoiceId, amount }));
    try {
      const pmt = await createMut.mutateAsync({
        supplierId: supplier.value,
        paymentDate,
        amount: totalAllocated,
        paymentMethod,
        notes: notes || undefined,
        allocations,
      });
      addToast({ type: 'success', message: `Payment ${pmt?.docNo ?? ''} recorded` });
      navigate('/finance/ap/payments');
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Payment failed' });
    }
  };

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 3 });

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="New AP Payment"
        actions={[{
          id: 'save', label: createMut.isPending ? 'Saving…' : 'Post Payment',
          onClick: handleSubmit, variant: 'primary',
          disabled: createMut.isPending || !supplier || totalAllocated <= 0,
        }]}
        onNew={() => {
          setSupplier(null);
          setSelectedInvoices({});
          setNotes('');
        }}
      />

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-5xl mx-auto space-y-5">
          {/* Header fields */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Payment Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="erp-label">Supplier <span className="erp-required-star">*</span></label>
                <LookupField value={supplier} onChange={setSupplier} onSearch={searchSuppliers} placeholder="Search supplier…" />
              </div>
              <div>
                <label className="erp-label">Payment Date <span className="erp-required-star">*</span></label>
                <input type="date" className="erp-input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div>
                <label className="erp-label">Payment Method <span className="erp-required-star">*</span></label>
                <select className="erp-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="erp-label">Notes</label>
                <input className="erp-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional payment reference or notes" />
              </div>
            </div>
          </div>

          {/* Invoice allocation table */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-1">Allocate to Invoices</h3>
              {openInvoices.length > 0 && (
                <>
                  <button onClick={selectAll} className="toolbar-btn text-xs">Select All</button>
                  <button onClick={clearAll}  className="toolbar-btn text-xs">Clear</button>
                </>
              )}
            </div>

            {!supplier ? (
              <div className="py-10 text-center text-sm text-gray-400">Select a supplier to view open invoices</div>
            ) : openInvoices.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No open invoices for this supplier</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left w-8"></th>
                    <th className="px-3 py-2 text-left">Invoice No</th>
                    <th className="px-3 py-2 text-left">Supplier Inv No</th>
                    <th className="px-3 py-2 text-right">Invoice Date</th>
                    <th className="px-3 py-2 text-right">Due Date</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2 text-right">Allocate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {openInvoices.map((inv) => {
                    const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount ?? 0);
                    const isSelected = selectedInvoices[inv.id] !== undefined;
                    return (
                      <tr key={inv.id} className={clsx(isSelected && 'bg-blue-50')}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleInvoice(inv)}
                            className="rounded border-gray-300 text-[#1F4E79]"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-blue-700">{inv.docNo}</td>
                        <td className="px-3 py-2 text-gray-600">{inv.supplierInvoiceNo}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{format(new Date(inv.invoiceDate), 'dd/MM/yyyy')}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{format(new Date(inv.dueDate), 'dd/MM/yyyy')}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(Number(inv.totalAmount))}</td>
                        <td className={clsx('px-3 py-2 text-right font-medium', outstanding > 0 ? 'text-red-600' : 'text-green-600')}>
                          {fmt(outstanding)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isSelected ? (
                            <input
                              type="number"
                              className="erp-input text-right w-28 ml-auto"
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
            )}

            {/* Summary footer */}
            {totalAllocated > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-blue-50">
                <span className="text-sm text-gray-600">
                  {Object.keys(selectedInvoices).length} invoice{Object.keys(selectedInvoices).length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-6">
                  <span className="text-sm font-semibold text-gray-700">
                    Total Payment: <span className="text-[#1F4E79] text-base">{fmt(totalAllocated)}</span>
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
