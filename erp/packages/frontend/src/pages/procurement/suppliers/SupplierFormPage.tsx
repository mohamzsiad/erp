import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, User } from 'lucide-react';
import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { KeyInfoItemDetailsTabs } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormField';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useToast } from '../../../components/ui/Toast';
import { useUiStore } from '../../../store/uiStore';
import {
  useSupplier,
  useCreateSupplier,
  useUpdateSupplier,
  useToggleSupplierActive,
  searchGlAccounts,
  searchSuppliers,
} from '../../../api/procurement';
import {
  CompanyTab,
  PaymentTermsTab,
  BankDetailsTab,
  NotesTab,
  CurrencyTab,
  ProductSupplyTab,
  BankPaymentTab,
  IncotermTab,
  FinanceGroupTab,
  AddressTab,
  MoreTab,
  ApplicableTab,
  type PaymentTermsData,
  type NotesData,
  type CurrencyData,
  type ProductSupplyRow,
  type BankPaymentData,
  type IncotermData,
  type FinanceGroupData,
  type AddressData,
  type MoreData,
  type ApplicableData,
} from './SupplierTabs';
import type { SupplierContact, SupplierBankDetail } from '@clouderp/shared';

// ── Zod Schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  shortName: z.string().min(1, 'Short name is required'),
  locationId: z.string().min(1, 'Location is required'),
  controlAccountId: z.string().optional(),
  creditDays: z.coerce.number().min(0).default(0),
  creditAmount: z.coerce.number().min(0).default(0),
  shipmentMode: z.enum(['NA', 'AIR', 'SEA', 'LAND']).default('NA'),
  isTdsApplicable: z.boolean().default(false),
  isParentSupplier: z.boolean().default(false),
  parentSupplierId: z.string().optional(),
  regularSupplier: z.boolean().default(false),
  printInSoa: z.boolean().default(false),
  subContractor: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

const SHIPMENT_OPTIONS = [
  { value: 'NA', label: '0 – NA' },
  { value: 'AIR', label: '1 – Air' },
  { value: 'SEA', label: '2 – Sea' },
  { value: 'LAND', label: '3 – Land' },
];

// ── Default tab data ──────────────────────────────────────────────────────────
const defaultPaymentTerms: PaymentTermsData = {
  creditDays: 0,
  creditAmount: 0,
  paymentMethod: '',
  discountDays: 0,
  discountPct: 0,
  dueDateBasis: '',
  remarks: '',
};

const defaultNotes: NotesData = {
  internalNotes: '',
  externalNotes: '',
  termsAndConditions: '',
};

const defaultCurrency: CurrencyData = {
  defaultCurrency: '',
  exchangeRate: 1,
  lockExchangeRate: false,
  currencyNotes: '',
};

const defaultBankPayment: BankPaymentData = {
  preferredBankId: '',
  paymentReferenceFormat: '',
  autoPayment: false,
  paymentApprovalRequired: true,
  maxSinglePayment: 0,
  paymentInstructions: '',
};

const defaultIncoterm: IncotermData = {
  incoterm: '',
  deliveryPort: '',
  freightTerms: '',
  insuranceBy: '',
  customsClearanceBy: '',
  incotermNotes: '',
};

const defaultFinanceGroup: FinanceGroupData = {
  financeGroup: '',
  costCentre: '',
  budgetCategory: '',
  taxGroup: '',
  vatRegistrationNo: '',
  taxExempt: false,
  withholdingTaxGroup: '',
};

const defaultAddress: AddressData = {
  billingStreet: '',
  billingCity: '',
  billingState: '',
  billingCountry: '',
  billingPostalCode: '',
  shippingSameAsBilling: false,
  shippingStreet: '',
  shippingCity: '',
  shippingState: '',
  shippingCountry: '',
  shippingPostalCode: '',
};

const defaultMore: MoreData = {
  website: '',
  taxRegNo: '',
  tradeLicenseNo: '',
  tradeLicenseExpiry: '',
  isoCertification: '',
  isoExpiry: '',
  supplierCategory: '',
  ratingScore: 0,
  blacklisted: false,
  blacklistReason: '',
};

const defaultApplicable: ApplicableData = {
  applicableGoods: false,
  applicableServices: false,
  applicableWorks: false,
  applicableTrade: false,
  applicableConsulting: false,
  applicableLogistics: false,
  approvedFor: [],
  tags: '',
  effectiveFrom: '',
  effectiveTo: '',
};

// ─────────────────────────────────────────────────────────────────────────────
export default function SupplierFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const { setTabDirty } = useUiStore();

  const { data: supplier, isLoading } = useSupplier(isNew ? undefined : id);
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier(id ?? '');
  const toggleActiveMutation = useToggleSupplierActive();

  const [controlAccount, setControlAccount] = useState<LookupOption | null>(null);
  const [parentSupplier, setParentSupplier] = useState<LookupOption | null>(null);

  // ── Tab state ───────────────────────────────────────────────────────────────
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [bankDetails, setBankDetails] = useState<SupplierBankDetail[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermsData>(defaultPaymentTerms);
  const [notes, setNotes] = useState<NotesData>(defaultNotes);
  const [currency, setCurrency] = useState<CurrencyData>(defaultCurrency);
  const [productSupply, setProductSupply] = useState<ProductSupplyRow[]>([]);
  const [bankPayment, setBankPayment] = useState<BankPaymentData>(defaultBankPayment);
  const [incoterm, setIncoterm] = useState<IncotermData>(defaultIncoterm);
  const [financeGroup, setFinanceGroup] = useState<FinanceGroupData>(defaultFinanceGroup);
  const [address, setAddress] = useState<AddressData>(defaultAddress);
  const [more, setMore] = useState<MoreData>(defaultMore);
  const [applicable, setApplicable] = useState<ApplicableData>(defaultApplicable);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      shipmentMode: 'NA',
      creditDays: 0,
      creditAmount: 0,
      isTdsApplicable: false,
      isParentSupplier: false,
      regularSupplier: false,
      printInSoa: false,
      subContractor: false,
    },
  });

  const isParentSupplier = watch('isParentSupplier');
  const isTdsApplicable = watch('isTdsApplicable');

  // Mark tab dirty
  useEffect(() => {
    const tabId = isNew ? 'new-supplier' : `supplier-${id}`;
    setTabDirty(tabId, isDirty);
  }, [isDirty, id, isNew, setTabDirty]);

  // Populate form when loading existing supplier
  useEffect(() => {
    if (supplier) {
      reset({
        name: supplier.name,
        shortName: supplier.shortName,
        locationId: '',
        controlAccountId: supplier.controlAccountId ?? undefined,
        creditDays: supplier.creditDays,
        creditAmount: supplier.creditAmount,
        shipmentMode: supplier.shipmentMode,
        isTdsApplicable: supplier.isTdsApplicable,
        isParentSupplier: supplier.isParentSupplier,
        regularSupplier: false,
        printInSoa: false,
        subContractor: false,
      });

      // Populate tab state from API data
      if (supplier.contacts) setContacts(supplier.contacts);
      if (supplier.bankDetails) setBankDetails(supplier.bankDetails);

      // Sync payment terms from main supplier fields
      setPaymentTerms((prev) => ({
        ...prev,
        creditDays: supplier.creditDays,
        creditAmount: Number(supplier.creditAmount),
      }));
    }
  }, [supplier, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        ...values,
        controlAccountId: controlAccount?.value ?? values.controlAccountId,
        parentSupplierId: !isParentSupplier ? (parentSupplier?.value ?? values.parentSupplierId) : undefined,
        // Include contact and bank data for create
        contacts: contacts.map((c) => ({
          name: c.name,
          designation: c.designation ?? undefined,
          email: c.email ?? undefined,
          phone: c.phone ?? undefined,
          isPrimary: c.isPrimary,
        })),
        bankDetails: bankDetails.map((b) => ({
          bankName: b.bankName,
          accountNo: b.accountNo,
          iban: b.iban ?? undefined,
          swiftCode: b.swiftCode ?? undefined,
        })),
      };

      if (isNew) {
        const created = await createMutation.mutateAsync(payload);
        toast.success('Supplier created', created.code);
        navigate(`/procurement/suppliers/${created.id}`, { replace: true });
      } else {
        await updateMutation.mutateAsync(payload);
        toast.success('Supplier saved');
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Save failed';
      toast.error('Error', msg);
    }
  };

  const handleToggleActive = async () => {
    if (!id) return;
    try {
      await toggleActiveMutation.mutateAsync(id);
      toast.success(`Supplier ${supplier?.isActive ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Loading supplier…</p>
      </div>
    );
  }

  // ── Key Info Panel ─────────────────────────────────────────────────────────
  const keyInfoPanel = (
    <form onSubmit={handleSubmit(onSubmit)} id="supplier-form">
      <div className="flex gap-4">
        {/* Left column: fields */}
        <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-2">
          {/* Supplier Code */}
          <FormField label="Supplier">
            <div className="flex gap-1">
              <Input
                value={supplier?.code ?? '(auto-generated)'}
                readOnly
                className="bg-gray-50 text-gray-500 flex-1"
              />
              {supplier?.code && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(supplier.code)}
                  className="toolbar-btn px-2"
                  title="Copy code"
                >
                  <Copy size={12} />
                </button>
              )}
            </div>
          </FormField>

          {/* Status toggle on right */}
          <div className="flex items-end justify-end gap-2 row-span-1">
            {supplier && (
              <>
                <StatusBadge status={supplier.isActive ? 'ACTIVE' : 'INACTIVE'} />
                <button type="button" onClick={handleToggleActive} className="toolbar-btn text-xs">
                  {supplier.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </>
            )}
          </div>

          {/* Name */}
          <FormField label="Name" required error={errors.name?.message}>
            <Input {...register('name')} error={!!errors.name} />
          </FormField>

          {/* Short Name */}
          <FormField label="Short Name" required error={errors.shortName?.message}>
            <Input {...register('shortName')} error={!!errors.shortName} />
          </FormField>

          {/* Regular Supplier */}
          <FormField label="Regular Supplier">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" {...register('regularSupplier')} className="rounded border-gray-300" />
              <span className="text-xs text-gray-600">Yes</span>
            </label>
          </FormField>

          {/* Control Account */}
          <FormField label="Control Account" required error={errors.controlAccountId?.message}>
            <Controller
              name="controlAccountId"
              control={control}
              render={() => (
                <LookupField
                  value={controlAccount}
                  onChange={(opt) => setControlAccount(opt)}
                  onSearch={searchGlAccounts}
                  placeholder="Search GL accounts…"
                  error={!!errors.controlAccountId}
                />
              )}
            />
          </FormField>

          {/* Print in SOA */}
          <FormField label="Print in SOA / Payables">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" {...register('printInSoa')} className="rounded border-gray-300" />
              <span className="text-xs text-gray-600">Yes</span>
            </label>
          </FormField>

          {/* Credit Limit Days */}
          <FormField label="Credit Limit Days" error={errors.creditDays?.message}>
            <Input type="number" {...register('creditDays')} error={!!errors.creditDays} />
          </FormField>

          {/* Credit Amount */}
          <FormField label="Credit Amount" error={errors.creditAmount?.message}>
            <Input
              type="number"
              step="0.001"
              {...register('creditAmount')}
              error={!!errors.creditAmount}
              className="text-right"
            />
          </FormField>

          {/* Sub Contractor */}
          <FormField label="Sub Contractor">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" {...register('subContractor')} className="rounded border-gray-300" />
              <span className="text-xs text-gray-600">Yes</span>
            </label>
          </FormField>

          {/* Parent Supplier toggle */}
          <FormField label="Parent Supplier">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" {...register('isParentSupplier')} className="rounded border-gray-300" />
              <span className="text-xs text-gray-600">This is a parent supplier</span>
            </label>
          </FormField>

          {/* Parent Supplier lookup — shown when isParentSupplier is false */}
          {!isParentSupplier && (
            <FormField label="Parent Supplier *">
              <LookupField
                value={parentSupplier}
                onChange={setParentSupplier}
                onSearch={searchSuppliers}
                placeholder="Search parent supplier…"
              />
            </FormField>
          )}

          {/* TDS Applicable */}
          <FormField label="TDS Applicable">
            <div className="flex items-center gap-3 mt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" {...register('isTdsApplicable')} className="rounded border-gray-300" />
                <span className="text-xs text-gray-600">Yes</span>
              </label>
              {isTdsApplicable && (
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  TDS Party
                </span>
              )}
            </div>
          </FormField>

          {/* Shipment Mode */}
          <FormField label="Shipment Mode" required error={errors.shipmentMode?.message}>
            <Select
              options={SHIPMENT_OPTIONS}
              {...register('shipmentMode')}
              error={!!errors.shipmentMode}
            />
          </FormField>
        </div>

        {/* Right: profile image placeholder */}
        <div className="w-24 flex flex-col items-center gap-2 pt-2">
          <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
            <User size={28} className="text-gray-300" />
          </div>
          <span className="text-xs text-gray-400">Logo</span>
        </div>
      </div>

      {/* Custom fields accordion */}
      <details className="mt-4 border border-gray-200 rounded-lg">
        <summary className="px-3 py-2 text-xs font-semibold text-gray-600 cursor-pointer bg-gray-50 rounded-lg">
          Custom Fields
        </summary>
        <div className="px-3 py-3 grid grid-cols-2 gap-4">
          <FormField label="LOCATION" required>
            <Input placeholder="Location code" />
          </FormField>
          <FormField label="Item">
            <Input placeholder="Item lookup" />
          </FormField>
        </div>
      </details>
    </form>
  );

  // ── Bank names for Bank Payment tab ────────────────────────────────────────
  const bankNames = bankDetails.filter((b) => b.isActive && b.bankName).map((b) => b.bankName);

  const wrap = (node: React.ReactNode) => <div className="p-4">{node}</div>;

  // ── Sub tabs ───────────────────────────────────────────────────────────────
  const tabs = [
    {
      id: 'company',
      label: 'Company',
      content: wrap(<CompanyTab contacts={contacts} onChange={setContacts} />),
    },
    {
      id: 'payment-terms',
      label: 'Payment Terms',
      content: wrap(<PaymentTermsTab data={paymentTerms} onChange={setPaymentTerms} />),
    },
    {
      id: 'bank-details',
      label: 'Bank Details',
      badge: bankDetails.length > 0 ? bankDetails.length : undefined,
      content: wrap(<BankDetailsTab bankDetails={bankDetails} onChange={setBankDetails} />),
    },
    {
      id: 'notes',
      label: 'Notes',
      content: wrap(<NotesTab data={notes} onChange={setNotes} />),
    },
    {
      id: 'currency',
      label: 'Currency',
      content: wrap(<CurrencyTab data={currency} onChange={setCurrency} />),
    },
    {
      id: 'product-supply',
      label: 'Product Supply',
      badge: productSupply.length > 0 ? productSupply.length : undefined,
      content: wrap(<ProductSupplyTab rows={productSupply} onChange={setProductSupply} />),
    },
    {
      id: 'bank-payment',
      label: 'Bank Payment',
      content: wrap(<BankPaymentTab data={bankPayment} bankNames={bankNames} onChange={setBankPayment} />),
    },
    {
      id: 'incoterm',
      label: 'Incoterm',
      content: wrap(<IncotermTab data={incoterm} onChange={setIncoterm} />),
    },
    {
      id: 'finance-group',
      label: 'Finance Group',
      content: wrap(<FinanceGroupTab data={financeGroup} onChange={setFinanceGroup} />),
    },
    {
      id: 'address',
      label: 'Address',
      content: wrap(<AddressTab data={address} onChange={setAddress} />),
    },
    {
      id: '-more',
      label: '*** More',
      content: wrap(<MoreTab data={more} onChange={setMore} />),
    },
    {
      id: 'applicable',
      label: 'Applicable',
      content: wrap(<ApplicableTab data={applicable} onChange={setApplicable} />),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar
        title="Supplier Master"
        docNo={supplier?.code}
        status={supplier ? <StatusBadge status={supplier.isActive ? 'ACTIVE' : 'INACTIVE'} /> : undefined}
        onNew={() => navigate('/procurement/suppliers/new')}
        onSave={handleSubmit(onSubmit)}
        onReset={() => reset()}
        onDelete={undefined}
        onPrint={() => window.print()}
        saving={saving}
      />

      <div className="flex-1 overflow-auto">
        <KeyInfoItemDetailsTabs
          keyInfo={keyInfoPanel}
          tabs={tabs}
          defaultTabId="company"
          className="min-h-full"
        />
      </div>
    </div>
  );
}
