import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ChevronRight, Layers } from 'lucide-react';
import DeliveryScheduleTab from '../../../components/procurement/tabs/DeliveryScheduleTab';
import AccountDetailsTab   from '../../../components/procurement/tabs/AccountDetailsTab';
import AlternateItemsTab   from '../../../components/procurement/tabs/AlternateItemsTab';
import ItemStatusTab       from '../../../components/procurement/tabs/ItemStatusTab';
import ShortCloseTab       from '../../../components/procurement/tabs/ShortCloseTab';
import InputsTab           from '../../../components/procurement/tabs/InputsTab';
import LeadTimeTab         from '../../../components/procurement/tabs/LeadTimeTab';
import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { KeyInfoItemDetailsTabs } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { FormField, Input, Textarea } from '../../../components/ui/FormField';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useToast } from '../../../components/ui/Toast';
import { useUiStore } from '../../../store/uiStore';
import {
  usePrl,
  useCreatePrl,
  useUpdatePrl,
  useStockSummary,
  searchLocations,
  searchChargeCodes,
  searchItems,
  searchSuppliers,
  searchUoms,
} from '../../../api/procurement';
import { format } from 'date-fns';
import type { PrlLine } from '@clouderp/shared';

const schema = z.object({
  locationId: z.string().min(1, 'Location is required'),
  docDate: z.string().min(1, 'Doc date is required'),
  chargeCodeId: z.string().min(1, 'Charge code is required'),
  deliveryDate: z.string().min(1, 'Delivery date is required'),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface LineRow extends Partial<PrlLine> {
  _rowId: string;
  itemLabel?: string;
  uomLabel?: string;
}

// ── Status Tiles (reused from MRL) ────────────────────────────────────────────
const StatusTiles: React.FC<{ locationId: string | undefined }> = ({ locationId }) => {
  const { data } = useStockSummary(locationId);
  const tiles = [
    { label: 'Obsolete Stock', value: data?.obsoleteStock ?? 0, color: 'bg-blue-900 text-white' },
    { label: 'Inactive Stock', value: data?.inactiveStock ?? 0, color: 'bg-blue-600 text-white' },
    { label: 'Dead Stock', value: data?.deadStock ?? 0, color: 'bg-yellow-600 text-white' },
    { label: 'Pending Issue', value: data?.pendingIssues ?? 0, color: 'bg-[#6B7C3E] text-white' },
    { label: 'Pending LTO', value: data?.pendingLto ?? 0, color: 'bg-green-700 text-white' },
    { label: 'Pending GRN', value: data?.pendingGrn ?? 0, color: 'bg-green-400 text-white' },
  ];
  return (
    <div className="flex flex-col gap-1">
      {tiles.map((t) => (
        <div key={t.label} className={`flex items-center justify-between px-2 py-1 rounded text-xs ${t.color}`}>
          <span className="truncate">{t.label}</span>
          <span className="font-bold ml-2">{t.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function PrlFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const { setTabDirty } = useUiStore();

  const { data: doc, isLoading } = usePrl(isNew ? undefined : id);
  const createMutation = useCreatePrl();
  const updateMutation = useUpdatePrl(id ?? '');

  const [location, setLocation] = useState<LookupOption | null>(null);
  const [chargeCode, setChargeCode] = useState<LookupOption | null>(null);
  const [lineRows, setLineRows] = useState<LineRow[]>([]);
  const [lineSearch, setLineSearch] = useState('');
  const [selectedSuppliers, setSelectedSuppliers] = useState<LookupOption[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [activeTabId,    setActiveTabId]    = useState<string>('key-info');
  const rowCounter = useRef(0);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { docDate: format(new Date(), 'yyyy-MM-dd') },
  });

  const locationId = location?.value;

  useEffect(() => {
    setTabDirty(isNew ? 'new-prl' : `prl-${id}`, isDirty);
  }, [isDirty, id, isNew, setTabDirty]);

  useEffect(() => {
    if (doc) {
      reset({
        locationId: doc.locationId,
        docDate: doc.docDate ? format(new Date(doc.docDate), 'yyyy-MM-dd') : '',
        chargeCodeId: doc.chargeCodeId,
        deliveryDate: doc.deliveryDate ? format(new Date(doc.deliveryDate), 'yyyy-MM-dd') : '',
        remarks: doc.remarks ?? '',
      });
      if (doc.location) {
        setLocation({ value: doc.location.id, label: `${doc.location.code} – ${doc.location.name}` });
      }
      if (doc.chargeCode) {
        setChargeCode({ value: doc.chargeCode.id, label: `${doc.chargeCode.code} – ${doc.chargeCode.name}` });
      }
      if (doc.lines) {
        setLineRows(doc.lines.map((l) => ({
          ...l,
          _rowId: l.id,
          itemLabel: l.item ? `${l.item.code} – ${l.item.description}` : undefined,
          uomLabel: (l as any).uom?.name ?? l.uomId,
        })));
      }
    }
  }, [doc, reset]);

  const addLine = () => {
    const _rowId = `new-${++rowCounter.current}`;
    setLineRows((prev) => [
      ...prev,
      {
        _rowId, lineNo: prev.length + 1,
        requestedQty: 1, approvedQty: 0, approxPrice: 0, freeStock: 0, isShortClosed: false,
      },
    ]);
  };

  const removeLine = (rowId: string) => setLineRows((prev) => prev.filter((r) => r._rowId !== rowId));

  const updateLine = (rowId: string, field: keyof LineRow, value: unknown) =>
    setLineRows((prev) => prev.map((r) => (r._rowId === rowId ? { ...r, [field]: value } : r)));

  const totalNetValue = lineRows.reduce(
    (sum, l) => sum + (l.requestedQty ?? 0) * (l.approxPrice ?? 0),
    0
  );

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        ...values,
        locationId: location?.value ?? values.locationId,
        chargeCodeId: chargeCode?.value ?? values.chargeCodeId,
        lines: lineRows.map((r, i) => ({
          itemId: r.itemId ?? '',
          grade1: r.grade1 ?? null,
          grade2: r.grade2 ?? null,
          uomId: r.uomId ?? '',
          requestedQty: r.requestedQty ?? 1,
          approvedQty: r.approvedQty ?? 0,
          approxPrice: r.approxPrice ?? 0,
          chargeCodeId: chargeCode?.value ?? values.chargeCodeId,
          lineNo: i + 1,
        })),
      };

      if (isNew) {
        const created = await createMutation.mutateAsync(payload);
        toast.success('PRL created', created.docNo);
        navigate(`/procurement/prl/${created.id}`, { replace: true });
      } else {
        await updateMutation.mutateAsync(payload);
        toast.success('PRL saved');
      }
    } catch (err: unknown) {
      toast.error('Error', (err as { message?: string })?.message ?? 'Save failed');
    }
  };

  const handleCreateEnquiry = async () => {
    if (!id || selectedSuppliers.length === 0) {
      toast.warning('Select at least one supplier');
      return;
    }
    try {
      await import('../../../api/procurement').then(({ prlApi }) =>
        prlApi.createEnquiry(id, selectedSuppliers.map((s) => s.value))
      );
      toast.success('Purchase Enquiry created');
    } catch (err: unknown) {
      toast.error('Failed', (err as { message?: string })?.message);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const isDraft = !doc || doc.status === 'DRAFT';
  const filteredLines = lineSearch
    ? lineRows.filter((r) => r.itemLabel?.toLowerCase().includes(lineSearch.toLowerCase()))
    : lineRows;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleSubmit, onSubmit]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isNew && isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-sm">Loading…</p></div>;
  }

  // ── Key Info ───────────────────────────────────────────────────────────────
  const keyInfoPanel = (
    <form id="prl-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex gap-6">
        <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-2">
          <FormField label="Doc Location" required error={errors.locationId?.message}>
            <Controller
              name="locationId"
              control={control}
              render={({ field }) => (
                <LookupField
                  value={location}
                  onChange={(opt) => { setLocation(opt); field.onChange(opt?.value ?? ''); }}
                  onSearch={searchLocations}
                  placeholder="Search location…"
                  error={!!errors.locationId}
                />
              )}
            />
          </FormField>

          <FormField label="Doc Date" required error={errors.docDate?.message}>
            <Input type="date" {...register('docDate')} error={!!errors.docDate} />
          </FormField>

          <FormField label="Location" required>
            <LookupField value={location} onChange={setLocation} onSearch={searchLocations} placeholder="Same as doc location…" />
          </FormField>

          <FormField label="Charge Code" required error={errors.chargeCodeId?.message}>
            <Controller
              name="chargeCodeId"
              control={control}
              render={({ field }) => (
                <LookupField
                  value={chargeCode}
                  onChange={(opt) => { setChargeCode(opt); field.onChange(opt?.value ?? ''); }}
                  onSearch={searchChargeCodes}
                  placeholder="Search charge code…"
                  error={!!errors.chargeCodeId}
                />
              )}
            />
          </FormField>

          <FormField label="Delivery Required On" required error={errors.deliveryDate?.message}>
            <Input type="date" {...register('deliveryDate')} error={!!errors.deliveryDate} />
          </FormField>

          <FormField label="Remarks">
            <Textarea {...register('remarks')} rows={3} />
          </FormField>
        </div>

        <div className="w-44 flex flex-col gap-3 shrink-0">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-blue-600 font-medium">Document Value</p>
            <p className="text-sm font-bold text-blue-800 mt-0.5">
              {totalNetValue.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
            </p>
            <p className="text-xs text-blue-400">(Approx Net Value)</p>
          </div>
          <StatusTiles locationId={locationId} />
        </div>
      </div>
    </form>
  );

  // ── Line Items ─────────────────────────────────────────────────────────────
  const selectedLineRow = selectedLineId
    ? lineRows.find((r) => r._rowId === selectedLineId || r.id === selectedLineId)
    : null;

  const itemDetailsContent = (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <button type="button" onClick={addLine} className="toolbar-btn" disabled={!isDraft}>
          <Plus size={12} /> Add Line
        </button>
        <input
          type="text"
          placeholder="Search all columns…"
          value={lineSearch}
          onChange={(e) => setLineSearch(e.target.value)}
          className="erp-input w-52"
        />
        <span className="text-xs text-gray-400 ml-auto">Total No of Records: {lineRows.length}</span>
      </div>

      <div className="overflow-auto" style={{ maxHeight: selectedLineId ? '40vh' : '60vh' }}>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left w-6">#</th>
              <th className="px-2 py-2 w-4" title="Expand sub-sections" />
              <th className="px-2 py-2 text-left min-w-[180px]">Item *</th>
              <th className="px-2 py-2 text-left w-20">Grade 1</th>
              <th className="px-2 py-2 text-left w-20">Grade 2</th>
              <th className="px-2 py-2 text-left w-20">UOM *</th>
              <th className="px-2 py-2 text-right w-24">Free Stock</th>
              <th className="px-2 py-2 text-right w-28">Req. Qty *</th>
              <th className="px-2 py-2 text-right w-28">Appr. Qty</th>
              <th className="px-2 py-2 text-right w-28">Approx Price</th>
              <th className="px-2 py-2 text-left w-20">Short Close</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-400">No lines. Click "Add Line" to begin.</td>
              </tr>
            )}
            {filteredLines.map((row, idx) => {
              const lineKey   = row.id ?? row._rowId;
              const isSelected = selectedLineId === lineKey;
              const isSaved   = !!row.id && !row._rowId.startsWith('new-');
              return (
                <tr
                  key={row._rowId}
                  className={`
                    ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    ${isSelected ? 'ring-1 ring-inset ring-blue-400' : ''}
                    transition-colors
                  `}
                >
                  <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                  <td className="px-1 py-1">
                    {isSaved && (
                      <button
                        type="button"
                        title="View sub-sections"
                        onClick={() => {
                          const next = isSelected ? null : lineKey;
                          setSelectedLineId(next);
                          if (next) setActiveTabId('delivery-schedule');
                        }}
                        className={`p-0.5 rounded transition-colors ${isSelected ? 'text-blue-600 bg-blue-50' : 'text-gray-300 hover:text-blue-400'}`}
                      >
                        <ChevronRight size={12} className={`transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                      </button>
                    )}
                  </td>
                  <td className="px-1 py-1">
                    <LookupField
                      value={row.itemId ? { value: row.itemId, label: row.itemLabel ?? row.itemId } : null}
                      onChange={(opt) => { updateLine(row._rowId, 'itemId', opt?.value); updateLine(row._rowId, 'itemLabel', opt?.label); }}
                      onSearch={searchItems}
                      placeholder="Search item…"
                      disabled={!isDraft}
                      className="min-w-[160px]"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input type="text" value={row.grade1 ?? ''} onChange={(e) => updateLine(row._rowId, 'grade1', e.target.value)} className="erp-input w-full" disabled={!isDraft} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="text" value={row.grade2 ?? ''} onChange={(e) => updateLine(row._rowId, 'grade2', e.target.value)} className="erp-input w-full" disabled={!isDraft} />
                  </td>
                  <td className="px-1 py-1">
                    <LookupField
                      value={row.uomId ? { value: row.uomId, label: row.uomLabel ?? row.uomId } : null}
                      onChange={(opt) => { updateLine(row._rowId, 'uomId', opt?.value); updateLine(row._rowId, 'uomLabel', opt?.label); }}
                      onSearch={searchUoms}
                      placeholder="UOM…"
                      disabled={!isDraft}
                      className="w-20"
                    />
                  </td>
                  <td className="px-2 py-1 text-right text-gray-500">{row.freeStock?.toLocaleString() ?? 0}</td>
                  <td className="px-1 py-1">
                    <input type="number" value={row.requestedQty || ''} onChange={(e) => updateLine(row._rowId, 'requestedQty', parseFloat(e.target.value) || 0)} className="erp-input w-full text-right" min={0} step="0.001" disabled={!isDraft} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" value={row.approvedQty ?? 0} className="erp-input w-full text-right" min={0} step="0.001" readOnly />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" value={row.approxPrice ?? 0} onChange={(e) => updateLine(row._rowId, 'approxPrice', parseFloat(e.target.value) || 0)} className="erp-input w-full text-right" min={0} step="0.001" disabled={!isDraft} />
                  </td>
                  <td className="px-2 py-1 text-center">
                    {row.isShortClosed && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">SC</span>
                    )}
                  </td>
                  <td className="px-1 py-1">
                    {isDraft && (
                      <button type="button" onClick={() => removeLine(row._rowId)} className="p-1 rounded hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Line selection hint ── */}
      {selectedLineId && selectedLineRow && (
        <div className="px-3 py-1.5 bg-blue-50 border-t border-blue-100 flex items-center gap-2 text-xs text-blue-700">
          <ChevronRight size={12} className="rotate-90 shrink-0" />
          <span>Line {(filteredLines.findIndex((r) => (r.id ?? r._rowId) === selectedLineId) ?? 0) + 1} selected
            {selectedLineRow.itemLabel ? ` — ${selectedLineRow.itemLabel}` : ''}
          </span>
          <button
            type="button"
            className="ml-auto text-blue-400 hover:text-blue-700 text-[10px] underline"
            onClick={() => setSelectedLineId(null)}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );

  // ── Enquiry Suppliers tab ──────────────────────────────────────────────────
  const enquiryContent = (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-xs text-gray-500">Select suppliers to send the Purchase Enquiry/RFQ to:</p>
      <div className="flex gap-2">
        <LookupField
          value={null}
          onChange={(opt) => {
            if (opt && !selectedSuppliers.find((s) => s.value === opt.value)) {
              setSelectedSuppliers((prev) => [...prev, opt]);
            }
          }}
          onSearch={searchSuppliers}
          placeholder="Add supplier…"
          className="flex-1"
        />
        <button type="button" onClick={handleCreateEnquiry} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79]">
          Create Enquiry
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {selectedSuppliers.map((s) => (
          <div key={s.value} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded px-2 py-0.5 text-xs">
            <span className="text-blue-700">{s.label}</span>
            <button type="button" onClick={() => setSelectedSuppliers((prev) => prev.filter((x) => x.value !== s.value))} className="text-blue-400 hover:text-blue-700">×</button>
          </div>
        ))}
      </div>
    </div>
  );

  const isReadOnly  = ['CLOSED', 'SHORT_CLOSED'].includes(doc?.status ?? '');
  const prStatus    = doc?.status ?? 'DRAFT';
  const deliveryDate = doc?.deliveryDate as string | undefined;

  // Placeholder shown on sub-section tabs when no line is selected
  const noLinePrompt = (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
      <Layers size={32} strokeWidth={1.2} />
      <p className="text-sm">Select a line from <strong className="text-gray-500">Item Details</strong> to view this section.</p>
      <button
        type="button"
        className="text-xs text-blue-500 underline"
        onClick={() => setActiveTabId('item-details')}
      >
        Go to Item Details
      </button>
    </div>
  );

  const lineId  = selectedLineRow?.id ?? '';
  const prlId   = id ?? '';

  const tabs = [
    { id: 'key-info',          label: 'Key Info',          content: keyInfoPanel },
    { id: 'item-details',      label: 'Item Details',      badge: lineRows.length, content: itemDetailsContent },
    { id: 'enquiry',           label: 'Enquiry',           content: enquiryContent },
    {
      id: 'delivery-schedule', label: 'Delivery Schedule',
      content: lineId && prlId
        ? <DeliveryScheduleTab prlId={prlId} lineId={lineId} reqQty={Number(selectedLineRow?.requestedQty ?? 0)} readOnly={isReadOnly} />
        : noLinePrompt,
    },
    {
      id: 'ac-details', label: 'A/C Details',
      content: lineId && prlId
        ? <AccountDetailsTab prlId={prlId} lineId={lineId} approxPrice={Number(selectedLineRow?.approxPrice ?? 0)} reqQty={Number(selectedLineRow?.requestedQty ?? 0)} readOnly={isReadOnly} />
        : noLinePrompt,
    },
    {
      id: 'alternate-items', label: 'Alternate Items',
      content: lineId && prlId
        ? <AlternateItemsTab prlId={prlId} lineId={lineId} readOnly={isReadOnly} />
        : noLinePrompt,
    },
    {
      id: 'item-status', label: 'Item Status',
      content: lineId && prlId
        ? <ItemStatusTab prlId={prlId} lineId={lineId} reqQty={Number(selectedLineRow?.requestedQty ?? 0)} />
        : noLinePrompt,
    },
    {
      id: 'short-close', label: 'Short Close',
      content: lineId && prlId
        ? <ShortCloseTab prlId={prlId} lineId={lineId} prStatus={prStatus} />
        : noLinePrompt,
    },
    {
      id: 'inputs', label: 'Inputs',
      content: lineId && prlId
        ? <InputsTab prlId={prlId} lineId={lineId} readOnly={isReadOnly} />
        : noLinePrompt,
    },
    {
      id: 'lead-time', label: 'Lead Time',
      content: lineId && prlId
        ? <LeadTimeTab prlId={prlId} lineId={lineId} prRequiredDate={deliveryDate} readOnly={isReadOnly} />
        : noLinePrompt,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="Purchase Requisition"
        docNo={doc?.docNo}
        status={doc ? <StatusBadge status={doc.status} /> : undefined}
        onNew={() => navigate('/procurement/prl/new')}
        onSave={handleSubmit(onSubmit)}
        onPrint={() => window.print()}
        onReset={() => reset()}
        saving={saving}
      />

      <div className="flex-1 overflow-auto">
        <KeyInfoItemDetailsTabs
          tabs={tabs}
          defaultTabId="key-info"
          activeTabId={activeTabId}
          onTabChange={setActiveTabId}
          className="min-h-full"
        />
      </div>
    </div>
  );
}
