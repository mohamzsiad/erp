import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { KeyInfoItemDetailsTabs } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { FormField, Input, Textarea } from '../../../components/ui/FormField';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useToast } from '../../../components/ui/Toast';
import { useUiStore } from '../../../store/uiStore';
import {
  useMrl,
  useCreateMrl,
  useUpdateMrl,
  useSubmitMrl,
  useApproveMrl,
  useRejectMrl,
  useConvertMrlToPrl,
  useStockSummary,
  searchLocations,
  searchChargeCodes,
  searchItems,
} from '../../../api/procurement';
import { format } from 'date-fns';
import type { MrlLine } from '@clouderp/shared';

// ── Zod Schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  locationId: z.string().min(1, 'Location is required'),
  docDate: z.string().min(1, 'Doc date is required'),
  chargeCodeId: z.string().min(1, 'Charge code is required'),
  deliveryDate: z.string().min(1, 'Delivery date is required'),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface LineRow extends Partial<MrlLine> {
  _rowId: string;
  itemLabel?: string;
  uomLabel?: string;
}

// ── Status Tiles ──────────────────────────────────────────────────────────────
interface StatusTilesProps {
  locationId: string | undefined;
}

const StatusTiles: React.FC<StatusTilesProps> = ({ locationId }) => {
  const { data } = useStockSummary(locationId);

  const tiles = [
    { label: 'Obsolete Stock', value: data?.obsoleteStock ?? 0, color: 'bg-blue-900 text-white' },
    { label: 'Inactive Stock', value: data?.inactiveStock ?? 0, color: 'bg-blue-600 text-white' },
    { label: 'Dead Stock', value: data?.deadStock ?? 0, color: 'bg-yellow-600 text-white' },
    { label: 'Pending Issue', value: data?.pendingIssues ?? 0, color: 'bg-olive-600 bg-[#6B7C3E] text-white' },
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function MrlFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const { setTabDirty } = useUiStore();

  const { data: doc, isLoading } = useMrl(isNew ? undefined : id);
  const createMutation = useCreateMrl();
  const updateMutation = useUpdateMrl(id ?? '');
  const submitMutation = useSubmitMrl(id ?? '');
  const approveMutation = useApproveMrl(id ?? '');
  const rejectMutation = useRejectMrl(id ?? '');
  const convertMutation = useConvertMrlToPrl(id ?? '');

  const [location, setLocation] = useState<LookupOption | null>(null);
  const [chargeCode, setChargeCode] = useState<LookupOption | null>(null);
  const [lineRows, setLineRows] = useState<LineRow[]>([]);
  const [lineSearch, setLineSearch] = useState('');
  const rowCounter = useRef(0);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      docDate: format(new Date(), 'yyyy-MM-dd'),
      deliveryDate: '',
    },
  });

  const locationId = location?.value;

  useEffect(() => {
    const tabId = isNew ? 'new-mrl' : `mrl-${id}`;
    setTabDirty(tabId, isDirty);
  }, [isDirty, id, isNew, setTabDirty]);

  useEffect(() => {
    if (doc) {
      reset({
        locationId: doc.locationId,
        docDate: doc.docDate,
        chargeCodeId: doc.chargeCodeId,
        deliveryDate: doc.deliveryDate,
        remarks: doc.remarks ?? '',
      });
      if (doc.lines) {
        setLineRows(doc.lines.map((l) => ({ ...l, _rowId: l.id })));
      }
    }
  }, [doc, reset]);

  const addLine = () => {
    const _rowId = `new-${++rowCounter.current}`;
    setLineRows((prev) => [
      ...prev,
      { _rowId, lineNo: prev.length + 1, requestedQty: 1, approvedQty: 0, approxPrice: 0, freeStock: 0 },
    ]);
  };

  const removeLine = (rowId: string) => {
    setLineRows((prev) => prev.filter((r) => r._rowId !== rowId));
  };

  const updateLine = (rowId: string, field: keyof LineRow, value: unknown) => {
    setLineRows((prev) =>
      prev.map((r) => (r._rowId === rowId ? { ...r, [field]: value } : r))
    );
  };

  const totalNetValue = lineRows.reduce(
    (sum, l) => sum + (l.requestedQty ?? 0) * (l.approxPrice ?? 0),
    0
  );

  const filteredLines = lineSearch
    ? lineRows.filter(
        (r) =>
          r.itemLabel?.toLowerCase().includes(lineSearch.toLowerCase()) ||
          r.uomLabel?.toLowerCase().includes(lineSearch.toLowerCase())
      )
    : lineRows;

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
        toast.success('MRL created', created.docNo);
        navigate(`/procurement/mrl/${created.id}`, { replace: true });
      } else {
        await updateMutation.mutateAsync(payload);
        toast.success('MRL saved');
      }
    } catch (err: unknown) {
      toast.error('Error', (err as { message?: string })?.message ?? 'Save failed');
    }
  };

  const handleSubmitDoc = async () => {
    try {
      await submitMutation.mutateAsync();
      toast.success('MRL submitted for approval');
    } catch (err: unknown) {
      toast.error('Submit failed', (err as { message?: string })?.message);
    }
  };

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ action: 'approve' });
      toast.success('MRL approved');
    } catch (err: unknown) {
      toast.error('Approve failed', (err as { message?: string })?.message);
    }
  };

  const handleReject = async () => {
    const comment = window.prompt('Rejection reason:');
    if (!comment) return;
    try {
      await rejectMutation.mutateAsync({ action: 'reject', comment });
      toast.success('MRL rejected');
    } catch (err: unknown) {
      toast.error('Reject failed', (err as { message?: string })?.message);
    }
  };

  const handleConvert = async () => {
    try {
      const prl = await convertMutation.mutateAsync();
      toast.success('Converted to PRL', prl.docNo);
      navigate(`/procurement/prl/${prl.id}`);
    } catch (err: unknown) {
      toast.error('Convert failed', (err as { message?: string })?.message);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const isDraft = !doc || doc.status === 'DRAFT';
  const isApproved = doc?.status === 'APPROVED';
  const isSubmitted = doc?.status === 'SUBMITTED';

  if (!isNew && isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-sm">Loading…</p></div>;
  }

  // ── Key Info Panel ─────────────────────────────────────────────────────────
  const keyInfoPanel = (
    <form id="mrl-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex gap-6">
        {/* Left fields */}
        <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-2">
          <FormField label="Doc Location" required error={errors.locationId?.message}>
            <Controller
              name="locationId"
              control={control}
              render={() => (
                <LookupField
                  value={location}
                  onChange={(opt) => { setLocation(opt); }}
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
            <LookupField
              value={location}
              onChange={setLocation}
              onSearch={searchLocations}
              placeholder="Same as doc location…"
            />
          </FormField>

          <FormField label="Charge Code" required error={errors.chargeCodeId?.message}>
            <Controller
              name="chargeCodeId"
              control={control}
              render={() => (
                <LookupField
                  value={chargeCode}
                  onChange={setChargeCode}
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

        {/* Right: document value + status tiles */}
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

  // ── Item Details tab ───────────────────────────────────────────────────────
  const itemDetailsTab = (
    <div className="flex flex-col h-full">
      {/* Line toolbar */}
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
        <span className="text-xs text-gray-400 ml-auto">
          Total No of Records: {lineRows.length}/{lineRows.length}
        </span>
      </div>

      {/* Line table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left w-6">#</th>
              <th className="px-2 py-2 text-left w-8"></th>
              <th className="px-2 py-2 text-left min-w-[180px]">Item *</th>
              <th className="px-2 py-2 text-left w-20">Grade 1 *</th>
              <th className="px-2 py-2 text-left w-20">Grade 2 *</th>
              <th className="px-2 py-2 text-left w-20">UOM *</th>
              <th className="px-2 py-2 text-right w-24">Free Stock</th>
              <th className="px-2 py-2 text-right w-28">Req. Qty *</th>
              <th className="px-2 py-2 text-right w-28">Appr. Qty *</th>
              <th className="px-2 py-2 text-right w-28">Approx Price</th>
              <th className="px-2 py-2 text-left w-32">Charge Code</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-400">
                  No lines. Click "Add Line" to begin.
                </td>
              </tr>
            )}
            {filteredLines.map((row, idx) => (
              <tr key={row._rowId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                <td className="px-1 py-1 text-center">
                  <input type="checkbox" className="rounded border-gray-300 w-3 h-3" />
                </td>
                <td className="px-1 py-1">
                  <LookupField
                    value={row.itemId ? { value: row.itemId, label: row.itemLabel ?? row.itemId } : null}
                    onChange={(opt) => {
                      updateLine(row._rowId, 'itemId', opt?.value);
                      updateLine(row._rowId, 'itemLabel', opt?.label);
                    }}
                    onSearch={searchItems}
                    placeholder="Search item…"
                    disabled={!isDraft}
                    className="min-w-[160px]"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.grade1 ?? ''}
                    onChange={(e) => updateLine(row._rowId, 'grade1', e.target.value)}
                    className="erp-input w-full"
                    disabled={!isDraft}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.grade2 ?? ''}
                    onChange={(e) => updateLine(row._rowId, 'grade2', e.target.value)}
                    className="erp-input w-full"
                    disabled={!isDraft}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.uomId ?? ''}
                    onChange={(e) => updateLine(row._rowId, 'uomId', e.target.value)}
                    className="erp-input w-full"
                    disabled={!isDraft}
                  />
                </td>
                <td className="px-2 py-1 text-right text-gray-500">
                  {row.freeStock?.toLocaleString() ?? 0}
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    value={row.requestedQty ?? 1}
                    onChange={(e) => updateLine(row._rowId, 'requestedQty', parseFloat(e.target.value) || 0)}
                    className="erp-input w-full text-right"
                    min={0}
                    step="0.001"
                    disabled={!isDraft}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    value={row.approvedQty ?? 0}
                    onChange={(e) => updateLine(row._rowId, 'approvedQty', parseFloat(e.target.value) || 0)}
                    className="erp-input w-full text-right"
                    min={0}
                    step="0.001"
                    disabled={!isSubmitted}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    value={row.approxPrice ?? 0}
                    onChange={(e) => updateLine(row._rowId, 'approxPrice', parseFloat(e.target.value) || 0)}
                    className="erp-input w-full text-right"
                    min={0}
                    step="0.001"
                    disabled={!isDraft}
                  />
                </td>
                <td className="px-1 py-1 text-gray-500 text-xs">
                  {chargeCode?.label ?? '—'}
                </td>
                <td className="px-1 py-1">
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => removeLine(row._rowId)}
                      className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {lineRows.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={9} className="px-2 py-1 text-right text-xs font-semibold text-gray-600">
                  Total (Approx):
                </td>
                <td className="px-2 py-1 text-right text-xs font-bold text-gray-800">
                  {totalNetValue.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  const tabs = [
    { id: 'key-info', label: 'Key Info', content: keyInfoPanel },
    { id: 'item-details', label: 'Item Details', badge: lineRows.length, content: itemDetailsTab },
  ];

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
      if (e.key === 'F5') {
        e.preventDefault();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleSubmit, onSubmit]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="Material Requisition"
        docNo={doc?.docNo}
        status={doc ? <StatusBadge status={doc.status} /> : undefined}
        onNew={() => navigate('/procurement/mrl/new')}
        onSave={handleSubmit(onSubmit)}
        onSubmit={isDraft && !isNew ? handleSubmitDoc : undefined}
        onApprove={isSubmitted ? handleApprove : undefined}
        onReject={isSubmitted ? handleReject : undefined}
        onPrint={() => window.print()}
        onReset={() => reset()}
        saving={saving}
        actions={
          isApproved
            ? [{ id: 'convert', label: 'Convert to PRL', onClick: handleConvert, variant: 'primary' }]
            : []
        }
      />

      <div className="flex-1 overflow-auto">
        <KeyInfoItemDetailsTabs
          tabs={tabs}
          defaultTabId="key-info"
          className="min-h-full"
        />
      </div>
    </div>
  );
}
