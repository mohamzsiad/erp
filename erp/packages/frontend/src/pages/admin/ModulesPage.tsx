import React, { useState, useEffect } from 'react';
import { Settings, Loader2, Save, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useModuleConfig, useUpdateModules } from '../../api/admin';
import { useToast } from '../../components/ui/Toast';

const MODULE_META: Record<string, { label: string; description: string; icon: string; core?: boolean }> = {
  PROCUREMENT: { label: 'Procurement',      description: 'Purchase orders, requisitions, suppliers, RFQs and quotations', icon: '🛒' },
  INVENTORY:   { label: 'Inventory',        description: 'Item catalog, stock ledger, GRNs, transfers and adjustments',   icon: '📦' },
  FINANCE:     { label: 'Finance & Accounting', description: 'General ledger, AP/AR, journals, budgets and financial reports', icon: '💰' },
  SALES:       { label: 'Sales',            description: 'Customer orders, invoicing and sales reports',                  icon: '🛍️' },
  HR:          { label: 'Human Resources',  description: 'Employee records, payroll and leave management',               icon: '👥' },
  ASSETS:      { label: 'Fixed Assets',     description: 'Asset register, depreciation and disposal',                    icon: '🏗️' },
  CORE:        { label: 'Core',             description: 'User management, roles, locations and system configuration',   icon: '⚙️', core: true },
};

export default function ModulesPage() {
  const toast = useToast();
  const { data: modules, isFetching } = useModuleConfig();
  const updateMutation = useUpdateModules();

  // Local toggle state
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (modules) {
      const map: Record<string, boolean> = {};
      modules.forEach((m) => { map[m.module] = m.enabled; });
      setEnabled(map);
      setDirty(false);
    }
  }, [modules]);

  const toggle = (mod: string, core?: boolean) => {
    if (core) return; // core cannot be disabled
    setEnabled((prev) => ({ ...prev, [mod]: !prev[mod] }));
    setDirty(true);
  };

  const handleSave = async () => {
    const updates = Object.entries(enabled).map(([module, en]) => ({ module, enabled: en }));
    try {
      await updateMutation.mutateAsync(updates);
      toast.success('Saved', 'Module configuration updated.');
      setDirty(false);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message ?? 'Failed to save');
    }
  };

  const allModules = Object.keys(MODULE_META);

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F4E79] flex items-center gap-2">
            <Settings size={22} /> Module Configuration
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Enable or disable application modules for your company</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || updateMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1F4E79] text-white text-sm rounded-lg hover:bg-[#163a5c] disabled:opacity-40"
        >
          {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Changes
        </button>
      </div>

      {isFetching ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allModules.map((mod) => {
            const meta = MODULE_META[mod];
            const isEnabled = enabled[mod] ?? false;
            return (
              <div
                key={mod}
                className={clsx(
                  'bg-white border rounded-xl p-4 flex items-start gap-4 shadow-sm transition-all',
                  isEnabled ? 'border-[#1F4E79]/20' : 'border-gray-200 opacity-70'
                )}
              >
                <div className="text-3xl">{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-800">{meta.label}</h3>
                    {meta.core ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle size={11} /> Always On
                      </span>
                    ) : (
                      <button
                        onClick={() => toggle(mod, meta.core)}
                        className={clsx(
                          'relative w-10 h-5 rounded-full transition-colors shrink-0',
                          isEnabled ? 'bg-[#1F4E79]' : 'bg-gray-300'
                        )}
                      >
                        <span
                          className={clsx(
                            'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          )}
                        />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{meta.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
