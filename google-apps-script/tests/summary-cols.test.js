const P = require('../Parser_v5.gs');
let fail = 0;
const ok = (n, c) => { console.log((c ? '  ok  ' : '  FAIL ') + n); if (!c) fail++; };
const eq = (n, g, e) => ok(n + '  (got=' + JSON.stringify(g) + ')', JSON.stringify(g) === JSON.stringify(e));

// เลียนแบบหัวตารางไฟล์จริง: เลขที่, ชื่อ-สกุล, อีเมล, ชั้นปี, Q1..Q5 (มีข้อความจริง), ค่าเฉลี่ย, SD
const header = ['เลขที่','ชื่อ-สกุล','อีเมล','ชั้นปี',
  '1.1 ตั้งใจเรียน','1.2 ส่งงาน','2.1 มีวินัย','2.2 ตรงเวลา','3.1 รับผิดชอบ','ค่าเฉลี่ย','SD'];
const data = [
  [1,'กนกวรรณ เลี้ยงถนอม','','ชั้นปีที่ 1', 4,4,3,3,4, 3.60, 0.55],
  [2,'กรกนก บุญเฉลย','','ชั้นปีที่ 1', 5,5,3,4,4, 4.20, 0.84],
  [3,'กฤตเมธ ทองภักดี','','ชั้นปีที่ 2', 2,2,3,3,3, 2.60, 0.55]
];
const values = [header].concat(data);
const display = values.map(r => r.map(String));
const p = P.parseEvaluationMatrix_(values, display);

console.log('Real-like header with trailing ค่าเฉลี่ย/SD');
eq('score columns = 5 (Q only, NOT avg/SD)', p.columns.filter(c => c.role === 'score').map(c => c.header),
   ['1.1 ตั้งใจเรียน','1.2 ส่งงาน','2.1 มีวินัย','2.2 ตรงเวลา','3.1 รับผิดชอบ']);
eq('ค่าเฉลี่ย role = summary', p.columns.find(c => c.header === 'ค่าเฉลี่ย').role, 'summary');
eq('SD role = summary', p.columns.find(c => c.header === 'SD').role, 'summary');
eq('itemCount = 5 (not 7)', p.items.length, 5);
eq('respondent1 scores = 5 values (no 3.60/0.55)', p.respondents[0].scores, [4,4,3,3,4]);
// item1 stats over [4,5,2] mean=3.67
eq('item1 N/mean', [p.itemStats[0].n, p.itemStats[0].mean], [3, 3.67]);
eq('invalidCount = 0 (avg/SD not counted)', p.invalidCount, 0);

console.log(fail ? ('\nFAILED ' + fail) : '\nSUMMARY-COLUMN FIX OK');
process.exit(fail ? 1 : 0);
