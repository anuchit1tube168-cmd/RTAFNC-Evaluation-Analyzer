/* ============================================================
   RTAFNC Eval Engine — สมองของระบบแปลผลการประเมิน ผปค.วพอ.พอ.
   กติกาตาม design doc: STDEVP · นับเฉพาะ leaf item · แปลผล 5 ระดับ
   ไฟล์นี้ใช้ได้ทั้ง Node (ทดสอบ) และเบราว์เซอร์ (ฝังใน index.html)
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvalEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── เกณฑ์แปลผล 5 ระดับ (แก้ที่เดียว) ──
  var INTERP = [
    [4.5, 'มากที่สุด'], [3.5, 'มาก'], [2.5, 'ปานกลาง'], [1.5, 'น้อย'], [0, 'น้อยที่สุด']
  ];
  function interp(x) {
    if (x == null || isNaN(x)) return '';
    for (var i = 0; i < INTERP.length; i++) if (x >= INTERP[i][0]) return INTERP[i][1];
    return INTERP[INTERP.length - 1][1];
  }
  // ── สถิติ: STDEVP (ประชากร) ตาม design doc ──
  function mean(a) { a = a.filter(isNum); return a.length ? a.reduce(s, 0) / a.length : null; }
  function stdevp(a) {
    a = a.filter(isNum); if (!a.length) return null;
    var m = a.reduce(s, 0) / a.length;
    return Math.sqrt(a.reduce(function (t, v) { return t + (v - m) * (v - m); }, 0) / a.length);
  }
  function s(t, v) { return t + v; }
  function isNum(v) { return typeof v === 'number' && !isNaN(v); }

  // ── จำแนกชนิดคอลัมน์จากข้อมูลจริง ──
  var NAME_RE = /นพอ|นาย|นางสาว|น\.ส\.|นตท|จ\.อ\.|พ\.อ\.อ/;
  function classifyCol(vals, total) {
    if (!vals.length) return 'empty';
    var str = vals.map(String);
    if (frac(str, function (v) { return /@/.test(v); }) > 0.8) return 'email';
    if (frac(str, function (v) { return NAME_RE.test(v); }) > 0.5) return 'name';
    if (frac(str, function (v) { return /25\d\d|20\d\d|AM|PM|\d:\d\d/.test(v); }) > 0.5) return 'timestamp';
    var nums = vals.filter(isNum);
    if (nums.length / vals.length > 0.8) {
      if (nums.every(function (v) { return v >= 1 && v <= 5; })) {
        // แยก int score กับ derived (avg/sd เดิม): ทศนิยม > 30% = derived
        var fracDec = nums.filter(function (v) { return v % 1 !== 0; }).length / nums.length;
        if (fracDec > 0.3) return 'derived';
        // เลขที่: จำนวนเต็มเรียงเพิ่มและครอบคลุมแถวส่วนใหญ่ — เช็คภายหลังด้วยตำแหน่ง
        return 'score';
      }
      var ints = nums.every(function (v) { return v % 1 === 0; });
      var asc = nums.every(function (v, i) { return i === 0 || v >= nums[i - 1]; });
      if (ints && asc && nums.length >= total * 0.7) return 'no';
      return 'derived';
    }
    if (frac(str, function (v) { return v.trim().length > 8 && v.trim() !== '-'; }) > 0.05) return 'comment';
    return 'other';
  }
  function frac(arr, f) { return arr.filter(f).length / arr.length; }

  // แถวข้อมูล = มีชื่อ (คำนำหน้า) + คะแนน int 1–5 อย่างน้อย 3 ช่อง
  function looksDataRow(r) {
    if (!r || r.length < 3) return false;
    var hasName = r.some(function (v) { return typeof v === 'string' && NAME_RE.test(v); });
    var sc = r.filter(function (v) { return isNum(v) && v >= 1 && v <= 5 && v % 1 === 0; }).length;
    return hasName && sc >= 3;
  }

  // header เหนือแถวข้อมูลแรก (ไล่ขึ้นไปไม่เกิน 4 แถว)
  function headerFor(rows, firstDataIdx, col) {
    for (var r = firstDataIdx - 1; r >= 0 && r >= firstDataIdx - 4; r--) {
      var v = rows[r] && rows[r][col];
      if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
    return null;
  }

  // ── leaf item: หัวข้อ x.y ที่มีลูก x.y.z ไม่นับซ้ำ ──
  // codes = header ของคอลัมน์คะแนน เช่น ["1.1","6.1","6.1.1",...] หรือ ["ข้อ1","2",...]
  function markLeaf(codes) {
    var norm = codes.map(function (c) {
      var m = String(c).match(/(\d+(?:\.\d+)*)/);   // ดึงรหัสตัวเลขจาก header
      return m ? m[1] : null;
    });
    return norm.map(function (c, i) {
      if (!c) return true;                            // header ไม่มีเลข → นับ
      var isParent = norm.some(function (o, j) {
        return j !== i && o && o.indexOf(c + '.') === 0;
      });
      return !isParent;                               // มีลูก = parent = ไม่นับ
    });
  }
  // ด้าน (domain) จากเลขตัวแรกของรหัสข้อ
  function domainOf(code) {
    var m = String(code).match(/^(\d+)/);
    return m ? m[1] : '';
  }

  // ── ตรวจชั้นปีจากชื่อ sheet / ชื่อไฟล์ ──
  function detectYearLabel(text) {
    var m = String(text).match(/ชั้นปีที?่?\s*(\d)/) || String(text).match(/ปี\s*(\d)\b/);
    return m ? 'ชั้นปีที่ ' + m[1] : null;
  }

  /* ============ parse: workbook (SheetJS) → dataset ============ */
  // XLSXlib = ตัว XLSX (inject เพื่อใช้ได้ทั้ง node/browser)
  function parseWorkbook(XLSXlib, wb, fileName) {
    var groups = [];   // [{label, students:[{no,name,scores[],comment}], questions[]}]
    wb.SheetNames.forEach(function (sn) {
      var rows = XLSXlib.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
      var dataIdx = [];
      rows.forEach(function (r, i) { if (looksDataRow(r)) dataIdx.push(i); });
      if (dataIdx.length < 2) return;                 // sheet ไม่ใช่ตารางคะแนน
      var dataRows = dataIdx.map(function (i) { return rows[i]; });
      var nCols = Math.max.apply(null, dataRows.map(function (r) { return r.length; }));
      var roles = [];
      for (var c = 0; c < nCols; c++) {
        var vals = dataRows.map(function (r) { return r[c]; })
          .filter(function (v) { return v !== null && v !== ''; });
        roles.push(classifyCol(vals, dataRows.length));
      }
      // คอลัมน์แรกที่เป็น int เรียง → เลขที่ (กัน score หลงเป็น no)
      var scoreCols = [], noCol = -1, nameCol = roles.indexOf('name');
      // ── ตรวจคอลัมน์ "ชั้นปี" จาก header (ตระกูล B: ชั้นปีอยู่ในคอลัมน์) ──
      var yearCol = -1, firstHdr = dataIdx[0];
      for (var yc = 0; yc < nCols; yc++) {
        var h = headerFor(rows, firstHdr, yc);
        if (h && /ชั้นปี|ชั้นปีที่/.test(String(h))) { yearCol = yc; break; }
      }
      roles.forEach(function (ro, c) {
        if (c === yearCol) return;                     // ชั้นปี ไม่ใช่คะแนน
        if (ro === 'no' && noCol < 0) noCol = c;
        if (ro === 'score') scoreCols.push(c);
      });
      // ถ้าคอลัมน์ score คอลัมน์แรกอยู่ก่อนชื่อ → จริงๆ คือเลขที่
      if (noCol < 0 && scoreCols.length && nameCol >= 0 && scoreCols[0] < nameCol) {
        noCol = scoreCols.shift();
      }
      if (!scoreCols.length) return;
      // คอลัมน์ name อาจเป็นแค่คำนำหน้า (นพอ. ซ้ำทุกแถว) → ชื่อจริงอยู่คอลัมน์ถัดไป
      var fullNameCol = -1;
      if (nameCol >= 0) {
        var uniq = {};
        dataRows.forEach(function (r) { uniq[String(r[nameCol] || '')] = 1; });
        var uniqRatio = Object.keys(uniq).length / dataRows.length;
        if (uniqRatio < 0.3) {                        // ซ้ำมาก = คำนำหน้า
          for (var nc = nameCol + 1; nc < Math.min(nameCol + 3, nCols); nc++) {
            var strs = dataRows.map(function (r) { return r[nc]; })
              .filter(function (v) { return typeof v === 'string' && v.trim().length > 2; });
            if (strs.length / dataRows.length > 0.7) { fullNameCol = nc; break; }
          }
        }
      }
      var cmCols = [];
      roles.forEach(function (ro, c) {
        if (ro === 'comment' && c !== nameCol && c !== fullNameCol) cmCols.push(c);
      });

      var firstIdx = dataIdx[0];
      var qHeaders = scoreCols.map(function (c, i) {
        return headerFor(rows, firstIdx, c) || String(i + 1);
      });
      var students = dataRows.map(function (r, i) {
        return {
          no: noCol >= 0 ? r[noCol] : i + 1,
          name: (nameCol >= 0 ? String(r[nameCol] || '').trim() : '') +
                (fullNameCol >= 0 ? ' ' + String(r[fullNameCol] || '').trim() : ''),
          yearRaw: yearCol >= 0 ? r[yearCol] : null,
          scores: scoreCols.map(function (c) { return isNum(r[c]) ? r[c] : null; }),
          comment: cmCols.map(function (c) { return r[c]; })
            .filter(function (v) { return v && String(v).trim() && String(v).trim() !== '-'; })
            .join(' | ')
        };
      });
      if (yearCol >= 0) {
        // ตระกูล B: แตกเป็น group รายชั้นปีจากค่าในคอลัมน์
        var byYear = {};
        students.forEach(function (s) {
          var y = String(s.yearRaw == null ? 'ไม่ระบุ' : s.yearRaw).replace(/\D/g, '') || 'ไม่ระบุ';
          (byYear[y] = byYear[y] || []).push(s);
        });
        Object.keys(byYear).sort(function (a, b) { return b - a; }).forEach(function (y) {
          groups.push({ label: y === 'ไม่ระบุ' ? 'ไม่ระบุชั้นปี' : 'ชั้นปีที่ ' + y,
            sheet: sn, questions: qHeaders, students: byYear[y] });
        });
      } else {
        groups.push({
          label: detectYearLabel(sn) || sn,
          sheet: sn, questions: qHeaders, students: students
        });
      }
    });
    // ตัดกลุ่มซ้ำ: sheet "รวม" ที่เป็นผลรวมของ sheet ชั้นปี (คนซ้ำชื่อ) → เก็บเฉพาะชั้นปี
    var yearGroups = groups.filter(function (g) { return /ชั้นปีที่ \d/.test(g.label); });
    if (yearGroups.length >= 2) {
      var yearNames = {};
      yearGroups.forEach(function (g) { g.students.forEach(function (st) { yearNames[st.name] = 1; }); });
      groups = groups.filter(function (g) {
        if (/ชั้นปีที่ \d/.test(g.label)) return true;
        var dup = g.students.filter(function (st) { return yearNames[st.name]; }).length;
        return dup / g.students.length < 0.7;         // ซ้ำเกิน 70% = sheet รวม → ตัด
      });
    }
    return { fileName: fileName, groups: groups };
  }

  /* ============ compute: dataset → ผลวิเคราะห์ครบ ============ */
  function compute(ds) {
    var all = { label: 'รวมทุกชั้นปี', students: [], questions: null };
    // ถ้ามี sheet แยกชั้นปี ≥2 → total นับเฉพาะชั้นปี (กัน sheet "รวม" ซ้ำ)
    var yearOnly = ds.groups.filter(function (g) { return /ชั้นปีที่ \d/.test(g.label); });
    var srcGroups = yearOnly.length >= 2 ? yearOnly : ds.groups;
    srcGroups.forEach(function (g) {
      if (!all.questions || g.questions.length > all.questions.length) all.questions = g.questions;
    });
    // รวมเฉพาะกลุ่มที่จำนวนข้อเท่ากับชุดหลัก
    srcGroups.forEach(function (g) {
      if (g.questions.length === all.questions.length)
        all.students = all.students.concat(g.students.map(function (st) {
          return Object.assign({ group: g.label }, st);
        }));
    });
    var leaf = markLeaf(all.questions);
    function statsOf(students) {
      var nQ = all.questions.length;
      var perQ = [];
      for (var q = 0; q < nQ; q++) {
        var col = students.map(function (st) { return st.scores[q]; });
        perQ.push({ code: all.questions[q], leaf: leaf[q],
          mean: mean(col), sd: stdevp(col) });
      }
      var leafMeansByStudent = students.map(function (st) {
        return mean(st.scores.filter(function (v, i) { return leaf[i]; }));
      });
      // ค่าเฉลี่ยรวม = เฉลี่ยของค่าเฉลี่ยรายข้อ (เฉพาะ leaf) — ตาม design
      var leafQ = perQ.filter(function (p) { return p.leaf && p.mean != null; });
      var overall = mean(leafQ.map(function (p) { return p.mean; }));
      var overallSD = stdevp(flatten(students.map(function (st) {
        return st.scores.filter(function (v, i) { return leaf[i]; });
      })));
      // รายด้าน: เฉพาะเมื่อรหัสข้อส่วนใหญ่มีลำดับชั้น (เช่น 1.1, 6.1.1)
      // ถ้า header เป็นเลขเดี่ยว (1,2,...44) การแยกด้านไม่มีความหมาย → ข้าม
      var hierarchical = perQ.filter(function (p) {
        return /\d+\.\d+/.test(String(p.code));
      }).length / perQ.length > 0.5;
      var domains = {};
      if (hierarchical) perQ.forEach(function (p) {
        if (!p.leaf || p.mean == null) return;
        var d = domainOf(p.code); if (!d) return;
        (domains[d] = domains[d] || []).push(p);
      });
      var domainStats = Object.keys(domains).sort(function (a, b) { return a - b; })
        .map(function (d) {
          var m = mean(domains[d].map(function (p) { return p.mean; }));
          return { domain: d, mean: m, interp: interp(m),
            sd: stdevp(domains[d].map(function (p) { return p.mean; })),
            items: domains[d] };
        });
      return { n: students.length, perQ: perQ, overall: overall, overallSD: overallSD,
        interp: interp(overall), domains: domainStats,
        perStudent: students.map(function (st, i) {
          return { no: st.no, name: st.name, group: st.group || '',
            mean: leafMeansByStudent[i],
            sd: stdevp(st.scores.filter(function (v, j) { return leaf[j]; })),
            interp: interp(leafMeansByStudent[i]), comment: st.comment };
        }) };
    }
    var result = { fileName: ds.fileName, questions: all.questions, leaf: leaf,
      total: statsOf(all.students), byGroup: [] };
    if (ds.groups.length > 1) {
      ds.groups.forEach(function (g) {
        if (g.questions.length !== all.questions.length) return;
        result.byGroup.push(Object.assign({ label: g.label }, statsOf(g.students)));
      });
    }
    // ความเห็น: รวบรวมจากทุก sheet (บาง sheet เช่น "รวม" มีคอลัมน์ความเห็นที่ sheet ชั้นปีไม่มี)
    var seen = {};
    result.comments = [];
    ds.groups.forEach(function (g) {
      g.students.forEach(function (st) {
        if (!st.comment) return;
        var key = st.name + '::' + st.comment;
        if (seen[key]) return;
        seen[key] = 1;
        result.comments.push({ name: st.name, group: g.label, text: st.comment });
      });
    });
    return result;
  }
  function flatten(a) { return a.reduce(function (t, x) { return t.concat(x); }, []); }

  /* ============ export: result → AOA (array-of-arrays) ต่อ sheet ============ */
  function fx(v) { return v == null ? '' : Math.round(v * 100) / 100; }
  function buildExportAOA(r, meta) {
    meta = meta || {};
    var title = meta.title || r.fileName || 'ผลการประเมิน';
    var out = {};

    // ── sheet สรุป ──
    var sum = [
      ['ผลการประเมิน ' + title],
      ['ปีการศึกษา ' + (meta.year || '-') + '  ประมวลผลเมื่อ ' + new Date().toLocaleDateString('th-TH')],
      [],
      ['รายการ', 'ค่า', 'การแปลผล'],
      ['จำนวนผู้ประเมิน (รวม)', r.total.n, ''],
      ['จำนวนข้อคำถาม (นับเฉพาะข้อย่อย)', r.leaf.filter(Boolean).length + ' / ' + r.questions.length, ''],
      ['ค่าเฉลี่ยรวม (x̄)', fx(r.total.overall), r.total.interp],
      ['ส่วนเบี่ยงเบนมาตรฐานรวม (S.D.)', fx(r.total.overallSD), '']
    ];
    if (r.byGroup.length) {
      sum.push([], ['แยกตามชั้นปี'], ['กลุ่ม', 'จำนวน', 'x̄', 'S.D.', 'การแปลผล']);
      r.byGroup.forEach(function (g) {
        sum.push([g.label, g.n, fx(g.overall), fx(g.overallSD), g.interp]);
      });
    }
    sum.push([], ['เกณฑ์การแปลผล'],
      ['4.50 – 5.00', 'มากที่สุด'], ['3.50 – 4.49', 'มาก'], ['2.50 – 3.49', 'ปานกลาง'],
      ['1.50 – 2.49', 'น้อย'], ['1.00 – 1.49', 'น้อยที่สุด']);
    out['สรุป'] = sum;

    // ── sheet รายข้อ (รวม + แยกชั้นปีเป็นคอลัมน์) ──
    var hdr = ['ข้อ', 'รายการประเมิน', 'x̄', 'S.D.', 'การแปลผล'];
    r.byGroup.forEach(function (g) { hdr.push('x̄ ' + g.label); });
    var perQ = [hdr];
    r.total.perQ.forEach(function (p, i) {
      if (!p.leaf) return;                              // แสดงเฉพาะข้อย่อยที่นับจริง
      var row = [p.code, meta.questionText && meta.questionText[i] || '',
                 fx(p.mean), fx(p.sd), interp(p.mean)];
      r.byGroup.forEach(function (g) { row.push(fx(g.perQ[i] && g.perQ[i].mean)); });
      perQ.push(row);
    });
    perQ.push([]);
    var lastRow = ['รวม', 'ค่าเฉลี่ยรวมทั้งฉบับ', fx(r.total.overall), fx(r.total.overallSD), r.total.interp];
    r.byGroup.forEach(function (g) { lastRow.push(fx(g.overall)); });
    perQ.push(lastRow);
    out['รายข้อ'] = perQ;

    // ── sheet รายบุคคล ──
    var ps = [['เลขที่', 'ชื่อ-สกุล', 'กลุ่ม', 'x̄', 'S.D.', 'การแปลผล']];
    r.total.perStudent.forEach(function (p) {
      ps.push([p.no, p.name, p.group, fx(p.mean), fx(p.sd), p.interp]);
    });
    out['รายบุคคล'] = ps;

    // ── sheet ความเห็น ──
    if (r.comments.length) {
      var cm = [['ชื่อ', 'กลุ่ม', 'ข้อคิดเห็น/ข้อเสนอแนะ']];
      r.comments.forEach(function (c) { cm.push([c.name, c.group, c.text]); });
      out['ความเห็น'] = cm;
    }
    return out;
  }

  /* ── detectFormat: เดาตระกูล format จากลักษณะไฟล์จริง (ไม่พึ่งชื่อไฟล์อย่างเดียว) ──
   * คืน { family, confidence, reason } เพื่อเลือก template ให้ถูก
   * ออกแบบให้ "เดาแล้วให้คนยืนยัน" — ถ้า confidence ต่ำ ควรถามผู้ใช้
   * เพิ่มตระกูลใหม่: เพิ่ม rule ในอาเรย์ RULES (เรียงจากเฉพาะเจาะจง→ทั่วไป) */
  function detectFormat(ds, fileName) {
    var fn = (fileName || '').toLowerCase();
    var codes = (ds.groups[0] && ds.groups[0].questions) || [];
    var nQ = codes.length;
    var hasNested = codes.some(function (c) {
      return codes.some(function (o) { return o !== c && String(o).indexOf(c + '.') === 0; });
    });
    var hasYear = ds.groups.length > 1;

    var RULES = [
      { family: 'tqf-activity',
        test: function () {
          // กิจกรรม-รายด้าน TQF: มีข้อซ้อนชั้น (6.1/6.1.1) หรือชื่อไฟล์บอกกิจกรรมกลุ่มนี้
          return hasNested ||
            /นภาภิบาล|เจตคติ|ศิลปวัฒนธรรม|จิตอาสา|เดินทางไกล|สร้างสรรค|คุณลักษณะ/.test(fn);
        },
        reason: 'พบข้อแบบซ้อนชั้น (เช่น 6.1/6.1.1) หรือชื่อกิจกรรมกลุ่ม TQF → รายงานแบบ 8 ด้าน' },

      { family: 'advisor',
        test: function () { return /ที่ปรึกษา|advisor/.test(fn); },
        reason: 'ชื่อไฟล์ระบุระบบอาจารย์ที่ปรึกษา → รายงานแยกภาคเรียน' },

      { family: 'instructor',
        test: function () { return /ผู้สอน|ครูฝึก|การสอน|รายบุคคล.*ฝึก/.test(fn); },
        reason: 'ชื่อไฟล์ระบุประเมินผู้สอน/ครูฝึกรายบุคคล' },

      { family: 'lo-competency',
        test: function () { return /สมรรถนะ|ผลการเรียนรู้|มคอ|\bLO\b|PLO|CLO/.test(fn); },
        reason: 'ชื่อไฟล์ระบุสมรรถนะตามผลการเรียนรู้ (LO/มคอ.)' },

      { family: 'satisfaction',
        test: function () { return /พึงพอใจ|ความพึงพอใจ/.test(fn) || (nQ <= 10 && !hasNested); },
        reason: 'แบบความพึงพอใจ (ข้อไม่ซ้อนชั้น จำนวนข้อน้อย)' }
    ];

    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].test()) {
        return { family: RULES[i].family, confidence: (i === 0 && hasNested) ? 'high' : 'medium',
                 reason: RULES[i].reason, nQ: nQ, hasNested: hasNested, hasYear: hasYear };
      }
    }
    return { family: 'generic', confidence: 'low',
             reason: 'จำแนกตระกูลไม่ได้ชัด → ใช้รายงานพื้นฐาน (ควรให้ผู้ใช้ยืนยัน)',
             nQ: nQ, hasNested: hasNested, hasYear: hasYear };
  }

  return { parseWorkbook: parseWorkbook, compute: compute, interp: interp,
           stdevp: stdevp, mean: mean, markLeaf: markLeaf, INTERP: INTERP,
           buildExportAOA: buildExportAOA, detectFormat: detectFormat };
});
