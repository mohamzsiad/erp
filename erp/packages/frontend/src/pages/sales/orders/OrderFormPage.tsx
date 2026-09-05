import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, CheckCircle, ThumbsUp, ThumbsDown, Unlock, XCircle,
  MinusCircle, Lock, Loader2, FileInput,
} from 'lucide-react';
import {
  useOrder, useOrderAvailability, useCreateOrder, useUpdateOrder, orderApi,
  type UpsertOrderInput, type CreditCheck, type ItemStockPosition,
} from '../../../api/salesDocs';
import { useCustomerList, priceListApi } from '../../../api/sales';
import { useQuotations, quotationApi } from '../../../api/salesDocs';
import { useSalesmen, usePaymentTerms, useCurrencies, useLocations } from '../../../api/salesMasters';
import { masterLabel } from '@clouderp/shared';
import { useItemList, useUoms, useWarehouseList } from '../../../api/inventory';

interface LineRow {
  lineId?: string; itemId: string; itemLabel: string; uomId: string;
  orderedQty: number; unitPrice: number; minPrice: number | null; discountPct: number;
  // Reservation captured against the line, only for items that allow it
  reservedQty: number; reserveWarehouseId: string; reserveUntil: string;
  reservationAllowed: boolean;
}

// Anything past DRAFT is short-closed instead of cancelled.
const SHORT_CLOSEABLE = ['PENDING_APPROVAL', 'CREDIT_HOLD', 'APPROVED', 'IN_PROGRESS', 'DELIVERED'];
const emptyLine = (): LineRow => ({
  itemId: '', itemLabel: '', uomId: '', orderedQty: 1, unitPrice: 0, minPrice: null, discountPct: 0,
  reservedQty: 0, reserveWarehouseId: '', reserveUntil: '', reservationAllowed: false,
});

export default function OrderFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading, refetch } = useOrder(id);
  const { data: availability, refetch: refetchAvailability } = useOrderAvailability(id);
  const createMut = useCreateOrder();
  const updateMut = useUpdateOrder(id ?? '');
  const { data: customers } = useCustomerList({ limit: 200 });
  const { data: itemsResp } = useItemList({ limit: 200 });
  const { data: uomsResp } = useUoms();
  const { data: whResp } = useWarehouseList({ limit: 200 });
  const { data: salesmen } = useSalesmen({ isActive: true });
  const { data: paymentTerms } = usePaymentTerms({ isActive: true });
  const { data: currencies } = useCurrencies();
  const { data: locations } = useLocations();
  // Only accepted quotations may be pulled into a new order.
  const { data: quotationsResp } = useQuotations({ status: 'ACCEPTED' });
  const itemOptions = (((itemsResp as any)?.data ?? []) as Array<{ id: string; code: string; description: string }>);
  const uomOptions = (((uomsResp as any)?.data ?? (uomsResp as any) ?? []) as Array<{ id: string; code: string }>);
  const whOptions = (((whResp as any)?.data ?? (whResp as any) ?? []) as Array<{ id: string; code: string; name: string }>);

  const [customerId, setCustomerId] = useState('');
  const [orderType, setOrderType] = useState<'STOCK' | 'SERVICE' | 'PROJECT' | 'DIRECT'>('STOCK');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [requestedDate, setRequestedDate] = useState('');
  const [locationId, setLocationId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [salesmanId, setSalesmanId] = useState('');
  const [paymentTermId, setPaymentTermId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<LineRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [credit, setCredit] = useState<CreditCheck | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  // Item stock (selected warehouse + group), keyed by `${itemId}|${warehouseId}`
  const [stock, setStock] = useState<Record<string, ItemStockPosition>>({});
  const [inFlight] = useState(() => new Set<string>());
  const [reserveFor, setReserveFor] = useState<number | null>(null);
  // Currencies this customer is allowed to trade in (empty = all).
  const [allowedCurrencyIds, setAllowedCurrencyIds] = useState<string[]>([]);
  const [sourceQuotationId, setSourceQuotationId] = useState('');
  const [converting, setConverting] = useState(false);

  const status = existing?.status ?? 'DRAFT';
  const editable = !isEdit || status === 'DRAFT';
  const hasDeliveries = (existing?.lines ?? []).some((l: any) => Number(l.deliveredQty ?? 0) > 0);
  // Item details only open up once the header is saved and the doc number issued.
  const headerSaved = isEdit;

  useEffect(() => {
    if (!existing) return;
    setCustomerId(existing.customerId);
    setOrderType(existing.orderType);
    setOrderDate(existing.orderDate ? existing.orderDate.slice(0, 10) : '');
    setRequestedDate(existing.requestedDate ? existing.requestedDate.slice(0, 10) : '');
    setLocationId(existing.locationId ?? '');
    setWarehouseId(existing.warehouseId ?? '');
    setSalesmanId(existing.salesmanId ?? '');
    setPaymentTermId(existing.paymentTermId ?? '');
    setCurrencyId(existing.currencyId ?? '');
    setNotes(existing.notes ?? '');
    setRows((existing.lines ?? []).map((l: any) => ({
      lineId: l.id, itemId: l.itemId, itemLabel: l.item ? `${l.item.code} — ${l.item.description}` : l.itemId,
      uomId: l.uomId, orderedQty: Number(l.orderedQty), unitPrice: Number(l.unitPrice), minPrice: null,
      discountPct: Number(l.discountPct),
      reservedQty: Number(l.reservedQty ?? 0),
      reserveWarehouseId: l.reserveWarehouseId ?? '',
      reserveUntil: l.reserveUntil ? String(l.reserveUntil).slice(0, 10) : '',
      reservationAllowed: !!l.reservationAllowed,
    })));
  }, [existing]);

  // Spool payment terms, currency and salesman off the customer master.
  const applyCustomerDefaults = useCallback(async (cid: string) => {
    if (!cid) return;
    try {
      const d = await orderApi.customerDefaults(cid);
      setPaymentTermId(d.paymentTermId ?? '');
      setCurrencyId(d.currencyId ?? '');
      setSalesmanId(d.salesmanId ?? '');
      setAllowedCurrencyIds(d.allowedCurrencyIds ?? []);
      if (d.creditHold) setBanner('This customer is on credit hold.');
      else if (d.isBlackListed) setBanner('This customer is blacklisted for the current company.');
    } catch { /* leave the header as typed */ }
  }, []);

  const atpByLine = useMemo(() => {
    const m: Record<string, { atp: number; group: number }> = {};
    (availability?.lines ?? []).forEach((a) => { m[a.lineId] = { atp: a.availableToPromise, group: a.groupAvailable }; });
    return m;
  }, [availability]);

  // Warehouse + group stock for the item on each line, fetched once per
  // item/warehouse pair. `inFlight` keeps the cache out of the callback's
  // identity so the effect below does not re-run on every fetch.
  const loadStock = useCallback(async (itemId: string, whId: string) => {
    if (!itemId) return;
    const key = `${itemId}|${whId}`;
    if (inFlight.has(key)) return;
    inFlight.add(key);
    try {
      const s = await orderApi.itemStock(itemId, whId || null);
      setStock((m) => ({ ...m, [key]: s }));
    } catch {
      inFlight.delete(key);   // let a later render retry
    }
  }, [inFlight]);

  useEffect(() => {
    rows.forEach((r) => { if (r.itemId) loadStock(r.itemId, r.reserveWarehouseId || warehouseId); });
  }, [rows, warehouseId, loadStock]);

  const stockFor = (r: LineRow) => stock[`${r.itemId}|${r.reserveWarehouseId || warehouseId}`];

  const upd = (i: number, patch: Partial<LineRow>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  // The rate always comes from the price list — the user only picks item, UOM
  // and quantity. An item with no price simply comes through at 0.
  const prefill = async (i: number, itemId: string, uomId: string) => {
    if (!itemId || !uomId) { upd(i, { unitPrice: 0, minPrice: null }); return; }
    try {
      const res = await priceListApi.lookup({ itemId, uomId, customerId: customerId || undefined, date: orderDate });
      upd(i, { unitPrice: res.unitPrice ?? 0, minPrice: res.minPrice });
    } catch { upd(i, { unitPrice: 0, minPrice: null }); }
  };

  const totals = useMemo(() => {
    let sub = 0, disc = 0;
    rows.forEach((r) => { const g = r.orderedQty * r.unitPrice; sub += g; disc += g * (r.discountPct / 100); });
    return { sub, disc, net: sub - disc };
  }, [rows]);

  const headerPayload = (): UpsertOrderInput => ({
    customerId, orderType, orderDate, requestedDate: requestedDate || null,
    locationId: locationId || null, warehouseId: warehouseId || null,
    salesmanId: salesmanId || null,
    paymentTermId: paymentTermId || null,
    paymentTerms: paymentTerms?.find((t) => t.id === paymentTermId)?.name ?? null,
    currencyId: currencyId || null,
    notes: notes || null,
  });

  // unitPrice is deliberately omitted: the API prices every line off the price list.
  const linePayload = () => rows.filter((r) => r.itemId && r.uomId).map((r) => ({
    itemId: r.itemId, uomId: r.uomId, orderedQty: Number(r.orderedQty) || 0,
    discountPct: Number(r.discountPct) || 0,
  }));

  // Saving the header on its own issues the document number and opens the lines.
  const saveHeader = async () => {
    setError(null);
    if (!customerId) { setError('Select a customer'); return; }
    try {
      const o = await createMut.mutateAsync(headerPayload());
      navigate(`/sales/orders/${o.id}`);
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Save failed'); }
  };

  const save = async () => {
    setError(null);
    if (!customerId) { setError('Select a customer'); return; }
    try {
      await updateMut.mutateAsync({ ...headerPayload(), lines: linePayload() });
      refetch(); refetchAvailability();
      setBanner('Saved.');
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Save failed'); }
  };

  const convertQuotation = async () => {
    if (!sourceQuotationId) { setError('Pick an accepted quotation'); return; }
    setError(null); setConverting(true);
    try {
      const r = await quotationApi.convertToOrder(sourceQuotationId);
      navigate(`/sales/orders/${r.orderId}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not convert the quotation');
    } finally { setConverting(false); }
  };

  const runAction = async (fn: () => Promise<any>, captureCredit = false) => {
    setError(null); setBanner(null);
    try {
      const r = await fn();
      if (captureCredit && r?.creditCheck) setCredit(r.creditCheck);
      if (r?.status) setBanner(`Status: ${r.status}${r?.warnings?.length ? ' — ' + r.warnings.join('; ') : ''}`);
      refetch(); refetchAvailability();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Action failed'); }
  };

  const applyReservation = async (i: number) => {
    const row = rows[i];
    if (!id || !row.lineId) { setError('Save the line before reserving stock'); return; }
    setError(null);
    try {
      await orderApi.reserveLine(id, row.lineId, {
        qty: Number(row.reservedQty) || 0,
        warehouseId: row.reserveWarehouseId || warehouseId || null,
        reserveUntil: row.reserveUntil || null,
      });
      setReserveFor(null);
      inFlight.clear();
      setStock({});           // stock moved — re-read on the next render
      refetch(); refetchAvailability();
      setBanner(Number(row.reservedQty) > 0 ? 'Stock reserved.' : 'Reservation released.');
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Reservation failed'); }
  };

  const saving = createMut.isPending || updateMut.isPending;
  if (isEdit && isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#1F4E79]" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
        <button onClick={() => navigate('/sales/orders')} className="toolbar-btn"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">{isEdit ? `Order ${existing?.docNo ?? ''} · ${status}` : 'New Order'}</h2>
        <div className="flex-1" />
        {isEdit && status === 'DRAFT' && <button onClick={() => runAction(() => orderApi.confirm(id!), true)} className="toolbar-btn"><CheckCircle size={13} /><span>Confirm</span></button>}
        {isEdit && status === 'PENDING_APPROVAL' && <>
          <button onClick={() => runAction(() => orderApi.approve(id!))} className="toolbar-btn"><ThumbsUp size={13} /><span>Approve</span></button>
          <button onClick={() => runAction(() => orderApi.reject(id!))} className="toolbar-btn"><ThumbsDown size={13} /><span>Reject</span></button>
        </>}
        {isEdit && status === 'CREDIT_HOLD' && <button onClick={() => runAction(() => orderApi.releaseHold(id!))} className="toolbar-btn"><Unlock size={13} /><span>Release Hold</span></button>}
        {/* Anything past DRAFT is closed off rather than cancelled, so the
            delivered quantity and its history survive. */}
        {isEdit && SHORT_CLOSEABLE.includes(status) && <button onClick={() => runAction(() => orderApi.shortClose(id!))} className="toolbar-btn"><MinusCircle size={13} /><span>Short-Close</span></button>}
        {isEdit && status === 'DRAFT' && !hasDeliveries && <button onClick={() => runAction(() => orderApi.cancel(id!))} className="toolbar-btn"><XCircle size={13} /><span>Cancel</span></button>}
        {!isEdit && (
          <button onClick={saveHeader} disabled={saving} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save Header</span>
          </button>
        )}
        {isEdit && editable && (
          <button onClick={save} disabled={saving} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save</span>
          </button>
        )}
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}
      {banner && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-blue-50 text-[#1F4E79] border border-blue-200 rounded">{banner}</div>}
      {(existing?.creditHoldReason || credit) && (
        <div className="mx-4 mt-3 px-3 py-2 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded flex flex-wrap gap-4">
          {credit && <span>Available credit: <b>{credit.availableCredit.toLocaleString()}</b></span>}
          {credit?.hasOverdue && <span>Customer has overdue balance</span>}
          {(existing?.creditHoldReason || credit?.reason) && <span>Hold reason: {existing?.creditHoldReason ?? credit?.reason}</span>}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">
              Customer * {headerSaved && <span className="text-gray-400">(locked — the document number is issued against this customer)</span>}
            </label>
            <div className="relative">
              <select
                className="erp-input w-full disabled:bg-gray-100"
                value={customerId}
                onChange={(e) => { setCustomerId(e.target.value); applyCustomerDefaults(e.target.value); }}
                disabled={headerSaved}
              >
                <option value="">Select…</option>
                {(customers?.data ?? []).map((c) => <option key={c.id} value={c.id}>{masterLabel(c.code, c.name)}</option>)}
              </select>
              {headerSaved && <Lock size={12} className="absolute right-6 top-2.5 text-gray-400 pointer-events-none" />}
            </div>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Order Type</label>
            <select className="erp-input w-full" value={orderType} onChange={(e) => setOrderType(e.target.value as any)} disabled={!editable}>
              {['STOCK', 'SERVICE', 'PROJECT', 'DIRECT'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Sales Location</label>
            <select className="erp-input w-full" value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!editable}>
              <option value="">—</option>
              {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{masterLabel(l.code, l.name)}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Warehouse</label>
            <select className="erp-input w-full" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!editable}>
              <option value="">—</option>
              {whOptions.map((w) => <option key={w.id} value={w.id}>{masterLabel(w.code, w.name)}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Order Date</label><input type="date" className="erp-input w-full" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} disabled={!editable} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Delivery Date</label><input type="date" className="erp-input w-full" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} disabled={!editable} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Salesman</label>
            <select className="erp-input w-full" value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)} disabled={!editable}>
              <option value="">—</option>
              {(salesmen ?? []).map((s) => <option key={s.id} value={s.id}>{masterLabel(s.code, s.name)}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Payment Terms <span className="text-gray-400">(from customer)</span></label>
            <select className="erp-input w-full" value={paymentTermId} onChange={(e) => setPaymentTermId(e.target.value)} disabled={!editable}>
              <option value="">—</option>
              {(paymentTerms ?? []).map((t) => <option key={t.id} value={t.id}>{masterLabel(t.code, t.name)}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Currency <span className="text-gray-400">(from customer)</span></label>
            <select className="erp-input w-full" value={currencyId} onChange={(e) => setCurrencyId(e.target.value)} disabled={!editable}>
              <option value="">—</option>
              {(currencies ?? [])
                .filter((c) => allowedCurrencyIds.length === 0 || allowedCurrencyIds.includes(c.id))
                .map((c) => <option key={c.id} value={c.id}>{masterLabel(c.code, c.name)}</option>)}
            </select>
          </div>
          {existing?.quotationId && <div className="flex items-end text-xs text-gray-500">From quotation</div>}
          <div className="col-span-4"><label className="block text-xs text-gray-600 mb-1">Notes</label><input className="erp-input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} /></div>
        </div>

        {!headerSaved ? (
          <div className="bg-white border border-dashed border-gray-300 rounded p-6 text-center">
            <div className="text-sm text-gray-600">Save the header to continue</div>
            <div className="mt-1 text-xs text-gray-500">
              The document number is generated when the header is saved. Item details open up after that,
              and the customer is then locked for the life of the order.
            </div>
            {/* An order can also be pulled straight from an accepted quotation */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-end justify-center gap-2">
              <div className="text-left">
                <label className="block text-[10px] text-gray-500">…or create from an accepted quotation</label>
                <select className="erp-input w-72" value={sourceQuotationId} onChange={(e) => setSourceQuotationId(e.target.value)}>
                  <option value="">Select quotation…</option>
                  {(quotationsResp?.data ?? []).map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.docNo}{q.rev ? ` rev ${q.rev}` : ''} — {q.customerName ?? ''} ({Number(q.totalAmount).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={convertQuotation} disabled={converting || !sourceQuotationId} className="toolbar-btn disabled:opacity-50">
                {converting ? <Loader2 size={13} className="animate-spin" /> : <FileInput size={13} />}<span>Convert</span>
              </button>
            </div>
            {(quotationsResp?.data ?? []).length === 0 && (
              <p className="mt-2 text-[11px] text-gray-400">
                No accepted quotations — a quotation must be accepted before it can become an order.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded">
            <div className="flex items-center px-3 py-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">Item details ({rows.length})</span>
              <div className="flex-1" />
              {editable && <button onClick={() => setRows((r) => [...r, emptyLine()])} className="toolbar-btn"><Plus size={13} /><span>Add line</span></button>}
            </div>
            {rows.length === 0 ? <div className="p-4 text-xs text-gray-400">No lines.</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-2 py-1">Item</th><th className="px-2 py-1 w-16">UOM</th><th className="px-2 py-1 w-16">Qty</th>
                    <th className="px-2 py-1 w-24 text-right" title="Free stock in the selected warehouse">WH Stock</th>
                    <th className="px-2 py-1 w-24 text-right" title="Free stock across every warehouse in the company">Group Stock</th>
                    <th className="px-2 py-1 w-32">Reservation</th>
                    <th className="px-2 py-1 w-24">Reserve Until</th>
                    <th className="px-2 py-1 w-24">Unit Price</th><th className="px-2 py-1 w-16">Disc %</th><th className="px-2 py-1 w-24 text-right">Net</th>
                    <th className="w-8" />
                  </tr></thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const net = row.orderedQty * row.unitPrice * (1 - row.discountPct / 100);
                      const below = row.minPrice != null && row.unitPrice < row.minPrice;
                      const st = stockFor(row);
                      const live = row.lineId ? atpByLine[row.lineId] : undefined;
                      const whFree = live?.atp ?? st?.warehouseAvailable;
                      const groupFree = live?.group ?? st?.groupAvailable;
                      const short = whFree != null && row.orderedQty > whFree;
                      return (
                        <tr key={i} className="border-b border-gray-50 align-top">
                          <td className="px-2 py-1">
                            <select className="erp-input w-52" value={row.itemId} onChange={(e) => { const it = itemOptions.find((o) => o.id === e.target.value); upd(i, { itemId: e.target.value, itemLabel: it ? `${it.code} — ${it.description}` : '' }); if (row.uomId) prefill(i, e.target.value, row.uomId); }} disabled={!editable}>
                              <option value="">Select…</option>{itemOptions.map((o) => <option key={o.id} value={o.id}>{masterLabel(o.code, o.description)}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1"><select className="erp-input w-14" value={row.uomId} onChange={(e) => { upd(i, { uomId: e.target.value }); if (row.itemId) prefill(i, row.itemId, e.target.value); }} disabled={!editable}><option value="">—</option>{uomOptions.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</select></td>
                          <td className="px-2 py-1"><input type="number" className="erp-input w-14" value={row.orderedQty} onChange={(e) => upd(i, { orderedQty: Number(e.target.value) })} disabled={!editable} /></td>
                          <td className={`px-2 py-1 text-right tabular-nums ${short ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{whFree != null ? whFree.toLocaleString() : '—'}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-gray-600">{groupFree != null ? groupFree.toLocaleString() : '—'}</td>
                          <td className="px-2 py-1">
                            {!row.reservationAllowed ? (
                              <span className="text-[11px] text-gray-400" title="Set “reservation allowed” on the item master to reserve stock for this item">
                                not allowed
                              </span>
                            ) : (
                            <div className="flex items-center gap-1">
                              <input
                                type="number" className="erp-input w-16" value={row.reservedQty}
                                onChange={(e) => upd(i, { reservedQty: Number(e.target.value) })}
                                disabled={!row.lineId}
                                title={row.lineId ? 'Quantity to block in the warehouse' : 'Save the line first'}
                              />
                              <button
                                onClick={() => setReserveFor(reserveFor === i ? null : i)}
                                className="text-[10px] px-1.5 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
                                disabled={!row.lineId}
                              >
                                {row.reserveWarehouseId && row.reserveWarehouseId !== warehouseId ? 'Other WH' : 'WH'}
                              </button>
                            </div>
                            )}
                            {reserveFor === i && (
                              <div className="mt-1 p-2 border border-gray-200 rounded bg-gray-50 space-y-1">
                                <label className="block text-[10px] text-gray-500">Reserve from warehouse</label>
                                <select className="erp-input w-full" value={row.reserveWarehouseId} onChange={(e) => upd(i, { reserveWarehouseId: e.target.value })}>
                                  <option value="">{warehouseId ? 'Order warehouse' : 'Select…'}</option>
                                  {(st?.byWarehouse ?? whOptions.map((w) => ({ warehouseId: w.id, warehouseCode: w.code, available: null as number | null }))).map((w: any) => (
                                    <option key={w.warehouseId} value={w.warehouseId}>
                                      {w.warehouseCode}{w.available != null ? ` (${w.available} free)` : ''}
                                    </option>
                                  ))}
                                </select>
                                <button onClick={() => applyReservation(i)} className="toolbar-btn w-full justify-center">Apply reservation</button>
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="date" className="erp-input w-28" value={row.reserveUntil}
                              onChange={(e) => upd(i, { reserveUntil: e.target.value })}
                              disabled={!row.lineId || !row.reservationAllowed}
                              title="Reservation is released after this date"
                            />
                          </td>
                          {/* The rate is owned by the price list and cannot be typed over */}
                          <td className="px-2 py-1">
                            <div
                              className={`erp-input w-20 flex items-center justify-end tabular-nums bg-gray-50 text-gray-700 ${below ? 'border-amber-400 bg-amber-50' : ''}`}
                              title={row.unitPrice === 0 ? 'This item has no price in the price list' : 'Spooled from the price list'}
                            >
                              {row.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td className="px-2 py-1"><input type="number" className="erp-input w-14" value={row.discountPct} onChange={(e) => upd(i, { discountPct: Number(e.target.value) })} disabled={!editable} /></td>
                          <td className="px-2 py-1 text-right tabular-nums">{net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-2 py-1">{editable && <button onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-4 py-1 text-[11px] text-gray-500 border-t border-gray-100">
              Unit price is read-only: it comes from the customer&apos;s price list, and an item with no price
              stays at 0. Reservations are offered only for items flagged &ldquo;reservation allowed&rdquo; in the
              item master; they block stock immediately and are released after the reserve-until date.
            </div>
            <div className="flex justify-end gap-6 px-4 py-2 border-t border-gray-200 text-sm">
              <div className="text-gray-500">Sub-total: <span className="text-gray-800 font-medium tabular-nums">{totals.sub.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              <div className="text-gray-500">Discount: <span className="text-gray-800 font-medium tabular-nums">{totals.disc.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              <div className="text-gray-500">Net: <span className="text-[#1F4E79] font-semibold tabular-nums">{totals.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
