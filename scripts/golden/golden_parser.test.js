/* Synthetic unit test for golden_parser (type 1: activity/club). PII-free. */
const P = require('./golden_parser.js');
let fail = 0;
const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); console.log((ok ? '  ok  ' : '  FAIL ') + n + '  got=' + JSON.stringify(g)); if (!ok) fail++; };

const wb = {
  '(ชมรมทดสอบ)': [
    ['แบบประเมินแผนกปกครอง'],
    ['ลำดับ', 'ชื่อ - สกุล', '', 'นพอ.ชั้นปีที่', 'ข้อ1', '2', 'X', 'SD'],
    [1, 'นพอ.', 'ก ข', '4', 5, 4, '', ''],
    [2, 'นพอ.', 'ค ง', '4', 3, 4, '', ''],
    [3, 'นพอ.', 'จ ฉ', '4', 4, 5, '', ''],
    ['ค่าเฉลี่ย']
  ],
  'ทดสอบ': [
    ['วิทยาลัยพยาบาลทหารอากาศ'],
    ['ผลการประเมินกิจกรรมทดสอบ'],
    ['เกณฑ์การประเมิน'],
    ['', '4.51 – 5.00'], ['', '3.51 – 4.50'], ['', '2.51 – 3.50'], ['', '1.51 – 2.50'], ['', '1.00 – 1.50'],
    ['', '', '', '', '', '', '', '', 'ประเมิน'],
    ['', '', '', '', '', '', '', '', 'X', 'SD'],
    ['1. คำถามหนึ่ง', '', '', '', '', '', '', '', 4, 1],
    ['2. คำถามสอง', '', '', '', '', '', '', '', 4.33, 0.58],
    ['รวม', '', '', '', '', '', '', '', 4.17, 0.75]
  ]
};

const res = P.parseGoldenActivity(wb);
eq('พบ 1 คู่', res.length, 1);
const r = res[0];
eq('ชื่อกิจกรรม', r.activity, 'ทดสอบ');
eq('ผู้ตอบ 3', r.respondents, 3);
eq('จำนวนข้อ 2', r.itemCount, 2);
eq('ข้อ1 X/SD (mean4, sampleSD1)', [r.items[0].X, r.items[0].SD], [4, 1]);
eq('ข้อ2 X/SD (mean4.33, SD0.58)', [r.items[1].X, r.items[1].SD], [4.33, 0.58]);
eq('ข้อความคำถามจริงจาก report', r.items[0].text, '1. คำถามหนึ่ง');
eq('ระดับข้อ1 = มาก', r.items[0].level, 'มาก');
// per-person means: 4.5, 3.5, 4.5 -> >=3.51: 2/3
eq('พึงพอใจ 66.67%', r.satisfactionPct, 66.67);
// computed matches embedded golden X/SD
eq('ข้อ1 ตรง golden ในไฟล์', [r.items[0].X === r.items[0].reportX, r.items[0].SD === r.items[0].reportSD], [true, true]);

console.log(fail ? ('\nFAILED ' + fail) : '\nGOLDEN PARSER (type1) OK');
process.exit(fail ? 1 : 0);
