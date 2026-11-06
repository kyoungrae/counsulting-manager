import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  BorderStyle,
  AlignmentType,
} from 'docx';

export const BUDGET_TYPES = {
  career: {
    id: 'career',
    label: '진로예산',
    fileHint: '진로컨설팅 출석부 엑셀',
    downloadPrefix: '진로예산_지출결의상세',
  },
  employment: {
    id: 'employment',
    label: '취업예산',
    fileHint: '출석부 엑셀 (서류면접/서면첨삭)',
    downloadPrefix: '취업예산_지출결의상세',
  },
};

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function cell(text, { bold = false, shading } = {}) {
  return new TableCell({
    borders,
    width: { size: 1800, type: WidthType.DXA },
    shading: shading ? { fill: shading } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: String(text ?? ''),
            bold,
            size: 18,
            font: '맑은 고딕',
          }),
        ],
      }),
    ],
  });
}

function sheetToTable(sheet) {
  const headerRow = new TableRow({
    children: (sheet.header.length ? sheet.header : ['(헤더 없음)']).map((h) =>
      cell(h, { bold: true, shading: 'E8F5E9' })
    ),
  });

  const dataRows = sheet.rows.map(
    (row) =>
      new TableRow({
        children: (sheet.header.length ? sheet.header : row).map((_, idx) =>
          cell(row[idx] ?? '')
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

/**
 * 타입별 워드 문서 생성.
 * 양식(템플릿)이 확정되면 여기의 career/employment 빌더만 교체하면 됩니다.
 * 현재는 시트별 표로 먼저 내려받을 수 있게 해 둡니다.
 */
export function buildExpenseDocument({ budgetType, workbook }) {
  const meta = BUDGET_TYPES[budgetType];
  if (!meta) throw new Error('알 수 없는 예산 유형입니다.');
  if (!workbook?.sheets?.length) throw new Error('변환할 시트가 없습니다.');

  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${meta.label} 지출처리`,
          bold: true,
          size: 32,
          font: '맑은 고딕',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `원본 파일: ${workbook.fileName || '-'}`,
          size: 20,
          font: '맑은 고딕',
          color: '666666',
        }),
      ],
    }),
  ];

  workbook.sheets.forEach((sheet, index) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: index === 0 ? 120 : 280, after: 120 },
        children: [
          new TextRun({
            text: `시트: ${sheet.name}`,
            bold: true,
            size: 24,
            font: '맑은 고딕',
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: `${sheet.rowCount}행 · ${sheet.colCount}열`,
            size: 18,
            color: '666666',
            font: '맑은 고딕',
          }),
        ],
      })
    );
    children.push(sheetToTable(sheet));
  });

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });
}

export async function downloadExpenseWord({
  budgetType,
  workbook,
  employmentModel,
  careerModel,
  docKind = 'detail',
}) {
  if (budgetType === 'employment') {
    if (!employmentModel) throw new Error('취업예산 분석 결과가 없습니다.');
    if (docKind === 'receipt') {
      const { downloadEmploymentReceiptWord } = await import('./employmentReceiptDoc.js');
      return downloadEmploymentReceiptWord(employmentModel);
    }
    const { downloadEmploymentExpenseWord } = await import('./employmentExpenseDoc.js');
    return downloadEmploymentExpenseWord(employmentModel);
  }
  if (budgetType === 'career') {
    if (!careerModel) throw new Error('진로예산 분석 결과가 없습니다.');
    const { downloadCareerExpenseWord } = await import('./careerExpenseDoc.js');
    return downloadCareerExpenseWord(careerModel);
  }

  const meta = BUDGET_TYPES[budgetType];
  const doc = buildExpenseDocument({ budgetType, workbook });
  const blob = await Packer.toBlob(doc);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `${meta.downloadPrefix}_${stamp}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return fileName;
}
