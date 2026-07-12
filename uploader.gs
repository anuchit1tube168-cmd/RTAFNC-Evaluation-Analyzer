/**
 * RTAFNC Evaluation — Drive Uploader v2
 * รับไฟล์ Excel (base64) + HTML รายงาน จากหน้าเว็บ แล้วเก็บเข้า Drive
 * โครงโฟลเดอร์:  [PARENT] / ปีการศึกษา {ปี} / {หมวด-ฝ่าย}
 * ปลอดภัย: สร้างอย่างเดียว ไม่ลบ ไม่เขียนทับ (ชื่อซ้ำ = เติม timestamp)
 *
 * ติดตั้ง: Deploy > Web app > Execute as: Me / Who has access: Anyone
 */

var PARENT_FOLDER_ID = '1b9213ym4rhJjs9IoZUV9AKJrBpE2kCoR';  // งานประเมินจากเว็บ_ปีการศึกษา_2568
var VERSION = '2.0';

/** ทดสอบการเชื่อมต่อ */
function doGet() {
  var out = { ok: true, service: 'rtafnc-uploader', version: VERSION };
  try {
    var f = DriveApp.getFolderById(PARENT_FOLDER_ID);
    out.folder = f.getName();
    out.folderUrl = f.getUrl();
  } catch (e) {
    out.ok = false;
    out.error = 'เข้าถึงโฟลเดอร์ปลายทางไม่ได้: ' + e.message;
  }
  return json(out);
}

/** รับไฟล์จากหน้าเว็บ */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('ไม่มีข้อมูลส่งมา');
    var req = JSON.parse(e.postData.contents);

    var filename = sanitize(req.filename || 'ผลประเมิน.xlsx');
    var year     = String(req.year || '').replace(/\D/g, '') || 'ไม่ระบุปี';
    var category = sanitize(req.category || '');
    var makePdf  = req.makePdf !== false;
    var html     = req.reportHtml || '';

    if (!req.base64) throw new Error('ไม่พบไฟล์ Excel');

    var parent = DriveApp.getFolderById(PARENT_FOLDER_ID);
    var yearFolder = getOrCreate(parent, 'ปีการศึกษา ' + year);
    var target = category ? getOrCreate(yearFolder, category) : yearFolder;

    var out = { ok: true, folderUrl: target.getUrl(), folderName: target.getName() };

    var xlsxBlob = Utilities.newBlob(
      Utilities.base64Decode(req.base64),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      uniqueName(target, filename)
    );
    var xlsxFile = target.createFile(xlsxBlob);
    out.xlsxUrl = xlsxFile.getUrl();
    out.xlsxName = xlsxFile.getName();

    if (makePdf && html) {
      try {
        var pdfName = filename.replace(/\.xlsx?$/i, '') + '.pdf';
        var pdfBlob = Utilities.newBlob(html, 'text/html', 'tmp.html')
          .getAs('application/pdf')
          .setName(uniqueName(target, pdfName));
        var pdfFile = target.createFile(pdfBlob);
        out.pdfUrl = pdfFile.getUrl();
        out.pdfName = pdfFile.getName();
      } catch (pe) {
        out.pdfWarning = 'สร้าง PDF ไม่สำเร็จ: ' + pe.message + ' (Excel บันทึกแล้ว)';
      }
    }

    return json(out);

  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

/** หาโฟลเดอร์ ถ้าไม่มีให้สร้าง (ไม่แตะของเดิม) */
function getOrCreate(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** ชื่อซ้ำ = เติม timestamp ไม่เขียนทับของเดิม */
function uniqueName(folder, name) {
  if (!folder.getFilesByName(name).hasNext()) return name;
  var stamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'ddMMyy_HHmm');
  var dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) + '_' + stamp + name.slice(dot) : name + '_' + stamp;
}

function sanitize(s) {
  return String(s).replace(/[\/\\:*?"<>|]/g, '_').trim().slice(0, 120);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
