import { useState } from 'react';
import { RefreshCw, Download, Loader2 } from 'lucide-react';
import { useSalesReport, salesReportApi } from '../../api/salesReports';

const money = (v: number) => Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

const REPORTS = [
  { key: 'pipeline', label: 'Sales Pipeline', fn: salesReportApi.pipeline },
  { key: 'order-book', label: 'Order Book', fn: salesReportApi.orderBook },
  { key: 'sales-register', label: 'Sales Register', fn: () => salesReportApi.salesRegister() },
  { key: 'vat', label: 'VAT / Output Tax', fn: () => salesReportApi.vat() },
  { key: 'customer-ageing', label: 'Customer Ageing', fn: salesReportApi.customerAgeing },
  { key: 'boq-progress', label: 'BOQ Progress', fn: salesReportApi.boqProgress },
] as const;

function exportCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? '')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(url);
}

export default function SalesReportsPage() {
  const [key, setKey] = useState<string>('pipeline');
  const report = REPORTS.find((r) => r.key === key)!;
  const { data, isLoading, refetch } = useSalesReport(key, report.fn);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Sales Reports</h2>
        <select className="erp-input w-56" value={key} onChange={(e) => setKey(e.target.value)}>
          {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => refetch()} className="toolbar-btn"><RefreshCw size={13} /></button>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-gray-50">
        {isLoading ? <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#1F4E79]" /></div> : (
          <div className="bg-white border border-gray-200 rounded p-4">
            {key === 'pipeline' && <Pipeline d={data} />}
            {key === 'order-book' && <OrderBook d={data} />}
            {key === 'sales-register' && <Register d={data} />}
            {key === 'vat' && <Vat d={data} />}
            {key === 'customer-ageing' && <Ageing d={data} />}
            {key === 'boq-progress' && <Boq d={data} />}
          </div>
        )}
      </div>
    </div>
  );
}

const Section = ({ title, children, onExport }: { title: string; children: React.ReactNode; onExport?: () => void }) => (
  <div>
    <div className="flex items-center mb-3"><span className="text-xs font-semibold text-gray-700">{title}</span><div className="flex-1" />{onExport && <button onClick={onExport} className="toolbar-btn"><Download size={13} /><span>CSV</span></button>}</div>
    {children}
  </div>
);
const Th = ({ children, r }: { children: React.ReactNode; r?: boolean }) => <th className={`px-2 py-1 text-xs font-medium text-gray-500 ${r ? 'text-right' : 'text-left'}`}>{children}</th>;
const Td = ({ children, r }: { children: React.ReactNode; r?: boolean }) => <td className={`px-2 py-1 ${r ? 'text-right tabular-nums' : ''}`}>{children}</td>;

function Pipeline({ d }: { d: any }) {
  return (
    <Section title={`Pipeline — value ${money(d?.pipelineValue ?? 0)} · conversion ${d?.conversionRate ?? 0}%`}>
      <div className="grid grid-cols-2 gap-6 text-sm">
        <div><div className="text-xs text-gray-500 mb-1">Enquiries</div>{(d?.enquiries ?? []).map((e: any) => <div key={e.status} className="flex justify-between"><span>{e.status}</span><span className="tabular-nums">{e.count}</span></div>)}</div>
        <div><div className="text-xs text-gray-500 mb-1">Quotations</div>{(d?.quotations ?? []).map((q: any) => <div key={q.status} className="flex justify-between"><span>{q.status}</span><span className="tabular-nums">{q.count} · {money(q.value)}</span></div>)}</div>
      </div>
    </Section>
  );
}
function OrderBook({ d }: { d: any }) {
  const rows = d?.rows ?? [];
  return (
    <Section title={`Order Book — ${d?.count ?? 0} orders · backlog ${money(d?.backlogValue ?? 0)}`} onExport={() => exportCsv('order-book', ['Doc No', 'Customer', 'Status', 'Total'], rows.map((r: any) => [r.docNo, r.customerName, r.status, r.totalAmount]))}>
      <table className="w-full text-sm"><thead><tr className="border-b border-gray-100"><Th>Doc No</Th><Th>Customer</Th><Th>Status</Th><Th r>Total</Th></tr></thead>
        <tbody>{rows.map((r: any) => <tr key={r.id} className="border-b border-gray-50"><Td>{r.docNo}</Td><Td>{r.customerName}</Td><Td>{r.status}</Td><Td r>{money(r.totalAmount)}</Td></tr>)}</tbody></table>
    </Section>
  );
}
function Register({ d }: { d: any }) {
  const rows = d?.rows ?? [];
  return (
    <Section title={`Sales Register — net ${money(d?.totals?.net ?? 0)} · VAT ${money(d?.totals?.tax ?? 0)} · total ${money(d?.totals?.total ?? 0)}`} onExport={() => exportCsv('sales-register', ['Doc No', 'Customer', 'Net', 'VAT', 'Total'], rows.map((r: any) => [r.docNo, r.customerName, r.amount, r.taxAmount, r.totalAmount]))}>
      <table className="w-full text-sm"><thead><tr className="border-b border-gray-100"><Th>Doc No</Th><Th>Customer</Th><Th r>Net</Th><Th r>VAT</Th><Th r>Total</Th></tr></thead>
        <tbody>{rows.map((r: any) => <tr key={r.id} className="border-b border-gray-50"><Td>{r.docNo}</Td><Td>{r.customerName}</Td><Td r>{money(r.amount)}</Td><Td r>{money(r.taxAmount)}</Td><Td r>{money(r.totalAmount)}</Td></tr>)}</tbody></table>
    </Section>
  );
}
function Vat({ d }: { d: any }) {
  return <Section title={`VAT / Output Tax — taxable ${money(d?.taxableAmount ?? 0)} · output VAT ${money(d?.outputTax ?? 0)} · ${d?.lineCount ?? 0} invoices`}><div className="text-xs text-gray-500">Output VAT collected on sales for filing.</div></Section>;
}
function Ageing({ d }: { d: any }) {
  const rows = d?.rows ?? []; const t = d?.totals ?? {};
  return (
    <Section title="Customer Ageing" onExport={() => exportCsv('customer-ageing', ['Customer', 'Current', '1-30', '31-60', '61-90', '90+', 'Total'], rows.map((r: any) => [r.entityName, r.current, r.d30, r.d60, r.d90, r.over90, r.total]))}>
      <table className="w-full text-sm"><thead><tr className="border-b border-gray-100"><Th>Customer</Th><Th r>Current</Th><Th r>1-30</Th><Th r>31-60</Th><Th r>61-90</Th><Th r>90+</Th><Th r>Total</Th></tr></thead>
        <tbody>{rows.map((r: any) => <tr key={r.entityId} className="border-b border-gray-50"><Td>{r.entityName}</Td><Td r>{money(r.current)}</Td><Td r>{money(r.d30)}</Td><Td r>{money(r.d60)}</Td><Td r>{money(r.d90)}</Td><Td r>{money(r.over90)}</Td><Td r>{money(r.total)}</Td></tr>)}
          <tr className="font-semibold border-t border-gray-200"><Td>Total</Td><Td r>{money(t.current)}</Td><Td r>{money(t.d30)}</Td><Td r>{money(t.d60)}</Td><Td r>{money(t.d90)}</Td><Td r>{money(t.over90)}</Td><Td r>{money(t.total)}</Td></tr></tbody></table>
    </Section>
  );
}
function Boq({ d }: { d: any }) {
  const rows = d?.rows ?? [];
  return (
    <Section title="BOQ Progress" onExport={() => exportCsv('boq-progress', ['Doc No', 'Project', 'Contract', 'Certified', 'Balance', '%'], rows.map((r: any) => [r.docNo, r.projectName, r.contractValue, r.certifiedToDate, r.balance, r.percentComplete]))}>
      <table className="w-full text-sm"><thead><tr className="border-b border-gray-100"><Th>Doc No</Th><Th>Project</Th><Th r>Contract</Th><Th r>Certified</Th><Th r>Balance</Th><Th r>%</Th></tr></thead>
        <tbody>{rows.map((r: any) => <tr key={r.id} className="border-b border-gray-50"><Td>{r.docNo}</Td><Td>{r.projectName}</Td><Td r>{money(r.contractValue)}</Td><Td r>{money(r.certifiedToDate)}</Td><Td r>{money(r.balance)}</Td><Td r>{r.percentComplete}%</Td></tr>)}</tbody></table>
    </Section>
  );
}
