/**
 * RTAFNC v6 — Golden output generator (ประเภทที่ 1)
 * สร้าง Excel + PDF ตาม golden layout (§2/§7) จากไฟล์ที่อ่านด้วย parseGoldenActivity_
 * routes:
 *   ?action=goldenexport[&fileId=]  → อ่านไฟล์ golden จริง → สร้าง Excel/PDF (บันทึกลง Drive) + คืน base64
 *   ?action=goldenexportdemo         → ใช้ข้อมูลตัวอย่างในโค้ด (ทดสอบ output ได้โดยไม่ต้องอัปโหลด)
 */

/** export PDF (A4 portrait, สำหรับรายงาน golden 5 คอลัมน์) → bytes */
function gExportPdfPortraitBytes_(spreadsheetId, gid) {
  var params = ['format=pdf', 'size=A4', 'portrait=true', 'fitw=true', 'scale=4',
    'sheetnames=false', 'printtitle=false', 'pagenumbers=true', 'gridlines=false', 'fzr=false',
    'top_margin=0.5', 'bottom_margin=0.5', 'left_margin=0.5', 'right_margin=0.5',
    'gid=' + encodeURIComponent(gid)].join('&');
  var url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?' + params;
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) throw new Error('PDF export failed: HTTP ' + res.getResponseCode());
  return res.getBlob().getBytes();
}

/** เขียน sheet รายงาน golden 1 กิจกรรม → คืน gid */
function writeGoldenReportSheet_(sh, a) {
  sh.clear();
  sh.getRange('A1:E1').merge().setValue('วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ');
  sh.getRange('A2:E2').merge().setValue(a.title || ('ผลการประเมิน ' + a.activity));
  sh.getRange('A3:E3').merge().setValue('เกณฑ์การประเมิน: 4.51–5.00 มากที่สุด | 3.51–4.50 มาก | 2.51–3.50 ปานกลาง | 1.51–2.50 น้อย | 1.00–1.50 น้อยที่สุด');
  sh.getRange('A4:E4').merge().setValue('จำนวนผู้ตอบ ' + a.respondents + ' คน   |   จำนวนข้อประเมิน ' + a.itemCount + ' ข้อ');
  sh.getRange(6, 1, 1, 5).setValues([['ลำดับ', 'ข้อความประเมิน', 'X', 'SD', 'ระดับ']]);
  var rows = a.items.map(function (it, i) { return [i + 1, it.text, it.X, it.SD, it.level]; });
  if (rows.length) sh.getRange(7, 1, rows.length, 5).setValues(rows);
  var r = 7 + rows.length;
  sh.getRange(r, 1, 1, 5).setValues([['', 'รวม', a.total.X, a.total.SD, gLevel_(a.total.X)]]);
  var totalRow = r; r++;
  sh.getRange(r, 1, 1, 5).merge().setValue('ผลการประเมินความพึงพอใจ: ค่าเฉลี่ย 3.51 ขึ้นไป คิดเป็นร้อยละ ' + a.satisfactionPct);
  r += 2;
  ['ผู้รับการประเมิน', 'หน.ผปค.วพอ.พอ.'].forEach(function (role) {
    sh.getRange(r, 1, 1, 5).merge().setValue('ลงชื่อ ...................................................'); r++;
    sh.getRange(r, 1, 1, 5).merge().setValue('( .................................................. )'); r++;
    sh.getRange(r, 1, 1, 5).merge().setValue(role); r += 2;
  });
  // style
  var lastRow = sh.getLastRow();
  sh.getRange(1, 1, lastRow, 5).setFontFamily(CONFIG.REPORT_FONT).setFontSize(13).setWrap(true).setVerticalAlignment('middle');
  sh.getRange('A1:E1').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#0B2347').setFontColor('#FFFFFF');
  sh.getRange('A2:E2').setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#EAF3FF').setFontColor('#0B2347');
  sh.getRange('A2:E2').setBorder(null, null, true, null, null, null, '#D6A94A', SpreadsheetApp.BorderStyle.SOLID_THICK);
  sh.getRange('A3:E4').setHorizontalAlignment('center');
  sh.getRange(6, 1, 1, 5).setFontWeight('bold').setBackground('#0B2347').setFontColor('#FFFFFF').setHorizontalAlignment('center');
  sh.getRange(totalRow, 1, 1, 5).setFontWeight('bold').setBackground('#EAF3FF');
  if (rows.length) {
    sh.getRange(6, 1, rows.length + 2, 5).setBorder(true, true, true, true, true, true, '#B7C3D6', SpreadsheetApp.BorderStyle.SOLID);
    try { sh.getRange(7, 1, rows.length, 5).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false); } catch (e) {}
  }
  [44, 420, 64, 64, 96].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange('A:A').setHorizontalAlignment('center');
  sh.getRange('C:E').setHorizontalAlignment('center');
  sh.setHiddenGridlines(true);
  return sh.getSheetId();
}

/** สร้าง workbook golden จาก results → บันทึก Drive + คืน base64 (กิจกรรมแรก) */
function goldenExportFromResults_(results, srcName) {
  var ss = SpreadsheetApp.create(safeName_('รายงาน_golden_' + srcName + '_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss')));
  var file = DriveApp.getFileById(ss.getId());
  DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID).addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch (e) {}
  var first = ss.getSheets()[0], gids = [];
  results.forEach(function (a, i) {
    var nm = String(a.activity).slice(0, 90) || ('กิจกรรม' + (i + 1));
    var sh = i === 0 ? first.setName(nm) : ss.insertSheet(nm);
    gids.push({ activity: a.activity, gid: writeGoldenReportSheet_(sh, a) });
  });
  SpreadsheetApp.flush();
  var pdfB64 = Utilities.base64Encode(gExportPdfPortraitBytes_(ss.getId(), gids[0].gid));
  var xlsxB64 = Utilities.base64Encode(exportXlsxBytes_(ss.getId()));
  return { url: ss.getUrl(), spreadsheetId: ss.getId(), activities: gids.map(function (g) { return g.activity; }), pdfBase64: pdfB64, xlsxBase64: xlsxB64 };
}

function goldenExport_(fileId) {
  var file;
  if (fileId) file = DriveApp.getFileById(fileId);
  else {
    var it = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID).getFiles();
    while (it.hasNext()) { var f = it.next(); if (isSupported_(f.getName()) && f.getSize() > 0) { var rr = gReadOne_(f); if (rr.results.length) { file = f; break; } } }
  }
  if (!file) return { ok: false, error: 'ไม่พบไฟล์ golden (กิจกรรม/ชมรม) ในคิว' };
  var r = gReadOne_(file);
  if (!r.results.length) return { ok: false, action: 'goldenexport', file: file.getName(), error: 'ไฟล์นี้ไม่ใช่รูปแบบกิจกรรม/ชมรม', sheets: r.names };
  var out = goldenExportFromResults_(r.results, file.getName().replace(/\.[^.]+$/, ''));
  return { ok: true, action: 'goldenexport', file: file.getName(), activityCount: r.results.length,
    summary: r.results.map(function (x) { return { activity: x.activity, respondents: x.respondents, items: x.itemCount, X: x.total.X, SD: x.total.SD, พึงพอใจ: x.satisfactionPct + '%', ตรงgolden: x.itemsMatched + '/' + x.itemCount }; }),
    outputUrl: out.url, pdfBase64: out.pdfBase64, xlsxBase64: out.xlsxBase64 };
}

/** ข้อมูลตัวอย่าง golden ในโค้ด → สร้าง output (ทดสอบได้โดยไม่ต้องอัปโหลด) */
function goldenExportDemo_() {
  var wb = {
    '(ชมรมสาธิต)': [
      ['แบบประเมินแผนกปกครอง'],
      ['ลำดับ', 'ชื่อ - สกุล', '', 'นพอ.ชั้นปีที่', 'ข้อ1', '2', '3', 'X', 'SD'],
      [1, 'นพอ.', 'ก ข', '4', 5, 4, 5, '', ''],
      [2, 'นพอ.', 'ค ง', '4', 4, 4, 3, '', ''],
      [3, 'นพอ.', 'จ ฉ', '4', 5, 5, 4, '', ''],
      [4, 'นพอ.', 'ช ซ', '4', 4, 3, 4, '', ''],
      [5, 'นพอ.', 'ฌ ญ', '4', 5, 5, 5, '', ''],
      ['ค่าเฉลี่ย']
    ],
    'สาธิต': [
      ['วิทยาลัยพยาบาลทหารอากาศ'],
      ['แบบประเมินการร่วมกิจกรรมส่งเสริมสุขภาพ (ชมรมสาธิต) นพอ.ชั้นปีที่ 1-4 ปีการศึกษา 2568'],
      ['เกณฑ์การประเมิน'], ['', '4.51 – 5.00'], ['', '3.51 – 4.50'], ['', '2.51 – 3.50'], ['', '1.51 – 2.50'], ['', '1.00 – 1.50'],
      ['', '', '', '', '', '', '', '', 'ประเมิน'],
      ['', '', '', '', '', '', '', '', 'X', 'SD'],
      ['1. การร่วมกิจกรรมกีฬาทำให้มีสุขภาพแข็งแรง', '', '', '', '', '', '', '', 0, 0],
      ['2. เกิดความสามัคคีในหมู่คณะ', '', '', '', '', '', '', '', 0, 0],
      ['3. ใช้เวลาว่างให้เกิดประโยชน์', '', '', '', '', '', '', '', 0, 0],
      ['รวม', '', '', '', '', '', '', '', 0, 0]
    ]
  };
  var results = parseGoldenActivity_(wb, Object.keys(wb));
  var out = goldenExportFromResults_(results, 'demo');
  return { ok: true, action: 'goldenexportdemo', activityCount: results.length,
    summary: results.map(function (x) { return { activity: x.activity, respondents: x.respondents, items: x.itemCount, X: x.total.X, SD: x.total.SD, พึงพอใจ: x.satisfactionPct + '%' }; }),
    outputUrl: out.url, pdfBase64: out.pdfBase64, xlsxBase64: out.xlsxBase64 };
}
