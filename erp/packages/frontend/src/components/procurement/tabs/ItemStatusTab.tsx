import React from 'react';
import { RefreshCw, ExternalLink, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useItemStatus } from '../../../api/prSubSections';
import { useQueryClient } from '@tanstack/react-query';
import { PR_SUB_KEYS } from '../../../api/prSubSections';
import { useNavigate } from 'react-router-dom';

interface Props {
  prlId:  string;
  lineId: string;
  reqQty: number;
}

function Tile({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  highlight?: 'green' | 'amber' | 'red' | 'none';
}) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red:   'bg-red-50 border-red-200 text-red-800',
    none:  'bg-gray-50 border-gray-200 text-gray-800',
  };
  const c = colors[highlight ?? 'none'];
  return (
    <div className={`rounded border px-3 py-2 ${c}`}>
      <p className="text-[10px] uppercase tracking-wide font-medium opacity-70 mb-0.5">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ItemStatusTab({ prlId, lineId, reqQty }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useItemStatus(prlId, lineId);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: PR_SUB_KEYS.itemStatus(prlId, lineId) });
  };

  if (isLoading) return <p className="text-xs text-gray-400 py-4 text-center">Loading item status…</p>;
  if (!data) return <p className="text-xs text-red-400 py-4 text-center">Failed to load item status</p>;

  const availHighlight =
    data.availableStock <= 0 ? 'red'
    : data.availableStock < reqQty ? 'amber'
    : 'green';

  const fmt = (n: number | null | undefined, dec = 3) =>
    n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString() : '—';

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-700">{data.description}</p>
          <p className="text-[11px] text-gray-400">{data.itemCode}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="toolbar-btn"
            title="Refresh"
          >
            <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate(`/inventory/stock-ledger?itemId=${data.itemId}`)}
            className="toolbar-btn"
          >
            <ExternalLink size={11} /> Stock Ledger
          </button>
        </div>
      </div>

      {/* Stat tiles — 3 columns */}
      <div className="grid grid-cols-3 gap-2">
        <Tile
          label="Current Stock"
          value={fmt(data.currentStock)}
          highlight="none"
        />
        <Tile
          label="Reserved"
          value={fmt(data.reservedQty)}
          sub="on open PRs / POs"
          highlight="none"
        />
        <Tile
          label="Available Stock"
          value={fmt(data.availableStock)}
          sub={`Need: ${fmt(reqQty)}`}
          highlight={availHighlight}
        />
        <Tile
          label="Open PR Qty"
          value={fmt(data.openPRQty)}
          sub="other requisitions"
          highlight="none"
        />
        <Tile
          label="Open PO Qty"
          value={fmt(data.openPOQty)}
          sub="not yet received"
          highlight="none"
        />
        <Tile
          label="Last Purchase Price"
          value={data.lastPurchasePrice != null ? fmt(data.lastPurchasePrice) : '—'}
          highlight="none"
        />
        <Tile
          label="Last Supplier"
          value={data.lastSupplier ?? '—'}
          highlight="none"
        />
        <Tile
          label="Last Purchase Date"
          value={fmtDate(data.lastPurchaseDate)}
          highlight="none"
        />
        <Tile
          label="Avg Lead Time"
          value={data.avgLeadTimeDays != null ? `${data.avgLeadTimeDays} days` : '—'}
          highlight="none"
        />
      </div>

      {/* Reorder info */}
      {(data.reorderLevel != null || data.safetyStock != null) && (
        <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-2">
          {data.reorderLevel != null && (
            <span>Reorder Level: <strong>{fmt(data.reorderLevel)}</strong></span>
          )}
          {data.safetyStock != null && (
            <span>Safety Stock: <strong>{fmt(data.safetyStock)}</strong></span>
          )}
        </div>
      )}
    </div>
  );
}
