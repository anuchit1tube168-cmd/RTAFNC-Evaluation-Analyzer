/**
 * Golden-format parser — ประเภทที่ 3: ประเมินอัตลักษณ์ (งาม / สง่า) multi-dimension
 * ตาม docs/GOLDEN_OUTPUT_FORMAT.md §6ก
 *
 * ทำงานบน workbook = { sheetName: rows[][] }
 * - ข้อความคำถาม + มิติ (งาม/สง่า) อ่านจาก sheet `ข้อคำถาม`
 * - คะแนนดิบอ่านจาก sheet ราย ชั้นปี (`ปี 1`..`ปี4`) header แถว 2: ลำดับที่|ยศ|ชื่อ|อีเมล|1,2,3..
 * - ตารางรายข้อ = หลายมิติ: แต่ละข้อสังกัดมิติเดียว เติม X/SD ที่คอลัมน์ของมิตินั้น + โดยรวม + ระดับ
 *
 * สมมติฐานที่ต้องยืนยันกับไฟล์จริง (flag ไว้):
 *   มิติของแต่ละข้อกำหนดจาก sheet `ข้อคำถาม` — ใช้ "หัวข้อมิติ" (แถวที่เป็น งาม/สง่า)
 *   หรือคอลัมน์มิติ ถ้ามี; ถ้าไม่พบ ถือเป็นมิติเดียว
 *
 * pure logic — export ผ่าน module.exports (GAS มองข้าม)
 */

function t3Trim(v) { return String(v == null ? '' : v).trim(); }
function t3ToNum(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  var s = t3Trim(v);
  return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : NaN;
}
function t3IsScore(n) { return typeof n === 'number' && isFinite(n) && n >= 1 && n <= 5; }
function t3Mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
function t3SampleSD(a) {
  if (a.length < 2) return 0;
  var m = t3Mean(a);
  return Math.sqrt(a.reduce(function (s, v) { return s + Math.pow(v - m, 2); }, 0) / (a.length - 1));
}
function t3Round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function t3Level(m) {
  if (m >= 4.51) return 'มากที่สุด';
  if (m >= 3.51) return 'มาก';
  if (m >= 2.51) return 'ปานกลาง';
  if (m >= 1.51) return 'น้อย';
  return 'น้อยที่สุด';
}

/** ระบุมิติจากข้อความ (งาม / สง่า) */
function t3DimOf(text) {
  var s = t3Trim(text);
  if (/สง่า/.test(s)) return 'สง่า';
  if (/งาม/.test(s)) return 'งาม';
  return '';
}
/** แถวเป็น "หัวข้อมิติ" ไหม (สั้น + มีคำว่า งาม/สง่า + ไม่ใช่ข้อมีเลขนำ) */
function t3IsDimHeader(rowText) {
  var s = t3Trim(rowText);
  if (!s || /^\d/.test(s)) return false;
  return /^(ด้าน)?\s*(ความ)?(งาม|สง่า)/.test(s) && s.length <= 30;
}

/**
 * อ่าน sheet ข้อคำถาม → [{ no, text, dim }] เรียงตามลำดับข้อ
 * รองรับ: (ก) คอลัมน์มิติแยก  (ข) หัวข้อมิติคั่น section
 */
function t3ReadQuestions(rows) {
  // หา column ข้อความ (คอลัมน์ที่มีข้อความยาวที่สุดโดยเฉลี่ย) และ column เลขข้อ
  var out = [];
  var curDim = '';
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r] || [];
    // มองหาคอลัมน์มิติในแถว (เซลล์ที่เป็น งาม/สง่า ล้วน)
    var rowDimCell = '';
    for (var c = 0; c < row.length; c++) {
      var cell = t3Trim(row[c]);
      if (cell === 'งาม' || cell === 'สง่า' || cell === 'ด้านงาม' || cell === 'ด้านสง่า') rowDimCell = t3DimOf(cell);
    }
    // หา (เลขข้อ, ข้อความ) ในแถว
    var no = null, text = '';
    for (var c2 = 0; c2 < row.length; c2++) {
      var cell2 = t3Trim(row[c2]);
      if (no === null && /^\d+[.)]?$/.test(cell2)) { no = cell2.replace(/[.)]/g, ''); continue; }
      if (/[ก-๙]/.test(cell2) && cell2.length > text.length && !/^(งาม|สง่า|ด้าน)/.test(cell2)) text = cell2;
    }
    // ข้อความที่ขึ้นต้นด้วยเลข เช่น "1. ..." (เลขฝังในข้อความ)
    if (no === null) {
      var m = t3Trim(row.join(' ')).match(/^(\d+)[.\s]\s*(.+)/);
      if (m && /[ก-๙]/.test(m[2])) { no = m[1]; if (!text) text = t3Trim(row.find(function (x) { return /^\d+[.\s]/.test(t3Trim(x)); })) || (m[1] + '. ' + m[2]); }
    }
    if (t3IsDimHeader(row.join(' ')) && no === null) { curDim = t3DimOf(row.join(' ')); continue; }
    if (no !== null && text) {
      var dim = rowDimCell || t3DimOf(text) || curDim || '';
      out.push({ no: no, text: /^\d/.test(text) ? text : (no + '. ' + text), dim: dim });
    }
  }
  return out;
}

/** sheet ดิบ ราย ชั้นปี: header แถว 2 (index1), item cols = header เป็นเลข หลังคอลัมน์อีเมล */
function t3FindRawHeader(rows) {
  for (var r = 0; r < Math.min(rows.length, 4); r++) {
    var row = rows[r] || [];
    var hasKey = row.some(function (v) { var s = t3Trim(v); return s === 'ลำดับที่' || s === 'ลำดับ' || s === 'เลขที่'; });
    var itemCols = [];
    for (var c = 0; c < row.length; c++) { if (/^\d+$/.test(t3Trim(row[c]))) itemCols.push(c); }
    if (hasKey && itemCols.length >= 2) return { headRow: r, itemCols: itemCols };
  }
  return null;
}
function t3IsRawYearSheet(name, rows) {
  if (!t3FindRawHeader(rows)) return false;
  return /ปี\s*\d/.test(name) || true; // มี header ดิบก็พอ
}
/** อ่านคะแนนต่อข้อ + ค่าเฉลี่ยรายบุคคล จาก sheet ดิบ ชั้นปี */
function t3ReadRawScores(rows, nItems) {
  var hr = t3FindRawHeader(rows);
  if (!hr) return { perItem: [], perPersonMeans: [], respondents: 0 };
  var itemCols = hr.itemCols.slice();
  if (nItems && itemCols.length > nItems) itemCols = itemCols.slice(0, nItems);
  var perItem = itemCols.map(function () { return []; });
  var perPersonMeans = [];
  for (var r = hr.headRow + 1; r < rows.length; r++) {
    var a = t3Trim(rows[r][0]);
    if (a === 'ค่าเฉลี่ย' || a === 'SD' || a === 'รวม') break;
    var pv = [];
    itemCols.forEach(function (c, i) {
      var n = t3ToNum(rows[r][c]);
      if (t3IsScore(n)) { perItem[i].push(n); pv.push(n); }
    });
    if (pv.length) perPersonMeans.push(t3Mean(pv));
  }
  return { perItem: perItem, perPersonMeans: perPersonMeans, respondents: perPersonMeans.length };
}

/** รวมคะแนนหลาย ชั้นปี (สำหรับ ภาพรวม) */
function t3MergeScores(list, nItems) {
  var perItem = [], perPersonMeans = [];
  for (var i = 0; i < nItems; i++) perItem.push([]);
  list.forEach(function (rs) {
    rs.perItem.forEach(function (s, i) { if (i < nItems) s.forEach(function (v) { perItem[i].push(v); }); });
    rs.perPersonMeans.forEach(function (m) { perPersonMeans.push(m); });
  });
  return { perItem: perItem, perPersonMeans: perPersonMeans, respondents: perPersonMeans.length };
}

function t3BuildResult(label, questions, rawScores) {
  var items = questions.map(function (q, i) {
    var s = rawScores.perItem[i] || [];
    var mean = t3Mean(s);
    return { no: q.no, text: q.text, dim: q.dim, N: s.length,
             X: t3Round2(mean), SD: t3Round2(t3SampleSD(s)), level: t3Level(mean) };
  });
  var all = [];
  rawScores.perItem.forEach(function (s) { s.forEach(function (v) { all.push(v); }); });
  var byDim = {};
  ['งาม', 'สง่า'].forEach(function (d) {
    var vs = [];
    items.forEach(function (it, i) { if (it.dim === d) (rawScores.perItem[i] || []).forEach(function (v) { vs.push(v); }); });
    byDim[d] = { X: t3Round2(t3Mean(vs)), SD: t3Round2(t3SampleSD(vs)), N: vs.length };
  });
  var pct = rawScores.perPersonMeans.length
    ? t3Round2(100 * rawScores.perPersonMeans.filter(function (m) { return m >= 3.51; }).length / rawScores.perPersonMeans.length) : 0;
  return {
    label: label, respondents: rawScores.respondents, itemCount: items.length,
    items: items, byDim: byDim,
    total: { X: t3Round2(t3Mean(all)), SD: t3Round2(t3SampleSD(all)), level: t3Level(t3Mean(all)) },
    satisfactionPct: pct
  };
}

function parseGoldenIdentity(workbook) {
  var names = Object.keys(workbook);
  var qSheet = names.find(function (n) { return /ข้อคำถาม/.test(n); });
  if (!qSheet) return { ok: false, error: 'ไม่พบ sheet ข้อคำถาม (แหล่งข้อความคำถามอัตลักษณ์)' };
  var questions = t3ReadQuestions(workbook[qSheet]);
  if (!questions.length) return { ok: false, error: 'sheet ข้อคำถาม ว่าง/อ่านไม่ได้' };

  var yearSheets = names.filter(function (n) { return n !== qSheet && t3FindRawHeader(workbook[n]) && /ปี\s*\d/.test(n); });
  var perYear = yearSheets.map(function (n) {
    return { label: n, rs: t3ReadRawScores(workbook[n], questions.length) };
  });
  var overall = t3BuildResult('ภาพรวมทุกชั้นปี', questions, t3MergeScores(perYear.map(function (y) { return y.rs; }), questions.length));
  var years = perYear.map(function (y) { return t3BuildResult(y.label, questions, y.rs); });
  return {
    ok: true, questionSheet: qSheet, dimensions: ['งาม', 'สง่า'],
    questionCount: questions.length, yearCount: years.length,
    overall: overall, years: years
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseGoldenIdentity: parseGoldenIdentity,
    t3ReadQuestions: t3ReadQuestions, t3SampleSD: t3SampleSD, t3Mean: t3Mean, t3Round2: t3Round2, t3Level: t3Level
  };
}
