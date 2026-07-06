/**
 * RTAFNC v6 — Golden reader + output (ประเภทที่ 2: ประเมินผู้สอนรายบุคคล/รายวิชา)
 * port ตรงจาก scripts/golden/golden_parser_type2.js (§6) — logic เหมือน Node ที่ผ่านเทสแล้ว
 * ไฟล์นี้ถูก append เข้า Code.gs ตอน deploy (pattern ZZ_*)
 * routes:
 *   ?action=goldentype2[&fileId=]  → อ่านไฟล์จริง → รายงานผู้สอน (Excel/PDF) + base64
 *   ?action=goldentype2demo         → ข้อมูลตัวอย่างในโค้ด (ทดสอบได้โดยไม่ต้องอัปโหลด)
 */

/* ===== parser (verbatim port) ===== */
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
var T2_RANKS = ['น.อ.', 'น.ท.', 'น.ต.', 'ร.อ.', 'ร.ท.', 'ร.ต.', 'พ.อ.', 'พ.ท.', 'พ.ต.',
  'จ.อ.', 'จ.ท.', 'จ.ต.', 'พ.อ.อ.', 'พ.อ.ท.', 'พ.อ.ต.', 'นาวาอากาศเอก', 'นาวาอากาศโท',
  'นาวาอากาศตรี', 'เรืออากาศเอก', 'เรืออากาศโท', 'เรืออากาศตรี', 'นพอ.', 'ดร.', 'อาจารย์'];
function t2NormName(s) {
  var x = t2Trim(s).replace(/^ชื่ออาจารย์\s*/, '');
  T2_RANKS.forEach(function (r) { x = x.split(r).join(''); });
  return x.replace(/[\s().]/g, '');
}
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
function t2ItemColsFromHeader(row) {
  var cols = [];
  for (var c = 0; c < row.length; c++) {
    var s = t2Trim(row[c]);
    if (/^ข้อ\s*\d+$/.test(s) || /^\d+$/.test(s)) cols.push(c);
  }
  return cols;
}
function t2FindRawHeaderRow(rows) {
  for (var r = 0; r < Math.min(rows.length, 4); r++) {
    var row = rows[r] || [];
    var hasKey = row.some(function (v) { var s = t2Trim(v); return s === 'เลขที่' || s === 'ลำดับ' || s === 'ลำดับที่'; });
    var itemCols = t2ItemColsFromHeader(row);
    if (hasKey && itemCols.length >= 2) return { headRow: r, itemCols: itemCols };
  }
  return null;
}
function t2IsRawSheet(rows) { return !!t2FindRawHeaderRow(rows) && !t2IsReportSheet(rows); }
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
function parseGoldenInstructor_(workbook, names) {
  names = names || Object.keys(workbook);
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
      title: t2Trim(rep.rows[0] && rep.rows[0][0]), subtitle: t2Trim(rep.rows[1] && rep.rows[1][0]),
      items: items,
      total: { X: t2Round2(t2Mean(all)), SD: t2Round2(t2SampleSD(all)),
               reportX: repItems.total ? t2Round2(repItems.total.X) : null, reportSD: repItems.total ? t2Round2(repItems.total.SD) : null },
      satisfactionPct: pct
    };
  });
}

/* ===== GAS output layout (§6.2 per-instructor report) ===== */
function writeType2ReportSheet_(sh, ins) {
  sh.clear();
  sh.getRange('A1:C1').merge().setValue('วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ');
  sh.getRange('A2:C2').merge().setValue(ins.title || 'ผลการประเมินความพึงพอใจในการเรียนการจัดการเรียนการสอน');
  sh.getRange('A3:C3').merge().setValue(ins.subtitle || '');
  sh.getRange('A4:C4').merge().setValue('ชื่ออาจารย์  ' + ins.instructor + '   |   จำนวนผู้ตอบ ' + ins.respondents + ' คน   |   จำนวนข้อ ' + ins.itemCount + ' ข้อ');
  sh.getRange('A5:C5').merge().setValue('เกณฑ์การประเมิน: 4.51–5.00 มากที่สุด | 3.51–4.50 มาก | 2.51–3.50 ปานกลาง | 1.51–2.50 น้อย | 1.00–1.50 น้อยที่สุด');
  sh.getRange(7, 1, 1, 3).setValues([['ข้อมูลเกี่ยวกับการเรียนการสอน', 'X', 'SD']]);
  var rows = ins.items.map(function (it) { return [it.text, it.X, it.SD]; });
  if (rows.length) sh.getRange(8, 1, rows.length, 3).setValues(rows);
  var r = 8 + rows.length;
  sh.getRange(r, 1, 1, 3).setValues([['ค่าเฉลี่ยรวม', ins.total.X, ins.total.SD]]);
  var totalRow = r; r++;
  sh.getRange(r, 1, 1, 3).merge().setValue('ผลการประเมินความพึงพอใจ: ค่าเฉลี่ย 3.51 ขึ้นไป คิดเป็นร้อยละ ' + Number(ins.satisfactionPct).toFixed(2) + '   (ระดับ ' + t2Level(ins.total.X) + ')');
  r += 2;
  sh.getRange(r, 1, 1, 3).merge().setValue('การรับทราบผลการประเมิน:   ( ) ทราบแล้ว'); r += 2;
  sh.getRange(r, 1, 1, 3).merge().setValue('แนวทางการพัฒนา / ปรับปรุงการเรียนการสอน:'); r++;
  sh.getRange(r, 1, 1, 3).merge().setValue('.....................................................................................................................'); r++;
  sh.getRange(r, 1, 1, 3).merge().setValue('.....................................................................................................................'); r += 2;
  ['ผู้สอน', 'หน.ผปค.วพอ.พอ.'].forEach(function (role) {
    sh.getRange(r, 1, 1, 3).merge().setValue('ลงชื่อ ...................................................'); r++;
    sh.getRange(r, 1, 1, 3).merge().setValue('( .................................................. )'); r++;
    sh.getRange(r, 1, 1, 3).merge().setValue(role); r += 2;
  });
  // style
  var lastRow = sh.getLastRow();
  sh.getRange(1, 1, lastRow, 3).setFontFamily(CONFIG.REPORT_FONT).setFontSize(13).setWrap(true).setVerticalAlignment('middle');
  sh.getRange('A1:C1').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#0B2347').setFontColor('#FFFFFF');
  sh.getRange('A2:C2').setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#EAF3FF').setFontColor('#0B2347');
  sh.getRange('A2:C2').setBorder(null, null, true, null, null, null, '#D6A94A', SpreadsheetApp.BorderStyle.SOLID_THICK);
  sh.getRange('A3:A5').setHorizontalAlignment('center');
  sh.getRange(7, 1, 1, 3).setFontWeight('bold').setBackground('#0B2347').setFontColor('#FFFFFF').setHorizontalAlignment('center');
  sh.getRange(totalRow, 1, 1, 3).setFontWeight('bold').setBackground('#EAF3FF');
  sh.getRange(8, 2, rows.length + 1, 2).setNumberFormat('0.00'); // X/SD 2 ตำแหน่งเสมอ (รวมแถวรวม)
  if (rows.length) {
    sh.getRange(7, 1, rows.length + 2, 3).setBorder(true, true, true, true, true, true, '#B7C3D6', SpreadsheetApp.BorderStyle.SOLID);
    try { sh.getRange(8, 1, rows.length, 3).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false); } catch (e) {}
  }
  [500, 70, 70].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange('B:C').setHorizontalAlignment('center');
  sh.setHiddenGridlines(true);
  return sh.getSheetId();
}

function goldenType2ExportFromResults_(results, srcName) {
  var ss = SpreadsheetApp.create(safeName_('รายงานผู้สอน_' + srcName + '_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss')));
  var file = DriveApp.getFileById(ss.getId());
  DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID).addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch (e) {}
  var first = ss.getSheets()[0], gids = [];
  results.forEach(function (ins, i) {
    var nm = String(ins.instructor).slice(0, 90) || ('ผู้สอน' + (i + 1));
    var sh = i === 0 ? first.setName(nm) : ss.insertSheet(nm);
    gids.push({ instructor: ins.instructor, gid: writeType2ReportSheet_(sh, ins) });
  });
  SpreadsheetApp.flush();
  var pdfB64 = Utilities.base64Encode(gExportPdfPortraitBytes_(ss.getId(), gids[0].gid));
  var xlsxB64 = Utilities.base64Encode(exportXlsxBytes_(ss.getId()));
  return { url: ss.getUrl(), spreadsheetId: ss.getId(), instructors: gids.map(function (g) { return g.instructor; }), pdfBase64: pdfB64, xlsxBase64: xlsxB64 };
}

function gReadType2_(file) {
  var tempId = convertToGoogleSheet_(file);
  try {
    var ss = SpreadsheetApp.openById(tempId);
    var wb = {}, names = [];
    ss.getSheets().forEach(function (sh) { var nm = sh.getName(); names.push(nm); wb[nm] = sh.getDataRange().getValues(); });
    return { names: names, results: parseGoldenInstructor_(wb, names) };
  } finally { try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e) {} }
}

function goldenType2Export_(fileId) {
  var file;
  if (fileId) file = DriveApp.getFileById(fileId);
  else {
    var it = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID).getFiles();
    while (it.hasNext()) { var f = it.next(); if (isSupported_(f.getName()) && f.getSize() > 0) { var rr = gReadType2_(f); if (rr.results.length) { file = f; break; } } }
  }
  if (!file) return { ok: false, error: 'ไม่พบไฟล์ประเมินผู้สอน (ประเภทที่ 2) ในคิว' };
  var r = gReadType2_(file);
  if (!r.results.length) return { ok: false, action: 'goldentype2', file: file.getName(), error: 'ไฟล์นี้ไม่ใช่รูปแบบประเมินผู้สอนรายบุคคล', sheets: r.names };
  var out = goldenType2ExportFromResults_(r.results, file.getName().replace(/\.[^.]+$/, ''));
  return { ok: true, action: 'goldentype2', file: file.getName(), instructorCount: r.results.length,
    summary: r.results.map(function (x) { return { instructor: x.instructor, matched: x.matched, respondents: x.respondents, items: x.itemCount, X: x.total.X, SD: x.total.SD, พึงพอใจ: x.satisfactionPct + '%' }; }),
    outputUrl: out.url, pdfBase64: out.pdfBase64, xlsxBase64: out.xlsxBase64 };
}

function goldenType2ExportDemo_() {
  var wb = {
    'น.ท.สาธิต หนึ่ง': [
      ['แบบประเมินรายวิชา'],
      ['เลขที่', 'ชื่อ - สกุล', 'ข้อ1', 'ข้อ2', 'ข้อ3'],
      [1, 'นพอ. ก', 5, 4, 5],
      [2, 'นพอ. ข', 4, 4, 4],
      [3, 'นพอ. ค', 5, 3, 4],
      [4, 'นพอ. ง', 4, 4, 5],
      ['ค่าเฉลี่ย', '', '', '', '']
    ],
    'รายงานหนึ่ง': [
      ['ผลการประเมินความพึงพอใจในการเรียนการจัดการเรียนการสอน'],
      ['ผู้สอนรายบุคคล วิชาการฝึกทหาร 1 ปีการศึกษา 2568'],
      ['ชื่ออาจารย์ น.ท.สาธิต หนึ่ง'],
      ['เกณฑ์การประเมิน'],
      ['ข้อมูลเกี่ยวกับการเรียนการสอน', 'x', 'SD'],
      ['1. อาจารย์เตรียมการสอนและสื่อการสอนมาเป็นอย่างดี', 0, 0],
      ['2. อาจารย์อธิบายเนื้อหาได้ชัดเจนเข้าใจง่าย', 0, 0],
      ['3. อาจารย์เปิดโอกาสให้ซักถามและตอบข้อสงสัย', 0, 0],
      ['ค่าเฉลี่ยรวม', 0, 0]
    ]
  };
  var results = parseGoldenInstructor_(wb, Object.keys(wb));
  var out = goldenType2ExportFromResults_(results, 'demo');
  return { ok: true, action: 'goldentype2demo', instructorCount: results.length,
    summary: results.map(function (x) { return { instructor: x.instructor, matched: x.matched, respondents: x.respondents, items: x.itemCount, X: x.total.X, SD: x.total.SD, พึงพอใจ: x.satisfactionPct + '%' }; }),
    outputUrl: out.url, pdfBase64: out.pdfBase64, xlsxBase64: out.xlsxBase64 };
}
