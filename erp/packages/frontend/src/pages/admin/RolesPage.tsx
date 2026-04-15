import React, { useState, useEffect } from 'react';
import { Shield, Plus, Loader2, Save, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useRoles, useCreateRole, useUpdateRolePermissions } from '../../api/admin';
import type { Role } from '../../api/admin';
import { useToast } from '../../components/ui/Toast';

// All available permissions
const MODULES = ['PROCUREMENT', 'INVENTORY', 'FINANCE', 'ADMIN', 'WORKFLOW'] as const;
const RESOURCES: Record<string, string[]> = {
  PROCUREMENT: ['MRL', 'PRL', 'PO', 'SUPPLIER', 'RFQ', 'QUOTATION'],
  INVENTORY:   ['ITEM', 'WAREHOUSE', 'GRN', 'TRANSFER', 'ADJUSTMENT', 'STOCK'],
  FINANCE:     ['GL_ACCOUNT', 'JOURNAL', 'AP_INVOICE', 'AP_PAYMENT', 'BUDGET', 'REPORT'],
  ADMIN:       ['USER', 'ROLE', 'CONFIG', 'SEQUENCE'],
  WORKFLOW:    ['APPROVAL'],
};
const ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'CONFIGURE'] as const;

type Action = typeof ACTIONS[number];

function permKey(module: string, resource: string, action: Action) {
  return `${module}:${resource}:${action}`;
}

function buildPermSet(perms: Role['permissions']) {
  return new Set(perms.map((p) => permKey(p.module, p.resource, p.action)));
}

function buildPermArray(set: Set<string>): Role['permissions'] {
  return [...set].map((k) => {
    const [module, resource, action] = k.split(':');
    return { module, resource, action };
  });
}

export default function RolesPage() {
  const toast = useToast();
  const { data: roles = [], isFetching } = useRoles();
  const createRole  = useCreateRole();
  const updatePerms = useUpdateRolePermissions();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [permSet, setPermSet] = useState<Set<string>>(new Set());
  const [dirty, setDirty]     = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [showNew, setShowNew] = useState(false);

  const selected = roles.find((r) => r.id === selectedId);

  useEffect(() => {
    if (selected) {
      setPermSet(buildPermSet(selected.permissions));
      setDirty(false);
    }
  }, [selectedId, roles]);

  useEffect(() => {
    if (roles.length && !selectedId) setSelectedId(roles[0]?.id ?? null);
  }, [roles]);

  const toggle = (module: string, resource: string, action: Action) => {
    const key = permKey(module, resource, action);
    setPermSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    try {
      await updatePerms.mutateAsync({ id: selectedId, permissions: buildPermArray(permSet) });
      toast.success('Saved', 'Role permissions updated.');
      setDirty(false);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message ?? 'Failed to save');
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      await createRole.mutateAsync({ name: newRoleName.trim() });
      toast.success('Created', 'Role created.');
      setNewRoleName('');
      setShowNew(false);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message ?? 'Failed to create');
    }
  };

  const moduleColor: Record<string, string> = {
    PROCUREMENT: 'text-blue-700 bg-blue-50 border-blue-200',
    INVENTORY:   'text-green-700 bg-green-50 border-green-200',
    FINANCE:     'text-purple-700 bg-purple-50 border-purple-200',
    ADMIN:       'text-red-700 bg-red-50 border-red-200',
    WORKFLOW:    'text-amber-700 bg-amber-50 border-amber-200',
  };

  return (
    <div className="flex h-full min-h-0 gap-4 p-4">
      {/* Left panel — role list */}
      <div className="w-56 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Shield size={15} /> Roles</h2>
          <button onClick={() => setShowNew((v) => !v)} className="p-1 rounded hover:bg-gray-100">
            <Plus size={14} className="text-gray-500" />
          </button>
        </div>

        {showNew && (
          <div className="flex gap-1">
            <input
              autoFocus
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRole()}
              placeholder="Role name…"
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
            <button onClick={handleCreateRole} disabled={createRole.isPending} className="px-2 py-1 bg-[#1F4E79] text-white text-xs rounded">
              {createRole.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1">
          {isFetching && roles.length === 0 ? (
            <div className="flex items-center justify-center h-20"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
          ) : roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={clsx(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                selectedId === r.id ? 'bg-[#1F4E79] text-white' : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — permissions matrix */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#1F4E79]">
            {selected ? `Permissions: ${selected.name}` : 'Select a role'}
          </h1>
          {selected && (
            <button
              onClick={handleSave}
              disabled={!dirty || updatePerms.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1F4E79] text-white rounded-lg hover:bg-[#163a5c] disabled:opacity-40"
            >
              {updatePerms.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
          )}
        </div>

        {selected && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {MODULES.map((mod) => (
              <div key={mod} className={clsx('bg-white border rounded-xl overflow-hidden', moduleColor[mod])}>
                <div className={clsx('px-4 py-2.5 border-b font-semibold text-xs uppercase tracking-wider', moduleColor[mod])}>
                  {mod}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-gray-500 font-medium w-40">Resource</th>
                        {ACTIONS.map((a) => (
                          <th key={a} className="px-2 py-2 text-center text-gray-500 font-medium">{a}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(RESOURCES[mod] ?? []).map((res) => (
                        <tr key={res} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-700">{res}</td>
                          {ACTIONS.map((action) => {
                            const key  = permKey(mod, res, action);
                            const has  = permSet.has(key);
                            return (
                              <td key={action} className="px-2 py-2 text-center">
                                <button
                                  onClick={() => toggle(mod, res, action)}
                                  className={clsx(
                                    'w-5 h-5 rounded border transition-all',
                                    has ? 'bg-[#1F4E79] border-[#1F4E79] text-white' : 'border-gray-300 hover:border-gray-500'
                                  )}
                                >
                                  {has && <Check size={11} className="m-auto" />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
