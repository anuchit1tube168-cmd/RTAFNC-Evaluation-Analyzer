/**
 * RTAFNC v6 — Upload → auto-detect golden type → generate Excel+PDF (in web app)
 * ใช้ผ่าน google.script.run จากหน้า Upload (same-origin ไม่ติด CORS)
 * ไฟล์นี้ถูก append เข้า Code.gs ตอน deploy (pattern ZZ_*)
 */

/** อ่านไฟล์ 1 ครั้ง → คืน { wb, names } */
function gReadWorkbook_(file) {
  var tempId = convertToGoogleSheet_(file);
  try {
    var ss = SpreadsheetApp.openById(tempId);
    var wb = {}, names = [];
    ss.getSheets().forEach(function (sh) { var nm = sh.getName(); names.push(nm); wb[nm] = sh.getDataRange().getValues(); });
    return { wb: wb, names: names };
  } finally { try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e) {} }
}

/** ตรวจประเภทอัตโนมัติ (1 กิจกรรม/ชมรม, 2 ผู้สอน, 3 อัตลักษณ์) แล้วสร้าง Excel+PDF */
function goldenAuto_(fileId) {
  var file = DriveApp.getFileById(fileId);
  var base = file.getName().replace(/\.[^.]+$/, '');
  var rd = gReadWorkbook_(file);
  var wb = rd.wb, names = rd.names;

  // ประเภทที่ 1: กิจกรรม/ชมรม (คู่ (ชมรมX)+X)
  var t1 = parseGoldenActivity_(wb, names);
  if (t1 && t1.length) {
    var o1 = goldenExportFromResults_(t1, base);
    return {
      ok: true, type: 'กิจกรรม/ชมรม (ประเภท 1)', typeKey: 'goldenexport', file: file.getName(), count: t1.length,
      summary: t1.map(function (x) { return { กิจกรรม: x.activity, ผู้ตอบ: x.respondents, ข้อ: x.itemCount, X: x.total.X, SD: x.total.SD, พึงพอใจ: x.satisfactionPct + '%' }; }),
      outputUrl: o1.url, xlsxBase64: o1.xlsxBase64, pdfBase64: o1.pdfBase64
    };
  }
  // ประเภทที่ 2: ผู้สอนรายวิชา
  var t2 = parseGoldenInstructor_(wb, names);
  if (t2 && t2.length) {
    var o2 = goldenType2ExportFromResults_(t2, base);
    return {
      ok: true, type: 'ผู้สอนรายวิชา (ประเภท 2)', typeKey: 'goldentype2', file: file.getName(), count: t2.length,
      summary: t2.map(function (x) { return { ผู้สอน: x.instructor, จับคู่: x.matched, ผู้ตอบ: x.respondents, ข้อ: x.itemCount, X: x.total.X, SD: x.total.SD, พึงพอใจ: x.satisfactionPct + '%' }; }),
      outputUrl: o2.url, xlsxBase64: o2.xlsxBase64, pdfBase64: o2.pdfBase64
    };
  }
  // ประเภทที่ 3: อัตลักษณ์ งาม/สง่า
  var t3 = parseGoldenIdentity_(wb, names);
  if (t3 && t3.ok) {
    var o3 = goldenType3ExportFromResults_(t3, base);
    return {
      ok: true, type: 'อัตลักษณ์ งาม/สง่า (ประเภท 3)', typeKey: 'goldentype3', file: file.getName(),
      count: 1 + t3.yearCount, questionCount: t3.questionCount,
      summary: [t3.overall].concat(t3.years).map(function (x) { return { รายงาน: x.label, ผู้ตอบ: x.respondents, งามX: x.byDim['งาม'].X, สง่าX: x.byDim['สง่า'].X, รวมX: x.total.X, พึงพอใจ: x.satisfactionPct + '%' }; }),
      outputUrl: o3.url, xlsxBase64: o3.xlsxBase64, pdfBase64: o3.pdfBase64
    };
  }
  return {
    ok: false, file: file.getName(), sheets: names,
    error: 'ไฟล์นี้ยังไม่เข้าเกณฑ์ golden ทั้ง 3 ประเภท — ตรวจว่ามี: คู่ sheet (ชมรมX)+X | sheet ชื่ออาจารย์+รายงาน | sheet ข้อคำถาม+ปีN. หากเป็นไฟล์ดิบทั่วไป ใช้ปุ่ม "อัปโหลด + ประมวลผล" แทน'
  };
}

/** ?action=goldenauto[&fileId=] — auto ตรวจประเภทจากไฟล์ในคิว Drive แล้วสร้างรายงาน (ไม่ลบไฟล์ต้นฉบับ) */
function goldenAutoQueue_(fileId) {
  var file;
  if (fileId) file = DriveApp.getFileById(fileId);
  else {
    var it = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID).getFiles();
    while (it.hasNext()) { var f = it.next(); if (isSupported_(f.getName()) && f.getSize() > 0) { file = f; break; } }
  }
  if (!file) return { ok: false, error: 'ไม่พบไฟล์ที่รองรับในคิว 00_วางไฟล์ที่นี่' };
  var r = goldenAuto_(file.getId());
  r.action = 'goldenauto';
  return r;
}

/** handler สำหรับ google.script.run: อัปโหลด → สร้างรายงาน golden → คืน base64 ให้ดาวน์โหลด */
function uploadAndGolden(form) {
  if (!form || !form.rawFile) throw new Error('ไม่พบไฟล์ rawFile');
  var blob = form.rawFile;
  var name = blob.getName() || 'raw_upload.xlsx';
  if (!isSupported_(name)) throw new Error('รองรับเฉพาะ .xlsx, .xls, .csv, .tsv');
  var saved = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID).createFile(blob).setName(name);
  try {
    var r = goldenAuto_(saved.getId());
    try { appendLog_(name, r.ok ? 'GOLDEN_OK' : 'GOLDEN_REVIEW', r.type || '', 'uploadAndGolden', '', ''); } catch (e) {}
    return r;
  } finally {
    try { saved.setTrashed(true); } catch (e) {}   // ไม่เก็บไฟล์ดิบไว้รกคิว (output อยู่ใน SUMMARY แล้ว)
  }
}
