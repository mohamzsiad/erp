import ExcelJS from 'exceljs';
import type { FastifyReply } from 'fastify';

export interface ExcelColumn {
  key: string;
  header: string;
  width?: number;
  type?: 'text' | 'number' | 'date' | 'currency';
  groupHeader?: string; // for column groups
  format?: string;      // custom number format
}

export interface ExcelExportOptions {
  title: string;
  sheetName?: string;
  filters?: Record<string, string | undefined>;
  /** If provided, columns are grouped under these headers */
  columnGroups?: { header: string; startCol: number; endCol: number }[];
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E79' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 10,
};

const SUBHEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2E75B6' },
};

const EVEN_ROW_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF5F8FF' },
};

const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 13,
  color: { argb: 'FF1F4E79' },
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD0D8E0' } },
  left: { style: 'thin', color: { argb: 'FFD0D8E0' } },
  bottom: { style: 'thin', color: { argb: 'FFD0D8E0' } },
  right: { style: 'thin', color: { argb: 'FFD0D8E0' } },
};

export async function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExcelColumn[],
  options: ExcelExportOptions,
  reply: FastifyReply
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CloudERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(options.sheetName ?? options.title, {
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' },
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  const colCount = columns.length;

  // ── Row 1: Company / Report Title ─────────────────────────────────────────
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `CloudERP — ${options.title}`;
  titleCell.font = TITLE_FONT;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FA' } };
  sheet.getRow(1).height = 26;

  // ── Row 2: Filters applied ────────────────────────────────────────────────
  const filterText = options.filters
    ? Object.entries(options.filters)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join('   |   ')
    : 'No filters applied';

  sheet.mergeCells(2, 1, 2, colCount);
  const filterCell = sheet.getCell(2, 1);
  filterCell.value = filterText;
  filterCell.font = { size: 9, color: { argb: 'FF555555' }, italic: true };
  filterCell.alignment = { horizontal: 'left', vertical: 'middle' };
  filterCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
  sheet.getRow(2).height = 14;

  // ── Row 3: Column group headers (optional) ─────────────────────────────────
  const hasGroups = options.columnGroups && options.columnGroups.length > 0;
  const headerRow = hasGroups ? 4 : 3;

  if (hasGroups && options.columnGroups) {
    for (const group of options.columnGroups) {
      sheet.mergeCells(3, group.startCol, 3, group.endCol);
      const cell = sheet.getCell(3, group.startCol);
      cell.value = group.header;
      cell.font = HEADER_FONT;
      cell.fill = SUBHEADER_FILL;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = BORDER_THIN;
    }
    sheet.getRow(3).height = 16;
  } else if (!hasGroups) {
    // blank spacer row
    sheet.mergeCells(3, 1, 3, colCount);
    sheet.getRow(3).height = 4;
  }

  // ── Column definitions ─────────────────────────────────────────────────────
  sheet.columns = columns.map((col) => ({
    key: col.key,
    width: col.width ?? autoWidth(col),
  }));

  // ── Header row ─────────────────────────────────────────────────────────────
  const hRow = sheet.getRow(headerRow);
  columns.forEach((col, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = {
      horizontal: col.type === 'number' || col.type === 'currency' ? 'right' : 'left',
      vertical: 'middle',
    };
    cell.border = BORDER_THIN;
  });
  hRow.height = 18;

  // ── Data rows ─────────────────────────────────────────────────────────────
  const dataStartRow = headerRow + 1;
  let rowIndex = 0;

  for (const record of data) {
    const dRow = sheet.getRow(dataStartRow + rowIndex);
    const isEven = rowIndex % 2 === 1;

    // Overdue highlighting
    const isOverdue = (record._overdue as boolean) === true;

    columns.forEach((col, colIdx) => {
      const cell = dRow.getCell(colIdx + 1);
      const raw = record[col.key];

      // Type coercions
      if (col.type === 'date' && raw != null) {
        const d = raw instanceof Date ? raw : new Date(raw as string);
        cell.value = isNaN(d.getTime()) ? String(raw) : d;
        cell.numFmt = 'dd/mm/yyyy';
      } else if ((col.type === 'number' || col.type === 'currency') && raw != null) {
        cell.value = typeof raw === 'number' ? raw : parseFloat(String(raw)) || 0;
        cell.numFmt = col.format ?? (col.type === 'currency' ? '#,##0.000' : '#,##0.###');
        cell.alignment = { horizontal: 'right' };
      } else {
        cell.value = raw != null ? String(raw) : '';
      }

      // Row coloring
      if (isOverdue) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEB' } };
        cell.font = { color: { argb: 'FFC00000' }, size: 9 };
      } else if (isEven) {
        cell.fill = EVEN_ROW_FILL;
        cell.font = { size: 9 };
      } else {
        cell.font = { size: 9 };
      }

      cell.border = BORDER_THIN;
    });

    dRow.height = 14;
    rowIndex++;
  }

  // ── Summary / Totals row ─────────────────────────────────────────────────
  const summaryRow = sheet.getRow(dataStartRow + rowIndex);
  let hasSummary = false;

  columns.forEach((col, colIdx) => {
    const cell = summaryRow.getCell(colIdx + 1);
    if (col.type === 'number' || col.type === 'currency') {
      const startRow = dataStartRow;
      const endRow = dataStartRow + rowIndex - 1;
      if (endRow >= startRow) {
        const colLetter = sheet.getColumn(colIdx + 1).letter;
        cell.value = { formula: `SUM(${colLetter}${startRow}:${colLetter}${endRow})` };
        cell.numFmt = col.format ?? '#,##0.000';
        cell.alignment = { horizontal: 'right' };
        hasSummary = true;
      }
    } else if (colIdx === 0) {
      cell.value = 'TOTAL';
    }
    cell.font = { bold: true, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EEF8' } };
    cell.border = BORDER_THIN;
  });
  if (hasSummary) summaryRow.height = 16;

  // ── Auto-fit columns ───────────────────────────────────────────────────────
  sheet.columns.forEach((col, i) => {
    const colDef = columns[i];
    if (colDef?.width) {
      col.width = colDef.width;
    } else {
      // measure header + first 20 rows
      let maxLen = colDef?.header.length ?? 8;
      data.slice(0, 20).forEach((row) => {
        const v = row[colDef?.key ?? ''];
        if (v != null) maxLen = Math.max(maxLen, String(v).length);
      });
      col.width = Math.min(Math.max(maxLen + 2, 8), 40);
    }
  });

  // ── Stream to response ────────────────────────────────────────────────────
  const filename = `${options.title.replace(/\s+/g, '-')}-${formatDate(new Date())}.xlsx`;
  reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);

  const buffer = await workbook.xlsx.writeBuffer();
  return reply.send(buffer);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function autoWidth(col: ExcelColumn): number {
  const base = col.header.length + 2;
  if (col.type === 'date') return Math.max(base, 14);
  if (col.type === 'number' || col.type === 'currency') return Math.max(base, 14);
  return Math.max(base, 16);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
