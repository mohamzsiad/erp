import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import {
  useAlternateItems,
  useUpsertAlternateItems,
  type AlternateItemRow,
} from '../../../api/prSubSections';
import { searchItems, searchUoms } from '../../../api/procurement';
import { LookupField } from '../../ui/LookupField';
import { useToast } from '../../ui/Toast';

interface Props {
  prlId:    string;
  lineId:   string;
  readOnly: boolean;
}

let rowCounter = 0;
const tempId = () => `__new_${++rowCounter}`;

export default function AlternateItemsTab({ prlId, lineId, readOnly }: Props) {
  const toast  = useToast();
  const { data: savedData, isLoading } = useAlternateItems(prlId, lineId);
  const upsert = useUpsertAlternateItems(prlId, lineId);

  const [rows, setRows] = useState<(AlternateItemRow & { _key: string })[]>([]);
  const [dirty, setDirty] = useState(false);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => {
    if (!savedData) return;
    setRows(savedData.map((r) => ({ ...r, _key: r.id ?? tempId() })));
    setDirty(false);
  }, [savedData]);

  const addRow = () => {
    const priority = rows.length + 1;
    setRows((prev) => [
      ...prev,
      { _key: tempId(), itemId: '', priority },
    ]);
    setDirty(true);
  };

  const removeRow = (key: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r._key !== key);
      return next.map((r, i) => ({ ...r, priority: i + 1 }));
    });
    setDirty(true);
  };

  const update = (key: string, field: keyof AlternateItemRow, value: unknown) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
    setDirty(true);
  };

  // Drag-to-reorder
  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver  = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx.current!, 1);
      next.splice(idx, 0, moved);
      dragIdx.current = idx;
      return next.map((r, i) => ({ ...r, priority: i + 1 }));
    });
    setDirty(true);
  };
  const handleDragEnd = () => { dragIdx.current = null; };

  const handleSave = async () => {
    const invalid = rows.find((r) => !r.itemId);
    if (invalid) {
      toast.error('Validation', 'All rows must have an item selected');
      return;
    }
    try {
      await upsert.mutateAsync(rows.map((r, i) => ({ ...r, priority: i + 1 })));
      toast.success('Alternate items saved');
      setDirty(false);
    } catch (err: any) {
      toast.error('Save failed', err?.message);
    }
  };

  if (isLoading) return <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>;

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={addRow} className="toolbar-btn">
            <Plus size={11} /> Add Alternate
          </button>
          {dirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={upsert.isPending}
              className="toolbar-btn bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {upsert.isPending ? 'Saving…' : 'Save'}
            </button>
          )}
          <span className="text-xs text-gray-400 ml-2">Drag rows to reorder priority</span>
        </div>
      )}

      <div className="overflow-auto">
        <table className="w-full text-xs border border-gray-200 rounded">
          <thead className="bg-gray-50">
            <tr>
              {!readOnly && <th className="w-7" />}
              <th className="px-2 py-1.5 text-center w-12 text-gray-500">Priority</th>
              <th className="px-2 py-1.5 text-left min-w-[180px]">Alternate Item *</th>
              <th className="px-2 py-1.5 text-left w-20">Grade 1</th>
              <th className="px-2 py-1.5 text-left w-20">Grade 2</th>
              <th className="px-2 py-1.5 text-left w-20">UOM</th>
              <th className="px-2 py-1.5 text-right w-28">Approx Price</th>
              <th className="px-2 py-1.5 text-left">Remarks</th>
              {!readOnly && <th className="w-7" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                  No alternate items. {!readOnly && 'Click "+ Add Alternate" to add substitutes.'}
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr
                key={row._key}
                draggable={!readOnly}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${!readOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                {!readOnly && (
                  <td className="px-1 py-1 text-gray-300 hover:text-gray-500">
                    <GripVertical size={12} />
                  </td>
                )}
                <td className="px-2 py-1 text-center">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                    {idx + 1}
                  </span>
                </td>
                <td className="px-1 py-1">
                  <LookupField
                    value={row.item
                      ? { value: row.itemId, label: row.item.description, subLabel: row.item.code }
                      : row.itemId ? { value: row.itemId, label: row.itemId } : null
                    }
                    onChange={(opt) => {
                      setRows((prev) => prev.map((r) =>
                        r._key === row._key
                          ? {
                              ...r,
                              itemId: opt?.value ?? '',
                              item: opt ? { id: opt.value, description: opt.label, code: opt.subLabel ?? '' } : undefined,
                            }
                          : r
                      ));
                      setDirty(true);
                    }}
                    onSearch={searchItems}
                    placeholder="Search item…"
                    disabled={readOnly}
                    className="min-w-[160px] text-xs"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.grade1 ?? ''}
                    onChange={(e) => update(row._key, 'grade1', e.target.value || null)}
                    className="erp-input w-full text-xs"
                    disabled={readOnly}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={row.grade2 ?? ''}
                    onChange={(e) => update(row._key, 'grade2', e.target.value || null)}
                    className="erp-input w-full text-xs"
                    disabled={readOnly}
                  />
                </td>
                <td className="px-1 py-1">
                  <LookupField
                    value={row.uom ? { value: row.uom, label: row.uom } : null}
                    onChange={(opt) => update(row._key, 'uom', opt?.value ?? null)}
                    onSearch={async (q) => {
                      const uoms = await searchUoms(q);
                      return uoms.map((u) => ({ value: u.label, label: u.label, subLabel: u.subLabel }));
                    }}
                    placeholder="e.g. KG"
                    disabled={readOnly}
                    className="w-20 text-xs"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    value={row.approxPrice ?? ''}
                    min={0}
                    step="0.001"
                    onChange={(e) => update(row._key, 'approxPrice', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                    className="erp-input w-full text-right text-xs"
                    disabled={readOnly}
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
        </table>
      </div>
    </div>
  );
}
