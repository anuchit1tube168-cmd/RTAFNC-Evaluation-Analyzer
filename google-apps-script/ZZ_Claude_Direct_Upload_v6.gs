/**
 * RTAFNC v6 Claude Direct Upload Override
 *
 * Adds a production-safe direct browser mode:
 *   Browser reads Excel/CSV with SheetJS -> canonical JSON -> Apps Script creates Sheet/PDF.
 * This avoids broken file-blob uploads that previously created 0-byte raw_upload.xlsx files.
 *
 * Contract:
 * {
 *   category, year, title, sourceFile, sheet,
 *   questions: [string],
 *   students: [{ no, id, name, email, year, scores:[1..5|null], comment }]
 * }
 */

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '{}';
    const payload = JSON.parse(raw);
    const result = processCanonicalPayloadV6_(payload, 'api-post');
    return jsonp_(result, null);
  } catch (err) {
    return jsonp_({ ok: false, status: 'ERROR', error: String(err && err.stack ? err.stack : err) }, null);
  }
}

function processCanonicalFromBrowser(payload) {
  return processCanonicalPayloadV6_(payload, 'apps-script-ui');
}

function processCanonicalPayloadV6_(payload, sourceMode) {
  const a = buildAnalysisFromCanonicalV6_(payload, sourceMode);
  const output = createOutputWorkbook_(a);
  const pdfResults = [];
  output.groups.forEach(function(g) {
    const pdf = exportPdf_(output.spreadsheetId, safeName_(a.safeName + '_' + g.label) + '.pdf', g.printGid);
    pdfResults.push({ label: g.label, url: pdf.url, hasData: g.hasData, source: g.source });
  });
  appendLog_(a.rawName, 'SUCCESS_DIRECT', a.category, 'processed from canonical json via ' + sourceMode, output.url, pdfResults.map(function(p){ return p.url; }).join('\n'));
  return {
    ok: true,
    status: 'SUCCESS',
    version: 'v6-claude-direct-canonical',
    mode: sourceMode,
    category: a.category,
    title: a.title,
    file: a.rawName,
    n: a.respondents.length,
    q: a.items.length,
    itemCount: a.items.length,
    respondents: a.respondents.length,
    avg: round2_(a.overallMean),
    interp: level_(a.overallMean),
    outputSpreadsheetUrl: output.url,
    sheetUrl: output.url,
    pdfUrls: pdfResults,
    pdfCount: pdfResults.length
  };
}

function buildAnalysisFromCanonicalV6_(p, sourceMode) {
  if (!p || !Array.isArray(p.questions) || !p.questions.length) throw new Error('ไม่มีข้อคำถามใน canonical JSON');
  if (!Array.isArray(p.students) || !p.students.length) throw new Error('ไม่มีข้อมูลผู้ประเมินใน canonical JSON');
  if (p.questions.length > 120) throw new Error('จำนวนข้อคำถามมากเกินไป: ' + p.questions.length);
  if (p.students.length > 3000) throw new Error('จำนวนผู้ประเมินมากเกินไป: ' + p.students.length);

  const category = String(p.category || 'อื่นๆ').trim() || 'อื่นๆ';
  const title = String(p.title || p.sourceFile || 'Direct Upload').trim();
  const academicYear = String(p.year || CONFIG.ACADEMIC_YEAR || '').trim();
  const rawName = String(p.sourceFile || title || 'claude-direct-upload.json').trim();

  const items = p.questions.map(function(q, i) {
    const text = String(q || '').replace(/\s+/g, ' ').trim() || ('ข้อ ' + (i + 1));
    const m = text.match(/^(\d+(?:\.\d+)?)/);
    const code = m ? m[1] : String(i + 1);
    return { no: i + 1, code: code, text: text, col: i, row: '' };
  });

  const respondents = p.students.map(function(s, i) {
    const scores = items.map(function(_, k) {
      const n = Number((s.scores || [])[k]);
      return pIsValidScore_(n) ? n : null;
    });
    const y = pNormalizeYear_(s.year || s.classYear || '');
    return {
      seq: s.no || i + 1,
      id: s.id || s.code || s.studentId || s.no || '',
      name: pCleanThaiName_(s.name || s.fullName || ''),
      email: s.email || '',
      year: /^[1-4]$/.test(String(y)) ? String(y) : '',
      yearSource: /^[1-4]$/.test(String(y)) ? 'canonical.year' : 'none',
      scores: scores,
      comment: String(s.comment || s.note || '').trim(),
      rowIndex: i + 1
    };
  }).filter(function(r) {
    return r.name || (r.scores || []).some(function(v){ return pIsValidScore_(v); });
  });

  if (!respondents.length) throw new Error('ไม่มีแถวผู้ประเมินที่ใช้ได้หลัง clean');

  const itemStats = items.map(function(item, idx) {
    const vals = [];
    respondents.forEach(function(r) { const v = r.scores[idx]; if (pIsValidScore_(v)) vals.push(v); });
    const m = vals.length ? mean_(vals) : 0;
    const sd = vals.length > 1 ? sdSample_(vals) : 0;
    return { no: item.no, code: item.code, text: item.text, col: idx, row: '', n: vals.length, mean: round2_(m), sd: round2_(sd), level: vals.length ? level_(m) : '' };
  });

  const allScores = [];
  respondents.forEach(function(r) { (r.scores || []).forEach(function(v){ if (pIsValidScore_(v)) allScores.push(v); }); });
  const overallMean = allScores.length ? mean_(allScores) : 0;
  const overallSd = allScores.length > 1 ? sdSample_(allScores) : 0;
  const hasYear = respondents.some(function(r){ return /^[1-4]$/.test(String(r.year || '')); });

  return {
    rawName: rawName,
    safeName: safeName_('ผลวิเคราะห์_' + category + '_' + academicYear + '_' + title),
    category: category,
    confidence: 1,
    title: title,
    sheetName: p.sheet || 'Canonical JSON',
    parseMode: 'canonical-json',
    sourceMode: sourceMode,
    sourceFile: rawName,
    academicYear: academicYear,
    items: items,
    itemStats: itemStats,
    respondents: respondents,
    overallMean: overallMean,
    overallSd: overallSd,
    classYearSource: hasYear ? 'canonical.year' : 'none'
  };
}

function buildUploadPage_() {
  return '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RTAFNC Direct Upload</title><script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script><style>body{font-family:Tahoma,Arial,sans-serif;background:#f4f7fb;color:#102033;margin:0;padding:24px}.box{max-width:980px;margin:auto;background:#fff;border-radius:22px;padding:24px;box-shadow:0 14px 35px #0001}.drop{border:2px dashed #9aa7bd;border-radius:16px;padding:36px;text-align:center;cursor:pointer;background:#fbfdff}button{border:0;border-radius:12px;padding:12px 16px;font-weight:700;margin:4px;cursor:pointer}.primary{background:#0b2347;color:#fff}.green{background:#0b7a3b;color:#fff}.red{background:#991b1b;color:#fff}input,select{padding:10px;border:1px solid #cbd5e1;border-radius:10px;width:100%;max-width:520px}pre{white-space:pre-wrap;background:#111827;color:#d1fae5;padding:14px;border-radius:14px;overflow:auto}.ok{color:#0b7a3b;font-weight:700}.warn{color:#b45309;font-weight:700}table{border-collapse:collapse;width:100%;margin-top:10px}td,th{border:1px solid #e5e7eb;padding:6px;font-size:13px}</style></head><body><div class="box"><h1>RTAFNC Direct Upload v6</h1><p><b>Claude Mode:</b> อ่าน Excel/CSV ใน browser แล้วส่ง canonical JSON เข้า Apps Script เพื่อสร้าง Excel/Sheet + PDF โดยไม่อัปโหลดไฟล์ blob จึงไม่เกิดไฟล์ 0 byte</p><div id="drop" class="drop">คลิกเลือกไฟล์หรือลากไฟล์มาวาง<br><small>.xlsx .xls .csv</small><input id="file" type="file" accept=".xlsx,.xls,.csv" style="display:none"></div><p><label>หมวดงาน</label><br><select id="category"><option>อาจารย์ที่ปรึกษา</option><option>นภาภิบาล</option><option>เจตคติ</option><option>ทหาร_1_4</option><option>คุณลักษณะทางทหาร</option><option>จิตอาสา</option><option>เดินทางไกล</option><option>อื่นๆ</option></select></p><p><label>ปีการศึกษา</label><br><input id="year" value="2568"></p><p><label>หัวรายงาน</label><br><input id="title" placeholder="ระบบจะใส่ชื่อไฟล์ให้อัตโนมัติ"></p><p><button class="primary" onclick="runHealth()">Health</button><button class="green" id="send" onclick="sendPayload()" disabled>ประมวลผล Excel/PDF</button></p><div id="summary"></div><pre id="out">พร้อมใช้งาน</pre></div><script>let payload=null;const $=id=>document.getElementById(id);function out(x){$(\'out\').textContent=typeof x===\'string\'?x:JSON.stringify(x,null,2)}function clean(v){return String(v==null?\'\':v).trim()}function validScore(v){const n=Number(v);return Number.isFinite(n)&&n>=1&&n<=5}$(\'drop\').onclick=()=>$(\'file\').click();$(\'file\').onchange=()=>$(\'file\').files[0]&&readFile($(\'file\').files[0]);[\'dragover\',\'drop\'].forEach(ev=>$(\'drop\').addEventListener(ev,e=>{e.preventDefault();if(ev===\'drop\'&&e.dataTransfer.files[0])readFile(e.dataTransfer.files[0])}));function readFile(f){const r=new FileReader();r.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:\'array\'});analyze(wb,f.name)}catch(err){out({ok:false,error:String(err)})}};r.readAsArrayBuffer(f)}function looksRow(r){if(!r||r.length<3)return false;const hasName=r.some(v=>/นพอ|นาย|นางสาว|น\\.ส\\.|เรือ|อากาศ/i.test(clean(v)));const scoreCount=r.filter(validScore).length;return hasName&&scoreCount>=3}function classify(vals,total){const s=vals.map(clean).filter(Boolean);if(!s.length)return \"empty\";if(s.filter(v=>/@/.test(v)).length/s.length>.7)return \"email\";if(s.filter(v=>/ชั้นปี|ปี\\s*[1-4]|^[1-4]$/.test(v)).length/s.length>.6)return \"year\";if(s.filter(v=>/นพอ|นาย|นางสาว|น\\.ส\\.|เรือ|อากาศ/i.test(v)).length/s.length>.5)return \"name\";const nums=vals.map(Number).filter(n=>Number.isFinite(n));if(nums.length/s.length>.8){if(nums.every(n=>n>=1&&n<=5&&Number.isInteger(n)))return \"score\";if(nums.every(n=>Number.isInteger(n)))return \"no\";return \"derived\"}if(s.filter(v=>v.length>8&&v!==\'-\').length)return \"comment\";return \"other\"}function header(rows,data,col){const first=rows.indexOf(data[0]);for(let r=first-1;r>=0&&r>=first-4;r--){const v=rows[r]&&rows[r][col];if(clean(v))return clean(v)}return null}function analyze(wb,name){let best=null,rows=[];wb.SheetNames.forEach(sn=>{const r=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null});const d=r.filter(looksRow);if(d.length>rows.length){best={name:sn,all:r,data:d};rows=d}});if(!best){out({ok:false,error:\'ไม่พบแถวข้อมูลที่มีชื่อและคะแนน\'});return}const n=Math.max(...best.data.map(r=>r.length));const roles=[];for(let c=0;c<n;c++)roles[c]=classify(best.data.map(r=>r[c]).filter(v=>v!=null&&v!==\'\'),best.data.length);roles.forEach((ro,c)=>{if(ro===\'score\'){const vals=best.data.map(r=>Number(r[c])).filter(Number.isFinite);const frac=vals.filter(v=>v%1!==0).length;if(vals.length&&frac/vals.length>.3)roles[c]=\'derived\'}});const scoreCols=roles.map((r,i)=>r===\'score\'?i:-1).filter(i=>i>=0);const nameCol=roles.indexOf(\'name\'), noCol=roles.indexOf(\'no\'), emailCol=roles.indexOf(\'email\'), yearCol=roles.indexOf(\'year\');const cmCols=roles.map((r,i)=>r===\'comment\'?i:-1).filter(i=>i>=0);if(!scoreCols.length){out({ok:false,error:\'ไม่พบคอลัมน์คะแนน 1-5\'});return}payload={category:$(\'category\').value,year:$(\'year\').value,title:$(\'title\').value||name.replace(/\\.(xlsx|xls|csv)$/i,\'\'),sourceFile:name,sheet:best.name,questions:scoreCols.map((c,i)=>header(best.all,best.data,c)||\'ข้อ \'+(i+1)),students:best.data.map((r,i)=>({no:noCol>=0?r[noCol]:i+1,name:nameCol>=0?clean(r[nameCol]):\'\',email:emailCol>=0?clean(r[emailCol]):\'\',year:yearCol>=0?clean(r[yearCol]):\'\',scores:scoreCols.map(c=>validScore(r[c])?Number(r[c]):null),comment:cmCols.map(c=>clean(r[c])).filter(v=>v&&v!==\'-\').join(\' | \')}))};$(\'title\').value=payload.title;$(\'send\').disabled=false;$(\'summary\').innerHTML=\'<p class=ok>อ่านไฟล์สำเร็จ: \'+payload.students.length+\' คน / \'+payload.questions.length+\' ข้อ / Sheet: \'+best.name+\'</p><table><tr><th>ลำดับ</th><th>ชื่อ</th><th>ตัวอย่างคะแนน</th></tr>\'+payload.students.slice(0,5).map((s,i)=>\'<tr><td>\'+(i+1)+\'</td><td>\'+s.name+\'</td><td>\'+s.scores.slice(0,8).join(\',\')+\'</td></tr>\').join(\'\')+\'</table>\';out({ok:true,preview:{sheet:best.name,respondents:payload.students.length,items:payload.questions.length,firstItems:payload.questions.slice(0,5)}})}function runHealth(){google.script.run.withSuccessHandler(out).withFailureHandler(e=>out({ok:false,error:String(e)})).getHealth_()}function sendPayload(){if(!payload)return;payload.category=$(\'category\').value;payload.year=$(\'year\').value;payload.title=$(\'title\').value||payload.title;$(\'send\').disabled=true;out(\'กำลังสร้าง Excel/PDF...\');google.script.run.withSuccessHandler(r=>{out(r);$(\'send\').disabled=false;if(r&&r.ok){let h=\'<p class=ok>SUCCESS: สร้างผลลัพธ์แล้ว</p><p><a target=_blank href=\"\'+r.outputSpreadsheetUrl+\'\">เปิด Excel/Sheet</a></p>\';(r.pdfUrls||[]).forEach(p=>{h+=\'<p><a target=_blank href=\"\'+p.url+\'\">เปิด PDF \'+(p.label||\'\')+\'</a></p>\'});$(\'summary\').innerHTML+=h}}).withFailureHandler(e=>{out({ok:false,error:String(e)});$(\'send\').disabled=false}).processCanonicalFromBrowser(payload)}</script></body></html>';
}
