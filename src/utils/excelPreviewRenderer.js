/**
 * ExcelJS 워크시트를 엑셀과 동일한 형태의 HTML 테이블로 렌더링하기 위한 데이터 추출
 */

const a1ToRC = (a1) => {
  const m = String(a1).match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  let col = 0;
  for (let i = 0; i < m[1].length; i += 1) {
    col = col * 26 + (m[1].toUpperCase().charCodeAt(i) - 64);
  }
  return { row: parseInt(m[2], 10), col };
};

const parseRange = (rangeStr) => {
  if (!rangeStr || typeof rangeStr !== 'string') return null;
  const parts = rangeStr.split(':');
  if (parts.length < 2) return null;
  const from = a1ToRC(parts[0].trim());
  const to = a1ToRC(parts[1].trim());
  if (!from || !to) return null;
  return { rowMin: from.row, colMin: from.col, rowMax: to.row, colMax: to.col };
};

const getCellValue = (cell) => {
  if (!cell) return '';
  if (cell.result !== undefined && cell.result !== null) return cell.result;
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && v && v.richText) {
    return (v.richText || []).map((t) => t.text || '').join('');
  }
  return String(v);
};

const getCellStyle = (cell) => {
  if (!cell) return {};
  const style = {};
  if (cell.font) {
    if (cell.font.bold) style.fontWeight = 'bold';
    if (cell.font.size) style.fontSize = `${cell.font.size}px`;
    if (cell.font.color?.argb) style.color = `#${cell.font.color.argb.slice(2)}`;
  }
  if (cell.fill?.fgColor?.argb) {
    style.backgroundColor = `#${cell.fill.fgColor.argb.slice(2)}`;
  }
  if (cell.alignment) {
    if (cell.alignment.horizontal) style.textAlign = cell.alignment.horizontal;
    if (cell.alignment.vertical) style.verticalAlign = cell.alignment.vertical;
    if (cell.alignment.wrapText) style.whiteSpace = 'pre-wrap';
  }
  return style;
};

/**
 * Merge 범위 목록 파싱 (worksheet._merges 또는 model.merges)
 */
const getMergeRanges = (worksheet) => {
  const merges = worksheet._merges || worksheet.model?.merges;
  if (!merges) return [];
  const list = Array.isArray(merges)
    ? merges
    : Object.values(merges || {}).map((v) => (typeof v?.range === 'string' ? v.range : v));
  const ranges = [];
  list.forEach((m) => {
    const rangeStr = typeof m === 'string' ? m : m?.range;
    const parsed = parseRange(rangeStr);
    if (parsed) ranges.push(parsed);
  });
  return ranges;
};

/**
 * (row, col)이 merge의 master인지 여부와 rowspan/colspan 반환
 */
const getMergeInfo = (row, col, mergeRanges) => {
  for (const r of mergeRanges) {
    if (row >= r.rowMin && row <= r.rowMax && col >= r.colMin && col <= r.colMax) {
      const isMaster = row === r.rowMin && col === r.colMin;
      return {
        isMaster,
        rowSpan: r.rowMax - r.rowMin + 1,
        colSpan: r.colMax - r.colMin + 1
      };
    }
  }
  return { isMaster: true, rowSpan: 1, colSpan: 1 };
};

/**
 * (row, col)이 merge slave인지 (다른 merge의 일부로 master가 아님)
 */
const isMergeSlave = (row, col, mergeRanges) => {
  const info = getMergeInfo(row, col, mergeRanges);
  return !info.isMaster && (info.rowSpan > 1 || info.colSpan > 1);
};

/**
 * ExcelJS 워크시트를 미리보기용 구조로 변환
 * @returns { { rows: Array<{ cells: Array<{ value, rowSpan, colSpan, style }> }>, colWidths: number[] } }
 */
export const worksheetToPreviewData = (worksheet) => {
  if (!worksheet) return { rows: [], colWidths: [] };

  const mergeRanges = getMergeRanges(worksheet);
  const maxRow = Math.min(worksheet.rowCount || 120, 150);
  const maxCol = 30;

  const colWidths = [];
  for (let c = 1; c <= maxCol; c += 1) {
    const col = worksheet.getColumn(c);
    colWidths.push(col && col.width ? col.width : 10);
  }

  const rows = [];
  const coveredByRowspan = new Map(); // col -> remaining rows

  for (let r = 1; r <= maxRow; r += 1) {
    const srcRow = worksheet.getRow(r);
    const cells = [];
    let col = 1;

    while (col <= maxCol) {
      if (coveredByRowspan.get(col) > 0) {
        coveredByRowspan.set(col, coveredByRowspan.get(col) - 1);
        col += 1;
        continue;
      }

      if (isMergeSlave(r, col, mergeRanges)) {
        col += 1;
        continue;
      }

      const cell = srcRow.getCell(col);
      const value = getCellValue(cell);
      const style = getCellStyle(cell);
      const mergeInfo = getMergeInfo(r, col, mergeRanges);

      const rowSpan = mergeInfo.rowSpan;
      const colSpan = mergeInfo.colSpan;

      if (rowSpan > 1) {
        for (let c = col; c < col + colSpan; c += 1) {
          coveredByRowspan.set(c, (coveredByRowspan.get(c) || 0) + rowSpan - 1);
        }
      }

      cells.push({
        value,
        rowSpan: rowSpan > 1 ? rowSpan : undefined,
        colSpan: colSpan > 1 ? colSpan : undefined,
        style
      });

      col += colSpan;
    }

    rows.push({ cells });
  }

  return { rows, colWidths };
};
