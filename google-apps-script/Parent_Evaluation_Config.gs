const PE_CONFIG = {
  VERSION: 'parent-evaluation-v1.3.0',
  TZ: 'Asia/Bangkok',
  DB_PROPERTY: 'RTAFNC_PARENT_EVAL_DB_ID',
  ADMIN_PROPERTY: 'RTAFNC_PARENT_ADMIN_KEY',
  DB_NAME: 'RTAFNC_Parent_Evaluation_DB',
  PDF_FOLDER_NAME: 'RTAFNC_Parent_Evaluation_PDF',
  MAX_ITEMS: 200,
  MAX_COMMENT_LENGTH: 2000,
  SHEETS: {
    ACTIVITIES: 'PE_Activities',
    ITEMS: 'PE_Item_Dictionary',
    RESPONSES: 'PE_Responses',
    IMPORTS: 'PE_Imports',
    QA: 'PE_QA_Log'
  }
};

const PE_HEADERS = {
  PE_Activities: [
    'activityId', 'academicYear', 'activityName', 'activityDate',
    'ownerUnit', 'status', 'createdAt'
  ],
  PE_Item_Dictionary: [
    'activityId', 'itemNo', 'itemText', 'itemType', 'maxScore',
    'sourceSheet', 'sourceColumn', 'qaStatus', 'createdAt'
  ],
  PE_Responses: [
    'responseId', 'timestamp', 'activityId', 'academicYear',
    'studentId', 'studentName', 'parentName', 'relationship',
    'scoresJson', 'answeredCount', 'itemCount', 'average', 'sd',
    'level', 'comments', 'qaStatus'
  ],
  PE_Imports: [
    'importId', 'timestamp', 'fingerprint', 'sourceSpreadsheetId',
    'sourceSheetName', 'academicYear', 'activityId', 'activityName',
    'rowCount', 'itemCount', 'status'
  ],
  PE_QA_Log: ['timestamp', 'scope', 'status', 'message', 'detailsJson']
};

function parentHealth(input) {
  const key = PE_clean_(input && input.adminKey || '');
  const configured = !!PE_adminKey_();
  const admin = PE_isAdmin_(key);
  const base = {
    ok: true,
    status: 'PASS',
    version: PE_CONFIG.VERSION,
    secure: true,
    adminConfigured: configured,
    webUrl: ScriptApp.getService().getUrl(),
    rule: 'ผู้ปกครองบันทึกได้ แต่เมนูจัดการและรายงานต้องใช้ Admin Key',
    time: new Date().toISOString()
  };
  if (!admin) return base;

  const ss = PE_getDb_();
  base.databaseId = ss.getId();
  base.databaseUrl = ss.getUrl();
  base.sheets = ss.getSheets().map(function (sheet) { return sheet.getName(); });
  return base;
}

function parentSetup(input) {
  const key = PE_clean_(input && input.adminKey || '');
  PE_setupAdmin_(key);
  const ss = PE_getDb_();
  PE_ensureDb_(ss);
  PE_logQa_('setup', 'PASS', 'Parent evaluation database ready', {
    spreadsheetId: ss.getId(),
    version: PE_CONFIG.VERSION
  });
  return {
    ok: true,
    status: 'PASS',
    version: PE_CONFIG.VERSION,
    secure: true,
    databaseId: ss.getId(),
    databaseUrl: ss.getUrl(),
    webUrl: ScriptApp.getService().getUrl(),
    message: 'ตั้งค่าระบบและ Admin Key สำเร็จ'
  };
}

function parentSelfTest() {
  const checks = [];
  const add = function (name, pass, detail) {
    checks.push({ name: name, pass: !!pass, detail: detail || '' });
  };

  add('ยอมรับคำถามจริง', !PE_isBadItemText_('ความเหมาะสมของกิจกรรม'));
  add('ปฏิเสธ Q1', PE_isBadItemText_('Q1'));
  add('ปฏิเสธ Column', PE_isBadItemText_('Column 4'));
  add('ปฏิเสธคอลัมน์ค่าเฉลี่ย', typeof PE_isSummaryHeader_ === 'function' && PE_isSummaryHeader_('ค่าเฉลี่ย'));
  add('แปลผล 4.60', PE_level_(4.6) === 'มากที่สุด');
  add('ค่าเฉลี่ย 5,4,4', PE_round2_(PE_mean_([5, 4, 4])) === 4.33);
  add('Normalize ชื่อ', PE_normalize_(' นพอ.  กนกวรรณ ') === 'นพอ. กนกวรรณ');

  const passed = checks.filter(function (item) { return item.pass; }).length;
  return {
    ok: true,
    status: passed === checks.length ? 'PASS' : 'REVIEW',
    version: PE_CONFIG.VERSION,
    passed: passed,
    total: checks.length,
    allPass: passed === checks.length,
    checks: checks
  };
}

function parentDiagnostic(input) {
  PE_requireAdmin_(input && input.adminKey);
  const checks = [];
  const add = function (name, pass, detail) {
    checks.push({ name: name, pass: !!pass, detail: detail || '' });
  };
  let ss = null;

  try {
    ss = PE_getDb_();
    add('เปิดฐานข้อมูลได้', !!ss, ss ? ss.getId() : '');

    const expectedSheets = Object.keys(PE_HEADERS);
    const actualSheets = ss.getSheets().map(function (sheet) { return sheet.getName(); });
    expectedSheets.forEach(function (name) {
      add('มีชีต ' + name, actualSheets.indexOf(name) >= 0, actualSheets.join(', '));
    });

    Object.keys(PE_HEADERS).forEach(function (name) {
      const sheet = ss.getSheetByName(name);
      const expectedHeaders = PE_HEADERS[name];
      const actualHeaders = sheet
        ? sheet.getRange(1, 1, 1, expectedHeaders.length).getDisplayValues()[0]
        : [];
      add(
        'หัวตาราง ' + name,
        expectedHeaders.every(function (header, index) { return actualHeaders[index] === header; }),
        actualHeaders.join(' | ')
      );
    });

    const self = parentSelfTest();
    add('Self Test ผ่าน', self.allPass === true, self.passed + '/' + self.total);
    add('ฟังก์ชันกิจกรรมพร้อม', typeof parentCreateActivity === 'function');
    add('ฟังก์ชันบันทึกผลพร้อม', typeof parentSaveResponse === 'function');
    add('ฟังก์ชัน Dashboard พร้อม', typeof parentGetDashboard === 'function');
    add('ฟังก์ชัน PDF กิจกรรมพร้อม', typeof parentExportActivityPdf === 'function');
    add('ฟังก์ชัน PDF รายบุคคลพร้อม', typeof parentExportIndividualPdf === 'function');
    add('ฟังก์ชัน Import พร้อม', typeof parentImportWideSheet === 'function');
    add('Template หลักพร้อม', !!HtmlService.createTemplateFromFile('Parent_Evaluation'));
    add('Template CSS พร้อม', PE_include_('Parent_Evaluation_Styles').indexOf('<style>') >= 0);
    add('Template JavaScript พร้อม', PE_include_('Parent_Evaluation_App').indexOf('<script>') >= 0);
  } catch (err) {
    add('Diagnostic ทำงานโดยไม่ error', false, String(err && err.stack ? err.stack : err));
  }

  const passed = checks.filter(function (item) { return item.pass; }).length;
  return {
    ok: true,
    status: passed === checks.length ? 'PASS' : 'REVIEW',
    version: PE_CONFIG.VERSION,
    passed: passed,
    total: checks.length,
    allPass: passed === checks.length,
    databaseUrl: ss ? ss.getUrl() : '',
    webUrl: ScriptApp.getService().getUrl(),
    checks: checks
  };
}

function PE_adminKey_() {
  return PropertiesService.getScriptProperties().getProperty(PE_CONFIG.ADMIN_PROPERTY) || '';
}

function PE_isAdmin_(key) {
  const stored = PE_adminKey_();
  return !!stored && PE_clean_(key) === stored;
}

function PE_setupAdmin_(key) {
  const value = PE_clean_(key);
  if (value.length < 8) throw Error('Admin Key ต้องมีอย่างน้อย 8 ตัวอักษร');
  const stored = PE_adminKey_();
  if (stored && stored !== value) throw Error('Admin Key ไม่ถูกต้อง');
  if (!stored) {
    PropertiesService.getScriptProperties().setProperty(PE_CONFIG.ADMIN_PROPERTY, value);
  }
  return true;
}

function PE_requireAdmin_(key) {
  if (!PE_adminKey_()) throw Error('ยังไม่ได้ตั้ง Admin Key กรุณาเปิดหน้าเว็บและกด Setup ก่อน');
  if (!PE_isAdmin_(key)) throw Error('Admin Key ไม่ถูกต้อง');
  return true;
}

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
    }
  }

  const created = SpreadsheetApp.create(PE_CONFIG.DB_NAME);
  properties.setProperty(PE_CONFIG.DB_PROPERTY, created.getId());
  PE_ensureDb_(created);
  return created;
}

function PE_ensureDb_(ss) {
  PE_sheet_(ss, PE_CONFIG.SHEETS.ACTIVITIES, PE_HEADERS.PE_Activities);
  PE_sheet_(ss, PE_CONFIG.SHEETS.ITEMS, PE_HEADERS.PE_Item_Dictionary);
  PE_sheet_(ss, PE_CONFIG.SHEETS.RESPONSES, PE_HEADERS.PE_Responses);
  PE_sheet_(ss, PE_CONFIG.SHEETS.IMPORTS, PE_HEADERS.PE_Imports);
  PE_sheet_(ss, PE_CONFIG.SHEETS.QA, PE_HEADERS.PE_QA_Log);
}

function PE_sheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  const current = sheet
    .getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn()))
    .getDisplayValues()[0];
  if (headers.some(function (header, index) { return current[index] !== header; })) {
    throw Error('โครงสร้างชีต ' + name + ' ไม่ตรงกับระบบ จึงหยุดเพื่อป้องกันข้อมูลสูญหาย');
  }
  return sheet;
}

function PE_read_(sheetName) {
  const sheet = PE_getDb_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0];
  return values.slice(1)
    .filter(function (row) { return row.some(function (cell) { return String(cell).trim() !== ''; }); })
    .map(function (row) {
      const object = {};
      headers.forEach(function (header, index) { object[header] = row[index]; });
      return object;
    });
}

function PE_activity_(activityId) {
  return PE_read_(PE_CONFIG.SHEETS.ACTIVITIES).find(function (row) {
    return String(row.activityId) === String(activityId);
  });
}

function PE_items_(activityId) {
  return PE_read_(PE_CONFIG.SHEETS.ITEMS)
    .filter(function (row) { return String(row.activityId) === String(activityId); })
    .sort(function (a, b) { return Number(a.itemNo) - Number(b.itemNo); });
}

function PE_logQa_(scope, status, message, details) {
  try {
    PE_getDb_().getSheetByName(PE_CONFIG.SHEETS.QA).appendRow([
      PE_now_(), scope, status, message, JSON.stringify(details || {})
    ]);
  } catch (err) {
    console.log(err);
  }
}

function PE_withLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function PE_now_() {
  return Utilities.formatDate(new Date(), PE_CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss');
}

function PE_clean_(value) {
  return String(value == null ? '' : value).trim();
}

function PE_normalize_(value) {
  return PE_clean_(value).replace(/\s+/g, ' ');
}

function PE_round2_(value) {
  return Math.round(Number(value) * 100) / 100;
}

function PE_mean_(values) {
  return values.length
    ? values.reduce(function (sum, value) { return sum + Number(value); }, 0) / values.length
    : 0;
}

function PE_sd_(values) {
  if (!values.length) return 0;
  const mean = PE_mean_(values);
  return Math.sqrt(values.reduce(function (sum, value) {
    return sum + Math.pow(Number(value) - mean, 2);
  }, 0) / values.length);
}

function PE_level_(value) {
  const number = Number(value);
  if (!isFinite(number)) return 'ไม่สมบูรณ์';
  if (number >= 4.51) return 'มากที่สุด';
  if (number >= 3.51) return 'มาก';
  if (number >= 2.51) return 'ปานกลาง';
  if (number >= 1.51) return 'น้อย';
  if (number >= 1) return 'น้อยที่สุด';
  return 'ไม่สมบูรณ์';
}

function PE_parseItems_(value) {
  return (Array.isArray(value) ? value : String(value || '').split(/\r?\n/))
    .map(PE_clean_)
    .map(function (text) { return text.replace(/^\d+[\.\)]\s*/, ''); })
    .filter(Boolean);
}

function PE_isBadItemText_(value) {
  const text = PE_clean_(value);
  return !text ||
    /^Q\d+$/i.test(text) ||
    /^Question\s*\d+$/i.test(text) ||
    /^Column\s*\d+$/i.test(text) ||
    /^คอลัมน์[_\s-]*\d+$/i.test(text) ||
    /^\d+$/.test(text) ||
    text.length < 5;
}

function PE_num_(value) {
  const number = Number(value);
  return isFinite(number) ? number : '';
}

function PE_hash_(value) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ''),
    Utilities.Charset.UTF_8
  );
  return digest.map(function (byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function PE_safe_(value) {
  return String(value || '')
    .replace(/[\\\/\?\*\[\]\:\|\"]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

function PE_folder_(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}
