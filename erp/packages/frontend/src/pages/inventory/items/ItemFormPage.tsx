import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';

import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { KeyInfoItemDetailsTabs } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormField';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useToast } from '../../../components/ui/Toast';
import DataGrid, { type ColDef } from '../../../components/ui/DataGrid';
import SupplierXRefTab from '../../../components/inventory/tabs/SupplierXRefTab';
import GradeOptionsTab from '../../../components/inventory/tabs/GradeOptionsTab';
import AttachmentsTab from '../../../components/inventory/tabs/AttachmentsTab';

import {
  useItem, useItemStock, useItemTransactions,
  useItemCategories, useUoms,
  useCreateItem, useUpdateItem,
  useItemSupplierXRefs, useItemAttachments,
} from '../../../api/inventory';

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  code:           z.string().optional(),
  description:    z.string().min(1, 'Description is required'),
  shortDesc:      z.string().optional(),
  categoryId:     z.string().min(1, 'Category is required'),
  uomId:          z.string().min(1, 'UOM is required'),
  status:         z.string().default('ACTIVE'),
  trackingType:   z.string().default('NONE'),
  standardCost:   z.coerce.number().min(0).default(0),
  shelfLife:      z.coerce.number().min(0).optional(),
  shelfLifeUnit:  z.string().default('DAYS'),
  reorderLevel:   z.coerce.number().min(0).default(0),
  reorderQty:     z.coerce.number().min(0).default(0),
  minStock:       z.coerce.number().min(0).default(0),
  maxStock:       z.coerce.number().min(0).default(0),
  notes:          z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const STATUS_OPTS    = [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }, { value: 'OBSOLETE', label: 'Obsolete' }, { value: 'DEAD', label: 'Dead' }];
const TRACKING_OPTS  = [{ value: 'NONE', label: 'None' }, { value: 'SERIAL', label: 'Serial' }, { value: 'BATCH', label: 'Batch' }, { value: 'LOT', label: 'Lot' }];
const SHELF_UNIT_OPTS = [{ value: 'DAYS', label: 'Days' }, { value: 'MONTHS', label: 'Months' }];

// ── Stock Balance tab columns ─────────────────────────────────────────────────
const BALANCE_COLS: ColDef<any>[] = [
  { field: 'warehouse.name', headerName: 'Warehouse', flex: 1, minWidth: 140, valueGetter: (p) => p.data?.warehouse?.name ?? '' },
  { field: 'bin.code', headerName: 'Bin', width: 100, valueGetter: (p) => p.data?.bin?.code ?? '—' },
  { field: 'qtyOnHand', headerName: 'On Hand', width: 110, type: 'numericColumn', valueFormatter: (p) => Number(p.value ?? 0).toFixed(3) },
  { field: 'qtyReserved', headerName: 'Reserved', width: 110, type: 'numericColumn', valueFormatter: (p) => Number(p.value ?? 0).toFixed(3) },
  { field: '_available', headerName: 'Available', width: 110, type: 'numericColumn', valueGetter: (p) => Number(p.data?.qtyOnHand ?? 0) - Number(p.data?.qtyReserved ?? 0), valueFormatter: (p) => Number(p.value ?? 0).toFixed(3) },
  { field: 'avgCost', headerName: 'Avg Cost', width: 110, type: 'numericColumn', valueFormatter: (p) => Number(p.value ?? 0).toFixed(3) },
  { field: '_value', headerName: 'Stock Value', width: 120, type: 'numericColumn', valueGetter: (p) => Number(p.data?.qtyOnHand ?? 0) * Number(p.data?.avgCost ?? 0), valueFormatter: (p) => Number(p.value ?? 0).toFixed(3) },
];

// ── Transactions tab columns ──────────────────────────────────────────────────
const TXN_COLS: ColDef<any>[] = [
  { field: 'createdAt', headerName: 'Date', width: 110, valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd/MM/yyyy') : '' },
  { field: 'transactionType', headerName: 'Type', width: 120 },
  { field: 'sourceDocNo', headerName: 'Doc No', width: 130 },
  { field: 'warehouse.name', headerName: 'Warehouse', flex: 1, minWidth: 120, valueGetter: (p) => p.data?.warehouse?.name ?? '' },
  { field: 'bin.code', headerName: 'Bin', width: 80, valueGetter: (p) => p.data?.bin?.code ?? '' },
  {
    field: '_in', headerName: 'In Qty', width: 100, type: 'numericColumn',
    valueGetter: (p) => (Number(p.data?.qty) > 0 ? Number(p.data?.qty) : ''),
    valueFormatter: (p) => p.value !== '' ? Number(p.value).toFixed(3) : '',
    cellClass: 'text-green-700',
  },
  {
    field: '_out', headerName: 'Out Qty', width: 100, type: 'numericColumn',
    valueGetter: (p) => (Number(p.data?.qty) < 0 ? Math.abs(Number(p.data?.qty)) : ''),
    valueFormatter: (p) => p.value !== '' ? Number(p.value).toFixed(3) : '',
    cellClass: 'text-red-600',
  },
  { field: 'balanceAfter', headerName: 'Balance', width: 100, type: 'numericColumn', valueFormatter: (p) => Number(p.value ?? 0).toFixed(3) },
  { field: 'avgCost', headerName: 'Avg Cost', width: 100, type: 'numericColumn', valueFormatter: (p) => Number(p.value ?? 0).toFixed(3) },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function ItemFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew  = !id || id === 'new';
  const navigate = useNavigate();
  const toast    = useToast();

  const { data: itemData, isLoading } = useItem(isNew ? undefined : id);
  const item = (itemData as any)?.data ?? itemData;

  const { data: stockData }  = useItemStock(isNew ? undefined : id);
  const { data: txnData }    = useItemTransactions(isNew ? '' : id!, { page: 1, limit: 200 });
  const { data: catsData }   = useItemCategories();
  const { data: uomsData }   = useUoms();
  const { data: suppliersData } = useItemSupplierXRefs(isNew ? undefined : id);
  const { data: attachmentsData } = useItemAttachments(isNew ? undefined : id);

  const createMutation = useCreateItem();
  const updateMutation = useUpdateItem(id ?? '');

  const categories: any[]  = Array.isArray(catsData) ? catsData : (catsData as any)?.data ?? [];
  const uoms: any[]        = Array.isArray(uomsData) ? uomsData : (uomsData as any)?.data ?? [];
  const balances: any[]    = (stockData as any)?.balances ?? [];
  const txns: any[]        = (txnData as any)?.data ?? [];
  const supplierXRefs: any[] = Array.isArray(suppliersData) ? suppliersData : (suppliersData as any)?.data ?? [];
  const attachments: any[] = Array.isArray(attachmentsData) ? attachmentsData : (attachmentsData as any)?.data ?? [];

  const {
    register, control, handleSubmit, reset, watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      reset({
        code:          item.code ?? '',
        description:   item.description ?? '',
        shortDesc:     item.shortDesc ?? '',
        categoryId:    item.categoryId ?? '',
        uomId:         item.uomId ?? '',
        status:        item.status ?? 'ACTIVE',
        trackingType:  item.trackingType ?? 'NONE',
        standardCost:  Number(item.standardCost ?? 0),
        shelfLife:     item.shelfLife ?? undefined,
        shelfLifeUnit: item.shelfLifeUnit ?? 'DAYS',
        reorderLevel:  Number(item.reorderLevel ?? 0),
        reorderQty:    Number(item.reorderQty ?? 0),
        minStock:      Number(item.minStock ?? 0),
        maxStock:      Number(item.maxStock ?? 0),
        notes:         item.notes ?? '',
      });
    }
  }, [item, reset]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      if (isNew) {
        const result = await createMutation.mutateAsync(values);
        toast.success('Item created');
        const newId = (result as any)?.data?.id ?? (result as any)?.id;
        if (newId) navigate(`/inventory/items/${newId}`, { replace: true });
      } else {
        await updateMutation.mutateAsync(values);
        toast.success('Item saved');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Key Info panel ──────────────────────────────────────────────────────────
  const keyInfoPanel = (
    <form id="item-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-4 gap-x-4 gap-y-3">
      <FormField label="Item Code" hint="Auto-generated on save">
        <Input {...register('code')} readOnly={!isNew} placeholder="AUTO" className="bg-gray-50" />
      </FormField>

      <FormField label="Description" required error={errors.description?.message} className="col-span-2">
        <Input {...register('description')} placeholder="Full item description" />
      </FormField>

      <FormField label="Short Description">
        <Input {...register('shortDesc')} placeholder="Short description" />
      </FormField>

      <FormField label="Item Category" required error={errors.categoryId?.message}>
        <Controller
          name="categoryId"
          control={control}
          render={({ field }) => (
            <select {...field} className={`erp-input ${errors.categoryId ? 'border-red-400' : ''}`}>
              <option value="">-- Select Category --</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        />
      </FormField>

      <FormField label="Primary UOM" required error={errors.uomId?.message}>
        <Controller
          name="uomId"
          control={control}
          render={({ field }) => (
            <select {...field} className={`erp-input ${errors.uomId ? 'border-red-400' : ''}`}>
              <option value="">-- Select UOM --</option>
              {uoms.map((u: any) => (
                <option key={u.id} value={u.id}>{u.code} – {u.name}</option>
              ))}
            </select>
          )}
        />
      </FormField>

      <FormField label="Status">
        <Select {...register('status')} options={STATUS_OPTS} />
      </FormField>

      <FormField label="Tracking Type">
        <Select {...register('trackingType')} options={TRACKING_OPTS} />
      </FormField>

      <FormField label="Standard Cost">
        <Input type="number" step="0.001" min={0} {...register('standardCost')} />
      </FormField>

      <FormField label="Shelf Life">
        <div className="flex gap-2">
          <Input type="number" step="1" min={0} {...register('shelfLife')} className="flex-1" placeholder="0" />
          <Select {...register('shelfLifeUnit')} options={SHELF_UNIT_OPTS} className="w-28" />
        </div>
      </FormField>

      <FormField label="Reorder Level">
        <Input type="number" step="0.001" min={0} {...register('reorderLevel')} />
      </FormField>

      <FormField label="Reorder Qty">
        <Input type="number" step="0.001" min={0} {...register('reorderQty')} />
      </FormField>

      <FormField label="Min Stock">
        <Input type="number" step="0.001" min={0} {...register('minStock')} />
      </FormField>

      <FormField label="Max Stock">
        <Input type="number" step="0.001" min={0} {...register('maxStock')} />
      </FormField>

      <FormField label="Notes" className="col-span-4">
        <Textarea {...register('notes')} rows={2} placeholder="Internal notes…" />
      </FormField>
    </form>
  );

  // ── Stock Balance sub-tab ──────────────────────────────────────────────────
  const totalValue = balances.reduce((s: number, b: any) => s + Number(b.qtyOnHand ?? 0) * Number(b.avgCost ?? 0), 0);

  const stockBalanceContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-3 py-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
        <span>Warehouses: <strong>{new Set(balances.map((b: any) => b.warehouseId)).size}</strong></span>
        <span>Total On Hand: <strong>{balances.reduce((s: number, b: any) => s + Number(b.qtyOnHand), 0).toFixed(3)}</strong></span>
        <span>Total Reserved: <strong>{balances.reduce((s: number, b: any) => s + Number(b.qtyReserved), 0).toFixed(3)}</strong></span>
        <span>Total Value: <strong>{totalValue.toLocaleString(undefined, { minimumFractionDigits: 3 })}</strong></span>
      </div>
      <div className="flex-1">
        <DataGrid rowData={balances} columnDefs={BALANCE_COLS} loading={false} />
      </div>
    </div>
  );

  // ── Stock Movement sub-tab ─────────────────────────────────────────────────
  const stockMovementContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <span className="text-xs text-gray-500">{txns.length} transactions</span>
      </div>
      <div className="flex-1">
        <DataGrid rowData={txns} columnDefs={TXN_COLS} loading={false} />
      </div>
    </div>
  );

  const newItemNotice = (label: string) => (
    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Save the item first to manage {label}.</div>
  );

  const tabs = [
    { id: 'key-info',     label: 'Key Info',          content: keyInfoPanel },
    { id: 'stock-bal',    label: 'Stock Balance',      badge: balances.length,     content: stockBalanceContent },
    { id: 'stock-mov',    label: 'Stock Movement',     badge: txns.length,         content: stockMovementContent },
    {
      id: 'supplier-ref',
      label: 'Supplier X-Ref',
      badge: supplierXRefs.length || undefined,
      content: isNew ? newItemNotice('supplier references') : <SupplierXRefTab itemId={id!} />,
    },
    {
      id: 'grade',
      label: 'Grade Options',
      content: isNew
        ? newItemNotice('grade options')
        : <GradeOptionsTab itemId={id!} grade1Options={item?.grade1Options ?? []} grade2Options={item?.grade2Options ?? []} />,
    },
    {
      id: 'attachments',
      label: 'Attachments',
      badge: attachments.length || undefined,
      content: isNew ? newItemNotice('attachments') : <AttachmentsTab itemId={id!} />,
    },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="Item Master"
        docNo={item?.code}
        status={item ? <StatusBadge status={item.status} /> : undefined}
        onNew={() => navigate('/inventory/items/new')}
        onSave={() => document.getElementById('item-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))}
        saving={saving}
        actions={[
          { id: 'back', label: '← List', onClick: () => navigate('/inventory/items'), variant: 'secondary' },
        ]}
      />
      <div className="flex-1 overflow-auto">
        <KeyInfoItemDetailsTabs tabs={tabs} defaultTabId="key-info" className="min-h-full" />
      </div>
    </div>
  );
}
