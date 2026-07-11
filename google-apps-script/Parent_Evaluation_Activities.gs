function parentCreateActivity(input) {
  const i = input || {};
  PE_requireAdmin_(i.adminKey);

  const academicYear = PE_clean_(i.academicYear);
  const activityName = PE_normalize_(i.activityName);
  const activityDate = PE_clean_(i.activityDate || '');
  const items = PE_parseItems_(i.items || i.itemsText || '');

  if (!/^\d{4}$/.test(academicYear)) throw Error('ปีการศึกษาต้องเป็นตัวเลข 4 หลัก');
  if (!activityName) throw Error('ต้องระบุชื่อกิจกรรม');
  if (!items.length) throw Error('ต้องระบุข้อคำถามอย่างน้อย 1 ข้อ');
  if (items.length > PE_CONFIG.MAX_ITEMS) throw Error('ข้อคำถามเกิน ' + PE_CONFIG.MAX_ITEMS + ' ข้อ');

  const badItems = items.filter(PE_isBadItemText_);
  if (badItems.length) {
    PE_logQa_('createActivity', 'REVIEW', 'พบหัวข้อคำถามไม่สมบูรณ์', { badItems: badItems });
    return {
      ok: false,
      status: 'REVIEW',
      message: 'พบ Q1/Q2/Column/เลขล้วน หรือข้อความสั้นเกินไป',
      badItems: badItems
    };
  }

  const duplicate = PE_read_(PE_CONFIG.SHEETS.ACTIVITIES).find(function (row) {
    return String(row.academicYear) === academicYear &&
      PE_normalize_(row.activityName).toLowerCase() === activityName.toLowerCase() &&
      String(row.status || 'ACTIVE') === 'ACTIVE';
  });

  if (duplicate && !i.allowDuplicate) {
    return {
      ok: false,
      status: 'REVIEW',
      message: 'มีกิจกรรมชื่อเดียวกันในปีการศึกษานี้แล้ว',
      existingActivityId: duplicate.activityId,
      activityName: duplicate.activityName,
      academicYear: duplicate.academicYear
    };
  }

  return PE_withLock_(function () {
    const ss = PE_getDb_();
    const activityId = 'PE-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    const now = PE_now_();

    ss.getSheetByName(PE_CONFIG.SHEETS.ACTIVITIES).appendRow([
      activityId,
      academicYear,
      activityName,
      activityDate,
      PE_clean_(i.ownerUnit || 'แผนกปกครอง วพอ.พอ.'),
      'ACTIVE',
      now
    ]);

    const itemRows = items.map(function (itemText, index) {
      return [
        activityId,
        index + 1,
        itemText,
        'Likert 1-5',
        5,
        PE_clean_(i.sourceSheet || 'web'),
        PE_clean_(i.sourceColumns && i.sourceColumns[index] || ''),
        'PASS',
        now
      ];
    });

    const itemSheet = ss.getSheetByName(PE_CONFIG.SHEETS.ITEMS);
    itemSheet.getRange(itemSheet.getLastRow() + 1, 1, itemRows.length, itemRows[0].length)
      .setValues(itemRows);

    PE_logQa_('createActivity', 'PASS', 'สร้างกิจกรรมสำเร็จ', {
      activityId: activityId,
      itemCount: items.length
    });

    return {
      ok: true,
      status: 'PASS',
      activityId: activityId,
      academicYear: academicYear,
      activityName: activityName,
      itemCount: items.length
    };
  });
}

function parentListActivities(input) {
  const academicYear = PE_clean_(input && input.academicYear || '');
  const rows = PE_read_(PE_CONFIG.SHEETS.ACTIVITIES)
    .filter(function (row) {
      return (!academicYear || String(row.academicYear) === academicYear) &&
        String(row.status || 'ACTIVE') === 'ACTIVE';
    })
    .sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

  return { ok: true, status: 'PASS', count: rows.length, activities: rows };
}

function parentGetItems(input) {
  const activityId = PE_clean_(input && input.activityId || '');
  if (!activityId) throw Error('ต้องระบุ activityId');

  const items = PE_items_(activityId).map(function (item) {
    return {
      itemNo: Number(item.itemNo),
      itemText: item.itemText,
      itemType: item.itemType,
      maxScore: Number(item.maxScore || 5)
    };
  });

  return {
    ok: true,
    status: items.length ? 'PASS' : 'REVIEW',
    activityId: activityId,
    itemCount: items.length,
    items: items
  };
}

function parentSaveResponse(input) {
  const i = input || {};
  const activityId = PE_clean_(i.activityId);
  const studentId = PE_clean_(i.studentId || '');
  const studentName = PE_normalize_(i.studentName || '');
  const parentName = PE_normalize_(i.parentName || '');
  const relationship = PE_normalize_(i.relationship || '');
  const comments = PE_clean_(i.comments || '').slice(0, PE_CONFIG.MAX_COMMENT_LENGTH);

  if (!studentName) throw Error('ต้องระบุชื่อ-สกุลนักเรียน');
  if (!parentName) throw Error('ต้องระบุชื่อผู้ปกครอง');

  const activity = PE_activity_(activityId);
  if (!activity) throw Error('ไม่พบกิจกรรม ' + activityId);

  const items = PE_items_(activityId);
  if (!items.length) throw Error('กิจกรรมนี้ยังไม่มี Item Dictionary');

  const scores = PE_scores_(i.scores, items);
  const invalidIndexes = [];
  scores.forEach(function (score, index) {
    if (!(isFinite(score) && score >= 1 && score <= 5)) invalidIndexes.push(index + 1);
  });

  if (invalidIndexes.length) {
    throw Error('คะแนนต้องเป็น 1-5 และตอบให้ครบทุกข้อ: ข้อ ' + invalidIndexes.join(', '));
  }

  const average = PE_round2_(PE_mean_(scores));
  const sd = PE_round2_(PE_sd_(scores));
  const responseId = 'RESP-' + Utilities.getUuid().slice(0, 10).toUpperCase();

  return PE_withLock_(function () {
    PE_getDb_().getSheetByName(PE_CONFIG.SHEETS.RESPONSES).appendRow([
      responseId,
      PE_now_(),
      activityId,
      activity.academicYear,
      studentId,
      studentName,
      parentName,
      relationship,
      JSON.stringify(scores),
      scores.length,
      items.length,
      average,
      sd,
      PE_level_(average),
      comments,
      'PASS'
    ]);

    PE_logQa_('saveResponse', 'PASS', 'บันทึกแบบประเมินครบถ้วน', {
      responseId: responseId,
      activityId: activityId,
      itemCount: items.length
    });

    return {
      ok: true,
      status: 'PASS',
      responseId: responseId,
      activityId: activityId,
      academicYear: activity.academicYear,
      average: average,
      sd: sd,
      level: PE_level_(average),
      answeredCount: scores.length,
      itemCount: items.length
    };
  });
}

function PE_scores_(scoresInput, items) {
  if (Array.isArray(scoresInput)) {
    return items.map(function (item, index) { return PE_num_(scoresInput[index]); });
  }
  if (scoresInput && typeof scoresInput === 'object') {
    return items.map(function (item) {
      const byNumber = scoresInput[String(item.itemNo)];
      const byKey = scoresInput['item' + item.itemNo];
      return PE_num_(byNumber !== undefined ? byNumber : byKey);
    });
  }
  if (typeof scoresInput === 'string') {
    const values = scoresInput.split(',');
    return items.map(function (item, index) { return PE_num_(values[index]); });
  }
  return items.map(function () { return ''; });
}
