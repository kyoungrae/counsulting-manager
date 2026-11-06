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
  PageBreak,
} from 'docx';
import { formatWon } from './employmentRateCatalog.js';
import { findConsultantProfile } from './consultantProfiles.js';

const FONT = '맑은 고딕';
const thin = { style: BorderStyle.SINGLE, size: 8, color: '000000' };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function p(text, opts = {}) {
  const { bold = false, size = 20, center = false, after = 40, before = 0 } = opts;
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before, after },
    children: [new TextRun({ text: String(text ?? ''), bold, size, font: FONT })],
  });
}

function labelCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: 'F3F4F6' },
    children: [p(text, { bold: true, size: 18 })],
  });
}

function valueCell(text, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    columnSpan: opts.span,
    children: [p(text, { size: 18, ...opts })],
  });
}

function formatDayLines(days) {
  if (!days?.length) return '-';
  return days
    .map((d) => `${d.dayKey} – ${(d.times || []).join(', ')} (${d.count}세션)`)
    .join('\n');
}

/**
 * 출석 집계 블록 → 영수증 미리보기용 항목
 */
export function buildEmploymentReceiptItems(model) {
  const items = [];
  const period = model?.period;

  (model?.interviewBlocks || []).forEach((block) => {
    const profile = findConsultantProfile(block.consultant || block.displayName);
    items.push({
      id: `interview-${block.consultant}`,
      kind: '서류면접',
      contentLabel: '취업컨설팅(서류면접)',
      displayName: block.displayName || block.consultant,
      sessionCount: block.sessionCount,
      rate: block.rate,
      amount: block.amount,
      days: block.days || [],
      dayText: formatDayLines(block.days),
      place: profile?.placeInterview || '온라인 ZOOM',
      profile,
      period,
      missingProfile: !profile,
    });
  });

  const pushCorrection = (block, langLabel) => {
    const profile = findConsultantProfile(block.consultant || block.displayName);
    items.push({
      id: `correction-${langLabel}-${block.consultant}`,
      kind: '서면첨삭',
      contentLabel: `취업컨설팅(서면첨삭·${langLabel})`,
      displayName: block.displayName || block.consultant,
      sessionCount: block.sessionCount,
      rate: block.rate,
      amount: block.amount,
      days: block.days || [],
      dayText: formatDayLines(block.days) || `${period?.month || ''}/1~${period?.month || ''}/말 (온라인 접수)`,
      place: profile?.placeCorrection || '온라인 접수',
      profile,
      period,
      missingProfile: !profile,
    });
  };

  (model?.correctionBlocks?.korean || []).forEach((b) => pushCorrection(b, '국문'));
  (model?.correctionBlocks?.english || []).forEach((b) => pushCorrection(b, '영문'));

  return items;
}

function receiptTable(item) {
  const profile = item.profile || {};
  const nameWithCode = profile.code
    ? `${item.displayName} (${profile.code})`
    : item.displayName;
  const accountText = profile.bank || profile.account
    ? `은행명: ${profile.bank || '-'}  계좌번호: ${profile.account || '-'}  예금주: ${profile.accountHolder || item.displayName}`
    : '은행명: -  계좌번호: -  예금주: -';
  const amountText = `총 ${item.sessionCount}세션\n세션당 ${formatWon(item.rate)}원 = ${formatWon(item.amount)}원`;

  const rows = [
    new TableRow({
      children: [
        labelCell('내 용', 2200),
        valueCell(item.contentLabel, 7000, { span: 1 }),
      ],
    }),
    new TableRow({
      children: [
        labelCell('금 액', 2200),
        valueCell(amountText, 7000),
      ],
    }),
    new TableRow({
      children: [
        labelCell('강의일시', 2200),
        valueCell(item.dayText, 7000),
      ],
    }),
    new TableRow({
      children: [
        labelCell('장 소', 2200),
        valueCell(item.place, 7000),
      ],
    }),
    new TableRow({
      children: [
        labelCell('성 명 (고유번호)', 2200),
        valueCell(nameWithCode, 7000),
      ],
    }),
    new TableRow({
      children: [
        labelCell('생년월일', 2200),
        valueCell(profile.birth || '-', 7000),
      ],
    }),
    new TableRow({
      children: [
        labelCell('핸드폰번호', 2200),
        valueCell(profile.phone || '-', 7000),
      ],
    }),
    new TableRow({
      children: [
        labelCell('소속 및 주소', 2200),
        valueCell(profile.affiliation || '-', 7000),
      ],
    }),
    new TableRow({
      children: [
        labelCell('계좌번호', 2200),
        valueCell(accountText, 7000),
      ],
    }),
  ];

  return new Table({
    width: { size: 9200, type: WidthType.DXA },
    rows,
  });
}

function buildReceiptPageChildren(item, { pageBreakBefore = false } = {}) {
  const children = [];
  if (pageBreakBefore) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }
  children.push(
    p('[취업컨설팅] 강사비 지급내역', { bold: true, size: 28, center: true, after: 200 }),
    receiptTable(item),
  );
  if (item.missingProfile) {
    children.push(
      p('※ 강사 인적/계좌 정보가 등록되어 있지 않습니다. 프로필을 추가해 주세요.', {
        size: 16,
        before: 120,
      })
    );
  }
  return children;
}

export function buildEmploymentReceiptDocument(model) {
  const items = buildEmploymentReceiptItems(model);
  if (!items.length) throw new Error('영수증으로 만들 강사 집계가 없습니다.');

  const children = [];
  items.forEach((item, idx) => {
    children.push(...buildReceiptPageChildren(item, { pageBreakBefore: idx > 0 }));
  });

  return new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children,
      },
    ],
  });
}

export async function downloadEmploymentReceiptWord(model) {
  const doc = buildEmploymentReceiptDocument(model);
  const blob = await Packer.toBlob(doc);
  const stamp = `${String(model.period.year).slice(2)}.${String(model.period.month).padStart(2, '0')}`;
  const fileName = `[혁신][취업컨설팅] 강사비 영수증 (${stamp}).docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return fileName;
}
