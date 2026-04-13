import React, { useState, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, Plus, Save, Trash2, Loader2,
  BookOpen, DollarSign, TrendingUp, CreditCard, BarChart2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useGlTree, useCreateGlAccount, useUpdateGlAccount, useDeleteGlAccount } from '../../../api/finance';
import { useToast } from '../../../components/ui/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface GlNode {
  id: string;
  code: string;
  name: string;
  accountType: string;
  parentId: string | null;
  isControl: boolean;
  isActive: boolean;
  children?: GlNode[];
}

const TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ASSET:     { label: 'Assets',     color: 'text-blue-700 bg-blue-50',   icon: <BookOpen size={14} /> },
  LIABILITY: { label: 'Liabilities',color: 'text-red-700 bg-red-50',     icon: <CreditCard size={14} /> },
  EQUITY:    { label: 'Equity',     color: 'text-purple-700 bg-purple-50',icon: <TrendingUp size={14} /> },
  REVENUE:   { label: 'Revenue',    color: 'text-green-700 bg-green-50',  icon: <DollarSign size={14} /> },
  EXPENSE:   { label: 'Expenses',   color: 'text-amber-700 bg-amber-50',  icon: <BarChart2 size={14} /> },
};

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

// ── Tree Node Component ───────────────────────────────────────────────────────
interface TreeNodeProps {
  node: GlNode;
  depth: number;
  selected: GlNode | null;
  onSelect: (node: GlNode) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, selected, onSelect }) => {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = !!node.children?.length;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setOpen((v) => !v);
          onSelect(node);
        }}
        className={clsx(
          'w-full flex items-center gap-1 py-1 pr-2 text-left text-xs rounded transition-colors',
          `pl-${2 + depth * 3}`,
          selected?.id === node.id
            ? 'bg-[#1F4E79] text-white'
            : 'hover:bg-gray-100 text-gray-700'
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <span className="shrink-0 w-4 text-center">
          {hasChildren ? (
            open ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <span className="inline-block w-3" />
          )}
        </span>
        <span className="font-mono text-[11px] shrink-0 mr-1 opacity-70">{node.code}</span>
        <span className="flex-1 truncate">{node.name}</span>
        {!node.isActive && (
          <span className="text-[10px] bg-gray-200 text-gray-500 px-1 rounded ml-1 shrink-0">Inactive</span>
        )}
        {node.isControl && (
          <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded ml-1 shrink-0">Ctrl</span>
        )}
      </button>
      {hasChildren && open && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Detail Form ───────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  code: '', name: '', accountType: 'ASSET', parentId: null as string | null,
  isControl: false, isActive: true,
};

interface DetailFormProps {
  account: GlNode | null;
  parentNode: GlNode | null;
  onCreated: (acc: GlNode) => void;
  onUpdated: (acc: GlNode) => void;
  onDeleted: () => void;
  onNewChild: () => void;
}

const DetailForm: React.FC<DetailFormProps> = ({
  account, parentNode, onCreated, onUpdated, onDeleted, onNewChild,
}) => {
  const { addToast } = useToast();
  const [form, setForm] = useState({ ...EMPTY_FORM, ...account });
  const createMut  = useCreateGlAccount();
  const updateMut  = useUpdateGlAccount(account?.id ?? '');
  const deleteMut  = useDeleteGlAccount();

  React.useEffect(() => {
    if (account) {
      setForm({ ...account, parentId: account.parentId ?? null });
    } else {
      setForm({ ...EMPTY_FORM, parentId: parentNode?.id ?? null, accountType: parentNode?.accountType ?? 'ASSET' });
    }
  }, [account, parentNode]);

  const isSaving = createMut.isPending || updateMut.isPending;

  const handleSave = async () => {
    if (!form.code || !form.name) { addToast({ type: 'error', message: 'Code and Name are required' }); return; }
    try {
      if (account) {
        const updated = await updateMut.mutateAsync(form);
        onUpdated(updated);
        addToast({ type: 'success', message: 'Account updated' });
      } else {
        const created = await createMut.mutateAsync(form);
        onCreated(created);
        addToast({ type: 'success', message: 'Account created' });
      }
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Save failed' });
    }
  };

  const handleDelete = async () => {
    if (!account || !confirm(`Delete account ${account.code}?`)) return;
    try {
      await deleteMut.mutateAsync(account.id);
      onDeleted();
      addToast({ type: 'success', message: 'Account deleted' });
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Delete failed' });
    }
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white">
        <span className="text-xs font-semibold text-gray-700 flex-1">
          {account ? `Edit: ${account.code} – ${account.name}` : 'New Account'}
        </span>
        {account && (
          <button
            onClick={onNewChild}
            className="toolbar-btn"
          >
            <Plus size={13} /><span>Add Child</span>
          </button>
        )}
        {account && (
          <button onClick={handleDelete} className="toolbar-btn text-red-600 hover:bg-red-50" disabled={deleteMut.isPending}>
            <Trash2 size={13} /><span>Delete</span>
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="toolbar-btn bg-[#1F4E79] text-white border-[#1F4E79] hover:bg-[#163D5F]"
        >
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          <span>{isSaving ? 'Saving…' : 'Save'}</span>
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto p-4 bg-white">
        <div className="max-w-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="erp-label">Account Code <span className="erp-required-star">*</span></label>
              <input
                className="erp-input font-mono"
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                placeholder="e.g. 1110"
                disabled={!!account}
              />
            </div>
            <div>
              <label className="erp-label">Account Type <span className="erp-required-star">*</span></label>
              <select
                className="erp-input"
                value={form.accountType}
                onChange={(e) => set('accountType', e.target.value)}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_META[t]?.label ?? t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="erp-label">Account Name <span className="erp-required-star">*</span></label>
            <input
              className="erp-input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Main Bank Account"
            />
          </div>

          {parentNode && (
            <div>
              <label className="erp-label">Parent Group</label>
              <input
                className="erp-input bg-gray-50"
                value={`${parentNode.code} – ${parentNode.name}`}
                readOnly
              />
            </div>
          )}

          <div className="flex gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#1F4E79] focus:ring-blue-500"
                checked={form.isControl}
                onChange={(e) => set('isControl', e.target.checked)}
              />
              <span className="text-sm text-gray-700">Control Account</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#1F4E79] focus:ring-blue-500"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              <span className="text-sm text-gray-700">Is Active</span>
            </label>
          </div>

          {form.isControl && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-700">
              Control accounts cannot have direct journal postings. They summarise subsidiary ledgers.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const { data: tree, isLoading, refetch } = useGlTree();
  const [selected, setSelected] = useState<GlNode | null>(null);
  const [isNewChild, setIsNewChild] = useState(false);

  // Group top-level nodes by accountType
  const grouped = useMemo(() => {
    if (!tree) return {};
    const groups: Record<string, GlNode[]> = {};
    for (const node of tree as GlNode[]) {
      if (!groups[node.accountType]) groups[node.accountType] = [];
      groups[node.accountType].push(node);
    }
    return groups;
  }, [tree]);

  const selectedParent = useMemo(() => {
    if (!isNewChild || !selected) return null;
    return selected;
  }, [isNewChild, selected]);

  const formAccount = isNewChild ? null : selected;

  const handleSelect = (node: GlNode) => {
    setSelected(node);
    setIsNewChild(false);
  };

  const handleNewChild = () => setIsNewChild(true);

  return (
    <div className="flex h-full">
      {/* Left Panel — Tree */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-700 flex-1">Chart of Accounts</span>
          <button
            onClick={() => { setSelected(null); setIsNewChild(false); }}
            className="toolbar-btn text-xs"
          >
            <Plus size={12} /><span>New</span>
          </button>
          <button onClick={() => refetch()} className="toolbar-btn">
            <Loader2 size={12} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-auto py-1">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          )}

          {ACCOUNT_TYPES.map((type) => {
            const nodes = grouped[type] ?? [];
            if (!nodes.length && !isLoading) return null;
            const meta = TYPE_META[type];
            return (
              <div key={type}>
                <div className={clsx('flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide', meta.color)}>
                  {meta.icon}
                  {meta.label}
                </div>
                {nodes.map((node) => (
                  <TreeNode key={node.id} node={node} depth={0} selected={selected} onSelect={handleSelect} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 bg-gray-50">
        {(selected || isNewChild) ? (
          <DetailForm
            account={formAccount}
            parentNode={selectedParent}
            onCreated={(acc) => { setSelected(acc); setIsNewChild(false); refetch(); }}
            onUpdated={(acc) => { setSelected(acc); refetch(); }}
            onDeleted={() => { setSelected(null); refetch(); }}
            onNewChild={handleNewChild}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <BookOpen size={40} className="opacity-30" />
            <p className="text-sm">Select an account to view details</p>
            <p className="text-xs">or click <strong>New</strong> to create a top-level account</p>
          </div>
        )}
      </div>
    </div>
  );
}
