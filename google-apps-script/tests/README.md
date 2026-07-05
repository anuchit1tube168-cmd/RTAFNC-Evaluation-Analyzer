# Parser v5 — Node tests

เทสต์ pure logic ของ `Parser_v5.gs` (parser แบบ matrix, สถิติรายข้อ/รายคน,
comment themes, QA gate) รันนอก Google Apps Script ได้ เพราะฟังก์ชันเหล่านี้
รับ 2D array ล้วน ไม่ผูก DriveApp/SpreadsheetApp

Apps Script ไม่มี `module` จึงมองข้ามบรรทัด `module.exports` ท้ายไฟล์
ส่วน Node ใช้ export นั้นเพื่อ `require('../Parser_v5.gs')`

## วิธีรัน

```bash
cd google-apps-script
node tests/run.js          # รันทุกไฟล์
node tests/parser.test.js  # รันทีละไฟล์
```

## ครอบคลุมอะไร

- `parser.test.js` — จับ header, แยกคอลัมน์คะแนน (ไม่นับ เลขที่/ชั้นปี/รหัส), ข้อความคำถามจริง, invalid/duplicate/ชั้นปี, clean ชื่อ, header ไม่อยู่แถวแรก, fallback
- `wiring.test.js` — mapping ของ `analyzeSheet_` ให้ shape ตรงกับ write* functions
- `phase2.test.js` — `pShortText_`, `pPersonStats_`, การสร้างแถว Individual_All_Items
- `phase345.test.js` — สถิติรายชั้นปี, กลุ่มว่าง, ข้อเสนอแนะจากข้อต่ำสุด, comment themes
- `groups.test.js` — end-to-end การแบ่ง 5 กลุ่ม + QA รายชั้นปี + PDF ครบ
- `qagate.test.js` — `pRunQaGate_` PASS/REVIEW (ทั้ง group shape ภายในและ flat)
- `selftest.test.js` — ตรงกับ `selfTest_()` ใน Code.gs (`?action=selftest`)

## หมายเหตุ

เทสต์เหล่านี้ยืนยัน "logic" เท่านั้น การทำงานจริงบน Apps Script (Drive, Sheets,
PDF export) ต้อง deploy แล้วทดสอบกับไฟล์จริง และเทียบ `docs/GOLDEN_EXAMPLES.md`
