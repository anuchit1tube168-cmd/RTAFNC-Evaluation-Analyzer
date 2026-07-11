/**
 * Parent Evaluation v1.3 report overrides.
 * Only QA PASS records contribute to averages, S.D. and per-item statistics.
 * REVIEW records remain visible in counts/details for correction.
 */

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

  const passResponses = responses.filter(function (response) {
    return String(response.qaStatus || '') === 'PASS';
  });

  const summaries = activities.map(function (activity) {
    const allRows = responses.filter(function (response) {
      return String(response.activityId) === String(activity.activityId);
    });
    const passRows = allRows.filter(function (response) {
      return String(response.qaStatus || '') === 'PASS';
    });
    const values = passRows
      .map(function (response) { return Number(response.average); })
      .filter(function (value) { return isFinite(value) && value >= 1 && value <= 5; });
    const average = values.length ? PE_round2_(PE_mean_(values)) : '';

    return {
      activityId: activity.activityId,
      academicYear: activity.academicYear,
      activityName: activity.activityName,
      activityDate: activity.activityDate,
      responseCount: allRows.length,
      passCount: passRows.length,
      reviewCount: allRows.length - passRows.length,
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
    passCount: passResponses.length,
    reviewCount: responses.length - passResponses.length,
    summaries: summaries,
    itemStats: activityId ? PE_itemStats_(activityId, passResponses) : []
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

  const passDetails = details.filter(function (detail) {
    return String(detail.qaStatus || '') === 'PASS';
  });
  const averages = passDetails
    .map(function (detail) { return Number(detail.average); })
    .filter(function (value) { return isFinite(value) && value >= 1 && value <= 5; });
  const overallAverage = averages.length ? PE_round2_(PE_mean_(averages)) : '';

  return {
    ok: true,
    status: details.length ? 'PASS' : 'REVIEW',
    academicYear: academicYear,
    studentId: studentId,
    studentName: studentName,
    responseCount: details.length,
    passCount: passDetails.length,
    reviewCount: details.length - passDetails.length,
    overallAverage: overallAverage,
    overallSd: averages.length ? PE_round2_(PE_sd_(averages)) : '',
    overallLevel: averages.length ? PE_level_(overallAverage) : 'ไม่พบข้อมูลที่ผ่าน QA',
    details: details
  };
}
