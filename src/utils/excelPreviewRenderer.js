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

const toBorderCss = (b) => {
  if (!b || b.style === 'none' || !b.style) return null;
  const color = b.color?.argb ? `#${String(b.color.argb).slice(-6)}` : '#000';
  return `1px solid ${color}`;
};

const getCellStyle = (cell) => {
  if (!cell) return {};
  const style = {};
  if (cell.font) {
    if (cell.font.bold) style.fontWeight = 'bold';
    if (cell.font.size) style.fontSize = `${cell.font.size}pt`;
    if (cell.font.color?.argb) style.color = `#${String(cell.font.color.argb).slice(-6)}`;
  }
  if (cell.fill?.fgColor?.argb) {
    const argb = String(cell.fill.fgColor.argb);
    if (argb !== 'FF000000' && argb !== '00000000') {
      style.backgroundColor = `#${argb.slice(-6)}`;
    }
  }
  if (cell.alignment) {
    if (cell.alignment.horizontal) style.textAlign = cell.alignment.horizontal;
    if (cell.alignment.vertical) style.verticalAlign = cell.alignment.vertical;
    if (cell.alignment.wrapText) style.whiteSpace = 'pre-wrap';
    else style.whiteSpace = 'normal';
  }
  if (cell.border) {
    const top = toBorderCss(cell.border.top);
    const right = toBorderCss(cell.border.right);
    const bottom = toBorderCss(cell.border.bottom);
    const left = toBorderCss(cell.border.left);
    if (top) style.borderTop = top;
    if (right) style.borderRight = right;
    if (bottom) style.borderBottom = bottom;
    if (left) style.borderLeft = left;
  }
  return style;
};

/** merge 항목을 { rowMin, colMin, rowMax, colMax } 형식으로 변환 (ExcelJS 여러 형식 지원) */
const toMergeParsed = (m) => {
  if (typeof m === 'string') return parseRange(m);
  if (m?.range && typeof m.range === 'string') return parseRange(m.range);
  if (m?.s && m?.e) {
    return {
      rowMin: (m.s.r ?? m.s.row ?? 0) + 1,
      colMin: (m.s.c ?? m.s.col ?? 0) + 1,
      rowMax: (m.e.r ?? m.e.row ?? 0) + 1,
      colMax: (m.e.c ?? m.e.col ?? 0) + 1
    };
  }
  return null;
};

/**
 * Merge 범위 목록 파싱 (worksheet._merges 또는 model.merges)
 */
const getMergeRanges = (worksheet) => {
  const merges = worksheet._merges || worksheet.model?.merges;
  if (!merges) return [];
  const list = Array.isArray(merges)
    ? merges
    : merges instanceof Map
      ? Array.from(merges.values())
      : Object.values(merges || {});
  const ranges = [];
  list.forEach((m) => {
    const parsed = toMergeParsed(m);
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
  const usedRangeMaxCol = mergeRanges.reduce((max, r) => Math.max(max, r.colMax), 0);
  const styledOrValueMaxCol = Math.max(
    ...(Array.from({ length: maxRow }, (_, i) => i + 1).map((r) => {
      const row = worksheet.getRow(r);
      let rowMax = 0;
      for (let c = 1; c <= 30; c += 1) {
        const cell = row.getCell(c);
        const hasValue = cell.value !== null && cell.value !== undefined && String(cell.value) !== '';
        const hasStyle = !!(cell.font || cell.fill || cell.border || cell.alignment);
        if (hasValue || hasStyle) rowMax = c;
      }
      return rowMax;
    })),
    0
  );
  const maxCol = Math.max(usedRangeMaxCol, styledOrValueMaxCol, 1);

  const colWidths = [];
  for (let c = 1; c <= maxCol; c += 1) {
    const col = worksheet.getColumn(c);
    colWidths.push(col && col.width ? col.width : 8.43);
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

    rows.push({ cells, height: srcRow.height || null });
  }

  return { rows, colWidths };
};
