const P = require('../Parser_v5.gs');
let fail = 0;
const ok = (n, c) => { console.log((c ? '  ok  ' : '  FAIL ') + n); if (!c) fail++; };
const eq = (n, g, e) => ok(n + '  (got=' + JSON.stringify(g) + ')', JSON.stringify(g) === JSON.stringify(e));

const items = [
  { no: '1.1', code: '1.1', text: '1.1 ตั้งใจเรียน', col: 6 },
  { no: '1.2', code: '1.2', text: '1.2 ส่งงาน', col: 7 },
  { no: '2.1', code: '2.1', text: '2.1 มีวินัย', col: 8 }
];
const R = [
  { name: 'ก', year: '1', comment: 'อาจารย์สอนดีมาก', scores: [5, 4, 3] },
  { name: 'ข', year: '1', comment: 'เวลาน้อยไป',     scores: [2, 3, 2] },
  { name: 'ค', year: '2', comment: '-',              scores: [5, 5, 5] },
  { name: 'ง', year: '2', comment: 'ไม่มี',          scores: [4, 4, 4] }
];

console.log('\nPer-year item stats (year 1)');
const y1 = R.filter(r => r.year === '1');
const s1 = P.pComputeItemStatsForRespondents_(items, y1);
eq('item1.1 [5,2]', [s1[0].n, s1[0].mean, s1[0].sd, s1[0].level], [2, 3.5, 2.12, 'ปานกลาง']);
eq('item2.1 [3,2]', [s1[2].n, s1[2].mean, s1[2].sd, s1[2].level], [2, 2.5, 0.71, 'น้อย']);

console.log('\nOverall stats');
eq('overall year1', (function(){const o=P.pOverallStats_(y1);return [o.respondents,o.n,o.mean,o.level];})(), [2, 6, 3.17, 'ปานกลาง']);
eq('overall all 4', (function(){const o=P.pOverallStats_(R);return [o.respondents,o.n,o.mean];})(), [4, 12, 3.83]);

console.log('\nEmpty group (year 3 has no data)');
const y3 = R.filter(r => r.year === '3');
const s3 = P.pComputeItemStatsForRespondents_(items, y3);
eq('empty stats item1', [s3[0].n, s3[0].mean, s3[0].level], [0, 0, '']);
eq('empty overall', (function(){const o=P.pOverallStats_(y3);return [o.respondents,o.n,o.level];})(), [0, 0, '']);

console.log('\nLowest items (recommendations source)');
const low = P.pLowestItems_(s1, 2);
eq('lowest first = item 2.1 (mean 2.5)', [low[0].no, low[0].mean], ['2.1', 2.5]);
ok('lowest count = 2', low.length === 2);
ok('lowest sorted ascending', low[0].mean <= low[1].mean);

console.log('\nComment themes');
const ca = P.pAnalyzeComments_(R);
eq('meaningful total (trivial - and ไม่มี excluded)', ca.total, 2);
ok('two themes present', ca.themes.length === 2);
ok('time comment -> communication theme', ca.themes.some(t => t.theme === 'การสื่อสาร/การรับฟัง'));
eq('each theme 50%', ca.themes.map(t => t.percent), [50, 50]);
ok('example text kept', ca.themes[0].examples.length >= 1);
ok('meaningful filter: "-" false', P.pIsMeaningfulComment_('-') === false);
ok('meaningful filter: real true', P.pIsMeaningfulComment_('เวลาน้อยไป') === true);

console.log(fail ? ('\nFAILED ' + fail) : '\nALL PHASE 3-5 HELPERS OK');
process.exit(fail ? 1 : 0);
