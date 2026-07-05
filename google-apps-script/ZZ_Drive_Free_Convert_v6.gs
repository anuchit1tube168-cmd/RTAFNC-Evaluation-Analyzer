/**
 * RTAFNC v6 Drive-free conversion override
 * Avoids ReferenceError: Drive is not defined when Advanced Drive service is not available in runtime.
 * This file is appended to Code.gs by the deploy workflow.
 */

function getHealth_() {
  return {
    ok: true,
    version: 'v6-source-driven-reports',
    parser: 'wide-matrix-v1',
    rule: 'per-class reports only when class-year source exists',
    convertMode: 'urlfetch-drive-api-v3',
    driveAdvancedAvailable: false,
    uploadUi: ScriptApp.getService().getUrl(),
    time: new Date().toISOString()
  };
}

function convertToGoogleSheet_(file) {
  const blob = file.getBlob();
  const name = '_TEMP_' + file.getName().replace(/\.(xlsx|xls|csv|tsv)$/i, '') + '_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
  return convertToGoogleSheetViaUrlFetch_(blob, name);
}
