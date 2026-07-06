/**
 * Golden-format parser — ประเภทที่ 2: ประเมินผู้สอนรายบุคคล/รายวิชา (ทหาร)
 * ตาม docs/GOLDEN_OUTPUT_FORMAT.md §6
 *
 * ทำงานบน workbook = { sheetName: rows[][] } (แบบเดียวกับ Type 1)
 * จับคู่ "sheet ดิบรายผู้สอน" (คะแนน ข้อ1..n) กับ "sheet รายงานรายผู้สอน" (ข้อความคำถาม + X/SD)
 * โดย "จับคู่ตามชื่ออาจารย์" (ไม่ใช่ตามลำดับ) เพราะดิบ/รายงานอาจมาคนละไฟล์รวมกัน
 *
 * pure logic — export ผ่าน module.exports (GAS มองข้าม)
 */

function t2Trim(v) { return String(v == null ? '' : v).trim(); }
function t2ToNum(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  var s = t2Trim(v);
  return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : NaN;
}
function t2IsScore(n) { return typeof n === 'number' && isFinite(n) && n >= 1 && n <= 5; }
function t2Mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
function t2SampleSD(a) {
  if (a.length < 2) return 0;
  var m = t2Mean(a);
  return Math.sqrt(a.reduce(function (s, v) { return s + Math.pow(v - m, 2); }, 0) / (a.length - 1));
}
function t2Round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function t2Level(m) {
  if (m >= 4.51) return 'มากที่สุด';
  if (m >= 3.51) return 'มาก';
  if (m >= 2.51) return 'ปานกลาง';
  if (m >= 1.51) return 'น้อย';
  return 'น้อยที่สุด';
}

/** normalize ชื่ออาจารย์เพื่อจับคู่ข้ามไฟล์ (ตัดยศ/คำนำหน้า + ช่องว่าง) */
var T2_RANKS = ['น.อ.', 'น.ท.', 'น.ต.', 'ร.อ.', 'ร.ท.', 'ร.ต.', 'พ.อ.', 'พ.ท.', 'พ.ต.',
  'จ.อ.', 'จ.ท.', 'จ.ต.', 'พ.อ.อ.', 'พ.อ.ท.', 'พ.อ.ต.', 'นาวาอากาศเอก', 'นาวาอากาศโท',
  'นาวาอากาศตรี', 'เรืออากาศเอก', 'เรืออากาศโท', 'เรืออากาศตรี', 'นพอ.', 'ดร.', 'อาจารย์'];
function t2NormName(s) {
  var x = t2Trim(s).replace(/^ชื่ออาจารย์\s*/, '');
  T2_RANKS.forEach(function (r) { x = x.split(r).join(''); });
  return x.replace(/[\s().]/g, '');
}

/** sheet รายงานรายผู้สอน: มีบรรทัด 'ชื่ออาจารย์' + header 'ข้อมูลเกี่ยวกับการเรียนการสอน' + x/SD */
function t2FindReportHeader(rows) {
  var xCol = -1, sdCol = -1, headRow = -1;
  for (var r = 0; r < Math.min(rows.length, 20); r++) {
    var row = rows[r] || [];
    for (var c = 0; c < row.length; c++) {
      var v = t2Trim(row[c]).toUpperCase();
      if (v === 'X') { xCol = c; headRow = r; }
      if (v === 'SD' && headRow === r) sdCol = c;
    }
    if (xCol >= 0 && sdCol >= 0) return { xCol: xCol, sdCol: sdCol, headRow: headRow };
  }
  return null;
}
function t2GetInstructorName(rows) {
  for (var r = 0; r < Math.min(rows.length, 12); r++) {
    var row = rows[r] || [];
    for (var c = 0; c < row.length; c++) {
      var v = t2Trim(row[c]);
      if (/^ชื่ออาจารย์/.test(v)) return v.replace(/^ชื่ออาจารย์\s*/, '');
    }
  }
  return '';
}
function t2IsReportSheet(rows) {
  if (!t2GetInstructorName(rows)) return false;
  return !!t2FindReportHeader(rows);
}
/** อ่าน item text + X/SD (golden) จาก sheet รายงานรายผู้สอน */
function t2ReadReportItems(rows) {
  var h = t2FindReportHeader(rows);
  if (!h) return { items: [], total: null };
  var items = [], total = null;
  for (var r = h.headRow + 1; r < rows.length; r++) {
    var a = t2Trim(rows[r][0]);
    if (!a) continue;
    var X = t2ToNum(rows[r][h.xCol]), SD = t2ToNum(rows[r][h.sdCol]);
    if (a === 'รวม' || a === 'ค่าเฉลี่ยรวม') { total = { X: X, SD: SD }; break; }
    if (/^\d+[.\s]/.test(a)) items.push({ no: a.match(/^(\d+)/)[1], text: a, reportX: X, reportSD: SD });
  }
  return { items: items, total: total };
}

/** sheet ดิบรายผู้สอน: header (แถว 1 หรือ 2) มี 'เลขที่'/'ลำดับ' + คอลัมน์ข้อ (ข้อ1/1/..) เป็นเลข */
function t2FindRawHeaderRow(rows) {
  for (var r = 0; r < Math.min(rows.length, 4); r++) {
    var row = rows[r] || [];
    var hasKey = row.some(function (v) { var s = t2Trim(v); return s === 'เลขที่' || s === 'ลำดับ' || s === 'ลำดับที่'; });
    var itemCols = t2ItemColsFromHeader(row);
    if (hasKey && itemCols.length >= 2) return { headRow: r, itemCols: itemCols };
  }
  return null;
}
function t2ItemColsFromHeader(row) {
  var cols = [];
  for (var c = 0; c < row.length; c++) {
    var s = t2Trim(row[c]);
    if (/^ข้อ\s*\d+$/.test(s) || /^\d+$/.test(s)) cols.push(c);
  }
  return cols;
}
function t2IsRawSheet(rows) { return !!t2FindRawHeaderRow(rows) && !t2IsReportSheet(rows); }

/** อ่านคะแนนดิบต่อข้อ (แต่ละแถว = นักเรียน 1 คนให้คะแนนอาจารย์คนนี้) */
function t2ReadRawScores(rows, nItems) {
  var hr = t2FindRawHeaderRow(rows);
  if (!hr) return { perItem: [], perPersonMeans: [], respondents: 0 };
  var itemCols = hr.itemCols.slice();
  if (nItems && itemCols.length > nItems) itemCols = itemCols.slice(0, nItems);
  var perItem = itemCols.map(function () { return []; });
  var perPersonMeans = [];
  for (var r = hr.headRow + 1; r < rows.length; r++) {
    var a = t2Trim(rows[r][0]);
    if (a === 'ค่าเฉลี่ย' || a === 'SD' || a === 'รวม') break;
    var pv = [];
    itemCols.forEach(function (c, i) {
      var n = t2ToNum(rows[r][c]);
      if (t2IsScore(n)) { perItem[i].push(n); pv.push(n); }
    });
    if (pv.length) perPersonMeans.push(t2Mean(pv));
  }
  return { perItem: perItem, perPersonMeans: perPersonMeans, respondents: perPersonMeans.length };
}

/** จับคู่ report+raw ตามชื่ออาจารย์ แล้วประมวลผล */
function parseGoldenInstructor(workbook) {
  var names = Object.keys(workbook);
  var reports = [], raws = [];
  names.forEach(function (nm) {
    var rows = workbook[nm];
    if (t2IsReportSheet(rows)) reports.push({ sheet: nm, rows: rows, key: t2NormName(t2GetInstructorName(rows)) });
    else if (t2IsRawSheet(rows)) raws.push({ sheet: nm, rows: rows, key: t2NormName(nm) });
  });
  var rawByKey = {};
  raws.forEach(function (x) { if (!(x.key in rawByKey)) rawByKey[x.key] = x; });

  return reports.map(function (rep) {
    var repItems = t2ReadReportItems(rep.rows);
    var raw = rawByKey[rep.key];
    var rawScores = raw ? t2ReadRawScores(raw.rows, repItems.items.length)
      : { perItem: [], perPersonMeans: [], respondents: 0 };
    var items = repItems.items.map(function (it, i) {
      var s = rawScores.perItem[i] || [];
      var mean = t2Mean(s);
      return { no: it.no, text: it.text, N: s.length, X: t2Round2(mean), SD: t2Round2(t2SampleSD(s)), level: t2Level(mean),
               reportX: t2Round2(it.reportX), reportSD: t2Round2(it.reportSD) };
    });
    var all = [];
    rawScores.perItem.forEach(function (s) { s.forEach(function (v) { all.push(v); }); });
    var pct = rawScores.perPersonMeans.length
      ? t2Round2(100 * rawScores.perPersonMeans.filter(function (m) { return m >= 3.51; }).length / rawScores.perPersonMeans.length) : 0;
    return {
      instructor: t2GetInstructorName(rep.rows), reportSheet: rep.sheet, rawSheet: raw ? raw.sheet : null,
      matched: !!raw, respondents: rawScores.respondents, itemCount: items.length,
      unit: 'วิทยาลัยพยาบาลทหารอากาศ', title: t2Trim(rep.rows[0] && rep.rows[0][0]),
      items: items,
      total: { X: t2Round2(t2Mean(all)), SD: t2Round2(t2SampleSD(all)),
               reportX: repItems.total ? t2Round2(repItems.total.X) : null, reportSD: repItems.total ? t2Round2(repItems.total.SD) : null },
      satisfactionPct: pct
    };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseGoldenInstructor: parseGoldenInstructor,
    t2NormName: t2NormName, t2SampleSD: t2SampleSD, t2Mean: t2Mean, t2Round2: t2Round2,
    t2IsReportSheet: t2IsReportSheet, t2IsRawSheet: t2IsRawSheet
  };
}
