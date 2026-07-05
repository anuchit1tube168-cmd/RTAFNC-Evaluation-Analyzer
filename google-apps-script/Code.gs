/**
 * RTAFNC Evaluation Analyzer Backend v5 — Per-class reports (print-safe)
 * Frontend Portal: GitHub Pages
 * Backend: Apps Script Web App + Google Drive + Google Sheets
 * Parser: Parser_v5.gs (wide-matrix) with legacy fallback
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

// กลุ่มรายงาน: รวมชั้นปี 1-4 และแยกรายชั้นปี 1..4 (Phase 3/4)
const REPORT_GROUPS = [
  { key: 'รวม', label: 'รวมชั้นปีที่ 1-4', sheet: 'Print_Report_รวม', pdf: 'รายงานรวมชั้นปีที่ 1-4', year: null },
  { key: '1', label: 'ชั้นปีที่ 1', sheet: 'Print_Report_ปี1', pdf: 'รายงานชั้นปีที่ 1', year: '1' },
  { key: '2', label: 'ชั้นปีที่ 2', sheet: 'Print_Report_ปี2', pdf: 'รายงานชั้นปีที่ 2', year: '2' },
  { key: '3', label: 'ชั้นปีที่ 3', sheet: 'Print_Report_ปี3', pdf: 'รายงานชั้นปีที่ 3', year: '3' },
  { key: '4', label: 'ชั้นปีที่ 4', sheet: 'Print_Report_ปี4', pdf: 'รายงานชั้นปีที่ 4', year: '4' }
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
    else if (action === 'selftest') result = selfTest_();
    else if (action === 'selfexport') result = selfExport_();
    else result = getHealth_();
  } catch (err) {
    result = { ok: false, error: String(err && err.stack ? err.stack : err) };
  }
  return jsonp_(result, p.callback);
}

function getHealth_() {
  const driveAdvancedAvailable = (typeof Drive !== 'undefined' && Drive.Files);
  return {
    ok: true,
    version: 'v5-per-class-reports',
    parser: 'wide-matrix-v1',
    uploadUi: ScriptApp.getService().getUrl(),
    driveAdvancedAvailable: !!driveAdvancedAvailable,
    fallbackConversion: 'UrlFetchApp Drive API multipart upload',
    time: new Date().toISOString()
  };
}

function jsonp_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Self-test: ตรวจว่า Parser v5 + QA Gate ทำงานบน deployment จริงได้
 * โดยใช้ข้อมูลจำลอง (ไม่แตะ Drive) เรียกผ่าน ?action=selftest
 */
function selfTest_() {
  const checks = [];
  function check(name, cond, detail) { checks.push({ name: name, pass: !!cond, detail: detail || '' }); }
  try {
    const header = ['เลขที่', 'รหัสนักศึกษา', 'ชื่อ', 'สกุล', 'ชั้นปี', '1.1 ตั้งใจเรียน', '1.2 ส่งงาน', 'ข้อเสนอแนะ'];
    const data = [
      [1, '6301', 'กชกร', 'ใจดี', 'ชั้นปีที่ 1', 5, 4, 'อาจารย์สอนดีมาก'],
      [2, '6302', 'สมชาย', 'ดี', 'ปี 2', 4, 3, 'เวลาน้อยไป'],
      [3, '6301', 'กชกร', 'ใจดี', 'ชั้นปีที่ 1', 5, 5, 'ไม่มี']
    ];
    const values = [header].concat(data);
    const display = values.map(function (r) { return r.map(function (c) { return String(c); }); });
    const p = parseEvaluationMatrix_(values, display);
    check('parser โหลดและพบตาราง matrix', p.found === true);
    check('คอลัมน์คะแนน = 2 (metadata ไม่ถูกนับ)', p.items.length === 2, 'items=' + p.items.length);
    check('ใช้ข้อความคำถามจริง ไม่ใช่ Q1', p.items[0].text === '1.1 ตั้งใจเรียน', p.items[0].text);
    check('ผู้ตอบ = 3', p.respondentCount === 3, 'n=' + p.respondentCount);
    check('จับผู้ตอบซ้ำ (6301)', (p.duplicates || []).length === 1);
    check('clean ชื่อไทย (รวมชื่อ+สกุล)', p.respondents[0].name === 'กชกร ใจดี', p.respondents[0].name);
    check('จับชั้นปีได้', p.years.length >= 2, JSON.stringify(p.years));
    const ca = pAnalyzeComments_(p.respondents);
    check('ข้อคิดเห็นมีสาระ = 2 (ตัด "ไม่มี")', ca.total === 2, 'total=' + ca.total);
    const items = p.items.map(function (it) { return { no: it.no, code: it.code, text: it.text, col: it.col }; });
    const groups = REPORT_GROUPS.map(function (g) {
      const subset = g.year ? p.respondents.filter(function (r) { return r.year === g.year; }) : p.respondents;
      return { def: g, hasData: subset.length > 0 };
    });
    const gate = pRunQaGate_({ items: items, respondents: p.respondents, invalidCount: p.invalidCount, duplicates: p.duplicates, parseMode: 'wide' }, groups);
    check('QA Gate ทำงาน', gate.status === 'PASS' || gate.status === 'REVIEW', gate.status);
  } catch (err) {
    check('เกิดข้อผิดพลาด', false, String(err && err.stack ? err.stack : err));
  }
  const passed = checks.filter(function (c) { return c.pass; }).length;
  return { ok: true, action: 'selftest', version: 'v5-per-class-reports', passed: passed, total: checks.length, allPass: passed === checks.length, checks: checks };
}

function getSystemStatus() {
  return {
    ok: true,
    version: 'v5-per-class-reports',
    pendingFiles: listPendingFiles(),
    health: getHealth_(),
    folders: {
      pending: CONFIG.PENDING_FOLDER_ID,
      processed: CONFIG.PROCESSED_FOLDER_ID,
      unknown: CONFIG.UNKNOWN_FOLDER_ID,
      summary: CONFIG.SUMMARY_FOLDER_ID,
      pdf: CONFIG.PDF_FOLDER_ID
    }
  };
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
  if (analysis.category === '99_ไม่ทราบประเภท' || analysis.confidence < 0.55) {
    moveFile_(file, CONFIG.PENDING_FOLDER_ID, CONFIG.UNKNOWN_FOLDER_ID);
    if (!CONFIG.KEEP_TEMP_SHEETS) DriveApp.getFileById(tempId).setTrashed(true);
    appendLog_(file.getName(), 'NEEDS_REVIEW', analysis.category, 'category confidence low', '', '');
    return { ok: true, file: file.getName(), status: 'NEEDS_REVIEW', category: analysis.category, confidence: analysis.confidence, message: 'ย้ายไป 99_ไม่ทราบประเภท' };
  }
  const output = createOutputWorkbook_(analysis);
  const pdfs = output.groups.map(g => {
    const p = exportPdf_(output.spreadsheetId, safeName_(g.pdfName + '_ปีการศึกษา_' + CONFIG.ACADEMIC_YEAR) + '.pdf', g.printGid);
    return { key: g.key, label: g.label, name: g.pdfName, hasData: g.hasData, url: p.url, id: p.id };
  });
  const missingYears = output.groups.filter(g => g.year !== null && !g.hasData).map(g => g.label);
  const gate = pRunQaGate_(analysis, output.groups || []);
  moveFile_(file, CONFIG.PENDING_FOLDER_ID, CONFIG.PROCESSED_FOLDER_ID);
  if (!CONFIG.KEEP_TEMP_SHEETS) DriveApp.getFileById(tempId).setTrashed(true);
  appendLog_(file.getName(), 'SUCCESS', analysis.category, 'processed (' + pdfs.length + ' PDFs, QA=' + gate.status + (gate.failures.length ? ': ' + gate.failures.join(', ') : '') + ')', output.url, pdfs.length ? pdfs[0].url : '');
  return { ok: true, file: file.getName(), status: 'SUCCESS', qaStatus: gate.status, qaFailures: gate.failures, qaWarnings: gate.warnings, category: analysis.category, confidence: analysis.confidence, parseMode: analysis.parseMode, respondentCount: analysis.respondentCount, duplicateCount: (analysis.duplicates || []).length, itemCount: analysis.items.length, scoreRows: analysis.scoreRows.length, mean: round2_(analysis.overallMean), sd: round2_(analysis.overallSd), outputSpreadsheetUrl: output.url, pdfUrl: pdfs.length ? pdfs[0].url : '', pdfUrls: pdfs.map(p => ({ name: p.name, hasData: p.hasData, url: p.url })), missingYears: missingYears };
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
  const part1 = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata);
  const part2 = delimiter + 'Content-Type: ' + (blob.getContentType() || 'application/octet-stream') + '\r\n\r\n';
  const payload = Utilities.newBlob(part1).getBytes().concat(blob.getBytes()).concat(Utilities.newBlob(close).getBytes());
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType', {
    method: 'post',
    contentType: 'multipart/related; boundary=' + boundary,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: payload,
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code < 200 || code >= 300) throw new Error('Drive API convert failed: HTTP ' + code + ' ' + text.slice(0, 300));
  const created = JSON.parse(text);
  return created.id;
}

function analyzeSheet_(spreadsheetId, rawName, categoryOverride) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheets = ss.getSheets();

  // อ่านทุก sheet ไม่ใช่ sheet แรกอย่างเดียว แล้วเลือกชีตที่ parse แบบ matrix ได้ดีที่สุด (Parser v5)
  let allText = '';
  let best = null;           // { sheet, values, display, parsed }
  let firstDisplay = null;
  for (let s = 0; s < sheets.length; s++) {
    const sh = sheets[s];
    const values = sh.getDataRange().getValues();
    const display = sh.getDataRange().getDisplayValues();
    if (s === 0) firstDisplay = display;
    allText += ' ' + display.flat().filter(Boolean).join(' ');
    const parsed = parseEvaluationMatrix_(values, display);
    if (parsed.found && (!best || parsed.quality > best.parsed.quality)) {
      best = { sheet: sh, values: values, display: display, parsed: parsed };
    }
  }

  const cat = categoryOverride ? { category: categoryOverride, confidence: 1 } : classify_(rawName + ' ' + allText);
  const safeName = safeName_(['ผลวิเคราะห์', cat.category, 'ปีการศึกษา_' + CONFIG.ACADEMIC_YEAR, Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd')].join('_'));

  if (best) {
    const p = best.parsed;
    const items = p.items.map(it => ({ no: it.no, code: it.code, text: it.text, col: it.col, row: it.col + 1 }));
    const itemStats = p.itemStats.map(x => ({ no: x.no, code: x.code, text: x.text, col: x.col, row: x.col + 1, n: x.n, mean: x.mean, sd: x.sd, level: x.level }));
    return {
      rawName: rawName, category: cat.category, confidence: cat.confidence,
      title: detectTitle_(best.display) || detectTitle_(firstDisplay) || rawName,
      items: items, itemStats: itemStats, scoreRows: p.scoreRows, respondents: p.respondents,
      overallMean: p.overallMean, overallSd: p.overallSd, invalidCount: p.invalidCount,
      parseMode: 'wide', sheetName: best.sheet.getName(),
      respondentCount: p.respondentCount, duplicates: p.duplicates, years: p.years,
      hasRankColumn: p.hasRankColumn, safeName: safeName
    };
  }

  // Fallback: รูปแบบเดิม (หัวข้อเป็นแถว) เมื่อไม่พบตาราง matrix
  const display = firstDisplay || [];
  const values = sheets.length ? sheets[0].getDataRange().getValues() : [];
  const rawItems = detectItems_(display);
  const items = rawItems.map(it => ({ no: it.no, code: pItemCode_(it.no) || pItemCode_(it.text), text: it.text, col: null, row: it.row }));
  const scoreRows = detectScoreRows_(values);
  const itemStats = computeItemStats_(rawItems, scoreRows).map(x => ({ no: x.no, code: pItemCode_(x.no) || pItemCode_(x.text), text: x.text, col: null, row: x.row, n: x.n, mean: x.mean, sd: x.sd, level: x.level }));
  const all = [];
  scoreRows.forEach(r => r.scores.forEach(v => all.push(v)));
  const overallMean = all.length ? mean_(all) : 0;
  const overallSd = all.length > 1 ? sdSample_(all) : 0;
  // สร้าง respondents แบบเรียบง่ายจาก scoreRows เพื่อให้ Individual_All_Items ทำงานได้
  const respondents = scoreRows.map(r => ({ rowIndex: r.row, seq: '', id: '', name: r.label, email: '', year: '', rank: '', comment: '', scores: r.scores, validCount: r.scores.filter(v => typeof v === 'number').length }));
  return {
    rawName: rawName, category: cat.category, confidence: cat.confidence,
    title: detectTitle_(display) || rawName,
    items: items, itemStats: itemStats, scoreRows: scoreRows, respondents: respondents,
    overallMean: overallMean, overallSd: overallSd, invalidCount: detectInvalidScores_(values),
    parseMode: 'legacy', sheetName: sheets.length ? sheets[0].getName() : '',
    respondentCount: scoreRows.length, duplicates: [], years: [],
    hasRankColumn: false, safeName: safeName
  };
}

function computeItemStats_(items, scoreRows) {
  return items.map((item, i) => {
    const scores = [];
    scoreRows.forEach(r => { if (typeof r.scores[i] === 'number') scores.push(r.scores[i]); });
    const m = scores.length ? mean_(scores) : 0;
    const sd = scores.length > 1 ? sdSample_(scores) : 0;
    return { no: item.no, text: item.text, row: item.row, n: scores.length, mean: round2_(m), sd: round2_(sd), level: level_(m) };
  });
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
  const rows = ss.insertSheet('ScoreRows');

  // วิเคราะห์ข้อคิดเห็น และเตรียมข้อมูลแยกกลุ่มชั้นปี
  const commentAnalysis = pAnalyzeComments_(a.respondents || []);
  const groups = REPORT_GROUPS.map(g => {
    const subset = g.year ? (a.respondents || []).filter(r => r.year === g.year) : (a.respondents || []);
    return {
      def: g, subset: subset,
      stats: pComputeItemStatsForRespondents_(a.items || [], subset),
      overall: pOverallStats_(subset),
      hasData: subset.length > 0
    };
  });

  writeCover_(cover, a);
  writeExecutive_(executive, a);
  writeDashboard_(dash, a);
  writeItemDictionary_(dict, a);
  writeItems_(items, a.itemStats);
  writeIndividualAllItems_(indiv, a);
  writeScoreRows_(rows, a.scoreRows);

  // Comments_Themes เฉพาะเมื่อมีข้อคิดเห็น (ห้ามทิ้งข้อความ)
  let commentsSheet = null;
  if (commentAnalysis.total > 0) {
    commentsSheet = ss.insertSheet('Comments_Themes');
    writeCommentsThemes_(commentsSheet, commentAnalysis);
  }

  const qa = ss.insertSheet('QA_Log');
  writeQa_(qa, a, groups, commentAnalysis);

  // Print_Report รายกลุ่ม (รวม + รายชั้นปี 1-4)
  const printSheets = [];
  groups.forEach(gr => {
    const sh = ss.insertSheet(gr.def.sheet);
    writePrintGroup_(sh, a, gr, commentAnalysis);
    printSheets.push({ group: gr, sheet: sh });
  });

  const dataSheets = [cover, executive, dash, dict, items, indiv, rows, qa].concat(commentsSheet ? [commentsSheet] : []);
  dataSheets.forEach(applyStyle_);
  printSheets.forEach(ps => applyPrintGroupStyle_(ps.sheet));
  SpreadsheetApp.flush();

  const groupsMeta = printSheets.map(ps => ({
    key: ps.group.def.key, label: ps.group.def.label, year: ps.group.def.year,
    pdfName: ps.group.def.pdf, printGid: ps.sheet.getSheetId(),
    respondentCount: ps.group.subset.length, hasData: ps.group.hasData
  }));
  return { spreadsheetId: ss.getId(), url: ss.getUrl(), groups: groupsMeta };
}

function writeCover_(sh, a) {
  sh.clear();
  sh.getRange('A1:H1').merge().setValue('รายงานผลการประเมิน');
  sh.getRange('A2:H2').merge().setValue('วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ');
  sh.getRange('A4:B12').setValues([
    ['หัวรายงาน', a.title], ['หมวดงาน', a.category], ['ปีการศึกษา', CONFIG.ACADEMIC_YEAR], ['ไฟล์ต้นฉบับ', a.rawName], ['วันที่ประมวลผล', new Date()], ['จำนวนข้อประเมิน', a.items.length], ['จำนวนแถวคะแนน', a.scoreRows.length], ['X รวม', round2_(a.overallMean)], ['SD รวม', round2_(a.overallSd)]
  ]);
  sh.getRange('A14:H14').merge().setValue('หมายเหตุ: ใช้ร่วมกับ QA_Log และ Print_Report ก่อนนำไปใช้ทางราชการ');
}

function writeExecutive_(sh, a) {
  sh.clear();
  sh.getRange('A1:H1').merge().setValue('Executive Summary');
  sh.getRange('A3:B10').setValues([
    ['หมวดงาน', a.category], ['จำนวนข้อประเมิน', a.items.length], ['จำนวนแถวคะแนน', a.scoreRows.length], ['ค่าเฉลี่ยรวม (X)', round2_(a.overallMean)], ['ส่วนเบี่ยงเบนมาตรฐาน (SD)', round2_(a.overallSd)], ['ระดับผลประเมิน', level_(a.overallMean)], ['Confidence', a.confidence], ['QA Status', a.invalidCount === 0 ? 'PASS' : 'REVIEW']
  ]);
  sh.getRange('A12:H12').merge().setValue('ข้อเสนอแนะ: ตรวจสอบรายการ REVIEW ใน QA_Log และตรวจ PDF ว่าตารางไม่ถูกตัดก่อนพิมพ์จริง');
}

function writeDashboard_(sh, a) {
  sh.clear();
  sh.getRange('A1:H1').merge().setValue('RTAFNC Evaluation Analyzer — Dashboard');
  sh.getRange('A3:B12').setValues([
    ['รายการ','ผลลัพธ์'], ['ชื่อไฟล์',a.rawName], ['หมวด',a.category], ['Confidence',a.confidence], ['หัวรายงาน',a.title], ['จำนวนข้อ',a.items.length], ['จำนวนแถวคะแนน',a.scoreRows.length], ['X',round2_(a.overallMean)], ['SD',round2_(a.overallSd)], ['QA',a.invalidCount === 0 ? 'PASS' : 'REVIEW']
  ]);
}

function writeItems_(sh, itemStats) {
  sh.clear();
  sh.getRange(1,1,1,8).setValues([['ลำดับ','รหัสข้อ','ข้อความประเมิน','N','X','SD','ระดับ','sourceRow']]);
  if (itemStats.length) {
    sh.getRange(2,1,itemStats.length,8).setValues(itemStats.map((x,i)=>[i+1,x.no,x.text,x.n,x.mean,x.sd,x.level,x.row]));
  }
  sh.getRange('C:C').setWrap(true); // ข้อความคำถามยาว ต้อง wrap ไม่ตัดทิ้ง
}

/** Item_Dictionary: รหัสข้อ + ข้อความเต็ม + ข้อความย่อ + sourceColumn + N (จำนวนต้องตรงกับคะแนนรายข้อ) */
function writeItemDictionary_(sh, a) {
  sh.clear();
  sh.getRange(1,1,1,5).setValues([['รหัสข้อ','ข้อความคำถามเต็ม','ข้อความย่อ (ใช้ในหัวตารางรายคน)','sourceColumn','N']]);
  const stats = a.itemStats || [];
  if (stats.length) {
    const rows = stats.map(x => [
      x.no,
      x.text,
      pShortText_(x.code, x.text, 28),
      (x.col != null ? col_(x.col + 1) : (x.row || '')),
      x.n
    ]);
    sh.getRange(2,1,rows.length,5).setValues(rows);
  }
  sh.getRange('B:C').setWrap(true);
}

/**
 * Individual_All_Items: รายบุคคล 1 แถว พร้อมคะแนนรายข้อครบทุกข้อ
 * หัวคะแนนรายข้อ = รหัสข้อ + ข้อความคำถามย่อ, มี X/SD/ระดับรายบุคคล (ค่าคำนวณจริง)
 */
function writeIndividualAllItems_(sh, a) {
  sh.clear();
  const items = a.items || [];
  const respondents = a.respondents || [];
  const headers = ['ลำดับ','รหัส/ทะเบียน','ชื่อ-สกุล','ชั้นปี']
    .concat(items.map(it => pShortText_(it.code, it.text, 22)))
    .concat(['X','SD','ระดับ','ข้อคิดเห็น']);
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  if (!respondents.length) { sh.getRange(2,1).setValue('ไม่พบข้อมูลรายบุคคล'); return; }
  const nItems = items.length;
  const data = respondents.map((p, i) => {
    const scores = [];
    for (let k = 0; k < nItems; k++) {
      const v = p.scores ? p.scores[k] : '';
      scores.push(pIsValidScore_(v) ? v : '');
    }
    const st = pPersonStats_(p.scores || []);
    return [i + 1, p.id || p.seq || '', p.name || '', p.year || '']
      .concat(scores)
      .concat([st.n ? st.mean : '', st.n ? st.sd : '', st.level, p.comment || '']);
  });
  sh.getRange(2,1,data.length,headers.length).setValues(data);
  sh.setFrozenColumns(3);
}

function writeScoreRows_(sh, rows) {
  sh.clear();
  const max = Math.max(0, ...rows.map(r=>r.scores.length));
  const headers = ['sourceRow','label'];
  for (let i=1;i<=max;i++) headers.push('ข้อ'+i);
  headers.push('X','SD','ระดับ');
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  if (!rows.length) return;
  sh.getRange(2,1,rows.length,headers.length).setValues(rows.map(r=>{ const arr=[r.row,r.label].concat(r.scores); while(arr.length<2+max) arr.push(''); arr.push('','',''); return arr; }));
  for (let i=0;i<rows.length;i++) {
    const row = 2+i, first=3, last=2+max, meanCol=3+max, sdCol=4+max, levelCol=5+max;
    const start = col_(first)+row, end=col_(last)+row, meanCell=col_(meanCol)+row;
    // IFERROR กันกรณีผู้ตอบข้อเดียว/แถวว่าง ไม่ให้เกิด #DIV/0! หรือ #VALUE! ที่ QA ห้าม
    sh.getRange(row, meanCol).setFormula('=IFERROR('+CONFIG.ROUND_MODE+'(AVERAGE('+start+':'+end+'),2),"")');
    sh.getRange(row, sdCol).setFormula('=IFERROR('+CONFIG.ROUND_MODE+'(STDEV.S('+start+':'+end+'),2),"")');
    sh.getRange(row, levelCol).setFormula('=IF(NOT(ISNUMBER('+meanCell+')),"",IF('+meanCell+'>=4.51,"มากที่สุด",IF('+meanCell+'>=3.51,"มาก",IF('+meanCell+'>=2.51,"ปานกลาง",IF('+meanCell+'>=1.51,"น้อย","น้อยที่สุด")))))');
  }
}

function writeQa_(sh, a, groups, commentAnalysis) {
  sh.clear();
  const dupCount = (a.duplicates || []).length;
  const dupDetail = dupCount ? a.duplicates.map(d => d.key + ' x' + d.count).slice(0, 5).join(', ') : 'ไม่พบ';
  const yearDetail = (a.years && a.years.length) ? a.years.map(y => 'ปี' + y.year + '=' + y.count).join(', ') : 'ไม่พบข้อมูลชั้นปี';
  groups = groups || [];
  commentAnalysis = commentAnalysis || { total: 0, themes: [] };
  const yearGroups = groups.filter(g => g.def.year !== null);
  const yearRows = yearGroups.map(g => [
    'รายงาน' + g.def.label,
    g.hasData ? 'PASS' : 'REVIEW',
    g.hasData ? (g.subset.length + ' คน') : 'ไม่มีข้อมูล (สร้างรายงานเปล่าพร้อมหมายเหตุ)',
    g.hasData ? 'ตรวจ Print_Report_ปี' + g.def.key : 'ตรวจไฟล์ต้นฉบับว่ามีผู้ตอบชั้นปีนี้หรือไม่'
  ]);
  const gate = pRunQaGate_(a, groups);
  const gateDetail = gate.status === 'PASS'
    ? (gate.warnings.length ? ('ผ่าน (มีข้อควรตรวจ: ' + gate.warnings.join('; ') + ')') : 'ผ่านทุกเกณฑ์หลัก')
    : gate.failures.join('; ');
  const rows = [
    ['รายการ','ผล','รายละเอียด','วิธีแก้ถ้า REVIEW'],
    ['** สรุปผล QA Gate **', gate.status, gateDetail, 'แก้ทุก failures ให้หมดก่อนส่งราชการ'],
    ['โหมดอ่านข้อมูล', a.parseMode === 'wide' ? 'PASS' : 'REVIEW', a.parseMode === 'wide' ? ('matrix จากชีต ' + (a.sheetName || '')) : 'legacy (หัวข้อเป็นแถว)', 'ถ้า legacy ให้ตรวจว่าไฟล์ต้นฉบับมีหัวคอลัมน์ข้อประเมิน'],
    ['จำแนกหมวด',a.confidence>=.55?'PASS':'REVIEW',a.category,'เลือกหมวดเองหรือเพิ่ม regex rule'],
    ['พบข้อคำถาม',a.items.length?'PASS':'REVIEW',a.items.length,'ตรวจรูปแบบข้อ 1.1 / 1.2 ในไฟล์ต้นฉบับ'],
    ['หัวข้อเป็นข้อความจริง', a.items.length && a.items.every(it => String(it.text || '').trim().length >= 3) ? 'PASS' : 'REVIEW', 'ไม่ใช้ Q1/คอลัมน์_4', 'ตรวจว่าหัวคอลัมน์ในไฟล์ต้นฉบับมีข้อความคำถามครบ'],
    ['จำนวนผู้ตอบ', (a.respondentCount || a.scoreRows.length) ? 'PASS' : 'REVIEW', (a.respondentCount || a.scoreRows.length), 'ตรวจว่ามีแถวผู้ตอบที่มีคะแนน 1-5'],
    ['Item_Dictionary', (a.itemStats || []).length ? 'PASS' : 'REVIEW', 'จำนวนข้อ ' + (a.itemStats || []).length + ' (ต้องตรงกับคะแนนรายข้อ)', 'ตรวจว่าหัวคอลัมน์ข้อประเมินครบในไฟล์ต้นฉบับ'],
    ['Individual_All_Items', (a.respondents || []).length ? 'PASS' : 'REVIEW', 'รายคน ' + (a.respondents || []).length + ' คน พร้อมข้อความคำถามกำกับคะแนน', 'ถ้าไม่มีรายคน ตรวจว่ามีคอลัมน์คะแนนในไฟล์ต้นฉบับ'],
    ['ผู้ตอบซ้ำ', dupCount === 0 ? 'PASS' : 'REVIEW', dupDetail, 'ตรวจรหัส/อีเมล/ชื่อ ที่ซ้ำในไฟล์ต้นฉบับ'],
    ['ช่วงคะแนน 1-5',a.invalidCount===0?'PASS':'REVIEW',a.invalidCount,'แก้คะแนนผิดช่วงในไฟล์ต้นฉบับ'],
    ['สรุปชั้นปี', 'INFO', yearDetail, 'ใช้สำหรับแยกรายงานรายชั้นปีใน Phase 3'],
    ['สูตร X/SD','PASS',CONFIG.ROUND_MODE+'(...,2) + STDEV.S','ตรวจสูตรใน ScoreRows'],
    ['ฟอนต์','PASS',CONFIG.REPORT_FONT,'ถ้าเครื่องไม่มีฟอนต์ให้ใช้ TH Sarabun New'],
    ['PDF Print Safe','PASS','Export เฉพาะ Print_Report_* A4 landscape fit width','เปิด PDF ตรวจว่าตารางไม่ขาดก่อนพิมพ์'],
    ['คำเตือนราชการ','PASS','ต้องตรวจ QA_Log ก่อนใช้จริง','แนบ QA_Log เป็นหลักฐานตรวจสอบ']
  ];
  const extraRows = [
    ['รายงานรวมชั้นปี 1-4', (a.respondents || []).length ? 'PASS' : 'REVIEW', 'Print_Report_รวม + PDF', 'ตรวจว่ามีผู้ตอบอย่างน้อย 1 คน']
  ].concat(yearRows).concat([
    ['ตัดสรุปตามชั้นปีใน PDF', 'PASS', 'ใช้ไฟล์แยกรายชั้นปีแทน section สรุป', 'ตรวจว่า PDF ไม่มีตารางสรุปตามชั้นปีปนในไฟล์เดียว'],
    ['PDF ครบ 5 ไฟล์', groups.length === 5 ? 'PASS' : 'REVIEW', 'รวม + ปี1-4', 'export เฉพาะ gid ของ Print_Report_*'],
    ['ข้อเสนอแนะการปรับปรุง', 'PASS', 'สร้างจากข้อ X ต่ำสุด 3 ข้อ', 'ตรวจว่ามีหัวข้อข้อเสนอแนะในทุก Print_Report'],
    ['ช่องลายเซ็น 3 ช่อง', 'PASS', 'ผู้จัดทำ / ผู้ตรวจสอบ / ผู้อนุมัติ', 'ตรวจท้าย Print_Report ทุกไฟล์'],
    ['ข้อคิดเห็น (Comments_Themes)', commentAnalysis.total > 0 ? 'PASS' : 'INFO', commentAnalysis.total > 0 ? (commentAnalysis.total + ' ราย, ' + commentAnalysis.themes.length + ' ธีม') : 'ไม่พบข้อคิดเห็น จึงไม่สร้าง sheet', 'ถ้ามีข้อคิดเห็นต้องมี theme/จำนวน/ร้อยละ']
  ]);
  const finalRows = rows.concat(extraRows);
  sh.getRange(1,1,finalRows.length,4).setValues(finalRows);
}

/** สร้างข้อเสนอแนะการปรับปรุงจากข้อที่ X ต่ำสุด (+ ประเด็นข้อคิดเห็นถ้าเป็นรายงานรวม) */
function buildRecommendations_(stats, commentAnalysis, includeComments) {
  const out = [];
  const low = pLowestItems_(stats, 3);
  if (!low.length) {
    out.push('ยังไม่มีข้อมูลเพียงพอสำหรับข้อเสนอแนะการปรับปรุงในกลุ่มนี้');
    return out;
  }
  low.forEach((s, i) => {
    out.push((i + 1) + '. ควรพัฒนา/ปรับปรุง ' + pShortText_(s.code, s.text, 44) + '  (X = ' + s.mean.toFixed(2) + ', ระดับ ' + s.level + ')');
  });
  if (includeComments && commentAnalysis && commentAnalysis.total > 0 && commentAnalysis.themes.length) {
    const t = commentAnalysis.themes[0];
    out.push('ประเด็นเด่นจากข้อคิดเห็น: ' + t.theme + ' (' + t.count + ' ราย, ' + t.percent + '%)');
  }
  return out;
}

/** รายงานพิมพ์รายกลุ่ม: หัวรายงาน + สรุป + ตารางรายข้อ + ข้อเสนอแนะ + ช่องลายเซ็น 3 ช่อง */
function writePrintGroup_(sh, a, gr, commentAnalysis) {
  sh.clear();
  const label = gr.def.label;
  const o = gr.overall;
  sh.getRange('A1:H1').merge().setValue('รายงานผลการประเมิน ปีการศึกษา ' + CONFIG.ACADEMIC_YEAR);
  sh.getRange('A2:H2').merge().setValue('วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ');
  sh.getRange('A3:H3').merge().setValue(a.title);
  sh.getRange('A4:H4').merge().setValue('กลุ่มรายงาน: ' + label + '   |   หมวดงาน: ' + a.category);
  sh.getRange('A5:H5').merge().setValue('เกณฑ์การประเมิน: 5 = มากที่สุด, 4 = มาก, 3 = ปานกลาง, 2 = น้อย, 1 = น้อยที่สุด');
  sh.getRange('A6:H6').merge().setValue(
    'จำนวนผู้ตอบ ' + o.respondents + ' คน    |    จำนวนข้อประเมิน ' + (a.items ? a.items.length : 0) + ' ข้อ    |    ค่าเฉลี่ยรวม (X) = ' + (o.n ? o.mean.toFixed(2) : '-') +
    '    |    SD รวม = ' + (o.n ? o.sd.toFixed(2) : '-') + '    |    ระดับ: ' + (o.level || '-'));

  sh.getRange('A7:H7').merge().setValue('ตารางสรุปรายข้อประเมิน (X / SD รายข้อ)');
  sh.getRange(8, 1, 1, 8).setValues([['ลำดับ', 'รหัสข้อ', 'ข้อความประเมิน', 'N', 'X', 'SD', 'ระดับ', 'หมายเหตุ']]);
  let nextRow;
  if (gr.hasData && gr.stats.length) {
    const rows = gr.stats.map((x, i) => [i + 1, x.no, x.text, x.n, (x.n ? x.mean : ''), (x.n ? x.sd : ''), x.level, '']);
    sh.getRange(9, 1, rows.length, 8).setValues(rows);
    nextRow = 9 + rows.length + 1;
  } else {
    sh.getRange(9, 1, 1, 8).merge().setValue('*** ไม่พบข้อมูลผู้ตอบสำหรับ ' + label + ' — เว้นรายงานนี้ไว้เพื่อความครบถ้วน โปรดตรวจไฟล์ต้นฉบับ (QA = REVIEW) ***');
    nextRow = 12;
  }

  sh.getRange(nextRow, 1, 1, 8).merge().setValue('ข้อเสนอแนะการปรับปรุง');
  nextRow++;
  buildRecommendations_(gr.stats, commentAnalysis, gr.def.year === null).forEach(t => {
    sh.getRange(nextRow, 1, 1, 8).merge().setValue(t);
    nextRow++;
  });

  nextRow++;
  sh.getRange(nextRow, 1, 1, 8).merge().setValue('หมายเหตุ: รายงานสร้างจากระบบอัตโนมัติ ควรตรวจ QA_Log และไฟล์ต้นฉบับก่อนนำไปใช้ทางราชการ');
  nextRow += 2;

  ['ผู้จัดทำรายงาน', 'ผู้ตรวจสอบ', 'ผู้อำนวยการวิทยาลัยพยาบาลทหารอากาศ / ผู้อนุมัติ'].forEach(role => {
    sh.getRange(nextRow, 1, 1, 8).merge().setValue('ลงชื่อ ....................................................................');
    nextRow++;
    sh.getRange(nextRow, 1, 1, 8).merge().setValue('( .................................................................... )');
    nextRow++;
    sh.getRange(nextRow, 1, 1, 8).merge().setValue('ตำแหน่ง ' + role);
    nextRow += 2;
  });
}

/** Comments_Themes: ธีม / จำนวน / ร้อยละ / ตัวอย่างข้อความ (Phase 5) */
function writeCommentsThemes_(sh, ca) {
  sh.clear();
  sh.getRange('A1:E1').merge().setValue('สรุปข้อคิดเห็น (จำนวนผู้แสดงความเห็น ' + ca.total + ' ราย)');
  sh.getRange(2, 1, 1, 5).setValues([['ธีม', 'จำนวน', 'ร้อยละ', 'ตัวอย่างข้อความ', 'ข้อเสนอแนะเชิงปรับปรุง']]);
  if (ca.themes.length) {
    const rows = ca.themes.map(t => [
      t.theme, t.count, t.percent + '%', t.examples.join('  //  '),
      'พิจารณาปรับปรุงประเด็น: ' + t.theme
    ]);
    sh.getRange(3, 1, rows.length, 5).setValues(rows);
  }
  sh.getRange('D:E').setWrap(true);
}

/**
 * สาธิตการสร้างไฟล์จริง (Excel + PDF) จากข้อมูลจำลอง — เรียกผ่าน ?action=selfexport
 * สร้าง Google Sheet ครบทุก tab, export เป็น xlsx + PDF (รายงานรวม), แล้วลบ Sheet ทิ้ง
 * เพื่อไม่ให้มีไฟล์สาธิตค้างใน Drive production คืน base64 ให้ฝั่งเรียกไปเปิดดูได้
 */
function selfExport_() {
  const header = ['เลขที่', 'รหัสนักศึกษา', 'ชื่อ', 'สกุล', 'ชั้นปี', '1.1 ตั้งใจเรียน การเรียน การงาน', '1.2 ส่งงานตรงเวลา', '2.1 มีวินัย', 'ข้อเสนอแนะเพิ่มเติม'];
  const data = [
    [1, '6301', 'กชกร', 'ใจดี', 'ชั้นปีที่ 1', 5, 4, 5, 'อาจารย์สอนดีมาก'],
    [2, '6302', 'สมชาย', 'รักชาติ', 'ชั้นปีที่ 1', 4, 4, 3, 'เวลากระชั้นไป'],
    [3, '6303', 'สมหญิง', 'เก่งกล้า', 'ชั้นปีที่ 2', 3, 5, 4, 'เยี่ยมมาก'],
    [4, '6304', 'ประเสริฐ', 'ตั้งใจ', 'ชั้นปีที่ 2', 5, 5, 5, ''],
    [5, '6305', 'วิภา', 'ขยัน', 'ชั้นปีที่ 3', 4, 3, 4, 'ห้องเรียนร้อน']
  ];
  const values = [header].concat(data);
  const display = values.map(function (r) { return r.map(function (c) { return String(c); }); });
  const p = parseEvaluationMatrix_(values, display);
  const items = p.items.map(function (it) { return { no: it.no, code: it.code, text: it.text, col: it.col, row: it.col + 1 }; });
  const itemStats = p.itemStats.map(function (x) { return { no: x.no, code: x.code, text: x.text, col: x.col, row: x.col + 1, n: x.n, mean: x.mean, sd: x.sd, level: x.level }; });
  const a = {
    rawName: 'ตัวอย่างสาธิต_selfExport.xlsx', category: 'นภาภิบาล', confidence: 1,
    title: 'รายงานผลการประเมิน (ตัวอย่างสาธิตระบบ v5)',
    items: items, itemStats: itemStats, scoreRows: p.scoreRows, respondents: p.respondents,
    overallMean: p.overallMean, overallSd: p.overallSd, invalidCount: p.invalidCount,
    parseMode: 'wide', sheetName: 'Form Responses 1', respondentCount: p.respondentCount,
    duplicates: p.duplicates, years: p.years, hasRankColumn: p.hasRankColumn,
    safeName: safeName_('DEMO_selfExport_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss'))
  };
  const output = createOutputWorkbook_(a);
  let pdfB64 = '', xlsxB64 = '', err = '';
  try {
    const ruam = output.groups[0];
    pdfB64 = Utilities.base64Encode(exportPdfBytes_(output.spreadsheetId, ruam.printGid));
    xlsxB64 = Utilities.base64Encode(exportXlsxBytes_(output.spreadsheetId));
  } catch (e) {
    err = String(e);
  } finally {
    try { DriveApp.getFileById(output.spreadsheetId).setTrashed(true); } catch (e2) {}
  }
  return {
    ok: !err, action: 'selfexport', version: 'v5-per-class-reports', error: err,
    note: 'ไฟล์ตัวอย่างสร้างจากข้อมูลจำลอง 5 คน แล้วลบ Google Sheet ทิ้งหลัง export (ไม่ค้างใน Drive)',
    respondents: p.respondentCount, items: items.length,
    pdfGroups: output.groups.map(function (g) { return { label: g.label, hasData: g.hasData }; }),
    xlsxBase64: xlsxB64, pdfBase64: pdfB64
  };
}

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

function exportPdf_(spreadsheetId, name, gid) {
  const params = [
    'format=pdf','size=A4','portrait=false','fitw=true','scale=4',
    'sheetnames=false','printtitle=false','pagenumbers=true','gridlines=false','fzr=false',
    'top_margin=0.35','bottom_margin=0.35','left_margin=0.25','right_margin=0.25',
    'gid=' + encodeURIComponent(gid)
  ].join('&');
  const url = 'https://docs.google.com/spreadsheets/d/'+spreadsheetId+'/export?'+params;
  const res = UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()}, muteHttpExceptions:true});
  if (res.getResponseCode() >= 300) throw new Error('PDF export failed: HTTP '+res.getResponseCode()+' '+res.getContentText().slice(0,200));
  const pdf = DriveApp.getFolderById(CONFIG.PDF_FOLDER_ID).createFile(res.getBlob().setName(name));
  return { id: pdf.getId(), url: pdf.getUrl() };
}

function detectTitle_(display){for(let r=0;r<Math.min(20,display.length);r++){for(let c=0;c<display[r].length;c++){const s=String(display[r][c]||'').trim();if(s.length>25 && /(ผลการประเมิน|แบบประเมิน|วิทยาลัยพยาบาลทหารอากาศ|นภาภิบาล)/.test(s)) return s;}}return '';}
function detectItems_(display){const out=[], seen={};display.forEach((row,idx)=>{const txt=row.filter(Boolean).join(' ').trim();let m=txt.match(/^(\d+(?:\.\d+)?)\s+(.{8,})$/);if(m&&!seen[m[1]]){seen[m[1]]=1;out.push({no:m[1],text:m[2],row:idx+1});}});return out;}
function detectScoreRows_(values){const out=[];values.forEach((row,idx)=>{const scores=row.map(score_).filter(v=>v!==null);if(scores.length>=3)out.push({row:idx+1,label:String(row[0]||('Row '+(idx+1))),scores});});return out;}
function detectInvalidScores_(values){let n=0;values.flat().forEach(v=>{if(typeof v==='number'&&Number.isFinite(v)&&v>5&&v<10)n++;});return n;}
function classify_(text){for(const r of CATEGORY_RULES){if(r.regex.test(text)) return {category:r.category, confidence:.9};}return {category:'99_ไม่ทราบประเภท', confidence:.2};}
function isSupported_(name){return /\.(xlsx|xls|csv|tsv)$/i.test(name);}
function score_(v){if(typeof v==='number'&&v>=1&&v<=5)return v;const s=String(v||'').trim();return /^[1-5](\.0+)?$/.test(s)?Number(s):null;}
function mean_(a){return a.reduce((x,y)=>x+y,0)/a.length;}
function sdSample_(a){const m=mean_(a);return Math.sqrt(a.reduce((s,v)=>s+Math.pow(v-m,2),0)/(a.length-1));}
function round2_(v){return Math.round((v+Number.EPSILON)*100)/100;}
function level_(m){if(m>=4.51)return 'มากที่สุด';if(m>=3.51)return 'มาก';if(m>=2.51)return 'ปานกลาง';if(m>=1.51)return 'น้อย';return 'น้อยที่สุด';}
function safeName_(s){return String(s).replace(/[\\\/:*?"<>|#%{}~&]/g,'_').replace(/\s+/g,'_').slice(0,160);}
function col_(n){let s='';while(n>0){let m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=(n-m-1)/26;}return s;}
function moveFile_(file, fromId, toId){DriveApp.getFolderById(toId).addFile(file);try{DriveApp.getFolderById(fromId).removeFile(file);}catch(e){}}

function applyStyle_(sh){
  const lastRow = Math.max(sh.getLastRow(),1), lastCol = Math.max(sh.getLastColumn(),1);
  const r=sh.getRange(1,1,lastRow,lastCol);
  r.setFontFamily(CONFIG.REPORT_FONT).setFontSize(14).setWrap(true).setVerticalAlignment('middle');
  sh.getRange(1,1,1,lastCol).setBackground('#0B2347').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
  sh.setFrozenRows(1);
  for(let c=1;c<=lastCol;c++)sh.autoResizeColumn(c);
  try { sh.getDataRange().createFilter(); } catch(e) {}
}

function applyPrintGroupStyle_(sh){
  sh.setHiddenGridlines(true);
  const widths = [44,64,404,44,58,58,86,150];
  widths.forEach((w,i)=>sh.setColumnWidth(i+1,w));
  sh.getRange('A:H').setFontFamily(CONFIG.REPORT_FONT).setFontSize(13).setWrap(true).setVerticalAlignment('middle');
  sh.getRange('A1:H1').setFontSize(20).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#0B2347').setFontColor('#FFFFFF');
  sh.getRange('A2:H2').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#EAF3FF').setFontColor('#0B2347');
  sh.getRange('A3:H4').setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('A5:H6').setFontSize(12).setHorizontalAlignment('center');
  sh.getRange('A7:H7').setFontWeight('bold').setBackground('#EAF3FF').setFontColor('#0B2347').setHorizontalAlignment('center');
  sh.getRange('A8:H8').setFontWeight('bold').setBackground('#0B2347').setFontColor('#FFFFFF').setHorizontalAlignment('center');
  sh.getRange('D9:G200').setHorizontalAlignment('center');
}

function appendLog_(file,status,cat,msg,sheetUrl,pdfUrl){
  const folder=DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID);
  const name='RTAFNC_Evaluation_Process_Log_'+CONFIG.ACADEMIC_YEAR;
  let ss;const it=folder.getFilesByName(name);
  if(it.hasNext()) ss=SpreadsheetApp.openById(it.next().getId());
  else { ss=SpreadsheetApp.create(name); const f=DriveApp.getFileById(ss.getId()); folder.addFile(f); try{DriveApp.getRootFolder().removeFile(f);}catch(e){} ss.getActiveSheet().setName('Log'); ss.getActiveSheet().appendRow(['timestamp','file','status','category','message','sheetUrl','pdfUrl']); }
  ss.getSheetByName('Log').appendRow([new Date(),file,status,cat,msg,sheetUrl,pdfUrl]);
}

function buildUploadPage_(){
  return '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RTAFNC Upload</title><style>body{font-family:TH Sarabun PSK,Sarabun,Tahoma,sans-serif;background:#f4f7fb;margin:0;padding:24px;font-size:20px;color:#0f172a}.card{max-width:980px;margin:auto;background:white;border-radius:22px;padding:24px;box-shadow:0 14px 40px rgba(11,35,71,.12)}h1{color:#0b2347}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}input,select,button{font:inherit;padding:12px;border-radius:12px;border:1px solid #d8e2ef}button{border:0;background:#1c4e89;color:#fff;font-weight:800;cursor:pointer;margin:6px}.danger{background:#b91c1c}pre{background:#0f172a;color:#e2e8f0;padding:14px;border-radius:14px;overflow:auto}@media(max-width:700px){.grid{grid-template-columns:1fr}button{width:100%}}</style></head><body><div class="card"><h1>RTAFNC Evaluation Analyzer</h1><p>อัปโหลดไฟล์ดิบ เก็บ Drive แปลงข้อมูล สร้าง Excel/PDF และ QA Log</p><form id="f"><div class="grid"><input type="file" name="rawFile" accept=".xlsx,.xls,.csv,.tsv" required><select name="categoryOverride"><option value="">ให้ระบบจำแนกอัตโนมัติ</option><option>นภาภิบาล</option><option>คุณลักษณะทางทหาร</option><option>เดินทางไกล</option><option>ทหาร_1_4</option><option>จิตอาสา</option><option>เจตคติ</option><option>อาจารย์ที่ปรึกษา</option><option>SMART_NURSE</option></select></div><p><button type="button" onclick="upOnly()">อัปโหลดอย่างเดียว</button><button type="button" class="danger" onclick="upProcess()">อัปโหลด + ประมวลผล</button><button type="button" onclick="status()">รีเฟรชสถานะ</button><button type="button" class="danger" onclick="processQ()">ประมวลผลคิว</button></p></form><pre id="out">พร้อมใช้งาน</pre></div><script>function p(x){document.getElementById("out").textContent=JSON.stringify(x,null,2)}function err(e){p({error:String(e&&e.message?e.message:e)})}function upOnly(){google.script.run.withSuccessHandler(p).withFailureHandler(err).uploadOnly(document.getElementById("f"))}function upProcess(){google.script.run.withSuccessHandler(p).withFailureHandler(err).uploadAndProcess(document.getElementById("f"))}function status(){google.script.run.withSuccessHandler(p).withFailureHandler(err).getSystemStatus()}function processQ(){google.script.run.withSuccessHandler(p).withFailureHandler(err).processPendingRawFiles()}status();<\/script></body></html>';
}
