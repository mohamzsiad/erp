import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DocumentToolbar, type ToolbarAction } from '../../../components/ui/DocumentToolbar';
import { KeyInfoItemDetailsTabs } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useToast } from '../../../components/ui/Toast';
import { useQuotation, useAwardQuotation } from '../../../api/procurement';
import { format } from 'date-fns';

export default function QuotationFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: doc, isLoading } = useQuotation(id);
  const awardMutation = useAwardQuotation(id ?? '');

  const handleAward = async () => {
    try {
      const result = await awardMutation.mutateAsync();
      toast.success('Quotation awarded', `PO ${result.po?.docNo ?? ''} created`);
      if (result.po?.id) navigate(`/procurement/po/${result.po.id}`);
    } catch (err: unknown) {
      toast.error('Failed', (err as { message?: string })?.message);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-sm">Loading…</p></div>;
  }

  if (!doc) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-sm">Quotation not found.</p></div>;
  }

  const isReceived = doc.status === 'RECEIVED';

  // ── Key Info ───────────────────────────────────────────────────────────────
  const keyInfoPanel = (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 p-4 max-w-2xl text-sm">
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Quotation No</p>
        <p className="font-medium">{doc.docNo}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Status</p>
        <StatusBadge status={doc.status} />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Supplier</p>
        <p className="font-medium">{doc.supplier ? `${doc.supplier.code} – ${doc.supplier.name}` : doc.supplierId}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Enquiry Ref</p>
        <p className="font-medium">{doc.enquiry?.docNo ?? '—'}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">PRL Ref</p>
        <p className="font-medium">{doc.enquiry?.prl?.docNo ?? '—'}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Valid Until</p>
        <p className="font-medium">{doc.validityDate ? format(new Date(doc.validityDate), 'dd/MM/yyyy') : '—'}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Currency</p>
        <p className="font-medium">{doc.currency?.code ?? doc.currencyId}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Payment Terms</p>
        <p className="font-medium">{doc.paymentTerms ?? '—'}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
        <p className="font-bold text-blue-800">
          {Number(doc.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 3 })}
        </p>
      </div>
    </div>
  );

  const tabs = [
    { id: 'key-info', label: 'Key Info', content: keyInfoPanel },
  ];

  const actions: ToolbarAction[] = [
    {
      id: 'award',
      label: 'Award & Create PO',
      onClick: handleAward,
      variant: 'primary',
      disabled: awardMutation.isPending,
      loading: awardMutation.isPending,
      hidden: !isReceived,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="Supplier Quotation"
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
