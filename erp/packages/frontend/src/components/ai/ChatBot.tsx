import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle, X, Send, Loader2, BarChart2, TrendingUp, Bot,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useChatMutation, type ChatMessage } from '../../api/chat';

// ── Helpers ───────────────────────────────────────────────────────────────────
function guessChartKeys(rows: Record<string, unknown>[]) {
  if (!rows.length) return { nameKey: '', valueKey: '' };
  const keys = Object.keys(rows[0]);
  const valueKey = keys.find((k) => typeof rows[0][k] === 'number') ?? keys[keys.length - 1];
  const nameKey  = keys.find((k) => k !== valueKey) ?? keys[0];
  return { nameKey, valueKey };
}

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div className="mt-2 overflow-auto max-h-52 rounded border border-gray-200 text-[11px]">
      <table className="w-full border-collapse">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-2 py-1 text-left font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap">
                {c.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {cols.map((c) => (
                <td key={c} className="px-2 py-1 border-b border-gray-100 whitespace-nowrap">
                  {String(row[c] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataChart({
  rows,
  type,
}: {
  rows: Record<string, unknown>[];
  type: 'bar' | 'line' | 'pie';
}) {
  const numRows = rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && !isNaN(Number(v)) ? Number(v) : v])
    )
  );
  const { nameKey, valueKey } = guessChartKeys(numRows);
  if (!valueKey) return null;

  return (
    <div className="mt-2 h-40">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'line' ? (
          <LineChart data={numRows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey={valueKey} stroke="#1F4E79" strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <BarChart data={numRows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Bar dataKey={valueKey} fill="#1F4E79" radius={[3, 3, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────
interface MsgProps {
  role: 'user' | 'assistant';
  text: string;
  data?: Record<string, unknown>[];
  chartHint?: 'bar' | 'line' | 'pie' | null;
}

function MessageBubble({ role, text, data, chartHint }: MsgProps) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="shrink-0 w-6 h-6 rounded-full bg-[#1F4E79] flex items-center justify-center mt-0.5">
          <Bot size={13} className="text-white" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-[#1F4E79] text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-800 rounded-tl-sm'
          }`}
        >
          {text}
        </div>
        {data && data.length > 0 && (
          <>
            {chartHint && chartHint !== 'pie' && (
              <DataChart rows={data} type={chartHint} />
            )}
            <DataTable rows={data} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex justify-start gap-2">
      <div className="shrink-0 w-6 h-6 rounded-full bg-[#1F4E79] flex items-center justify-center mt-0.5">
        <Bot size={13} className="text-white" />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2.5 flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Example suggestions ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'What is the total spend this month?',
  'Show pending POs above 5,000 OMR',
  'Which supplier has highest spend?',
  'How many PRs are pending approval?',
];

// ── Main ChatBot ───────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  data?: Record<string, unknown>[];
  chartHint?: 'bar' | 'line' | 'pie' | null;
}

export default function ChatBot() {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello! I\'m your ERP Assistant. Ask me anything about your procurement, finance, or inventory data.',
    },
  ]);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const mutation   = useChatMutation();

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mutation.isPending]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Build history for context (last 10 exchanges = 20 messages, excluding welcome)
  const history: ChatMessage[] = messages
    .filter((m) => m.id !== 'welcome')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.text }));

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const res = await mutation.mutateAsync({ message: trimmed, history });
      setMessages((prev) => [
        ...prev,
        {
          id:       crypto.randomUUID(),
          role:     'assistant',
          text:     res.answer,
          data:     res.data,
          chartHint: res.chartHint,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: 'Sorry, I encountered an error. Please try again.' },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full bg-[#1F4E79] text-white shadow-lg hover:bg-[#163d61] transition-all flex items-center justify-center"
        style={{ width: 52, height: 52 }}
        title="ERP Assistant"
      >
        {open
          ? <X size={22} />
          : (
            <div className="relative">
              <MessageCircle size={22} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#1F4E79]" />
            </div>
          )
        }
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          className="fixed bottom-[74px] right-6 z-50 w-[400px] rounded-2xl shadow-2xl border border-gray-200 bg-white flex flex-col overflow-hidden"
          style={{ height: 520 }}
        >
          {/* Header */}
          <div className="bg-[#1F4E79] text-white px-4 py-3 flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div>
              <p className="font-semibold text-sm leading-none">ERP Assistant</p>
              <p className="text-[11px] text-blue-200 mt-0.5">Al Wadi Construction</p>
            </div>
            <div className="ml-auto flex items-center gap-1 text-[11px] text-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              Online
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} text={m.text} data={m.data} chartHint={m.chartHint} />
            ))}
            {mutation.isPending && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only if no real messages yet) */}
          {messages.length === 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="text-[11px] bg-gray-100 hover:bg-blue-50 hover:text-[#1F4E79] text-gray-600 rounded-full px-2.5 py-1 transition-colors border border-gray-200"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-2.5 flex gap-2 items-end shrink-0">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your ERP data…"
              disabled={mutation.isPending}
              className="flex-1 resize-none text-xs rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1F4E79] bg-gray-50 disabled:opacity-50 max-h-24"
              style={{ minHeight: 36 }}
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || mutation.isPending}
              className="shrink-0 w-9 h-9 rounded-xl bg-[#1F4E79] text-white flex items-center justify-center hover:bg-[#163d61] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending
                ? <Loader2 size={15} className="animate-spin" />
                : <Send size={15} />
              }
            </button>
          </div>
        </div>
      )}
    </>
  );
}
