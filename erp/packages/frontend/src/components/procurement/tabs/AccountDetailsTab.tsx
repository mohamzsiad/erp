import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, AlertTriangle, Divide } from 'lucide-react';
import { useAccountDetails, useUpsertAccountDetails, type AccountDetailRow } from '../../../api/prSubSections';
import { useToast } from '../../ui/Toast';
import api from '../../../api/client';

interface Props {
  prlId:       string;
  lineId:      string;
  approxPrice: number;
  reqQty:      number;
  readOnly:    boolean;
}

let rowCounter = 0;
const tempId = () => `__new_${++rowCounter}`;

// Search helpers
const searchGlAccounts = async (q: string) => {
  const r = await api.get('/finance/accounts/search', { params: { q, leafOnly: true } });
  return (r.data?.data ?? r.data ?? []).map((a: any) => ({
    value: a.id,
    label: a.name,
    subLabel: a.code,
  }));
};

const searchCostCentres = async (q: string) => {
  const r = await api.get(`/core/cost-codes?search=${encodeURIComponent(q)}&limit=20`);
  return (r.data?.data ?? r.data ?? []).map((c: any) => ({
    value: c.id,
    label: c.name,
    subLabel: c.code,
  }));
};

import { LookupField } from '../../ui/LookupField';

export default function AccountDetailsTab({ prlId, lineId, approxPrice, reqQty, readOnly }: Props) {
  const toast = useToast();
  const { data: saved = [], isLoading } = useAccountDetails(prlId, lineId);
  const upsert = useUpsertAccountDetails(prlId, lineId);

  const [rows, setRows] = useState<(AccountDetailRow & { _key: string })[]>([]);
  const [dirty, setDirty] = useState(false);

  const currentYear = new Date().getFullYear();
  const lineValue   = approxPrice * reqQty;

  useEffect(() => {
    setRows(saved.map((r) => ({ ...r, _key: r.id ?? tempId() })));
    setDirty(false);
  }, [saved]);

  const totalPct = rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
  const pctOk = Math.abs(totalPct - 100) < 0.01;

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { _key: tempId(), glAccountId: '', costCentreId: '', percentage: 0, budgetYear: currentYear },
    ]);
    setDirty(true);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r._key !== key));
    setDirty(true);
  };

  const update = (key: string, field: keyof AccountDetailRow, value: unknown) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
    setDirty(true);
  };

  const updateRow = (key: string, patch: Partial<AccountDetailRow>) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const splitEqually = () => {
    if (rows.length === 0) return;
    const pct = parseFloat((100 / rows.length).toFixed(2));
    const remainder = parseFloat((100 - pct * (rows.length - 1)).toFixed(2));
    setRows((prev) =>
      prev.map((r, i) => ({ ...r, percentage: i === prev.length - 1 ? remainder : pct }))
    );
    setDirty(true);
  };

  const handleSave = async () => {
    if (!pctOk) {
      toast.error('Validation', `Percentages must sum to 100 (current: ${totalPct.toFixed(2)}%)`);
      return;
    }
    const invalid = rows.find((r) => !r.glAccountId || !r.costCentreId);
    if (invalid) {
      toast.error('Validation', 'All rows require a GL Account and Cost Centre');
      return;
    }
    try {
      await upsert.mutateAsync(rows);
      toast.success('Account details saved');
      setDirty(false);
    } catch (err: any) {
      toast.error('Save failed', err?.message);
    }
  };

  if (isLoading) return <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>;

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={addRow} className="toolbar-btn">
            <Plus size={11} /> Add Row
          </button>
          {rows.length > 1 && (
            <button type="button" onClick={splitEqually} className="toolbar-btn">
              <Divide size={11} /> Split Equally
            </button>
          )}
          {dirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={upsert.isPending}
              className="toolbar-btn bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {upsert.isPending ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      )}

      <div className="overflow-auto">
        <table className="w-full text-xs border border-gray-200 rounded">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left w-6 text-gray-500">#</th>
              <th className="px-2 py-1.5 text-left w-44">GL Account *</th>
              <th className="px-2 py-1.5 text-left w-40">Cost Centre *</th>
              <th className="px-2 py-1.5 text-left w-28">Project Code</th>
              <th className="px-2 py-1.5 text-right w-20">% Split *</th>
              <th className="px-2 py-1.5 text-right w-28">Amount</th>
              <th className="px-2 py-1.5 text-right w-20">Budget Year *</th>
              {!readOnly && <th className="w-7" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  No account split. {!readOnly && 'Click "+ Add Row" to assign GL accounts.'}
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const amount = lineValue > 0 ? (row.percentage / 100) * lineValue : 0;
              return (
                <tr key={row._key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                  <td className="px-1 py-1">
                    <LookupField
                      value={row.glAccount
                        ? { value: row.glAccountId, label: row.glAccount.name, subLabel: row.glAccount.code }
                        : row.glAccountId ? { value: row.glAccountId, label: row.glAccountId } : null
                      }
                      onChange={(opt) => updateRow(row._key, {
                        glAccountId: opt?.value ?? '',
                        glAccount: opt ? { id: opt.value, name: opt.label, code: opt.subLabel ?? '' } : undefined,
                      })}
                      onSearch={searchGlAccounts}
                      placeholder="Search GL account…"
                      disabled={readOnly}
                      className="text-xs"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <LookupField
                      value={row.costCentre
                        ? { value: row.costCentreId, label: row.costCentre.name, subLabel: row.costCentre.code }
                        : row.costCentreId ? { value: row.costCentreId, label: row.costCentreId } : null
                      }
                      onChange={(opt) => updateRow(row._key, {
                        costCentreId: opt?.value ?? '',
                        costCentre: opt ? { id: opt.value, name: opt.label, code: opt.subLabel ?? '' } : undefined,
                      })}
                      onSearch={searchCostCentres}
                      placeholder="Search cost centre…"
                      disabled={readOnly}
                      className="text-xs"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.projectCode ?? ''}
                      onChange={(e) => update(row._key, 'projectCode', e.target.value || null)}
                      className="erp-input w-full text-xs"
                      placeholder="Optional"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      value={row.percentage}
                      min={0}
                      max={100}
                      step="0.01"
                      onChange={(e) => update(row._key, 'percentage', parseFloat(e.target.value) || 0)}
                      className="erp-input w-full text-right text-xs"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-2 py-1 text-right text-gray-600 font-mono">
                    {amount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      value={row.budgetYear}
                      min={2000}
                      max={2100}
                      onChange={(e) => update(row._key, 'budgetYear', parseInt(e.target.value) || currentYear)}
                      className="erp-input w-full text-right text-xs"
                      disabled={readOnly}
                    />
                  </td>
                  {!readOnly && (
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => removeRow(row._key)}
                        className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={4} className="px-2 py-1 text-right text-xs font-semibold text-gray-600">
                  Total %:
                </td>
                <td className={`px-2 py-1 text-right text-xs font-bold ${pctOk ? 'text-green-600' : 'text-red-600'}`}>
                  {totalPct.toFixed(2)}%
                  {pctOk
                    ? <CheckCircle2 size={11} className="inline ml-1" />
                    : <AlertTriangle size={11} className="inline ml-1" />
                  }
                </td>
                <td className="px-2 py-1 text-right text-xs font-bold text-gray-700">
                  {lineValue.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!pctOk && rows.length > 0 && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertTriangle size={11} />
          Percentages must total exactly 100%. Remaining: {(100 - totalPct).toFixed(2)}%
        </p>
      )}
    </div>
  );
}
