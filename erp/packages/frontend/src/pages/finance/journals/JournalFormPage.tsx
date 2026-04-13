import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellValueChangedEvent, GridReadyEvent } from 'ag-grid-community';
import { clsx } from 'clsx';
import {
  useJournalDetail, useCreateJournal, useReverseJournal,
  searchGlAccounts, searchCostCenters,
} from '../../../api/finance';
import { DocumentToolbar } from '../../../components/ui/DocumentToolbar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { KeyInfoItemDetailsTabs, KeyInfoGrid } from '../../../components/ui/KeyInfoItemDetailsTabs';
import { LookupField, type LookupOption } from '../../../components/ui/LookupField';
import { useToast } from '../../../components/ui/Toast';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// ── Line type ─────────────────────────────────────────────────────────────────
interface JournalLine {
  _id: string; // client-only key
  lineNo: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  costCenterId?: string;
  costCenterName?: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
  fxRate: number;
}

function emptyLine(lineNo: number): JournalLine {
  return { _id: crypto.randomUUID(), lineNo, accountId: '', accountCode: '', accountName: '', description: '', debit: 0, credit: 0, currency: 'OMR', fxRate: 1 };
}

// ── Account Cell Editor ───────────────────────────────────────────────────────
// Inline lookup rendered outside AG Grid via a floating overlay
function AccountLookupEditor({ value, onCommit, onCancel }: { value: string; onCommit: (opt: LookupOption) => void; onCancel: () => void }) {
  return (
    <div className="absolute z-50 bg-white border border-blue-500 rounded shadow-lg p-1 w-64">
      <LookupField
        value={value ? { value: '', label: value } : null}
        onChange={(opt) => { if (opt) onCommit(opt); else onCancel(); }}
        onSearch={searchGlAccounts}
        placeholder="Search account…"
        minChars={1}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function JournalFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const isNew = !id || id === 'new';

  const { data: journal } = useJournalDetail(id ?? '');
  const createMut  = useCreateJournal();
  const reverseMut = useReverseJournal();

  // ── Header state ──────────────────────────────────────────────────────────
  const today = format(new Date(), 'yyyy-MM-dd');
  const [entryDate,   setEntryDate]   = useState(today);
  const [description, setDescription] = useState('');

  // ── Lines state ───────────────────────────────────────────────────────────
  const [lines, setLines] = useState<JournalLine[]>(() => [emptyLine(1), emptyLine(2)]);

  // Populate from existing journal
  React.useEffect(() => {
    if (journal && !isNew) {
      setEntryDate(format(new Date(journal.entryDate), 'yyyy-MM-dd'));
      setDescription(journal.description ?? '');
      if (journal.lines?.length) {
        setLines(journal.lines.map((l: any, i: number) => ({
          _id: crypto.randomUUID(),
          lineNo: l.lineNo ?? i + 1,
          accountId: l.accountId,
          accountCode: l.account?.code ?? '',
          accountName: l.account?.name ?? '',
          costCenterId: l.costCenterId ?? '',
          costCenterName: l.costCenter?.name ?? '',
          description: l.description ?? '',
          debit: Number(l.debit),
          credit: Number(l.credit),
          currency: l.currency ?? 'OMR',
          fxRate: Number(l.fxRate ?? 1),
        })));
      }
    }
  }, [journal, isNew]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalDebit  = useMemo(() => lines.reduce((s, l) => s + (l.debit  || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + (l.credit || 0), 0), [lines]);
  const difference  = Math.abs(totalDebit - totalCredit);
  const isBalanced  = difference < 0.001;

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  // ── Inline editing helpers ─────────────────────────────────────────────────
  const updateLine = useCallback((id: string, patch: Partial<JournalLine>) => {
    setLines((prev) => prev.map((l) => l._id === id ? { ...l, ...patch } : l));
  }, []);

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine(prev.length + 1)]);
  };

  const deleteLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l._id !== id).map((l, i) => ({ ...l, lineNo: i + 1 })));
  };

  // ── AG Grid columns ────────────────────────────────────────────────────────
  const gridRef = useRef<AgGridReact<JournalLine>>(null);

  const columnDefs = useMemo<ColDef<JournalLine>[]>(() => [
    { field: 'lineNo',      headerName: '#',           width: 50, editable: false, sortable: false,
      cellClass: 'text-gray-400 text-xs text-center' },
    { field: 'accountName', headerName: 'Account',     flex: 2, minWidth: 180, editable: false, sortable: false,
      cellRenderer: (p: any) => {
        const line: JournalLine = p.data;
        return line.accountId ? (
          <span className="text-xs">{line.accountCode} – {line.accountName}</span>
        ) : (
          <span className="text-xs text-gray-400 italic">Click to select…</span>
        );
      },
      onCellClicked: (p: any) => {
        // Open a mini lookup via a floating div (handled in separate overlay state)
        setEditingAccountLine(p.data._id);
        setEditingAccountAnchor({ top: p.event.clientY, left: p.event.clientX });
      },
    },
    { field: 'costCenterName', headerName: 'Cost Center', flex: 1, minWidth: 120, editable: false, sortable: false,
      cellRenderer: (p: any) => {
        const line: JournalLine = p.data;
        return line.costCenterId ? (
          <span className="text-xs">{line.costCenterName}</span>
        ) : (
          <span className="text-xs text-gray-400 italic">—</span>
        );
      },
      onCellClicked: (p: any) => {
        setEditingCCLine(p.data._id);
        setEditingCCAnchor({ top: p.event.clientY, left: p.event.clientX });
      },
    },
    { field: 'description', headerName: 'Description', flex: 2, minWidth: 150, editable: true, sortable: false },
    { field: 'debit',  headerName: 'Debit',  width: 120, editable: true, sortable: false, type: 'numericColumn',
      valueFormatter: (p) => p.value ? fmt(Number(p.value)) : '',
      cellStyle: (p) => ({ background: p.value > 0 ? '#f0fdf4' : undefined }),
    },
    { field: 'credit', headerName: 'Credit', width: 120, editable: true, sortable: false, type: 'numericColumn',
      valueFormatter: (p) => p.value ? fmt(Number(p.value)) : '',
      cellStyle: (p) => ({ background: p.value > 0 ? '#fef9c3' : undefined }),
    },
    { field: 'currency', headerName: 'CCY', width: 70, editable: true, sortable: false },
    { field: 'fxRate',   headerName: 'FX Rate', width: 90, editable: true, sortable: false, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '' },
    { headerName: '', width: 40, editable: false, sortable: false, suppressMenu: true,
      cellRenderer: (p: any) => (
        <button
          className="text-red-400 hover:text-red-600 transition-colors p-0.5"
          onClick={() => deleteLine(p.data._id)}
        >
          <Trash2 size={13} />
        </button>
      ),
    },
  ], []);

  // ── Account lookup overlay ─────────────────────────────────────────────────
  const [editingAccountLine, setEditingAccountLine] = useState<string | null>(null);
  const [editingAccountAnchor, setEditingAccountAnchor] = useState({ top: 0, left: 0 });
  const [editingCCLine, setEditingCCLine] = useState<string | null>(null);
  const [editingCCAnchor, setEditingCCAnchor] = useState({ top: 0, left: 0 });

  const handleCellValueChanged = (e: CellValueChangedEvent<JournalLine>) => {
    updateLine(e.data._id, { [e.colDef.field!]: e.newValue });
  };

  // ── Post / Reverse ─────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!description) { addToast({ type: 'error', message: 'Description is required' }); return; }
    if (!isBalanced)  { addToast({ type: 'error', message: `Journal is not balanced (difference: ${fmt(difference)})` }); return; }
    const validLines = lines.filter((l) => l.accountId && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) { addToast({ type: 'error', message: 'At least 2 lines with accounts required' }); return; }
    try {
      const je = await createMut.mutateAsync({
        entryDate,
        description,
        lines: validLines.map((l, i) => ({
          accountId: l.accountId,
          costCenterId: l.costCenterId || undefined,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
          currency: l.currency,
          fxRate: l.fxRate,
          lineNo: i + 1,
        })),
      });
      addToast({ type: 'success', message: `Journal ${je.docNo} posted` });
      navigate(`/finance/journals/${je.id}`);
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Post failed' });
    }
  };

  const handleReverse = async () => {
    if (!journal || !confirm('Reverse this journal entry?')) return;
    try {
      const rev = await reverseMut.mutateAsync({ id: journal.id });
      addToast({ type: 'success', message: `Reversal ${rev.docNo} posted` });
      navigate(`/finance/journals/${rev.id}`);
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Reverse failed' });
    }
  };

  const isPosted = journal?.status === 'POSTED';

  // ── Key Info panel ─────────────────────────────────────────────────────────
  const keyInfoItems = isNew ? [] : [
    { label: 'Journal No',    value: <span className="font-mono text-blue-700">{journal?.docNo}</span> },
    { label: 'Entry Date',    value: journal ? format(new Date(journal.entryDate), 'dd/MM/yyyy') : '' },
    { label: 'Source',        value: journal?.sourceModule ?? 'MANUAL' },
    { label: 'Created By',    value: journal?.createdBy?.fullName ?? '—' },
  ];

  const keyInfo = isNew ? null : <KeyInfoGrid items={keyInfoItems} columns={4} />;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" onClick={() => { setEditingAccountLine(null); setEditingCCLine(null); }}>
      <DocumentToolbar
        title={isNew ? 'New Journal Entry' : 'Journal Entry'}
        docNo={journal?.docNo}
        status={journal?.status ? <StatusBadge status={journal.status} /> : undefined}
        actions={[
          ...(isNew ? [{
            id: 'post', label: createMut.isPending ? 'Posting…' : 'Post',
            icon: null, onClick: handlePost,
            variant: 'primary' as const,
            disabled: !isBalanced || createMut.isPending,
          }] : []),
          ...(isPosted ? [{
            id: 'reverse', label: 'Reverse', icon: <RotateCcw size={13} />,
            onClick: handleReverse, variant: 'secondary' as const,
          }] : []),
        ]}
        onNew={() => navigate('/finance/journals/new')}
      />

      <KeyInfoItemDetailsTabs
        className="flex-1"
        keyInfo={keyInfo}
        defaultTabId="key-info"
        tabs={[
          {
            id: 'key-info',
            label: 'Key Info',
            content: (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-4 max-w-2xl">
                  <div>
                    <label className="erp-label">Journal No</label>
                    <input className="erp-input bg-gray-50" readOnly value={journal?.docNo ?? '(Auto-generated)'} />
                  </div>
                  <div>
                    <label className="erp-label">Entry Date <span className="erp-required-star">*</span></label>
                    <input
                      type="date"
                      className="erp-input"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      disabled={!isNew}
                    />
                  </div>
                  <div>
                    <label className="erp-label">Source</label>
                    <input className="erp-input bg-gray-50" readOnly value={journal?.sourceModule ?? 'MANUAL'} />
                  </div>
                  <div className="col-span-3">
                    <label className="erp-label">Description <span className="erp-required-star">*</span></label>
                    <input
                      className="erp-input"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Month-end accrual – April 2026"
                      disabled={!isNew}
                    />
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: 'lines',
            label: `Journal Lines (${lines.filter(l => l.accountId).length})`,
            content: (
              <div className="flex flex-col h-full">
                {/* Toolbar */}
                {isNew && (
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50">
                    <button onClick={addLine} className="toolbar-btn text-xs">
                      <Plus size={12} /><span>Add Line</span>
                    </button>
                    <div className="flex-1" />
                    <span className="text-xs text-gray-500">Click Account or Cost Center cell to open lookup</span>
                  </div>
                )}

                {/* Grid */}
                <div className="flex-1 ag-theme-alpine" style={{ minHeight: 300 }}>
                  <AgGridReact<JournalLine>
                    ref={gridRef}
                    rowData={lines}
                    columnDefs={columnDefs}
                    defaultColDef={{ resizable: true, minWidth: 50 }}
                    getRowId={(p) => p.data._id}
                    singleClickEdit
                    onCellValueChanged={handleCellValueChanged}
                    stopEditingWhenCellsLoseFocus
                    domLayout="autoHeight"
                    suppressMovableColumns
                  />
                </div>

                {/* Totals row */}
                <div className={clsx(
                  'flex items-center gap-4 px-4 py-2 border-t text-sm font-medium',
                  isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                )}>
                  <span className="flex-1 text-xs text-gray-500">Totals</span>
                  <div className="flex items-center gap-6">
                    <span>Debit: <strong className="text-gray-800">{fmt(totalDebit)}</strong></span>
                    <span>Credit: <strong className="text-gray-800">{fmt(totalCredit)}</strong></span>
                    <span className={clsx(
                      'font-semibold',
                      isBalanced ? 'text-green-600' : 'text-red-600'
                    )}>
                      Difference: {fmt(difference)}
                      {isBalanced ? ' ✓ Balanced' : ' ✗ Not balanced'}
                    </span>
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Account lookup overlay */}
      {editingAccountLine && (
        <div
          className="fixed z-50"
          style={{ top: editingAccountAnchor.top - 10, left: editingAccountAnchor.left - 10, width: 280 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white border border-blue-500 rounded shadow-xl p-2">
            <LookupField
              value={null}
              onChange={(opt) => {
                if (opt) {
                  updateLine(editingAccountLine, {
                    accountId: opt.value,
                    accountCode: (opt.meta as any)?.code ?? '',
                    accountName: (opt.meta as any)?.name ?? opt.label,
                  });
                }
                setEditingAccountLine(null);
              }}
              onSearch={searchGlAccounts}
              placeholder="Search account…"
            />
          </div>
        </div>
      )}

      {/* Cost center lookup overlay */}
      {editingCCLine && (
        <div
          className="fixed z-50"
          style={{ top: editingCCAnchor.top - 10, left: editingCCAnchor.left - 10, width: 260 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white border border-blue-500 rounded shadow-xl p-2">
            <LookupField
              value={null}
              onChange={(opt) => {
                if (opt) {
                  updateLine(editingCCLine, {
                    costCenterId: opt.value,
                    costCenterName: (opt.meta as any)?.name ?? opt.label,
                  });
                }
                setEditingCCLine(null);
              }}
              onSearch={searchCostCenters}
              placeholder="Search cost center…"
            />
          </div>
        </div>
      )}
    </div>
  );
}
