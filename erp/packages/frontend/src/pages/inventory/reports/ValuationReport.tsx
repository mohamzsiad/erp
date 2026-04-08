import React, { useState } from 'react';
import { InventoryReportPage } from '../../../components/reports/InventoryReportPage';
import { textCol, numCol, statusCol } from '../../../components/reports/ReportPage';
import {
  useValuationReport,
  invReportApi,
  type InvReportFilters,
  type ValuationRow,
} from '../../../api/inventoryReports';
import { useToast } from '../../../components/ui/Toast';
import type { ColDef } from '../../../components/ui/DataGrid';

const COLUMNS: ColDef<ValuationRow>[] = [
  textCol('category',      'Category',     120),
  textCol('itemCode',      'Item Code',    110),
  { ...textCol<ValuationRow>('description', 'Description', undefined, 1), minWidth: 160 },
  textCol('uom',           'UOM',           60),
  textCol('warehouseCode', 'Warehouse',     100),
  textCol('warehouseName', 'Warehouse Name', 140),
  numCol('qtyOnHand',      'On Hand',       100),
  numCol('avgCost',        'Avg Cost',      110),
  numCol('stockValue',     'Stock Value',   130),
  statusCol('status',      'Status',         90),
];

// Category breakdown shown below the grid
interface CategorySummaryProps {
  byCategory: Record<string, { qty: number; value: number }>;
  grandTotal:  number;
}

function CategorySummary({ byCategory, grandTotal }: CategorySummaryProps) {
  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="font-semibold text-gray-700">By Category:</span>
        {Object.entries(byCategory).map(([cat, { qty, value }]) => (
          <span key={cat} className="text-gray-600">
            <span className="font-medium text-gray-800">{cat}</span>
            {' — '}
            Qty: {qty.toLocaleString(undefined, { minimumFractionDigits: 3 })}
            {' | '}
            Value: {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ))}
        <span className="ml-auto font-bold text-[#1F4E79]">
          Grand Total: {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

export default function ValuationReport() {
  const toast = useToast();
  const [filters,  setFilters]  = useState<InvReportFilters>({});
  const [enabled,  setEnabled]  = useState(false);
  const [snapshot, setSnapshot] = useState<InvReportFilters>({});

  const { data, isLoading } = useValuationReport(snapshot, enabled);

  const rows       = data?.rows       ?? undefined;
  const byCategory = data?.byCategory ?? {};
  const grandTotal = data?.grandTotal ?? 0;

  const handleGenerate = () => {
    setSnapshot(filters);
    setEnabled(true);
  };

  const handleExport = async () => {
    try {
      await invReportApi.downloadXlsx('valuation', snapshot);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <InventoryReportPage<ValuationRow>
        title="Stock Valuation Report"
        endpoint="valuation"
        filterConfig={{ asOfDate: true, warehouse: true }}
        columns={COLUMNS}
        numericSummaryKeys={['qtyOnHand', 'stockValue']}
        data={rows}
        isLoading={isLoading}
        filters={filters}
        onFiltersChange={setFilters}
        onGenerate={handleGenerate}
        onExport={handleExport}
        getRowId={(r) => `${r.category}-${r.itemCode}-${r.warehouseCode}`}
      />
      {data && (
        <CategorySummary byCategory={byCategory} grandTotal={grandTotal} />
      )}
    </div>
  );
}
