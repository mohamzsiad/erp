import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Clock, Calendar, TrendingUp } from 'lucide-react';
import { useLeadTime, useUpdateLeadTime } from '../../../api/prSubSections';
import { useToast } from '../../ui/Toast';
import { format, addDays } from 'date-fns';

interface Props {
  prlId:           string;
  lineId:          string;
  prRequiredDate?: string;  // PR header delivery date — for colour coding
  readOnly:        boolean;
}

export default function LeadTimeTab({ prlId, lineId, prRequiredDate, readOnly }: Props) {
  const toast = useToast();
  const { data, isLoading } = useLeadTime(prlId, lineId);
  const updateMut = useUpdateLeadTime(prlId, lineId);

  const [inputDays, setInputDays] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (data) {
      setInputDays(
        data.manualLeadTimeDays != null ? String(data.manualLeadTimeDays) : ''
      );
      setDirty(false);
    }
  }, [data]);

  // Compute expected delivery date from input
  const previewDays = inputDays !== '' ? parseInt(inputDays) : null;
  const previewDate =
    previewDays != null && !isNaN(previewDays)
      ? format(addDays(new Date(), previewDays), 'yyyy-MM-dd')
      : null;

  // Colour coding vs PR required date
  const dateColour = () => {
    if (!previewDate || !prRequiredDate) return 'text-gray-700';
    return previewDate <= prRequiredDate ? 'text-green-600' : 'text-red-600';
  };

  const handleSave = async () => {
    const days = inputDays === '' ? null : parseInt(inputDays);
    if (days !== null && (isNaN(days) || days < 0)) {
      toast.error('Invalid', 'Lead time must be a positive number of days');
      return;
    }
    try {
      await updateMut.mutateAsync(days);
      toast.success('Lead time saved');
      setDirty(false);
      setLastSaved(new Date());
    } catch (err: any) {
      toast.error('Save failed', err?.message);
    }
  };

  const handleReset = async () => {
    try {
      await updateMut.mutateAsync(null);
      setInputDays('');
      setDirty(false);
      setLastSaved(new Date());
      toast.success('Reset to system lead time');
    } catch (err: any) {
      toast.error('Reset failed', err?.message);
    }
  };

  if (isLoading) return <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>;
  if (!data) return null;

  return (
    <div className="flex gap-6">
      {/* Left: input + computed date */}
      <div className="flex-1 flex flex-col gap-4 max-w-xs">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <Clock size={11} />
            Lead Time (days)
          </label>

          <div className="flex items-center gap-2">
            <input
              type="number"
              value={inputDays}
              min={0}
              placeholder={data.systemLeadTimeDays != null ? `${data.systemLeadTimeDays} (system)` : 'Enter days'}
              onChange={(e) => { setInputDays(e.target.value); setDirty(true); }}
              className="erp-input w-28 text-right text-sm"
              disabled={readOnly}
            />
            <span
              className={`
                inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                ${data.source === 'MANUAL'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
                }
              `}
            >
              {data.source}
            </span>
          </div>

          {data.systemLeadTimeDays != null && (
            <p className="text-[10px] text-gray-400">
              System avg: <strong>{data.systemLeadTimeDays} days</strong> (from {data.historicalLeadTimes.length} POs)
            </p>
          )}
        </div>

        {/* Expected delivery */}
        {(previewDate || data.expectedDeliveryDate) && (
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <Calendar size={10} /> Expected Delivery Date
            </p>
            <p className={`text-sm font-bold ${dateColour()}`}>
              {previewDate ?? (data.expectedDeliveryDate
                ? format(new Date(data.expectedDeliveryDate), 'dd MMM yyyy')
                : '—')}
            </p>
            {prRequiredDate && previewDate && (
              <p className={`text-[10px] mt-0.5 ${dateColour()}`}>
                {previewDate <= prRequiredDate
                  ? '✓ Within required date'
                  : `⚠ Exceeds required date (${format(new Date(prRequiredDate), 'dd MMM yyyy')})`
                }
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!readOnly && (
          <div className="flex items-center gap-2">
            {dirty && (
              <button
                type="button"
                onClick={handleSave}
                disabled={updateMut.isPending}
                className="toolbar-btn bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={11} />
                {updateMut.isPending ? 'Saving…' : 'Save'}
              </button>
            )}
            {data.source === 'MANUAL' && (
              <button
                type="button"
                onClick={handleReset}
                disabled={updateMut.isPending}
                className="toolbar-btn"
              >
                <RotateCcw size={11} /> Reset to System
              </button>
            )}
          </div>
        )}

        {lastSaved && (
          <p className="text-[10px] text-gray-400">
            Last saved: {lastSaved.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Right: historical lead times */}
      <div className="flex-1 flex flex-col gap-2">
        <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
          <TrendingUp size={11} /> Historical Lead Times (last {data.historicalLeadTimes.length} POs)
        </p>

        {data.historicalLeadTimes.length === 0 ? (
          <p className="text-xs text-gray-400">No purchase history for this item.</p>
        ) : (
          <table className="w-full text-xs border border-gray-200 rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left text-gray-500">PO No</th>
                <th className="px-2 py-1.5 text-left text-gray-500">Supplier</th>
                <th className="px-2 py-1.5 text-right text-gray-500">Days</th>
                <th className="px-2 py-1.5 text-left text-gray-500">PO Date</th>
              </tr>
            </thead>
            <tbody>
              {data.historicalLeadTimes.map((h, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-2 py-1 font-mono text-blue-600">{h.poNumber}</td>
                  <td className="px-2 py-1 text-gray-700 truncate max-w-[120px]">{h.supplier}</td>
                  <td className="px-2 py-1 text-right font-semibold text-gray-800">{h.leadTimeDays}</td>
                  <td className="px-2 py-1 text-gray-500">
                    {format(new Date(h.poDate), 'dd MMM yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
            {data.systemLeadTimeDays != null && (
              <tfoot className="bg-blue-50 border-t border-blue-100">
                <tr>
                  <td colSpan={2} className="px-2 py-1 text-xs font-semibold text-blue-600">Average</td>
                  <td className="px-2 py-1 text-right text-xs font-bold text-blue-700">
                    {data.systemLeadTimeDays} days
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
