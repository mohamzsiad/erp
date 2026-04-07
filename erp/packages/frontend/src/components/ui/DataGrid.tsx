// @ts-ignore — ag-grid CSS imports; types resolved at build time by Vite
import 'ag-grid-community/styles/ag-grid.css';
// @ts-ignore
import 'ag-grid-community/styles/ag-theme-alpine.css';

import React, { useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridOptions, GridReadyEvent } from 'ag-grid-community';

export type { ColDef };

interface DataGridProps<TData> {
  rowData: TData[];
  columnDefs: ColDef<TData>[];
  height?: number | string;
  pagination?: boolean;
  pageSize?: number;
  loading?: boolean;
  onRowClicked?: (row: TData) => void;
  onRowDoubleClicked?: (row: TData) => void;
  getRowId?: (row: TData) => string;
  className?: string;
  gridOptions?: Partial<GridOptions<TData>>;
  onGridReady?: (event: GridReadyEvent<TData>) => void;
}

function DataGrid<TData>({
  rowData,
  columnDefs,
  height = 400,
  pagination = true,
  pageSize = 20,
  loading,
  onRowClicked,
  onRowDoubleClicked,
  getRowId,
  className,
  gridOptions,
  onGridReady,
}: DataGridProps<TData>) {
  const gridRef = useRef<AgGridReact<TData>>(null);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 80,
      flex: 1,
    }),
    []
  );

  const handleGridReady = (event: GridReadyEvent<TData>) => {
    if (loading) {
      event.api.showLoadingOverlay();
    }
    onGridReady?.(event);
  };

  // Show/hide overlay reactively
  React.useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    if (loading) {
      api.showLoadingOverlay();
    } else {
      api.hideOverlay();
    }
  }, [loading]);

  return (
    <div
      className={`ag-theme-alpine ${className ?? ''}`}
      style={{ height: typeof height === 'number' ? `${height}px` : height, width: '100%' }}
    >
      <AgGridReact<TData>
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        pagination={pagination}
        paginationPageSize={pageSize}
        getRowId={getRowId ? (params) => getRowId(params.data) : undefined}
        onRowClicked={onRowClicked ? (e) => e.data && onRowClicked(e.data) : undefined}
        onRowDoubleClicked={onRowDoubleClicked ? (e) => e.data && onRowDoubleClicked(e.data) : undefined}
        onGridReady={handleGridReady}
        rowSelection="single"
        suppressCellFocus={false}
        animateRows
        {...gridOptions}
      />
    </div>
  );
}

export default DataGrid;
