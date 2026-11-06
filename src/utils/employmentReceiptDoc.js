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
  VerticalAlign,
  PageBreak,
  ImageRun,
} from 'docx';
import { formatWon } from './employmentRateCatalog.js';
import { findConsultantProfile } from './consultantProfiles.js';
import ewhaCdcLogoUrl from '../assets/ewha-cdc-logo.png';

const FONT = '맑은 고딕';
const thin = { style: BorderStyle.SINGLE, size: 8, color: '000000' };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const LABEL_W = 2400;
const VALUE_W = 6800;

/** 영수증 하단 인재개발원 로고 (원본 2275x345) */
const LOGO_WIDTH_PX = 280;
const LOGO_HEIGHT_PX = Math.round((LOGO_WIDTH_PX * 345) / 2275);

async function loadEwhaCdcLogoBytes() {
  const res = await fetch(ewhaCdcLogoUrl);
  if (!res.ok) throw new Error('인재개발원 로고 이미지를 불러오지 못했습니다.');
  return new Uint8Array(await res.arrayBuffer());
}

function textRun(text, opts = {}) {
  const { bold = false, size = 20 } = opts;
  return new TextRun({ text: String(text ?? ''), bold, size, font: FONT });
}

function para(text, opts = {}) {
  const {
    bold = false,
    size = 20,
    center = false,
    after = 0,
    before = 0,
  } = opts;
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before, after },
    children: [textRun(text, { bold, size })],
  });
}

function multilineParas(text, opts = {}) {
  const lines = String(text ?? '').split('\n');
  return lines.map((line, idx) =>
    para(line, {
      ...opts,
      after: idx === lines.length - 1 ? (opts.after || 0) : 40,
    })
  );
}

function labelCell(text) {
  return new TableCell({
    borders,
    width: { size: LABEL_W, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [textRun(text, { bold: true, size: 20 })],
      }),
    ],
  });
}

function valueCell(textOrLines) {
  const paras = Array.isArray(textOrLines)
    ? textOrLines
    : multilineParas(textOrLines, { size: 20 });
  return new TableCell({
    borders,
    width: { size: VALUE_W, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: paras.length ? paras : [para('-', { size: 20 })],
  });
}

function formatDayLines(days) {
  if (!days?.length) return '-';
  return days
    .map((d) => `${d.dayKey} - ${(d.times || []).join(', ')} (${d.count}세션)`)
    .join('\n');
}

function formatAffiliation(text) {
  const raw = String(text || '').trim();
  if (!raw) return '-';
  if (raw.includes('\n')) return raw;
  const idx = raw.indexOf(' / ');
  if (idx > 0) {
    return `${raw.slice(0, idx)}\n/ ${raw.slice(idx + 3)}`;
  }
  return raw;
}

function formatAmount(item) {
  return `총 ${item.sessionCount}세션*세션당 ${formatWon(item.rate)}원 = ${formatWon(item.amount)}원`;
}

function formatAccount(profile, displayName) {
  return [
    `은행 명: ${profile?.bank || '-'}`,
    `계좌번호: ${profile?.account || '-'}`,
    `예금주: ${profile?.accountHolder || displayName || '-'}`,
  ].join('\n');
}

/**
 * 출석 집계 블록 → 영수증 미리보기용 항목
 */
export function buildEmploymentReceiptItems(model) {
  const items = [];
  const period = model?.period;

  (model?.interviewBlocks || []).forEach((block) => {
    const profile = findConsultantProfile(block.consultant || block.displayName);
    const displayName = block.displayName || block.consultant;
    items.push({
      id: `interview-${block.consultant}`,
      kind: '서류면접',
      contentLabel: '취업컨설팅(서류면접)',
      displayName,
      sessionCount: block.sessionCount,
      rate: block.rate,
      amount: block.amount,
      amountText: formatAmount({
        sessionCount: block.sessionCount,
        rate: block.rate,
        amount: block.amount,
      }),
      days: block.days || [],
      dayText: formatDayLines(block.days),
      place: profile?.placeInterview || '온라인 ZOOM',
      affiliationText: formatAffiliation(profile?.affiliation),
      accountText: formatAccount(profile, displayName),
      profile,
      period,
      missingProfile: !profile,
    });
  });

  const pushCorrection = (block, langLabel) => {
    const profile = findConsultantProfile(block.consultant || block.displayName);
    const displayName = block.displayName || block.consultant;
    items.push({
      id: `correction-${langLabel}-${block.consultant}`,
      kind: '서면첨삭',
      contentLabel: `취업컨설팅(서면첨삭·${langLabel})`,
      displayName,
      sessionCount: block.sessionCount,
      rate: block.rate,
      amount: block.amount,
      amountText: formatAmount({
        sessionCount: block.sessionCount,
        rate: block.rate,
        amount: block.amount,
      }),
      days: block.days || [],
      dayText:
        formatDayLines(block.days)
        || `${period?.month || ''}/1~${period?.month || ''}/말 (온라인 접수)`,
      place: profile?.placeCorrection || '온라인 접수',
      affiliationText: formatAffiliation(profile?.affiliation),
      accountText: formatAccount(profile, displayName),
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

  const rows = [
    ['내용', item.contentLabel],
    ['지급액', item.amountText],
    ['강의일시', item.dayText],
    ['장소', item.place],
    ['성명 (고유번호)', nameWithCode],
    ['생년월일', profile.birth || '-'],
    ['핸드폰번호', profile.phone || '-'],
    ['소속 및 주소', item.affiliationText || '-'],
    ['통장번호', item.accountText || '-'],
  ].map(
    ([label, value]) =>
      new TableRow({
        children: [labelCell(label), valueCell(value)],
      })
  );

  return new Table({
    width: { size: LABEL_W + VALUE_W, type: WidthType.DXA },
    columnWidths: [LABEL_W, VALUE_W],
    rows,
  });
}

function buildReceiptPageChildren(item, { pageBreakBefore = false, logoBytes = null } = {}) {
  const children = [];
  if (pageBreakBefore) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  children.push(
    para('[취업컨설팅]', { bold: true, size: 28, center: true, after: 60 }),
    para('강사비 지급내역', { bold: true, size: 36, center: true, after: 240 }),
    receiptTable(item)
  );

  if (item.missingProfile) {
    children.push(
      para('※ 강사 인적/계좌 정보가 등록되어 있지 않습니다. 프로필을 추가해 주세요.', {
        size: 16,
        before: 120,
      })
    );
  }

  if (logoBytes) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 40 },
        children: [
          new ImageRun({
            type: 'png',
            data: logoBytes,
            transformation: { width: LOGO_WIDTH_PX, height: LOGO_HEIGHT_PX },
            altText: {
              title: '이화여자대학교 인재개발원',
              description: 'EWHA CAREER DEVELOPMENT CENTER',
              name: 'ewha-cdc-logo',
            },
          }),
        ],
      })
    );
  }

  return children;
}

export async function buildEmploymentReceiptDocument(model) {
  const items = buildEmploymentReceiptItems(model);
  if (!items.length) throw new Error('영수증으로 만들 강사 집계가 없습니다.');
  const logoBytes = await loadEwhaCdcLogoBytes();

  const children = [];
  items.forEach((item, idx) => {
    children.push(...buildReceiptPageChildren(item, { pageBreakBefore: idx > 0, logoBytes }));
  });

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1008, right: 1008, bottom: 1008, left: 1008 },
          },
        },
        children,
      },
    ],
  });
}

export async function downloadEmploymentReceiptWord(model) {
  const doc = await buildEmploymentReceiptDocument(model);
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
