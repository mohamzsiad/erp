import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, X, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import {
  useApInvoiceDetail, useCreateApInvoice, useApproveApInvoice, useCancelApInvoice,
} from '../../../api/finance';
import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { KeyInfoItemDetailsTabs, KeyInfoGrid } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { useToast } from '../../../components/ui/Toast';
import api from '../../../api/client';

// ── 3-Way Match Indicator ─────────────────────────────────────────────────────
interface ThreeWayMatchProps {
  poAmount: number | null;
  grnRef: string | null;
  invoiceAmount: number;
  matchFlag: string | null;
}

export const ThreeWayMatch: React.FC<ThreeWayMatchProps> = ({ poAmount, grnRef, invoiceAmount, matchFlag }) => {
  const fmt = (n: number | null) => n != null ? n.toLocaleString(undefined, { minimumFractionDigits: 3 }) : '—';
  const diff = poAmount != null ? Math.abs(invoiceAmount - poAmount) : null;
  const tolerance = poAmount != null ? poAmount * 0.005 : null;
  const isMatched = matchFlag === 'MATCHED' || (diff != null && tolerance != null && diff <= tolerance);

  if (!poAmount && !grnRef) return null;

  return (
    <div className={clsx(
      'rounded-lg border p-3 mt-3',
      isMatched ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
    )}>
      <div className="flex items-center gap-2 mb-2">
        {isMatched
          ? <Check size={15} className="text-green-600" />
          : <X size={15} className="text-red-500" />}
        <span className={clsx('text-xs font-semibold', isMatched ? 'text-green-700' : 'text-red-700')}>
          3-Way Match: {matchFlag ?? (isMatched ? 'MATCHED' : 'MISMATCH')}
        </span>
        {diff != null && !isMatched && (
          <span className="ml-auto text-xs text-red-600">
            Variance: {fmt(diff)} ({tolerance != null ? ((diff / poAmount!) * 100).toFixed(2) : '—'}%)
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-white rounded border p-2">
          <p className="text-gray-500 mb-0.5">PO Value</p>
          <p className="font-semibold text-gray-800">{fmt(poAmount)}</p>
        </div>
        <div className="bg-white rounded border p-2">
          <p className="text-gray-500 mb-0.5">GRN Ref</p>
          <p className="font-semibold text-gray-800">{grnRef ?? '—'}</p>
        </div>
        <div className={clsx('rounded border p-2', isMatched ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300')}>
          <p className="text-gray-500 mb-0.5">Invoice Value</p>
          <p className={clsx('font-semibold', isMatched ? 'text-green-700' : 'text-red-700')}>{fmt(invoiceAmount)}</p>
        </div>
      </div>
    </div>
  );
};

// ── Main Form ─────────────────────────────────────────────────────────────────
export default function ApInvoiceFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const isNew = !id || id === 'new';

  const { data: invoice } = useApInvoiceDetail(id ?? '');
  const createMut  = useCreateApInvoice();
  const approveMut = useApproveApInvoice();
  const cancelMut  = useCancelApInvoice();

  // ── Form state ─────────────────────────────────────────────────────────────
  const today = format(new Date(), 'yyyy-MM-dd');
  const [supplier,   setSupplier]   = useState<LookupOption | null>(null);
  const [po,         setPo]         = useState<LookupOption | null>(null);
  const [grn,        setGrn]        = useState<LookupOption | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate,    setDueDate]    = useState(today);
  const [supplierInvNo, setSupplierInvNo] = useState('');
  const [amount,     setAmount]     = useState<number>(0);
  const [taxAmount,  setTaxAmount]  = useState<number>(0);
  const totalAmount = amount + taxAmount;

  // Pre-fill from existing invoice
  React.useEffect(() => {
    if (invoice && !isNew) {
      setInvoiceDate(format(new Date(invoice.invoiceDate), 'yyyy-MM-dd'));
      setDueDate(format(new Date(invoice.dueDate), 'yyyy-MM-dd'));
      setSupplierInvNo(invoice.supplierInvoiceNo ?? '');
      setAmount(Number(invoice.amount));
      setTaxAmount(Number(invoice.taxAmount ?? 0));
    }
  }, [invoice, isNew]);

  const searchSuppliers = async (q: string) => {
    const r = await api.get('/procurement/suppliers', { params: { search: q, limit: 20 } });
    return (r.data?.data ?? []).map((s: any) => ({ value: s.id, label: `${s.code} – ${s.name}`, meta: s }));
  };
  const searchPOs = async (q: string) => {
    const r = await api.get('/procurement/po', { params: { search: q, limit: 20 } });
    return (r.data?.data ?? []).map((p: any) => ({
      value: p.id, label: `${p.docNo}`,
      subLabel: `OMR ${Number(p.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 3 })}`,
      meta: p,
    }));
  };
  const searchGRNs = async (q: string) => {
    const r = await api.get('/inventory/grn', { params: { search: q, limit: 20 } });
    return (r.data?.data ?? []).map((g: any) => ({ value: g.id, label: g.docNo, meta: g }));
  };

  const handleCreate = async () => {
    if (!supplier) { addToast({ type: 'error', message: 'Supplier is required' }); return; }
    if (!supplierInvNo) { addToast({ type: 'error', message: 'Supplier Invoice No is required' }); return; }
    if (amount <= 0) { addToast({ type: 'error', message: 'Amount must be > 0' }); return; }
    try {
      const inv = await createMut.mutateAsync({
        supplierId: supplier.value,
        poId: po?.value,
        grnId: grn?.value,
        supplierInvoiceNo: supplierInvNo,
        invoiceDate,
        dueDate,
        amount,
        taxAmount: taxAmount || undefined,
      });
      addToast({ type: 'success', message: `Invoice ${inv.docNo} created` });
      navigate(`/finance/ap/invoices/${inv.id}`);
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Create failed' });
    }
  };

  const handleApprove = async () => {
    if (!invoice || !confirm('Approve this invoice?')) return;
    try {
      await approveMut.mutateAsync(invoice.id);
      addToast({ type: 'success', message: 'Invoice approved' });
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Approve failed' });
    }
  };

  const handleCancel = async () => {
    if (!invoice || !confirm('Cancel this invoice? This will reverse the journal if one was posted.')) return;
    try {
      await cancelMut.mutateAsync(invoice.id);
      addToast({ type: 'success', message: 'Invoice cancelled' });
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Cancel failed' });
    }
  };

  const isDraft   = invoice?.status === 'DRAFT';
  const isActive  = invoice && !['CANCELLED', 'PAID'].includes(invoice.status);

  const poAmount  = invoice ? Number(invoice.po?.totalAmount ?? 0) : (po ? Number((po.meta as any)?.totalAmount ?? 0) : null);
  const grnDocNo  = invoice ? invoice.grn?.docNo : grn?.label ?? null;

  const keyInfo = !isNew ? (
    <KeyInfoGrid columns={5} items={[
      { label: 'Invoice No',  value: <span className="font-mono text-blue-700">{invoice?.docNo}</span> },
      { label: 'Supplier',    value: (invoice as any)?.supplier?.name ?? '—' },
      { label: 'Invoice Date',value: invoice ? format(new Date(invoice.invoiceDate), 'dd/MM/yyyy') : '—' },
      { label: 'Due Date',    value: invoice ? format(new Date(invoice.dueDate), 'dd/MM/yyyy') : '—' },
      { label: 'Status',      value: invoice ? <StatusBadge status={invoice.status} /> : '—' },
    ]} />
  ) : null;

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title={isNew ? 'New AP Invoice' : 'AP Invoice'}
        docNo={invoice?.docNo}
        status={invoice?.status ? <StatusBadge status={invoice.status} /> : undefined}
        actions={[
          ...(isNew ? [{ id: 'create', label: createMut.isPending ? 'Saving…' : 'Save', onClick: handleCreate, variant: 'primary' as const, disabled: createMut.isPending }] : []),
          ...(isDraft ? [{ id: 'approve', label: 'Approve', onClick: handleApprove, variant: 'success' as const }] : []),
          ...(isActive ? [{ id: 'cancel', label: 'Cancel Invoice', onClick: handleCancel, variant: 'danger' as const }] : []),
        ]}
        onNew={() => navigate('/finance/ap/invoices/new')}
      />

      <KeyInfoItemDetailsTabs
        className="flex-1"
        keyInfo={keyInfo}
        tabs={[
          {
            id: 'header',
            label: 'Invoice Details',
            content: (
              <div className="p-4 grid grid-cols-2 gap-6 max-w-4xl">
                {/* Left column */}
                <div className="space-y-4">
                  <div>
                    <label className="erp-label">Supplier <span className="erp-required-star">*</span></label>
                    {isNew ? (
                      <LookupField value={supplier} onChange={setSupplier} onSearch={searchSuppliers} placeholder="Search supplier…" />
                    ) : (
                      <input className="erp-input bg-gray-50" readOnly value={(invoice as any)?.supplier?.name ?? ''} />
                    )}
                  </div>
                  <div>
                    <label className="erp-label">Supplier Invoice No <span className="erp-required-star">*</span></label>
                    <input className="erp-input" value={supplierInvNo} onChange={(e) => setSupplierInvNo(e.target.value)} disabled={!isNew} placeholder="e.g. INV-2026-001" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="erp-label">Invoice Date <span className="erp-required-star">*</span></label>
                      <input type="date" className="erp-input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} disabled={!isNew} />
                    </div>
                    <div>
                      <label className="erp-label">Due Date <span className="erp-required-star">*</span></label>
                      <input type="date" className="erp-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!isNew} />
                    </div>
                  </div>
                  <div>
                    <label className="erp-label">PO Reference</label>
                    {isNew ? (
                      <LookupField value={po} onChange={setPo} onSearch={searchPOs} placeholder="Search PO…" />
                    ) : (
                      <input className="erp-input bg-gray-50" readOnly value={invoice?.po?.docNo ?? '—'} />
                    )}
                  </div>
                  <div>
                    <label className="erp-label">GRN Reference</label>
                    {isNew ? (
                      <LookupField value={grn} onChange={setGrn} onSearch={searchGRNs} placeholder="Search GRN…" />
                    ) : (
                      <input className="erp-input bg-gray-50" readOnly value={invoice?.grn?.docNo ?? '—'} />
                    )}
                  </div>
                </div>

                {/* Right column — amounts + 3-way match */}
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Amount Summary</h4>
                    <div>
                      <label className="erp-label">Net Amount <span className="erp-required-star">*</span></label>
                      <input
                        type="number"
                        className="erp-input text-right"
                        value={amount || ''}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        disabled={!isNew}
                        step="0.001"
                        min="0"
                        placeholder="0.000"
                      />
                    </div>
                    <div>
                      <label className="erp-label">Tax Amount</label>
                      <input
                        type="number"
                        className="erp-input text-right"
                        value={taxAmount || ''}
                        onChange={(e) => setTaxAmount(Number(e.target.value))}
                        disabled={!isNew}
                        step="0.001"
                        min="0"
                        placeholder="0.000"
                      />
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-700">Total Amount</span>
                        <span className="text-base font-bold text-[#1F4E79]">
                          {(isNew ? totalAmount : Number(invoice?.totalAmount ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                        </span>
                      </div>
                      {!isNew && invoice && (
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-500">Paid Amount</span>
                          <span className="text-sm font-medium text-green-600">
                            {Number(invoice.paidAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3-Way Match */}
                  <ThreeWayMatch
                    poAmount={poAmount || null}
                    grnRef={grnDocNo}
                    invoiceAmount={isNew ? totalAmount : Number(invoice?.totalAmount ?? 0)}
                    matchFlag={invoice?.matchFlag ?? null}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
