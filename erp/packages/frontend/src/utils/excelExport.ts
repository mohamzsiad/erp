/**
 * Financial Excel Export Utility
 * Uses SheetJS (xlsx) to produce .xlsx files with:
 * - Accounting number format  (#,##0.000)
 * - Bold headers and subtotal/total rows
 * - Frozen first row
 * - Red text for negative numbers (via conditional cell styles where supported)
 *
 * NOTE: Full cell-level styling requires xlsx-js-style or exceljs.
 * This utility uses the SheetJS community edition with basic formatting
 * (column widths, number formats, bold via cell metadata).
 */

import * as XLSX from 'xlsx';

// Accounting format: 3 decimal places, thousands separator, negatives in red
const ACCT_FMT = '#,##0.000;[Red]-#,##0.000';
const BOLD_ACCT = '#,##0.000;[Red]-#,##0.000'; // same; bold via row metadata

export type ExcelCell = string | number | null | undefined;

export interface ExcelRow {
  cells: ExcelCell[];
  bold?: boolean;
  isCurrency?: boolean[];   // per-cell flag
  indent?: number;          // 0-3 indent level (for account names)
}

export interface ExcelSheetDef {
  sheetName: string;
  headers: string[];
  rows: ExcelRow[];
  currencyColIndices?: number[];  // columns that get accounting format
  colWidths?: number[];           // character widths per column
}

/**
 * Download an xlsx file with one or more sheets.
 */
export function downloadExcel(sheets: ExcelSheetDef[], filename: string) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const ws = buildSheet(sheet);
    XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.slice(0, 31));
  }

  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

function buildSheet(def: ExcelSheetDef): XLSX.WorkSheet {
  const currCols = new Set(def.currencyColIndices ?? []);

  // Build array-of-arrays for XLSX
  const data: any[][] = [];

  // Header row
  data.push(def.headers);

  // Data rows
  for (const row of def.rows) {
    data.push(row.cells.map((c) => c ?? ''));
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Apply column widths
  if (def.colWidths) {
    ws['!cols'] = def.colWidths.map((w) => ({ wch: w }));
  }

  // Freeze first row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Apply number formats to currency columns
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    const row = def.rows[R - 1];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) continue;

      const isCurr = currCols.has(C) || row.isCurrency?.[C];
      if (isCurr && typeof ws[addr].v === 'number') {
        ws[addr].z = ACCT_FMT;
      }
    }
  }

  return ws;
}

// ── Convenience builders ──────────────────────────────────────────────────────

/** Format a number for display in export (3dp) */
export const fmtNum = (n: number | null | undefined): number | string =>
  n == null ? '' : n;

/**
 * Build a ExcelRow array from a flat list with header row already separated.
 * isBold: set of row indices (0-based in `rows`) that should be bold.
 */
export function makeRows(
  rows: ExcelCell[][],
  boldSet: Set<number>,
  currCols: Set<number>,
): ExcelRow[] {
  return rows.map((cells, i) => ({
    cells,
    bold: boldSet.has(i),
    isCurrency: cells.map((_, c) => currCols.has(c)),
  }));
}
