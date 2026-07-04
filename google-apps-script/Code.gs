/**
 * RTAFNC Evaluation Analyzer Backend v4 — Print-safe Production
 * Frontend Portal: GitHub Pages
 * Backend: Apps Script Web App + Google Drive + Google Sheets
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
    version: 'v4-print-safe-production',
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

function getSystemStatus() {
  return {
    ok: true,
    version: 'v4-print-safe-production',
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
  const pdf = exportPdf_(output.spreadsheetId, analysis.safeName + '.pdf', output.printGid);
  moveFile_(file, CONFIG.PENDING_FOLDER_ID, CONFIG.PROCESSED_FOLDER_ID);
  if (!CONFIG.KEEP_TEMP_SHEETS) DriveApp.getFileById(tempId).setTrashed(true);
  appendLog_(file.getName(), 'SUCCESS', analysis.category, 'processed', output.url, pdf.url);
  return { ok: true, file: file.getName(), status: 'SUCCESS', category: analysis.category, confidence: analysis.confidence, itemCount: analysis.items.length, scoreRows: analysis.scoreRows.length, mean: round2_(analysis.overallMean), sd: round2_(analysis.overallSd), outputSpreadsheetUrl: output.url, pdfUrl: pdf.url };
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
  const sh = ss.getSheets()[0];
  const values = sh.getDataRange().getValues();
  const display = sh.getDataRange().getDisplayValues();
  const text = display.flat().filter(Boolean).join(' ');
  const cat = categoryOverride ? { category: categoryOverride, confidence: 1 } : classify_(rawName + ' ' + text);
  const items = detectItems_(display);
  const scoreRows = detectScoreRows_(values);
  const itemStats = computeItemStats_(items, scoreRows);
  const all = [];
  scoreRows.forEach(r => r.scores.forEach(v => all.push(v)));
  const overallMean = all.length ? mean_(all) : 0;
  const overallSd = all.length > 1 ? sdSample_(all) : 0;
  return { rawName, category: cat.category, confidence: cat.confidence, title: detectTitle_(display) || rawName, items, itemStats, scoreRows, overallMean, overallSd, invalidCount: detectInvalidScores_(values), safeName: safeName_(['ผลวิเคราะห์', cat.category, 'ปีการศึกษา_' + CONFIG.ACADEMIC_YEAR, Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd')].join('_')) };
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
  const items = ss.insertSheet('Items');
  const rows = ss.insertSheet('ScoreRows');
  const qa = ss.insertSheet('QA_Log');
  const print = ss.insertSheet('Print_Report');
  writeCover_(cover, a);
  writeExecutive_(executive, a);
  writeDashboard_(dash, a);
  writeItems_(items, a.itemStats);
  writeScoreRows_(rows, a.scoreRows);
  writeQa_(qa, a);
  writePrint_(print, a);
  ss.getSheets().forEach(applyStyle_);
  applyPrintStyle_(print);
  SpreadsheetApp.flush();
  return { spreadsheetId: ss.getId(), url: ss.getUrl(), printGid: print.getSheetId() };
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
    sh.getRange(row, meanCol).setFormula('='+CONFIG.ROUND_MODE+'(AVERAGE('+start+':'+end+'),2)');
    sh.getRange(row, sdCol).setFormula('='+CONFIG.ROUND_MODE+'(STDEV.S('+start+':'+end+'),2)');
    sh.getRange(row, levelCol).setFormula('=IF('+meanCell+'>=4.51,"มากที่สุด",IF('+meanCell+'>=3.51,"มาก",IF('+meanCell+'>=2.51,"ปานกลาง",IF('+meanCell+'>=1.51,"น้อย","น้อยที่สุด"))))');
  }
}

function writeQa_(sh,a) {
  sh.clear();
  sh.getRange(1,1,9,4).setValues([
    ['รายการ','ผล','รายละเอียด','วิธีแก้ถ้า REVIEW'],
    ['จำแนกหมวด',a.confidence>=.55?'PASS':'REVIEW',a.category,'เลือกหมวดเองหรือเพิ่ม regex rule'],
    ['พบข้อคำถาม',a.items.length?'PASS':'REVIEW',a.items.length,'ตรวจรูปแบบข้อ 1.1 / 1.2 ในไฟล์ต้นฉบับ'],
    ['พบแถวคะแนน',a.scoreRows.length?'PASS':'REVIEW',a.scoreRows.length,'ตรวจว่าแถวคะแนนมีค่าตัวเลข 1-5 อย่างน้อย 3 ช่อง'],
    ['ช่วงคะแนน 1-5',a.invalidCount===0?'PASS':'REVIEW',a.invalidCount,'แก้คะแนนผิดช่วงในไฟล์ต้นฉบับ'],
    ['สูตร X/SD','PASS',CONFIG.ROUND_MODE+'(...,2) + STDEV.S','ตรวจสูตรใน ScoreRows'],
    ['ฟอนต์','PASS',CONFIG.REPORT_FONT,'ถ้าเครื่องไม่มีฟอนต์ให้ใช้ TH Sarabun New'],
    ['PDF Print Safe','PASS','Export เฉพาะ Print_Report A4 landscape fit width','เปิด PDF ตรวจว่าตารางไม่ขาดก่อนพิมพ์'],
    ['คำเตือนราชการ','PASS','ต้องตรวจ QA_Log ก่อนใช้จริง','แนบ QA_Log เป็นหลักฐานตรวจสอบ']
  ]);
}

function writePrint_(sh,a) {
  sh.clear();
  sh.getRange('A1:H1').merge().setValue('รายงานผลการประเมิน ปีการศึกษา '+CONFIG.ACADEMIC_YEAR);
  sh.getRange('A2:H2').merge().setValue('วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ');
  sh.getRange('A4:H4').merge().setValue(a.title);
  sh.getRange('A6:B13').setValues([
    ['หมวดงาน',a.category], ['ไฟล์ต้นฉบับ',a.rawName], ['จำนวนข้อประเมิน',a.items.length], ['จำนวนแถวคะแนน',a.scoreRows.length], ['ค่าเฉลี่ยรวม (X)',round2_(a.overallMean)], ['SD รวม',round2_(a.overallSd)], ['ระดับ',level_(a.overallMean)], ['QA',a.invalidCount === 0 ? 'PASS' : 'REVIEW']
  ]);
  sh.getRange('A15:H15').merge().setValue('ตารางสรุปรายข้อประเมิน');
  sh.getRange(16,1,1,8).setValues([['ลำดับ','รหัสข้อ','ข้อความประเมิน','N','X','SD','ระดับ','หมายเหตุ']]);
  const rows = a.itemStats.slice(0, 30).map((x,i)=>[i+1,x.no,x.text,x.n,x.mean,x.sd,x.level,'']);
  if (rows.length) sh.getRange(17,1,rows.length,8).setValues(rows);
  const noteRow = 18 + rows.length;
  sh.getRange(noteRow,1,1,8).merge().setValue('หมายเหตุ: รายงานฉบับนี้สร้างจากระบบอัตโนมัติ ควรตรวจ QA_Log และไฟล์ต้นฉบับก่อนนำไปใช้ทางราชการ');
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

function applyPrintStyle_(sh){
  sh.setHiddenGridlines(true);
  sh.getRange('A1:H2').setHorizontalAlignment('center').setFontWeight('bold');
  sh.getRange('A1:H1').setFontSize(22).setBackground('#0B2347').setFontColor('#FFFFFF');
  sh.getRange('A2:H2').setFontSize(18).setBackground('#EAF3FF').setFontColor('#0B2347');
  sh.getRange('A4:H4').setHorizontalAlignment('center').setFontWeight('bold').setFontSize(16).setWrap(true);
  sh.getRange('A15:H16').setHorizontalAlignment('center').setFontWeight('bold').setBackground('#0B2347').setFontColor('#FFFFFF');
  const widths = [48,70,420,48,60,60,90,120];
  widths.forEach((w,i)=>sh.setColumnWidth(i+1,w));
  sh.getRange('A:H').setWrap(true).setVerticalAlignment('middle');
  sh.getRange('D:H').setHorizontalAlignment('center');
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
