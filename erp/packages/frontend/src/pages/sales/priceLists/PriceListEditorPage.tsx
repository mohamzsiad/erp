import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Star, Loader2 } from 'lucide-react';
import {
  usePriceList,
  useCreatePriceList,
  useUpdatePriceList,
  useSetDefaultPriceList,
  priceListApi,
  useCustomerList,
  type UpsertPriceListInput,
} from '../../../api/sales';
import { useItemList, useUoms } from '../../../api/inventory';

interface ItemRow {
  itemId: string;
  itemLabel: string;
  uomId: string;
  unitPrice: number;
  minPrice: number;
  validFrom: string;
  validTo: string;
}

export default function PriceListEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading } = usePriceList(id);
  const createMut = useCreatePriceList();
  const updateMut = useUpdatePriceList(id ?? '');
  const setDefaultMut = useSetDefaultPriceList();

  const { data: itemsResp } = useItemList({ limit: 200 });
  const { data: uomsResp } = useUoms();
  const itemOptions = (((itemsResp as any)?.data ?? []) as Array<{ id: string; code: string; description: string }>);
  const uomOptions = (((uomsResp as any)?.data ?? (uomsResp as any) ?? []) as Array<{ id: string; code: string; name: string }>);

  const [name, setName] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // add-item form state
  const [newItemId, setNewItemId] = useState('');
  const [newUomId, setNewUomId] = useState('');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newMin, setNewMin] = useState<number>(0);

  // assignment state
  const [assignCustomerId, setAssignCustomerId] = useState('');
  const [assignCategoryId, setAssignCategoryId] = useState('');
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const { data: customers } = useCustomerList({ limit: 200 });

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setValidFrom(existing.validFrom ? existing.validFrom.slice(0, 10) : '');
    setValidTo(existing.validTo ? existing.validTo.slice(0, 10) : '');
    setIsActive(existing.isActive);
    setIsDefault(existing.isDefault);
    setRows(existing.items.map((i) => ({
      itemId: i.itemId,
      itemLabel: i.itemCode ? `${i.itemCode} — ${i.itemDescription ?? ''}` : i.itemId,
      uomId: i.uomId,
      unitPrice: i.unitPrice,
      minPrice: i.minPrice,
      validFrom: i.validFrom ? i.validFrom.slice(0, 10) : '',
      validTo: i.validTo ? i.validTo.slice(0, 10) : '',
    })));
  }, [existing]);

  const addRow = () => {
    if (!newItemId || !newUomId) { setError('Pick an item and UOM to add a line'); return; }
    if (rows.some((r) => r.itemId === newItemId && r.uomId === newUomId)) { setError('That item/UOM is already in the list'); return; }
    const it = itemOptions.find((o) => o.id === newItemId);
    setRows((r) => [...r, {
      itemId: newItemId,
      itemLabel: it ? `${it.code} — ${it.description}` : newItemId,
      uomId: newUomId, unitPrice: Number(newPrice) || 0, minPrice: Number(newMin) || 0, validFrom: '', validTo: '',
    }]);
    setNewItemId(''); setNewUomId(''); setNewPrice(0); setNewMin(0); setError(null);
  };

  const updateRow = (i: number, patch: Partial<ItemRow>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const buildPayload = (): UpsertPriceListInput => ({
    name: name.trim(),
    validFrom: validFrom || null,
    validTo: validTo || null,
    isActive,
    isDefault,
    items: rows.map((r) => ({
      itemId: r.itemId, uomId: r.uomId, unitPrice: Number(r.unitPrice) || 0, minPrice: Number(r.minPrice) || 0,
      validFrom: r.validFrom || null, validTo: r.validTo || null,
    })),
  });

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }
    try {
      if (isEdit) await updateMut.mutateAsync(buildPayload());
      else await createMut.mutateAsync(buildPayload());
      navigate('/sales/price-lists');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Save failed');
    }
  };

  const doAssign = async (targetType: 'CUSTOMER' | 'CATEGORY', targetId: string) => {
    if (!id || !targetId) return;
    setAssignMsg(null);
    try {
      await priceListApi.assign(id, targetType, targetId);
      setAssignMsg(`Assigned to ${targetType.toLowerCase()}.`);
    } catch (e: any) {
      setAssignMsg(e?.response?.data?.message ?? 'Assignment failed');
    }
  };

  const saving = createMut.isPending || updateMut.isPending;
  if (isEdit && isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#1F4E79]" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <button onClick={() => navigate('/sales/price-lists')} className="toolbar-btn"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">{isEdit ? `Price List: ${name}` : 'New Price List'}</h2>
        <div className="flex-1" />
        {isEdit && !isDefault && (
          <button onClick={() => id && setDefaultMut.mutate(id, { onSuccess: () => setIsDefault(true) })} className="toolbar-btn" title="Set as company default">
            <Star size={13} /><span>Set Default</span>
          </button>
        )}
        <button onClick={handleSave} disabled={saving} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save</span>
        </button>
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input className="erp-input w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Valid From</label>
            <input type="date" className="erp-input w-full" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Valid To</label>
            <input type="date" className="erp-input w-full" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label>
          <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Company default</label>
        </div>

        {/* Items */}
        <div className="bg-white border border-gray-200 rounded">
          <div className="px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-700">Items ({rows.length})</div>
          {/* Add row */}
          <div className="flex flex-wrap items-end gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
            <div>
              <label className="block text-[10px] text-gray-500">Item</label>
              <select className="erp-input w-56" value={newItemId} onChange={(e) => setNewItemId(e.target.value)}>
                <option value="">Select item…</option>
                {itemOptions.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.description}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500">UOM</label>
              <select className="erp-input w-24" value={newUomId} onChange={(e) => setNewUomId(e.target.value)}>
                <option value="">—</option>
                {uomOptions.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500">Unit Price</label>
              <input type="number" className="erp-input w-28" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500">Min Price</label>
              <input type="number" className="erp-input w-28" value={newMin} onChange={(e) => setNewMin(Number(e.target.value))} />
            </div>
            <button onClick={addRow} className="toolbar-btn"><Plus size={13} /><span>Add</span></button>
          </div>
          {rows.length === 0 ? (
            <div className="p-4 text-xs text-gray-400">No items yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-2 py-1 font-medium">Item</th>
                  <th className="px-2 py-1 font-medium w-28">Unit Price</th>
                  <th className="px-2 py-1 font-medium w-28">Min Price</th>
                  <th className="px-2 py-1 font-medium w-36">Valid From</th>
                  <th className="px-2 py-1 font-medium w-36">Valid To</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-2 py-1">{row.itemLabel}</td>
                    <td className="px-2 py-1"><input type="number" className="erp-input w-24" value={row.unitPrice} onChange={(e) => updateRow(i, { unitPrice: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><input type="number" className="erp-input w-24" value={row.minPrice} onChange={(e) => updateRow(i, { minPrice: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><input type="date" className="erp-input" value={row.validFrom} onChange={(e) => updateRow(i, { validFrom: e.target.value })} /></td>
                    <td className="px-2 py-1"><input type="date" className="erp-input" value={row.validTo} onChange={(e) => updateRow(i, { validTo: e.target.value })} /></td>
                    <td className="px-2 py-1"><button onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Assignment (edit only) */}
        {isEdit && (
          <div className="bg-white border border-gray-200 rounded p-4 space-y-3 max-w-2xl">
            <div className="text-xs font-semibold text-gray-700">Assign this price list</div>
            {assignMsg && <div className="text-xs text-[#1F4E79]">{assignMsg}</div>}
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-[10px] text-gray-500">Customer</label>
                <select className="erp-input w-64" value={assignCustomerId} onChange={(e) => setAssignCustomerId(e.target.value)}>
                  <option value="">Select customer…</option>
                  {(customers?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </div>
              <button onClick={() => doAssign('CUSTOMER', assignCustomerId)} className="toolbar-btn">Assign to customer</button>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-[10px] text-gray-500">Category ID</label>
                <input className="erp-input w-64" value={assignCategoryId} onChange={(e) => setAssignCategoryId(e.target.value)} placeholder="Customer category id" />
              </div>
              <button onClick={() => doAssign('CATEGORY', assignCategoryId)} className="toolbar-btn">Assign to category</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
