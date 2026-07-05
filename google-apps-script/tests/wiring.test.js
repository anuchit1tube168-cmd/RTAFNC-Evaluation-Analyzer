/* Verify the analyzeSheet_ wide-branch mapping produces shapes the write* fns expect */
const P = require('../Parser_v5.gs');
let fail = 0;
const ok = (n, c) => { console.log((c ? '  ok  ' : '  FAIL ') + n); if (!c) fail++; };

const header = ['ประทับเวลา','เลขที่','รหัสนักศึกษา','ชื่อ','สกุล','ชั้นปี','1.1 ตั้งใจเรียน','1.2 ส่งงาน'];
const data = [
  ['t',1,'6301','กชกร','ใจดี','ชั้นปีที่ 1',5,4],
  ['t',2,'6302','สมชาย','ดี','ปี 2',4,3],
  ['t',3,'6301','กชกร','ใจดี','ชั้นปีที่ 1',5,5]
];
const values = [header].concat(data);
const display = values.map(r => r.map(String));
const p = P.parseEvaluationMatrix_(values, display);

// --- replicate analyzeSheet_ wide mapping ---
const a = {
  items: p.items.map(it => ({ no: it.no, text: it.text, row: it.col + 1 })),
  itemStats: p.itemStats.map(x => ({ no: x.no, text: x.text, row: x.col + 1, n: x.n, mean: x.mean, sd: x.sd, level: x.level })),
  scoreRows: p.scoreRows,
  overallMean: p.overallMean, overallSd: p.overallSd, invalidCount: p.invalidCount,
  parseMode: 'wide', sheetName: 'Form Responses 1',
  respondentCount: p.respondentCount, duplicates: p.duplicates, years: p.years,
  confidence: 0.9, category: 'นภาภิบาล'
};

// --- writeItems_ mapping: [i+1,x.no,x.text,x.n,x.mean,x.sd,x.level,x.row] ---
const itemRows = a.itemStats.map((x,i)=>[i+1,x.no,x.text,x.n,x.mean,x.sd,x.level,x.row]);
ok('writeItems row width = 8', itemRows.every(r => r.length === 8));
ok('writeItems has real question text', itemRows[0][2] === '1.1 ตั้งใจเรียน');
ok('writeItems no undefined', itemRows.flat().every(v => v !== undefined));

// --- writeScoreRows_ max/width logic ---
const max = Math.max(0, ...a.scoreRows.map(r=>r.scores.length));
ok('scoreRows max cols = 2', max === 2);
const built = a.scoreRows.map(r=>{ const arr=[r.row,r.label].concat(r.scores); while(arr.length<2+max) arr.push(''); arr.push('','',''); return arr; });
ok('scoreRows built width consistent', built.every(r => r.length === 2+max+3));
ok('scoreRows label uses name', a.scoreRows[0].label === 'กชกร ใจดี');

// --- writePrint_ slice(0,30) ---
const printRows = a.itemStats.slice(0,30).map((x,i)=>[i+1,x.no,x.text,x.n,x.mean,x.sd,x.level,'']);
ok('printRows width = 8', printRows.every(r => r.length === 8));

// --- writeQa_ new logic doesn't throw & flags duplicate ---
const dupCount = (a.duplicates||[]).length;
ok('QA detects duplicate (6301 twice)', dupCount === 1);
ok('QA every item text length>=3 -> PASS', a.items.every(it => String(it.text||'').trim().length >= 3));
const yearDetail = a.years.map(y=>'ปี'+y.year+'='+y.count).join(', ');
ok('QA year detail built', yearDetail === 'ปี1=2, ปี2=1');

// --- Cover/Executive use a.items.length, round of overallMean ---
ok('items.length = 2', a.items.length === 2);
ok('respondentCount = 3', a.respondentCount === 3);

console.log(fail ? ('\nFAILED ' + fail) : '\nALL WIRING OK');
process.exit(fail ? 1 : 0);
