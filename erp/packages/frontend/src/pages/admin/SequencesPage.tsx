import React, { useState, useMemo, useRef } from 'react';
import { Hash, Loader2, Save, RefreshCw } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellEditorParams, GridApi } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useSequences, useUpdateSequence } from '../../api/admin';
import type { SequenceConfig } from '../../api/admin';
import { useToast } from '../../components/ui/Toast';

export default function SequencesPage() {
  const toast = useToast();
  const gridRef = useRef<AgGridReact<SequenceConfig>>(null);
  const [pending, setPending] = useState<Record<string, Partial<SequenceConfig>>>({});

  const { data: sequences = [], isFetching, refetch } = useSequences();
  const updateSeq = useUpdateSequence();

  const dirty = Object.keys(pending).length > 0;

  const handleCellChange = (id: string, field: keyof SequenceConfig, value: any) => {
    setPending((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(pending);
    try {
      await Promise.all(entries.map(([id, changes]) => updateSeq.mutateAsync({ id, ...changes })));
      toast.success('Saved', `${entries.length} sequence(s) updated.`);
      setPending({});
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message ?? 'Failed to save');
    }
  };

  // Merge pending edits with server data for display
  const rows = useMemo<SequenceConfig[]>(() =>
    sequences.map((s) => ({ ...s, ...pending[s.id] })),
    [sequences, pending]
  );

  const colDefs = useMemo<ColDef<SequenceConfig>[]>(() => [
    {
      headerName: 'Document Type', field: 'docType', flex: 2, minWidth: 160,
      cellRenderer: (p: any) => (
        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{p.value}</span>
      ),
    },
    {
      headerName: 'Prefix', field: 'prefix', width: 120, editable: true,
      cellStyle: { fontFamily: 'monospace', fontSize: '12px' },
      onCellValueChanged: (p) => handleCellChange(p.data.id, 'prefix', p.newValue),
    },
    {
      headerName: 'Next Number', field: 'nextNumber', width: 130, editable: true, type: 'numericColumn',
      cellStyle: { fontFamily: 'monospace', fontSize: '12px' },
      onCellValueChanged: (p) => handleCellChange(p.data.id, 'nextNumber', Number(p.newValue)),
    },
    {
      headerName: 'Pad Length', field: 'padLength', width: 110, editable: true, type: 'numericColumn',
      cellStyle: { fontFamily: 'monospace', fontSize: '12px' },
      onCellValueChanged: (p) => handleCellChange(p.data.id, 'padLength', Number(p.newValue)),
    },
    {
      headerName: 'Preview', flex: 2, minWidth: 160,
      valueGetter: (p) => {
        const s = p.data;
        if (!s) return '';
        const pad = (s.padLength ?? 4);
        return `${s.prefix}${String(s.nextNumber ?? 1).padStart(pad, '0')}`;
      },
      cellStyle: { fontFamily: 'monospace', fontSize: '12px', color: '#1F4E79', fontWeight: 600 },
    },
    {
      headerName: '', width: 40, pinned: 'right',
      cellRenderer: (p: any) => pending[p.data?.id]
        ? <span className="text-amber-500 text-[10px] font-semibold">●</span>
        : null,
    },
  ], [pending]);

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F4E79] flex items-center gap-2"><Hash size={22} /> Document Sequences</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure document numbering for each document type. Click a cell to edit.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { refetch(); setPending({}); }} disabled={isFetching} className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            {isFetching ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>
          <button
            onClick={handleSaveAll}
            disabled={!dirty || updateSeq.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1F4E79] text-white text-sm rounded-lg hover:bg-[#163a5c] disabled:opacity-40"
          >
            {updateSeq.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save {dirty ? `(${Object.keys(pending).length})` : ''}
          </button>
        </div>
      </div>

      {dirty && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg">
          You have unsaved changes. Click Save to apply, or Refresh to discard.
        </div>
      )}

      <div className="flex-1 min-h-0 ag-theme-alpine rounded-xl overflow-hidden border border-gray-200">
        {isFetching && sequences.length === 0 ? (
          <div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : (
          <AgGridReact<SequenceConfig>
            ref={gridRef}
            rowData={rows}
            columnDefs={colDefs}
            rowHeight={40}
            suppressCellFocus={false}
            animateRows={false}
            singleClickEdit
            stopEditingWhenCellsLoseFocus
            defaultColDef={{ sortable: true, resizable: true, suppressMenu: true }}
          />
        )}
      </div>
    </div>
  );
}
