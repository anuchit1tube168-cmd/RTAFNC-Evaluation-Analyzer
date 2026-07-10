function parentGetDashboard(input) {
  const i = input || {};
  PE_requireAdmin_(i.adminKey);
  const academicYear = PE_clean_(i.academicYear || '');
  const activityId = PE_clean_(i.activityId || '');

  const activities = PE_read_(PE_CONFIG.SHEETS.ACTIVITIES).filter(a =>
    (!academicYear || String(a.academicYear) === academicYear) &&
    (!activityId || String(a.activityId) === activityId)
  );

  const responses = PE_read_(PE_CONFIG.SHEETS.RESPONSES).filter(r =>
    (!academicYear || String(r.academicYear) === academicYear) &&
    (!activityId || String(r.activityId) === activityId)
  );

  const summaries = activities.map(a => {
    const rows = responses.filter(r => String(r.activityId) === String(a.activityId));
    const values = rows.map(r => Number(r.average)).filter(isFinite);
    const average = values.length ? PE_round2_(PE_mean_(values)) : '';
    return {
      activityId: a.activityId,
      academicYear: a.academicYear,
      activityName: a.activityName,
      activityDate: a.activityDate,
      responseCount: rows.length,
      average: average,
      sd: values.length ? PE_round2_(PE_sd_(values)) : '',
      level: values.length ? PE_level_(average) : 'ยังไม่มีข้อมูล'
    };
  });

  return {
    ok: true,
    status: 'PASS',
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
  const studentName = PE_clean_(i.studentName || '');

  if (!academicYear) throw Error('ต้องระบุปีการศึกษา');
  if (!studentId && !studentName) throw Error('ต้องระบุรหัสหรือชื่อนักเรียน');

  let responses = PE_read_(PE_CONFIG.SHEETS.RESPONSES)
    .filter(r => String(r.academicYear) === academicYear);

  if (studentId) responses = responses.filter(r => String(r.studentId) === studentId);
  if (studentName) responses = responses.filter(r => String(r.studentName || '').includes(studentName));

  const activityMap = {};
  PE_read_(PE_CONFIG.SHEETS.ACTIVITIES).forEach(a => activityMap[a.activityId] = a);

  const details = responses.map(r => {
    let scores = [];
    try { scores = JSON.parse(r.scoresJson || '[]'); } catch (err) { scores = []; }

    const items = PE_items_(r.activityId);
    const itemDetails = items.map((item, index) => {
      const score = Number(scores[index]);
      const valid = isFinite(score) && score >= 1 && score <= 5;
      return {
        itemNo: Number(item.itemNo),
        itemText: item.itemText,
        score: valid ? score : '',
        level: valid ? PE_level_(score) : 'ไม่มีคะแนน'
      };
    });

    const activity = activityMap[r.activityId] || {};
    return {
      responseId: r.responseId,
      timestamp: r.timestamp,
      activityId: r.activityId,
      activityName: activity.activityName || '',
      activityDate: activity.activityDate || '',
      studentId: r.studentId,
      studentName: r.studentName,
      parentName: r.parentName,
      relationship: r.relationship,
      average: Number(r.average),
      sd: Number(r.sd),
      level: r.level,
      comments: r.comments,
      qaStatus: r.qaStatus,
      itemCount: items.length,
      itemDetails: itemDetails
    };
  });

  const averages = details.map(d => Number(d.average)).filter(isFinite);
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
  const activity = PE_activity_(activityId);
  if (!activityId) throw Error('ต้องระบุ activityId');
  if (!activity) throw Error('ไม่พบกิจกรรม');

  const report = parentGetDashboard({
    adminKey: i.adminKey,
    academicYear: activity.academicYear,
    activityId: activityId
  });
  const summary = report.summaries[0] || {};

  const doc = DocumentApp.create('รายงานผู้ปกครอง_' + activity.academicYear + '_' + activity.activityName);
  const body = doc.getBody();
  body.appendParagraph('รายงานแปลผลการประเมินผู้ปกครอง วิทยาลัยพยาบาลทหารอากาศ')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('ปีการศึกษา: ' + activity.academicYear);
  body.appendParagraph('กิจกรรม: ' + activity.activityName);
  body.appendParagraph('วันที่กิจกรรม: ' + (activity.activityDate || '-'));
  body.appendParagraph('จำนวนผู้ตอบ: ' + (summary.responseCount || 0));
  body.appendParagraph('ค่าเฉลี่ยรวม: ' + (summary.average === '' ? '-' : summary.average));
  body.appendParagraph('S.D.: ' + (summary.sd === '' ? '-' : summary.sd));
  body.appendParagraph('ระดับ: ' + (summary.level || '-'));
  body.appendParagraph('ผลรายข้อ').setHeading(DocumentApp.ParagraphHeading.HEADING2);

  const table = [['ข้อ', 'รายการประเมิน', 'n', 'ค่าเฉลี่ย', 'S.D.', 'แปลผล']];
  report.itemStats.forEach(x => table.push([
    String(x.itemNo), String(x.itemText), String(x.count),
    String(x.average), String(x.sd), String(x.level)
  ]));
  body.appendTable(table);
  body.appendParagraph('หมายเหตุ: ใช้ข้อความคำถามจริงจาก PE_Item_Dictionary');
  doc.saveAndClose();

  const blob = DriveApp.getFileById(doc.getId())
    .getAs(MimeType.PDF)
    .setName('รายงานแปลผล_' + PE_safe_(activity.academicYear + '_' + activity.activityName) + '.pdf');
  const file = PE_folder_(PE_CONFIG.PDF_FOLDER_NAME).createFile(blob);
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  PE_logQa_('exportActivityPdf', 'PASS', 'Export activity PDF complete', {
    activityId: activityId,
    pdfUrl: file.getUrl()
  });

  return { ok: true, status: 'PASS', activityId: activityId, pdfUrl: file.getUrl(), fileId: file.getId() };
}

function parentExportIndividualPdf(input) {
  const i = input || {};
  PE_requireAdmin_(i.adminKey);
  const report = parentGetIndividualReport(i);
  if (!report.details.length) throw Error('ไม่พบข้อมูลรายบุคคลสำหรับสร้าง PDF');

  const first = report.details[0];
  const displayName = first.studentName || report.studentName || report.studentId || 'ไม่ระบุชื่อ';
  const doc = DocumentApp.create('รายงานรายบุคคล_' + report.academicYear + '_' + displayName);
  const body = doc.getBody();

  body.appendParagraph('รายงานแปลผลการประเมินผู้ปกครองรายบุคคล')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ');
  body.appendParagraph('ปีการศึกษา: ' + report.academicYear);
  body.appendParagraph('รหัสนักเรียน: ' + (first.studentId || '-'));
  body.appendParagraph('ชื่อ-สกุลนักเรียน: ' + (first.studentName || '-'));
  body.appendParagraph('ค่าเฉลี่ยรวมทุกกิจกรรม: ' + report.overallAverage);
  body.appendParagraph('S.D.: ' + report.overallSd);
  body.appendParagraph('ระดับภาพรวม: ' + report.overallLevel);

  report.details.forEach((detail, index) => {
    body.appendParagraph((index + 1) + '. ' + detail.activityName)
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('วันที่กิจกรรม: ' + (detail.activityDate || '-'));
    body.appendParagraph('ผู้ปกครอง: ' + (detail.parentName || '-') + ' (' + (detail.relationship || '-') + ')');
    body.appendParagraph('ค่าเฉลี่ย: ' + detail.average + ' | S.D.: ' + detail.sd + ' | ระดับ: ' + detail.level);

    const table = [['ข้อ', 'รายการประเมิน', 'คะแนน', 'แปลผล']];
    detail.itemDetails.forEach(item => table.push([
      String(item.itemNo), String(item.itemText), String(item.score), String(item.level)
    ]));
    body.appendTable(table);
    if (detail.comments) body.appendParagraph('ข้อเสนอแนะ: ' + detail.comments);
  });

  body.appendParagraph('หมายเหตุ: รายงานนี้แสดงคะแนนรายข้อจากข้อความคำถามจริงใน PE_Item_Dictionary');
  doc.saveAndClose();

  const blob = DriveApp.getFileById(doc.getId())
    .getAs(MimeType.PDF)
    .setName('รายงานรายบุคคล_' + PE_safe_(report.academicYear + '_' + displayName) + '.pdf');
  const file = PE_folder_(PE_CONFIG.PDF_FOLDER_NAME).createFile(blob);
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  PE_logQa_('exportIndividualPdf', 'PASS', 'Export individual PDF complete', {
    academicYear: report.academicYear,
    studentId: first.studentId,
    studentName: first.studentName,
    pdfUrl: file.getUrl()
  });

  return {
    ok: true,
    status: 'PASS',
    academicYear: report.academicYear,
    studentId: first.studentId,
    studentName: first.studentName,
    pdfUrl: file.getUrl(),
    fileId: file.getId()
  };
}

function PE_itemStats_(activityId, responses) {
  return PE_items_(activityId).map((item, index) => {
    const values = responses
      .filter(r => String(r.activityId) === String(activityId))
      .map(r => {
        try { return Number(JSON.parse(r.scoresJson || '[]')[index]); }
        catch (err) { return NaN; }
      })
      .filter(n => isFinite(n) && n >= 1 && n <= 5);

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
