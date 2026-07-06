# Claude Code Operating Skill — RTAFNC Evaluation Analyzer

ใช้ไฟล์นี้เป็นกติกาหลักของ Claude Code / AI Agent ทุกครั้งที่ทำงานกับ repo นี้

## Core Rule

```text
อ่านก่อน → คิดก่อน → แก้ทีละส่วน → ตรวจสอบเสมอ
```

ห้ามบอกว่าสำเร็จจนกว่าจะมีหลักฐานจาก test/log/output จริง

---

## Plan → Build → Review → Ship

### 1) PLAN — อ่านก่อนและวางแผน

ต้องทำก่อนแก้โค้ดทุกครั้ง:

```text
1. อ่านไฟล์ที่เกี่ยวข้องก่อน เช่น Code.gs, Parser_v5.gs, appsscript.json, workflow, log
2. อ่าน error ล่าสุดจาก Drive log หรือ GitHub Actions log
3. ระบุปัญหาเดียวที่จะซ่อมใน patch นี้
4. เขียน expected outcome ก่อนแก้
```

ห้าม:

```text
- เดา error
- แก้หลายจุดพร้อมกัน
- process ไฟล์จริงก่อน health/selftest/peek ผ่าน
```

### 2) BUILD — แก้ทีละส่วน

กติกาการแก้:

```text
1 patch = 1 เป้าหมาย
1 commit = 1 เหตุผล
ถ้าเป็น Apps Script ให้ระวัง file load order
ถ้าเป็น override ให้ workflow append ZZ_*.gs ไปท้าย Code.gs ก่อน deploy
```

ตัวอย่างเป้าหมาย patch ที่ถูกต้อง:

```text
- Fix Drive is not defined
- Add healthv6/selftestv6 URL route
- Hard fail Q1/Q2 item headers
- Prevent invented class-year reports
- Fix PDF print layout
```

### 3) REVIEW — ตรวจทันทีหลังแก้

หลังแก้ต้องตรวจอย่างน้อย:

```text
1. fetch ไฟล์ที่แก้กลับมาตรวจ
2. อ้างอิงบรรทัดสำคัญในคำตอบ
3. ตรวจ GitHub commit SHA
4. ถ้าเกี่ยวกับ Apps Script ต้องดู log/process หลัง deploy
```

สำหรับระบบนี้ต้องตรวจตามลำดับ:

```text
?action=healthv6
?action=selftestv6
?action=peek
?action=process   // ทำเฉพาะหลัง 3 ข้อแรกผ่าน
```

### 4) SHIP — ส่งมอบเมื่อมี output จริง

ถือว่าส่งมอบได้เมื่อมี:

```text
1. Google Sheet / Excel output ที่มี sheetUrl
2. PDF output ที่มี pdfUrl
3. QA_Log แสดง PASS หรือ REVIEW พร้อมเหตุผล
4. Item_Dictionary มีข้อความคำถามจริงครบทุกข้อ
5. Individual_All_Items มีคะแนนรายคนครบทุกข้อ
6. ไม่มี Q1/Q2/Column/คอลัมน์_4 เป็นชื่อข้อคำถาม
7. ไม่สร้างรายงานปี 1-4 เองถ้าไม่มี source ชั้นปี
```

---

## Mandatory QA Gate

### Item Dictionary Gate

ต้อง REVIEW ทันทีถ้าเจอ:

```text
Q1
Q2
Question 1
Column 4
คอลัมน์_4
ข้อ 1 ที่ไม่มีข้อความคำถามจริง
```

### Class-Year Gate

ห้ามสร้างรายงานแยกปีจากการเดา

สร้างรายงานปีได้เฉพาะเมื่อพบ source จริงอย่างใดอย่างหนึ่ง:

```text
- คอลัมน์ชั้นปี
- sheet แยกปี
- roster mapping ที่ยืนยันแล้ว
- rule ที่ผู้ใช้ให้ชัดเจนและบันทึกใน QA_Log
```

ถ้าไม่มี source:

```text
สร้างรายงานรวมเท่านั้น
Class_Source_Map ต้องระบุ SKIPPED/REVIEW
```

### Output Gate

ถ้า Apps Script process แล้วไม่มี `sheetUrl` หรือ `pdfUrl`:

```text
ห้ามบอกว่าสำเร็จ
ต้องอ่าน log แล้วแก้ error ต่อ
```

---

## Current Known Runtime Status

```text
Local raw-file test: PASS
- Raw Drive file tested: นภาภิบาล_แบบประเมินกิจกรรม การฝึกทหารตามแผนนภาภิบาล การฝึกร_723d27e1.xlsx
- Respondents: 251
- Items: 44
- Overall mean: 4.48
- Overall SD: 0.68
- Outputs created locally: Excel, CSV, PDF

Apps Script production process: REVIEW
- Latest Drive log still shows ERROR rows only
- Latest error: ReferenceError: Drive is not defined
- Drive-free conversion patch added
- Need new runtime process after deploy
```

---

## Debugging Protocol

เมื่อเจอ error:

```text
1. Copy exact error
2. Find exact function path
3. Patch one function only
4. Commit
5. Deploy/trigger
6. Re-read log
7. Stop if new error appears and start new patch
```

---

## Delivery Format

ทุกคำตอบสถานะต้องแยกเป็น:

```text
PASS — ตรวจแล้วผ่าน
REVIEW — ยังไม่ยืนยัน / ต้องตรวจเพิ่ม
FAIL — ตรวจแล้วไม่ผ่าน
NEXT — ขั้นต่อไปที่ต้องทำ
```

ห้ามใช้คำว่า “เสร็จแล้ว” ถ้ายังไม่มี output runtime จริง
