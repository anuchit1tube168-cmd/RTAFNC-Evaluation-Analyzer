/**
 * Pokkrong Evaluation Direct Upload v1
 * Claude-derived module for RTAFNC-Evaluation-Analyzer.
 * It overrides buildUploadPage_ so Apps Script root opens a direct browser parser.
 * It does not replace the existing v6 Drive Queue APIs.
 */

function buildUploadPage_() {
  return HtmlService.createHtmlOutput(pokkrongDirectUploadHtml_())
    .setTitle('RTAFNC Direct Upload')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function pokkrongHealth() {
  return {
    ok: true,
    service: 'pokkrong-eval-direct-upload',
    version: '1.0.0',
    backend: 'RTAFNC Evaluation Analyzer v6 compatible',
    outputFolder: CONFIG.SUMMARY_FOLDER_ID,
    pdfFolder: CONFIG.PDF_FOLDER_ID,
    year: CONFIG.ACADEMIC_YEAR,
    time: new Date().toISOString()
  };
}

function pokkrongProcess(payload) {
  try {
    const p = pokkrongValidate_(payload || {});
    const result = pokkrongBuildWorkbook_(p);
    return { ok: true, status: 'SUCCESS', system: 'pokkrong-eval-direct-upload', version: '1.0.0', ...result };
  } catch (err) {
    return { ok: false, status: 'ERROR', error: String(err && err.stack ? err.stack : err) };
  }
}

function doPost(e) {
  try {
    let payload = null;
    if (e && e.parameter && e.parameter.payload) payload = JSON.parse(e.parameter.payload);
    else if (e && e.postData && e.postData.contents) payload = JSON.parse(e.postData.contents);
    else throw new Error('ไม่พบ payload');
    const result = pokkrongProcess(payload);
    if (e && e.parameter && e.parameter.payload) return HtmlService.createHtmlOutput(pokkrongResultHtml_(result));
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    const result = { ok: false, status: 'ERROR', error: String(err && err.stack ? err.stack : err) };
    return HtmlService.createHtmlOutput(pokkrongResultHtml_(result));
  }
}

function pokkrongValidate_(p) {
  if (!p || !Array.isArray(p.students) || !p.students.length) throw new Error('ไม่มีข้อมูลผู้ประเมิน');
  if (!Array.isArray(p.questions) || !p.questions.length) throw new Error('ไม่มีข้อคำถาม');
  if (p.students.length > 3000) throw new Error('ข้อมูลเกิน 3000 แถว');
  const questions = p.questions.map((q, i) => String(q || ('ข้อ ' + (i + 1))).trim());
  const students = p.students.map((s, i) => {
    const scores = questions.map((_, k) => {
      const n = Number((s.scores || [])[k]);
      return n >= 1 && n <= 5 ? n : '';
    });
    return {
      no: s.no || (i + 1),
      name: String(s.name || '').trim() || ('ผู้ตอบ ' + (i + 1)),
      scores: scores,
      comment: String(s.comment || '').trim()
    };
  });
  return {
    category: String(p.category || 'ไม่ระบุหมวด').trim(),
    year: String(p.year || CONFIG.ACADEMIC_YEAR || '2568').trim(),
    title: String(p.title || p.sourceFile || 'แบบประเมิน').trim(),
    sourceFile: String(p.sourceFile || '').trim(),
    sheet: String(p.sheet || '').trim(),
    questions: questions,
    students: students
  };
}

function pokkrongBuildWorkbook_(p) {
  const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
  const safe = pokkrongSafeName_(['ผล', p.category, p.title, p.year, now].join('_'));
  const ss = SpreadsheetApp.create(safe);
  const file = DriveApp.getFileById(ss.getId());
  DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID).addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch (e) {}

  const sh = ss.getSheets()[0].setName('รวม');
  const qSh = ss.insertSheet('ข้อคำถาม');
  const cSh = ss.insertSheet('ข้อคิดเห็น');
  const sSh = ss.insertSheet('สรุป');
  const qaSh = ss.insertSheet('QA_Log');

  pokkrongWriteMain_(sh, p);
  pokkrongWriteQuestions_(qSh, p.questions);
  pokkrongWriteComments_(cSh, p.students);
  const summary = pokkrongWriteSummary_(sSh, p);
  pokkrongWriteQa_(qaSh, p, summary);
  [sh, qSh, cSh, sSh, qaSh].forEach(pokkrongApplyStyle_);
  SpreadsheetApp.flush();

  const pdf = pokkrongExportPdf_(ss.getId(), safe + '.pdf', sSh.getSheetId());
  return {
    url: ss.getUrl(),
    outputSpreadsheetUrl: ss.getUrl(),
    pdfUrl: pdf.url,
    pdfUrls: [{ label: 'สรุป', url: pdf.url }],
    n: p.students.length,
    q: p.questions.length,
    avg: summary.avg,
    sd: summary.sd,
    interp: pokkrongLevel_(summary.avg),
    category: p.category,
    year: p.year,
    title: p.title
  };
}

function pokkrongWriteMain_(sh, p) {
  const headers = ['เลขที่', 'ชื่อ-สกุล'].concat(p.questions.map((q, i) => (i + 1) + '. ' + pokkrongShort_(q, 36))).concat(['ค่าเฉลี่ย', 'SD', 'ระดับ', 'ข้อคิดเห็น']);
  sh.getRange(1, 1, 1, headers.length).merge().setValue('ผลการประเมิน: ' + p.title);
  sh.getRange(2, 1, 1, headers.length).merge().setValue('หมวด: ' + p.category + ' | ปีการศึกษา: ' + p.year + ' | ผู้ประเมิน: ' + p.students.length + ' คน');
  sh.getRange(3, 1, 1, headers.length).setValues([headers]);
  const rows = p.students.map((s) => {
    const stats = pokkrongStats_(s.scores);
    return [s.no, s.name].concat(s.scores).concat([stats.avg, stats.sd, pokkrongLevel_(stats.avg), s.comment]);
  });
  if (rows.length) sh.getRange(4, 1, rows.length, headers.length).setValues(rows);
  sh.setFrozenRows(3);
  sh.setFrozenColumns(2);
}

function pokkrongWriteQuestions_(sh, questions) {
  sh.getRange(1, 1, 1, 4).setValues([['ลำดับ', 'ข้อความคำถามเต็ม', 'ประเภท', 'QA']]);
  const rows = questions.map((q, i) => [i + 1, q, 'score 1-5', /^Q\d+$/i.test(q) || /^Column/i.test(q) ? 'REVIEW' : 'PASS']);
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
  sh.getRange('B:B').setWrap(true);
}

function pokkrongWriteComments_(sh, students) {
  sh.getRange(1, 1, 1, 4).setValues([['ลำดับ', 'ชื่อ-สกุล', 'ข้อคิดเห็น', 'QA']]);
  const rows = students.filter(s => s.comment && s.comment !== '-').map((s, i) => [i + 1, s.name, s.comment, 'PASS']);
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
  sh.getRange('C:C').setWrap(true);
}

function pokkrongWriteSummary_(sh, p) {
  const all = [];
  p.students.forEach(s => s.scores.forEach(v => { if (typeof v === 'number') all.push(v); }));
  const stats = pokkrongStats_(all);
  const itemRows = p.questions.map((q, i) => {
    const vals = p.students.map(s => s.scores[i]).filter(v => typeof v === 'number');
    const st = pokkrongStats_(vals);
    return [i + 1, q, vals.length, st.avg, st.sd, pokkrongLevel_(st.avg)];
  });
  sh.getRange('A1:F1').merge().setValue('สรุปผลการประเมิน');
  sh.getRange('A3:B10').setValues([
    ['หัวข้อ', p.title], ['หมวด', p.category], ['ปีการศึกษา', p.year], ['ผู้ประเมิน', p.students.length], ['ข้อคำถาม', p.questions.length], ['ค่าเฉลี่ยรวม', stats.avg], ['SD รวม', stats.sd], ['ระดับ', pokkrongLevel_(stats.avg)]
  ]);
  sh.getRange(12, 1, 1, 6).setValues([['ข้อ', 'คำถาม', 'N', 'X', 'SD', 'ระดับ']]);
  if (itemRows.length) sh.getRange(13, 1, itemRows.length, 6).setValues(itemRows);
  sh.getRange('B:B').setWrap(true);
  return stats;
}

function pokkrongWriteQa_(sh, p, summary) {
  const rows = [
    ['รายการ', 'ผล', 'รายละเอียด'],
    ['Canonical JSON', 'PASS', 'รับข้อมูลจาก browser parser แล้ว'],
    ['จำนวนผู้ประเมิน', p.students.length ? 'PASS' : 'REVIEW', String(p.students.length)],
    ['จำนวนข้อคำถาม', p.questions.length ? 'PASS' : 'REVIEW', String(p.questions.length)],
    ['คะแนนรวม', summary.n ? 'PASS' : 'REVIEW', String(summary.n)],
    ['คำถามจริง', p.questions.some(q => /^Q\d+$/i.test(q)) ? 'REVIEW' : 'PASS', 'ตรวจ Q1/Column ก่อนใช้ทางราชการ'],
    ['ข้อคิดเห็น', p.students.some(s => s.comment) ? 'PASS' : 'INFO', 'ถ้ามีจะอยู่ sheet ข้อคิดเห็น']
  ];
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
}

function pokkrongApplyStyle_(sh) {
  const range = sh.getDataRange();
  range.setFontFamily(CONFIG.REPORT_FONT_FALLBACK || 'TH Sarabun New').setFontSize(14).setVerticalAlignment('middle');
  if (sh.getLastColumn() > 0) sh.getRange(1, 1, Math.min(3, sh.getLastRow()), sh.getLastColumn()).setFontWeight('bold').setBackground('#1E3A2F').setFontColor('#FFFFFF');
  sh.autoResizeColumns(1, Math.min(sh.getLastColumn(), 12));
}

function pokkrongExportPdf_(spreadsheetId, pdfName, gid) {
  const url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?format=pdf&gid=' + gid + '&size=A4&portrait=true&fitw=true&sheetnames=false&printtitle=false&pagenumbers=true&gridlines=false&fzr=false';
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) throw new Error('PDF export failed: HTTP ' + res.getResponseCode());
  const blob = res.getBlob().setName(pdfName);
  const file = DriveApp.getFolderById(CONFIG.PDF_FOLDER_ID).createFile(blob);
  return { url: file.getUrl(), id: file.getId() };
}

function pokkrongStats_(values) {
  const nums = (values || []).filter(v => typeof v === 'number' && !isNaN(v));
  if (!nums.length) return { n: 0, avg: '', sd: '' };
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.length > 1 ? nums.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (nums.length - 1) : 0;
  return { n: nums.length, avg: Math.round(avg * 100) / 100, sd: Math.round(Math.sqrt(variance) * 100) / 100 };
}

function pokkrongLevel_(avg) {
  const n = Number(avg);
  if (!n) return '';
  if (n >= 4.5) return 'มากที่สุด';
  if (n >= 3.5) return 'มาก';
  if (n >= 2.5) return 'ปานกลาง';
  if (n >= 1.5) return 'น้อย';
  return 'น้อยที่สุด';
}

function pokkrongShort_(text, max) {
  const s = String(text || '').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function pokkrongSafeName_(name) {
  return String(name || 'result').replace(/[\\/:*?"<>|#%{}~&]/g, '_').slice(0, 180);
}

function pokkrongResultHtml_(r) {
  if (!r || !r.ok) return '<html><body style="font-family:Tahoma;padding:24px"><h2>ERROR</h2><pre>' + pokkrongEscape_(r && r.error || 'unknown') + '</pre></body></html>';
  return '<html><body style="font-family:Tahoma;padding:24px"><h2>SUCCESS</h2><p>สร้างผลประเมินสำเร็จ</p><p><a target="_blank" href="' + r.outputSpreadsheetUrl + '">เปิด Excel/Google Sheet</a></p><p><a target="_blank" href="' + r.pdfUrl + '">เปิด PDF</a></p><pre>' + pokkrongEscape_(JSON.stringify(r, null, 2)) + '</pre></body></html>';
}

function pokkrongEscape_(s) {
  return String(s || '').replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]; });
}

function pokkrongDirectUploadHtml_() {
  return '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RTAFNC Direct Upload</title><script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script></head><body style="margin:0;font-family:Tahoma,sans-serif;background:#12211B;color:#EDE7DA"><header style="padding:22px 28px;background:#1E3A2F;border-bottom:3px solid #D9A83C"><h1 style="color:#D9A83C">ระบบประเมินแผนกปกครอง วพอ.พอ. — Direct Upload</h1><p>อ่านไฟล์ Excel/CSV ใน browser → ตรวจโครงสร้าง → สร้าง Google Sheet + PDF ใน Drive</p></header><main style="max-width:980px;margin:24px auto;padding:0 16px"><div style="background:#1B3028;border:1px solid #33584A;border-radius:16px;padding:20px;margin-bottom:16px"><h2 style="color:#D9A83C">1) อัปโหลดไฟล์ข้อมูลดิบ</h2><div id="drop" style="border:2px dashed #33584A;border-radius:12px;padding:42px;text-align:center;cursor:pointer"><div style="font-size:42px">📄</div><p>ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</p><small>รองรับ .xlsx / .xls / .csv</small><input type="file" id="file" accept=".xlsx,.xls,.csv" style="display:none"></div></div><div id="cardDetect" style="display:none;background:#1B3028;border:1px solid #33584A;border-radius:16px;padding:20px;margin-bottom:16px"><h2 style="color:#D9A83C">2) ตรวจสอบผลวิเคราะห์ แล้วยืนยัน</h2><p>ผู้ประเมิน <b id="stN">-</b> | ข้อคำถาม <b id="stQ">-</b> | ข้อคิดเห็น <b id="stC">-</b> | Sheet <b id="stSheet">-</b></p><label>หมวดงาน</label><select id="category"><option>ทหาร_1_4</option><option>อาจารย์ที่ปรึกษา</option><option>เจตคติ</option><option>นภาภิบาล</option><option>คุณลักษณะทางทหาร</option><option>จิตอาสา</option><option>SMART_NURSE</option><option>อุทธรณ์ร้องทุกข์</option><option>การรักษาความลับ</option><option>บริการข้อมูล</option><option>สุขภาพชมรมกีฬา</option><option>สร้างสรรค์กล้าหาญอดทน</option></select><label>ปีการศึกษา</label><input id="year" value="' + (CONFIG.ACADEMIC_YEAR || '2568') + '"><label>ชื่อกิจกรรม/รายงาน</label><input id="title"><h3>คอลัมน์ที่ตรวจพบ</h3><div id="colTags"></div><h3>ตัวอย่างข้อมูล</h3><div style="overflow:auto"><table id="preview" style="width:100%;border-collapse:collapse"></table></div><p><button id="btnSend">✓ ยืนยันและประมวลผล</button><button onclick="location.reload()">เริ่มใหม่</button></p><div id="status"></div><details><summary>Canonical JSON</summary><pre id="jsonPreview"></pre></details></div><div style="background:#1B3028;border:1px solid #33584A;border-radius:16px;padding:20px"><h2 style="color:#D9A83C">Backend</h2><button onclick="health()">ตรวจ backend</button><pre id="healthOut">พร้อมใช้งาน</pre></div><script>const $=id=>document.getElementById(id);let payload=null;const drop=$("drop"),file=$("file");drop.onclick=()=>file.click();["dragover","dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();if(ev==="drop"&&e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);}));file.onchange=()=>file.files[0]&&handleFile(file.files[0]);function handleFile(f){const rd=new FileReader();rd.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:"array"});analyze(wb,f.name)}catch(err){alert("อ่านไฟล์ไม่ได้: "+err.message)}};rd.readAsArrayBuffer(f)}function analyze(wb,fname){let best=null,bestRows=[],bestCount=0;for(const name of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null});const c=rows.filter(r=>looksDataRow(r)).length;if(c>bestCount){bestCount=c;best=name;bestRows=rows}}if(!best||bestCount===0){alert("ไม่พบตารางคะแนนในไฟล์");return}const dataRows=bestRows.filter(looksDataRow);const nCols=Math.max(...dataRows.map(r=>r.length));const roles=[];for(let c=0;c<nCols;c++){const vals=dataRows.map(r=>r[c]).filter(v=>v!==null&&v!=="");roles.push(classify(vals,c,dataRows.length))}roles.forEach((ro,c)=>{if(ro==="score"){const vals=dataRows.map(r=>r[c]).filter(v=>typeof v==="number");const frac=vals.filter(v=>v%1!==0).length;if(vals.length&&frac/vals.length>0.3)roles[c]="derived"}});const scoreCols=roles.map((r,i)=>r==="score"?i:-1).filter(i=>i>=0);const nameCol=roles.indexOf("name"),noCol=roles.indexOf("no"),cmCols=roles.map((r,i)=>r==="comment"?i:-1).filter(i=>i>=0);if(!scoreCols.length){alert("ไม่พบคอลัมน์คะแนน 1-5");return}payload={category:$("category").value,year:$("year").value,title:fname.replace(/\\.(xlsx|xls|csv)$/i,""),sourceFile:fname,sheet:best,questions:scoreCols.map((c,i)=>headerFor(bestRows,dataRows,c)||("ข้อ "+(i+1))),students:dataRows.map((r,i)=>({no:noCol>=0?r[noCol]:i+1,name:nameCol>=0?String(r[nameCol]??"").trim():"",scores:scoreCols.map(c=>typeof r[c]==="number"?r[c]:parseFloat(r[c])||null),comment:cmCols.map(c=>r[c]).filter(v=>v&&String(v).trim()&&String(v).trim()!=="-").join(" | ")}))};renderDetect(roles,scoreCols,best)}function looksDataRow(r){if(!r||r.length<3)return false;const hasName=r.some(v=>typeof v==="string"&&/นพอ|นาย|นางสาว|น\\.ส\\./.test(v));const scores=r.filter(v=>typeof v==="number"&&v>=1&&v<=5&&v%1===0).length;return hasName&&scores>=3}function classify(vals,c,total){if(!vals.length)return"empty";const s=vals.map(String);if(s.every(v=>/@/.test(v)))return"email";if(s.filter(v=>/นพอ|นาย|นางสาว/.test(v)).length/vals.length>0.5)return"name";const nums=vals.filter(v=>typeof v==="number");if(nums.length/vals.length>0.8){if(nums.every(v=>v>=1&&v<=5))return"score";const ints=nums.every(v=>v%1===0);const asc=nums.every((v,i)=>i===0||v>=nums[i-1]);if(ints&&asc&&nums.length>=total*0.8)return"no";return"derived"}const longTxt=s.filter(v=>v.trim().length>8&&v.trim()!=="-").length;if(longTxt>0)return"comment";return"other"}function headerFor(allRows,dataRows,col){const firstIdx=allRows.indexOf(dataRows[0]);for(let r=firstIdx-1;r>=0&&r>=firstIdx-3;r--){const v=allRows[r]&&allRows[r][col];if(v!==null&&v!==undefined&&String(v).trim())return String(v).trim()}return null}function renderDetect(roles,scoreCols,sheetName){$("cardDetect").style.display="block";$("stN").textContent=payload.students.length;$("stQ").textContent=scoreCols.length;$("stC").textContent=payload.students.filter(s=>s.comment).length;$("stSheet").textContent=sheetName;$("title").value=payload.title;const names={no:"เลขที่",name:"ชื่อ",email:"อีเมล",timestamp:"เวลา",score:"คะแนน",comment:"ความเห็น",derived:"ค่าเฉลี่ย/SD ตัดออก",other:"อื่นๆ",empty:"ว่าง"};$("colTags").innerHTML=roles.map((r,i)=>"<span style=\"display:inline-block;border:1px solid #D9A83C;border-radius:20px;padding:2px 8px;margin:2px\">"+(i+1)+":"+(names[r]||r)+"</span>").join("");$("preview").innerHTML="<tr><th>เลขที่</th><th>ชื่อ</th>"+payload.questions.map((q,i)=>"<th>"+(i+1)+"</th>").join("")+"<th>ความเห็น</th></tr>"+payload.students.slice(0,5).map(s=>"<tr><td>"+(s.no??"")+"</td><td>"+escapeHtml(s.name)+"</td>"+s.scores.map(v=>"<td>"+(v??"")+"</td>").join("")+"<td>"+escapeHtml((s.comment||"").slice(0,30))+"</td></tr>").join("");$("jsonPreview").textContent=JSON.stringify(payload,null,2)}$("btnSend").onclick=()=>{payload.category=$("category").value;payload.year=$("year").value.trim();payload.title=$("title").value.trim()||payload.title;$("status").textContent="กำลังประมวลผล...";$("btnSend").disabled=true;google.script.run.withSuccessHandler(out=>{if(out.ok){$("status").innerHTML="✅ SUCCESS<br><a target=\"_blank\" href=\""+out.outputSpreadsheetUrl+"\">เปิด Excel/Google Sheet</a><br><a target=\"_blank\" href=\""+out.pdfUrl+"\">เปิด PDF</a><br>ผู้ประเมิน "+out.n+" คน · "+out.q+" ข้อ · X "+out.avg+" ("+out.interp+")"}else{$("status").textContent="ERROR: "+out.error}$("btnSend").disabled=false}).withFailureHandler(err=>{$("status").textContent="ERROR: "+(err.message||err);$("btnSend").disabled=false}).pokkrongProcess(payload)};function health(){google.script.run.withSuccessHandler(r=>{$("healthOut").textContent=JSON.stringify(r,null,2)}).pokkrongHealth()}function escapeHtml(s){return String(s||"").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","'":"&#039;"}[m]))}health();</script></main></body></html>';
}
