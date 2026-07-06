/**
 * RTAFNC v6 — Golden-format reader (ประเภทที่ 1: กิจกรรม/ชมรม)
 * port จาก scripts/golden/golden_parser.js ตาม docs/GOLDEN_OUTPUT_FORMAT.md §9
 * ไฟล์นี้ถูก append เข้า Code.gs ตอน deploy (pattern ZZ_*)
 * route: ?action=goldenreport[&fileId=]  → อ่านไฟล์จริง คืนผล X/SD/รวม/พึงพอใจ (ไม่แตะ Drive ถาวร)
 */
function gTrim_(v) { return String(v == null ? '' : v).trim(); }
function gToNum_(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  var s = gTrim_(v);
  return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : NaN;
}
function gIsScore_(n) { return typeof n === 'number' && isFinite(n) && n >= 1 && n <= 5; }
function gMean_(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
function gSampleSD_(a) {
  if (a.length < 2) return 0;
  var m = gMean_(a);
  return Math.sqrt(a.reduce(function (s, v) { return s + Math.pow(v - m, 2); }, 0) / (a.length - 1));
}
function gRound2_(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function gLevel_(m) {
  if (m >= 4.51) return 'มากที่สุด';
  if (m >= 3.51) return 'มาก';
  if (m >= 2.51) return 'ปานกลาง';
  if (m >= 1.51) return 'น้อย';
  return 'น้อยที่สุด';
}
function gIsRawSheet_(name, rows) {
  if (/^\s*\(/.test(name) || /ชมรม/.test(name)) return true;
  return gTrim_(rows && rows[0] && rows[0][0]) === 'แบบประเมินแผนกปกครอง';
}
function gFindActivityPairs_(workbook, names) {
  var pairs = [];
  for (var i = 0; i < names.length - 1; i++) {
    if (gIsRawSheet_(names[i], workbook[names[i]]) && !gIsRawSheet_(names[i + 1], workbook[names[i + 1]])) {
      pairs.push({ raw: names[i], report: names[i + 1] });
      i++;
    }
  }
  return pairs;
}
function gReadReportItems_(rows) {
  var xCol = -1, sdCol = -1, headRow = -1;
  for (var r = 0; r < Math.min(rows.length, 15); r++) {
    for (var c = 0; c < rows[r].length; c++) {
      var t = gTrim_(rows[r][c]);
      if (t === 'X') { xCol = c; headRow = r; }
      if (t === 'SD' && headRow === r) sdCol = c;
    }
    if (xCol >= 0 && sdCol >= 0) break;
  }
  var items = [], total = null;
  for (var r2 = headRow + 1; r2 < rows.length; r2++) {
    var a = gTrim_(rows[r2][0]);
    if (!a) continue;
    var X = gToNum_(rows[r2][xCol]), SD = gToNum_(rows[r2][sdCol]);
    if (a === 'รวม' || a === 'ค่าเฉลี่ยรวม') { total = { X: X, SD: SD }; break; }
    if (/^\d+[.\s]/.test(a)) items.push({ no: a.match(/^(\d+)/)[1], text: a, reportX: X, reportSD: SD });
  }
  return { items: items, total: total };
}
function gReadRawScores_(rows, nItems) {
  var header = rows[1] || [];
  var xIdx = -1;
  for (var i = 0; i < header.length; i++) { if (gTrim_(header[i]) === 'X') { xIdx = i; break; } }
  var startIdx = 4, endIdx = xIdx > startIdx ? xIdx : startIdx + nItems;
  var itemCols = [];
  for (var c = startIdx; c < endIdx; c++) itemCols.push(c);
  if (nItems && itemCols.length > nItems) itemCols = itemCols.slice(0, nItems);
  var perItem = itemCols.map(function () { return []; });
  var perPersonMeans = [];
  for (var r = 2; r < rows.length; r++) {
    var a = gTrim_(rows[r][0]);
    if (!a || a === 'ค่าเฉลี่ย' || a === 'SD') break;
    var pv = [];
    for (var k = 0; k < itemCols.length; k++) {
      var n = gToNum_(rows[r][itemCols[k]]);
      if (gIsScore_(n)) { perItem[k].push(n); pv.push(n); }
    }
    if (pv.length) perPersonMeans.push(gMean_(pv));
  }
  return { perItem: perItem, perPersonMeans: perPersonMeans, respondents: perPersonMeans.length };
}
function parseGoldenActivity_(workbook, names) {
  return gFindActivityPairs_(workbook, names).map(function (pair) {
    var rep = gReadReportItems_(workbook[pair.report]);
    var raw = gReadRawScores_(workbook[pair.raw], rep.items.length);
    var items = rep.items.map(function (it, i) {
      var s = raw.perItem[i] || [];
      var mean = gMean_(s);
      return { no: it.no, text: it.text, N: s.length, X: gRound2_(mean), SD: gRound2_(gSampleSD_(s)), level: gLevel_(mean),
               goldenX: gRound2_(it.reportX), goldenSD: gRound2_(it.reportSD),
               match: gRound2_(mean) === gRound2_(it.reportX) && gRound2_(gSampleSD_(s)) === gRound2_(it.reportSD) };
    });
    var all = [];
    raw.perItem.forEach(function (s) { s.forEach(function (v) { all.push(v); }); });
    var pct = raw.perPersonMeans.length
      ? gRound2_(100 * raw.perPersonMeans.filter(function (m) { return m >= 3.51; }).length / raw.perPersonMeans.length) : 0;
    return {
      activity: pair.report, respondents: raw.respondents, itemCount: items.length,
      title: gTrim_(workbook[pair.report][1] && workbook[pair.report][1][0]),
      items: items, total: { X: gRound2_(gMean_(all)), SD: gRound2_(gSampleSD_(all)) },
      satisfactionPct: pct, itemsMatched: items.filter(function (x) { return x.match; }).length
    };
  });
}

/** ?action=goldenreport[&fileId=] — อ่านไฟล์ golden จริง คืนผลคำนวณ (read-only) */
function getGoldenReport_(fileId) {
  var file;
  if (fileId) { file = DriveApp.getFileById(fileId); }
  else {
    var it = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID).getFiles();
    while (it.hasNext()) { var f = it.next(); if (isSupported_(f.getName()) && f.getSize() > 0) { file = f; break; } }
  }
  if (!file) return { ok: false, error: 'ไม่พบไฟล์ที่รองรับในคิว' };
  var tempId = convertToGoogleSheet_(file);
  try {
    var ss = SpreadsheetApp.openById(tempId);
    var wb = {}, names = [];
    ss.getSheets().forEach(function (sh) { var nm = sh.getName(); names.push(nm); wb[nm] = sh.getDataRange().getValues(); });
    var results = parseGoldenActivity_(wb, names);
    if (!results.length) {
      return { ok: true, action: 'goldenreport', file: file.getName(), type: 'ไม่ใช่รูปแบบกิจกรรม/ชมรม (ไม่พบคู่ sheet ดิบ+รายงาน)', sheets: names };
    }
    return {
      ok: true, action: 'goldenreport', file: file.getName(),
      type: 'กิจกรรม/ชมรม', activityCount: results.length,
      summary: results.map(function (r) { return { activity: r.activity, respondents: r.respondents, items: r.itemCount, X: r.total.X, SD: r.total.SD, พึงพอใจ: r.satisfactionPct + '%', ตรงgolden: r.itemsMatched + '/' + r.itemCount }; }),
      activities: results
    };
  } finally { try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e) {} }
}
