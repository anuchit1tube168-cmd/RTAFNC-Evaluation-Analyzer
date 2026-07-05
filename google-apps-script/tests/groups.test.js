/* End-to-end sim of Phase 3/4/5 group logic from a real parsed sheet */
const P = require('../Parser_v5.gs');
let fail = 0;
const ok = (n, c) => { console.log((c ? '  ok  ' : '  FAIL ') + n); if (!c) fail++; };
const eq = (n, g, e) => ok(n + '  (got=' + JSON.stringify(g) + ')', JSON.stringify(g) === JSON.stringify(e));

const REPORT_GROUPS = [
  { key: 'รวม', label: 'รวมชั้นปีที่ 1-4', year: null },
  { key: '1', label: 'ชั้นปีที่ 1', year: '1' },
  { key: '2', label: 'ชั้นปีที่ 2', year: '2' },
  { key: '3', label: 'ชั้นปีที่ 3', year: '3' },
  { key: '4', label: 'ชั้นปีที่ 4', year: '4' }
];
function buildRecommendations(stats, ca, includeComments) {
  const out = [];
  const low = P.pLowestItems_(stats, 3);
  if (!low.length) { out.push('ยังไม่มีข้อมูลเพียงพอ'); return out; }
  low.forEach((s, i) => out.push((i + 1) + '. ควรพัฒนา/ปรับปรุง ' + P.pShortText_(s.code, s.text, 44) + '  (X = ' + s.mean.toFixed(2) + ', ระดับ ' + s.level + ')'));
  if (includeComments && ca && ca.total > 0 && ca.themes.length) out.push('ประเด็นเด่นจากข้อคิดเห็น: ' + ca.themes[0].theme);
  return out;
}

// สร้างชีตจริง: ปี1 x2, ปี2 x1 ; ปี3/4 ไม่มี
const header = ['เลขที่','รหัส','ชื่อ','ชั้นปี','1.1 ตั้งใจเรียน','1.2 ส่งงานตรงเวลา','2.1 มีวินัย','ข้อเสนอแนะ'];
const data = [
  [1,'6301','ก','ชั้นปีที่ 1', 5, 4, 2, 'อาจารย์สอนดีมาก'],
  [2,'6302','ข','ปี 1',       3, 3, 2, 'เวลากระชั้นไป'],
  [3,'6303','ค','ชั้นปีที่ 2', 5, 5, 5, 'ไม่มี']
];
const values = [header].concat(data);
const display = values.map(r => r.map(String));
const p = P.parseEvaluationMatrix_(values, display);
const items = p.items.map(it => ({ no: it.no, code: it.code, text: it.text, col: it.col }));
const a = { items: items, respondents: p.respondents };

const ca = P.pAnalyzeComments_(a.respondents);
const groups = REPORT_GROUPS.map(g => {
  const subset = g.year ? a.respondents.filter(r => r.year === g.year) : a.respondents;
  return { def: g, subset: subset, stats: P.pComputeItemStatsForRespondents_(a.items, subset), overall: P.pOverallStats_(subset), hasData: subset.length > 0 };
});

console.log('\nGroup membership');
eq('5 groups', groups.length, 5);
eq('รวม has 3', groups[0].subset.length, 3);
eq('ปี1 has 2', groups[1].subset.length, 2);
eq('ปี2 has 1', groups[2].subset.length, 1);
ok('ปี3 empty', groups[3].hasData === false);
ok('ปี4 empty', groups[4].hasData === false);

console.log('\nRecommendations from lowest items');
const recRuam = buildRecommendations(groups[0].stats, ca, true);
ok('รวม: first rec = lowest item 2.1', recRuam[0].indexOf('2.1') >= 0);
ok('รวม: includes comment theme line', recRuam.some(r => r.indexOf('ประเด็นเด่นจากข้อคิดเห็น') >= 0));
const recY1 = buildRecommendations(groups[1].stats, ca, false);
ok('ปี1: no comment line (year group)', recY1.every(r => r.indexOf('ประเด็นเด่น') < 0));
const recY3 = buildRecommendations(groups[3].stats, ca, false);
eq('ปี3 empty: fallback rec', recY3, ['ยังไม่มีข้อมูลเพียงพอ']);

console.log('\nQA year rows');
const yearRows = groups.filter(g => g.def.year !== null).map(g => [
  'รายงาน' + g.def.label, g.hasData ? 'PASS' : 'REVIEW',
  g.hasData ? (g.subset.length + ' คน') : 'ไม่มีข้อมูล (สร้างรายงานเปล่าพร้อมหมายเหตุ)'
]);
eq('ปี1 PASS', yearRows[0].slice(0, 2), ['รายงานชั้นปีที่ 1', 'PASS']);
eq('ปี3 REVIEW', yearRows[2].slice(0, 2), ['รายงานชั้นปีที่ 3', 'REVIEW']);
ok('all 4 year rows', yearRows.length === 4);

console.log('\nComments analysis');
eq('meaningful comments = 2 (ไม่มี excluded)', ca.total, 2);
ok('has time theme', ca.themes.some(t => t.theme === 'เวลา/ตารางเวลา'));

console.log('\nPDF count');
ok('exactly 5 PDFs would export', groups.length === 5);

console.log(fail ? ('\nFAILED ' + fail) : '\nALL GROUP LOGIC OK');
process.exit(fail ? 1 : 0);
