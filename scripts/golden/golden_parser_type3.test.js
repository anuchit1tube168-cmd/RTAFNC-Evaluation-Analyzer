/* Synthetic unit test for golden_parser_type3 (type 3: identity งาม/สง่า). PII-free. */
const P = require('./golden_parser_type3.js');
let fail = 0;
const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); console.log((ok ? '  ok  ' : '  FAIL ') + n + '  got=' + JSON.stringify(g)); if (!ok) fail++; };

const wb = {
  // แหล่งข้อความคำถาม + มิติ (คั่นด้วยหัวข้อมิติ)
  'ข้อคำถาม': [
    ['ด้านงาม'],
    ['1', 'แต่งกายสะอาดเรียบร้อยถูกระเบียบ'],
    ['2', 'มีกิริยามารยาทงดงามอ่อนน้อม'],
    ['ด้านสง่า'],
    ['3', 'มีบุคลิกภาพสง่าผ่าเผยเชื่อมั่น'],
    ['4', 'วางตัวเหมาะสมมีภาวะผู้นำ']
  ],
  // ดิบ ปี 1 (4 ข้อ) — header แถว 2
  'ปี 1': [
    ['แบบประเมินอัตลักษณ์'],
    ['ลำดับที่', 'ยศ', 'ชื่อ - สกุล', 'อีเมล', '1', '2', '3', '4'],
    [1, 'นพอ.', 'ก', 'a@x', 5, 4, 5, 4],
    [2, 'นพอ.', 'ข', 'b@x', 4, 4, 4, 4],
    [3, 'นพอ.', 'ค', 'c@x', 5, 5, 4, 3],
    ['ค่าเฉลี่ย']
  ],
  // ดิบ ปี 2
  'ปี 2': [
    ['แบบประเมินอัตลักษณ์'],
    ['ลำดับที่', 'ยศ', 'ชื่อ - สกุล', 'อีเมล', '1', '2', '3', '4'],
    [1, 'นพอ.', 'ง', 'd@x', 3, 3, 4, 5],
    [2, 'นพอ.', 'จ', 'e@x', 4, 4, 4, 4],
    ['ค่าเฉลี่ย']
  ]
};

const res = P.parseGoldenIdentity(wb);
eq('parse ok', res.ok, true);
eq('4 คำถาม', res.questionCount, 4);
eq('2 ชั้นปี', res.yearCount, 2);
eq('ข้อ1 มิติ งาม', res.overall.items[0].dim, 'งาม');
eq('ข้อ3 มิติ สง่า', res.overall.items[2].dim, 'สง่า');
eq('ข้อความข้อ1 จาก ข้อคำถาม', res.overall.items[0].text, '1. แต่งกายสะอาดเรียบร้อยถูกระเบียบ');

// ปี 1 ข้อ1 = [5,4,5] mean 4.67 sampleSD 0.58
const y1 = res.years.find(y => /ปี\s*1/.test(y.label));
eq('ปี1 ผู้ตอบ 3', y1.respondents, 3);
eq('ปี1 ข้อ1 X/SD', [y1.items[0].X, y1.items[0].SD], [4.67, 0.58]);
// ปี1 byDim งาม = ข้อ1,2 = [5,4,5,4,4,5] mean 4.5
eq('ปี1 มิติงาม X', y1.byDim['งาม'].X, 4.5);
// ปี1 byDim สง่า = ข้อ3,4 = [5,4,4,4,3,-]? ข้อ3=[5,4,4] ข้อ4=[4,4,3] => [5,4,4,4,4,3] mean 4
eq('ปี1 มิติสง่า X', y1.byDim['สง่า'].X, 4);

// overall = ปี1(3)+ปี2(2) = 5 คน
eq('ภาพรวม ผู้ตอบ 5', res.overall.respondents, 5);
// overall ข้อ1 = ปี1[5,4,5]+ปี2[3,4] = [5,4,5,3,4] mean 4.2
eq('ภาพรวม ข้อ1 X', res.overall.items[0].X, 4.2);

// satisfaction ภาพรวม: personal means all >=3.51? ปี1: 4.5,4,4.25 ; ปี2: (3+3+4+5)/4=3.75, 4 -> ทั้งหมด>=3.51 = 5/5 =100
eq('ภาพรวม พึงพอใจ 100%', res.overall.satisfactionPct, 100);

console.log(fail ? ('\nFAILED ' + fail) : '\nGOLDEN PARSER (type3) OK');
process.exit(fail ? 1 : 0);
