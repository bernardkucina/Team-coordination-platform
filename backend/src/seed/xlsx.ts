import ExcelJS from 'exceljs';

export type Row = Record<string, string | number | Date | null>;

const cellValue = (v: ExcelJS.CellValue): string | number | Date | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || v instanceof Date) return v;
  if (typeof v === 'boolean') return String(v);
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('result' in v) return cellValue(v.result as ExcelJS.CellValue);
  if ('text' in v) return String(v.text);
  return String(v);
};

/** The first sheet as objects keyed by the header row. */
export const readSheet = async (path: string): Promise<Row[]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.worksheets[0];
  const headers: string[] = [];
  const rows: Row[] = [];
  sheet.eachRow((row, index) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue);
    if (index === 1) {
      headers.push(...values.map((h) => String(h ?? '').trim()));
      return;
    }
    rows.push(Object.fromEntries(headers.map((h, i) => [h, values[i] ?? null])));
  });
  return rows;
};

/** A date cell (Date or Excel serial number) as "YYYY-MM-DD". */
export const toIsoDate = (v: Row[string]): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86_400_000)).toISOString().slice(0, 10);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  throw new Error(`Not a date: ${String(v)}`);
};

export const text = (v: Row[string]): string => (v === null ? '' : String(v).trim());
