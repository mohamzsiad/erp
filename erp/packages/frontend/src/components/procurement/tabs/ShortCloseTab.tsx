import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, XCircle } from 'lucide-react';
import { useShortCloseInfo, useShortCloseLine, useReopenLine } from '../../../api/prSubSections';
import { useToast } from '../../ui/Toast';

interface Props {
  prlId:    string;
  lineId:   string;
  prStatus: string;
}

const STATUS_CONFIG = {
  NONE:    { label: 'None',         color: 'bg-gray-100 text-gray-600' },
  PARTIAL: { label: 'Partial Close', color: 'bg-amber-100 text-amber-700' },
  FULL:    { label: 'Fully Closed',  color: 'bg-red-100 text-red-700' },
};

const canShortClose = (s: string) =>
  ['APPROVED', 'ENQUIRY_SENT', 'PO_CREATED'].includes(s);

export default function ShortCloseTab({ prlId, lineId, prStatus }: Props) {
  const toast = useToast();
  const { data, isLoading } = useShortCloseInfo(prlId, lineId);
  const shortClose = useShortCloseLine(prlId, lineId);
  const reopen     = useReopenLine(prlId, lineId);

  const [closeQty,    setCloseQty]    = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [qtyError,    setQtyError]    = useState('');
  const [reasonError, setReasonError] = useState('');

  if (isLoading) return <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>;
  if (!data) return null;

  const statusCfg = STATUS_CONFIG[data.shortCloseStatus];
  const suggestedQty = Math.max(0, data.requestedQty - data.onPOQty);
  const canClose = canShortClose(prStatus);
  const canReopen = data.shortCloseStatus !== 'NONE' && data.onPOQty === 0;

  const validate = () => {
    let ok = true;
    const qty = parseFloat(closeQty);
    if (isNaN(qty) || qty <= 0) {
      setQtyError('Enter a valid quantity greater than 0'); ok = false;
    } else if (qty > data.requestedQty) {
      setQtyError(`Cannot exceed req. qty (${data.requestedQty})`); ok = false;
    } else { setQtyError(''); }

    if (!closeReason.trim()) {
      setReasonError('Reason is required'); ok = false;
    } else { setReasonError(''); }

    return ok;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    try {
      await shortClose.mutateAsync({ qty: parseFloat(closeQty), reason: closeReason });
      toast.success('Line short-closed successfully');
      setShowConfirm(false);
      setCloseQty('');
      setCloseReason('');
    } catch (err: any) {
      toast.error('Short close failed', err?.message);
    }
  };

  const handleReopen = async () => {
    if (!window.confirm('Reopen this line? The short close will be reversed.')) return;
    try {
      await reopen.mutateAsync();
      toast.success('Line reopened');
    } catch (err: any) {
      toast.error('Reopen failed', err?.message);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {/* Status header */}
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusCfg.color}`}>
          {data.shortCloseStatus !== 'NONE' && <XCircle size={11} />}
          {statusCfg.label}
        </span>
        {canReopen && (
          <button
            type="button"
            onClick={handleReopen}
            disabled={reopen.isPending}
            className="toolbar-btn text-xs"
          >
            <RotateCcw size={11} /> Reopen Line
          </button>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded border border-gray-200 px-3 py-2 bg-gray-50">
          <p className="text-[10px] text-gray-500 mb-0.5 uppercase tracking-wide">Original Qty</p>
          <p className="font-bold text-gray-800">
            {data.requestedQty.toLocaleString(undefined, { minimumFractionDigits: 3 })}
          </p>
        </div>
        <div className="rounded border border-gray-200 px-3 py-2 bg-gray-50">
          <p className="text-[10px] text-gray-500 mb-0.5 uppercase tracking-wide">On PO Qty</p>
          <p className="font-bold text-gray-800">
            {data.onPOQty.toLocaleString(undefined, { minimumFractionDigits: 3 })}
          </p>
        </div>
        <div className="rounded border border-gray-200 px-3 py-2 bg-gray-50">
          <p className="text-[10px] text-gray-500 mb-0.5 uppercase tracking-wide">Already Closed</p>
          <p className={`font-bold ${data.shortClosedQty > 0 ? 'text-amber-700' : 'text-gray-800'}`}>
            {data.shortClosedQty.toLocaleString(undefined, { minimumFractionDigits: 3 })}
          </p>
        </div>
      </div>

      {/* Short close history */}
      {data.shortClosedAt && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
          <p className="font-semibold text-amber-700 mb-1">Close History</p>
          <p className="text-amber-800">
            Qty <strong>{data.shortClosedQty}</strong> closed on{' '}
            <strong>{new Date(data.shortClosedAt).toLocaleString()}</strong>
          </p>
          {data.shortCloseReason && (
            <p className="text-amber-700 mt-1 italic">"{data.shortCloseReason}"</p>
          )}
        </div>
      )}

      {/* Short close form */}
      {canClose && data.shortCloseStatus !== 'FULL' && (
        <div className="rounded border border-gray-200 p-3 bg-gray-50 flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-700">Short Close This Line</p>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">
              Close Qty <span className="text-red-500">*</span>
              <span className="text-gray-400 ml-2">(Suggested: {suggestedQty.toFixed(3)})</span>
            </label>
            <input
              type="number"
              value={closeQty}
              onChange={(e) => setCloseQty(e.target.value)}
              min={0}
              max={data.requestedQty}
              step="0.001"
              placeholder={String(suggestedQty)}
              className={`erp-input w-32 text-right ${qtyError ? 'border-red-400' : ''}`}
            />
            {qtyError && <p className="text-xs text-red-500 mt-0.5">{qtyError}</p>}
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              rows={2}
              placeholder="Explain why this line is being short-closed…"
              className={`erp-input w-full resize-none text-xs ${reasonError ? 'border-red-400' : ''}`}
            />
            {reasonError && <p className="text-xs text-red-500 mt-0.5">{reasonError}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { if (validate()) setShowConfirm(true); }}
              className="toolbar-btn bg-amber-600 text-white hover:bg-amber-700 text-xs"
            >
              <XCircle size={11} /> Short Close
            </button>
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-5 w-80 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Confirm Short Close</p>
                <p className="text-xs text-gray-500 mt-1">
                  You are closing <strong>{closeQty}</strong> units of this PR line.
                  This action will {parseFloat(closeQty) >= data.requestedQty
                    ? 'FULLY close the line and prevent further POs.'
                    : 'partially close the line.'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="toolbar-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={shortClose.isPending}
                className="toolbar-btn bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {shortClose.isPending ? 'Processing…' : 'Confirm Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!canClose && data.shortCloseStatus === 'NONE' && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <AlertTriangle size={11} />
          Short close is only available once the PR is approved.
        </p>
      )}
    </div>
  );
}
