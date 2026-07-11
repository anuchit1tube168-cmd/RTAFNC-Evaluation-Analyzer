/**
 * RTAFNC v6 API route override
 * Default page: Modern Parent Evaluation dashboard for แผนกปกครอง วพอ.พอ.
 * Legacy direct upload page: ?mode=upload
 */

function doGet(e) {
  const p = (e && e.parameter) || {};
  const mode = String(p.mode || '').toLowerCase();

  // API requests must always return JSON/JSONP.
  if (p.action || p.callback) return apiGet_(p);

  // Keep the former upload tool available, but no longer use it as the home page.
  if (mode === 'upload' || mode === 'direct-upload') {
    return buildUploadPage_();
  }

  // Default route and ?mode=parent both open the modern governance dashboard.
  return buildParentEvaluationPage_();
}

function buildParentEvaluationPage_() {
  return HtmlService.createTemplateFromFile('Parent_Evaluation')
    .evaluate()
    .setTitle('ระบบแปลผลผู้ปกครอง | แผนกปกครอง วพอ.พอ.')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiGet_(p) {
  let result;
  try {
    const action = String(p.action || 'health').toLowerCase();
    if (action === 'healthv6') result = getHealthV6_();
    else if (action === 'selftestv6') result = selfTestV6_();
    else if (action === 'parenthealth') result = parentHealth({ adminKey: p.adminKey || '' });
    else if (action === 'parentsetup') result = parentSetup({ adminKey: p.adminKey || '' });
    else if (action === 'parentselftest') result = parentSelfTest();
    else if (action === 'parentdiagnostic') result = parentDiagnostic({ adminKey: p.adminKey || '' });
    else if (action === 'parentactivities') result = parentListActivities({ academicYear: p.academicYear || '' });
    else if (action === 'parentitems') result = parentGetItems({ activityId: p.activityId || '' });
    else if (action === 'parentdashboard') result = parentGetDashboard({ adminKey: p.adminKey || '', academicYear: p.academicYear || '', activityId: p.activityId || '' });
    else if (action === 'parentindividual') result = parentGetIndividualReport({ adminKey: p.adminKey || '', academicYear: p.academicYear || '', studentId: p.studentId || '', studentName: p.studentName || '' });
    else if (action === 'parentexportpdf') result = parentExportActivityPdf({ adminKey: p.adminKey || '', activityId: p.activityId || '' });
    else if (action === 'parentexportindividualpdf') result = parentExportIndividualPdf({ adminKey: p.adminKey || '', academicYear: p.academicYear || '', studentId: p.studentId || '', studentName: p.studentName || '' });
    else if (action === 'pokkronghealth') result = pokkrongHealth();
    else if (action === 'health') result = getHealth_();
    else if (action === 'list') result = { ok: true, files: listPendingFiles() };
    else if (action === 'process') result = processPendingRawFiles();
    else if (action === 'test') result = processOneFile_(DriveApp.getFileById(p.fileId), p.category || '');
    else if (action === 'peek') result = peekFile_(p.fileId);
    else if (action === 'exportreal') result = exportRealFile_(p.fileId);
    else if (action === 'goldenreport') result = getGoldenReport_(p.fileId);
    else if (action === 'goldenexport') result = goldenExport_(p.fileId);
    else if (action === 'goldenexportdemo') result = goldenExportDemo_();
    else if (action === 'goldentype2') result = goldenType2Export_(p.fileId);
    else if (action === 'goldentype2demo') result = goldenType2ExportDemo_();
    else if (action === 'goldentype3') result = goldenType3Export_(p.fileId);
    else if (action === 'goldentype3demo') result = goldenType3ExportDemo_();
    else if (action === 'goldenauto') result = goldenAutoQueue_(p.fileId);
    else if (action === 'selftest') result = selfTest_();
    else result = getHealth_();
  } catch (err) {
    result = { ok: false, action: (p && p.action) || '', error: String(err && err.stack ? err.stack : err) };
  }
  return jsonp_(result, p.callback);
}

function buildUploadPage_() {
  return HtmlService.createHtmlOutput(pokkrongDirectUploadHtml_())
    .setTitle('RTAFNC Direct Upload')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
