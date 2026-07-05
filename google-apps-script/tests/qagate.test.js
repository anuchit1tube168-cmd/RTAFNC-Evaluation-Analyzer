const P = require('../Parser_v5.gs');
let fail = 0;
const ok = (n, c) => { console.log((c ? '  ok  ' : '  FAIL ') + n); if (!c) fail++; };
const eq = (n, g, e) => ok(n + '  (got=' + JSON.stringify(g) + ')', JSON.stringify(g) === JSON.stringify(e));

const goodItems = [{ no: '1.1', text: '1.1 ตั้งใจเรียน' }, { no: '1.2', text: '1.2 ส่งงาน' }];
const goodResp = [{ scores: [5, 4] }, { scores: [4, 3] }];
// groupsMeta flat shape (from processOneFile_): รวม + ปี1-4, ปี3/4 empty
const metaGroups = [
  { year: null, hasData: true, label: 'รวมชั้นปีที่ 1-4' },
  { year: '1', hasData: true, label: 'ชั้นปีที่ 1' },
  { year: '2', hasData: true, label: 'ชั้นปีที่ 2' },
  { year: '3', hasData: false, label: 'ชั้นปีที่ 3' },
  { year: '4', hasData: false, label: 'ชั้นปีที่ 4' }
];
// internal shape (from writeQa_): g.def.year
const internalGroups = metaGroups.map(g => ({ def: { year: g.year, label: g.label }, hasData: g.hasData }));

console.log('\nHappy path (PASS, warnings for empty years)');
const g1 = P.pRunQaGate_({ items: goodItems, respondents: goodResp, invalidCount: 0, duplicates: [], parseMode: 'wide' }, metaGroups);
eq('status PASS', g1.status, 'PASS');
eq('no failures', g1.failures, []);
ok('warns empty years 3,4', g1.warnings.some(w => w.indexOf('ชั้นปีที่ 3') >= 0 && w.indexOf('ชั้นปีที่ 4') >= 0));

console.log('\nInternal group shape works too');
const g1b = P.pRunQaGate_({ items: goodItems, respondents: goodResp, invalidCount: 0, parseMode: 'wide' }, internalGroups);
eq('status PASS (internal shape)', g1b.status, 'PASS');
ok('empty-year warning via g.def', g1b.warnings.some(w => w.indexOf('ชั้นปีที่ 3') >= 0));

console.log('\nHard failures -> REVIEW');
eq('no items', P.pRunQaGate_({ items: [], respondents: goodResp }, metaGroups).status, 'REVIEW');
eq('no respondents', P.pRunQaGate_({ items: goodItems, respondents: [] }, metaGroups).status, 'REVIEW');
eq('bad question text (Q1)', P.pRunQaGate_({ items: [{ no: '1', text: 'Q' }], respondents: goodResp }, metaGroups).status, 'REVIEW');
eq('invalid scores', P.pRunQaGate_({ items: goodItems, respondents: goodResp, invalidCount: 3 }, metaGroups).status, 'REVIEW');
eq('groups != 5', P.pRunQaGate_({ items: goodItems, respondents: goodResp, invalidCount: 0 }, metaGroups.slice(0, 3)).status, 'REVIEW');

console.log('\nlegacy mode = warning not failure');
const g2 = P.pRunQaGate_({ items: goodItems, respondents: goodResp, invalidCount: 0, parseMode: 'legacy' }, metaGroups);
eq('legacy still PASS', g2.status, 'PASS');
ok('legacy warned', g2.warnings.some(w => w.indexOf('legacy') >= 0));

console.log('\nduplicates = warning', );
const g3 = P.pRunQaGate_({ items: goodItems, respondents: goodResp, invalidCount: 0, duplicates: [{ key: '6301', count: 2 }], parseMode: 'wide' }, metaGroups);
eq('dup still PASS', g3.status, 'PASS');
ok('dup warned', g3.warnings.some(w => w.indexOf('ซ้ำ') >= 0));

console.log(fail ? ('\nFAILED ' + fail) : '\nALL QA GATE OK');
process.exit(fail ? 1 : 0);
