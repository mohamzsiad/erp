import { useState, useEffect, useCallback } from 'react';
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
  type PriceListKind,
  type ItemWac,
} from '../../../api/sales';
import { useCurrencies } from '../../../api/salesMasters';
import { masterLabel } from '@clouderp/shared';
import { useItemList, useUoms } from '../../../api/inventory';

interface ItemRow {
  itemId: string;
  itemLabel: string;
  uomId: string;
  unitPrice: number;
  minPrice: number;
  /** Both mandatory — a price with no window is rejected on save. */
  validFrom: string;
  validTo: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const yearEnd = () => `${new Date().getFullYear()}-12-31`;

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

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<PriceListKind>('STANDARD');
  const [ownerCustomerId, setOwnerCustomerId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
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
  const [newValidFrom, setNewValidFrom] = useState<string>(today());
  const [newValidTo, setNewValidTo] = useState<string>(yearEnd());
  // Running weighted average cost of the item being priced.
  const [wac, setWac] = useState<ItemWac | null>(null);

  // assignment state
  const [assignCategoryId, setAssignCategoryId] = useState('');
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const { data: customers } = useCustomerList({ limit: 200 });
  const { data: currencies } = useCurrencies();

  useEffect(() => {
    if (!existing) return;
    setCode(existing.code ?? '');
    setName(existing.name);
    setType(existing.type ?? 'STANDARD');
    setOwnerCustomerId(existing.ownerCustomerId ?? '');
    setCurrencyId(existing.currencyId ?? '');
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
      validFrom: i.validFrom ? i.validFrom.slice(0, 10) : today(),
      validTo: i.validTo ? i.validTo.slice(0, 10) : yearEnd(),
    })));
  }, [existing]);

  // Pull the item's running WAC so the user prices above cost knowingly.
  const loadWac = useCallback(async (itemId: string) => {
    if (!itemId) { setWac(null); return; }
    try { setWac(await priceListApi.itemWac(itemId)); }
    catch { setWac(null); }
  }, []);

  const addRow = () => {
    if (!newItemId || !newUomId) { setError('Pick an item and UOM to add a line'); return; }
    if (rows.some((r) => r.itemId === newItemId && r.uomId === newUomId)) { setError('That item/UOM is already in the list'); return; }
    if (!newValidFrom || !newValidTo) { setError('A price line needs both a Valid From and a Valid To date'); return; }
    if (newValidTo < newValidFrom) { setError('A price line cannot end before it starts'); return; }
    const it = itemOptions.find((o) => o.id === newItemId);
    setRows((r) => [...r, {
      itemId: newItemId,
      itemLabel: it ? `${it.code} — ${it.description}` : newItemId,
      uomId: newUomId, unitPrice: Number(newPrice) || 0, minPrice: Number(newMin) || 0,
      validFrom: newValidFrom, validTo: newValidTo,
    }]);
    setNewItemId(''); setNewUomId(''); setNewPrice(0); setNewMin(0); setWac(null); setError(null);
  };

  const updateRow = (i: number, patch: Partial<ItemRow>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const buildPayload = (): UpsertPriceListInput => ({
    code: code || undefined,   // blank lets the API generate STD001 / CSP001
    name: name.trim(),
    type,
    // Only a customer-specific list is tied to a customer (1-to-1).
    ownerCustomerId: type === 'CUSTOMER_SPECIFIC' ? ownerCustomerId || null : null,
    currencyId: currencyId || null,
    validFrom: validFrom || null,
    validTo: validTo || null,
    isActive,
    isDefault: type === 'STANDARD' ? isDefault : false,
    items: rows.map((r) => ({
      itemId: r.itemId, uomId: r.uomId, unitPrice: Number(r.unitPrice) || 0, minPrice: Number(r.minPrice) || 0,
      validFrom: r.validFrom, validTo: r.validTo,
    })),
  });

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) { setError('Description is required'); return; }
    if (type === 'CUSTOMER_SPECIFIC' && !ownerCustomerId) { setError('Pick the customer this price list belongs to'); return; }
    // Every line needs a validity window before the list can be saved.
    const undated = rows.findIndex((r) => !r.validFrom || !r.validTo);
    if (undated >= 0) { setError(`Line ${undated + 1} (${rows[undated].itemLabel}) needs both a Valid From and a Valid To date`); return; }
    const inverted = rows.findIndex((r) => r.validTo < r.validFrom);
    if (inverted >= 0) { setError(`Line ${inverted + 1} (${rows[inverted].itemLabel}) ends before it starts`); return; }
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
        {isEdit && !isDefault && type === 'STANDARD' && (
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Price List Code *</label>
            <input
              className="erp-input w-full"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={isEdit ? '' : 'Auto-generated if blank'}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
            <select className="erp-input w-full" value={type} onChange={(e) => setType(e.target.value as PriceListKind)}>
              <option value="STANDARD">Standard</option>
              <option value="CUSTOMER_SPECIFIC">Customer Specific</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <input className="erp-input w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {type === 'CUSTOMER_SPECIFIC' ? (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer *</label>
              <select className="erp-input w-full" value={ownerCustomerId} onChange={(e) => setOwnerCustomerId(e.target.value)}>
                <option value="">Select customer…</option>
                {(customers?.data ?? []).map((c) => <option key={c.id} value={c.id}>{masterLabel(c.code, c.name)}</option>)}
              </select>
            </div>
          ) : (
            <div className="col-span-2 flex items-end text-xs text-gray-500">
              A standard price list attaches to any number of customers and customer categories.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
            <select className="erp-input w-full" value={currencyId} onChange={(e) => setCurrencyId(e.target.value)}>
              <option value="">—</option>
              {(currencies ?? []).map((c) => <option key={c.id} value={c.id}>{masterLabel(c.code, c.name)}</option>)}
            </select>
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
          {type === 'STANDARD' && (
            <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Company default</label>
          )}
        </div>

        {/* Items */}
        <div className="bg-white border border-gray-200 rounded">
          <div className="px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-700">Items ({rows.length})</div>
          {/* Add row */}
          <div className="flex flex-wrap items-end gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
            <div>
              <label className="block text-[10px] text-gray-500">Item</label>
              <select
                className="erp-input w-56"
                value={newItemId}
                onChange={(e) => { setNewItemId(e.target.value); loadWac(e.target.value); }}
              >
                <option value="">Select item…</option>
                {itemOptions.map((o) => <option key={o.id} value={o.id}>{masterLabel(o.code, o.description)}</option>)}
              </select>
            </div>
            {/* The running weighted average cost, shown before the price is keyed */}
            <div>
              <label className="block text-[10px] text-gray-500">Current WAC</label>
              <div className="h-[30px] px-2 flex items-center rounded border border-gray-200 bg-white text-sm tabular-nums min-w-[7rem]">
                {wac
                  ? <span className={wac.source === 'STANDARD_COST' ? 'text-gray-500' : 'text-gray-800 font-medium'}>
                      {wac.wac.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                    </span>
                  : <span className="text-gray-300">—</span>}
              </div>
              {wac && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {wac.source === 'STANDARD_COST' ? 'no stock — standard cost' : `on hand ${wac.qtyOnHand.toLocaleString()}`}
                </p>
              )}
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
            <div>
              <label className="block text-[10px] text-gray-500">Valid From *</label>
              <input type="date" className="erp-input" value={newValidFrom} onChange={(e) => setNewValidFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500">Valid To *</label>
              <input type="date" className="erp-input" value={newValidTo} onChange={(e) => setNewValidTo(e.target.value)} />
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
                  <th className="px-2 py-1 font-medium w-36">Valid From *</th>
                  <th className="px-2 py-1 font-medium w-36">Valid To *</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-2 py-1">{row.itemLabel}</td>
                    <td className="px-2 py-1"><input type="number" className="erp-input w-24" value={row.unitPrice} onChange={(e) => updateRow(i, { unitPrice: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><input type="number" className="erp-input w-24" value={row.minPrice} onChange={(e) => updateRow(i, { minPrice: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><input type="date" className={`erp-input ${row.validFrom ? '' : 'border-red-400 bg-red-50'}`} value={row.validFrom} onChange={(e) => updateRow(i, { validFrom: e.target.value })} /></td>
                    <td className="px-2 py-1"><input type="date" className={`erp-input ${row.validTo ? '' : 'border-red-400 bg-red-50'}`} value={row.validTo} onChange={(e) => updateRow(i, { validTo: e.target.value })} /></td>
                    <td className="px-2 py-1"><button onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Assignment — a standard list can serve any number of customer categories.
            Customers get their price list on the customer master. */}
        {isEdit && type === 'STANDARD' && (
          <div className="bg-white border border-gray-200 rounded p-4 space-y-3 max-w-2xl">
            <div className="text-xs font-semibold text-gray-700">Assign to a customer category</div>
            <div className="text-xs text-gray-500">
              Individual customers are given their price list on the customer master.
            </div>
            {assignMsg && <div className="text-xs text-[#1F4E79]">{assignMsg}</div>}
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
