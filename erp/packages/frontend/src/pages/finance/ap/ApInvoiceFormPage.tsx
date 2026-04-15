import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, X, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import {
  useApInvoiceDetail, useCreateApInvoice, useApproveApInvoice, useCancelApInvoice,
  searchGlAccounts, searchCostCenters,
} from '../../../api/finance';
import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { KeyInfoItemDetailsTabs, KeyInfoGrid } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { useToast } from '../../../components/ui/Toast';
import api from '../../../api/client';

// ── 3-Way Match ────────────────────────────────────────────────────────────────
interface ThreeWayMatchProps {
  poAmount: number | null;
  grnRef:   string | null;
  invoiceAmount: number;
  matchFlag: string | null;
}

export const ThreeWayMatch: React.FC<ThreeWayMatchProps> = ({ poAmount, grnRef, invoiceAmount, matchFlag }) => {
  const fmt   = (n: number | null) => n != null ? n.toLocaleString(undefined, { minimumFractionDigits: 3 }) : '—';
  const diff  = poAmount != null ? Math.abs(invoiceAmount - poAmount) : null;
  const tol   = poAmount != null ? poAmount * 0.005 : null;
  const isOk  = matchFlag === 'MATCHED' || (diff != null && tol != null && diff <= tol);

  if (!poAmount && !grnRef) return null;

  return (
    <div className={clsx('rounded-lg border p-3', isOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
      <div className="flex items-center gap-2 mb-2">
        {isOk
          ? <Check size={14} className="text-green-600" />
          : <X    size={14} className="text-red-500" />}
        <span className={clsx('text-xs font-semibold', isOk ? 'text-green-700' : 'text-red-700')}>
          3-Way Match: {matchFlag ?? (isOk ? 'MATCHED' : 'MISMATCH')}
        </span>
        {diff != null && !isOk && (
          <span className="ml-auto text-xs text-red-600">
            Variance: {fmt(diff)} ({poAmount ? ((diff / poAmount) * 100).toFixed(2) : '—'}%)
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
        <div className={clsx('rounded border p-2', isOk ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300')}>
          <p className="text-gray-500 mb-0.5">Invoice Value</p>
          <p className={clsx('font-semibold', isOk ? 'text-green-700' : 'text-red-700')}>{fmt(invoiceAmount)}</p>
        </div>
      </div>
    </div>
  );
};

// ── Distribution Line ─────────────────────────────────────────────────────────
interface DistLine {
  _id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  costCenterId: string;
  costCenterName: string;
  description: string;
  amount: number;
  taxPct: number;
}

function emptyLine(): DistLine {
  return {
    _id: crypto.randomUUID(),
    accountId: '', accountCode: '', accountName: '',
    costCenterId: '', costCenterName: '',
    description: '', amount: 0, taxPct: 0,
  };
}

// ── Account / CC lookup overlays ───────────────────────────────────────────────
interface LookupOverlayProps {
  anchor: { top: number; left: number };
  onSearch: (q: string) => Promise<LookupOption[]>;
  onSelect: (opt: LookupOption) => void;
  onClose: () => void;
  placeholder: string;
}
const LookupOverlay: React.FC<LookupOverlayProps> = ({ anchor, onSearch, onSelect, onClose, placeholder }) => (
  <div
    className="fixed z-50"
    style={{ top: anchor.top - 8, left: anchor.left - 8, width: 280 }}
    onClick={(e) => e.stopPropagation()}
  >
    <div className="bg-white border border-blue-500 rounded shadow-xl p-2">
      <LookupField
        value={null}
        onChange={(opt) => { if (opt) onSelect(opt); else onClose(); }}
        onSearch={onSearch}
        placeholder={placeholder}
      />
    </div>
  </div>
);

// ── Main form ─────────────────────────────────────────────────────────────────
export default function ApInvoiceFormPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew    = !id || id === 'new';

  const { data: invoice } = useApInvoiceDetail(id ?? '');
  const createMut  = useCreateApInvoice();
  const approveMut = useApproveApInvoice();
  const cancelMut  = useCancelApInvoice();

  // ── Header state ───────────────────────────────────────────────────────────
  const today = format(new Date(), 'yyyy-MM-dd');
  const [supplier,      setSupplier]      = useState<LookupOption | null>(null);
  const [po,            setPo]            = useState<LookupOption | null>(null);
  const [grn,           setGrn]           = useState<LookupOption | null>(null);
  const [invoiceDate,   setInvoiceDate]   = useState(today);
  const [dueDate,       setDueDate]       = useState(today);
  const [supplierInvNo, setSupplierInvNo] = useState('');

  // ── Distribution lines ────────────────────────────────────────────────────
  const [lines, setLines] = useState<DistLine[]>([emptyLine()]);
  const [acctOverlay, setAcctOverlay] = useState<{ lineId: string; anchor: { top: number; left: number } } | null>(null);
  const [ccOverlay,   setCcOverlay]   = useState<{ lineId: string; anchor: { top: number; left: number } } | null>(null);

  const updateLine = useCallback((id: string, patch: Partial<DistLine>) => {
    setLines(prev => prev.map(l => l._id === id ? { ...l, ...patch } : l));
  }, []);

  const deleteLine = useCallback((id: string) => {
    setLines(prev => prev.length > 1 ? prev.filter(l => l._id !== id) : prev);
  }, []);

  const addLine = () => setLines(prev => [...prev, emptyLine()]);

  // ── Derived totals ────────────────────────────────────────────────────────
  const subtotal  = useMemo(() => lines.reduce((s, l) => s + (l.amount || 0), 0), [lines]);
  const taxTotal  = useMemo(() => lines.reduce((s, l) => s + ((l.amount || 0) * (l.taxPct || 0) / 100), 0), [lines]);
  const grandTotal = subtotal + taxTotal;

  // ── Pre-fill from existing invoice ────────────────────────────────────────
  React.useEffect(() => {
    if (invoice && !isNew) {
      setInvoiceDate(format(new Date(invoice.invoiceDate), 'yyyy-MM-dd'));
      setDueDate(format(new Date(invoice.dueDate), 'yyyy-MM-dd'));
      setSupplierInvNo(invoice.supplierInvoiceNo ?? '');
      // Reconstruct a single distribution line from stored amount/tax
      setLines([{
        ...emptyLine(),
        amount: Number(invoice.amount),
        taxPct: invoice.taxAmount && invoice.amount
          ? Math.round((Number(invoice.taxAmount) / Number(invoice.amount)) * 100 * 10) / 10
          : 0,
      }]);
    }
  }, [invoice, isNew]);

  // ── Lookups ───────────────────────────────────────────────────────────────
  const searchSuppliers = async (q: string) => {
    const r = await api.get('/procurement/suppliers', { params: { search: q, limit: 20 } });
    return (r.data?.data ?? []).map((s: any) => ({ value: s.id, label: `${s.code} – ${s.name}`, meta: s }));
  };
  const searchPOs = async (q: string) => {
    const r = await api.get('/procurement/po', { params: { search: q, limit: 20 } });
    return (r.data?.data ?? []).map((p: any) => ({
      value: p.id, label: p.docNo,
      subLabel: `OMR ${Number(p.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 3 })}`,
      meta: p,
    }));
  };
  const searchGRNs = async (q: string) => {
    const r = await api.get('/inventory/grn', { params: { search: q, limit: 20 } });
    return (r.data?.data ?? []).map((g: any) => ({ value: g.id, label: g.docNo, meta: g }));
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!supplier)      { toast.error('Supplier is required'); return; }
    if (!supplierInvNo) { toast.error('Supplier Invoice No is required'); return; }
    if (grandTotal <= 0){ toast.error('Invoice total must be > 0'); return; }

    const firstLine = lines.find(l => l.accountId);
    try {
      const inv = await createMut.mutateAsync({
        supplierId:        supplier.value,
        poId:              po?.value,
        grnId:             grn?.value,
        supplierInvoiceNo: supplierInvNo,
        invoiceDate,
        dueDate,
        amount:            subtotal,
        taxAmount:         taxTotal || undefined,
        expenseAccountId:  firstLine?.accountId,
      });
      toast.success(`Invoice ${inv.docNo} created`);
      navigate(`/finance/ap/invoices/${inv.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Create failed');
    }
  };

  const handleApprove = async () => {
    if (!invoice || !confirm('Approve this invoice?')) return;
    try {
      await approveMut.mutateAsync(invoice.id);
      toast.success('Invoice approved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Approve failed');
    }
  };

  const handleCancel = async () => {
    if (!invoice || !confirm('Cancel this invoice? The journal entry will be reversed.')) return;
    try {
      await cancelMut.mutateAsync(invoice.id);
      toast.success('Invoice cancelled');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Cancel failed');
    }
  };

  const isDraft  = invoice?.status === 'DRAFT';
  const isActive = invoice && !['CANCELLED', 'PAID'].includes(invoice.status);
  const poAmt    = invoice ? Number(invoice.po?.totalAmount ?? 0) : po ? Number((po.meta as any)?.totalAmount ?? 0) : null;
  const grnDocNo = invoice ? invoice.grn?.docNo : grn?.label ?? null;
  const invTotal = isNew ? grandTotal : Number(invoice?.totalAmount ?? 0);

  const keyInfo = !isNew ? (
    <KeyInfoGrid columns={5} items={[
      { label: 'Invoice No',   value: <span className="font-mono text-blue-700">{invoice?.docNo}</span> },
      { label: 'Supplier',     value: (invoice as any)?.supplier?.name ?? '—' },
      { label: 'Invoice Date', value: invoice ? format(new Date(invoice.invoiceDate), 'dd/MM/yyyy') : '—' },
      { label: 'Due Date',     value: invoice ? format(new Date(invoice.dueDate),     'dd/MM/yyyy') : '—' },
      { label: 'Status',       value: invoice ? <StatusBadge status={invoice.status} /> : '—' },
    ]} />
  ) : null;

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 3 });

  return (
    <div className="flex flex-col h-full" onClick={() => { setAcctOverlay(null); setCcOverlay(null); }}>
      <DocumentToolbar
        title={isNew ? 'New AP Invoice' : 'AP Invoice'}
        docNo={invoice?.docNo}
        status={invoice?.status ? <StatusBadge status={invoice.status} /> : undefined}
        actions={[
          ...(isNew   ? [{ id: 'create',  label: createMut.isPending ? 'Saving…' : 'Save',    onClick: handleCreate,  variant: 'primary'  as const, disabled: createMut.isPending }] : []),
          ...(isDraft ? [{ id: 'approve', label: 'Approve',                                    onClick: handleApprove, variant: 'success'  as const }] : []),
          ...(isActive? [{ id: 'cancel',  label: 'Cancel Invoice',                             onClick: handleCancel,  variant: 'danger'   as const }] : []),
        ]}
        onNew={() => navigate('/finance/ap/invoices/new')}
      />

      <KeyInfoItemDetailsTabs
        className="flex-1"
        keyInfo={keyInfo}
        tabs={[
          // ── Tab 1: Invoice Details ───────────────────────────────────────
          {
            id: 'header',
            label: 'Invoice Details',
            content: (
              <div className="p-4">
                <div className="grid grid-cols-2 gap-6 max-w-5xl">

                  {/* Left — header fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="erp-label">Supplier <span className="erp-required-star">*</span></label>
                      {isNew
                        ? <LookupField value={supplier} onChange={setSupplier} onSearch={searchSuppliers} placeholder="Search supplier…" />
                        : <input className="erp-input bg-gray-50" readOnly value={(invoice as any)?.supplier?.name ?? ''} />
                      }
                    </div>
                    <div>
                      <label className="erp-label">Supplier Invoice No <span className="erp-required-star">*</span></label>
                      <input
                        className="erp-input"
                        value={supplierInvNo}
                        onChange={(e) => setSupplierInvNo(e.target.value)}
                        disabled={!isNew}
                        placeholder="e.g. INV-2026-001"
                      />
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
                      {isNew
                        ? <LookupField value={po} onChange={setPo} onSearch={searchPOs} placeholder="Search PO…" />
                        : <input className="erp-input bg-gray-50" readOnly value={invoice?.po?.docNo ?? '—'} />
                      }
                    </div>
                    <div>
                      <label className="erp-label">GRN Reference</label>
                      {isNew
                        ? <LookupField value={grn} onChange={setGrn} onSearch={searchGRNs} placeholder="Search GRN…" />
                        : <input className="erp-input bg-gray-50" readOnly value={invoice?.grn?.docNo ?? '—'} />
                      }
                    </div>
                  </div>

                  {/* Right — totals + 3-way match */}
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-2">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Amount Summary</h4>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="font-medium tabular-nums">{fmt(isNew ? subtotal : Number(invoice?.amount ?? 0))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tax</span>
                        <span className="font-medium tabular-nums text-amber-600">{fmt(isNew ? taxTotal : Number(invoice?.taxAmount ?? 0))}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-sm font-bold text-gray-700">Total</span>
                        <span className="text-lg font-bold text-[#1F4E79] tabular-nums">{fmt(invTotal)}</span>
                      </div>
                      {!isNew && invoice && (
                        <div className="flex justify-between items-center text-sm pt-1">
                          <span className="text-gray-500">Paid</span>
                          <span className={clsx('font-medium tabular-nums', Number(invoice.paidAmount) > 0 ? 'text-green-600' : 'text-gray-400')}>
                            {fmt(Number(invoice.paidAmount ?? 0))}
                          </span>
                        </div>
                      )}
                      {!isNew && invoice && Number(invoice.paidAmount) < Number(invoice.totalAmount) && !['CANCELLED','PAID'].includes(invoice.status) && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500">Balance Due</span>
                          <span className="font-semibold text-red-600 tabular-nums">
                            {fmt(Number(invoice.totalAmount) - Number(invoice.paidAmount))}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 3-way match */}
                    <ThreeWayMatch
                      poAmount={poAmt || null}
                      grnRef={grnDocNo}
                      invoiceAmount={invTotal}
                      matchFlag={invoice?.matchFlag ?? null}
                    />
                  </div>
                </div>
              </div>
            ),
          },

          // ── Tab 2: Distribution Lines ────────────────────────────────────
          {
            id: 'lines',
            label: `Distribution Lines (${lines.filter(l => l.accountId).length})`,
            content: (
              <div className="flex flex-col h-full">
                {/* Lines toolbar */}
                {isNew && (
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50">
                    <button onClick={addLine} className="toolbar-btn text-xs">
                      <Plus size={12} /><span>Add Line</span>
                    </button>
                    <span className="ml-auto text-[11px] text-gray-400">
                      Click Account or Cost Center cell to search
                    </span>
                  </div>
                )}

                {/* Lines table */}
                <div className="overflow-auto flex-1">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 w-8">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 min-w-52">Account <span className="text-red-400">*</span></th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 min-w-36">Cost Center</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 min-w-44">Description</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 w-32">Amount</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 w-20">Tax %</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 w-28">Tax Amt</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 w-32">Line Total</th>
                        {isNew && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lines.map((line, idx) => {
                        const lineTax   = (line.amount || 0) * (line.taxPct || 0) / 100;
                        const lineTotal = (line.amount || 0) + lineTax;
                        return (
                          <tr key={line._id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400 text-center">{idx + 1}</td>

                            {/* Account */}
                            <td
                              className={clsx(
                                'px-3 py-2 cursor-pointer',
                                !isNew && 'cursor-default',
                              )}
                              onClick={(e) => {
                                if (!isNew) return;
                                e.stopPropagation();
                                setAcctOverlay({ lineId: line._id, anchor: { top: e.clientY, left: e.clientX } });
                              }}
                            >
                              {line.accountId ? (
                                <span className="font-mono text-gray-700">{line.accountCode} – {line.accountName}</span>
                              ) : isNew ? (
                                <span className="text-gray-300 italic">Click to select…</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>

                            {/* Cost Center */}
                            <td
                              className={clsx('px-3 py-2', isNew && 'cursor-pointer')}
                              onClick={(e) => {
                                if (!isNew) return;
                                e.stopPropagation();
                                setCcOverlay({ lineId: line._id, anchor: { top: e.clientY, left: e.clientX } });
                              }}
                            >
                              {line.costCenterId ? (
                                <span className="text-gray-600">{line.costCenterName}</span>
                              ) : isNew ? (
                                <span className="text-gray-300 italic">—</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>

                            {/* Description */}
                            <td className="px-3 py-2">
                              {isNew ? (
                                <input
                                  className="erp-input text-xs py-1"
                                  value={line.description}
                                  onChange={(e) => updateLine(line._id, { description: e.target.value })}
                                  placeholder="Description…"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span className="text-gray-600">{line.description || '—'}</span>
                              )}
                            </td>

                            {/* Amount */}
                            <td className="px-3 py-2 text-right">
                              {isNew ? (
                                <input
                                  type="number"
                                  className="erp-input text-right text-xs py-1 w-full"
                                  value={line.amount || ''}
                                  onChange={(e) => updateLine(line._id, { amount: Number(e.target.value) })}
                                  step="0.001" min="0" placeholder="0.000"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span className="tabular-nums font-medium">{fmt(line.amount)}</span>
                              )}
                            </td>

                            {/* Tax % */}
                            <td className="px-3 py-2 text-right">
                              {isNew ? (
                                <input
                                  type="number"
                                  className="erp-input text-right text-xs py-1 w-full"
                                  value={line.taxPct || ''}
                                  onChange={(e) => updateLine(line._id, { taxPct: Number(e.target.value) })}
                                  step="0.5" min="0" max="100" placeholder="0"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span className="text-gray-600">{line.taxPct ? `${line.taxPct}%` : '—'}</span>
                              )}
                            </td>

                            {/* Tax Amt */}
                            <td className="px-3 py-2 text-right tabular-nums text-amber-600">
                              {lineTax > 0 ? fmt(lineTax) : '—'}
                            </td>

                            {/* Line Total */}
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-800">
                              {lineTotal > 0 ? fmt(lineTotal) : '—'}
                            </td>

                            {/* Delete */}
                            {isNew && (
                              <td className="px-2 py-2 text-center">
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteLine(line._id); }}
                                  className="text-red-400 hover:text-red-600 transition-colors"
                                  disabled={lines.length === 1}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals footer */}
                <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex justify-end gap-8 text-xs">
                    <div className="text-right space-y-1">
                      <div className="flex gap-16">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="font-medium tabular-nums w-28 text-right">{fmt(subtotal)}</span>
                      </div>
                      <div className="flex gap-16">
                        <span className="text-gray-500">Tax</span>
                        <span className="font-medium tabular-nums w-28 text-right text-amber-600">{fmt(taxTotal)}</span>
                      </div>
                      <div className="flex gap-16 border-t border-gray-300 pt-1 mt-1">
                        <span className="font-bold text-gray-700">Total</span>
                        <span className="font-bold text-[#1F4E79] tabular-nums w-28 text-right text-sm">{fmt(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Account lookup overlay */}
      {acctOverlay && (
        <LookupOverlay
          anchor={acctOverlay.anchor}
          onSearch={searchGlAccounts}
          placeholder="Search account…"
          onSelect={(opt) => {
            updateLine(acctOverlay.lineId, {
              accountId:   opt.value,
              accountCode: (opt.meta as any)?.code ?? '',
              accountName: (opt.meta as any)?.name ?? opt.label,
            });
            setAcctOverlay(null);
          }}
          onClose={() => setAcctOverlay(null)}
        />
      )}

      {/* Cost center lookup overlay */}
      {ccOverlay && (
        <LookupOverlay
          anchor={ccOverlay.anchor}
          onSearch={searchCostCenters}
          placeholder="Search cost center…"
          onSelect={(opt) => {
            updateLine(ccOverlay.lineId, {
              costCenterId:   opt.value,
              costCenterName: (opt.meta as any)?.name ?? opt.label,
            });
            setCcOverlay(null);
          }}
          onClose={() => setCcOverlay(null)}
        />
      )}
    </div>
  );
}
