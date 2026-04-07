import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart,
  Package,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ColDef } from 'ag-grid-community';
import { useAuthStore } from '../store/authStore';
import { workflowApi } from '../api/workflow';
import type { WorkflowTask } from '../api/workflow';
import { SummaryTile } from '../components/ui/SummaryTile';
import DataGrid from '../components/ui/DataGrid';
import { StatusBadge } from '../components/ui/StatusBadge';
import { clsx } from 'clsx';

// ── Mock KPI data ────────────────────────────────────────────────────────────
const SPEND_DATA = [
  { month: 'Oct', spend: 142000 },
  { month: 'Nov', spend: 189000 },
  { month: 'Dec', spend: 97000 },
  { month: 'Jan', spend: 215000 },
  { month: 'Feb', spend: 178000 },
  { month: 'Mar', spend: 234000 },
];

const STOCK_DATA = [
  { name: 'Bearings', value: 120 },
  { name: 'V-Belts', value: 45 },
  { name: 'Seals', value: 88 },
  { name: 'Filters', value: 32 },
  { name: 'Lubricants', value: 67 },
];

// ── Dashboard Tabs ────────────────────────────────────────────────────────────
type DashboardTab = 'mywork' | '360' | 'portlets' | 'kpi';

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'mywork', label: 'My Work' },
  { id: '360', label: '360° View' },
  { id: 'portlets', label: 'Portlets' },
  { id: 'kpi', label: 'KPI Dashboard' },
];

// ── Workflow task grid columns ─────────────────────────────────────────────
const TASK_COLUMNS: ColDef<WorkflowTask>[] = [
  { field: 'docType', headerName: 'Type', width: 100 },
  { field: 'docNo', headerName: 'Document #', width: 130 },
  { field: 'subject', headerName: 'Subject', flex: 1 },
  { field: 'requestedBy', headerName: 'Requested By', width: 150 },
  {
    field: 'requestedAt',
    headerName: 'Date',
    width: 130,
    valueFormatter: (p) =>
      p.value ? new Date(p.value).toLocaleDateString() : '',
  },
  {
    field: 'priority',
    headerName: 'Priority',
    width: 100,
    cellRenderer: (p: { value: string }) => (
      <span
        className={clsx(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
          p.value === 'high' && 'bg-red-100 text-red-700',
          p.value === 'medium' && 'bg-amber-100 text-amber-700',
          p.value === 'low' && 'bg-gray-100 text-gray-600'
        )}
      >
        {p.value}
      </span>
    ),
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 110,
    cellRenderer: (p: { value: string }) => <StatusBadge status={p.value} />,
  },
];

// ── My Work Tab ───────────────────────────────────────────────────────────────
const MyWorkTab: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['workflow', 'my-tasks'],
    queryFn: () => workflowApi.getMyTasks({ limit: 50 }),
    staleTime: 60_000,
  });

  const tasks = data?.data ?? [];

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile
          title="Pending Approval"
          value={tasks.filter((t: WorkflowTask) => t.status === 'PENDING').length}
          icon={<Clock size={18} />}
          color="amber"
        />
        <SummaryTile
          title="Approved Today"
          value={tasks.filter((t: WorkflowTask) => t.status === 'APPROVED').length}
          icon={<CheckCircle size={18} />}
          color="green"
        />
        <SummaryTile
          title="High Priority"
          value={tasks.filter((t: WorkflowTask) => t.priority === 'high').length}
          icon={<AlertTriangle size={18} />}
          color="red"
        />
        <SummaryTile
          title="Total Tasks"
          value={tasks.length}
          icon={<BarChart2 size={18} />}
          color="blue"
        />
      </div>

      {/* Task grid */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Pending Workflow Tasks</h3>
        </div>
        <DataGrid
          rowData={tasks}
          columnDefs={TASK_COLUMNS}
          height={340}
          loading={isLoading}
          getRowId={(row) => row.id}
          pagination={false}
        />
      </div>
    </div>
  );
};

// ── 360 View Tab ─────────────────────────────────────────────────────────────
const View360Tab: React.FC = () => {
  const isModuleEnabled = useAuthStore((s) => s.isModuleEnabled);

  const tiles = [
    {
      title: 'Open Purchase Orders',
      value: '12',
      subtitle: 'AED 1.24M total value',
      icon: <ShoppingCart size={18} />,
      color: 'blue' as const,
      module: 'PROCUREMENT',
    },
    {
      title: 'Items Below Reorder',
      value: '7',
      subtitle: 'Requires immediate attention',
      icon: <Package size={18} />,
      color: 'red' as const,
      module: 'INVENTORY',
    },
    {
      title: 'AP Outstanding',
      value: 'AED 845K',
      subtitle: '23 invoices pending',
      icon: <DollarSign size={18} />,
      color: 'amber' as const,
      module: 'FINANCE',
    },
    {
      title: 'Pending MRLs',
      value: '8',
      subtitle: 'Awaiting approval',
      icon: <Clock size={18} />,
      color: 'purple' as const,
      module: 'PROCUREMENT',
    },
  ];

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((tile) =>
          !tile.module || isModuleEnabled(tile.module) ? (
            <SummaryTile key={tile.title} {...tile} />
          ) : null
        )}
      </div>
    </div>
  );
};

// ── Portlets Tab ─────────────────────────────────────────────────────────────
const PortletsTab: React.FC = () => (
  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Spend by Month */}
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Procurement Spend (AED)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={SPEND_DATA} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => [`AED ${v.toLocaleString()}`, 'Spend']} />
          <Bar dataKey="spend" fill="#2E75B6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>

    {/* Stock by Category */}
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Stock Quantity by Category</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={STOCK_DATA}
          layout="vertical"
          margin={{ top: 4, right: 30, left: 60, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
          <Tooltip />
          <Bar dataKey="value" fill="#1F4E79" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

// ── KPI Tab ───────────────────────────────────────────────────────────────────
const KPITab: React.FC = () => (
  <div className="p-4">
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <SummaryTile
        title="PO Cycle Time (avg)"
        value="4.2 days"
        subtitle="Target: 5 days"
        trend={1}
        trendLabel="0.8 days under target"
        icon={<ShoppingCart size={18} />}
        color="green"
      />
      <SummaryTile
        title="Inventory Turnover"
        value="6.4x"
        subtitle="Last 12 months"
        trend={1}
        trendLabel="+0.3x vs prior year"
        icon={<Package size={18} />}
        color="blue"
      />
      <SummaryTile
        title="On-Time Delivery"
        value="91%"
        subtitle="Supplier performance"
        trend={-1}
        trendLabel="-3% vs target"
        icon={<CheckCircle size={18} />}
        color="amber"
      />
      <SummaryTile
        title="AP Days Outstanding"
        value="38 days"
        subtitle="Target: ≤45 days"
        trend={1}
        trendLabel="7 days below limit"
        icon={<DollarSign size={18} />}
        color="green"
      />
      <SummaryTile
        title="Stockout Incidents"
        value="3"
        subtitle="This quarter"
        trend={-1}
        trendLabel="+1 vs last quarter"
        icon={<AlertTriangle size={18} />}
        color="red"
      />
      <SummaryTile
        title="Budget Utilization"
        value="73%"
        subtitle="AED 2.1M of AED 2.9M"
        icon={<BarChart2 size={18} />}
        color="purple"
      />
    </div>
  </div>
);

// ── Main Dashboard ────────────────────────────────────────────────────────────
const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('mywork');
  const user = useAuthStore((s) => s.user);

  const TAB_CONTENT: Record<DashboardTab, React.ReactNode> = {
    mywork: <MyWorkTab />,
    '360': <View360Tab />,
    portlets: <PortletsTab />,
    kpi: <KPITab />,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-800">
          Welcome back, {user?.firstName ?? 'User'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Tab strip */}
      <div className="flex border-b border-gray-200 bg-white">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-5 py-3 text-sm font-medium border-b-2 transition-colors',
              tab.id === activeTab
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto bg-gray-50">{TAB_CONTENT[activeTab]}</div>
    </div>
  );
};

export default DashboardPage;
