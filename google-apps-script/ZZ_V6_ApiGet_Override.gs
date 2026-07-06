/**
 * RTAFNC v6 API route override
 * Adds explicit URL actions healthv6 and selftestv6.
 */

function apiGet_(p) {
  let result;
  try {
    const action = p.action || 'health';
    if (action === 'healthv6') result = getHealthV6_();
    else if (action === 'selftestv6') result = selfTestV6_();
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
    else if (action === 'selftest') result = selfTest_();
    else result = getHealth_();
  } catch (err) {
    result = { ok: false, action: (p && p.action) || '', error: String(err && err.stack ? err.stack : err) };
  }
  return jsonp_(result, p.callback);
}
