import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Footer,
  PageNumber,
} from 'docx';
import { formatWon } from './employmentRateCatalog.js';

const FONT = '맑은 고딕';
const thin = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function p(text, opts = {}) {
  const {
    bold = false,
    size = 20,
    center = false,
    after = 60,
    before = 0,
  } = opts;
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before, after },
    children: [
      new TextRun({
        text: String(text ?? ''),
        bold,
        size,
        font: FONT,
      }),
    ],
  });
}

function cell(text, { bold = false, width = 2000, shading } = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: shading ? { fill: shading } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: String(text ?? ''),
            bold,
            size: 18,
            font: FONT,
          }),
        ],
      }),
    ],
  });
}

function buildRateTableElement(rows) {
  const header = new TableRow({
    children: [
      cell('컨설턴트명', { bold: true, width: 2200, shading: 'F3F4F6' }),
      cell('강사비/세션', { bold: true, width: 1800, shading: 'F3F4F6' }),
      cell('비고', { bold: true, width: 5200, shading: 'F3F4F6' }),
    ],
  });
  const body = (rows || []).map(
    (row) =>
      new TableRow({
        children: [
          cell(row.name, { width: 2200 }),
          cell(formatWon(row.rate), { width: 1800 }),
          cell(row.remark, { width: 5200 }),
        ],
      })
  );
  return new Table({
    width: { size: 9200, type: WidthType.DXA },
    rows: [header, ...body],
  });
}

function mainSection(blocks, title) {
  const children = [p(title || '[진로개발 컨설팅]', { bold: true, size: 22, before: 240, after: 120 })];
  (blocks || []).forEach((block, idx) => {
    children.push(
      p(
        `(${idx + 1}) ${block.displayName} 강사= 총 ${block.sessionCount}세션*세션당 ${formatWon(block.rate)}원= ${formatWon(block.amount)}원`,
        { bold: true, size: 20, before: 120, after: 40 }
      )
    );
    (block.days || []).forEach((day) => {
      children.push(
        p(`   ${day.dayKey} – ${day.times.join(', ')} (${day.count}세션)`, {
          size: 19,
          after: 20,
        })
      );
    });
  });
  return children;
}

function correctionSection(correctionBlocks, period) {
  const korean = correctionBlocks?.korean || [];
  const english = correctionBlocks?.english || [];
  if (!korean.length && !english.length) return [];

  const children = [
    p(`[서면첨삭] ${String(period.year).slice(2)}년 ${period.month}/1~${period.month}/${new Date(period.year, period.month, 0).getDate()}`, {
      bold: true,
      size: 22,
      before: 280,
      after: 80,
    }),
  ];

  if (korean.length) {
    children.push(p('(국문)', { bold: true, size: 20, before: 80, after: 40 }));
    korean.forEach((block, idx) => {
      children.push(
        p(
          `(${idx + 1}) ${block.displayName} 강사= 총 ${block.sessionCount}세션*세션당 ${formatWon(block.rate)}원= ${formatWon(block.amount)}원`,
          { size: 20, after: 30 }
        )
      );
    });
  }

  if (english.length) {
    children.push(p('(영문)', { bold: true, size: 20, before: 120, after: 40 }));
    english.forEach((block, idx) => {
      children.push(
        p(
          `(${idx + 1}) ${block.displayName} 강사= 총 ${block.sessionCount}세션*세션당 ${formatWon(block.rate)}원= ${formatWon(block.amount)}원`,
          { size: 20, after: 30 }
        )
      );
    });
  }

  return children;
}

export function buildCareerExpenseDocument(model) {
  const { period, rateTable, interviewBlocks, correctionBlocks, mainSectionTitle } = model;
  const title = `[혁신][진로컨설팅] 진로컨설팅 강사비 (${period.label}) 지급에 관한 사항입니다.`;

  const children = [
    p(title, { bold: true, size: 24, after: 160 }),
    p('※ 강사별 강사비 지급 기준', { bold: true, size: 20, after: 40 }),
    p('(2026 인재개발원 강사료 및 인건비 기준 책정(안) 내에서 인재개발원 컨설팅 경력 및 구분을 고려하여 산정)', {
      size: 17,
      after: 140,
    }),
    buildRateTableElement(rateTable),
    ...mainSection(interviewBlocks, mainSectionTitle),
    ...correctionSection(correctionBlocks, period),
  ];

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 900 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: '- ', font: FONT, size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 }),
                  new TextRun({ text: ' -', font: FONT, size: 18 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

export async function downloadCareerExpenseWord(model) {
  const doc = buildCareerExpenseDocument(model);
  const blob = await Packer.toBlob(doc);
  const stamp = `${String(model.period.year).slice(2)}.${String(model.period.month).padStart(2, '0')}`;
  const fileName = `[혁신][진로컨설팅] 지출결의 상세내용 (${stamp}).docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return fileName;
}
