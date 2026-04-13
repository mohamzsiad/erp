import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  ShoppingCart,
  Package,
  DollarSign,
  Settings,
  FileText,
  Truck,
  ClipboardList,
  BarChart2,
  Search,
  ArrowRightLeft,
  Sliders,
  Users,
  Building2,
  Wallet,
  Receipt,
  BookOpen,
  TrendingUp,
} from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { clsx } from 'clsx';

interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  module?: string;
  children?: NavItem[];
}

const NAV_TREE: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={16} />,
    path: '/dashboard',
  },
  {
    id: 'procurement',
    label: 'Procurement',
    icon: <ShoppingCart size={16} />,
    module: 'PROCUREMENT',
    children: [
      {
        id: 'proc-requisitions',
        label: 'Requisitions',
        icon: <ClipboardList size={14} />,
        children: [
          { id: 'mrl-list', label: 'Material Requisitions', path: '/procurement/mrl', icon: <FileText size={13} /> },
          { id: 'prl-list', label: 'Purchase Requisitions', path: '/procurement/prl', icon: <FileText size={13} /> },
        ],
      },
      {
        id: 'proc-enquiry',
        label: 'Enquiry & Quotation',
        icon: <Search size={14} />,
        children: [
          { id: 'rfq-list', label: 'Purchase Enquiries (RFQ)', path: '/procurement/rfq', icon: <FileText size={13} /> },
          { id: 'quot-list', label: 'Supplier Quotations', path: '/procurement/quotations', icon: <FileText size={13} /> },
        ],
      },
      {
        id: 'proc-orders',
        label: 'Purchase Orders',
        icon: <ShoppingCart size={14} />,
        children: [
          { id: 'po-list', label: 'Purchase Orders', path: '/procurement/po', icon: <FileText size={13} /> },
        ],
      },
      {
        id: 'proc-suppliers',
        label: 'Suppliers',
        icon: <Truck size={14} />,
        children: [
          { id: 'supplier-list', label: 'Supplier Master', path: '/procurement/suppliers', icon: <Building2 size={13} /> },
        ],
      },
      {
        id: 'proc-reports',
        label: 'Reports',
        icon: <BarChart2 size={14} />,
        children: [
          { id: 'rpt-pr-status',       label: 'PR Status',              path: '/procurement/reports/pr-status',              icon: <TrendingUp size={13} /> },
          { id: 'rpt-po-status',       label: 'PO Status',              path: '/procurement/reports/po-status',              icon: <TrendingUp size={13} /> },
          { id: 'rpt-po-history',      label: 'PO History by Supplier', path: '/procurement/reports/po-history-by-supplier', icon: <TrendingUp size={13} /> },
          { id: 'rpt-tracking',        label: 'Procurement Tracking',   path: '/procurement/reports/procurement-tracking',   icon: <TrendingUp size={13} /> },
          { id: 'rpt-lead-time',       label: 'Lead Time Variance',     path: '/procurement/reports/lead-time-variance',     icon: <TrendingUp size={13} /> },
          { id: 'rpt-price-cmp',       label: 'Price Comparison',       path: '/procurement/reports/price-comparison',       icon: <TrendingUp size={13} /> },
          { id: 'rpt-pending-pr',      label: 'Pending PRs',            path: '/procurement/reports/pending-pr',             icon: <TrendingUp size={13} /> },
        ],
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <Package size={16} />,
    module: 'INVENTORY',
    children: [
      {
        id: 'inv-master',
        label: 'Masters',
        icon: <Package size={14} />,
        children: [
          { id: 'item-list',      label: 'Item Master',       path: '/inventory/items',       icon: <Package size={13} /> },
          { id: 'warehouse-list', label: 'Warehouses',        path: '/inventory/warehouses',  icon: <Building2 size={13} /> },
          { id: 'bin-list',       label: 'Bins',              path: '/inventory/bins',         icon: <FileText size={13} /> },
        ],
      },
      {
        id: 'inv-receipts',
        label: 'Receipts',
        icon: <ClipboardList size={14} />,
        children: [
          { id: 'grn-list', label: 'Goods Receipt Notes (GRN)', path: '/inventory/grn', icon: <FileText size={13} /> },
        ],
      },
      {
        id: 'inv-issues',
        label: 'Issues & Transfers',
        icon: <ArrowRightLeft size={14} />,
        children: [
          { id: 'issue-list',    label: 'Stock Issues',    path: '/inventory/issue',    icon: <FileText size={13} /> },
          { id: 'transfer-list', label: 'Stock Transfers', path: '/inventory/transfer', icon: <ArrowRightLeft size={13} /> },
        ],
      },
      {
        id: 'inv-adjustments',
        label: 'Adjustments',
        icon: <Sliders size={14} />,
        children: [
          { id: 'adj-list', label: 'Stock Adjustments', path: '/inventory/adjustment', icon: <FileText size={13} /> },
        ],
      },
      {
        id: 'inv-enquiry',
        label: 'Stock Enquiry',
        icon: <BarChart2 size={14} />,
        children: [
          { id: 'stock-balance', label: 'Stock Balance Query', path: '/inventory/queries/stock-balance', icon: <BarChart2 size={13} /> },
        ],
      },
      {
        id: 'inv-reports',
        label: 'Reports',
        icon: <TrendingUp size={14} />,
        children: [
          { id: 'inv-rpt-stock-balance',  label: 'Stock Balance',             path: '/inventory/reports/stock-balance',           icon: <TrendingUp size={13} /> },
          { id: 'inv-rpt-stock-aging',    label: 'Stock Aging',               path: '/inventory/reports/stock-aging',             icon: <TrendingUp size={13} /> },
          { id: 'inv-rpt-dio',            label: 'Dead / Inactive / Obsolete',path: '/inventory/reports/dead-inactive-obsolete',  icon: <TrendingUp size={13} /> },
          { id: 'inv-rpt-grn-summary',    label: 'GRN Summary',               path: '/inventory/reports/grn-summary',             icon: <TrendingUp size={13} /> },
          { id: 'inv-rpt-movement',       label: 'Stock Movement',            path: '/inventory/reports/stock-movement',          icon: <TrendingUp size={13} /> },
          { id: 'inv-rpt-reorder',        label: 'Reorder Report',            path: '/inventory/reports/reorder',                 icon: <TrendingUp size={13} /> },
          { id: 'inv-rpt-valuation',      label: 'Stock Valuation',           path: '/inventory/reports/valuation',               icon: <TrendingUp size={13} /> },
        ],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: <DollarSign size={16} />,
    module: 'FINANCE',
    children: [
      {
        id: 'fin-gl',
        label: 'General Ledger',
        icon: <BookOpen size={14} />,
        children: [
          { id: 'journal-list', label: 'Journal Entries', path: '/finance/journals', icon: <FileText size={13} /> },
          { id: 'gl-accounts', label: 'GL Accounts', path: '/finance/accounts', icon: <BookOpen size={13} /> },
        ],
      },
      {
        id: 'fin-ap',
        label: 'Accounts Payable',
        icon: <Wallet size={14} />,
        children: [
          { id: 'ap-invoices',     label: 'AP Invoices',    path: '/finance/ap/invoices',     icon: <Receipt size={13} /> },
          { id: 'ap-payments',     label: 'AP Payments',    path: '/finance/ap/payments',     icon: <DollarSign size={13} /> },
          { id: 'ap-new-payment',  label: 'New Payment',    path: '/finance/ap/payments/new', icon: <DollarSign size={13} /> },
        ],
      },
      {
        id: 'fin-ar',
        label: 'Accounts Receivable',
        icon: <Receipt size={14} />,
        children: [
          { id: 'ar-invoices', label: 'AR Invoices', path: '/finance/ar/invoices', icon: <Receipt size={13} /> },
          { id: 'ar-receipts', label: 'Receipts', path: '/finance/ar/receipts', icon: <DollarSign size={13} /> },
        ],
      },
      {
        id: 'fin-budget',
        label: 'Budget',
        icon: <TrendingUp size={14} />,
        children: [
          { id: 'budget-list', label: 'Budget Plans', path: '/finance/budgets', icon: <FileText size={13} /> },
        ],
      },
      {
        id: 'fin-reports',
        label: 'Reports',
        icon: <BarChart2 size={14} />,
        children: [
          { id: 'fin-rpt-trial-balance',    label: 'Trial Balance',    path: '/finance/reports/trial-balance',    icon: <TrendingUp size={13} /> },
          { id: 'fin-rpt-pnl',             label: 'Profit & Loss',    path: '/finance/reports/pnl',              icon: <TrendingUp size={13} /> },
          { id: 'fin-rpt-balance-sheet',   label: 'Balance Sheet',    path: '/finance/reports/balance-sheet',    icon: <TrendingUp size={13} /> },
          { id: 'fin-rpt-budget-vs-actual',label: 'Budget vs Actual', path: '/finance/reports/budget-vs-actual', icon: <TrendingUp size={13} /> },
        ],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: <Settings size={16} />,
    module: 'CORE',
    children: [
      {
        id: 'admin-users',
        label: 'Users & Roles',
        icon: <Users size={14} />,
        children: [
          { id: 'user-list', label: 'Users', path: '/admin/users', icon: <Users size={13} /> },
          { id: 'role-list', label: 'Roles & Permissions', path: '/admin/roles', icon: <Settings size={13} /> },
        ],
      },
      {
        id: 'admin-company',
        label: 'Company Setup',
        icon: <Building2 size={14} />,
        children: [
          { id: 'module-config', label: 'Module Configuration', path: '/admin/modules', icon: <Sliders size={13} /> },
          { id: 'sequences', label: 'Document Sequences', path: '/admin/sequences', icon: <FileText size={13} /> },
        ],
      },
    ],
  },
];

interface SidebarNodeProps {
  item: NavItem;
  depth: number;
  collapsed: boolean;
}

const SidebarNode: React.FC<SidebarNodeProps> = ({ item, depth, collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const openTab = useUiStore((s) => s.openTab);
  const isModuleEnabled = useAuthStore((s) => s.isModuleEnabled);

  // Module gating (skip for items without module)
  if (item.module && !isModuleEnabled(item.module) && item.module !== 'CORE') return null;

  const isActive = item.path ? location.pathname === item.path : false;
  const hasChildren = !!item.children?.length;

  const [open, setOpen] = useState(() => {
    // Auto-expand if a child path is active
    if (!hasChildren) return false;
    const flatten = (nodes: NavItem[]): string[] =>
      nodes.flatMap((n) => (n.path ? [n.path] : flatten(n.children ?? [])));
    return flatten(item.children!).some((p) => location.pathname.startsWith(p));
  });

  const handleClick = () => {
    if (hasChildren) {
      setOpen((v) => !v);
    } else if (item.path) {
      openTab({ id: item.path, title: item.label, path: item.path });
      navigate(item.path);
    }
  };

  const paddingLeft = collapsed ? 'pl-3' : depth === 0 ? 'pl-3' : depth === 1 ? 'pl-6' : 'pl-9';

  return (
    <div>
      <button
        onClick={handleClick}
        className={clsx(
          'w-full flex items-center gap-2 py-2 pr-3 text-left text-sm transition-colors',
          paddingLeft,
          isActive
            ? 'bg-[#2E75B6] text-white font-medium'
            : 'text-blue-100 hover:bg-[#163D5F] hover:text-white',
          depth === 0 && 'font-medium'
        )}
        title={collapsed ? item.label : undefined}
      >
        {item.icon && <span className="shrink-0 opacity-80">{item.icon}</span>}
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && hasChildren && (
          <span className="opacity-60">
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        )}
      </button>

      {hasChildren && open && !collapsed && (
        <div>
          {item.children!.map((child) => (
            <SidebarNode key={child.id} item={child} depth={depth + 1} collapsed={collapsed} />
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar: React.FC = () => {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <aside
      className="flex flex-col bg-sidebar-bg text-white overflow-hidden transition-all duration-200 shrink-0"
      style={{ width: collapsed ? 48 : 240 }}
    >
      {/* Logo area */}
      <div className="h-12 flex items-center px-3 border-b border-blue-800/50 shrink-0">
        {!collapsed && (
          <span className="text-white font-bold text-base tracking-wide truncate">CloudERP</span>
        )}
        {collapsed && (
          <span className="text-white font-bold text-base">C</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-blue-700">
        {NAV_TREE.map((item) => (
          <SidebarNode key={item.id} item={item} depth={0} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
