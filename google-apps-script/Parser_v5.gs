/**
 * RTAFNC Evaluation Analyzer — Parser v5 (wide/matrix form)
 *
 * ตัวแยกข้อมูลแบบ "หัวข้อประเมินเป็นหัวคอลัมน์ และผู้ตอบเป็นรายแถว"
 * ซึ่งเป็นรูปแบบไฟล์ดิบจาก Google Forms / Excel ที่ใช้จริงในงาน วพอ.พอ.
 *
 * เป้าหมาย (Phase 1 — NEXT_ENGINEERING_TASKS):
 *   - ตรวจหาแถว header: เลขที่ / รหัส / ชื่อ-สกุล / อีเมล / ชั้นปี
 *   - ตรวจหาคอลัมน์คะแนนข้อ 1..n โดยไม่นับ เลขที่/ชั้นปี/รหัส เป็นคะแนน
 *   - ใช้ "ข้อความคำถามจริง" จากหัวคอลัมน์ ไม่สร้าง Q1/คอลัมน์_4
 *   - clean ชื่อไทย ไม่ให้ถูกตัดผิดช่อง และไม่สร้างคอลัมน์ยศเอง
 *   - ตรวจคะแนนนอกช่วง 1–5 และตรวจ duplicate respondent
 *
 * ไฟล์นี้เป็น pure logic ล้วน (รับ 2D array) เพื่อให้ทดสอบนอก Apps Script ได้
 * และตั้งชื่อ helper แบบไม่ชนกับฟังก์ชันเดิมใน Code.gs (ใช้ prefix p...)
 */

/** โทเคนหัวคอลัมน์ที่ใช้จำแนกบทบาทของคอลัมน์ (metadata) */
const PARSER_HEADER_ROLES = [
  { role: 'timestamp', regex: /(ประทับเวลา|timestamp|เวลาบันทึก|วันที่ตอบ)/i },
  { role: 'email',     regex: /(อีเมล|อี-?เมล|e-?mail)/i },
  { role: 'comment',   regex: /(ข้อคิดเห็น|ข้อเสนอแนะ|ความคิดเห็น|comment|suggestion|เพิ่มเติม|อื่น\s*ๆ)/i },
  { role: 'year',      regex: /(ชั้นปี|ระดับชั้น|ชั้นปีที่|^\s*ปี\s*$|^\s*ปีที่|นักเรียนชั้นปี)/i },
  { role: 'rank',      regex: /(^\s*ยศ\s*$|ชั้นยศ|ยศ\s*\/|\bยศ\b)/i },
  { role: 'id',        regex: /(รหัสนักศึกษา|รหัส\s*นศ|รหัสประจำตัว|รหัส|student\s*id|^\s*id\s*$)/i },
  { role: 'seq',       regex: /(เลขที่|ลำดับที่|^\s*ลำดับ\s*$|^\s*ที่\s*$)/i },
  { role: 'name',      regex: /(ชื่อ-?สกุล|ชื่อ-?นามสกุล|ชื่อสกุล|นามสกุล|ชื่อ|สกุล|ชื่อ-ชื่อสกุล)/i }
];

/** แปลงค่า cell ให้เป็นตัวเลขถ้าเป็นไปได้ ไม่งั้นคืน NaN */
function pToNum_(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  const s = String(v == null ? '' : v).trim();
  if (s === '') return NaN;
  return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/** คะแนนที่ใช้ได้ต้องเป็นตัวเลขในช่วง 1–5 */
function pIsValidScore_(n) { return typeof n === 'number' && isFinite(n) && n >= 1 && n <= 5; }

function pTrim_(v) { return String(v == null ? '' : v).trim(); }

function pMean_(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }

function pSdSample_(a) {
  if (a.length < 2) return 0;
  const m = pMean_(a);
  return Math.sqrt(a.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (a.length - 1));
}

function pRound2_(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

function pLevel_(m) {
  if (m >= 4.51) return 'มากที่สุด';
  if (m >= 3.51) return 'มาก';
  if (m >= 2.51) return 'ปานกลาง';
  if (m >= 1.51) return 'น้อย';
  return 'น้อยที่สุด';
}

/**
 * clean ชื่อไทย: รวมช่องว่างซ้ำ ตัดช่องว่างหัวท้าย ลบอักขระ zero-width
 * ไม่ตัดคำ ไม่แยกตัวอักษร เพื่อไม่ให้เกิดปัญหา "กชกร -> จ + ชกร"
 */
function pCleanThaiName_(s) {
  return String(s == null ? '' : s)
    .replace(/[​‌‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ดึงเลขชั้นปี 1–4 จากข้อความ เช่น "ชั้นปีที่ 2", "ปี 2", "2" */
function pNormalizeYear_(v) {
  const s = pTrim_(v);
  if (!s) return '';
  const m = s.match(/([1-4])/);
  return m ? m[1] : s;
}

function pIsEmail_(v) { return /@/.test(pTrim_(v)) && /\.[a-z]{2,}/i.test(pTrim_(v)); }

/**
 * สร้างข้อความย่อสำหรับหัวตารางรายคน: รหัสข้อ + ข้อความสั้น (ตัดด้วย …)
 * ตัดรหัสที่ซ้ำหน้าข้อความออกก่อน เพื่อไม่ให้ได้ "1.1 1.1 ..."
 */
function pShortText_(code, text, maxLen) {
  maxLen = maxLen || 28;
  let t = pTrim_(text);
  if (code) {
    const re = new RegExp('^' + code.split('.').join('\\.') + '[\\s\\.\\)]*');
    t = t.replace(re, '').trim();
  }
  if (t.length > maxLen) t = t.slice(0, maxLen).trim() + '…';
  return code ? (code + ' ' + t).trim() : t;
}

/** สถิติรายบุคคลจากอาร์เรย์คะแนน (นับเฉพาะค่า 1–5) — ใช้ค่าคำนวณจริง ไม่ใช้สูตร */
function pPersonStats_(scores) {
  const v = (scores || []).filter(pIsValidScore_);
  const m = pMean_(v);
  return { n: v.length, mean: pRound2_(m), sd: pRound2_(pSdSample_(v)), level: v.length ? pLevel_(m) : '' };
}

/** คำนวณ N/X/SD/ระดับ รายข้อ สำหรับผู้ตอบชุดย่อย (เช่น แยกรายชั้นปี) */
function pComputeItemStatsForRespondents_(items, respondents) {
  return (items || []).map((item, i) => {
    const vals = [];
    (respondents || []).forEach(p => { const v = p.scores ? p.scores[i] : undefined; if (pIsValidScore_(v)) vals.push(v); });
    const m = pMean_(vals);
    return {
      no: item.no, code: item.code, text: item.text, col: item.col,
      n: vals.length, mean: pRound2_(m), sd: pRound2_(pSdSample_(vals)), level: vals.length ? pLevel_(m) : ''
    };
  });
}

/** สถิติรวมของผู้ตอบชุดย่อย */
function pOverallStats_(respondents) {
  const all = [];
  (respondents || []).forEach(p => (p.scores || []).forEach(v => { if (pIsValidScore_(v)) all.push(v); }));
  const m = pMean_(all);
  return { n: all.length, respondents: (respondents || []).length, mean: pRound2_(m), sd: pRound2_(pSdSample_(all)), level: all.length ? pLevel_(m) : '' };
}

/** ข้อที่คะแนนต่ำสุด k ข้อ (เฉพาะข้อที่มีผู้ตอบ) เพื่อใช้เป็นข้อเสนอแนะการปรับปรุง */
function pLowestItems_(itemStats, k) {
  return (itemStats || []).filter(s => s.n > 0).slice().sort((a, b) => a.mean - b.mean).slice(0, k || 3);
}

/** ธีมข้อคิดเห็น (keyword-based) สำหรับ Comments_Themes */
const PARSER_COMMENT_THEMES = [
  { theme: 'การเรียนการสอน/เนื้อหา', regex: /(สอน|เนื้อหา|บรรยาย|อธิบาย|เข้าใจ|วิชา|ครู|อาจารย์)/ },
  { theme: 'เวลา/ตารางเวลา', regex: /(เวลา|ตาราง|นาน|เร็ว|ช้า|กระชั้น|พัก)/ },
  { theme: 'สถานที่/อุปกรณ์', regex: /(สถานที่|ห้อง|อุปกรณ์|เครื่อง|สัญญาณ|อากาศ|ร้อน|เสียง)/ },
  { theme: 'อาหาร/สวัสดิการ', regex: /(อาหาร|น้ำ|สวัสดิการ|ที่พัก|เครื่องดื่ม)/ },
  { theme: 'กิจกรรม/การฝึก', regex: /(กิจกรรม|ฝึก|เดินทาง|ภาคสนาม|ค่าย)/ },
  { theme: 'ชื่นชม/พึงพอใจ', regex: /(ดีมาก|ดี|ชอบ|ประทับใจ|ขอบคุณ|เยี่ยม|สนุก|พอใจ)/ }
];

/** ข้อคิดเห็นที่มีสาระ (ตัด "-", "ไม่มี", "N/A") ออก แต่ไม่ทิ้งข้อความจริง */
function pIsMeaningfulComment_(s) {
  const t = pTrim_(s).replace(/[\s\-\.]/g, '');
  if (!t) return false;
  if (/^(ไม่มี|ไม่มีค่ะ|ไม่มีครับ|ไม่มีข้อเสนอแนะ|ไม่มีความคิดเห็น|ไม่มีเพิ่มเติม|na|none)$/i.test(t)) return false;
  return true;
}

/** วิเคราะห์ข้อคิดเห็น: theme / จำนวน / ร้อยละ / ตัวอย่างข้อความ */
function pAnalyzeComments_(respondents) {
  const comments = (respondents || []).map(p => pTrim_(p.comment)).filter(pIsMeaningfulComment_);
  const total = comments.length;
  const buckets = {};
  comments.forEach(c => {
    let theme = 'อื่น ๆ';
    for (let i = 0; i < PARSER_COMMENT_THEMES.length; i++) {
      if (PARSER_COMMENT_THEMES[i].regex.test(c)) { theme = PARSER_COMMENT_THEMES[i].theme; break; }
    }
    (buckets[theme] = buckets[theme] || []).push(c);
  });
  const themes = Object.keys(buckets).map(t => ({
    theme: t,
    count: buckets[t].length,
    percent: total ? pRound2_(buckets[t].length * 100 / total) : 0,
    examples: buckets[t].slice(0, 2)
  })).sort((a, b) => b.count - a.count);
  return { total: total, themes: themes };
}

/** ดึงรหัสข้อ เช่น "1.1", "12" จากต้นข้อความหัวข้อ (ถ้ามี) */
function pItemCode_(header) {
  const m = pTrim_(header).match(/^(\d+(?:\.\d+)?)/);
  return m ? m[1] : '';
}

/**
 * จำแนกบทบาทของแต่ละคอลัมน์ โดยใช้ header (display) และตัวอย่างข้อมูล (values)
 * คืน array ของ { index, header, role }
 * role ที่เป็นไปได้: timestamp, email, comment, year, rank, id, seq, name, score, other
 */
function pClassifyColumns_(headerRow, dataRowsValues, dataRowsDisplay) {
  const nCols = headerRow.length;
  const cols = [];
  for (let c = 0; c < nCols; c++) {
    const header = pTrim_(headerRow[c]);
    let role = 'other';

    // 1) จำแนกจากหัวคอลัมน์ก่อน (เชื่อ header มากกว่าค่าในเซลล์)
    for (let i = 0; i < PARSER_HEADER_ROLES.length; i++) {
      if (header && PARSER_HEADER_ROLES[i].regex.test(header)) { role = PARSER_HEADER_ROLES[i].role; break; }
    }

    // 2) ถ้ายังไม่รู้บทบาท ดูจากค่าจริงในคอลัมน์ว่าเป็นคะแนน 1–5 หรือไม่
    if (role === 'other') {
      let nonEmpty = 0, validScore = 0, emailHit = 0;
      for (let r = 0; r < dataRowsValues.length; r++) {
        const disp = pTrim_(dataRowsDisplay[r][c]);
        if (disp === '') continue;
        nonEmpty++;
        if (pIsValidScore_(pToNum_(dataRowsValues[r][c]))) validScore++;
        if (pIsEmail_(disp)) emailHit++;
      }
      if (nonEmpty > 0 && emailHit / nonEmpty >= 0.6) role = 'email';
      else if (nonEmpty > 0 && validScore / nonEmpty >= 0.6) role = 'score';
    }

    cols.push({ index: c, header: header, role: role });
  }
  return cols;
}

/**
 * ประเมินว่าแถวใดคือ header ที่ดีที่สุด (0..maxScan) โดยลองใช้แต่ละแถวเป็น header
 * แล้ววัดว่าจำแนกได้กี่คอลัมน์คะแนน และมีผู้ตอบกี่คน
 * คืน { headerRowIndex, columns, quality } หรือ headerRowIndex = -1 ถ้าไม่พบ
 */
function pDetectHeader_(values, display) {
  const maxScan = Math.min(20, values.length);
  let best = { headerRowIndex: -1, columns: null, quality: -1 };
  for (let r = 0; r < maxScan; r++) {
    const headerRow = display[r] || [];
    const nonEmptyHeader = headerRow.filter(x => pTrim_(x) !== '').length;
    if (nonEmptyHeader < 2) continue;

    const dataV = values.slice(r + 1);
    const dataD = display.slice(r + 1);
    if (!dataV.length) continue;

    const cols = pClassifyColumns_(headerRow, dataV, dataD);
    const scoreCols = cols.filter(x => x.role === 'score');
    if (!scoreCols.length) continue;

    // นับผู้ตอบ: แถวที่มีคะแนนใช้ได้อย่างน้อย 1 ช่อง
    let respondents = 0;
    for (let i = 0; i < dataV.length; i++) {
      let has = false;
      for (let j = 0; j < scoreCols.length; j++) {
        if (pIsValidScore_(pToNum_(dataV[i][scoreCols[j].index]))) { has = true; break; }
      }
      if (has) respondents++;
    }
    if (!respondents) continue;

    const tokenHits = cols.filter(x => x.role !== 'other' && x.role !== 'score').length;
    const quality = respondents * scoreCols.length + tokenHits * 2;
    if (quality > best.quality) best = { headerRowIndex: r, columns: cols, quality: quality };
  }
  return best;
}

/**
 * แยกข้อมูลจากตารางแบบ matrix ทั้งชีต
 * @param {Array<Array>} values  ค่าดิบจาก getValues()
 * @param {Array<Array>} display ค่าที่แสดงจาก getDisplayValues()
 * @return {Object} ผลการแยก (found=false ถ้าไม่ใช่รูปแบบ matrix)
 */
function parseEvaluationMatrix_(values, display) {
  if (!values || !values.length) return { found: false, quality: -1 };
  const det = pDetectHeader_(values, display);
  if (det.headerRowIndex < 0) return { found: false, quality: -1 };

  const cols = det.columns;
  const headerIdx = det.headerRowIndex;
  const dataV = values.slice(headerIdx + 1);
  const dataD = display.slice(headerIdx + 1);

  const scoreCols = cols.filter(x => x.role === 'score');
  const nameCols = cols.filter(x => x.role === 'name');
  const idCol = cols.find(x => x.role === 'id');
  const seqCol = cols.find(x => x.role === 'seq');
  const emailCol = cols.find(x => x.role === 'email');
  const yearCol = cols.find(x => x.role === 'year');
  const rankCol = cols.find(x => x.role === 'rank'); // ใช้ก็ต่อเมื่อมีจริง ไม่สร้างเอง
  const commentCol = cols.find(x => x.role === 'comment');

  // items = หัวข้อประเมินรายข้อ (ข้อความจริงจากหัวคอลัมน์)
  const items = scoreCols.map((c, i) => {
    const code = pItemCode_(c.header);
    return { no: code || String(i + 1), code: code, text: c.header, col: c.index };
  });

  // respondents = ผู้ตอบรายคน
  const respondents = [];
  let invalidCount = 0;
  for (let r = 0; r < dataV.length; r++) {
    const scores = scoreCols.map(c => {
      const raw = dataV[r][c.index];
      const disp = pTrim_(dataD[r][c.index]);
      const n = pToNum_(raw);
      if (pIsValidScore_(n)) return n;
      // นับคะแนนนอกช่วง: มีค่าที่ไม่ว่าง ไม่ใช่ 0 และไม่ใช่ 1–5
      if (disp !== '' && !(isFinite(n) && n === 0)) invalidCount++;
      return null;
    });
    const validScores = scores.filter(pIsValidScore_);

    const nameRaw = nameCols.map(c => pTrim_(dataD[r][c.index])).filter(Boolean).join(' ');
    const name = pCleanThaiName_(nameRaw);
    const comment = commentCol ? pTrim_(dataD[r][commentCol.index]) : '';

    // ข้ามแถวว่างจริง ๆ (ไม่มีคะแนน ไม่มีชื่อ ไม่มีข้อคิดเห็น)
    if (!validScores.length && !name && !comment) continue;

    respondents.push({
      rowIndex: headerIdx + 1 + r + 1, // เลขแถวจริงในชีต (1-based)
      seq: seqCol ? pTrim_(dataD[r][seqCol.index]) : '',
      id: idCol ? pTrim_(dataD[r][idCol.index]) : '',
      name: name,
      email: emailCol ? pTrim_(dataD[r][emailCol.index]) : '',
      year: yearCol ? pNormalizeYear_(dataD[r][yearCol.index]) : '',
      rank: rankCol ? pTrim_(dataD[r][rankCol.index]) : '',
      comment: comment,
      scores: scores,
      validCount: validScores.length
    });
  }

  // itemStats รายข้อ
  const itemStats = items.map((item, i) => {
    const vals = [];
    respondents.forEach(p => { if (pIsValidScore_(p.scores[i])) vals.push(p.scores[i]); });
    const m = pMean_(vals);
    return {
      no: item.no, code: item.code, text: item.text, col: item.col,
      n: vals.length, mean: pRound2_(m), sd: pRound2_(pSdSample_(vals)), level: pLevel_(m)
    };
  });

  // ScoreRows รายคน (aligned กับคอลัมน์คะแนน)
  const scoreRows = respondents.map((p, i) => ({
    row: p.rowIndex,
    label: p.name || p.id || p.seq || ('Row ' + (i + 1)),
    scores: p.scores.map(v => (pIsValidScore_(v) ? v : ''))
  }));

  // ค่าเฉลี่ยรวม
  const all = [];
  respondents.forEach(p => p.scores.forEach(v => { if (pIsValidScore_(v)) all.push(v); }));
  const overallMean = pMean_(all);
  const overallSd = pSdSample_(all);

  // duplicate respondent (key: id > email > name)
  const seen = {};
  respondents.forEach(p => {
    const key = (p.id || p.email || p.name || '').toLowerCase().trim();
    if (!key) return;
    (seen[key] = seen[key] || []).push(p.rowIndex);
  });
  const duplicates = Object.keys(seen)
    .filter(k => seen[k].length > 1)
    .map(k => ({ key: k, count: seen[k].length, rows: seen[k] }));

  // สรุปชั้นปี
  const yearMap = {};
  respondents.forEach(p => { const y = p.year; if (y) yearMap[y] = (yearMap[y] || 0) + 1; });
  const years = Object.keys(yearMap).sort().map(y => ({ year: y, count: yearMap[y] }));

  return {
    found: true,
    quality: det.quality,
    headerRowIndex: headerIdx,
    columns: cols,
    hasRankColumn: !!rankCol,
    hasCommentColumn: !!commentCol,
    items: items,
    itemStats: itemStats,
    respondents: respondents,
    respondentCount: respondents.length,
    scoreRows: scoreRows,
    overallMean: overallMean,
    overallSd: overallSd,
    invalidCount: invalidCount,
    duplicates: duplicates,
    years: years
  };
}

/**
 * QA Gate รวม (Phase 6): ตัดสิน PASS/REVIEW จากผลวิเคราะห์ + กลุ่มรายงาน
 * failures = ปัญหาที่ต้องแก้ก่อนใช้จริง (บังคับ REVIEW)
 * warnings = ข้อควรตรวจ แต่ไม่บล็อก (เช่น บางชั้นปีไม่มีข้อมูล, ผู้ตอบซ้ำ)
 */
function pRunQaGate_(a, groups) {
  a = a || {};
  groups = groups || [];
  const items = a.items || [];
  const respondents = a.respondents || [];
  const failures = [];
  const warnings = [];

  if (!items.length) failures.push('ไม่พบข้อประเมิน');
  if (items.length && !items.every(it => pTrim_(it.text).length >= 3)) failures.push('มีหัวข้อประเมินที่ไม่ใช่ข้อความคำถามจริง (เช่น Q1/คอลัมน์_4)');
  if (!respondents.length) failures.push('ไม่พบผู้ตอบรายบุคคล');
  if ((a.invalidCount || 0) > 0) failures.push('มีคะแนนนอกช่วง 1–5 จำนวน ' + a.invalidCount + ' ค่า');
  if (groups.length && groups.length !== 5) failures.push('กลุ่มรายงานไม่ครบ 5 กลุ่ม');

  if (a.parseMode && a.parseMode !== 'wide') warnings.push('อ่านข้อมูลด้วยโหมด legacy — ควรตรวจไฟล์ต้นฉบับว่าหัวคอลัมน์ข้อประเมินครบ');
  if ((a.duplicates || []).length > 0) warnings.push('พบผู้ตอบซ้ำ ' + a.duplicates.length + ' คีย์');
  // รองรับทั้ง group ภายใน (g.def.year) และ groupsMeta ที่ส่งจาก processOneFile_ (g.year)
  const groupYear = g => (g.def ? g.def.year : g.year);
  const groupLabel = g => (g.def ? g.def.label : g.label);
  const emptyYears = groups.filter(g => groupYear(g) !== null && groupYear(g) !== undefined && !g.hasData).map(groupLabel);
  if (emptyYears.length) warnings.push('ชั้นปีไม่มีข้อมูล: ' + emptyYears.join(', ') + ' (สร้างรายงานเปล่าไว้แล้ว)');

  return { status: failures.length ? 'REVIEW' : 'PASS', failures: failures, warnings: warnings };
}

// รองรับการ import ใน Node เพื่อทดสอบ (Apps Script ไม่มี module จึงข้ามบรรทัดนี้)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseEvaluationMatrix_: parseEvaluationMatrix_,
    pClassifyColumns_: pClassifyColumns_,
    pDetectHeader_: pDetectHeader_,
    pCleanThaiName_: pCleanThaiName_,
    pNormalizeYear_: pNormalizeYear_,
    pIsValidScore_: pIsValidScore_,
    pToNum_: pToNum_,
    pShortText_: pShortText_,
    pPersonStats_: pPersonStats_,
    pComputeItemStatsForRespondents_: pComputeItemStatsForRespondents_,
    pOverallStats_: pOverallStats_,
    pLowestItems_: pLowestItems_,
    pAnalyzeComments_: pAnalyzeComments_,
    pIsMeaningfulComment_: pIsMeaningfulComment_,
    pRunQaGate_: pRunQaGate_
  };
}
