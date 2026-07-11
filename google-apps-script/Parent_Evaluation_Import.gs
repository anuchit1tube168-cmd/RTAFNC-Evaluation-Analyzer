function parentImportWideSheet(input) {
  const i = input || {};
  PE_requireAdmin_(i.adminKey);

  const sourceSpreadsheetId = PE_clean_(i.sourceSpreadsheetId);
  const sourceSheetName = PE_clean_(i.sourceSheetName || '');
  const academicYear = PE_clean_(i.academicYear);
  const activityName = PE_normalize_(i.activityName);
  const headerRow = Math.max(1, Number(i.headerRow || 1));

  if (!sourceSpreadsheetId) throw Error('ต้องระบุ Spreadsheet ID');
  if (!/^\d{4}$/.test(academicYear)) throw Error('ปีการศึกษาต้องเป็นตัวเลข 4 หลัก');
  if (!activityName) throw Error('ต้องระบุชื่อกิจกรรม');

  const sourceSpreadsheet = SpreadsheetApp.openById(sourceSpreadsheetId);
  const sourceSheet = sourceSheetName
    ? sourceSpreadsheet.getSheetByName(sourceSheetName)
    : sourceSpreadsheet.getSheets()[0];
  if (!sourceSheet) throw Error('ไม่พบชีตต้นทาง');

  const values = sourceSheet.getDataRange().getDisplayValues();
  if (values.length <= headerRow) throw Error('ข้อมูลต้นทางไม่เพียงพอ');

  const headers = values[headerRow - 1].map(PE_clean_);
  const sourceRows = values.slice(headerRow);
  const meta = PE_meta_(headers);
  const itemColumns = PE_itemCols_(headers, sourceRows, meta.all);

  if (!itemColumns.length) {
    return {
      ok: false,
      status: 'REVIEW',
      message: 'ไม่พบคอลัมน์ข้อคำถามที่มีคะแนน 1-5 ตาม Template'
    };
  }

  const itemTexts = itemColumns.map(function (columnIndex) { return headers[columnIndex]; });
  const badItems = itemTexts.filter(PE_isBadItemText_);
  if (badItems.length) {
    PE_logQa_('importWideSheet', 'REVIEW', 'หัวข้อคำถามไม่สมบูรณ์', {
      badItems: badItems,
      sourceSpreadsheetId: sourceSpreadsheetId,
      sourceSheetName: sourceSheet.getName()
    });
    return {
      ok: false,
      status: 'REVIEW',
      message: 'Template ต้องมีข้อความคำถามจริง ห้ามใช้ Q1/Q2/Column/เลขล้วน',
      badItems: badItems
    };
  }

  const prepared = [];
  sourceRows.forEach(function (row, rowOffset) {
    const rawScores = itemColumns.map(function (columnIndex) { return row[columnIndex]; });
    if (!rawScores.some(function (value) { return PE_clean_(value) !== ''; })) return;

    const scores = rawScores.map(PE_num_);
    const validScores = scores.filter(function (score) {
      return isFinite(score) && score >= 1 && score <= 5;
    });
    const studentId = meta.studentId >= 0 ? PE_clean_(row[meta.studentId]) : '';
    const studentName = meta.studentName >= 0 ? PE_normalize_(row[meta.studentName]) : '';
    const parentName = meta.parentName >= 0 ? PE_normalize_(row[meta.parentName]) : '';
    const relationship = meta.relationship >= 0 ? PE_normalize_(row[meta.relationship]) : '';
    const comments = meta.comments >= 0
      ? PE_clean_(row[meta.comments]).slice(0, PE_CONFIG.MAX_COMMENT_LENGTH)
      : '';
    const complete = validScores.length === itemColumns.length;
    const identityComplete = !!studentName && !!parentName;
    const average = validScores.length ? PE_round2_(PE_mean_(validScores)) : '';
    const sd = validScores.length ? PE_round2_(PE_sd_(validScores)) : '';

    prepared.push({
      sourceRow: headerRow + rowOffset + 1,
      studentId: studentId,
      studentName: studentName,
      parentName: parentName,
      relationship: relationship,
      comments: comments,
      scores: scores,
      validCount: validScores.length,
      average: average,
      sd: sd,
      level: validScores.length ? PE_level_(average) : 'ไม่สมบูรณ์',
      qaStatus: complete && identityComplete ? 'PASS' : 'REVIEW'
    });
  });

  if (!prepared.length) {
    return { ok: false, status: 'REVIEW', message: 'ไม่พบแถวข้อมูลคะแนนสำหรับนำเข้า' };
  }

  const fingerprint = PE_importFingerprint_({
    sourceSpreadsheetId: sourceSpreadsheetId,
    sourceSheetName: sourceSheet.getName(),
    academicYear: academicYear,
    activityName: activityName,
    itemTexts: itemTexts,
    rows: prepared
  });

  const previous = PE_read_(PE_CONFIG.SHEETS.IMPORTS).find(function (row) {
    return row.fingerprint === fingerprint;
  });
  if (previous) {
    return {
      ok: false,
      status: 'REVIEW',
      alreadyImported: true,
      message: 'ข้อมูลชุดนี้เคยนำเข้าแล้ว จึงหยุดเพื่อป้องกันข้อมูลซ้ำ',
      previousImportId: previous.importId,
      previousActivityId: previous.activityId,
      previousStatus: previous.status,
      fingerprint: fingerprint
    };
  }

  const created = parentCreateActivity({
    adminKey: i.adminKey,
    academicYear: academicYear,
    activityName: activityName,
    activityDate: i.activityDate || '',
    items: itemTexts,
    sourceSheet: sourceSheet.getName(),
    sourceColumns: itemColumns.map(function (columnIndex) { return PE_columnLetter_(columnIndex + 1); }),
    allowDuplicate: true
  });
  if (!created.ok) return created;

  const timestamp = PE_now_();
  const responseRows = prepared.map(function (row) {
    return [
      'RESP-' + Utilities.getUuid().slice(0, 10).toUpperCase(),
      timestamp,
      created.activityId,
      academicYear,
      row.studentId,
      row.studentName,
      row.parentName,
      row.relationship,
      JSON.stringify(row.scores),
      row.validCount,
      itemColumns.length,
      row.average,
      row.sd,
      row.level,
      row.comments,
      row.qaStatus
    ];
  });

  const imported = responseRows.length;
  const reviewCount = prepared.filter(function (row) { return row.qaStatus !== 'PASS'; }).length;
  const importId = 'IMP-' + Utilities.getUuid().slice(0, 10).toUpperCase();

  PE_withLock_(function () {
    const database = PE_getDb_();
    const responseSheet = database.getSheetByName(PE_CONFIG.SHEETS.RESPONSES);
    responseSheet.getRange(
      responseSheet.getLastRow() + 1,
      1,
      responseRows.length,
      responseRows[0].length
    ).setValues(responseRows);

    database.getSheetByName(PE_CONFIG.SHEETS.IMPORTS).appendRow([
      importId,
      timestamp,
      fingerprint,
      sourceSpreadsheetId,
      sourceSheet.getName(),
      academicYear,
      created.activityId,
      activityName,
      imported,
      itemColumns.length,
      reviewCount ? 'REVIEW' : 'PASS'
    ]);
  });

  PE_logQa_('importWideSheet', reviewCount ? 'REVIEW' : 'PASS', 'Import complete', {
    importId: importId,
    fingerprint: fingerprint,
    activityId: created.activityId,
    imported: imported,
    review: reviewCount,
    sourceSheetName: sourceSheet.getName()
  });

  return {
    ok: true,
    status: reviewCount ? 'REVIEW' : 'PASS',
    importId: importId,
    fingerprint: fingerprint,
    activityId: created.activityId,
    academicYear: academicYear,
    activityName: activityName,
    itemCount: itemColumns.length,
    importedResponses: imported,
    reviewResponses: reviewCount,
    excludedColumns: headers.filter(PE_isSummaryHeader_)
  };
}

function PE_find_(headers, keys) {
  const normalizedHeaders = headers.map(function (header) {
    return PE_normalize_(header).toLowerCase();
  });
  const normalizedKeys = keys.map(function (key) {
    return PE_normalize_(key).toLowerCase();
  });

  for (let keyIndex = 0; keyIndex < normalizedKeys.length; keyIndex++) {
    const exactIndex = normalizedHeaders.indexOf(normalizedKeys[keyIndex]);
    if (exactIndex >= 0) return exactIndex;
  }

  for (let headerIndex = 0; headerIndex < normalizedHeaders.length; headerIndex++) {
    for (let keyIndex = 0; keyIndex < normalizedKeys.length; keyIndex++) {
      if (normalizedHeaders[headerIndex].indexOf(normalizedKeys[keyIndex]) >= 0) return headerIndex;
    }
  }
  return -1;
}

function PE_meta_(headers) {
  const result = {
    studentId: PE_find_(headers, ['รหัสนักเรียน', 'เลขประจำตัวนักเรียน', 'student id', 'รหัส']),
    studentName: PE_find_(headers, ['ชื่อ-สกุลนักเรียน', 'ชื่อ สกุล นักเรียน', 'student name', 'ชื่อ-สกุล']),
    parentName: PE_find_(headers, ['ชื่อผู้ปกครอง', 'parent name', 'ผู้ปกครอง']),
    relationship: PE_find_(headers, ['ความสัมพันธ์', 'relationship']),
    comments: PE_find_(headers, ['ข้อเสนอแนะ', 'ความคิดเห็นเพิ่มเติม', 'comment']),
    timestamp: PE_find_(headers, ['ประทับเวลา', 'timestamp', 'วันเวลา'])
  };
  result.all = [
    result.studentId,
    result.studentName,
    result.parentName,
    result.relationship,
    result.comments,
    result.timestamp
  ].filter(function (index) { return index >= 0; });
  return result;
}

function PE_itemCols_(headers, rows, metaColumns) {
  const metaMap = {};
  metaColumns.forEach(function (index) { metaMap[index] = true; });
  const output = [];

  headers.forEach(function (header, columnIndex) {
    if (metaMap[columnIndex] || !PE_clean_(header) || PE_isSummaryHeader_(header)) return;

    let nonEmpty = 0;
    let validScores = 0;
    rows.forEach(function (row) {
      const value = PE_clean_(row[columnIndex]);
      if (value === '') return;
      nonEmpty++;
      const number = Number(value);
      if (isFinite(number) && number >= 1 && number <= 5) validScores++;
    });

    if (validScores > 0 && nonEmpty > 0 && validScores / nonEmpty >= 0.70) {
      output.push(columnIndex);
    }
  });

  return output;
}

function PE_isSummaryHeader_(header) {
  const text = PE_normalize_(header).toLowerCase().replace(/\s+/g, ' ');
  return /^(x|x̄|mean|average|avg|sd|s\.d\.?|std|std dev|standard deviation|total|sum|percent|percentage|ค่าเฉลี่ย|ส่วนเบี่ยงเบนมาตรฐาน|รวม|คะแนนรวม|ร้อยละ)$/i.test(text);
}

function PE_importFingerprint_(input) {
  const rowSignature = input.rows.map(function (row) {
    return [
      row.studentId,
      row.studentName,
      row.parentName,
      row.scores.join(',')
    ].join('|');
  }).join('\n');

  return PE_hash_([
    input.sourceSpreadsheetId,
    input.sourceSheetName,
    input.academicYear,
    input.activityName,
    input.itemTexts.join('|'),
    rowSignature
  ].join('\n'));
}

function PE_columnLetter_(columnNumber) {
  let number = Number(columnNumber);
  let output = '';
  while (number > 0) {
    const remainder = (number - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    number = Math.floor((number - 1) / 26);
  }
  return output;
}
