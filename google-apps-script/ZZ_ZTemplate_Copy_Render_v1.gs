/**
 * Template Copy Renderer v1
 * Rule: do not design a new report. Convert/copy the Excel example template, keep layout, then write calculated values into that copy.
 */

function apiGet_(p) {
  let result;
  try {
    const action = p.action || 'health';
    if (action === 'templatecopyv1') result = templateCopyRunV1_(p);
    else if (action === 'healthv6') result = getHealth_();
    else if (action === 'selftestv6') result = selfTest_();
    else if (action === 'list') result = { ok: true, files: listPendingFiles() };
    else if (action === 'process') result = processPendingRawFiles();
    else if (action === 'test') result = processOneFile_(DriveApp.getFileById(p.fileId), p.category || '');
    else if (action === 'peek') result = peekFile_(p.fileId);
    else if (action === 'selftest') result = selfTest_();
    else result = getHealth_();
  } catch (err) {
    result = { ok: false, error: String(err && err.stack ? err.stack : err) };
  }
  return jsonp_(result, p.callback);
}

function templateCopyRunV1_(p) {
  const rawId = p.rawFileId || '19cj4O4TOTo7gFy51iar2jlcCCB8Yibn6';
  const templateId = p.templateFileId || '19M5ktquM7t0mH_iN3QN-TdaRqzlncKzU';
  const rawFile = DriveApp.getFileById(rawId);
  const templateFile = DriveApp.getFileById(templateId);

  const rawTempId = convertToGoogleSheet_(rawFile);
  const analysis = analyzeSheet_(rawTempId, rawFile.getName(), p.category || 'ผู้สอนรายบุคคล');

  const outId = convertToGoogleSheet_(templateFile);
  const outFile = DriveApp.getFileById(outId);
  const outName = safeName_('TEMPLATE_COPY_' + rawFile.getName().replace(/\.xlsx$/i,'') + '_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss'));
  outFile.setName(outName);
  try {
    DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID).addFile(outFile);
    DriveApp.getRootFolder().removeFile(outFile);
  } catch(e) {}

  const ss = SpreadsheetApp.openById(outId);
  const target = chooseTemplateTargetSheetV1_(ss);
  renderAnalysisIntoTemplateV1_(target, analysis, rawFile.getName(), templateFile.getName());
  SpreadsheetApp.flush();

  const pdf = exportPdf_(outId, outName + '.pdf', target.getSheetId());
  try { if (!CONFIG.KEEP_TEMP_SHEETS) DriveApp.getFileById(rawTempId).setTrashed(true); } catch(e) {}
  appendLog_(rawFile.getName(), 'SUCCESS', 'templatecopyv1', 'copied template then wrote values; template=' + templateFile.getName(), ss.getUrl(), pdf.url);

  return {
    ok: true,
    status: 'SUCCESS',
    action: 'templatecopyv1',
    rule: 'Copied Excel template first; kept layout; wrote data into the copy',
    rawFile: rawFile.getName(),
    templateFile: templateFile.getName(),
    itemCount: analysis.items.length,
    respondents: analysis.respondents.length,
    mean: round2_(analysis.overallMean),
    sd: round2_(analysis.overallSd),
    outputSpreadsheetUrl: ss.getUrl(),
    pdfUrl: pdf.url,
    qaStatus: 'REVIEW_VISUAL_MATCH_REQUIRED'
  };
}

function chooseTemplateTargetSheetV1_(ss) {
  const sheets = ss.getSheets();
  let best = sheets[0], bestScore = -1;
  sheets.forEach(sh => {
    const txt = sh.getDataRange().getDisplayValues().flat().join(' ');
    const score = (txt.match(/X|SD|เกณฑ์|ประเมิน|รายการ|ผู้สอน/g) || []).length;
    if (score > bestScore) { best = sh; bestScore = score; }
  });
  return best;
}

function renderAnalysisIntoTemplateV1_(sh, a, rawName, templateName) {
  const values = sh.getDataRange().getDisplayValues();
  writeFirstFoundV1_(sh, values, ['ปีการศึกษา'], CONFIG.ACADEMIC_YEAR);
  writeFirstFoundV1_(sh, values, ['จำนวนผู้ตอบ'], a.respondents.length);
  writeFirstFoundV1_(sh, values, ['ค่าเฉลี่ยรวม', 'X รวม'], round2_(a.overallMean));
  writeFirstFoundV1_(sh, values, ['SD รวม'], round2_(a.overallSd));

  const note = 'ข้อมูลดิบ: ' + rawName + ' | Template Excel: ' + templateName + ' | QA: copy template first; visual check required';
  try { sh.getRange(1, 1).setNote(note); } catch(e) {}

  const stats = a.itemStats || [];
  let written = writeStatsToExistingTableV1_(sh, values, stats);
  if (!written) writeStatsToEmptyAreaV1_(sh, stats);
}

function writeFirstFoundV1_(sh, values, labels, val) {
  for (let r = 0; r < values.length; r++) for (let c = 0; c < values[r].length; c++) {
    const cell = String(values[r][c] || '');
    if (labels.some(x => cell.indexOf(x) >= 0)) {
      const col = Math.min(c + 2, sh.getMaxColumns());
      sh.getRange(r + 1, col).setValue(val);
      return true;
    }
  }
  return false;
}

function writeStatsToExistingTableV1_(sh, values, stats) {
  if (!stats.length) return false;
  let headerRow = -1, xCol = -1, sdCol = -1;
  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < values[r].length; c++) {
      const v = String(values[r][c] || '').trim();
      if (v === 'X' || v === 'x̄' || v === 'ค่าเฉลี่ย') { headerRow = r; xCol = c; }
      if (v === 'SD' || v === 'S.D.' || v === 'ส่วนเบี่ยงเบนมาตรฐาน') { sdCol = c; }
    }
    if (headerRow >= 0 && xCol >= 0 && sdCol >= 0) break;
  }
  if (headerRow < 0 || xCol < 0 || sdCol < 0) return false;
  stats.forEach((it, i) => {
    const row = headerRow + 2 + i;
    if (row <= sh.getMaxRows()) {
      sh.getRange(row, xCol + 1).setValue(round2_(it.mean));
      sh.getRange(row, sdCol + 1).setValue(round2_(it.sd));
    }
  });
  return true;
}

function writeStatsToEmptyAreaV1_(sh, stats) {
  const start = sh.getLastRow() + 2;
  sh.getRange(start, 1, 1, 6).setValues([['ข้อ','รายการประเมิน','N','X','SD','ระดับ']]);
  const rows = stats.map((it, i) => [it.code || it.no || (i+1), it.text, it.n, round2_(it.mean), round2_(it.sd), it.level]);
  if (rows.length) sh.getRange(start + 1, 1, rows.length, 6).setValues(rows);
}
