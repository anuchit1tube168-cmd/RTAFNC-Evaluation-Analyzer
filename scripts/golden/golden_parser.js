/**
 * Golden-format parser — reference implementation (Node, portable to Apps Script)
 * ตาม docs/GOLDEN_OUTPUT_FORMAT.md §9
 *
 * ทำงานบน workbook = { sheetName: rows[][] } (แบบเดียวกับ GAS ss.getSheets()->getValues())
 * ประเภทที่ 1: กิจกรรม/ชมรม (คู่ sheet ดิบ "(ชมรมX)" + sheet รายงาน "X")
 *
 * pure logic — export ผ่าน module.exports (GAS มองข้าม)
 */

function gTrim(v) { return String(v == null ? '' : v).trim(); }
function gToNum(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  var s = gTrim(v);
  return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : NaN;
}
function gIsScore(n) { return typeof n === 'number' && isFinite(n) && n >= 1 && n <= 5; }
function gMean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
function gSampleSD(a) {
  if (a.length < 2) return 0;
  var m = gMean(a);
  return Math.sqrt(a.reduce(function (s, v) { return s + Math.pow(v - m, 2); }, 0) / (a.length - 1));
}
function gRound2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function gLevel(m) {
  if (m >= 4.51) return 'มากที่สุด';
  if (m >= 3.51) return 'มาก';
  if (m >= 2.51) return 'ปานกลาง';
  if (m >= 1.51) return 'น้อย';
  return 'น้อยที่สุด';
}

/** sheet ดิบ = ชื่อขึ้นต้น "(ชมรม" / "ชมรม" / วงเล็บ หรือ row1 = 'แบบประเมินแผนกปกครอง' */
function gIsRawSheet(name, rows) {
  if (/^\s*\(/.test(name) || /ชมรม/.test(name)) return true;
  return gTrim(rows && rows[0] && rows[0][0]) === 'แบบประเมินแผนกปกครอง';
}

/**
 * จับคู่ sheet ดิบกับ sheet รายงาน "ตามลำดับที่อยู่ติดกัน" (ดิบมาก่อนรายงานเสมอ)
 * robust ต่อการสะกดชื่อไม่ตรง (แบด/แบท) และวงเล็บหาย (ชมรมกีฑา)
 */
function gFindActivityPairs(workbook) {
  var names = Object.keys(workbook);
  var pairs = [];
  for (var i = 0; i < names.length - 1; i++) {
    if (gIsRawSheet(names[i], workbook[names[i]]) && !gIsRawSheet(names[i + 1], workbook[names[i + 1]])) {
      pairs.push({ raw: names[i], report: names[i + 1] });
      i++; // ข้าม report ที่จับคู่แล้ว
    }
  }
  return pairs;
}

/** อ่าน item text + ตำแหน่ง X/SD จาก sheet รายงาน (ข้อความคำถามจริงอยู่ที่นี่) */
function gReadReportItems(rows) {
  // หา header X/SD row: แถวที่มี 'X' และ 'SD' (คอลัมน์สถิติ)
  var xCol = -1, sdCol = -1, headRow = -1;
  for (var r = 0; r < Math.min(rows.length, 15); r++) {
    for (var c = 0; c < rows[r].length; c++) {
      var t = gTrim(rows[r][c]);
      if (t === 'X') { xCol = c; headRow = r; }
      if (t === 'SD' && headRow === r) sdCol = c;
    }
    if (xCol >= 0 && sdCol >= 0) break;
  }
  // item rows: ตั้งแต่ headRow+1 จน col A == 'รวม'
  var items = [], total = null;
  for (var r2 = headRow + 1; r2 < rows.length; r2++) {
    var a = gTrim(rows[r2][0]);
    if (!a) continue;
    var X = gToNum(rows[r2][xCol]), SD = gToNum(rows[r2][sdCol]);
    if (a === 'รวม' || a === 'ค่าเฉลี่ยรวม') { total = { X: X, SD: SD }; break; }
    if (/^\d+[.\s]/.test(a)) items.push({ no: a.match(/^(\d+)/)[1], text: a, reportX: X, reportSD: SD, row: r2 });
  }
  return { items: items, total: total, xCol: xCol, sdCol: sdCol };
}

/** อ่านคะแนนดิบต่อข้อ จาก sheet ดิบ (header อยู่แถว 2 = index 1) */
function gReadRawScores(rows, nItems) {
  var header = rows[1] || [];
  // item cols = ตั้งแต่หลัง 'ชั้นปี' จนถึงก่อน 'X'
  var xIdx = header.findIndex(function (v) { return gTrim(v) === 'X'; });
  var startIdx = 4; // A=ลำดับ B=ยศ C=ชื่อ D=ชั้นปี -> ข้อแรก index 4
  var endIdx = xIdx > startIdx ? xIdx : startIdx + nItems;
  var itemCols = [];
  for (var c = startIdx; c < endIdx; c++) itemCols.push(c);
  if (nItems && itemCols.length > nItems) itemCols = itemCols.slice(0, nItems);
  var perItem = itemCols.map(function () { return []; });
  var perPersonMeans = [];
  for (var r = 2; r < rows.length; r++) {
    var a = gTrim(rows[r][0]);
    if (!a || a === 'ค่าเฉลี่ย' || a === 'SD') break; // สิ้นสุดข้อมูลผู้ตอบ
    var pv = [];
    itemCols.forEach(function (c, i) {
      var n = gToNum(rows[r][c]);
      if (gIsScore(n)) { perItem[i].push(n); pv.push(n); }
    });
    if (pv.length) perPersonMeans.push(gMean(pv));
  }
  return { perItem: perItem, perPersonMeans: perPersonMeans, respondents: perPersonMeans.length };
}

/** ประมวลผล 1 คู่ (ดิบ+รายงาน) -> report model + คะแนนที่คำนวณ */
function gParseActivityPair(workbook, pair) {
  var reportRows = workbook[pair.report], rawRows = workbook[pair.raw];
  var rep = gReadReportItems(reportRows);
  var raw = gReadRawScores(rawRows, rep.items.length);
  var items = rep.items.map(function (it, i) {
    var s = raw.perItem[i] || [];
    var mean = gMean(s);
    return { no: it.no, text: it.text, N: s.length, X: gRound2(mean), SD: gRound2(gSampleSD(s)), level: gLevel(mean),
             reportX: gRound2(it.reportX), reportSD: gRound2(it.reportSD) };
  });
  var all = [];
  raw.perItem.forEach(function (s) { s.forEach(function (v) { all.push(v); }); });
  var totalMean = gMean(all);
  var pct = raw.perPersonMeans.length
    ? gRound2(100 * raw.perPersonMeans.filter(function (m) { return m >= 3.51; }).length / raw.perPersonMeans.length)
    : 0;
  return {
    activity: pair.report, respondents: raw.respondents, itemCount: items.length,
    unit: 'วิทยาลัยพยาบาลทหารอากาศ', title: gTrim(reportRows[1] && reportRows[1][0]),
    items: items,
    total: { X: gRound2(totalMean), SD: gRound2(gSampleSD(all)), reportX: rep.total ? gRound2(rep.total.X) : null, reportSD: rep.total ? gRound2(rep.total.SD) : null },
    satisfactionPct: pct
  };
}

function parseGoldenActivity(workbook) {
  return gFindActivityPairs(workbook).map(function (p) { return gParseActivityPair(workbook, p); });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseGoldenActivity: parseGoldenActivity, gFindActivityPairs: gFindActivityPairs, gSampleSD: gSampleSD, gMean: gMean, gRound2: gRound2 };
}
