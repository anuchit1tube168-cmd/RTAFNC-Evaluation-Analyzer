const STORAGE_KEY = 'RTAFNC_GAS_WEB_APP_URL';
const DEFAULT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz3Uq3oJtOu95URz2HfcgdPnoRYPdaJfFoRi1Eh9-9sRkTx-_iEODKFNN903N0BcVQq/exec';
const DRIVE_PENDING_FOLDER = 'https://drive.google.com/drive/folders/1fNEzh_47BmVwuNLY3tgnYq0Jy7RsFaue';

window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKEND_URL;
  const input = document.getElementById('gasUrl');
  if (input) input.value = saved;
  if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, DEFAULT_BACKEND_URL);
  healthCheck();
});

function saveBackendUrl(){
  const url = document.getElementById('gasUrl').value.trim();
  if(!url || !url.startsWith('https://script.google.com/macros/s/')) return setBackendStatus('URL ไม่ถูกต้อง', 'warn');
  localStorage.setItem(STORAGE_KEY, url);
  healthCheck();
}
function resetBackendUrl(){
  localStorage.setItem(STORAGE_KEY, DEFAULT_BACKEND_URL);
  document.getElementById('gasUrl').value = DEFAULT_BACKEND_URL;
  healthCheck();
}
function getBackendUrl(){ return localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKEND_URL; }
function openUploadSystem(){ window.open(DRIVE_PENDING_FOLDER, '_blank', 'noopener'); }
function setBackendStatus(text, cls){ const el=document.getElementById('backendStatus'); if(el){ el.textContent=text; el.className='status '+(cls||''); } }
function setRunStatus(text, cls){ const el=document.getElementById('runStatus'); if(el){ el.textContent=text; el.className='status '+(cls||''); } }
function setPill(id,text,green){ const el=document.getElementById(id); if(el){ el.textContent=text; el.className='pill '+(green?'green':''); } }
function printRaw(obj){ const el=document.getElementById('rawOutput'); if(el) el.textContent = JSON.stringify(obj,null,2); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

function jsonp(action, params={}){
  const cb = 'rtafnc_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const query = new URLSearchParams({ action, callback: cb, ...params });
  const url = getBackendUrl() + '?' + query.toString();
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const timer=setTimeout(()=>{ cleanup(); reject(new Error('Backend timeout')); },180000);
    function cleanup(){ clearTimeout(timer); delete window[cb]; script.remove(); }
    window[cb]=data=>{ cleanup(); resolve(data); };
    script.onerror=()=>{ cleanup(); reject(new Error('โหลด backend ไม่สำเร็จ ตรวจ Deploy หรือ URL')); };
    script.src=url;
    document.body.appendChild(script);
  });
}

async function healthCheck(){
  try{
    setBackendStatus('กำลังตรวจ Backend v6...', 'warn');
    setPill('connectionPill','Checking',false);
    const data = await jsonp('healthv6');
    if(data && data.ok === false) throw new Error(data.error || 'Backend returned ok=false');
    const ok = data.version === 'v6-source-driven-reports';
    setBackendStatus(ok ? 'Backend v6 พร้อมใช้งาน' : 'Backend ตอบสนองแต่ยังไม่ใช่ v6', ok ? 'ok' : 'warn');
    setPill('connectionPill', ok ? 'v6 Online' : 'Review', ok);
    printRaw(data);
  }catch(err){ showError(err); setBackendStatus('Backend ยังไม่พร้อม: '+(err.message||err),'warn'); }
}

async function selfTest(){
  try{
    setRunStatus('กำลังทดสอบระบบ v6...', 'warn');
    setPill('lastRunPill','Selftest',false);
    const data = await jsonp('selftestv6');
    if(data && data.ok === false) throw new Error(data.error || 'Backend returned ok=false');
    const ok = data.allPass === true;
    setRunStatus(`Selftest: ผ่าน ${data.passed ?? 0}/${data.total ?? 0}`, ok ? 'ok' : 'warn');
    setPill('lastRunPill', ok ? 'Selftest OK' : 'Review', ok);
    renderSelfTest(data.checks || []);
    printRaw(data);
  }catch(err){ showError(err); }
}

async function listFiles(){
  try{
    setRunStatus('กำลังตรวจไฟล์ในคิว Drive...', 'warn');
    setPill('lastRunPill','List queue',false);
    const data = await jsonp('list');
    if(data && data.ok === false) throw new Error(data.error || 'Backend returned ok=false');
    const files = data.files || [];
    const ready = files.filter(f => f.validForProcess || (f.supported && Number(f.size||0)>0)).length;
    const bad = files.filter(f => f.supported && Number(f.size||0)<=0).length;
    setRunStatus(`พบไฟล์ ${files.length} รายการ | พร้อมประมวลผล ${ready} | ไฟล์เสีย/0 byte ${bad}`, ready ? 'ok' : 'warn');
    setPill('lastRunPill', ready ? `${ready} ready` : 'No ready file', !!ready);
    renderFiles(files);
    printRaw(data);
  }catch(err){ showError(err); }
}

async function peekQueue(){
  try{
    setRunStatus('กำลัง Peek ไฟล์แรกที่พร้อมประมวลผล...', 'warn');
    setPill('lastRunPill','Peek',false);
    const data = await jsonp('peek');
    if(data && data.ok === false) throw new Error(data.error || 'Backend returned ok=false');
    const best = data.best || data;
    const ok = Number(best.itemCount||0)>0 && Number(best.respondentCount||0)>0;
    setRunStatus(ok ? `Peek ผ่าน: ${best.itemCount} ข้อ / ${best.respondentCount} ผู้ตอบ` : 'Peek ยังไม่ผ่าน', ok ? 'ok' : 'warn');
    setPill('lastRunPill', ok ? 'Peek OK' : 'Peek Review', ok);
    renderPeek(data);
    printRaw(data);
  }catch(err){ showError(err); }
}

async function processFiles(){
  if(!confirm('ยืนยันประมวลผลไฟล์ในคิว Drive?')) return;
  try{
    setRunStatus('กำลังสร้าง Excel/Sheet และ PDF...', 'warn');
    setPill('lastRunPill','Processing',false);
    const data = await jsonp('process');
    if(data && data.ok === false) throw new Error(data.error || 'Backend returned ok=false');
    const results = data.results || [];
    const success = results.filter(r => r.status === 'SUCCESS').length;
    const skipped = results.filter(r => String(r.status||'').startsWith('SKIP')).length;
    const errors = results.filter(r => r.status === 'ERROR').length;
    setRunStatus(`Process เสร็จ: SUCCESS ${success} | SKIP ${skipped} | ERROR ${errors}`, success && !errors ? 'ok' : 'warn');
    setPill('lastRunPill', success ? 'Excel/PDF Ready' : 'Review', !!success);
    renderResults(results);
    printRaw(data);
  }catch(err){ showError(err); }
}

function renderSelfTest(checks){
  const rows = checks.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${c.pass?'<b class="ok-text">PASS</b>':'<b class="warn-text">REVIEW</b>'}</td><td>${esc(c.detail||'')}</td></tr>`).join('');
  document.getElementById('resultTable').innerHTML = `<table><thead><tr><th>รายการ</th><th>ผล</th><th>รายละเอียด</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function renderFiles(files){
  const rows = files.map(f => {
    const size = Number(f.size || 0);
    const ready = f.validForProcess || (f.supported && size > 0);
    const status = ready ? '<b class="ok-text">READY</b>' : (f.supported && size <= 0 ? '<b class="warn-text">ZERO BYTE</b>' : '<b class="warn-text">SKIP</b>');
    return `<tr><td><b>${esc(f.name)}</b></td><td>${esc(size)}</td><td>${esc(f.mimeType)}</td><td>${f.supported?'YES':'NO'}</td><td>${status}</td><td><a href="${f.url}" target="_blank">เปิด</a></td></tr>`;
  }).join('');
  document.getElementById('resultTable').innerHTML = `<table><thead><tr><th>ไฟล์</th><th>Size</th><th>MIME</th><th>รองรับ</th><th>สถานะ</th><th>Drive</th></tr></thead><tbody>${rows || '<tr><td colspan="6">ไม่พบไฟล์ในคิว</td></tr>'}</tbody></table>`;
}
function renderPeek(data){
  const best = data.best || data || {};
  const items = Array.isArray(best.firstItems) ? best.firstItems.join(' | ') : '';
  document.getElementById('resultTable').innerHTML = `<table><thead><tr><th>รายการ</th><th>ค่า</th></tr></thead><tbody><tr><td>ไฟล์</td><td>${esc(best.file||data.file||'')}</td></tr><tr><td>จำนวนข้อ</td><td>${esc(best.itemCount||'')}</td></tr><tr><td>จำนวนผู้ตอบ</td><td>${esc(best.respondentCount||'')}</td></tr><tr><td>ตัวอย่างข้อ</td><td>${esc(items)}</td></tr></tbody></table>`;
}
function renderResults(results){
  const rows = results.map(r => {
    const sheet = r.outputSpreadsheetUrl || r.sheetUrl || r.outputUrl || '';
    const pdfs = Array.isArray(r.pdfUrls) ? r.pdfUrls : (r.pdfUrl ? [{label:'PDF', url:r.pdfUrl}] : []);
    const sheetLink = sheet ? `<a href="${sheet}" target="_blank">เปิด Excel/Sheet</a>` : '';
    const pdfLinks = pdfs.map(p => p.url ? `<a href="${p.url}" target="_blank">${esc(p.label || 'PDF')}</a>` : '').join('<br>');
    return `<tr><td><b>${esc(r.file||'')}</b></td><td>${badge(r.status||'')}</td><td>${esc(r.itemCount||'')}</td><td>${esc(r.respondents||r.respondentCount||'')}</td><td>${sheetLink}</td><td>${pdfLinks}</td><td>${esc(r.message||'')}</td></tr>`;
  }).join('');
  document.getElementById('resultTable').innerHTML = `<table><thead><tr><th>ไฟล์</th><th>Status</th><th>ข้อ</th><th>ผู้ตอบ</th><th>Excel/Sheet</th><th>PDF</th><th>หมายเหตุ</th></tr></thead><tbody>${rows || '<tr><td colspan="7">ไม่มีผลลัพธ์</td></tr>'}</tbody></table>`;
}
function badge(status){
  if(status === 'SUCCESS') return '<b class="ok-text">SUCCESS</b>';
  if(String(status).startsWith('SKIP')) return '<b class="warn-text">'+esc(status)+'</b>';
  if(status === 'ERROR' || status === 'NEEDS_REVIEW') return '<b class="warn-text">'+esc(status)+'</b>';
  return esc(status);
}
function showError(err){
  setRunStatus('ERROR: ' + (err.message || err), 'warn');
  setPill('lastRunPill','Error',false);
  printRaw({ error:String(err && err.stack ? err.stack : err) });
}
