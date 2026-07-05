const STORAGE_KEY = 'RTAFNC_GAS_WEB_APP_URL';
const DEFAULT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz3Uq3oJtOu95URz2HfcgdPnoRYPdaJfFoRi1Eh9-9sRkTx-_iEODKFNN903N0BcVQq/exec';

window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKEND_URL;
  const input = document.getElementById('gasUrl');
  if (input) input.value = saved;
  if (!localStorage.getItem(STORAGE_KEY) && DEFAULT_BACKEND_URL) localStorage.setItem(STORAGE_KEY, DEFAULT_BACKEND_URL);
  updateBackendStatus();
  healthCheck();
});

function saveBackendUrl(){
  const url = document.getElementById('gasUrl').value.trim();
  if(!url || !url.startsWith('https://script.google.com/macros/s/')){
    setBackendStatus('URL ไม่ถูกต้อง ต้องเป็น Google Apps Script Web App URL', 'warn');
    setPill('connectionPill', 'Invalid URL', 'warn');
    return;
  }
  localStorage.setItem(STORAGE_KEY, url);
  updateBackendStatus();
  healthCheck();
}

function resetBackendUrl(){
  localStorage.setItem(STORAGE_KEY, DEFAULT_BACKEND_URL);
  document.getElementById('gasUrl').value = DEFAULT_BACKEND_URL;
  updateBackendStatus();
  healthCheck();
}

function updateBackendStatus(){
  const url = localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKEND_URL;
  if(url){
    setBackendStatus('เชื่อม Backend แล้ว: ' + shortUrl(url), 'ok');
    setPill('connectionPill', 'Connected', 'green');
  } else {
    setBackendStatus('ยังไม่ได้ตั้งค่า Backend URL', 'warn');
    setPill('connectionPill', 'Not set', 'warn');
  }
}

function shortUrl(url){ return url.length > 70 ? url.slice(0, 44) + '...' + url.slice(-18) : url; }
function setBackendStatus(text, cls){ const el=document.getElementById('backendStatus'); if(el){ el.textContent=text; el.className='status ' + (cls || ''); } }
function setRunStatus(text, cls){ const el=document.getElementById('runStatus'); if(el){ el.textContent=text; el.className='status ' + (cls || ''); } }
function setPill(id, text, cls){ const el=document.getElementById(id); if(el){ el.textContent=text; el.className='pill ' + (cls === 'green' ? 'green' : ''); } }
function printRaw(obj){ const el=document.getElementById('rawOutput'); if(el) el.textContent = JSON.stringify(obj, null, 2); }
function getBackendUrl(){
  const url = localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKEND_URL;
  if(!url){ setRunStatus('กรุณาวางและบันทึก Google Apps Script Web App URL ก่อน', 'warn'); throw new Error('Missing backend URL'); }
  return url;
}
function openUploadSystem(){ window.open(getBackendUrl(), '_blank', 'noopener,noreferrer'); }

function jsonp(action, params={}){
  const url = getBackendUrl();
  const cb = 'rtafnc_cb_' + Math.random().toString(36).slice(2);
  const query = new URLSearchParams({ action, callback: cb, ...params });
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('Backend timeout')); }, 120000);
    function cleanup(){ clearTimeout(timer); delete window[cb]; script.remove(); }
    window[cb] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('โหลด backend ไม่สำเร็จ ตรวจ URL หรือสิทธิ์ Deploy')); };
    script.src = url + '?' + query.toString();
    document.body.appendChild(script);
  });
}

async function healthCheck(){
  try{
    setPill('connectionPill', 'Checking', '');
    const data = await jsonp('health');
    if (data && data.ok === false) throw new Error(data.error || 'Backend returned ok=false');
    setBackendStatus(`Backend พร้อมใช้งาน • ${data.version || data.name || 'Apps Script'}`, 'ok');
    setPill('connectionPill', 'Online', 'green');
    printRaw(data);
  }catch(err){
    setBackendStatus('Backend ยังไม่ตอบสนอง: ' + (err.message || err), 'warn');
    setPill('connectionPill', 'Check needed', '');
  }
}

async function selfTest(){
  try{
    setRunStatus('กำลังทดสอบระบบ (parser + QA gate) ด้วยข้อมูลจำลอง...', 'warn');
    setPill('lastRunPill', 'Self-test', '');
    const data = await jsonp('selftest');
    if (data && data.ok === false) throw new Error(data.error || 'Backend returned ok=false');
    const passed = data.passed ?? 0, total = data.total ?? 0;
    setRunStatus(`ทดสอบระบบ: ผ่าน ${passed}/${total} • ${data.allPass ? 'พร้อมใช้งาน' : 'มีข้อไม่ผ่าน โปรดตรวจ'}`, data.allPass ? 'ok' : 'warn');
    setPill('lastRunPill', data.allPass ? 'Self-test OK' : 'Self-test fail', data.allPass ? 'green' : '');
    renderSelfTest(data.checks || []);
    printRaw(data);
  }catch(err){ showError(err); }
}

function renderSelfTest(checks){
  const rows = checks.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${c.pass ? '<b class="ok-text">ผ่าน</b>' : '<b class="warn-text">ไม่ผ่าน</b>'}</td><td>${esc(c.detail || '')}</td></tr>`).join('');
  document.getElementById('resultTable').innerHTML = `<table><thead><tr><th>รายการทดสอบ</th><th>ผล</th><th>รายละเอียด</th></tr></thead><tbody>${rows || '<tr><td colspan="3">ไม่มีผลทดสอบ</td></tr>'}</tbody></table>`;
}

async function listFiles(){
  try{
    setRunStatus('กำลังตรวจไฟล์ใน Google Drive / 00_วางไฟล์ที่นี่...', 'warn');
    setPill('lastRunPill', 'Listing', '');
    const data = await jsonp('list');
    if (data && data.ok === false) throw new Error(data.error || 'Backend returned ok=false');
    const files = data.files || [];
    setRunStatus(`พบไฟล์รอคิว ${files.length} รายการ`, 'ok');
    setPill('lastRunPill', `${files.length} pending`, files.length ? '' : 'green');
    renderFiles(files);
    printRaw(data);
  }catch(err){ showError(err); }
}

async function processFiles(){
  if(!confirm('ยืนยันประมวลผลไฟล์ใน 00_วางไฟล์ที่นี่ ?')) return;
  try{
    setRunStatus('กำลังประมวลผล: แปลงไฟล์ → วิเคราะห์ → export Excel/PDF...', 'warn');
    setPill('lastRunPill', 'Processing', '');
    const data = await jsonp('process');
    if (data && data.ok === false) throw new Error(data.error || 'Backend returned ok=false');
    const results = data.results || [];
    const success = results.filter(r => r.status === 'SUCCESS').length;
    const review = results.filter(r => r.status === 'NEEDS_REVIEW').length;
    const error = results.filter(r => r.status === 'ERROR').length;
    setRunStatus(`เสร็จสิ้น: ${data.processed || results.length || 0} รายการ | สำเร็จ ${success} | รอตรวจ ${review} | Error ${error}`, error ? 'warn' : 'ok');
    setPill('lastRunPill', error ? 'Review needed' : 'Completed', error ? '' : 'green');
    renderResults(results);
    printRaw(data);
  }catch(err){ showError(err); }
}

function renderFiles(files){
  const rows = files.map(f => `<tr><td><b>${esc(f.name)}</b></td><td>${formatBytes(f.size)}</td><td>${esc(f.mimeType)}</td><td>${f.supported ? '<b class="ok-text">รองรับ</b>' : '<b class="warn-text">ไม่รองรับ</b>'}</td><td><a href="${f.url}" target="_blank">เปิดใน Drive</a></td></tr>`).join('');
  document.getElementById('resultTable').innerHTML = `<table><thead><tr><th>ชื่อไฟล์</th><th>ขนาด</th><th>MIME</th><th>สถานะ</th><th>ลิงก์</th></tr></thead><tbody>${rows || '<tr><td colspan="5">ไม่พบไฟล์ใน 00_วางไฟล์ที่นี่</td></tr>'}</tbody></table>`;
}

function renderResults(results){
  const rows = results.map(r => `<tr><td><b>${esc(r.file || '')}</b></td><td>${badge(r.status || '')}</td><td>${qaBadge(r.qaStatus)}</td><td>${esc(r.category || '')}</td><td>${r.respondentCount ?? ''}</td><td>${r.mean ?? ''}</td><td>${r.sd ?? ''}</td><td>${r.outputSpreadsheetUrl ? `<a href="${r.outputSpreadsheetUrl}" target="_blank">Excel/Sheet</a>` : ''}</td><td>${pdfLinks(r)}</td><td>${resultNote(r)}</td></tr>`).join('');
  document.getElementById('resultTable').innerHTML = `<table><thead><tr><th>ไฟล์</th><th>สถานะ</th><th>QA</th><th>หมวด</th><th>ผู้ตอบ</th><th>X</th><th>SD</th><th>ตาราง</th><th>PDF (รวม+รายชั้นปี)</th><th>หมายเหตุ</th></tr></thead><tbody>${rows || '<tr><td colspan="10">ไม่มีผลลัพธ์</td></tr>'}</tbody></table>`;
}

function qaBadge(qa){
  if(!qa) return '';
  if(qa === 'PASS') return '<b class="ok-text">PASS</b>';
  return '<b class="warn-text">REVIEW</b>';
}

function pdfLinks(r){
  const list = Array.isArray(r.pdfUrls) && r.pdfUrls.length ? r.pdfUrls : (r.pdfUrl ? [{ name: 'PDF', url: r.pdfUrl, hasData: true }] : []);
  if(!list.length) return '';
  return list.map(p => {
    const label = esc(p.name || 'PDF');
    const flag = (p.hasData === false) ? ' <span class="warn-text">(ว่าง)</span>' : '';
    return `<a href="${p.url}" target="_blank">${label}</a>${flag}`;
  }).join('<br>');
}

function resultNote(r){
  const parts = [];
  if(r.message) parts.push(esc(r.message));
  if(Array.isArray(r.qaFailures) && r.qaFailures.length) parts.push('<span class="warn-text">ต้องแก้: ' + esc(r.qaFailures.join('; ')) + '</span>');
  if(Array.isArray(r.qaWarnings) && r.qaWarnings.length) parts.push('ข้อควรตรวจ: ' + esc(r.qaWarnings.join('; ')));
  if(r.duplicateCount) parts.push('ผู้ตอบซ้ำ: ' + r.duplicateCount);
  return parts.join('<br>');
}

function badge(status){
  const s = esc(status);
  if(status === 'SUCCESS') return `<b class="ok-text">${s}</b>`;
  if(status === 'ERROR' || status === 'NEEDS_REVIEW') return `<b class="warn-text">${s}</b>`;
  return s;
}
function formatBytes(bytes){
  if(!bytes && bytes !== 0) return '';
  const n = Number(bytes);
  if(n < 1024) return n + ' B';
  if(n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  return (n/1024/1024).toFixed(1) + ' MB';
}
function showError(err){
  setRunStatus('ERROR: ' + (err.message || err), 'warn');
  setPill('lastRunPill', 'Error', '');
  printRaw({ error: String(err && err.stack ? err.stack : err) });
}
function esc(s){return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
