import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { FormField, Input } from '../../../components/ui/FormField';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { useToast } from '../../../components/ui/Toast';
import { useBin, useCreateBin, useUpdateBin, searchWarehouses } from '../../../api/inventory';

const schema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  code:        z.string().min(1, 'Bin code is required'),
  name:        z.string().optional(),
  zone:        z.string().optional(),
  aisle:       z.string().optional(),
  rack:        z.string().optional(),
  level:       z.string().optional(),
  maxWeight:   z.coerce.number().min(0).optional(),
  isActive:    z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

export default function BinFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew   = !id || id === 'new';
  const navigate = useNavigate();
  const toast    = useToast();
  const [saving, setSaving]         = useState(false);
  const [warehouse, setWarehouse]   = useState<LookupOption | null>(null);

  const { data: binData } = useBin(isNew ? undefined : id);
  const bin = (binData as any)?.data ?? binData;

  const create = useCreateBin();
  const update = useUpdateBin(id ?? '');

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { isActive: true },
  });

  useEffect(() => {
    if (bin) {
      reset({ warehouseId: bin.warehouseId, code: bin.code, name: bin.name ?? '', zone: bin.zone ?? '', aisle: bin.aisle ?? '', rack: bin.rack ?? '', level: bin.level ?? '', maxWeight: bin.maxWeight ?? undefined, isActive: bin.isActive ?? true });
      if (bin.warehouse) setWarehouse({ value: bin.warehouse.id, label: `${bin.warehouse.code} – ${bin.warehouse.name}` });
    }
  }, [bin, reset]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      if (isNew) {
        const res = await create.mutateAsync(values);
        toast.success('Bin created');
        navigate(`/inventory/bins/${(res as any)?.data?.id ?? (res as any)?.id}`, { replace: true });
      } else {
        await update.mutateAsync(values);
        toast.success('Bin saved');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="Bin"
        docNo={bin?.code}
        onNew={() => navigate('/inventory/bins/new')}
        onSave={handleSubmit(onSubmit)}
        saving={saving}
        actions={[{ id: 'back', label: '← List', onClick: () => navigate('/inventory/bins'), variant: 'secondary' }]}
      />
      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <FormField label="Warehouse" required error={errors.warehouseId?.message} className="col-span-2">
            <LookupField value={warehouse} onChange={(opt) => { setWarehouse(opt); setValue('warehouseId', opt?.value ?? '', { shouldValidate: true }); }} onSearch={searchWarehouses} placeholder="Search warehouse…" />
          </FormField>
          <FormField label="Bin Code" required error={errors.code?.message}>
            <Input {...register('code')} placeholder="A-01-01" />
          </FormField>
          <FormField label="Bin Name">
            <Input {...register('name')} placeholder="Optional name" />
          </FormField>
          <FormField label="Zone">
            <Input {...register('zone')} placeholder="A" />
          </FormField>
          <FormField label="Aisle">
            <Input {...register('aisle')} placeholder="01" />
          </FormField>
          <FormField label="Rack">
            <Input {...register('rack')} placeholder="01" />
          </FormField>
          <FormField label="Level">
            <Input {...register('level')} placeholder="01" />
          </FormField>
          <FormField label="Max Weight (kg)">
            <Input type="number" step="0.01" min={0} {...register('maxWeight')} />
          </FormField>
          <FormField label="Active">
            <label className="flex items-center gap-2 mt-1">
              <input type="checkbox" {...register('isActive')} className="rounded border-gray-300 text-[#1F4E79]" />
              <span className="text-sm text-gray-600">Bin is active</span>
            </label>
          </FormField>
        </form>
      </div>
    </div>
  );
}
