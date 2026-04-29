import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useDeliverySchedules, useUpsertDeliverySchedules, type DeliveryScheduleRow } from '../../../api/prSubSections';
import { searchLocations } from '../../../api/procurement';
import { LookupField } from '../../ui/LookupField';
import { useToast } from '../../ui/Toast';

interface Props {
  prlId:    string;
  lineId:   string;
  reqQty:   number;
  readOnly: boolean;
}

let rowCounter = 0;
const tempId = () => `__new_${++rowCounter}`;

export default function DeliveryScheduleTab({ prlId, lineId, reqQty, readOnly }: Props) {
  const toast = useToast();
  const { data: saved = [], isLoading } = useDeliverySchedules(prlId, lineId);
  const upsert = useUpsertDeliverySchedules(prlId, lineId);

  const [rows, setRows] = useState<(DeliveryScheduleRow & { _key: string })[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setRows(saved.map((r) => ({ ...r, _key: r.id ?? tempId() })));
    setDirty(false);
  }, [saved]);

  const totalScheduled = rows.reduce((s, r) => s + (r.qty || 0), 0);
  const isOver = totalScheduled > reqQty;

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { _key: tempId(), deliveryDate: '', qty: 0, locationId: null, remarks: null },
    ]);
    setDirty(true);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r._key !== key));
    setDirty(true);
  };

  const update = (key: string, field: keyof DeliveryScheduleRow, value: unknown) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
    setDirty(true);
  };

  const handleSave = async () => {
    if (isOver) {
      toast.error('Validation', `Scheduled total (${totalScheduled}) exceeds required qty (${reqQty})`);
      return;
    }
    try {
      await upsert.mutateAsync(rows);
      toast.success('Delivery schedule saved');
      setDirty(false);
    } catch (err: any) {
      toast.error('Save failed', err?.message);
    }
  };

  if (isLoading) return <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>;

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={addRow} className="toolbar-btn">
            <Plus size={11} /> Add Line
          </button>
          {dirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={upsert.isPending || isOver}
              className="toolbar-btn bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {upsert.isPending ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-auto">
        <table className="w-full text-xs border border-gray-200 rounded">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left w-6 text-gray-500">#</th>
              <th className="px-2 py-1.5 text-left w-36">Delivery Date *</th>
              <th className="px-2 py-1.5 text-right w-24">Qty *</th>
              <th className="px-2 py-1.5 text-left w-40">Location</th>
              <th className="px-2 py-1.5 text-left">Remarks</th>
              {!readOnly && <th className="w-7" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No delivery schedule. {!readOnly && 'Click "+ Add Line" to begin.'}
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row._key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                <td className="px-1 py-1">
                  <input
                    type="date"
                    value={row.deliveryDate}
                    onChange={(e) => update(row._key, 'deliveryDate', e.target.value)}
                    className="erp-input w-full text-xs"
                    disabled={readOnly}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    value={row.qty}
                    min={0}
                    step="0.001"
                    onChange={(e) => update(row._key, 'qty', parseFloat(e.target.value) || 0)}
                    className="erp-input w-full text-right text-xs"
                    disabled={readOnly}
                  />
                </td>
                <td className="px-1 py-1">
                  <LookupField
                    value={row.locationId
                      ? { value: row.locationId, label: row.location?.name ?? row.locationId }
                      : null}
                    onChange={(opt) => {
                      setRows((prev) => prev.map((r) =>
                        r._key === row._key
                          ? {
                              ...r,
                              locationId: opt?.value ?? null,
                              location: opt ? { id: opt.value, name: opt.label, code: opt.subLabel ?? '' } : null,
                            }
                          : r
                      ));
                      setDirty(true);
                    }}
                    onSearch={searchLocations}
                    placeholder="Select…"
                    disabled={readOnly}
                    className="text-xs"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.remarks ?? ''}
                    onChange={(e) => update(row._key, 'remarks', e.target.value || null)}
                    className="erp-input w-full text-xs"
                    disabled={readOnly}
                  />
                </td>
                {!readOnly && (
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => removeRow(row._key)}
                      className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={2} className="px-2 py-1 text-right text-xs font-semibold text-gray-600">
                  Scheduled Total:
                </td>
                <td className={`px-2 py-1 text-right text-xs font-bold ${isOver ? 'text-red-600' : 'text-gray-800'}`}>
                  {totalScheduled.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </td>
                <td colSpan={3} className="px-2 py-1">
                  {isOver ? (
                    <span className="flex items-center gap-1 text-red-600 text-xs">
                      <AlertTriangle size={11} />
                      Exceeds Req. Qty ({reqQty})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-400 text-xs">
                      of {reqQty} req.
                      {totalScheduled === reqQty && <CheckCircle2 size={11} className="text-green-500" />}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
