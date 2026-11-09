import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { Packer } from 'docx';
import JSZip from 'jszip';

let vite;
let master;
let career;
let employment;
let careerParser;
let employmentParser;
const fakeProfile = {
  name: '가상상담사', aliases: ['가상상담사'], code: 'TEST-001', birth: '2000-01-01',
  phone: '010-0000-0000', affiliation: '가상기관', bank: '가상은행',
  account: '000-000-0000', accountHolder: '가상상담사',
  placeInterview: '온라인 ZOOM', placeCorrection: '온라인 접수',
  rates: [{ rate: 70000, remark: '진로', kinds: [] }],
};

before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  master = await vite.ssrLoadModule('/src/utils/consultantMasterData.js');
  career = await vite.ssrLoadModule('/src/utils/careerReceiptDoc.js');
  employment = await vite.ssrLoadModule('/src/utils/employmentReceiptDoc.js');
  careerParser = await vite.ssrLoadModule('/src/utils/careerBudgetParser.js');
  employmentParser = await vite.ssrLoadModule('/src/utils/employmentBudgetParser.js');
  master.setConsultantMaster([fakeProfile]);
});

after(async () => {
  master?.clearConsultantMaster();
  await vite?.close();
});

test('both sample attendance workbooks parse into consistent aggregate models', async () => {
  const cases = [
    ['documents/지출처리 메뉴/4.(혁신)(진로컨설팅) 출석부(26.10).xlsx', careerParser.parseCareerBudgetWorkbook],
    ['documents/지출처리 메뉴/4.(혁신)(취업컨설팅) 출석부(26.10).xlsx', employmentParser.parseEmploymentBudgetWorkbook],
  ];
  for (const [path, parse] of cases) {
    const model = parse(await readFile(path), path);
    assert.ok(model.period?.year && model.period?.month);
    const interview = model.interviewBlocks || [];
    const korean = model.correctionBlocks?.korean || [];
    const english = model.correctionBlocks?.english || [];
    const all = [...interview, ...korean, ...english];
    assert.ok(all.length > 0, 'sample must produce consultant blocks');
    assert.ok(all.some((block) => block.sessionCount > 0), 'sample must contain sessions');
    assert.equal(model.summary.interviewSessions, interview.reduce((sum, b) => sum + b.sessionCount, 0));
    assert.equal(model.summary.correctionSessions, [...korean, ...english].reduce((sum, b) => sum + b.sessionCount, 0));
    assert.equal(model.summary.totalAmount, all.reduce((sum, b) => sum + b.amount, 0));
  }
});

test('fake consultant appears in previews and generated receipt documents', async () => {
  const block = { consultant: fakeProfile.name, displayName: fakeProfile.name, sessionCount: 2, rate: 70000, amount: 140000, days: [] };
  const model = { period: { year: 2026, month: 10 }, interviewBlocks: [block], correctionBlocks: { korean: [block], english: [] } };
  const fixtures = [
    [career.buildCareerReceiptItems, career.buildCareerReceiptDocument, 1],
    [employment.buildEmploymentReceiptItems, employment.buildEmploymentReceiptDocument, 2],
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(await readFile('src/assets/ewha-cdc-logo.png'));
  try {
    for (const [buildItems, buildDocument, expectedCount] of fixtures) {
      const items = buildItems(model);
      assert.equal(items.length, expectedCount);
      assert.ok(items.every((item) => item.profile?.name === fakeProfile.name && !item.missingProfile));
      assert.ok(items[0].accountText.includes(fakeProfile.account));
      const buffer = await Packer.toBuffer(await buildDocument(model));
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file('word/document.xml').async('string');
      assert.ok(xml.includes(fakeProfile.name));
      assert.ok(xml.includes(fakeProfile.account));
      assert.ok(xml.includes('w:val="24"'), 'document should contain 12pt table text');
      assert.equal((xml.match(/<w:tbl>/g) || []).length, expectedCount);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
