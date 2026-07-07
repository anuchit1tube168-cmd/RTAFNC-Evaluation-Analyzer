let payload = null;
const $c = id => document.getElementById(id);
function out(x){ $c('out').textContent = typeof x === 'string' ? x : JSON.stringify(x, null, 2); }
function clean(v){ return String(v == null ? '' : v).trim(); }
function validScore(v){ const n = Number(v); return Number.isFinite(n) && n >= 1 && n <= 5; }

function initClaudeDirect(){
  const drop = $c('drop');
  const file = $c('file');
  drop.onclick = () => file.click();
  file.onchange = () => file.files[0] && readFile(file.files[0]);
  ['dragover','drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault();
    if (ev === 'drop' && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  }));
}

function readFile(f){
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      analyzeWorkbook(wb, f.name);
    } catch (err) { out({ ok:false, error:String(err) }); }
  };
  reader.readAsArrayBuffer(f);
}

function looksDataRow(r){
  if (!r || r.length < 3) return false;
  const hasName = r.some(v => /นพอ|นาย|นางสาว|น\.ส\.|เรือ|อากาศ/i.test(clean(v)));
  const scoreCount = r.filter(validScore).length;
  return hasName && scoreCount >= 3;
}

function classifyColumn(vals){
  const s = vals.map(clean).filter(Boolean);
  if (!s.length) return 'empty';
  if (s.filter(v => /@/.test(v)).length / s.length > .7) return 'email';
  if (s.filter(v => /ชั้นปี|ปี\s*[1-4]|^[1-4]$/.test(v)).length / s.length > .6) return 'year';
  if (s.filter(v => /นพอ|นาย|นางสาว|น\.ส\.|เรือ|อากาศ/i.test(v)).length / s.length > .5) return 'name';
  const nums = vals.map(Number).filter(Number.isFinite);
  if (nums.length / s.length > .8) {
    if (nums.every(n => n >= 1 && n <= 5 && Number.isInteger(n))) return 'score';
    if (nums.every(Number.isInteger)) return 'no';
    return 'derived';
  }
  if (s.filter(v => v.length > 8 && v !== '-').length) return 'comment';
  return 'other';
}

function headerFor(allRows, dataRows, col){
  const first = allRows.indexOf(dataRows[0]);
  for (let r = first - 1; r >= 0 && r >= first - 4; r--) {
    const v = allRows[r] && allRows[r][col];
    if (clean(v)) return clean(v);
  }
  return null;
}

function analyzeWorkbook(wb, fileName){
  let best = null;
  wb.SheetNames.forEach(name => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header:1, defval:null });
    const data = rows.filter(looksDataRow);
    if (!best || data.length > best.data.length) best = { name, rows, data };
  });
  if (!best || !best.data.length) { out({ ok:false, error:'ไม่พบแถวข้อมูลที่มีชื่อและคะแนน' }); return; }
  const width = Math.max(...best.data.map(r => r.length));
  const roles = [];
  for (let c = 0; c < width; c++) roles[c] = classifyColumn(best.data.map(r => r[c]).filter(v => v != null && v !== ''));
  roles.forEach((role, c) => {
    if (role === 'score') {
      const vals = best.data.map(r => Number(r[c])).filter(Number.isFinite);
      const frac = vals.filter(v => v % 1 !== 0).length;
      if (vals.length && frac / vals.length > .3) roles[c] = 'derived';
    }
  });
  const scoreCols = roles.map((r,i) => r === 'score' ? i : -1).filter(i => i >= 0);
  const nameCol = roles.indexOf('name');
  const noCol = roles.indexOf('no');
  const emailCol = roles.indexOf('email');
  const yearCol = roles.indexOf('year');
  const commentCols = roles.map((r,i) => r === 'comment' ? i : -1).filter(i => i >= 0);
  if (!scoreCols.length) { out({ ok:false, error:'ไม่พบคอลัมน์คะแนน 1-5' }); return; }
  payload = {
    category: $c('category').value,
    year: $c('year').value,
    title: $c('title').value || fileName.replace(/\.(xlsx|xls|csv)$/i,''),
    sourceFile: fileName,
    sheet: best.name,
    questions: scoreCols.map((c,i) => headerFor(best.rows, best.data, c) || ('ข้อ ' + (i+1))),
    students: best.data.map((r,i) => ({
      no: noCol >= 0 ? r[noCol] : i + 1,
      name: nameCol >= 0 ? clean(r[nameCol]) : '',
      email: emailCol >= 0 ? clean(r[emailCol]) : '',
      year: yearCol >= 0 ? clean(r[yearCol]) : '',
      scores: scoreCols.map(c => validScore(r[c]) ? Number(r[c]) : null),
      comment: commentCols.map(c => clean(r[c])).filter(v => v && v !== '-').join(' | ')
    }))
  };
  $c('title').value = payload.title;
  $c('send').disabled = false;
  $c('summary').innerHTML = '<p class="ok">อ่านไฟล์สำเร็จ: ' + payload.students.length + ' คน / ' + payload.questions.length + ' ข้อ / Sheet: ' + best.name + '</p>';
  out({ ok:true, preview:{ sheet:best.name, respondents:payload.students.length, items:payload.questions.length, firstItems:payload.questions.slice(0,5) } });
}

function runHealth(){
  google.script.run.withSuccessHandler(out).withFailureHandler(e => out({ ok:false, error:String(e) })).getHealth_();
}

function sendPayload(){
  if (!payload) return;
  payload.category = $c('category').value;
  payload.year = $c('year').value;
  payload.title = $c('title').value || payload.title;
  $c('send').disabled = true;
  out('กำลังสร้าง Excel/PDF...');
  google.script.run.withSuccessHandler(r => {
    out(r);
    $c('send').disabled = false;
    if (r && r.ok) {
      let html = '<p class="ok">SUCCESS: สร้างผลลัพธ์แล้ว</p>';
      html += '<p><a target="_blank" href="' + r.outputSpreadsheetUrl + '">เปิด Excel/Sheet</a></p>';
      (r.pdfUrls || []).forEach(p => { html += '<p><a target="_blank" href="' + p.url + '">เปิด PDF ' + (p.label || '') + '</a></p>'; });
      $c('summary').innerHTML += html;
    }
  }).withFailureHandler(e => {
    out({ ok:false, error:String(e) });
    $c('send').disabled = false;
  }).processCanonicalFromBrowser(payload);
}

window.addEventListener('DOMContentLoaded', initClaudeDirect);
