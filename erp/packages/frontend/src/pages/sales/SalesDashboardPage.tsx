import { useNavigate } from 'react-router-dom';
import { RefreshCw, ShoppingCart, Receipt, TrendingUp, Truck, AlertCircle, Loader2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSalesKpis } from '../../api/salesReports';

const money = (v: number) => Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function Kpi({ label, value, icon, tone = 'default', onClick }: { label: string; value: string; icon: React.ReactNode; tone?: 'default' | 'warn'; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`text-left bg-white border rounded p-4 flex items-center gap-3 hover:shadow-sm transition ${tone === 'warn' ? 'border-amber-200' : 'border-gray-200'}`}>
      <div className={`w-9 h-9 rounded flex items-center justify-center ${tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-[#1F4E79]'}`}>{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`text-lg font-semibold ${tone === 'warn' ? 'text-amber-700' : 'text-gray-800'} tabular-nums`}>{value}</div>
      </div>
    </button>
  );
}

export default function SalesDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useSalesKpis();

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-[#1F4E79]" /></div>;
  const k = data;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Sales Dashboard</h2>
        <div className="flex-1" />
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /><span>Refresh</span></button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 bg-gray-50">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Kpi label="Order Book" value={money(k?.orderBookValue ?? 0)} icon={<ShoppingCart size={18} />} onClick={() => navigate('/sales/orders')} />
          <Kpi label="Sales This Month" value={money(k?.monthlySales ?? 0)} icon={<Receipt size={18} />} onClick={() => navigate('/sales/invoices')} />
          <Kpi label="Pipeline Value" value={money(k?.pipelineValue ?? 0)} icon={<TrendingUp size={18} />} onClick={() => navigate('/sales/quotations')} />
          <Kpi label="Deliveries Due" value={String(k?.deliveriesDue ?? 0)} icon={<Truck size={18} />} onClick={() => navigate('/sales/deliveries')} />
          <Kpi label="Overdue Receivables" value={money(k?.overdueReceivables ?? 0)} icon={<AlertCircle size={18} />} tone="warn" onClick={() => navigate('/sales/reports')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="text-xs font-semibold text-gray-700 mb-3">Sales Trend (6 months)</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={k?.salesTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} width={70} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Line type="monotone" dataKey="total" stroke="#1F4E79" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="text-xs font-semibold text-gray-700 mb-3">Top Customers</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={k?.topCustomers ?? []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="total" fill="#2E75B6" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
