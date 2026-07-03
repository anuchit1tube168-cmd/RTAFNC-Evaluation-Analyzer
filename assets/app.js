const STORAGE_KEY = 'RTAFNC_GAS_WEB_APP_URL';
const DEFAULT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz3Uq3oJtOu95URz2HfcgdPnoRYPdaJfFoRi1Eh9-9sRkTx-_iEODKFNN903N0BcVQq/exec';

window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKEND_URL;
  document.getElementById('gasUrl').value = saved;
  if (!localStorage.getItem(STORAGE_KEY) && DEFAULT_BACKEND_URL) localStorage.setItem(STORAGE_KEY, DEFAULT_BACKEND_URL);
  updateBackendStatus();
});

function saveBackendUrl(){
  const url = document.getElementById('gasUrl').value.trim();
  if(!url || !url.startsWith('https://script.google.com/macros/s/')){ setBackendStatus('URL ไม่ถูกต้อง ต้องเป็น Google Apps Script Web App URL', 'warn'); return; }
  localStorage.setItem(STORAGE_KEY, url);
  updateBackendStatus();
}
function resetBackendUrl(){ localStorage.setItem(STORAGE_KEY, DEFAULT_BACKEND_URL); document.getElementById('gasUrl').value = DEFAULT_BACKEND_URL; updateBackendStatus(); }
function updateBackendStatus(){ const url = localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKEND_URL; if(url) setBackendStatus('เชื่อม Backend แล้ว: ' + shortUrl(url), 'ok'); else setBackendStatus('ยังไม่ได้ตั้งค่า Backend URL', 'warn'); }
function shortUrl(url){ return url.length > 64 ? url.slice(0, 40) + '...' + url.slice(-16) : url; }
function setBackendStatus(text, cls){ const el=document.getElementById('backendStatus'); el.textContent=text; el.className='status ' + (cls || ''); }
function setRunStatus(text, cls){ const el=document.getElementById('runStatus'); el.textContent=text; el.className='status ' + (cls || ''); }
function printRaw(obj){ document.getElementById('rawOutput').textContent = JSON.stringify(obj, null, 2); }
function getBackendUrl(){ const url = localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKEND_URL; if(!url){ setRunStatus('กรุณาวางและบันทึก Google Apps Script Web App URL ก่อน', 'warn'); throw new Error('Missing backend URL'); } return url; }
function openUploadSystem(){ window.open(getBackendUrl(), '_blank', 'noopener,noreferrer'); }

function jsonp(action, params={}){
  const url = getBackendUrl();
  const cb = 'rtfnc_cb_' + Math.random().toString(36).slice(2);
  const query = new URLSearchParams({ action, callback: cb, ...params });
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('Backend timeout')); }, 120000);
    function cleanup(){ clearTimeout(timer); delete window[cb]; script.remove(); }
    window[cb] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('โหลด backend ไม่สำเร็จ ตรวจ URL/Deploy permission')); };
    script.src = url + '?' + query.toString();
    document.body.appendChild(script);
  });
}

async function listFiles(){
  try{
    setRunStatus('กำลังตรวจไฟล์ใน Google Drive / 00_วางไฟล์ที่นี่...', 'warn');
    const data = await jsonp('list');
    if (data && data.ok === false) throw new Error(data.error || 'Backend returned ok=false');
    setRunStatus(`พบไฟล์รอคิว ${data.files?.length || 0} รายการ`, 'ok');
    renderFiles(data.files || []);
    printRaw(data);
  }catch(err){ showError(err); }
}

async function processFiles(){
  if(!confirm('ยืนยันประมวลผลไฟล์ใน 00_วางไฟล์ที่นี่ ?')) return;
  try{
    setRunStatus('กำลังประมวลผล: แปลงไฟล์ → วิเคราะห์ → export Excel/PDF...', 'warn');
    const data = await jsonp('process');
    if (data && data.ok === false) throw new Error(data.error || 'Backend returned ok=false');
    setRunStatus(`เสร็จสิ้น: ${data.processed || 0} รายการ`, 'ok');
    renderResults(data.results || []);
    printRaw(data);
  }catch(err){ showError(err); }
}

function renderFiles(files){
  const rows = files.map(f => `<tr><td>${esc(f.name)}</td><td>${esc(f.mimeType)}</td><td>${f.supported ? '<b class="ok-text">รองรับ</b>' : '<b class="warn-text">ไม่รองรับ</b>'}</td><td><a href="${f.url}" target="_blank">เปิดใน Drive</a></td></tr>`).join('');
  document.getElementById('resultTable').innerHTML = `<table><thead><tr><th>ชื่อไฟล์</th><th>MIME</th><th>สถานะ</th><th>ลิงก์</th></tr></thead><tbody>${rows || '<tr><td colspan="4">ไม่พบไฟล์ใน 00_วางไฟล์ที่นี่</td></tr>'}</tbody></table>`;
}

function renderResults(results){
  const rows = results.map(r => `<tr><td>${esc(r.file || '')}</td><td>${esc(r.status || '')}</td><td>${esc(r.category || '')}</td><td>${r.mean ?? ''}</td><td>${r.sd ?? ''}</td><td>${r.outputSpreadsheetUrl ? `<a href="${r.outputSpreadsheetUrl}" target="_blank">Excel/Sheet</a>` : ''}</td><td>${r.pdfUrl ? `<a href="${r.pdfUrl}" target="_blank">PDF</a>` : ''}</td></tr>`).join('');
  document.getElementById('resultTable').innerHTML = `<table><thead><tr><th>ไฟล์</th><th>สถานะ</th><th>หมวด</th><th>X</th><th>SD</th><th>ตารางคำนวณ</th><th>PDF</th></tr></thead><tbody>${rows || '<tr><td colspan="7">ไม่มีผลลัพธ์</td></tr>'}</tbody></table>`;
}

function showError(err){ setRunStatus('ERROR: ' + (err.message || err), 'warn'); printRaw({ error: String(err && err.stack ? err.stack : err) }); }
function esc(s){return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
