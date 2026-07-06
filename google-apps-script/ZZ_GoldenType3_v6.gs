/**
 * RTAFNC v6 — Golden reader + output (ประเภทที่ 3: อัตลักษณ์ งาม/สง่า multi-dimension)
 * port ตรงจาก scripts/golden/golden_parser_type3.js (§6ก) — logic เหมือน Node ที่ผ่านเทสแล้ว
 * routes:
 *   ?action=goldentype3[&fileId=]  → อ่านไฟล์จริง → รายงานอัตลักษณ์ (Excel/PDF) + base64
 *   ?action=goldentype3demo         → ข้อมูลตัวอย่างในโค้ด
 */

/* ===== parser (verbatim port) ===== */
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
function t3DimOf(text) {
  var s = t3Trim(text);
  if (/สง่า/.test(s)) return 'สง่า';
  if (/งาม/.test(s)) return 'งาม';
  return '';
}
function t3IsDimHeader(rowText) {
  var s = t3Trim(rowText);
  if (!s || /^\d/.test(s)) return false;
  return /^(ด้าน)?\s*(ความ)?(งาม|สง่า)/.test(s) && s.length <= 30;
}
function t3ReadQuestions(rows) {
  var out = [];
  var curDim = '';
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r] || [];
    var rowDimCell = '';
    for (var c = 0; c < row.length; c++) {
      var cell = t3Trim(row[c]);
      if (cell === 'งาม' || cell === 'สง่า' || cell === 'ด้านงาม' || cell === 'ด้านสง่า') rowDimCell = t3DimOf(cell);
    }
    var no = null, text = '';
    for (var c2 = 0; c2 < row.length; c2++) {
      var cell2 = t3Trim(row[c2]);
      if (no === null && /^\d+[.)]?$/.test(cell2)) { no = cell2.replace(/[.)]/g, ''); continue; }
      if (/[ก-๙]/.test(cell2) && cell2.length > text.length && !/^(งาม|สง่า|ด้าน)/.test(cell2)) text = cell2;
    }
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
function parseGoldenIdentity_(workbook, names) {
  names = names || Object.keys(workbook);
  var qSheet = names.filter(function (n) { return /ข้อคำถาม/.test(n); })[0];
  if (!qSheet) return { ok: false, error: 'ไม่พบ sheet ข้อคำถาม (แหล่งข้อความคำถามอัตลักษณ์)' };
  var questions = t3ReadQuestions(workbook[qSheet]);
  if (!questions.length) return { ok: false, error: 'sheet ข้อคำถาม ว่าง/อ่านไม่ได้' };
  var yearSheets = names.filter(function (n) { return n !== qSheet && t3FindRawHeader(workbook[n]) && /ปี\s*\d/.test(n); });
  var perYear = yearSheets.map(function (n) { return { label: n, rs: t3ReadRawScores(workbook[n], questions.length) }; });
  var overall = t3BuildResult('ภาพรวมทุกชั้นปี', questions, t3MergeScores(perYear.map(function (y) { return y.rs; }), questions.length));
  var years = perYear.map(function (y) { return t3BuildResult(y.label, questions, y.rs); });
  return { ok: true, questionSheet: qSheet, dimensions: ['งาม', 'สง่า'], questionCount: questions.length, yearCount: years.length, overall: overall, years: years };
}

/* ===== GAS output layout (§6ก multi-dimension) ===== */
function writeType3ReportSheet_(sh, res) {
  sh.clear();
  sh.getRange('A1:G1').merge().setValue('วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ');
  sh.getRange('A2:G2').merge().setValue('ผลการประเมินอัตลักษณ์นักเรียนพยาบาลทหารอากาศ (งาม / สง่า) — ' + res.label);
  sh.getRange('A3:G3').merge().setValue('เกณฑ์การประเมิน: 4.51–5.00 มากที่สุด | 3.51–4.50 มาก | 2.51–3.50 ปานกลาง | 1.51–2.50 น้อย | 1.00–1.50 น้อยที่สุด');
  sh.getRange('A4:G4').merge().setValue('จำนวนผู้ตอบ ' + res.respondents + ' คน   |   จำนวนข้อ ' + res.itemCount + ' ข้อ   |   ด้านงาม X=' + Number(res.byDim['งาม'].X).toFixed(2) + '  ด้านสง่า X=' + Number(res.byDim['สง่า'].X).toFixed(2));
  // header 2 แถว
  sh.getRange(6, 1).setValue('ข้อมูลเกี่ยวกับการประเมิน');
  sh.getRange('A6:A7').merge();
  sh.getRange('B6:C6').merge().setValue('ประเมิน งาม');
  sh.getRange('D6:E6').merge().setValue('ประเมิน สง่า');
  sh.getRange('F6:F7').merge().setValue('โดยรวม');
  sh.getRange('G6:G7').merge().setValue('ระดับ');
  sh.getRange(7, 2, 1, 4).setValues([['X', 'SD', 'X', 'SD']]);
  // item rows
  var rows = res.items.map(function (it) {
    return [it.text,
      it.dim === 'งาม' ? it.X : '', it.dim === 'งาม' ? it.SD : '',
      it.dim === 'สง่า' ? it.X : '', it.dim === 'สง่า' ? it.SD : '',
      it.X, it.level];
  });
  if (rows.length) sh.getRange(8, 1, rows.length, 7).setValues(rows);
  var r = 8 + rows.length;
  sh.getRange(r, 1, 1, 7).setValues([['รวม',
    res.byDim['งาม'].X, res.byDim['งาม'].SD, res.byDim['สง่า'].X, res.byDim['สง่า'].SD,
    res.total.X, res.total.level]]);
  var totalRow = r; r++;
  sh.getRange(r, 1, 1, 7).merge().setValue('ผลการประเมินความพึงพอใจ: ค่าเฉลี่ย 3.51 ขึ้นไป คิดเป็นร้อยละ ' + Number(res.satisfactionPct).toFixed(2));
  r += 2;
  ['ผู้รับการประเมิน', 'หน.ผปค.วพอ.พอ.'].forEach(function (role) {
    sh.getRange(r, 1, 1, 7).merge().setValue('ลงชื่อ ...................................................'); r++;
    sh.getRange(r, 1, 1, 7).merge().setValue('( .................................................. )'); r++;
    sh.getRange(r, 1, 1, 7).merge().setValue(role); r += 2;
  });
  // style
  var lastRow = sh.getLastRow();
  sh.getRange(1, 1, lastRow, 7).setFontFamily(CONFIG.REPORT_FONT).setFontSize(12).setWrap(true).setVerticalAlignment('middle');
  sh.getRange('A1:G1').setFontSize(15).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#0B2347').setFontColor('#FFFFFF');
  sh.getRange('A2:G2').setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#EAF3FF').setFontColor('#0B2347');
  sh.getRange('A2:G2').setBorder(null, null, true, null, null, null, '#D6A94A', SpreadsheetApp.BorderStyle.SOLID_THICK);
  sh.getRange('A3:G4').setHorizontalAlignment('center');
  sh.getRange(6, 1, 2, 7).setFontWeight('bold').setBackground('#0B2347').setFontColor('#FFFFFF').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(totalRow, 1, 1, 7).setFontWeight('bold').setBackground('#EAF3FF');
  sh.getRange(8, 2, rows.length + 1, 5).setNumberFormat('0.00'); // งาม/สง่า/โดยรวม X,SD 2 ตำแหน่ง (รวมแถวรวม)
  if (rows.length) {
    sh.getRange(6, 1, rows.length + 3, 7).setBorder(true, true, true, true, true, true, '#B7C3D6', SpreadsheetApp.BorderStyle.SOLID);
    try { sh.getRange(8, 1, rows.length, 7).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false); } catch (e) {}
  }
  [360, 52, 52, 52, 52, 64, 92].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange('B:G').setHorizontalAlignment('center');
  sh.setHiddenGridlines(true);
  return sh.getSheetId();
}

function goldenType3ExportFromResults_(parsed, srcName) {
  var ss = SpreadsheetApp.create(safeName_('รายงานอัตลักษณ์_' + srcName + '_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss')));
  var file = DriveApp.getFileById(ss.getId());
  DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID).addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch (e) {}
  var sheetsToWrite = [parsed.overall].concat(parsed.years);
  var first = ss.getSheets()[0], gids = [];
  sheetsToWrite.forEach(function (res, i) {
    var nm = String(res.label).slice(0, 90) || ('รายงาน' + (i + 1));
    var sh = i === 0 ? first.setName(nm) : ss.insertSheet(nm);
    gids.push({ label: res.label, gid: writeType3ReportSheet_(sh, res) });
  });
  SpreadsheetApp.flush();
  var pdfB64 = Utilities.base64Encode(exportPdfBytes_(ss.getId(), gids[0].gid)); // landscape (multi-dim กว้าง)
  var xlsxB64 = Utilities.base64Encode(exportXlsxBytes_(ss.getId()));
  return { url: ss.getUrl(), spreadsheetId: ss.getId(), sheets: gids.map(function (g) { return g.label; }), pdfBase64: pdfB64, xlsxBase64: xlsxB64 };
}

function gReadType3_(file) {
  var tempId = convertToGoogleSheet_(file);
  try {
    var ss = SpreadsheetApp.openById(tempId);
    var wb = {}, names = [];
    ss.getSheets().forEach(function (sh) { var nm = sh.getName(); names.push(nm); wb[nm] = sh.getDataRange().getValues(); });
    return { names: names, parsed: parseGoldenIdentity_(wb, names) };
  } finally { try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e) {} }
}

function goldenType3Export_(fileId) {
  var file;
  if (fileId) file = DriveApp.getFileById(fileId);
  else {
    var it = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID).getFiles();
    while (it.hasNext()) { var f = it.next(); if (isSupported_(f.getName()) && f.getSize() > 0) { var rr = gReadType3_(f); if (rr.parsed.ok) { file = f; break; } } }
  }
  if (!file) return { ok: false, error: 'ไม่พบไฟล์ประเมินอัตลักษณ์ (มี sheet ข้อคำถาม + ปีN) ในคิว' };
  var r = gReadType3_(file);
  if (!r.parsed.ok) return { ok: false, action: 'goldentype3', file: file.getName(), error: r.parsed.error, sheets: r.names };
  var out = goldenType3ExportFromResults_(r.parsed, file.getName().replace(/\.[^.]+$/, ''));
  return { ok: true, action: 'goldentype3', file: file.getName(),
    questionCount: r.parsed.questionCount, yearCount: r.parsed.yearCount,
    summary: [r.parsed.overall].concat(r.parsed.years).map(function (x) { return { label: x.label, respondents: x.respondents, งามX: x.byDim['งาม'].X, สง่าX: x.byDim['สง่า'].X, รวมX: x.total.X, พึงพอใจ: x.satisfactionPct + '%' }; }),
    outputUrl: out.url, pdfBase64: out.pdfBase64, xlsxBase64: out.xlsxBase64 };
}

function goldenType3ExportDemo_() {
  var wb = {
    'ข้อคำถาม': [
      ['ด้านงาม'],
      ['1', 'แต่งกายสะอาดเรียบร้อยถูกระเบียบ'],
      ['2', 'มีกิริยามารยาทงดงามอ่อนน้อมถ่อมตน'],
      ['ด้านสง่า'],
      ['3', 'มีบุคลิกภาพสง่าผ่าเผยเชื่อมั่นในตนเอง'],
      ['4', 'วางตัวเหมาะสมมีภาวะผู้นำน่าเชื่อถือ']
    ],
    'ปี 1': [
      ['แบบประเมินอัตลักษณ์'],
      ['ลำดับที่', 'ยศ', 'ชื่อ - สกุล', 'อีเมล', '1', '2', '3', '4'],
      [1, 'นพอ.', 'ก', 'a@x', 5, 4, 5, 4],
      [2, 'นพอ.', 'ข', 'b@x', 4, 4, 4, 4],
      [3, 'นพอ.', 'ค', 'c@x', 5, 5, 4, 3],
      ['ค่าเฉลี่ย']
    ],
    'ปี 2': [
      ['แบบประเมินอัตลักษณ์'],
      ['ลำดับที่', 'ยศ', 'ชื่อ - สกุล', 'อีเมล', '1', '2', '3', '4'],
      [1, 'นพอ.', 'ง', 'd@x', 3, 3, 4, 5],
      [2, 'นพอ.', 'จ', 'e@x', 4, 4, 4, 4],
      ['ค่าเฉลี่ย']
    ]
  };
  var parsed = parseGoldenIdentity_(wb, Object.keys(wb));
  var out = goldenType3ExportFromResults_(parsed, 'demo');
  return { ok: true, action: 'goldentype3demo', questionCount: parsed.questionCount, yearCount: parsed.yearCount,
    summary: [parsed.overall].concat(parsed.years).map(function (x) { return { label: x.label, respondents: x.respondents, งามX: x.byDim['งาม'].X, สง่าX: x.byDim['สง่า'].X, รวมX: x.total.X, พึงพอใจ: x.satisfactionPct + '%' }; }),
    outputUrl: out.url, pdfBase64: out.pdfBase64, xlsxBase64: out.xlsxBase64 };
}
