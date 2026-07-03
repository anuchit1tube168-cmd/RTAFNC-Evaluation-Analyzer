/**
 * RTAFNC Evaluation Analyzer Backend
 * Frontend: GitHub Pages
 * Storage: Google Drive
 * Backend: Google Apps Script Web App + Advanced Drive API v3
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
  const p = e.parameter || {};
  const action = p.action || 'health';
  let result;
  try {
    if (action === 'list') result = { ok: true, files: listPendingFiles_() };
    else if (action === 'process') result = processPendingRawFiles_();
    else if (action === 'test') result = processOneFile_(DriveApp.getFileById(p.fileId));
    else result = { ok: true, name: 'RTAFNC Evaluation Analyzer Backend', time: new Date().toISOString() };
  } catch (err) {
    result = { ok: false, error: String(err && err.stack ? err.stack : err) };
  }
  return jsonp_(result, p.callback);
}

function jsonp_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function listPendingFiles_() {
  const folder = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID);
  const it = folder.getFiles();
  const rows = [];
  while (it.hasNext()) {
    const f = it.next();
    rows.push({
      id: f.getId(),
      name: f.getName(),
      mimeType: f.getMimeType(),
      size: f.getSize(),
      url: f.getUrl(),
      supported: isSupported_(f.getName())
    });
  }
  return rows;
}

function processPendingRawFiles_() {
  const folder = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID);
  const it = folder.getFiles();
  const results = [];
  let count = 0;
  while (it.hasNext() && count < CONFIG.MAX_FILES_PER_RUN) {
    const f = it.next();
    if (!isSupported_(f.getName())) {
      results.push({ file: f.getName(), status: 'SKIP', message: 'not supported' });
      continue;
    }
    count++;
    try {
      results.push(processOneFile_(f));
    } catch (err) {
      results.push({ file: f.getName(), status: 'ERROR', message: String(err) });
      appendLog_(f.getName(), 'ERROR', '99_ไม่ทราบประเภท', String(err), '', '');
    }
  }
  return { ok: true, processed: results.length, results, finishedAt: new Date().toISOString() };
}

function processOneFile_(file) {
  const tempId = convertToGoogleSheet_(file);
  const analysis = analyzeSheet_(tempId, file.getName());
  const output = createOutputWorkbook_(analysis);
  const pdf = exportPdf_(output.spreadsheetId, analysis.safeName + '.pdf');
  moveFile_(file, CONFIG.PENDING_FOLDER_ID, CONFIG.PROCESSED_FOLDER_ID);
  if (!CONFIG.KEEP_TEMP_SHEETS) DriveApp.getFileById(tempId).setTrashed(true);
  appendLog_(file.getName(), 'SUCCESS', analysis.category, 'processed', output.url, pdf.url);
  return {
    file: file.getName(),
    status: 'SUCCESS',
    category: analysis.category,
    confidence: analysis.confidence,
    itemCount: analysis.items.length,
    scoreRows: analysis.scoreRows.length,
    mean: round2_(analysis.overallMean),
    sd: round2_(analysis.overallSd),
    outputSpreadsheetUrl: output.url,
    pdfUrl: pdf.url
  };
}

function convertToGoogleSheet_(file) {
  const blob = file.getBlob();
  const name = '_TEMP_' + file.getName().replace(/\.(xlsx|xls|csv|tsv)$/i, '') + '_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
  const resource = { name, mimeType: MimeType.GOOGLE_SHEETS };
  const created = Drive.Files.create(resource, blob, { fields: 'id,name,mimeType' });
  return created.id;
}

function analyzeSheet_(spreadsheetId, rawName) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sh = ss.getSheets()[0];
  const values = sh.getDataRange().getValues();
  const display = sh.getDataRange().getDisplayValues();
  const text = display.flat().filter(Boolean).join(' ');
  const cat = classify_(rawName + ' ' + text);
  const items = detectItems_(display);
  const scoreRows = detectScoreRows_(values);
  const all = [];
  scoreRows.forEach(r => r.scores.forEach(v => all.push(v)));
  const overallMean = all.length ? mean_(all) : 0;
  const overallSd = all.length > 1 ? sdSample_(all) : 0;
  return {
    rawName,
    category: cat.category,
    confidence: cat.confidence,
    title: detectTitle_(display) || rawName,
    items,
    scoreRows,
    overallMean,
    overallSd,
    invalidCount: detectInvalidScores_(values),
    safeName: safeName_(['ผลวิเคราะห์', cat.category, 'ปีการศึกษา_' + CONFIG.ACADEMIC_YEAR, new Date().toISOString().slice(0, 10)].join('_'))
  };
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
  writeDashboard_(dash, a);
  writeItems_(items, a.items);
  writeScoreRows_(rows, a.scoreRows);
  writeQa_(qa, a);
  writePrint_(print, a);
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
function writeItems_(sh, items) {
  sh.getRange(1,1,1,4).setValues([['ลำดับ','รหัสข้อ','ข้อความ','sourceRow']]);
  if (items.length) sh.getRange(2,1,items.length,4).setValues(items.map((x,i)=>[i+1,x.no,x.text,x.row]));
}
function writeScoreRows_(sh, rows) {
  const max = Math.max(0, ...rows.map(r=>r.scores.length));
  const headers = ['sourceRow','label'];
  for (let i=1;i<=max;i++) headers.push('ข้อ'+i);
  headers.push('X','SD','ระดับ');
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  if (!rows.length) return;
  sh.getRange(2,1,rows.length,headers.length).setValues(rows.map(r=>{
    const arr=[r.row,r.label].concat(r.scores); while(arr.length<2+max) arr.push(''); arr.push('','',''); return arr;
  }));
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

function exportPdf_(spreadsheetId, name) {
  const url = 'https://docs.google.com/spreadsheets/d/'+spreadsheetId+'/export?format=pdf&size=A4&portrait=false&fitw=true&sheetnames=false&printtitle=false&pagenumbers=true&gridlines=false&fzr=false';
  const res = UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()}});
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
function safeName_(s){return String(s).replace(/[\\\/:*?"<>|#%{}~&]/g,'_').replace(/\s+/g,'_').slice(0,160);}
function col_(n){let s='';while(n>0){let m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=(n-m-1)/26;}return s;}
function moveFile_(file, fromId, toId){DriveApp.getFolderById(toId).addFile(file);try{DriveApp.getFolderById(fromId).removeFile(file);}catch(e){}}
function applyStyle_(sh){const r=sh.getDataRange();r.setFontFamily(CONFIG.REPORT_FONT).setFontSize(14).setWrap(true);sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).setBackground('#0B2347').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');sh.setFrozenRows(1);for(let c=1;c<=sh.getLastColumn();c++)sh.autoResizeColumn(c);}
function appendLog_(file,status,cat,msg,sheetUrl,pdfUrl){const folder=DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID);const name='RTAFNC_Evaluation_Process_Log_'+CONFIG.ACADEMIC_YEAR;let ss;const it=folder.getFilesByName(name);if(it.hasNext())ss=SpreadsheetApp.openById(it.next().getId());else{ss=SpreadsheetApp.create(name);const f=DriveApp.getFileById(ss.getId());folder.addFile(f);try{DriveApp.getRootFolder().removeFile(f);}catch(e){}ss.getActiveSheet().setName('Log');ss.getActiveSheet().appendRow(['timestamp','file','status','category','message','sheetUrl','pdfUrl']);}ss.getSheetByName('Log').appendRow([new Date(),file,status,cat,msg,sheetUrl,pdfUrl]);}
