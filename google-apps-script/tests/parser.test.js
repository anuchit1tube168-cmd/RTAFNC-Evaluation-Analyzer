/* Node test harness for Parser_v5.gs (pure logic) */
const P = require('../Parser_v5.gs');

let pass = 0, fail = 0;
function eq(name, got, exp) {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g === e) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n        got=' + g + '\n        exp=' + e); }
}
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

/* ---------- Case A: standard Google Forms export ---------- */
console.log('\nCase A — Forms export with numeric metadata traps');
const headerA = ['ประทับเวลา','อีเมล','เลขที่','รหัสนักศึกษา','ชื่อ','สกุล','ชั้นปี',
  '1.1 ตั้งใจเรียน','1.2 ส่งงานตรงเวลา','2.1 มีวินัย','ข้อเสนอแนะเพิ่มเติม'];
const dataA = [
  ['1/1/2025','a@x.com', 1,'6301','กชกร','ใจดี','ชั้นปีที่ 1', 5,4,5,'ดีมาก'],
  ['1/1/2025','b@x.com', 2,'6302','สมชาย','รักชาติ','ปี 1',     4,4,3,''],
  ['1/1/2025','c@x.com', 3,'6303','สมหญิง','เก่งกล้า','ชั้นปีที่ 2', 3,5,4,'เยี่ยม'],
  ['1/1/2025','a@x.com', 4,'6301','กชกร','ใจดี','ชั้นปีที่ 1', 5,5,5,'']
];
const valuesA = [headerA].concat(dataA);
const displayA = valuesA.map(r => r.map(c => String(c)));
const A = P.parseEvaluationMatrix_(valuesA, displayA);

ok('A.found', A.found === true);
eq('A.headerRowIndex', A.headerRowIndex, 0);
// เลขที่(1-4) และ รหัส ต้องไม่ถูกนับเป็นคะแนน -> คอลัมน์คะแนน = index 7,8,9 เท่านั้น
eq('A.scoreCols', A.columns.filter(c => c.role === 'score').map(c => c.index), [7,8,9]);
eq('A.item count', A.items.length, 3);
eq('A.item texts (real question text, not Q1)', A.items.map(i => i.text),
   ['1.1 ตั้งใจเรียน','1.2 ส่งงานตรงเวลา','2.1 มีวินัย']);
eq('A.item codes', A.items.map(i => i.code), ['1.1','1.2','2.1']);
eq('A.respondentCount', A.respondentCount, 4);
// itemStats
eq('A.item1 N/X/SD/level', [A.itemStats[0].n, A.itemStats[0].mean, A.itemStats[0].sd, A.itemStats[0].level],
   [4, 4.25, 0.96, 'มาก']);
eq('A.item2 N/X/SD/level', [A.itemStats[1].n, A.itemStats[1].mean, A.itemStats[1].sd, A.itemStats[1].level],
   [4, 4.5, 0.58, 'มาก']);
eq('A.item3 N/X/SD/level', [A.itemStats[2].n, A.itemStats[2].mean, A.itemStats[2].sd, A.itemStats[2].level],
   [4, 4.25, 0.96, 'มาก']);
eq('A.overallMean', Math.round((A.overallMean + Number.EPSILON) * 100) / 100, 4.33);
eq('A.invalidCount', A.invalidCount, 0);
// duplicate by id 6301 -> sheet rows 2 and 5
eq('A.duplicates', A.duplicates, [{ key: '6301', count: 2, rows: [2, 5] }]);
// years normalized
eq('A.years', A.years, [{ year: '1', count: 3 }, { year: '2', count: 1 }]);
// name joined + cleaned
eq('A.name row1', A.respondents[0].name, 'กชกร ใจดี');
ok('A.no fabricated rank', A.hasRankColumn === false && A.respondents.every(p => p.rank === ''));
// scoreRows aligned per person
eq('A.scoreRow1', A.scoreRows[0].scores, [5,4,5]);

/* ---------- Case B: out-of-range and zero handling ---------- */
console.log('\nCase B — out-of-range (7) invalid, zero = no-answer');
const headerB = ['ชื่อ','ชั้นปี','1.1 ก','1.2 ข','1.3 ค'];
const dataB = [
  ['ก','1', 5, 5, 4],
  ['ข','1', 4, 0, 3],  // 0 = no-answer (col 1.2)
  ['ค','1', 7, 5, 5],  // 7 = out-of-range (col 1.1)
  ['ง','1', 3, 4, 5]
];
const valuesB = [headerB].concat(dataB);
const displayB = valuesB.map(r => r.map(c => String(c)));
const B = P.parseEvaluationMatrix_(valuesB, displayB);
ok('B.found', B.found === true);
eq('B.invalidCount (only the 7)', B.invalidCount, 1);
eq('B.item1.1 N (7 excluded)', B.itemStats[0].n, 3);
eq('B.item1.2 N (0 excluded)', B.itemStats[1].n, 3);
eq('B.item1.3 N (all valid)', B.itemStats[2].n, 4);

/* ---------- Case C: legacy/summary sheet -> must NOT match ---------- */
console.log('\nCase C — summary sheet (items as rows) -> found=false, fall back to legacy');
const valuesC = [
  ['รายงานผลการประเมิน', '', ''],
  ['1.1 ตั้งใจเรียน', '', ''],
  ['1.2 ส่งงาน', '', '']
];
const displayC = valuesC.map(r => r.map(c => String(c)));
const C = P.parseEvaluationMatrix_(valuesC, displayC);
ok('C.found === false', C.found === false);

/* ---------- Case D: helpers ---------- */
console.log('\nCase D — helper functions');
eq('D.cleanThaiName collapses spaces', P.pCleanThaiName_('  กชกร   ใจดี '), 'กชกร ใจดี');
eq('D.normalizeYear ชั้นปีที่ 3', P.pNormalizeYear_('ชั้นปีที่ 3'), '3');
eq('D.normalizeYear ปี 4', P.pNormalizeYear_('ปี 4'), '4');
ok('D.isValidScore bounds', P.pIsValidScore_(1) && P.pIsValidScore_(5) && !P.pIsValidScore_(0) && !P.pIsValidScore_(6));

/* ---------- Case E: header not on first row ---------- */
console.log('\nCase E — header on row 3 (title rows above)');
const valuesE = [
  ['รายงานผลการประเมิน ปีการศึกษา 2568', '', '', ''],
  ['วิทยาลัยพยาบาลทหารอากาศ', '', '', ''],
  ['เลขที่','ชื่อ-สกุล','1.1 ก','1.2 ข'],
  [1,'สมชาย ใจดี', 5, 4],
  [2,'สมหญิง เก่ง', 4, 3]
];
const displayE = valuesE.map(r => r.map(c => String(c)));
const E = P.parseEvaluationMatrix_(valuesE, displayE);
ok('E.found', E.found === true);
eq('E.headerRowIndex', E.headerRowIndex, 2);
eq('E.scoreCols', E.columns.filter(c => c.role === 'score').map(c => c.index), [2,3]);
eq('E.respondentCount', E.respondentCount, 2);
eq('E.seq not counted as score', E.columns[0].role, 'seq');

console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
