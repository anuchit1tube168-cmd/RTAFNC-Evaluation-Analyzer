# V6 Deploy Test Commands

ใช้หลังจาก GitHub Actions deploy Apps Script แล้วเท่านั้น

## 1) Health Check

เปิด URL นี้:

```text
https://script.google.com/macros/s/AKfycbz3Uq3oJtOu95URz2HfcgdPnoRYPdaJfFoRi1Eh9-9sRkTx-_iEODKFNN903N0BcVQq/exec?action=health
```

ต้องเห็น:

```json
{
  "ok": true,
  "version": "v6-source-driven-reports",
  "parser": "wide-matrix-v1",
  "rule": "per-class reports only when class-year source exists"
}
```

ถ้ายังเห็น `v5-per-class-reports` แปลว่ายังไม่ redeploy สำเร็จ

---

## 2) Selftest

เปิด URL นี้:

```text
https://script.google.com/macros/s/AKfycbz3Uq3oJtOu95URz2HfcgdPnoRYPdaJfFoRi1Eh9-9sRkTx-_iEODKFNN903N0BcVQq/exec?action=selftest
```

ต้องเห็น:

```json
{
  "ok": true,
  "action": "selftest",
  "version": "v6-source-driven-reports",
  "allPass": true
}
```

Selftest ต้องผ่านเรื่องต่อไปนี้:

```text
- ใช้ข้อความคำถามจริง
- ชื่อไทยไม่แตก
- สร้างรายงานเฉพาะปีที่มี source
- ไม่สร้างปี 3/4 เอง
- Q1/Q2 ต้องเป็น REVIEW
```

---

## 3) Peek File แบบ read-only

เปิด URL นี้:

```text
https://script.google.com/macros/s/AKfycbz3Uq3oJtOu95URz2HfcgdPnoRYPdaJfFoRi1Eh9-9sRkTx-_iEODKFNN903N0BcVQq/exec?action=peek
```

ใช้ตรวจไฟล์ใน Pending folder แบบไม่ process จริง

ต้องดูค่า:

```text
best.itemCount > 0
best.respondentCount > 0
best.firstItems เป็นข้อความคำถามจริง ไม่ใช่ Q1/Q2/คอลัมน์_4
best.years มีเฉพาะถ้าไฟล์มีคอลัมน์ชั้นปีจริง
```

---

## 4) Process จริง 1 ไฟล์

หลังจาก health + selftest + peek ผ่านแล้วเท่านั้น ให้เปิด:

```text
https://script.google.com/macros/s/AKfycbz3Uq3oJtOu95URz2HfcgdPnoRYPdaJfFoRi1Eh9-9sRkTx-_iEODKFNN903N0BcVQq/exec?action=process
```

หลัง process ต้องได้:

```text
status = SUCCESS หรือ NEEDS_REVIEW
outputSpreadsheetUrl ต้องมีเมื่อ SUCCESS
pdfUrls ต้องมีเฉพาะรายงานที่มี source จริง
pdfCount ไม่จำเป็นต้องเท่ากับ 5 ถ้าไม่มี source ครบปี 1-4
```

---

## 5) เกณฑ์หยุดทันที

ห้าม process จริงต่อ ถ้าเจอข้อใดข้อหนึ่ง:

```text
health ยังเป็น v5
selftest allPass = false
peek ไม่พบ itemCount/respondentCount
firstItems เป็น Q1/Q2/คอลัมน์_4
ระบบสร้างปี 1-4 โดยไม่มี source ชั้นปี
```

---

## 6) ข้อความสั่ง Claude

```text
ตรวจ deployment ตาม docs/V6_DEPLOY_TEST_COMMANDS.md ก่อน ห้าม process ไฟล์จริงจนกว่า health เป็น v6-source-driven-reports, selftest allPass=true และ peek ผ่าน หากไม่ผ่านให้รายงานจุดที่ไม่ผ่านและหยุด
```
