import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Truck, CheckCircle, Loader2 } from 'lucide-react';
import {
  useDelivery, useCreateDelivery, deliveryApi, useOrders,
  type UpsertDeliveryInput, type OpenOrderLine,
} from '../../../api/salesDocs';

interface LineRow {
  salesOrderLineId: string; itemId: string; uomId: string; itemLabel: string; outstanding: number; deliveredQty: number;
}

export default function DeliveryFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading, refetch } = useDelivery(id);
  const createMut = useCreateDelivery();
  const { data: orders } = useOrders({});

  const [orderId, setOrderId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [vehicleNo, setVehicleNo] = useState('');
  const [driver, setDriver] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<LineRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const status = existing?.status ?? 'DRAFT';
  const deliverableOrders = (orders?.data ?? []).filter((o) => ['APPROVED', 'IN_PROGRESS'].includes(o.status));

  useEffect(() => {
    if (!existing) return;
    setCustomerId(existing.customerId);
    setWarehouseId(existing.warehouseId ?? '');
    setDeliveryDate(existing.deliveryDate ? existing.deliveryDate.slice(0, 10) : '');
    setVehicleNo(existing.vehicleNo ?? '');
    setDriver(existing.driver ?? '');
    setNotes(existing.notes ?? '');
    setRows((existing.lines ?? []).map((l: any) => ({
      salesOrderLineId: l.salesOrderLineId ?? '', itemId: l.itemId, uomId: l.uomId,
      itemLabel: l.item ? `${l.item.code} — ${l.item.description}` : l.itemId,
      outstanding: Number(l.deliveredQty), deliveredQty: Number(l.deliveredQty),
    })));
  }, [existing]);

  const loadOrder = async (oid: string) => {
    setOrderId(oid); setError(null);
    if (!oid) { setRows([]); return; }
    try {
      const res = await deliveryApi.openLines(oid);
      setCustomerId(res.customerId);
      setWarehouseId(res.warehouseId ?? '');
      setRows(res.lines.map((l: OpenOrderLine) => ({
        salesOrderLineId: l.salesOrderLineId, itemId: l.itemId, uomId: l.uomId,
        itemLabel: l.itemCode ? `${l.itemCode} — ${l.itemDescription ?? ''}` : l.itemId,
        outstanding: l.outstanding, deliveredQty: l.outstanding,
      })));
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to load order lines'); }
  };

  const upd = (i: number, deliveredQty: number) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, deliveredQty } : row)));

  const save = async () => {
    setError(null);
    if (!warehouseId) { setError('No warehouse — pick an approved order with a warehouse'); return; }
    const lines = rows.filter((r) => r.deliveredQty > 0);
    if (!lines.length) { setError('Enter at least one delivery quantity'); return; }
    const payload: UpsertDeliveryInput = {
      customerId, salesOrderId: orderId || existing?.salesOrderId || null, deliveryDate, warehouseId,
      vehicleNo: vehicleNo || null, driver: driver || null, notes: notes || null,
      lines: lines.map((r) => ({ salesOrderLineId: r.salesOrderLineId || null, itemId: r.itemId, uomId: r.uomId, deliveredQty: Number(r.deliveredQty) })),
    };
    try {
      const dn = await createMut.mutateAsync(payload);
      navigate(`/sales/deliveries/${dn.id}`);
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Save failed'); }
  };

  const runAction = async (fn: () => Promise<any>) => {
    setError(null); setBanner(null);
    try { const r = await fn(); setBanner(`Status: ${r.status}`); refetch(); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Action failed'); }
  };

  if (isEdit && isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#1F4E79]" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
        <button onClick={() => navigate('/sales/deliveries')} className="toolbar-btn"><ArrowLeft size={13} /></button>
        <h2 className="text-sm font-semibold text-gray-800">{isEdit ? `Delivery ${existing?.docNo ?? ''} · ${status}` : 'New Delivery'}</h2>
        <div className="flex-1" />
        {isEdit && status === 'DRAFT' && <button onClick={() => runAction(() => deliveryApi.post(id!))} className="toolbar-btn"><Truck size={13} /><span>Dispatch</span></button>}
        {isEdit && status === 'DISPATCHED' && <button onClick={() => runAction(() => deliveryApi.acknowledge(id!))} className="toolbar-btn"><CheckCircle size={13} /><span>Mark Delivered</span></button>}
        {!isEdit && <button onClick={save} disabled={createMut.isPending} className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F] disabled:opacity-50">{createMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}<span>Save Draft</span></button>}
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}
      {banner && <div className="mx-4 mt-3 px-3 py-2 text-xs bg-blue-50 text-[#1F4E79] border border-blue-200 rounded">{banner}</div>}

      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">
        <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-4 gap-4">
          {!isEdit && (
            <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Sales Order *</label>
              <select className="erp-input w-full" value={orderId} onChange={(e) => loadOrder(e.target.value)}>
                <option value="">Select approved order…</option>
                {deliverableOrders.map((o) => <option key={o.id} value={o.id}>{o.docNo} — {o.customerName}</option>)}
              </select>
            </div>
          )}
          <div><label className="block text-xs text-gray-600 mb-1">Delivery Date</label><input type="date" className="erp-input w-full" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} disabled={isEdit} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Vehicle No</label><input className="erp-input w-full" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} disabled={isEdit} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Driver</label><input className="erp-input w-full" value={driver} onChange={(e) => setDriver(e.target.value)} disabled={isEdit} /></div>
          <div className="col-span-3"><label className="block text-xs text-gray-600 mb-1">Notes</label><input className="erp-input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isEdit} /></div>
        </div>

        <div className="bg-white border border-gray-200 rounded">
          <div className="px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-700">Lines ({rows.length})</div>
          {rows.length === 0 ? <div className="p-4 text-xs text-gray-400">{isEdit ? 'No lines.' : 'Select a sales order to load deliverable lines.'}</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-1">Item</th><th className="px-2 py-1 w-32 text-right">Outstanding</th><th className="px-2 py-1 w-32">Deliver Qty</th>
              </tr></thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-2 py-1">{row.itemLabel}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-gray-500">{isEdit ? '—' : row.outstanding}</td>
                    <td className="px-2 py-1">
                      <input type="number" className="erp-input w-28" value={row.deliveredQty} max={isEdit ? undefined : row.outstanding} disabled={isEdit}
                        onChange={(e) => upd(i, Math.min(Number(e.target.value), isEdit ? Infinity : row.outstanding))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
