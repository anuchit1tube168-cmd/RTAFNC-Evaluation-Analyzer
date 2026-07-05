/**
 * RTAFNC v6 — exportreal (ประมวลผลไฟล์จริงในคิว แล้วคืน Excel+PDF base64)
 * ไฟล์นี้ถูก append เข้า Code.gs ตอน deploy (pattern เดียวกับ ZZ_* อื่น)
 * ไม่ย้ายไฟล์ต้นฉบับ ไม่บันทึก output ถาวร (ลบ temp + output ทิ้ง)
 * route ถูกเพิ่มใน ZZ_V6_ApiGet_Override.gs (?action=exportreal[&fileId=])
 */
function exportPdfBytes_(spreadsheetId, gid) {
  const params = [
    'format=pdf', 'size=A4', 'portrait=false', 'fitw=true', 'scale=4',
    'sheetnames=false', 'printtitle=false', 'pagenumbers=true', 'gridlines=false', 'fzr=false',
    'top_margin=0.35', 'bottom_margin=0.35', 'left_margin=0.25', 'right_margin=0.25',
    'gid=' + encodeURIComponent(gid)
  ].join('&');
  const url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?' + params;
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) throw new Error('PDF export failed: HTTP ' + res.getResponseCode());
  return res.getBlob().getBytes();
}

function exportXlsxBytes_(spreadsheetId) {
  const url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?format=xlsx';
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) throw new Error('XLSX export failed: HTTP ' + res.getResponseCode());
  return res.getBlob().getBytes();
}

function exportRealFile_(fileId) {
  let file;
  if (fileId) { file = DriveApp.getFileById(fileId); }
  else {
    const it = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID).getFiles();
    while (it.hasNext()) { const f = it.next(); if (isSupported_(f.getName()) && f.getSize() > 0) { file = f; break; } }
  }
  if (!file) return { ok: false, error: 'ไม่พบไฟล์ที่รองรับในคิว' };
  const tempId = convertToGoogleSheet_(file);
  try {
    const analysis = analyzeSheet_(tempId, file.getName(), '');
    const output = createOutputWorkbook_(analysis);
    const gate = pRunQaGate_(analysis, output.groups);
    let pdfB64 = '', xlsxB64 = '', err = '';
    try {
      pdfB64 = Utilities.base64Encode(exportPdfBytes_(output.spreadsheetId, output.groups[0].printGid));
      xlsxB64 = Utilities.base64Encode(exportXlsxBytes_(output.spreadsheetId));
    } catch (e) { err = String(e); }
    finally { try { DriveApp.getFileById(output.spreadsheetId).setTrashed(true); } catch (e2) {} }
    return {
      ok: !err, action: 'exportreal', version: 'v6-source-driven-reports',
      file: file.getName(), fileId: file.getId(),
      qaStatus: gate.status, qaFailures: gate.failures, qaWarnings: gate.warnings,
      category: analysis.category, parseMode: analysis.parseMode,
      itemCount: (analysis.items || []).length, respondentCount: analysis.respondentCount,
      years: analysis.years, duplicates: (analysis.duplicates || []).length, invalidCount: analysis.invalidCount,
      sampleItems: (analysis.items || []).slice(0, 6).map(function (it) { return it.no + ' ' + it.text; }),
      pdfGroups: output.groups.map(function (g) { return { label: g.label, source: g.source, hasData: g.hasData, n: g.respondentCount }; }),
      xlsxBase64: xlsxB64, pdfBase64: pdfB64, error: err,
      note: 'ประมวลผลจากไฟล์จริงในคิว ไม่ย้ายไฟล์/ไม่บันทึกถาวร (ลบ temp+output ทิ้ง) — ใช้ action=process เพื่อประมวลผลจริง'
    };
  } finally {
    try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e) {}
  }
}
