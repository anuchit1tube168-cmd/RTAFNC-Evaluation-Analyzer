/* Mirror of selfTest_() logic to confirm all checks pass in Node */
const P = require('../Parser_v5.gs');
const REPORT_GROUPS = [
  { key: 'รวม', label: 'รวมชั้นปีที่ 1-4', year: null },
  { key: '1', label: 'ชั้นปีที่ 1', year: '1' },
  { key: '2', label: 'ชั้นปีที่ 2', year: '2' },
  { key: '3', label: 'ชั้นปีที่ 3', year: '3' },
  { key: '4', label: 'ชั้นปีที่ 4', year: '4' }
];
const checks = [];
const check = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail || '' });

const header = ['เลขที่','รหัสนักศึกษา','ชื่อ','สกุล','ชั้นปี','1.1 ตั้งใจเรียน','1.2 ส่งงาน','ข้อเสนอแนะ'];
const data = [
  [1,'6301','กชกร','ใจดี','ชั้นปีที่ 1', 5,4,'อาจารย์สอนดีมาก'],
  [2,'6302','สมชาย','ดี','ปี 2', 4,3,'เวลาน้อยไป'],
  [3,'6301','กชกร','ใจดี','ชั้นปีที่ 1', 5,5,'ไม่มี']
];
const values = [header].concat(data);
const display = values.map(r => r.map(String));
const p = P.parseEvaluationMatrix_(values, display);
check('parser found', p.found === true);
check('score cols = 2', p.items.length === 2, 'items=' + p.items.length);
check('real text', p.items[0].text === '1.1 ตั้งใจเรียน');
check('respondents 3', p.respondentCount === 3);
check('duplicate', (p.duplicates || []).length === 1);
check('name cleaned', p.respondents[0].name === 'กชกร ใจดี');
check('years', p.years.length >= 2);
const ca = P.pAnalyzeComments_(p.respondents);
check('comments 2', ca.total === 2, 'total=' + ca.total);
const items = p.items.map(it => ({ no: it.no, code: it.code, text: it.text, col: it.col }));
const groups = REPORT_GROUPS.map(g => ({ def: g, hasData: (g.year ? p.respondents.filter(r => r.year === g.year) : p.respondents).length > 0 }));
const gate = P.pRunQaGate_({ items, respondents: p.respondents, invalidCount: p.invalidCount, duplicates: p.duplicates, parseMode: 'wide' }, groups);
check('gate runs', gate.status === 'PASS' || gate.status === 'REVIEW', gate.status);

const passed = checks.filter(c => c.pass).length;
checks.forEach(c => console.log((c.pass ? '  ok  ' : '  FAIL ') + c.name + (c.detail ? '  ('+c.detail+')' : '')));
console.log('\nself-test: ' + passed + '/' + checks.length + (passed === checks.length ? '  ALL PASS' : '  HAS FAIL'));
process.exit(passed === checks.length ? 0 : 1);
