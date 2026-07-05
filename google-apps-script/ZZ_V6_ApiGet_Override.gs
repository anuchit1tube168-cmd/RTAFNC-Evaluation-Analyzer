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
    else if (action === 'selftest') result = selfTest_();
    else result = getHealth_();
  } catch (err) {
    result = { ok: false, action: (p && p.action) || '', error: String(err && err.stack ? err.stack : err) };
  }
  return jsonp_(result, p.callback);
}
