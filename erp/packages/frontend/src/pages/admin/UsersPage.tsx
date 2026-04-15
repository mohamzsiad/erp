import React, { useState, useMemo, useRef } from 'react';
import { Users, Plus, Search, Loader2, Edit2, UserCheck, UserX } from 'lucide-react';
import { clsx } from 'clsx';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { format } from 'date-fns';
import { useAdminUsers, useCreateUser, useUpdateUser, useRoles } from '../../api/admin';
import type { AdminUser, Role } from '../../api/admin';
import { useToast } from '../../components/ui/Toast';

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', password: '',
  roleId: '', isActive: true,
};

type UserForm = typeof EMPTY_FORM;

interface UserModalProps {
  initial?: AdminUser | null;
  roles: Role[];
  onSave: (form: UserForm) => Promise<void>;
  onClose: () => void;
}

function UserModal({ initial, roles, onSave, onClose }: UserModalProps) {
  const [form, setForm] = useState<UserForm>(
    initial
      ? { firstName: initial.firstName, lastName: initial.lastName, email: initial.email, password: '', roleId: initial.role.id, isActive: initial.isActive }
      : EMPTY_FORM
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const isEdit = !!initial;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim())   e.firstName = 'Required';
    if (!form.lastName.trim())    e.lastName  = 'Required';
    if (!form.email.trim())       e.email     = 'Required';
    if (!isEdit && !form.password) e.password = 'Required';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setLoading(true);
    try {
      await onSave(form);
    } finally {
      setLoading(false);
    }
  };

  const F = (field: keyof UserForm, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{errors[field] && <span className="text-red-500 ml-1 text-[10px]">{errors[field]}</span>}</label>
      <input
        type={type}
        value={form[field] as string}
        onChange={(e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setErrors((v) => ({ ...v, [field]: '' })); }}
        placeholder={placeholder}
        className={clsx('w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]', errors[field] ? 'border-red-400' : 'border-gray-300')}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">{isEdit ? 'Edit User' : 'New User'}</h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {F('firstName', 'First Name')}
          {F('lastName',  'Last Name')}
          <div className="col-span-2">{F('email', 'Email', 'email', 'user@company.com')}</div>
          {!isEdit && <div className="col-span-2">{F('password', 'Password', 'password')}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
            <select
              value={form.roleId}
              onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
            >
              <option value="">Select role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              Active
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={loading} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-[#1F4E79] rounded-lg hover:bg-[#163a5c] disabled:opacity-50">
            {loading && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function UsersPage() {
  const toast  = useToast();
  const gridRef = useRef<AgGridReact>(null);
  const [modal, setModal] = useState<null | 'new' | AdminUser>(null);
  const [search, setSearch] = useState('');

  const { data: users = [], isFetching } = useAdminUsers();
  const { data: roles = [] } = useRoles();
  const createUser  = useCreateUser();
  const updateUser  = useUpdateUser();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) =>
      !q || u.firstName.toLowerCase().includes(q) || u.lastName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleSave = async (form: typeof EMPTY_FORM) => {
    try {
      if (modal === 'new') {
        await createUser.mutateAsync(form as any);
        toast.success('Created', 'User created successfully.');
      } else if (modal && typeof modal === 'object') {
        await updateUser.mutateAsync({ id: (modal as AdminUser).id, ...form });
        toast.success('Updated', 'User updated successfully.');
      }
      setModal(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message ?? 'Failed to save user');
      throw err;
    }
  };

  const colDefs = useMemo<ColDef<AdminUser>[]>(() => [
    { headerName: 'Name',     flex: 2, minWidth: 160, valueGetter: (p) => `${p.data?.firstName} ${p.data?.lastName}` },
    { headerName: 'Email',    field: 'email', flex: 3, minWidth: 200 },
    { headerName: 'Role',     field: 'role',  width: 130,
      cellRenderer: (p: any) => (
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{p.value?.name ?? p.value}</span>
      )
    },
    { headerName: 'Status', field: 'isActive', width: 100,
      cellRenderer: (p: any) => p.value
        ? <span className="flex items-center gap-1 text-xs text-green-700"><UserCheck size={12} /> Active</span>
        : <span className="flex items-center gap-1 text-xs text-red-500"><UserX size={12} /> Inactive</span>
    },
    { headerName: 'Created', field: 'createdAt', width: 140,
      valueFormatter: (p) => p.value ? format(new Date(p.value), 'dd MMM yyyy') : ''
    },
    { headerName: '', width: 70, pinned: 'right', suppressSizeToFit: true,
      cellRenderer: (p: any) => (
        <button onClick={() => setModal(p.data)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1">
          <Edit2 size={12} /> Edit
        </button>
      )
    },
  ], []);

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F4E79] flex items-center gap-2"><Users size={22} /> Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} users in this company</p>
        </div>
        <button onClick={() => setModal('new')} className="flex items-center gap-1.5 px-3 py-2 bg-[#1F4E79] text-white text-sm rounded-lg hover:bg-[#163a5c]">
          <Plus size={14} /> New User
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79] w-60"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 ag-theme-alpine rounded-xl overflow-hidden border border-gray-200">
        {isFetching && filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : (
          <AgGridReact
            ref={gridRef}
            rowData={filtered}
            columnDefs={colDefs}
            rowHeight={38}
            suppressCellFocus
            animateRows={false}
            defaultColDef={{ sortable: true, resizable: true, suppressMenu: true }}
          />
        )}
      </div>

      {modal && (
        <UserModal
          initial={typeof modal === 'object' && modal !== null && modal !== 'new' ? modal as AdminUser : null}
          roles={roles}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
