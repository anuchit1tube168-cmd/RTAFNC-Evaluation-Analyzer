/**
 * Prevent anonymous visitors from creating the Parent Evaluation database.
 * An existing database remains readable by the public form; a new database
 * can be created only after the script owner has configured admin access.
 */

function PE_getDb_() {
  const properties = PropertiesService.getScriptProperties();
  let id = properties.getProperty(PE_CONFIG.DB_PROPERTY);

  if (id) {
    try {
      const existing = SpreadsheetApp.openById(id);
      PE_ensureDb_(existing);
      return existing;
    } catch (err) {
      properties.deleteProperty(PE_CONFIG.DB_PROPERTY);
      id = '';
    }
  }

  if (!PE_adminKey_()) {
    throw Error('ระบบยังไม่เปิดใช้งาน: เจ้าของ Apps Script ต้องตั้งค่าผู้ดูแลก่อนสร้างฐานข้อมูล');
  }

  const created = SpreadsheetApp.create(PE_CONFIG.DB_NAME);
  properties.setProperty(PE_CONFIG.DB_PROPERTY, created.getId());
  PE_ensureDb_(created);
  return created;
}
