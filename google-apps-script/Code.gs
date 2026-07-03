/**
 * RTAFNC Evaluation Analyzer Backend v3 — Production Single File
 * ใช้ไฟล์นี้ไฟล์เดียวใน Apps Script ได้เลย ไม่ต้องสร้าง Upload.html แยก
 * Frontend Portal: GitHub Pages
 * Real upload/process engine: Apps Script Web App + Google Drive
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
  REPORT_FONT: 'TH Sarabun PSK'
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
    else result = { ok: true, version: 'v3-production-single-file', name: 'RTAFNC Evaluation Analyzer Backend', uploadUi: ScriptApp.getService().getUrl(), time: new Date().toISOString() };
  } catch (err) {
    result = { ok: false, error: String(err && err.stack ? err.stack : err) };
  }
  return jsonp_(result, p.callback);
}

function jsonp_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function getSystemStatus() {
  return {
    ok: true,
    version: 'v3-production-single-file',
    academicYear: CONFIG.ACADEMIC_YEAR,
    pendingFiles: listPendingFiles(),
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
  const pdf = exportPdf_(output.spreadsheetId, analysis.safeName + '.pdf');
  moveFile_(file, CONFIG.PENDING_FOLDER_ID, CONFIG.PROCESSED_FOLDER_ID);
  if (!CONFIG.KEEP_TEMP_SHEETS) DriveApp.getFileById(tempId).setTrashed(true);
  appendLog_(file.getName(), 'SUCCESS', analysis.category, 'processed', output.url, pdf.url);
  return { ok: true, file: file.getName(), status: 'SUCCESS', category: analysis.category, confidence: analysis.confidence, itemCount: analysis.items.length, scoreRows: analysis.scoreRows.length, mean: round2_(analysis.overallMean), sd: round2_(analysis.overallSd), outputSpreadsheetUrl: output.url, pdfUrl: pdf.url };
}

function convertToGoogleSheet_(file) {
  const blob = file.getBlob();
  const name = '_TEMP_' + file.getName().replace(/\.(xlsx|xls|csv|tsv)$/i, '') + '_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
  const created = Drive.Files.create({ name: name, mimeType: MimeType.GOOGLE_SHEETS }, blob, { fields: 'id,name,mimeType' });
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
  const all = [];
  scoreRows.forEach(r => r.scores.forEach(v => all.push(v)));
  const overallMean = all.length ? mean_(all) : 0;
  const overallSd = all.length > 1 ? sdSample_(all) : 0;
  return { rawName, category: cat.category, confidence: cat.confidence, title: detectTitle_(display) || rawName, items, scoreRows, overallMean, overallSd, invalidCount: detectInvalidScores_(values), safeName: safeName_(['ผลวิเคราะห์', cat.category, 'ปีการศึกษา_' + CONFIG.ACADEMIC_YEAR, new Date().toISOString().slice(0, 10)].join('_')) };
}

function createOutputWorkbook_(a) {
  const ss = SpreadsheetApp.create(a.safeName);
  const file = DriveApp.getFileById(ss.getId());
  DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID).addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch(e) {}
  const dash = ss.getSheets()[0].setName('Dashboard');
  const items = ss.insertSheet('Items');
  const rows = ss.insertSheet('ScoreRows');
  const qa = ss.insertSheet('QA_Log');
  const print = ss.insertSheet('Print_Report');
  writeDashboard_(dash, a); writeItems_(items, a.items); writeScoreRows_(rows, a.scoreRows); writeQa_(qa, a); writePrint_(print, a);
  ss.getSheets().forEach(applyStyle_);
  SpreadsheetApp.flush();
  return { spreadsheetId: ss.getId(), url: ss.getUrl() };
}

function writeDashboard_(sh, a) {
  sh.getRange('A1:H1').merge().setValue('RTAFNC Evaluation Analyzer — Dashboard');
  sh.getRange('A3:B12').setValues([
    ['รายการ','ผลลัพธ์'],['ชื่อไฟล์',a.rawName],['หมวด',a.category],['Confidence',a.confidence],['หัวรายงาน',a.title],['จำนวนข้อ',a.items.length],['จำนวนแถวคะแนน',a.scoreRows.length],['X',round2_(a.overallMean)],['SD',round2_(a.overallSd)],['QA',a.invalidCount === 0 ? 'PASS' : 'REVIEW']
  ]);
}
function writeItems_(sh, items) { sh.getRange(1,1,1,4).setValues([['ลำดับ','รหัสข้อ','ข้อความ','sourceRow']]); if (items.length) sh.getRange(2,1,items.length,4).setValues(items.map((x,i)=>[i+1,x.no,x.text,x.row])); }
function writeScoreRows_(sh, rows) {
  const max = Math.max(0, ...rows.map(r=>r.scores.length));
  const headers = ['sourceRow','label']; for (let i=1;i<=max;i++) headers.push('ข้อ'+i); headers.push('X','SD','ระดับ');
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  if (!rows.length) return;
  sh.getRange(2,1,rows.length,headers.length).setValues(rows.map(r=>{ const arr=[r.row,r.label].concat(r.scores); while(arr.length<2+max) arr.push(''); arr.push('','',''); return arr; }));
  for (let i=0;i<rows.length;i++) {
    const row = 2+i, first=3, last=2+max, meanCol=3+max, sdCol=4+max, levelCol=5+max;
    const start = col_(first)+row, end=col_(last)+row, meanCell=col_(meanCol)+row;
    sh.getRange(row, meanCol).setFormula(`=${CONFIG.ROUND_MODE}(AVERAGE(${start}:${end}),2)`);
    sh.getRange(row, sdCol).setFormula(`=${CONFIG.ROUND_MODE}(STDEV.S(${start}:${end}),2)`);
    sh.getRange(row, levelCol).setFormula(`=IF(${meanCell}>=4.51,"มากที่สุด",IF(${meanCell}>=3.51,"มาก",IF(${meanCell}>=2.51,"ปานกลาง",IF(${meanCell}>=1.51,"น้อย","น้อยที่สุด"))))`);
  }
}
function writeQa_(sh,a){sh.getRange(1,1,7,3).setValues([['รายการ','ผล','รายละเอียด'],['จำแนกหมวด',a.confidence>=.55?'PASS':'REVIEW',a.category],['พบข้อคำถาม',a.items.length?'PASS':'REVIEW',a.items.length],['พบแถวคะแนน',a.scoreRows.length?'PASS':'REVIEW',a.scoreRows.length],['ช่วงคะแนน 1-5',a.invalidCount===0?'PASS':'REVIEW',a.invalidCount],['สูตร','PASS',CONFIG.ROUND_MODE+'(...,2)'],['ฟอนต์','PASS',CONFIG.REPORT_FONT]]);}
function writePrint_(sh,a){sh.getRange('A1:H1').merge().setValue('รายงานผลการประเมิน ปีการศึกษา '+CONFIG.ACADEMIC_YEAR);sh.getRange('A2:H2').merge().setValue('วิทยาลัยพยาบาลทหารอากาศ');sh.getRange('A4:B11').setValues([['หมวดงาน',a.category],['ไฟล์',a.rawName],['หัวรายงาน',a.title],['จำนวนข้อ',a.items.length],['จำนวนแถวคะแนน',a.scoreRows.length],['X',round2_(a.overallMean)],['SD',round2_(a.overallSd)],['หมายเหตุ','ตรวจ QA_Log ก่อนใช้งานทางราชการ']]);}

function exportPdf_(spreadsheetId, name) { const url = 'https://docs.google.com/spreadsheets/d/'+spreadsheetId+'/export?format=pdf&size=A4&portrait=false&fitw=true&sheetnames=false&printtitle=false&pagenumbers=true&gridlines=false&fzr=false'; const res = UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()}}); const pdf = DriveApp.getFolderById(CONFIG.PDF_FOLDER_ID).createFile(res.getBlob().setName(name)); return { id: pdf.getId(), url: pdf.getUrl() }; }
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
function safeName_(s){return String(s).replace(/[\\\/:*?"<>|#%{}~&]/g,'_').replace(/\s+/g,'_').slice(0,160);}
function col_(n){let s='';while(n>0){let m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=(n-m-1)/26;}return s;}
function moveFile_(file, fromId, toId){DriveApp.getFolderById(toId).addFile(file);try{DriveApp.getFolderById(fromId).removeFile(file);}catch(e){}}
function applyStyle_(sh){const r=sh.getDataRange();r.setFontFamily(CONFIG.REPORT_FONT).setFontSize(14).setWrap(true);sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).setBackground('#0B2347').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');sh.setFrozenRows(1);for(let c=1;c<=sh.getLastColumn();c++)sh.autoResizeColumn(c);}
function appendLog_(file,status,cat,msg,sheetUrl,pdfUrl){const folder=DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID);const name='RTAFNC_Evaluation_Process_Log_'+CONFIG.ACADEMIC_YEAR;let ss;const it=folder.getFilesByName(name);if(it.hasNext())ss=SpreadsheetApp.openById(it.next().getId());else{ss=SpreadsheetApp.create(name);const f=DriveApp.getFileById(ss.getId());folder.addFile(f);try{DriveApp.getRootFolder().removeFile(f);}catch(e){}ss.getActiveSheet().setName('Log');ss.getActiveSheet().appendRow(['timestamp','file','status','category','message','sheetUrl','pdfUrl']);}ss.getSheetByName('Log').appendRow([new Date(),file,status,cat,msg,sheetUrl,pdfUrl]);}

function buildUploadPage_() {
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RTAFNC Evaluation Analyzer</title><style>@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');:root{--navy:#0b2347;--blue:#1c4e89;--bg:#f5f7fb;--line:#d8e2ef;--ok:#166534;--warn:#9a3412;--danger:#b91c1c}*{box-sizing:border-box}body{margin:0;background:var(--bg);font-family:"TH Sarabun PSK","Sarabun","TH Sarabun New",Tahoma,sans-serif;font-size:18pt;color:#111827;line-height:1.35}header{background:linear-gradient(135deg,var(--navy),var(--blue));color:#fff;padding:28px 34px;border-bottom:6px solid #d6a94a}h1{font-size:34pt;margin:0}main{max-width:1120px;margin:auto;padding:22px}.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px;margin:16px 0;box-shadow:0 8px 24px rgba(11,35,71,.08)}h2{margin:0 0 10px;color:var(--navy);font-size:25pt}.muted{color:#475569}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.drop{border:2px dashed #94a3b8;background:#f8fafc;border-radius:18px;padding:24px;text-align:center}input,select{font-family:inherit;font-size:17pt;width:100%;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}button{font-family:inherit;font-size:18pt;font-weight:800;border:0;border-radius:12px;background:var(--blue);color:#fff;padding:12px 18px;cursor:pointer;margin:6px 4px}button.danger{background:var(--danger)}button.secondary{background:#475569}.status{border-left:6px solid var(--blue);background:#f8fafc;padding:10px 12px;border-radius:12px;margin:10px 0}.ok{border-color:var(--ok);color:var(--ok);font-weight:800}.warn{border-color:var(--warn);color:var(--warn);font-weight:800}pre{background:#0f172a;color:#e2e8f0;border-radius:14px;padding:14px;overflow:auto;font-size:13pt;min-height:160px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid var(--line);padding:8px 10px;vertical-align:top}th{background:#eaf3ff;color:var(--navy)}a{color:var(--blue);font-weight:800}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style></head><body><header><h1>RTAFNC Evaluation Analyzer</h1><p>อัปโหลดไฟล์ข้อมูลดิบ → เก็บ Google Drive → แปลงข้อมูล → ส่งออก Excel/PDF</p></header><main><section class="card"><h2>อัปโหลดไฟล์ข้อมูลดิบ</h2><p class="muted">รองรับ .xlsx, .xls, .csv, .tsv | แนะนำให้ทดสอบทีละ 1 ไฟล์ก่อนใช้งานจริง</p><form id="uploadForm"><div class="grid"><div class="drop"><input type="file" name="rawFile" id="rawFile" accept=".xlsx,.xls,.csv,.tsv" required><p class="muted">เลือกไฟล์แบบประเมินจากเครื่อง</p></div><div><label>เลือกหมวดเอง ถ้าต้องการบังคับหมวด</label><select name="categoryOverride" id="categoryOverride"><option value="">ให้ระบบจำแนกอัตโนมัติ</option><option>นภาภิบาล</option><option>คุณลักษณะทางทหาร</option><option>เดินทางไกล</option><option>ทหาร_1_4</option><option>จิตอาสา</option><option>เจตคติ</option><option>อาจารย์ที่ปรึกษา</option><option>SMART_NURSE</option><option>อุทธรณ์ร้องทุกข์</option><option>การรักษาความลับ</option><option>บริการข้อมูล</option><option>สุขภาพชมรมกีฬา</option><option>สร้างสรรค์กล้าหาญอดทน</option></select><p class="muted">ถ้าไม่เลือก ระบบจะดูจากชื่อไฟล์และหัวรายงาน</p></div></div><button type="button" onclick="uploadOnly()">อัปโหลดเข้า Drive อย่างเดียว</button><button type="button" class="danger" onclick="uploadAndProcess()">อัปโหลด + แปลง + ประมวลผลทันที</button><button type="button" class="secondary" onclick="refreshStatus()">รีเฟรชรายการไฟล์</button></form><div id="status" class="status">พร้อมใช้งาน</div></section><section class="card"><h2>ไฟล์ที่รอใน Drive</h2><button onclick="refreshStatus()">รีเฟรชรายการไฟล์</button><button class="danger" onclick="processPending()">ประมวลผลไฟล์รอคิว</button><div id="fileTable"></div></section><section class="card"><h2>ผลลัพธ์ / Debug</h2><pre id="output">พร้อมใช้งาน</pre></section></main><script>function setStatus(m,c){var e=document.getElementById('status');e.textContent=m;e.className='status '+(c||'')}function print(o){document.getElementById('output').textContent=JSON.stringify(o,null,2)}function uploadOnly(){var f=document.getElementById('uploadForm');if(!document.getElementById('rawFile').files.length){setStatus('กรุณาเลือกไฟล์ก่อน','warn');return}setStatus('กำลังอัปโหลดเข้า Google Drive...','warn');google.script.run.withSuccessHandler(function(r){setStatus('อัปโหลดสำเร็จ','ok');print(r);refreshStatus()}).withFailureHandler(showError).uploadOnly(f)}function uploadAndProcess(){var f=document.getElementById('uploadForm');if(!document.getElementById('rawFile').files.length){setStatus('กรุณาเลือกไฟล์ก่อน','warn');return}if(!confirm('ยืนยันอัปโหลดและประมวลผลไฟล์นี้ทันที?'))return;setStatus('กำลังอัปโหลด แปลงไฟล์ และประมวลผล...','warn');google.script.run.withSuccessHandler(function(r){setStatus('ประมวลผลสำเร็จ','ok');print(r);refreshStatus()}).withFailureHandler(showError).uploadAndProcess(f)}function processPending(){if(!confirm('ยืนยันประมวลผลไฟล์ที่รอคิวทั้งหมด?'))return;setStatus('กำลังประมวลผลไฟล์รอคิว...','warn');google.script.run.withSuccessHandler(function(r){setStatus('ประมวลผลคิวเสร็จ','ok');print(r);refreshStatus()}).withFailureHandler(showError).processPendingRawFiles()}function refreshStatus(){google.script.run.withSuccessHandler(function(r){renderFiles(r.pendingFiles||[]);print(r)}).withFailureHandler(showError).getSystemStatus()}function renderFiles(files){var rows=files.map(function(f){return '<tr><td>'+esc(f.name)+'</td><td>'+(f.supported?'YES':'NO')+'</td><td><a href="'+f.url+'" target="_blank">เปิด</a></td></tr>'}).join('');document.getElementById('fileTable').innerHTML='<table><thead><tr><th>ชื่อไฟล์</th><th>รองรับ</th><th>ลิงก์</th></tr></thead><tbody>'+(rows||'<tr><td colspan="3">ไม่พบไฟล์รอคิว</td></tr>')+'</tbody></table>'}function showError(err){setStatus('ERROR: '+(err.message||err),'warn');print({error:String(err&&err.stack?err.stack:err)})}function esc(s){return String(s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}refreshStatus();</script></body></html>`;
}
