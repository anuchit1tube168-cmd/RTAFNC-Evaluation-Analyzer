/**
 * RTAFNC Evaluation Analyzer Backend v6 — Source-driven reports
 * Controller: Apps Script Web App + Google Drive + Google Sheets
 * Parser dependency: Parser_v5.gs
 * Core v6 rule: do not invent class-year reports. Create per-class reports only when source data has year values.
 */

const CONFIG = {
  ACADEMIC_YEAR: '2568',
  PENDING_FOLDER_ID: '1fNEzh_47BmVwuNLY3tgnYq0Jy7RsFaue',
  PROCESSED_FOLDER_ID: '1-NaYdq2IctITmzIWU4M5V-WIEH3Fvst9',
  UNKNOWN_FOLDER_ID: '1k0PZGZwOpqSv5ejECSg_4r1Sn2nQcvKT',
  SUMMARY_FOLDER_ID: '1KwKq-T4zbHHNSux1VMWQ7pInO8g_s-kU',
  PDF_FOLDER_ID: '1FpdEpkRbde6RI3DGsfpGV09ahUOz3vxz',
  KEEP_TEMP_SHEETS: false,
  MAX_FILES_PER_RUN: 5,
  ROUND_MODE: 'ROUND',
  REPORT_FONT: 'TH Sarabun PSK',
  REPORT_FONT_FALLBACK: 'TH Sarabun New'
};

const CATEGORY_RULES = [
  { category: 'นภาภิบาล', regex: /(นภาภิบาล|ฝึกร่วม\s*4\s*ชั้นปี|การฝึกทหารร่วม)/i },
  { category: 'คุณลักษณะทางทหาร', regex: /(คุณลักษณะทางทหาร|อัตลักษณ์)/i },
  { category: 'เดินทางไกล', regex: /(เดินทางไกล)/i },
  { category: 'ทหาร_1_4', regex: /(การฝึกทหาร|ฝึกทหาร)/i },
  { category: 'จิตอาสา', regex: /(จิตอาสา)/i },
  { category: 'เจตคติ', regex: /(เจตคติ)/i },
  { category: 'อาจารย์ที่ปรึกษา', regex: /(อาจารย์ที่ปรึกษา)/i },
  { category: 'SMART_NURSE', regex: /(SMART|NURSE|สมาร์ท)/i },
  { category: 'อุทธรณ์ร้องทุกข์', regex: /(อุทธรณ์|ร้องทุกข์)/i },
  { category: 'การรักษาความลับ', regex: /(รักษาความลับ|ความลับ)/i },
  { category: 'บริการข้อมูล', regex: /(บริการข้อมูล|ข้อมูลข่าวสาร)/i },
  { category: 'สุขภาพชมรมกีฬา', regex: /(สุขภาพ|ชมรมกีฬา|กีฬา)/i },
  { category: 'สร้างสรรค์กล้าหาญอดทน', regex: /(สร้างสรรค์|กล้าหาญ|อดทน)/i }
];

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action || p.callback) return apiGet_(p);
  return HtmlService.createHtmlOutput(buildUploadPage_())
    .setTitle('RTAFNC Evaluation Analyzer')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiGet_(p) {
  let result;
  try {
    const action = p.action || 'health';
    if (action === 'list') result = { ok: true, files: listPendingFiles() };
    else if (action === 'process') result = processPendingRawFiles();
    else if (action === 'test') result = processOneFile_(DriveApp.getFileById(p.fileId), p.category || '');
    else if (action === 'peek') result = peekFile_(p.fileId);
    else if (action === 'selftest') result = selfTest_();
    else result = getHealth_();
  } catch (err) {
    result = { ok: false, error: String(err && err.stack ? err.stack : err) };
  }
  return jsonp_(result, p.callback);
}

function getHealth_() {
  return {
    ok: true,
    version: 'v6-source-driven-reports',
    parser: 'wide-matrix-v1',
    rule: 'per-class reports only when class-year source exists',
    uploadUi: ScriptApp.getService().getUrl(),
    driveAdvancedAvailable: !!(typeof Drive !== 'undefined' && Drive.Files),
    time: new Date().toISOString()
  };
}

function jsonp_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function selfTest_() {
  const checks = [];
  function check(name, cond, detail) { checks.push({ name: name, pass: !!cond, detail: detail || '' }); }
  try {
    const header = ['เลขที่', 'รหัสนักศึกษา', 'ชื่อ', 'สกุล', 'ชั้นปี', '1.1 ตั้งใจเรียน', '1.2 ส่งงาน', 'ข้อเสนอแนะ'];
    const values = [header, [1, '6301', 'กชกร', 'ใจดี', 'ชั้นปีที่ 1', 5, 4, 'อาจารย์สอนดี'], [2, '6302', 'สมชาย', 'ดี', 'ปี 2', 4, 3, 'เวลาน้อยไป']];
    const display = values.map(r => r.map(c => String(c)));
    const p = parseEvaluationMatrix_(values, display);
    check('parser พบตาราง matrix', p.found === true);
    check('ใช้ข้อความคำถามจริง', p.items[0].text === '1.1 ตั้งใจเรียน', p.items[0].text);
    check('ผู้ตอบ = 2', p.respondentCount === 2, 'n=' + p.respondentCount);
    check('clean ชื่อไทย', p.respondents[0].name === 'กชกร ใจดี', p.respondents[0].name);
    const a = buildAnalysisFromParsed_('selftest.xlsx', { category: 'ทดสอบ', confidence: 1 }, 'Self Test', 'Sheet1', p, 'selftest.xlsx');
    const groups = buildSourceDrivenReportGroups_(a);
    check('สร้างรวม + ปีที่มี source เท่านั้น', groups.length === 3, 'groups=' + groups.map(g => g.label).join(','));
    check('ไม่สร้างปี 3/4 ที่ไม่มี source', groups.every(g => g.key !== '3' && g.key !== '4'));
  } catch (err) {
    check('เกิดข้อผิดพลาด', false, String(err && err.stack ? err.stack : err));
  }
  const passed = checks.filter(c => c.pass).length;
  return { ok: true, action: 'selftest', version: 'v6-source-driven-reports', passed, total: checks.length, allPass: passed === checks.length, checks };
}

function getSystemStatus() {
  return { ok: true, version: 'v6-source-driven-reports', pendingFiles: listPendingFiles(), health: getHealth_() };
}

function uploadOnly(form) {
  if (!form || !form.rawFile) throw new Error('ไม่พบไฟล์ rawFile');
  const blob = form.rawFile;
  const originalName = blob.getName() || 'raw_upload.xlsx';
  if (!isSupported_(originalName)) throw new Error('รองรับเฉพาะ .xlsx, .xls, .csv, .tsv');
  const saved = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID).createFile(blob).setName(originalName);
  appendLog_(originalName, 'UPLOADED', 'รอประมวลผล', 'uploaded via web ui', '', '');
  return { ok: true, status: 'UPLOADED', file: originalName, fileId: saved.getId(), url: saved.getUrl() };
}

function uploadAndProcess(form) {
  if (!form || !form.rawFile) throw new Error('ไม่พบไฟล์ rawFile');
  const blob = form.rawFile;
  const originalName = blob.getName() || 'raw_upload.xlsx';
  if (!isSupported_(originalName)) throw new Error('รองรับเฉพาะ .xlsx, .xls, .csv, .tsv');
  const saved = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID).createFile(blob).setName(originalName);
  const result = processOneFile_(saved, form.categoryOverride || '');
  result.uploadedFileId = saved.getId();
  return result;
}

function listPendingFiles() {
  const folder = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID);
  const it = folder.getFiles();
  const rows = [];
  while (it.hasNext()) {
    const f = it.next();
    rows.push({ id: f.getId(), name: f.getName(), mimeType: f.getMimeType(), size: f.getSize(), url: f.getUrl(), supported: isSupported_(f.getName()) });
  }
  return rows;
}

function processPendingRawFiles() {
  const folder = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID);
  const it = folder.getFiles();
  const results = [];
  let count = 0;
  while (it.hasNext() && count < CONFIG.MAX_FILES_PER_RUN) {
    const f = it.next();
    if (!isSupported_(f.getName())) { results.push({ file: f.getName(), status: 'SKIP', message: 'not supported' }); continue; }
    count++;
    try { results.push(processOneFile_(f, '')); }
    catch (err) { results.push({ file: f.getName(), status: 'ERROR', message: String(err) }); appendLog_(f.getName(), 'ERROR', '99_ไม่ทราบประเภท', String(err), '', ''); }
  }
  return { ok: true, processed: results.length, results, finishedAt: new Date().toISOString() };
}

function processOneFile_(file, categoryOverride) {
  const tempId = convertToGoogleSheet_(file);
  const analysis = analyzeSheet_(tempId, file.getName(), categoryOverride);
  if (analysis.category === '99_ไม่ทราบประเภท' || analysis.confidence < 0.55 || !analysis.items.length || !analysis.respondents.length) {
    moveFile_(file, CONFIG.PENDING_FOLDER_ID, CONFIG.UNKNOWN_FOLDER_ID);
    if (!CONFIG.KEEP_TEMP_SHEETS) DriveApp.getFileById(tempId).setTrashed(true);
    appendLog_(file.getName(), 'NEEDS_REVIEW', analysis.category, 'low confidence or no valid source-driven data', '', '');
    return { ok: true, file: file.getName(), status: 'NEEDS_REVIEW', category: analysis.category, confidence: analysis.confidence, message: 'ย้ายไป 99_ไม่ทราบประเภท' };
  }
  const output = createOutputWorkbook_(analysis);
  const pdfResults = [];
  output.groups.forEach(g => {
    const pdf = exportPdf_(output.spreadsheetId, safeName_(analysis.safeName + '_' + g.label) + '.pdf', g.printGid);
    pdfResults.push({ label: g.label, url: pdf.url, hasData: g.hasData, source: g.source });
  });
  moveFile_(file, CONFIG.PENDING_FOLDER_ID, CONFIG.PROCESSED_FOLDER_ID);
  if (!CONFIG.KEEP_TEMP_SHEETS) DriveApp.getFileById(tempId).setTrashed(true);
  appendLog_(file.getName(), 'SUCCESS', analysis.category, 'processed v6 source-driven groups', output.url, pdfResults.map(p => p.url).join('\n'));
  return {
    ok: true,
    file: file.getName(),
    status: 'SUCCESS',
    version: 'v6-source-driven-reports',
    category: analysis.category,
    confidence: analysis.confidence,
    itemCount: analysis.items.length,
    respondents: analysis.respondents.length,
    classYearSource: analysis.classYearSource,
    outputSpreadsheetUrl: output.url,
    pdfUrls: pdfResults,
    pdfCount: pdfResults.length
  };
}

function convertToGoogleSheet_(file) {
  const blob = file.getBlob();
  const name = '_TEMP_' + file.getName().replace(/\.(xlsx|xls|csv|tsv)$/i, '') + '_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
  if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.create) {
    const created = Drive.Files.create({ name: name, mimeType: MimeType.GOOGLE_SHEETS }, blob, { fields: 'id,name,mimeType' });
    return created.id;
  }
  return convertToGoogleSheetViaUrlFetch_(blob, name);
}

function convertToGoogleSheetViaUrlFetch_(blob, name) {
  const boundary = 'rtafnc_boundary_' + new Date().getTime();
  const metadata = { name: name, mimeType: MimeType.GOOGLE_SHEETS };
  const delimiter = '\r\n--' + boundary + '\r\n';
  const close = '\r\n--' + boundary + '--';
  const part1 = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter + 'Content-Type: ' + (blob.getContentType() || 'application/octet-stream') + '\r\n\r\n';
  const payload = Utilities.newBlob(part1).getBytes().concat(blob.getBytes()).concat(Utilities.newBlob(close).getBytes());
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType', {
    method: 'post', contentType: 'multipart/related; boundary=' + boundary,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload, muteHttpExceptions: true
  });
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) throw new Error('Drive API convert failed: HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText()).id;
}

function analyzeSheet_(spreadsheetId, rawName, categoryOverride) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheets = ss.getSheets();
  let allText = '';
  let best = null;
  let firstDisplay = null;
  sheets.forEach((sh, s) => {
    const values = sh.getDataRange().getValues();
    const display = sh.getDataRange().getDisplayValues();
    if (s === 0) firstDisplay = display;
    allText += ' ' + sh.getName() + ' ' + display.flat().filter(Boolean).join(' ');
    const parsed = parseEvaluationMatrix_(values, display);
    if (parsed.found && (!best || parsed.quality > best.parsed.quality)) best = { sheet: sh, values, display, parsed };
  });
  const cat = categoryOverride ? { category: categoryOverride, confidence: 1 } : classify_(rawName + ' ' + allText);
  const safeName = safeName_(['ผลวิเคราะห์', cat.category, 'ปีการศึกษา_' + CONFIG.ACADEMIC_YEAR, Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss')].join('_'));
  if (best) return buildAnalysisFromParsed_(rawName, cat, detectTitle_(best.display) || detectTitle_(firstDisplay) || rawName, best.sheet.getName(), best.parsed, safeName);
  const display = firstDisplay || [];
  const values = sheets.length ? sheets[0].getDataRange().getValues() : [];
  const rawItems = detectItems_(display);
  const scoreRows = detectScoreRows_(values);
  const itemStats = computeItemStats_(rawItems, scoreRows);
  const respondents = scoreRows.map(r => ({ rowIndex: r.row, seq: '', id: '', name: r.label, email: '', year: '', yearSource: 'none', comment: '', scores: r.scores, validCount: r.scores.filter(v => typeof v === 'number').length }));
  const all = [];
  scoreRows.forEach(r => r.scores.forEach(v => { if (typeof v === 'number') all.push(v); }));
  return { rawName, category: cat.category, confidence: cat.confidence, title: detectTitle_(display) || rawName, items: rawItems.map((it,i)=>({ no: it.no, code: pItemCode_(it.no)||String(i+1), text: it.text, col: null, row: it.row })), itemStats, scoreRows, respondents, overallMean: all.length ? mean_(all) : 0, overallSd: all.length > 1 ? sdSample_(all) : 0, invalidCount: detectInvalidScores_(values), parseMode: 'legacy', sheetName: sheets.length ? sheets[0].getName() : '', respondentCount: respondents.length, duplicates: [], years: [], classYearSource: 'none', safeName };
}

function buildAnalysisFromParsed_(rawName, cat, title, sheetName, p, safeName) {
  const items = p.items.map(it => ({ no: it.no, code: it.code || it.no, text: it.text, col: it.col, row: it.col + 1 }));
  const itemStats = p.itemStats.map(x => ({ no: x.no, code: x.code || x.no, text: x.text, col: x.col, row: x.col + 1, n: x.n, mean: x.mean, sd: x.sd, level: x.level }));
  const hasYearSource = p.respondents.some(r => r.year);
  p.respondents.forEach(r => { r.yearSource = r.year ? ('source column in ' + sheetName) : 'none'; });
  return { rawName, category: cat.category, confidence: cat.confidence, title, items, itemStats, scoreRows: p.scoreRows, respondents: p.respondents, overallMean: p.overallMean, overallSd: p.overallSd, invalidCount: p.invalidCount, parseMode: 'wide', sheetName, respondentCount: p.respondentCount, duplicates: p.duplicates, years: p.years, classYearSource: hasYearSource ? ('source column in ' + sheetName) : 'none', safeName };
}

function buildSourceDrivenReportGroups_(a) {
  const respondents = a.respondents || [];
  const groups = [{ key: 'รวม', label: a.classYearSource === 'none' ? 'รายงานรวมทั้งหมด (ไม่พบ source ชั้นปี)' : 'รายงานรวมทั้งหมด', sheet: 'Print_Report_รวม', pdf: 'รายงานรวม', year: null, source: 'all respondents', subset: respondents }];
  const yearMap = {};
  respondents.forEach(r => { if (r.year && /^[1-4]$/.test(String(r.year))) { yearMap[r.year] = yearMap[r.year] || []; yearMap[r.year].push(r); } });
  ['1','2','3','4'].forEach(y => {
    if (yearMap[y] && yearMap[y].length) groups.push({ key: y, label: 'ชั้นปีที่ ' + y, sheet: 'Print_Report_ปี' + y, pdf: 'รายงานชั้นปีที่ ' + y, year: y, source: 'class year from source data', subset: yearMap[y] });
  });
  return groups.map(g => ({ def: g, subset: g.subset, stats: pComputeItemStatsForRespondents_(a.items || [], g.subset), overall: pOverallStats_(g.subset), hasData: g.subset.length > 0, key: g.key, label: g.label, year: g.year, source: g.source }));
}

function createOutputWorkbook_(a) {
  const ss = SpreadsheetApp.create(a.safeName);
  const file = DriveApp.getFileById(ss.getId());
  DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID).addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch(e) {}
  const cover = ss.getSheets()[0].setName('Cover');
  const executive = ss.insertSheet('Executive_Summary');
  const dash = ss.insertSheet('Dashboard');
  const dict = ss.insertSheet('Item_Dictionary');
  const items = ss.insertSheet('Items_X_SD');
  const indiv = ss.insertSheet('Individual_All_Items');
  const classMap = ss.insertSheet('Class_Source_Map');
  const comments = pAnalyzeComments_(a.respondents || []);
  const commentsSheet = comments.total > 0 ? ss.insertSheet('Comments_Themes') : null;
  const qa = ss.insertSheet('QA_Log');
  const groups = buildSourceDrivenReportGroups_(a);
  writeCover_(cover, a);
  writeExecutive_(executive, a, comments);
  writeDashboard_(dash, a, groups);
  writeItemDictionary_(dict, a);
  writeItems_(items, a.itemStats || []);
  writeIndividualAllItems_(indiv, a);
  writeClassSourceMap_(classMap, a, groups);
  if (commentsSheet) writeCommentsThemes_(commentsSheet, comments);
  writeQa_(qa, a, groups, comments);
  const printSheets = groups.map(gr => { const sh = ss.insertSheet(gr.def.sheet); writePrintGroup_(sh, a, gr, comments); applyPrintGroupStyle_(sh); return { group: gr, sheet: sh }; });
  [cover, executive, dash, dict, items, indiv, classMap, qa].concat(commentsSheet ? [commentsSheet] : []).forEach(applyStyle_);
  SpreadsheetApp.flush();
  return { spreadsheetId: ss.getId(), url: ss.getUrl(), groups: printSheets.map(ps => ({ key: ps.group.key, label: ps.group.label, year: ps.group.year, source: ps.group.source, printGid: ps.sheet.getSheetId(), respondentCount: ps.group.subset.length, hasData: ps.group.hasData })) };
}

function writeCover_(sh, a) {
  sh.clear();
  sh.getRange('A1:H1').merge().setValue('รายงานผลการประเมิน');
  sh.getRange('A2:H2').merge().setValue('วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ');
  sh.getRange('A4:B13').setValues([['หัวรายงาน', a.title], ['หมวดงาน', a.category], ['ปีการศึกษา', CONFIG.ACADEMIC_YEAR], ['ไฟล์ต้นฉบับ', a.rawName], ['วันที่ประมวลผล', new Date()], ['จำนวนข้อประเมิน', a.items.length], ['จำนวนผู้ตอบ', a.respondents.length], ['X รวม', round2_(a.overallMean)], ['SD รวม', round2_(a.overallSd)], ['แหล่งข้อมูลชั้นปี', a.classYearSource]]);
}

function writeExecutive_(sh, a, comments) {
  sh.clear();
  sh.getRange('A1:H1').merge().setValue('Executive Summary');
  sh.getRange('A3:B10').setValues([['หัวรายงาน', a.title], ['หมวดงาน', a.category], ['จำนวนข้อประเมิน', a.items.length], ['จำนวนผู้ตอบ', a.respondents.length], ['ค่าเฉลี่ยรวม (X)', round2_(a.overallMean)], ['SD รวม', round2_(a.overallSd)], ['ระดับผลประเมิน', level_(a.overallMean)], ['ข้อคิดเห็น', comments.total ? comments.total + ' ราย' : 'ไม่พบ']]);
  sh.getRange('A12:H12').merge().setValue('ข้อเสนอแนะโดยรวม: ใช้ข้อที่ค่าเฉลี่ยต่ำสุดและข้อคิดเห็นประกอบการปรับปรุง รายละเอียดอยู่ใน Print_Report และ QA_Log');
}

function writeDashboard_(sh, a, groups) {
  sh.clear();
  sh.getRange('A1:H1').merge().setValue('RTAFNC Evaluation Analyzer — Dashboard');
  sh.getRange('A3:B13').setValues([['รายการ','ผลลัพธ์'], ['ชื่อไฟล์',a.rawName], ['หมวด',a.category], ['Confidence',a.confidence], ['หัวรายงาน',a.title], ['จำนวนข้อ',a.items.length], ['จำนวนผู้ตอบ',a.respondents.length], ['X',round2_(a.overallMean)], ['SD',round2_(a.overallSd)], ['แหล่งข้อมูลชั้นปี',a.classYearSource], ['PDF ที่สร้าง', groups.length + ' ไฟล์']]);
}

function writeItemDictionary_(sh, a) {
  sh.clear();
  sh.getRange(1,1,1,9).setValues([['ลำดับ','รหัสข้อ','ข้อความคำถามเต็ม','ข้อความย่อสำหรับรายคน','ประเภทคำถาม','sourceSheet','sourceRow','sourceColumn','หมายเหตุ QA']]);
  const rows = (a.itemStats || []).map((x,i) => [i+1, x.code || x.no, x.text, pShortText_(x.code || x.no, x.text, 30), 'score 1-5', a.sheetName || '', x.row || '', x.col != null ? col_(x.col+1) : '', isBadItemText_(x.text) ? 'REVIEW: bad item text' : 'PASS']);
  if (rows.length) sh.getRange(2,1,rows.length,9).setValues(rows);
  sh.getRange('C:D').setWrap(true);
}

function writeItems_(sh, itemStats) {
  sh.clear();
  sh.getRange(1,1,1,9).setValues([['ลำดับ','รหัสข้อ','ข้อความคำถามเต็ม','N','X','SD','ระดับ','sourceColumn','QA']]);
  const rows = itemStats.map((x,i)=>[i+1, x.code || x.no, x.text, x.n, x.mean, x.sd, x.level, x.col != null ? col_(x.col+1) : (x.row || ''), isBadItemText_(x.text) ? 'REVIEW' : 'PASS']);
  if (rows.length) sh.getRange(2,1,rows.length,9).setValues(rows);
  sh.getRange('C:C').setWrap(true);
}

function writeIndividualAllItems_(sh, a) {
  sh.clear();
  const items = a.items || [];
  const respondents = a.respondents || [];
  const headers = ['ลำดับ','รหัส/เลขที่','ชื่อ-สกุล','อีเมล','ชั้นปี','แหล่งข้อมูลชั้นปี','ตอบ/ทั้งหมด'].concat(items.map(it => pShortText_(it.code || it.no, it.text, 24))).concat(['X','SD','ระดับ','ทะเบียน','ข้อคิดเห็นรวม','QA รายบุคคล']);
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  const data = respondents.map((p,i) => {
    const scores = items.map((it,k) => pIsValidScore_(p.scores[k]) ? p.scores[k] : '');
    const st = pPersonStats_(p.scores || []);
    return [i+1, p.id || p.seq || '', p.name || '', p.email || '', p.year || '', p.yearSource || 'none', st.n + '/' + items.length].concat(scores).concat([st.n ? st.mean : '', st.n ? st.sd : '', st.level, p.rowIndex ? 'row'+p.rowIndex : '', p.comment || '', st.n === items.length ? 'PASS' : 'REVIEW']);
  });
  if (data.length) sh.getRange(2,1,data.length,headers.length).setValues(data);
  sh.setFrozenColumns(3);
}

function writeClassSourceMap_(sh, a, groups) {
  sh.clear();
  sh.getRange(1,1,1,6).setValues([['กลุ่มรายงาน','สร้าง PDF หรือไม่','จำนวนผู้ตอบ','แหล่งข้อมูลชั้นปี','สถานะ','หมายเหตุ']]);
  const rows = groups.map(g => [g.label, 'YES', g.subset.length, g.source || 'all respondents', 'PASS', g.year ? 'สร้างเพราะพบปี ' + g.year + ' ใน source' : 'รายงานรวม']);
  if (a.classYearSource === 'none') rows.push(['รายงานแยกปี 1-4', 'NO', 0, 'ไม่พบ source ชั้นปี', 'SKIPPED/REVIEW', 'ห้ามสร้างรายงานแยกปีโดยเดาเอง']);
  if (rows.length) sh.getRange(2,1,rows.length,6).setValues(rows);
}

function writeQa_(sh, a, groups, commentAnalysis) {
  sh.clear();
  const badItems = (a.items || []).filter(it => isBadItemText_(it.text));
  const gate = pRunQaGate_(a, groups);
  const failures = [].concat(gate.failures || []);
  if (badItems.length) failures.push('พบหัวข้อประเมินไม่ใช่ข้อความคำถามจริง ' + badItems.length + ' ข้อ');
  const status = failures.length ? 'REVIEW' : 'PASS';
  const rows = [
    ['รายการ','ผล','รายละเอียด','วิธีแก้ถ้า REVIEW'],
    ['QA Gate', status, failures.length ? failures.join('; ') : 'ผ่านเกณฑ์หลัก', 'แก้ failures ก่อนใช้ทางราชการ'],
    ['โหมดอ่านข้อมูล', a.parseMode === 'wide' ? 'PASS' : 'REVIEW', a.parseMode, 'ต้องอ่าน Microsoft Forms/Excel แบบหัวคอลัมน์คำถามให้ได้'],
    ['Item_Dictionary', a.items.length ? 'PASS' : 'REVIEW', a.items.length + ' ข้อ', 'ต้องมีคำถามเต็มทุกข้อ'],
    ['Individual_All_Items', a.respondents.length ? 'PASS' : 'REVIEW', a.respondents.length + ' ราย', 'ต้องมีคะแนนรายข้อพร้อมคำถามกำกับ'],
    ['แหล่งข้อมูลชั้นปี', a.classYearSource === 'none' ? 'INFO' : 'PASS', a.classYearSource, 'ถ้าไม่มี source ห้ามสร้างรายงานแยกปี'],
    ['PDF ที่สร้าง', 'PASS', groups.map(g => g.label).join(', '), 'สร้างเฉพาะกลุ่มที่มีข้อมูลจริง'],
    ['ข้อคิดเห็น', commentAnalysis.total ? 'PASS' : 'INFO', commentAnalysis.total + ' ราย', 'ถ้ามีข้อคิดเห็นต้องเก็บใน Comments_Themes'],
    ['Q1/คอลัมน์_4', badItems.length ? 'REVIEW' : 'PASS', badItems.length ? badItems.map(x=>x.text).slice(0,5).join(', ') : 'ไม่พบ', 'แก้หัวคอลัมน์คำถามต้นทางหรือ mapping Golden Example']
  ];
  sh.getRange(1,1,rows.length,4).setValues(rows);
}

function writeCommentsThemes_(sh, ca) {
  sh.clear();
  sh.getRange('A1:E1').merge().setValue('สรุปข้อคิดเห็น');
  sh.getRange(2,1,1,5).setValues([['ธีม','จำนวน','ร้อยละ','ตัวอย่างข้อความ','ข้อเสนอแนะเชิงปรับปรุง']]);
  const rows = (ca.themes || []).map(t => [t.theme, t.count, t.percent + '%', t.examples.join('  //  '), 'พิจารณาปรับปรุงประเด็น: ' + t.theme]);
  if (rows.length) sh.getRange(3,1,rows.length,5).setValues(rows);
  sh.getRange('D:E').setWrap(true);
}

function writePrintGroup_(sh, a, gr, comments) {
  sh.clear();
  const label = gr.label;
  const o = gr.overall;
  sh.getRange('A1:H1').merge().setValue('รายงานผลการประเมิน ปีการศึกษา ' + CONFIG.ACADEMIC_YEAR);
  sh.getRange('A2:H2').merge().setValue('วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ');
  sh.getRange('A3:H3').merge().setValue(a.title);
  sh.getRange('A4:H4').merge().setValue('กลุ่มรายงาน: ' + label + ' | หมวดงาน: ' + a.category + ' | Source: ' + gr.source);
  sh.getRange('A5:H5').merge().setValue('เกณฑ์การประเมิน: 5 = มากที่สุด, 4 = มาก, 3 = ปานกลาง, 2 = น้อย, 1 = น้อยที่สุด');
  sh.getRange('A6:H6').merge().setValue('จำนวนผู้ตอบ ' + o.respondents + ' คน | จำนวนข้อ ' + a.items.length + ' ข้อ | X = ' + (o.n ? o.mean.toFixed(2) : '-') + ' | SD = ' + (o.n ? o.sd.toFixed(2) : '-') + ' | ระดับ ' + (o.level || '-'));
  sh.getRange('A7:H7').merge().setValue('ตารางสรุปรายข้อประเมิน (X / SD รายข้อ)');
  sh.getRange(8,1,1,8).setValues([['ลำดับ','รหัสข้อ','ข้อความคำถาม','N','X','SD','ระดับ','หมายเหตุ']]);
  const rows = gr.stats.map((x,i)=>[i+1, x.code || x.no, x.text, x.n, x.n ? x.mean : '', x.n ? x.sd : '', x.level, isBadItemText_(x.text) ? 'REVIEW' : '']);
  if (rows.length) {
    sh.getRange(9,1,rows.length,8).setValues(rows);
    sh.getRange(8,1,rows.length+1,8).setBorder(true,true,true,true,true,true,'#B7C3D6',SpreadsheetApp.BorderStyle.SOLID);
    try { sh.getRange(9,1,rows.length,8).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY,false,false); } catch(e){}
  }
  let r = 10 + rows.length;
  sh.getRange(r,1,1,8).merge().setValue('ข้อเสนอแนะการปรับปรุง'); r++;
  buildRecommendations_(gr.stats, comments, gr.year === null).forEach(t => { sh.getRange(r,1,1,8).merge().setValue(t); r++; });
  r++;
  sh.getRange(r,1,1,8).merge().setValue('ภาคผนวก: สรุปรายบุคคล (รายละเอียดคะแนนรายข้อครบอยู่ใน Excel: Individual_All_Items)').setFontWeight('bold'); r++;
  const apxHeader = r;
  sh.getRange(r,1,1,8).setValues([['ลำดับ','รหัส/เลขที่','ชื่อ-สกุล','ชั้นปี','X','ระดับ','','ข้อคิดเห็น']]);
  sh.getRange(r,1,1,8).setFontWeight('bold').setBackground('#EAF3FF').setHorizontalAlignment('center'); r++;
  const people = gr.subset.slice(0,200).map((p,i)=>{ const st=pPersonStats_(p.scores||[]); return [i+1,p.id||p.seq||'',p.name||'',p.year||'',st.n?st.mean:'',st.level,'',p.comment||'']; });
  if (people.length) {
    sh.getRange(r,1,people.length,8).setValues(people);
    sh.getRange(apxHeader,1,people.length+1,8).setBorder(true,true,true,true,true,true,'#B7C3D6',SpreadsheetApp.BorderStyle.SOLID);
    try { sh.getRange(r,1,people.length,8).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY,false,false); } catch(e){}
  }
  r += people.length + 2;
  sh.getRange(r,1,1,8).merge().setValue('หมายเหตุ QA: รายงานนี้ไม่สร้างหรือแยกชั้นปีจากการเดาเอง ทุกชั้นปีต้องมี source ใน Class_Source_Map'); r += 2;
  ['ผู้รับการประเมิน','หน.ผปค.วพอ.พอ.'].forEach(role => { sh.getRange(r,1,1,8).merge().setValue('ลงชื่อ ....................................................................'); r++; sh.getRange(r,1,1,8).merge().setValue('( .................................................................... )'); r++; sh.getRange(r,1,1,8).merge().setValue(role); r += 2; });
}

function buildRecommendations_(stats, commentAnalysis, includeComments) {
  const out = [];
  const low = pLowestItems_(stats, 3);
  if (!low.length) return ['ยังไม่มีข้อมูลเพียงพอสำหรับข้อเสนอแนะการปรับปรุง'];
  low.forEach((s,i)=>out.push((i+1)+'. ควรพัฒนา/ปรับปรุง ' + pShortText_(s.code || s.no, s.text, 48) + ' (X = ' + s.mean.toFixed(2) + ', ระดับ ' + s.level + ')'));
  if (includeComments && commentAnalysis && commentAnalysis.total > 0 && commentAnalysis.themes.length) out.push('ประเด็นเด่นจากข้อคิดเห็น: ' + commentAnalysis.themes[0].theme + ' (' + commentAnalysis.themes[0].count + ' ราย)');
  return out;
}

function exportPdf_(spreadsheetId, name, gid) {
  const params = ['format=pdf','size=A4','portrait=false','fitw=true','scale=4','sheetnames=false','printtitle=false','pagenumbers=true','gridlines=false','fzr=false','top_margin=0.30','bottom_margin=0.30','left_margin=0.25','right_margin=0.25','gid=' + encodeURIComponent(gid)].join('&');
  const url = 'https://docs.google.com/spreadsheets/d/'+spreadsheetId+'/export?'+params;
  const res = UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()}, muteHttpExceptions:true});
  if (res.getResponseCode() >= 300) throw new Error('PDF export failed: HTTP '+res.getResponseCode()+' '+res.getContentText().slice(0,200));
  const pdf = DriveApp.getFolderById(CONFIG.PDF_FOLDER_ID).createFile(res.getBlob().setName(name));
  return { id: pdf.getId(), url: pdf.getUrl() };
}

function peekFile_(fileId) {
  let file;
  if (fileId) file = DriveApp.getFileById(fileId);
  else { const it = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID).getFiles(); while (it.hasNext()) { const f = it.next(); if (isSupported_(f.getName()) && f.getSize() > 0) { file = f; break; } } }
  if (!file) return { ok:false, error:'ไม่พบไฟล์ที่รองรับในคิว' };
  const tempId = convertToGoogleSheet_(file);
  try {
    const ss = SpreadsheetApp.openById(tempId);
    const result = { ok:true, file:file.getName(), sheets:[], best:null };
    ss.getSheets().forEach(sh => {
      const v = sh.getDataRange().getValues(), d = sh.getDataRange().getDisplayValues();
      const p = parseEvaluationMatrix_(v,d);
      result.sheets.push({ name:sh.getName(), rows:v.length, cols:(v[0]||[]).length, found:p.found, itemCount:p.items ? p.items.length : 0, respondentCount:p.respondentCount || 0, years:p.years || [], sample:d.slice(0,5) });
      if (p.found && (!result.best || p.quality > result.best.quality)) result.best = { sheet:sh.getName(), quality:p.quality, itemCount:p.items.length, respondentCount:p.respondentCount, years:p.years, firstItems:p.items.slice(0,5).map(x=>x.text) };
    });
    return result;
  } finally { if (!CONFIG.KEEP_TEMP_SHEETS) DriveApp.getFileById(tempId).setTrashed(true); }
}

function applyStyle_(sh){
  const lr=Math.max(sh.getLastRow(),1), lc=Math.max(sh.getLastColumn(),1);
  sh.getRange(1,1,lr,lc).setFontFamily(CONFIG.REPORT_FONT).setFontSize(14).setWrap(true).setVerticalAlignment('middle');
  sh.getRange(1,1,1,lc).setBackground('#0B2347').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
  sh.setFrozenRows(1);
  for(let c=1;c<=Math.min(lc,40);c++) sh.autoResizeColumn(c);
  try{sh.getDataRange().createFilter();}catch(e){}
}

function applyPrintGroupStyle_(sh){
  sh.setHiddenGridlines(true);
  const lr=Math.max(sh.getLastRow(),1);
  sh.getRange(1,1,lr,8).setFontFamily(CONFIG.REPORT_FONT).setFontSize(13).setWrap(true).setVerticalAlignment('middle');
  sh.getRange('A1:H2').setHorizontalAlignment('center').setFontWeight('bold');
  sh.getRange('A1:H1').setFontSize(21).setBackground('#0B2347').setFontColor('#FFFFFF');
  sh.getRange('A2:H2').setFontSize(17).setBackground('#EAF3FF').setFontColor('#0B2347');
  sh.getRange('A2:H2').setBorder(null,null,true,null,null,null,'#D6A94A',SpreadsheetApp.BorderStyle.SOLID_THICK);
  sh.getRange('A6:H6').setBorder(null,null,true,null,null,null,'#B7C3D6',SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('A7:H8').setHorizontalAlignment('center').setFontWeight('bold').setBackground('#0B2347').setFontColor('#FFFFFF');
  [44,62,430,48,68,58,90,130].forEach((w,i)=>sh.setColumnWidth(i+1,w));
  sh.getRange('D:H').setHorizontalAlignment('center');
}

function detectTitle_(display){for(let r=0;r<Math.min(20,(display||[]).length);r++){for(let c=0;c<display[r].length;c++){const s=String(display[r][c]||'').trim();if(s.length>25 && /(ผลการประเมิน|แบบประเมิน|วิทยาลัยพยาบาลทหารอากาศ|นภาภิบาล)/.test(s)) return s;}}return '';}
function detectItems_(display){const out=[],seen={};(display||[]).forEach((row,idx)=>{const txt=row.filter(Boolean).join(' ').trim();let m=txt.match(/^(\d+(?:\.\d+)?)\s+(.{8,})$/);if(m&&!seen[m[1]]){seen[m[1]]=1;out.push({no:m[1],text:m[2],row:idx+1});}});return out;}
function detectScoreRows_(values){const out=[];(values||[]).forEach((row,idx)=>{const scores=row.map(score_).filter(v=>v!==null);if(scores.length>=3)out.push({row:idx+1,label:String(row[0]||('Row '+(idx+1))),scores});});return out;}
function computeItemStats_(items, scoreRows){return (items||[]).map((item,i)=>{const scores=[];(scoreRows||[]).forEach(r=>{if(typeof r.scores[i]==='number')scores.push(r.scores[i]);});const m=scores.length?mean_(scores):0;const sd=scores.length>1?sdSample_(scores):0;return{no:item.no,code:pItemCode_(item.no)||item.no,text:item.text,row:item.row,n:scores.length,mean:round2_(m),sd:round2_(sd),level:level_(m)};});}
function classify_(text){for(const r of CATEGORY_RULES){if(r.regex.test(text))return{category:r.category,confidence:.9};}return{category:'99_ไม่ทราบประเภท',confidence:.2};}
function isSupported_(name){return/\.(xlsx|xls|csv|tsv)$/i.test(name);}
function score_(v){if(typeof v==='number'&&v>=1&&v<=5)return v;const s=String(v||'').trim();return/^[1-5](\.0+)?$/.test(s)?Number(s):null;}
function detectInvalidScores_(values){let n=0;(values||[]).flat().forEach(v=>{if(typeof v==='number'&&isFinite(v)&&v>5&&v<10)n++;});return n;}
function mean_(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}
function sdSample_(a){if(a.length<2)return 0;const m=mean_(a);return Math.sqrt(a.reduce((s,v)=>s+Math.pow(v-m,2),0)/(a.length-1));}
function round2_(v){return Math.round((v+Number.EPSILON)*100)/100;}
function level_(m){if(m>=4.51)return'มากที่สุด';if(m>=3.51)return'มาก';if(m>=2.51)return'ปานกลาง';if(m>=1.51)return'น้อย';return'น้อยที่สุด';}
function safeName_(s){return String(s).replace(/[\\\/:*?"<>|#%{}~&]/g,'_').replace(/\s+/g,'_').slice(0,160);}
function col_(n){let s='';while(n>0){let m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=(n-m-1)/26;}return s;}
function isBadItemText_(s){s=String(s||'').trim();return !s || /^(Q\d+|ข้อ\s*\d+|คอลัมน์[_\s]*\d+|Column\s*\d+)$/i.test(s) || s.length < 3;}
function moveFile_(file, fromId, toId){DriveApp.getFolderById(toId).addFile(file);try{DriveApp.getFolderById(fromId).removeFile(file);}catch(e){}}

function appendLog_(file,status,cat,msg,sheetUrl,pdfUrl){
  const folder=DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID);
  const name='RTAFNC_Evaluation_Process_Log_'+CONFIG.ACADEMIC_YEAR;
  let ss;const it=folder.getFilesByName(name);
  if(it.hasNext()) ss=SpreadsheetApp.openById(it.next().getId());
  else { ss=SpreadsheetApp.create(name); const f=DriveApp.getFileById(ss.getId()); folder.addFile(f); try{DriveApp.getRootFolder().removeFile(f);}catch(e){} ss.getActiveSheet().setName('Log'); ss.getActiveSheet().appendRow(['timestamp','file','status','category','message','sheetUrl','pdfUrl']); }
  ss.getSheetByName('Log').appendRow([new Date(),file,status,cat,msg,sheetUrl,pdfUrl]);
}

function buildUploadPage_(){
  return '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RTAFNC Upload</title></head><body style="font-family:TH Sarabun PSK,Sarabun,Tahoma,sans-serif;background:#f4f7fb;padding:24px;font-size:20px"><div style="max-width:980px;margin:auto;background:white;border-radius:22px;padding:24px"><h1>RTAFNC Evaluation Analyzer v6</h1><p>Source-driven: ไม่เดาแยกชั้นปี, อ่านคำถามจริงทุกข้อ, สร้าง Excel รายละเอียดครบ และ PDF print-ready</p><form id="f"><input type="file" name="rawFile" accept=".xlsx,.xls,.csv,.tsv" required><select name="categoryOverride"><option value="">ให้ระบบจำแนกอัตโนมัติ</option><option>นภาภิบาล</option><option>คุณลักษณะทางทหาร</option><option>เดินทางไกล</option><option>ทหาร_1_4</option><option>จิตอาสา</option><option>เจตคติ</option><option>อาจารย์ที่ปรึกษา</option></select><p><button type="button" onclick="upOnly()">อัปโหลดอย่างเดียว</button><button type="button" onclick="upProcess()">อัปโหลด + ประมวลผล</button><button type="button" onclick="status()">สถานะ</button><button type="button" onclick="processQ()">ประมวลผลคิว</button></p></form><pre id="out">พร้อมใช้งาน</pre></div><script>function p(x){document.getElementById("out").textContent=JSON.stringify(x,null,2)}function err(e){p({error:String(e&&e.message?e.message:e)})}function upOnly(){google.script.run.withSuccessHandler(p).withFailureHandler(err).uploadOnly(document.getElementById("f"))}function upProcess(){google.script.run.withSuccessHandler(p).withFailureHandler(err).uploadAndProcess(document.getElementById("f"))}function status(){google.script.run.withSuccessHandler(p).withFailureHandler(err).getSystemStatus()}function processQ(){google.script.run.withSuccessHandler(p).withFailureHandler(err).processPendingRawFiles()}status();<\/script></body></html>';
}
