import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { FormField, Input } from '../../../components/ui/FormField';
import { useToast } from '../../../components/ui/Toast';
import { useWarehouse, useCreateWarehouse, useUpdateWarehouse } from '../../../api/inventory';

const schema = z.object({
  code:     z.string().min(1, 'Code is required'),
  name:     z.string().min(1, 'Name is required'),
  address:  z.string().optional(),
  isActive: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

export default function WarehouseFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew   = !id || id === 'new';
  const navigate = useNavigate();
  const toast    = useToast();
  const [saving, setSaving] = useState(false);

  const { data: whData } = useWarehouse(isNew ? undefined : id);
  const wh = (whData as any)?.data ?? whData;

  const create = useCreateWarehouse();
  const update = useUpdateWarehouse(id ?? '');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { isActive: true },
  });

  useEffect(() => {
    if (wh) reset({ code: wh.code, name: wh.name, address: wh.address ?? '', isActive: wh.isActive ?? true });
  }, [wh, reset]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      if (isNew) {
        const res = await create.mutateAsync(values);
        toast.success('Warehouse created');
        navigate(`/inventory/warehouses/${(res as any)?.data?.id ?? (res as any)?.id}`, { replace: true });
      } else {
        await update.mutateAsync(values);
        toast.success('Warehouse saved');
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
        title="Warehouse"
        docNo={wh?.code}
        onNew={() => navigate('/inventory/warehouses/new')}
        onSave={handleSubmit(onSubmit)}
        saving={saving}
        actions={[{ id: 'back', label: '← List', onClick: () => navigate('/inventory/warehouses'), variant: 'secondary' }]}
      />
      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <FormField label="Code" required error={errors.code?.message}>
            <Input {...register('code')} placeholder="WH-001" />
          </FormField>
          <FormField label="Name" required error={errors.name?.message}>
            <Input {...register('name')} placeholder="Main Warehouse" />
          </FormField>
          <FormField label="Address" className="col-span-2">
            <Input {...register('address')} placeholder="Physical address" />
          </FormField>
          <FormField label="Active">
            <label className="flex items-center gap-2 mt-1">
              <input type="checkbox" {...register('isActive')} className="rounded border-gray-300 text-[#1F4E79]" />
              <span className="text-sm text-gray-600">Warehouse is active</span>
            </label>
          </FormField>
        </form>
      </div>
    </div>
  );
}
