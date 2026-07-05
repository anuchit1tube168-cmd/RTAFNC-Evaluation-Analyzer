/**
 * RTAFNC Parser QA v6 Override
 * Small override file to enforce v6 hard failures without replacing Parser_v5.gs.
 */

function pIsBadItemTextV6_(text) {
  const s = String(text == null ? '' : text).trim();
  if (!s) return true;
  if (/^(Q\s*\d+|Question\s*\d+|Column\s*\d+|คอลัมน์[_\s]*\d+)$/i.test(s)) return true;
  if (/^ข้อ\s*\d+(?:\.\d+)?$/i.test(s)) return true;
  if (/^\d+(?:\.\d+)?$/.test(s)) return true;
  if (s.length < 5) return true;
  return false;
}

function pBadItemListV6_(items) {
  return (items || []).filter(function (it) {
    return pIsBadItemTextV6_(it && it.text);
  });
}

function pRunQaGate_(a, groups) {
  a = a || {};
  groups = groups || [];
  const items = a.items || [];
  const respondents = a.respondents || [];
  const failures = [];
  const warnings = [];
  const badItems = pBadItemListV6_(items);

  if (!items.length) failures.push('ไม่พบข้อประเมิน');
  if (badItems.length) failures.push('มีหัวข้อประเมินที่ไม่ใช่ข้อความคำถามจริง เช่น Q1/Q2/คอลัมน์_4 จำนวน ' + badItems.length + ' ข้อ');
  if (!respondents.length) failures.push('ไม่พบผู้ตอบรายบุคคล');
  if (respondents.length && items.length && respondents.some(function (p) { return !(p.scores || []).length; })) failures.push('พบรายบุคคลที่ไม่มีคะแนนรายข้อ');
  if ((a.invalidCount || 0) > 0) failures.push('มีคะแนนนอกช่วง 1–5 จำนวน ' + a.invalidCount + ' ค่า');

  if (a.parseMode && a.parseMode !== 'wide') warnings.push('อ่านข้อมูลด้วยโหมด legacy — ต้องตรวจว่า Item_Dictionary มีคำถามจริงครบ');
  if ((a.duplicates || []).length > 0) warnings.push('พบผู้ตอบซ้ำ ' + a.duplicates.length + ' คีย์');

  function groupYear(g) { return g.def ? g.def.year : g.year; }
  function groupLabel(g) { return g.def ? g.def.label : g.label; }
  const invented = groups.filter(function (g) { return groupYear(g) && !g.hasData; }).map(groupLabel);
  if (invented.length) failures.push('พบรายงานแยกชั้นปีที่ไม่มี source/data: ' + invented.join(', '));

  return { status: failures.length ? 'REVIEW' : 'PASS', failures: failures, warnings: warnings };
}
