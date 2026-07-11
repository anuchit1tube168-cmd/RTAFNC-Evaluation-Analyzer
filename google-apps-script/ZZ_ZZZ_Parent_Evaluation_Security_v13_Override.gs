/**
 * Parent Evaluation v1.3 security override.
 * The owner must configure RTAFNC_PARENT_ADMIN_KEY in Apps Script
 * Project Settings > Script Properties before using the admin page.
 */

function parentSetup(input) {
  const key = PE_clean_(input && input.adminKey || '');
  PE_requireAdmin_(key);
  const ss = PE_getDb_();
  PE_ensureDb_(ss);
  PE_logQa_('setup', 'PASS', 'Parent evaluation database verified', {
    spreadsheetId: ss.getId(),
    version: PE_CONFIG.VERSION,
    bootstrapMode: 'script-properties-owner-only'
  });
  return {
    ok: true,
    status: 'PASS',
    version: PE_CONFIG.VERSION,
    secure: true,
    databaseId: ss.getId(),
    databaseUrl: ss.getUrl(),
    webUrl: ScriptApp.getService().getUrl(),
    message: 'ตรวจฐานข้อมูลและสิทธิ์ผู้ดูแลสำเร็จ'
  };
}

function parentAdminBootstrapStatus_() {
  return {
    configured: !!PE_adminKey_(),
    propertyName: PE_CONFIG.ADMIN_PROPERTY,
    instruction: 'ตั้งค่าใน Project Settings > Script Properties โดยเจ้าของ Apps Script เท่านั้น'
  };
}
