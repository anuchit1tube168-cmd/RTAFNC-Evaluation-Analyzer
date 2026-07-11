function parentGetDashboard(input) {
  const i = input || {};
  PE_requireAdmin_(i.adminKey);
  const academicYear = PE_clean_(i.academicYear || '');
  const activityId = PE_clean_(i.activityId || '');

  const activities = PE_read_(PE_CONFIG.SHEETS.ACTIVITIES).filter(function (activity) {
    return (!academicYear || String(activity.academicYear) === academicYear) &&
      (!activityId || String(activity.activityId) === activityId) &&
      String(activity.status || 'ACTIVE') === 'ACTIVE';
  });

  const responses = PE_read_(PE_CONFIG.SHEETS.RESPONSES).filter(function (response) {
    return (!academicYear || String(response.academicYear) === academicYear) &&
      (!activityId || String(response.activityId) === activityId);
  });

  const summaries = activities.map(function (activity) {
    const rows = responses.filter(function (response) {
      return String(response.activityId) === String(activity.activityId);
    });
    const values = rows.map(function (response) { return Number(response.average); })
      .filter(function (value) { return isFinite(value) && value >= 1 && value <= 5; });
    const average = values.length ? PE_round2_(PE_mean_(values)) : '';
    const reviewCount = rows.filter(function (response) { return response.qaStatus !== 'PASS'; }).length;

    return {
      activityId: activity.activityId,
      academicYear: activity.academicYear,
      activityName: activity.activityName,
      activityDate: activity.activityDate,
      responseCount: rows.length,
      passCount: rows.length - reviewCount,
      reviewCount: reviewCount,
      average: average,
      sd: values.length ? PE_round2_(PE_sd_(values)) : '',
      level: values.length ? PE_level_(average) : 'ยังไม่มีข้อมูล'
    };
  });

  return {
    ok: true,
    status: summaries.length ? 'PASS' : 'REVIEW',
    academicYear: academicYear,
    activityId: activityId,
    summaryCount: summaries.length,
    responseCount: responses.length,
    summaries: summaries,
    itemStats: activityId ? PE_itemStats_(activityId, responses) : []
  };
}

function parentGetIndividualReport(input) {
  const i = input || {};
  PE_requireAdmin_(i.adminKey);
  const academicYear = PE_clean_(i.academicYear || '');
  const studentId = PE_clean_(i.studentId || '');
  const studentName = PE_normalize_(i.studentName || '');

  if (!/^\d{4}$/.test(academicYear)) throw Error('ปีการศึกษาต้องเป็นตัวเลข 4 หลัก');
  if (!studentId && !studentName) throw Error('ต้องระบุรหัสหรือชื่อ-สกุลนักเรียน');

  let responses = PE_read_(PE_CONFIG.SHEETS.RESPONSES).filter(function (response) {
    return String(response.academicYear) === academicYear;
  });

  if (studentId) {
    responses = responses.filter(function (response) {
      return PE_clean_(response.studentId) === studentId;
    });
    if (studentName) {
      const normalizedTarget = studentName.toLowerCase();
      responses = responses.filter(function (response) {
        return PE_normalize_(response.studentName).toLowerCase() === normalizedTarget;
      });
    }
  } else {
    const normalizedTarget = studentName.toLowerCase();
    responses = responses.filter(function (response) {
      return PE_normalize_(response.studentName).toLowerCase() === normalizedTarget;
    });
  }

  const identityKeys = {};
  responses.forEach(function (response) {
    const key = PE_clean_(response.studentId) || PE_normalize_(response.studentName).toLowerCase();
    identityKeys[key] = true;
  });
  const identities = Object.keys(identityKeys);
  if (!studentId && identities.length > 1) {
    return {
      ok: false,
      status: 'REVIEW',
      ambiguous: true,
      message: 'พบชื่อซ้ำมากกว่า 1 รหัส กรุณาค้นหาด้วยรหัสนักเรียน',
      candidateCount: identities.length
    };
  }

  const activityMap = {};
  PE_read_(PE_CONFIG.SHEETS.ACTIVITIES).forEach(function (activity) {
    activityMap[activity.activityId] = activity;
  });

  const details = responses.map(function (response) {
    let scores = [];
    try {
      scores = JSON.parse(response.scoresJson || '[]');
    } catch (err) {
      scores = [];
    }

    const items = PE_items_(response.activityId);
    const itemDetails = items.map(function (item, index) {
      const score = Number(scores[index]);
      const valid = isFinite(score) && score >= 1 && score <= 5;
      return {
        itemNo: Number(item.itemNo),
        itemText: item.itemText,
        score: valid ? score : '',
        level: valid ? PE_level_(score) : 'ไม่มีคะแนน'
      };
    });

    const activity = activityMap[response.activityId] || {};
    return {
      responseId: response.responseId,
      timestamp: response.timestamp,
      activityId: response.activityId,
      activityName: activity.activityName || '',
      activityDate: activity.activityDate || '',
      studentId: response.studentId,
      studentName: response.studentName,
      parentName: response.parentName,
      relationship: response.relationship,
      average: Number(response.average),
      sd: Number(response.sd),
      level: response.level,
      comments: response.comments,
      qaStatus: response.qaStatus,
      itemCount: items.length,
      itemDetails: itemDetails
    };
  });

  const averages = details.map(function (detail) { return Number(detail.average); })
    .filter(function (value) { return isFinite(value) && value >= 1 && value <= 5; });
  const overallAverage = averages.length ? PE_round2_(PE_mean_(averages)) : '';

  return {
    ok: true,
    status: details.length ? 'PASS' : 'REVIEW',
    academicYear: academicYear,
    studentId: studentId,
    studentName: studentName,
    responseCount: details.length,
    overallAverage: overallAverage,
    overallSd: averages.length ? PE_round2_(PE_sd_(averages)) : '',
    overallLevel: averages.length ? PE_level_(overallAverage) : 'ไม่พบข้อมูล',
    details: details
  };
}

function parentExportActivityPdf(input) {
  const i = input || {};
  PE_requireAdmin_(i.adminKey);
  const activityId = PE_clean_(i.activityId || '');
  if (!activityId) throw Error('ต้องระบุ activityId');

  const activity = PE_activity_(activityId);
  if (!activity) throw Error('ไม่พบกิจกรรม');

  const report = parentGetDashboard({
    adminKey: i.adminKey,
    academicYear: activity.academicYear,
    activityId: activityId
  });
  const summary = report.summaries[0] || {};
  const comments = PE_read_(PE_CONFIG.SHEETS.RESPONSES)
    .filter(function (response) {
      return String(response.activityId) === activityId && PE_clean_(response.comments);
    })
    .map(function (response) { return PE_clean_(response.comments); });

  const document = DocumentApp.create(
    'รายงานผลการประเมินผู้ปกครอง_' + activity.academicYear + '_' + activity.activityName
  );
  const body = document.getBody();

  try {
    PE_appendOfficialTitle_(body, [
      'รายงานผลการประเมินผู้ปกครอง',
      'แผนกปกครอง วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ',
      'ปีการศึกษา ' + activity.academicYear
    ]);

    PE_appendBodyParagraph_(body, 'ชื่อกิจกรรม: ' + activity.activityName, true);
    PE_appendBodyParagraph_(body, 'วันที่ดำเนินกิจกรรม: ' + (activity.activityDate || '-'));

    PE_appendSectionHeading_(body, '1. สรุปผลการประเมิน');
    const summaryTable = body.appendTable([
      ['จำนวนผู้ตอบ', 'ค่าเฉลี่ย', 'S.D.', 'ระดับผลการประเมิน'],
      [
        String(summary.responseCount || 0),
        summary.average === '' ? '-' : Number(summary.average).toFixed(2),
        summary.sd === '' ? '-' : Number(summary.sd).toFixed(2),
        String(summary.level || '-')
      ]
    ]);
    PE_styleTable_(summaryTable, [95, 80, 80, 150]);

    PE_appendSectionHeading_(body, '2. ผลการประเมินรายข้อ');
    const itemTableRows = [['ข้อ', 'รายการประเมิน', 'n', 'ค่าเฉลี่ย', 'S.D.', 'แปลผล']];
    report.itemStats.forEach(function (item) {
      itemTableRows.push([
        String(item.itemNo),
        String(item.itemText),
        String(item.count),
        item.average === '' ? '-' : Number(item.average).toFixed(2),
        item.sd === '' ? '-' : Number(item.sd).toFixed(2),
        String(item.level)
      ]);
    });
    PE_styleTable_(body.appendTable(itemTableRows), [35, 250, 40, 65, 55, 85]);

    PE_appendSectionHeading_(body, '3. ข้อเสนอแนะจากผู้ปกครอง');
    if (comments.length) {
      comments.forEach(function (comment, index) {
        PE_appendBodyParagraph_(body, (index + 1) + '. ' + comment);
      });
    } else {
      PE_appendBodyParagraph_(body, 'ไม่มีข้อเสนอแนะเพิ่มเติม');
    }

    PE_appendSectionHeading_(body, '4. หมายเหตุและการรับรองข้อมูล');
    PE_appendBodyParagraph_(
      body,
      'รายงานนี้ใช้ข้อความคำถามจริงจาก PE_Item_Dictionary และคำนวณจากข้อมูลที่บันทึกในระบบตามปีการศึกษาและกิจกรรมที่ระบุ'
    );
    PE_appendSignatureBlock_(body);

    document.saveAndClose();

    const blob = DriveApp.getFileById(document.getId())
      .getAs(MimeType.PDF)
      .setName('รายงานผลการประเมินผู้ปกครอง_' + PE_safe_(activity.academicYear + '_' + activity.activityName) + '.pdf');
    const file = PE_folder_(PE_CONFIG.PDF_FOLDER_NAME).createFile(blob);

    PE_logQa_('exportActivityPdf', 'PASS', 'Export activity PDF complete', {
      activityId: activityId,
      pdfUrl: file.getUrl(),
      template: 'official-governance-v1'
    });

    return {
      ok: true,
      status: 'PASS',
      activityId: activityId,
      pdfUrl: file.getUrl(),
      fileId: file.getId(),
      template: 'official-governance-v1'
    };
  } finally {
    try {
      DriveApp.getFileById(document.getId()).setTrashed(true);
    } catch (ignore) {}
  }
}

function parentExportIndividualPdf(input) {
  const i = input || {};
  PE_requireAdmin_(i.adminKey);
  const report = parentGetIndividualReport(i);
  if (!report.ok || !report.details || !report.details.length) {
    throw Error(report.message || 'ไม่พบข้อมูลรายบุคคลสำหรับสร้าง PDF');
  }

  const first = report.details[0];
  const displayName = first.studentName || report.studentName || report.studentId || 'ไม่ระบุชื่อ';
  const document = DocumentApp.create(
    'รายงานผลการประเมินผู้ปกครองรายบุคคล_' + report.academicYear + '_' + displayName
  );
  const body = document.getBody();

  try {
    PE_appendOfficialTitle_(body, [
      'รายงานผลการประเมินผู้ปกครองรายบุคคล',
      'แผนกปกครอง วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ',
      'ปีการศึกษา ' + report.academicYear
    ]);

    PE_appendBodyParagraph_(body, 'รหัสนักเรียน: ' + (first.studentId || '-'));
    PE_appendBodyParagraph_(body, 'ชื่อ-สกุลนักเรียน: ' + (first.studentName || '-'), true);

    const summaryTable = body.appendTable([
      ['จำนวนกิจกรรม', 'ค่าเฉลี่ยรวม', 'S.D.', 'ระดับภาพรวม'],
      [
        String(report.responseCount),
        report.overallAverage === '' ? '-' : Number(report.overallAverage).toFixed(2),
        report.overallSd === '' ? '-' : Number(report.overallSd).toFixed(2),
        String(report.overallLevel)
      ]
    ]);
    PE_styleTable_(summaryTable, [95, 90, 80, 145]);

    report.details.forEach(function (detail, index) {
      PE_appendSectionHeading_(body, (index + 1) + '. ' + detail.activityName);
      PE_appendBodyParagraph_(body, 'วันที่กิจกรรม: ' + (detail.activityDate || '-'));
      PE_appendBodyParagraph_(
        body,
        'ผู้ปกครอง: ' + (detail.parentName || '-') + ' (' + (detail.relationship || '-') + ')'
      );
      PE_appendBodyParagraph_(
        body,
        'ค่าเฉลี่ย: ' + Number(detail.average).toFixed(2) +
          ' | S.D.: ' + Number(detail.sd).toFixed(2) +
          ' | ระดับ: ' + detail.level,
        true
      );

      const rows = [['ข้อ', 'รายการประเมิน', 'คะแนน', 'แปลผล']];
      detail.itemDetails.forEach(function (item) {
        rows.push([
          String(item.itemNo),
          String(item.itemText),
          String(item.score),
          String(item.level)
        ]);
      });
      PE_styleTable_(body.appendTable(rows), [40, 280, 60, 90]);
      if (detail.comments) {
        PE_appendBodyParagraph_(body, 'ข้อเสนอแนะ: ' + detail.comments, true);
      }
    });

    PE_appendBodyParagraph_(
      body,
      'หมายเหตุ: รายงานนี้แสดงคะแนนรายข้อจากข้อความคำถามจริงใน PE_Item_Dictionary'
    );
    PE_appendSignatureBlock_(body);
    document.saveAndClose();

    const blob = DriveApp.getFileById(document.getId())
      .getAs(MimeType.PDF)
      .setName('รายงานรายบุคคล_' + PE_safe_(report.academicYear + '_' + displayName) + '.pdf');
    const file = PE_folder_(PE_CONFIG.PDF_FOLDER_NAME).createFile(blob);

    PE_logQa_('exportIndividualPdf', 'PASS', 'Export individual PDF complete', {
      academicYear: report.academicYear,
      studentId: first.studentId,
      studentName: first.studentName,
      pdfUrl: file.getUrl(),
      template: 'official-governance-v1'
    });

    return {
      ok: true,
      status: 'PASS',
      academicYear: report.academicYear,
      studentId: first.studentId,
      studentName: first.studentName,
      pdfUrl: file.getUrl(),
      fileId: file.getId(),
      template: 'official-governance-v1'
    };
  } finally {
    try {
      DriveApp.getFileById(document.getId()).setTrashed(true);
    } catch (ignore) {}
  }
}

function PE_itemStats_(activityId, responses) {
  return PE_items_(activityId).map(function (item, index) {
    const values = responses
      .filter(function (response) { return String(response.activityId) === String(activityId); })
      .map(function (response) {
        try {
          return Number(JSON.parse(response.scoresJson || '[]')[index]);
        } catch (err) {
          return NaN;
        }
      })
      .filter(function (value) { return isFinite(value) && value >= 1 && value <= 5; });

    const average = values.length ? PE_round2_(PE_mean_(values)) : '';
    return {
      itemNo: Number(item.itemNo),
      itemText: item.itemText,
      count: values.length,
      average: average,
      sd: values.length ? PE_round2_(PE_sd_(values)) : '',
      level: values.length ? PE_level_(average) : 'ยังไม่มีข้อมูล'
    };
  });
}

function PE_appendOfficialTitle_(body, lines) {
  lines.forEach(function (line, index) {
    const paragraph = body.appendParagraph(line);
    paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    paragraph.editAsText()
      .setFontFamily('TH Sarabun New')
      .setFontSize(index === 0 ? 20 : 16)
      .setBold(index <= 1);
  });
  body.appendParagraph('');
}

function PE_appendSectionHeading_(body, text) {
  const paragraph = body.appendParagraph(text);
  paragraph.editAsText()
    .setFontFamily('TH Sarabun New')
    .setFontSize(16)
    .setBold(true);
  paragraph.setSpacingBefore(8).setSpacingAfter(4);
  return paragraph;
}

function PE_appendBodyParagraph_(body, text, bold) {
  const paragraph = body.appendParagraph(text);
  paragraph.editAsText()
    .setFontFamily('TH Sarabun New')
    .setFontSize(16)
    .setBold(!!bold);
  paragraph.setLineSpacing(1.15);
  return paragraph;
}

function PE_styleTable_(table, widths) {
  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex++) {
    const row = table.getRow(rowIndex);
    for (let cellIndex = 0; cellIndex < row.getNumCells(); cellIndex++) {
      const cell = row.getCell(cellIndex);
      cell.editAsText()
        .setFontFamily('TH Sarabun New')
        .setFontSize(14)
        .setBold(rowIndex === 0);
      if (rowIndex === 0) cell.setBackgroundColor('#D9EAF7');
      if (widths && widths[cellIndex]) cell.setWidth(widths[cellIndex]);
    }
  }
  return table;
}

function PE_appendSignatureBlock_(body) {
  body.appendParagraph('');
  body.appendParagraph('');
  const line1 = body.appendParagraph('(ลงชื่อ) ............................................................');
  const line2 = body.appendParagraph('(............................................................)');
  const line3 = body.appendParagraph('เจ้าหน้าที่แผนกปกครอง วพอ.พอ.');
  [line1, line2, line3].forEach(function (paragraph) {
    paragraph.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    paragraph.editAsText().setFontFamily('TH Sarabun New').setFontSize(16);
  });
}
