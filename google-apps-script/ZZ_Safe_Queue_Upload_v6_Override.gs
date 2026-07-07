/**
 * RTAFNC v6 Safe Queue Upload Override
 * Purpose: stop broken web-form uploads that create 0-byte raw_upload.xlsx files.
 * Use Google Drive folder upload + queue processing instead.
 */

function uploadOnly(form) {
  throw new Error('ปิดการอัปโหลดผ่านฟอร์มชั่วคราว เพราะพบปัญหาไฟล์ 0 byte กรุณากด เปิดโฟลเดอร์ Drive แล้ววางไฟล์ .xlsx จริงใน 00_วางไฟล์ที่นี่ จากนั้นกด ประมวลผลคิว');
}

function uploadAndProcess(form) {
  throw new Error('ปิดการอัปโหลดผ่านฟอร์มชั่วคราว เพราะพบปัญหาไฟล์ 0 byte กรุณากด เปิดโฟลเดอร์ Drive แล้ววางไฟล์ .xlsx จริงใน 00_วางไฟล์ที่นี่ จากนั้นกด ประมวลผลคิว');
}

function listPendingFiles() {
  const folder = DriveApp.getFolderById(CONFIG.PENDING_FOLDER_ID);
  const it = folder.getFiles();
  const rows = [];
  while (it.hasNext()) {
    const f = it.next();
    const size = f.getSize();
    const supported = isSupported_(f.getName());
    rows.push({
      id: f.getId(),
      name: f.getName(),
      mimeType: f.getMimeType(),
      size: size,
      url: f.getUrl(),
      supported: supported,
      validForProcess: supported && size > 0,
      warning: supported && size <= 0 ? 'ZERO_BYTE_SKIP' : ''
    });
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
    if (!isSupported_(f.getName())) {
      results.push({ file: f.getName(), status: 'SKIP', message: 'not supported' });
      continue;
    }
    if (!f.getSize() || f.getSize() <= 0) {
      const msg = 'SKIP_ZERO_BYTE: ไฟล์มีขนาด 0 byte จึงไม่ประมวลผล';
      results.push({ file: f.getName(), status: 'SKIP_ZERO_BYTE', message: msg });
      appendLog_(f.getName(), 'SKIP_ZERO_BYTE', 'ไฟล์เสีย', msg, '', '');
      try { moveFile_(f, CONFIG.PENDING_FOLDER_ID, CONFIG.UNKNOWN_FOLDER_ID); } catch (e) {}
      continue;
    }
    count++;
    try {
      results.push(processOneFile_(f, ''));
    } catch (err) {
      results.push({ file: f.getName(), status: 'ERROR', message: String(err) });
      appendLog_(f.getName(), 'ERROR', '99_ไม่ทราบประเภท', String(err), '', '');
    }
  }
  return { ok: true, processed: results.length, results: results, finishedAt: new Date().toISOString() };
}

function buildUploadPage_() {
  const driveUrl = 'https://drive.google.com/drive/folders/' + CONFIG.PENDING_FOLDER_ID;
  return '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RTAFNC Queue Upload</title></head><body style="font-family:TH Sarabun PSK,Sarabun,Tahoma,sans-serif;background:#f4f7fb;padding:24px;font-size:20px"><div style="max-width:980px;margin:auto;background:white;border-radius:22px;padding:24px"><h1>RTAFNC Evaluation Analyzer v6</h1><p><b>สถานะ:</b> ปิดการอัปโหลดผ่านฟอร์มชั่วคราว เพราะพบปัญหาไฟล์ 0 byte</p><p>วิธีใช้งานจริง: 1) กดเปิดโฟลเดอร์ Drive 2) วางไฟล์ .xlsx/.xls/.csv/.tsv ที่เป็นไฟล์จริง 3) กลับมากดตรวจคิว 4) กดประมวลผลคิว</p><p><a target="_blank" href="' + driveUrl + '" style="background:#0b7a3b;color:#fff;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:700">เปิดโฟลเดอร์ Drive 00_วางไฟล์ที่นี่</a> <button type="button" onclick="status()" style="padding:12px 16px;border-radius:12px;font-weight:700">ตรวจคิว</button> <button type="button" onclick="processQ()" style="background:#991b1b;color:#fff;padding:12px 16px;border-radius:12px;font-weight:700">ประมวลผลคิว</button></p><div id="links"></div><pre id="out" style="background:#111827;color:#d1fae5;padding:16px;border-radius:14px;white-space:pre-wrap">พร้อมใช้งาน</pre></div><script>function p(x){document.getElementById("out").textContent=JSON.stringify(x,null,2);links(x)}function e(x){p({ok:false,error:String(x&&x.message?x.message:x)})}function links(r){var box=document.getElementById("links");box.innerHTML="";if(!r)return;var arr=r.results||[];arr.forEach(function(a){var s=a.outputSpreadsheetUrl||a.sheetUrl||a.outputUrl;if(s)box.innerHTML+="<p>Excel/Sheet: <a target=_blank href="+s+">เปิดผลลัพธ์</a></p>";var pdfs=Array.isArray(a.pdfUrls)?a.pdfUrls:[];pdfs.forEach(function(d){if(d.url)box.innerHTML+="<p>PDF "+(d.label||"")+": <a target=_blank href="+d.url+">เปิด PDF</a></p>"})})}function status(){google.script.run.withSuccessHandler(p).withFailureHandler(e).getSystemStatus()}function processQ(){if(!confirm("ยืนยันประมวลผลไฟล์ในคิว Drive?"))return;google.script.run.withSuccessHandler(p).withFailureHandler(e).processPendingRawFiles()}status();<\/script></body></html>';
}
