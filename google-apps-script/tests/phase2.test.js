/* Phase 2: Item_Dictionary short text + Individual_All_Items row building */
const P = require('../Parser_v5.gs');
let fail = 0;
const ok = (n, c) => { console.log((c ? '  ok  ' : '  FAIL ') + n); if (!c) fail++; };
const eq = (n, g, e) => ok(n + '  (got=' + JSON.stringify(g) + ')', JSON.stringify(g) === JSON.stringify(e));

console.log('\npShortText_');
eq('strips duplicate leading code', P.pShortText_('1.1', '1.1 สนใจ เอาใจใส่การเรียน การงาน หรือหน้าที่ที่ได้รับมอบหมาย', 20),
   '1.1 สนใจ เอาใจใส่การเรีย…');
eq('short text no code', P.pShortText_('', 'ความเห็นทั่วไป', 20), 'ความเห็นทั่วไป');
eq('keeps short text intact', P.pShortText_('2.1', '2.1 มีวินัย', 20), '2.1 มีวินัย');

console.log('\npPersonStats_');
eq('person all valid', P.pPersonStats_([5,4,5]), { n: 3, mean: 4.67, sd: 0.58, level: 'มากที่สุด' });
eq('person mixed blanks/invalid', P.pPersonStats_([5, '', null, 3]), { n: 2, mean: 4, sd: 1.41, level: 'มาก' });
eq('person single answer (sd 0, no #DIV/0)', P.pPersonStats_([4]), { n: 1, mean: 4, sd: 0, level: 'มาก' });
eq('person no answer', P.pPersonStats_(['', '']), { n: 0, mean: 0, sd: 0, level: '' });

/* Simulate Individual_All_Items row building from a parsed sheet */
console.log('\nIndividual_All_Items wiring');
const header = ['เลขที่','รหัสนักศึกษา','ชื่อ','สกุล','ชั้นปี','1.1 ตั้งใจเรียน','1.2 ส่งงานตรงเวลา','ข้อเสนอแนะ'];
const data = [
  [1,'6301','กชกร','ใจดี','ชั้นปีที่ 1', 5, 4, 'ดีมาก'],
  [2,'6302','สมชาย','ดี','ปี 2', 4, '', ''],       // ตอบข้อเดียว
  [3,'6303','สมหญิง','เก่ง','ชั้นปีที่ 3', 3, 5, 'เยี่ยม']
];
const values = [header].concat(data);
const display = values.map(r => r.map(String));
const p = P.parseEvaluationMatrix_(values, display);

// map เหมือน analyzeSheet_ wide branch
const items = p.items.map(it => ({ no: it.no, code: it.code, text: it.text, col: it.col }));
const a = { items: items, respondents: p.respondents };

const perItemHeaders = a.items.map(it => P.pShortText_(it.code, it.text, 22));
eq('per-item headers carry question text (not Q1)', perItemHeaders,
   ['1.1 ตั้งใจเรียน', '1.2 ส่งงานตรงเวลา']);

const nItems = a.items.length;
const rows = a.respondents.map((pp, i) => {
  const scores = [];
  for (let k = 0; k < nItems; k++) { const v = pp.scores ? pp.scores[k] : ''; scores.push(P.pIsValidScore_(v) ? v : ''); }
  const st = P.pPersonStats_(pp.scores || []);
  return [i + 1, pp.id || pp.seq || '', pp.name || '', pp.year || '']
    .concat(scores).concat([st.n ? st.mean : '', st.n ? st.sd : '', st.level, pp.comment || '']);
});
ok('3 respondent rows', rows.length === 3);
eq('row1 = seq/id/name/year + scores + X/SD/level/comment',
   rows[0], [1, '6301', 'กชกร ใจดี', '1', 5, 4, 4.5, 0.71, 'มาก', 'ดีมาก']);
eq('row2 single answer: score aligned, sd=0, blank item kept',
   rows[1], [2, '6302', 'สมชาย ดี', '2', 4, '', 4, 0, 'มาก', '']);
ok('every row width = 4 + nItems + 4', rows.every(r => r.length === 4 + nItems + 4));

console.log(fail ? ('\nFAILED ' + fail) : '\nALL PHASE 2 OK');
process.exit(fail ? 1 : 0);
