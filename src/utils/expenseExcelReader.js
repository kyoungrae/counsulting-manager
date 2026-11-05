import * as XLSX from 'xlsx';

/**
 * 지출처리용 엑셀을 시트별로 읽습니다.
 * 각 시트는 헤더 1행 + 데이터 행 배열로 정규화됩니다.
 */
export function readExpenseWorkbook(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    const normalizedRows = rows
      .map((row) => (Array.isArray(row) ? row.map((cell) => normalizeCell(cell)) : []))
      .filter((row) => row.some((cell) => String(cell).trim() !== ''));

    const header = normalizedRows[0] || [];
    const dataRows = normalizedRows.slice(1);

    return {
      name,
      header,
      rows: dataRows,
      rawRows: normalizedRows,
      rowCount: dataRows.length,
      colCount: header.length || Math.max(0, ...normalizedRows.map((r) => r.length)),
    };
  });

  return {
    sheetNames: workbook.SheetNames,
    sheets,
  };
}

function normalizeCell(cell) {
  if (cell == null) return '';
  if (cell instanceof Date) {
    const y = cell.getFullYear();
    const m = String(cell.getMonth() + 1).padStart(2, '0');
    const d = String(cell.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(cell).trim();
}

export async function readExpenseFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = readExpenseWorkbook(buffer);
  return {
    fileName: file.name,
    ...workbook,
  };
}
