import Anthropic from '@anthropic-ai/sdk';
import type { PrismaClient } from '@prisma/client';
import { config } from '../../config.js';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  answer: string;
  data?: Record<string, unknown>[];
  chartHint?: 'bar' | 'line' | 'pie' | null;
}

type ClaudeIntent =
  | { type: 'query';  sql: string; explanation: string; chartHint?: string }
  | { type: 'answer'; text: string };

// ── SQL Safety ────────────────────────────────────────────────────────────────
const SAFE_SELECT = /^\s*SELECT\b/i;
const DANGEROUS   = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE)\b/i;

function assertSafeQuery(sql: string): void {
  const clean = sql.replace(/;[\s\S]*$/, '').trim(); // strip after first semicolon
  if (!SAFE_SELECT.test(clean))  throw new Error('Only SELECT queries are permitted.');
  if (DANGEROUS.test(clean))     throw new Error('Query contains forbidden statements.');
}

/** Strip trailing semicolons and anything after the first one */
function sanitiseSql(sql: string): string {
  return sql.replace(/;[\s\S]*$/, '').trim();
}

// ── System Prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are an AI assistant embedded in CloudERP for Al Wadi Construction LLC — a construction company based in Muscat, Oman.
You help users query their ERP data by converting natural language questions into PostgreSQL SELECT queries.

## Database Schema (key tables — all map from snake_case Prisma @map names)

### purchase_requisitions
  id, company_id, doc_no, doc_date (DATE), status (DRAFT|SUBMITTED|APPROVED|REJECTED|CANCELLED),
  delivery_date (DATE), location_id, charge_code_id, mrl_id, remarks, created_by_id, approved_by_id

### prl_lines
  id, prl_id → purchase_requisitions.id, item_id, uom_id, charge_code_id,
  requested_qty DECIMAL(18,3), approved_qty DECIMAL(18,3), approx_price DECIMAL(18,3),
  free_stock DECIMAL(18,3), short_close_status (NONE|PARTIAL|FULL),
  short_closed_qty DECIMAL(18,3), lead_time_days INT

### purchase_orders
  id, company_id, doc_no, doc_date (DATE), supplier_id, currency_id, exchange_rate,
  total_amount DECIMAL(18,3), status (DRAFT|SUBMITTED|APPROVED|REJECTED|CANCELLED|CLOSED),
  delivery_date (DATE), payment_terms, created_by_id, approved_by_id

### po_lines
  id, po_id → purchase_orders.id, item_id, uom_id, charge_code_id,
  ordered_qty DECIMAL(18,3), received_qty DECIMAL(18,3), unit_price DECIMAL(18,3),
  net_amount DECIMAL(18,3)

### grn_headers (Goods Receipt Notes)
  id, company_id, doc_no, doc_date (DATE), po_id, supplier_id, warehouse_id,
  status (DRAFT|POSTED|CANCELLED), posted_at, created_by_id

### grn_lines
  id, grn_id → grn_headers.id, item_id, po_line_id, bin_id,
  received_qty DECIMAL(18,3), accepted_qty DECIMAL(18,3), rejected_qty DECIMAL(18,3)

### ap_invoices
  id, company_id, doc_no, supplier_id, po_id, grn_id, supplier_invoice_no,
  invoice_date (DATE), due_date (DATE), amount DECIMAL(18,3), tax_amount DECIMAL(18,3),
  total_amount DECIMAL(18,3), paid_amount DECIMAL(18,3),
  status (DRAFT|SUBMITTED|APPROVED|PAID|CANCELLED), match_flag (MATCHED|MISMATCH|PENDING)

### ap_payments
  id, company_id, doc_no, supplier_id, payment_date (DATE), amount DECIMAL(18,3),
  payment_method, status (DRAFT|POSTED|CANCELLED), notes

### ar_invoices
  id, company_id, doc_no, customer_id, invoice_date (DATE), due_date (DATE),
  amount DECIMAL(18,3), tax_amount DECIMAL(18,3), total_amount DECIMAL(18,3),
  paid_amount DECIMAL(18,3), status (DRAFT|APPROVED|PAID|CANCELLED)

### ar_receipts
  id, company_id, doc_no, customer_id, receipt_date (DATE), amount DECIMAL(18,3),
  payment_method, status (DRAFT|POSTED|CANCELLED)

### journal_entries
  id, company_id, doc_no, entry_date (DATE), description, source_module, status (DRAFT|POSTED|CANCELLED)

### journal_lines
  id, journal_id → journal_entries.id, account_id, cost_center_id,
  debit DECIMAL(18,3), credit DECIMAL(18,3), description

### gl_accounts
  id, company_id, code VARCHAR(20), name, account_type (ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE),
  parent_id, is_control BOOLEAN, is_active BOOLEAN

### cost_centers
  id, company_id, code VARCHAR(20), name, is_active BOOLEAN

### cost_codes
  id, company_id, code VARCHAR(20), name, cost_center_id, type, is_active BOOLEAN

### budgets
  id, company_id, fiscal_year INT, account_id, cost_center_id, annual_amount DECIMAL(18,3)

### budget_periods
  id, budget_id → budgets.id, period_month INT(1-12), period_year INT,
  budgeted_amount DECIMAL(18,3), actual_amount DECIMAL(18,3)

### items
  id, company_id, code VARCHAR(30), description, category_id, uom_id,
  standard_cost DECIMAL(18,3), reorder_level DECIMAL(18,3), status (ACTIVE|INACTIVE|DISCONTINUED)

### suppliers
  id, company_id, code VARCHAR(20), name, short_name, credit_days INT,
  credit_amount DECIMAL(18,3), is_active BOOLEAN

### stock_issues
  id, company_id, doc_no, doc_date (DATE), warehouse_id, charge_code_id, status (DRAFT|POSTED|CANCELLED)

### stock_issue_lines
  id, issue_id → stock_issues.id, item_id, issued_qty DECIMAL(18,3), avg_cost DECIMAL(18,3)

## Rules
1. Respond ONLY with valid JSON — no markdown, no prose, no explanation outside the JSON.
2. Two response shapes only:
   - Query:  { "type": "query",  "sql": "<SELECT ...>", "explanation": "<one sentence>", "chartHint": "bar"|"line"|"pie"|null }
   - Answer: { "type": "answer", "text": "<plain text>" }
3. ALL queries MUST include WHERE company_id = $1 (or AND company_id = $1 after other conditions).
   The value for $1 will be injected automatically — you must use positional $1 placeholder only.
4. NEVER use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE or any DDL/DML.
5. All monetary amounts are in OMR (Omani Rial) stored as DECIMAL(18,3).
6. Use DATE_TRUNC, EXTRACT, NOW() for date calculations.
7. Current date is ${new Date().toISOString().slice(0, 10)}.
8. For "profit" questions, use: SUM(ar_invoices.total_amount) - SUM(ap_invoices.total_amount).
9. Return chartHint "bar" for comparisons/rankings, "line" for time-series, "pie" for distributions, null otherwise.
10. Limit result sets to 100 rows unless the user asks for all records.
`.trim();

// ── ChatService ───────────────────────────────────────────────────────────────
export class ChatService {
  private ai: Anthropic;

  constructor(private readonly prisma: PrismaClient) {
    this.ai = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }

  async chat(
    userMessage: string,
    history: ChatMessage[],
    companyId: string,
  ): Promise<ChatResponse> {

    // Build message list (cap history at last 10 pairs = 20 messages)
    const recentHistory = history.slice(-20);
    const messages: Anthropic.MessageParam[] = [
      ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    // ── Round 1: ask Claude what to do ────────────────────────────────────────
    const round1 = await this.ai.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const raw1 = (round1.content[0] as Anthropic.TextBlock).text.trim();
    let intent: ClaudeIntent;

    try {
      // Strip accidental markdown fences
      const jsonStr = raw1.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      intent = JSON.parse(jsonStr) as ClaudeIntent;
    } catch {
      // If Claude returned prose instead of JSON, wrap it as an answer
      return { answer: raw1 };
    }

    // ── Direct answer (no DB needed) ──────────────────────────────────────────
    if (intent.type === 'answer') {
      return { answer: intent.text };
    }

    // ── Query path ────────────────────────────────────────────────────────────
    const sql = sanitiseSql(intent.sql);
    assertSafeQuery(sql);

    let rows: Record<string, unknown>[] = [];
    let queryError: string | null = null;

    try {
      rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, companyId) as Record<string, unknown>[];
      // Prisma returns BigInt for some aggregates — serialise to string
      rows = JSON.parse(
        JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
      ) as Record<string, unknown>[];
    } catch (err: unknown) {
      queryError = err instanceof Error ? err.message : String(err);
    }

    // ── Round 2: ask Claude to narrate the results ────────────────────────────
    const dataContext = queryError
      ? `The query failed with error: ${queryError}. Explain this to the user in plain terms and suggest how to rephrase.`
      : rows.length === 0
        ? `The query returned no results. Tell the user no matching records were found.`
        : `Query results (${rows.length} row${rows.length === 1 ? '' : 's'}):\n${JSON.stringify(rows, null, 2)}\n\nProvide a concise, human-friendly answer in plain text. Use OMR currency where relevant. Do not repeat raw IDs.`;

    const round2 = await this.ai.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: 'You are a helpful ERP assistant. Answer clearly and concisely in plain text. No markdown.',
      messages: [
        ...messages,
        { role: 'assistant', content: raw1 },
        { role: 'user',      content: dataContext },
      ],
    });

    const answer = (round2.content[0] as Anthropic.TextBlock).text.trim();
    const chartHint = (intent.chartHint as 'bar' | 'line' | 'pie' | null) ?? null;

    return {
      answer,
      data:      rows.length > 0 ? rows : undefined,
      chartHint: rows.length > 0 ? chartHint : null,
    };
  }
}
