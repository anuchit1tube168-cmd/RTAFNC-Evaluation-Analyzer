/**
 * RTAFNC v6 SelfTest Override
 * This file intentionally defines selfTest_ again so ?action=selftest verifies v6 rules.
 */

function selfTest_() {
  const checks = [];
  function check(name, cond, detail) {
    checks.push({ name: name, pass: !!cond, detail: detail || '' });
  }

  try {
    // Good source-driven form: real question text + year source column.
    const header = ['เลขที่', 'รหัสนักศึกษา', 'ชื่อ', 'สกุล', 'ชั้นปี', '1.1 ตั้งใจเรียน', '1.2 ส่งงานตรงเวลา', 'ข้อเสนอแนะ'];
    const values = [
      header,
      [1, '6301', 'กชกร', 'ใจดี', 'ชั้นปีที่ 1', 5, 4, 'อาจารย์สอนดี'],
      [2, '6302', 'สมชาย', 'ดี', 'ปี 2', 4, 3, 'เวลาน้อยไป']
    ];
    const display = values.map(function (r) { return r.map(function (c) { return String(c); }); });
    const p = parseEvaluationMatrix_(values, display);
    check('v6 parser พบ matrix', p.found === true);
    check('v6 ใช้คำถามจริง', p.items[0].text === '1.1 ตั้งใจเรียน', p.items[0].text);
    check('v6 ชื่อไทยไม่แตก', p.respondents[0].name === 'กชกร ใจดี', p.respondents[0].name);

    const a = buildAnalysisFromParsed_('selftest.xlsx', { category: 'ทดสอบ', confidence: 1 }, 'Self Test', 'Sheet1', p, 'selftest.xlsx');
    const groups = buildSourceDrivenReportGroups_(a);
    check('v6 source-driven groups = รวม+ปี1+ปี2 เท่านั้น', groups.length === 3, groups.map(function (g) { return g.label; }).join(','));
    check('v6 ไม่สร้างปี 3/4 เมื่อไม่มี source', groups.every(function (g) { return g.key !== '3' && g.key !== '4'; }));

    const gateGood = pRunQaGate_(a, groups);
    check('v6 QA good case ไม่ REVIEW จาก Q1', gateGood.failures.filter(function (x) { return /Q1|คอลัมน์/.test(x); }).length === 0, JSON.stringify(gateGood));

    // Bad source: item header Q1/Q2 must be hard failure.
    const badHeader = ['เลขที่', 'ชื่อ', 'ชั้นปี', 'Q1', 'Q2'];
    const badValues = [badHeader, [1, 'ทดสอบ หนึ่ง', 'ปี 1', 5, 4]];
    const badDisplay = badValues.map(function (r) { return r.map(function (c) { return String(c); }); });
    const badP = parseEvaluationMatrix_(badValues, badDisplay);
    const badA = buildAnalysisFromParsed_('bad.xlsx', { category: 'ทดสอบ', confidence: 1 }, 'Bad Header Test', 'Sheet1', badP, 'bad.xlsx');
    const badGroups = buildSourceDrivenReportGroups_(badA);
    const badGate = pRunQaGate_(badA, badGroups);
    check('v6 Q1/Q2 เป็น hard failure', badGate.status === 'REVIEW' && badGate.failures.join(' ').indexOf('Q1') >= 0, JSON.stringify(badGate));

  } catch (err) {
    check('เกิดข้อผิดพลาดใน v6 selftest', false, String(err && err.stack ? err.stack : err));
  }

  const passed = checks.filter(function (c) { return c.pass; }).length;
  return {
    ok: true,
    action: 'selftest',
    version: 'v6-source-driven-reports',
    passed: passed,
    total: checks.length,
    allPass: passed === checks.length,
    checks: checks
  };
}
