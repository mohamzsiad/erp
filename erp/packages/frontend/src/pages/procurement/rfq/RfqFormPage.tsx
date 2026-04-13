import React from 'react';
import { useParams } from 'react-router-dom';
import { DocumentToolbar, type ToolbarAction } from '../../../components/ui/DocumentToolbar';
import { KeyInfoItemDetailsTabs } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useToast } from '../../../components/ui/Toast';
import { useEnquiry, useSendEnquiry, useCloseEnquiry } from '../../../api/procurement';
import { format } from 'date-fns';

export default function RfqFormPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const { data: doc, isLoading } = useEnquiry(id);
  const sendMutation = useSendEnquiry(id ?? '');
  const closeMutation = useCloseEnquiry(id ?? '');

  const handleSend = async () => {
    try {
      await sendMutation.mutateAsync();
      toast.success('Enquiry sent to suppliers');
    } catch (err: unknown) {
      toast.error('Failed', (err as { message?: string })?.message);
    }
  };

  const handleClose = async () => {
    try {
      await closeMutation.mutateAsync();
      toast.success('Enquiry closed');
    } catch (err: unknown) {
      toast.error('Failed', (err as { message?: string })?.message);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-sm">Loading…</p></div>;
  }

  if (!doc) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-sm">Enquiry not found.</p></div>;
  }

  const isDraft = doc.status === 'DRAFT';
  const isSent = doc.status === 'SENT';

  // ── Key Info ───────────────────────────────────────────────────────────────
  const keyInfoPanel = (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 p-4 max-w-2xl text-sm">
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Enquiry No</p>
        <p className="font-medium">{doc.docNo}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Date</p>
        <p className="font-medium">{format(new Date(doc.docDate), 'dd/MM/yyyy')}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">PRL Reference</p>
        <p className="font-medium">{doc.prl?.docNo ?? '—'}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Status</p>
        <StatusBadge status={doc.status} />
      </div>
    </div>
  );

  // ── PRL Lines ──────────────────────────────────────────────────────────────
  const linesContent = (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left w-8">#</th>
            <th className="px-3 py-2 text-left">Item Code</th>
            <th className="px-3 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-left w-20">UOM</th>
            <th className="px-3 py-2 text-right w-28">Req. Qty</th>
            <th className="px-3 py-2 text-right w-28">Approx Price</th>
          </tr>
        </thead>
        <tbody>
          {(doc.prl?.lines ?? []).length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No lines.</td></tr>
          )}
          {(doc.prl?.lines ?? []).map((line, idx) => (
            <tr key={line.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-1.5 text-gray-400">{line.lineNo}</td>
              <td className="px-3 py-1.5 font-mono">{line.item?.code ?? line.itemId}</td>
              <td className="px-3 py-1.5">{line.item?.description ?? ''}</td>
              <td className="px-3 py-1.5">{line.uom?.code ?? line.uomId}</td>
              <td className="px-3 py-1.5 text-right">{Number(line.requestedQty).toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
              <td className="px-3 py-1.5 text-right">{Number(line.approxPrice).toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── Quotations / Suppliers ─────────────────────────────────────────────────
  const quotationsContent = (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left">Supplier Code</th>
            <th className="px-3 py-2 text-left">Supplier Name</th>
            <th className="px-3 py-2 text-left w-24">Currency</th>
            <th className="px-3 py-2 text-left w-24">Status</th>
          </tr>
        </thead>
        <tbody>
          {(doc.quotations ?? []).length === 0 && (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No suppliers linked.</td></tr>
          )}
          {(doc.quotations ?? []).map((q, idx) => (
            <tr key={q.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-1.5 font-mono">{q.supplier?.code ?? ''}</td>
              <td className="px-3 py-1.5">{q.supplier?.name ?? q.supplierId}</td>
              <td className="px-3 py-1.5">{q.currency?.code ?? ''}</td>
              <td className="px-3 py-1.5"><StatusBadge status={q.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const tabs = [
    { id: 'key-info', label: 'Key Info', content: keyInfoPanel },
    { id: 'lines', label: 'PRL Lines', badge: doc.prl?.lines?.length, content: linesContent },
    { id: 'quotations', label: 'Suppliers / Quotations', badge: doc.quotations?.length, content: quotationsContent },
  ];

  const actions: ToolbarAction[] = [
    {
      id: 'send',
      label: 'Send to Suppliers',
      onClick: handleSend,
      variant: 'primary',
      disabled: sendMutation.isPending,
      loading: sendMutation.isPending,
      hidden: !isDraft,
    },
    {
      id: 'close',
      label: 'Close Enquiry',
      onClick: handleClose,
      variant: 'secondary',
      disabled: closeMutation.isPending,
      loading: closeMutation.isPending,
      hidden: !isSent,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="Purchase Enquiry (RFQ)"
        docNo={doc.docNo}
        status={<StatusBadge status={doc.status} />}
        actions={actions}
      />
      <div className="flex-1 overflow-auto">
        <KeyInfoItemDetailsTabs tabs={tabs} defaultTabId="key-info" className="min-h-full" />
      </div>
    </div>
  );
}
