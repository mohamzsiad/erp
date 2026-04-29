import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import { useItemSupplierXRefs, useUpsertItemSupplierXRefs } from '../../../api/inventory';
import { searchSuppliers } from '../../../api/procurement';
import { LookupField } from '../../ui/LookupField';
import { useToast } from '../../ui/Toast';

interface Props {
  itemId: string;
}

let rowKey = 0;
const tempKey = () => `__new_${++rowKey}`;

interface XRefRow {
  _key:         string;
  id?:          string;
  supplierId:   string;
  supplier?:    { id: string; code: string; name: string };
  supplierCode: string;
  supplierDesc: string;
  uom:          string;
  unitPrice:    string;
  currency:     string;
  leadTimeDays: string;
  minOrderQty:  string;
  isPreferred:  boolean;
  notes:        string;
}

function blankRow(): XRefRow {
  return {
    _key: tempKey(), supplierId: '', supplierCode: '', supplierDesc: '',
    uom: '', unitPrice: '', currency: 'USD', leadTimeDays: '0',
    minOrderQty: '', isPreferred: false, notes: '',
  };
}

export default function SupplierXRefTab({ itemId }: Props) {
  const toast = useToast();
  const { data: savedData, isLoading } = useItemSupplierXRefs(itemId);
  const upsert = useUpsertItemSupplierXRefs(itemId);

  const [rows, setRows] = useState<XRefRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const raw: any[] = Array.isArray(savedData) ? savedData : (savedData as any)?.data ?? [];
    setRows(
      raw.map((r) => ({
        _key:         r.id,
        id:           r.id,
        supplierId:   r.supplierId,
        supplier:     r.supplier,
        supplierCode: r.supplierCode ?? '',
        supplierDesc: r.supplierDesc ?? '',
        uom:          r.uom ?? '',
        unitPrice:    r.unitPrice != null ? String(r.unitPrice) : '',
        currency:     r.currency ?? 'USD',
        leadTimeDays: String(r.leadTimeDays ?? 0),
        minOrderQty:  r.minOrderQty != null ? String(r.minOrderQty) : '',
        isPreferred:  r.isPreferred ?? false,
        notes:        r.notes ?? '',
      })),
    );
    setDirty(false);
  }, [savedData]);

  const addRow = () => { setRows((p) => [...p, blankRow()]); setDirty(true); };

  const removeRow = (key: string) => { setRows((p) => p.filter((r) => r._key !== key)); setDirty(true); };

  const update = (key: string, field: keyof XRefRow, value: unknown) => {
    setRows((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));
    setDirty(true);
  };

  const togglePreferred = (key: string) => {
    setRows((p) => p.map((r) => r._key === key ? { ...r, isPreferred: !r.isPreferred } : { ...r, isPreferred: false }));
    setDirty(true);
  };

  const handleSave = async () => {
    const invalid = rows.find((r) => !r.supplierId);
    if (invalid) { toast.error('Validation', 'All rows must have a supplier selected'); return; }
    try {
      await upsert.mutateAsync(
        rows.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          supplierId:   r.supplierId,
          supplierCode: r.supplierCode || undefined,
          supplierDesc: r.supplierDesc || undefined,
          uom:          r.uom || undefined,
          unitPrice:    r.unitPrice !== '' ? parseFloat(r.unitPrice) : undefined,
          currency:     r.currency || undefined,
          leadTimeDays: parseInt(r.leadTimeDays, 10) || 0,
          minOrderQty:  r.minOrderQty !== '' ? parseFloat(r.minOrderQty) : undefined,
          isPreferred:  r.isPreferred,
          notes:        r.notes || undefined,
        })),
      );
      toast.success('Supplier references saved');
      setDirty(false);
    } catch (err: any) {
      toast.error('Save failed', err?.message);
    }
  };

  if (isLoading) return <p className="text-xs text-gray-400 py-6 text-center">Loading…</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={addRow} className="toolbar-btn">
          <Plus size={11} /> Add Supplier
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
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs border border-gray-200 rounded">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left min-w-[180px]">Supplier *</th>
              <th className="px-2 py-1.5 text-left w-32">Supplier Code</th>
              <th className="px-2 py-1.5 text-left min-w-[160px]">Supplier Description</th>
              <th className="px-2 py-1.5 text-left w-20">UOM</th>
              <th className="px-2 py-1.5 text-right w-28">Unit Price</th>
              <th className="px-2 py-1.5 text-left w-16">Currency</th>
              <th className="px-2 py-1.5 text-right w-24">Lead Time (d)</th>
              <th className="px-2 py-1.5 text-right w-24">Min Qty</th>
              <th className="px-2 py-1.5 text-center w-12" title="Preferred">Pref</th>
              <th className="px-2 py-1.5 text-left">Notes</th>
              <th className="w-7" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                  No supplier references. Click &quot;+ Add Supplier&quot; to link a supplier.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row._key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-1 py-1">
                  <LookupField
                    value={
                      row.supplier
                        ? { value: row.supplierId, label: row.supplier.name, subLabel: row.supplier.code }
                        : row.supplierId ? { value: row.supplierId, label: row.supplierId } : null
                    }
                    onChange={(opt) => {
                      setRows((p) => p.map((r) =>
                        r._key === row._key
                          ? { ...r, supplierId: opt?.value ?? '', supplier: opt ? { id: opt.value, name: opt.label, code: opt.subLabel ?? '' } : undefined }
                          : r,
                      ));
                      setDirty(true);
                    }}
                    onSearch={searchSuppliers}
                    placeholder="Search supplier…"
                    className="min-w-[160px] text-xs"
                  />
                </td>
                <td className="px-1 py-1">
                  <input type="text" value={row.supplierCode} onChange={(e) => update(row._key, 'supplierCode', e.target.value)} className="erp-input w-full text-xs" placeholder="Supplier P/N" />
                </td>
                <td className="px-1 py-1">
                  <input type="text" value={row.supplierDesc} onChange={(e) => update(row._key, 'supplierDesc', e.target.value)} className="erp-input w-full text-xs" placeholder="Description at supplier" />
                </td>
                <td className="px-1 py-1">
                  <input type="text" value={row.uom} onChange={(e) => update(row._key, 'uom', e.target.value)} className="erp-input w-full text-xs" placeholder="e.g. KG" />
                </td>
                <td className="px-1 py-1">
                  <input type="number" value={row.unitPrice} min={0} step="0.001" onChange={(e) => update(row._key, 'unitPrice', e.target.value)} className="erp-input w-full text-right text-xs" />
                </td>
                <td className="px-1 py-1">
                  <input type="text" value={row.currency} onChange={(e) => update(row._key, 'currency', e.target.value.toUpperCase().slice(0, 3))} className="erp-input w-full text-xs uppercase" maxLength={3} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" value={row.leadTimeDays} min={0} step="1" onChange={(e) => update(row._key, 'leadTimeDays', e.target.value)} className="erp-input w-full text-right text-xs" />
                </td>
                <td className="px-1 py-1">
                  <input type="number" value={row.minOrderQty} min={0} step="0.001" onChange={(e) => update(row._key, 'minOrderQty', e.target.value)} className="erp-input w-full text-right text-xs" />
                </td>
                <td className="px-1 py-1 text-center">
                  <button type="button" onClick={() => togglePreferred(row._key)} title={row.isPreferred ? 'Preferred supplier' : 'Set as preferred'} className={`p-1 rounded transition-colors ${row.isPreferred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}>
                    <Star size={13} fill={row.isPreferred ? 'currentColor' : 'none'} />
                  </button>
                </td>
                <td className="px-1 py-1">
                  <input type="text" value={row.notes} onChange={(e) => update(row._key, 'notes', e.target.value)} className="erp-input w-full text-xs" placeholder="Notes…" />
                </td>
                <td className="px-1 py-1">
                  <button type="button" onClick={() => removeRow(row._key)} className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors">
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
