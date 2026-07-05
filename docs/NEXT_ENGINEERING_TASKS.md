# Next Engineering Tasks — v5 Implementation

ไฟล์นี้คือรายการงานสำหรับพัฒนา backend ให้ตรงกับ SKILL.md v5.1 และ Golden Examples

## Phase 1 — Parser and Clean Data

สถานะ: ทำแล้วใน `Parser_v5.gs` (parser แบบ matrix) + ต่อเข้ากับ `analyzeSheet_` ใน `Code.gs`
มี Node test ที่ `scratchpad/test_parser.js` (ต้องตรวจกับไฟล์จริงบน Apps Script อีกครั้งก่อนใช้)

```text
[x] อ่านทุก sheet ในไฟล์ต้นทาง ไม่ใช่ sheet แรกอย่างเดียว (เลือกชีตที่ parse ได้ดีที่สุด)
[x] ตรวจหา header: เลขที่ / รหัส / ชื่อ-สกุล / อีเมล / ชั้นปี
[x] ตรวจหาคอลัมน์คะแนนข้อ 1 ถึง n (ไม่นับ เลขที่/ชั้นปี/รหัส เป็นคะแนน)
[x] clean ชื่อไทย ไม่ให้ตัดตัวอักษรผิดช่อง (รวมช่องชื่อ+สกุล, ยุบช่องว่างซ้ำ, ลบ zero-width)
[x] ถ้าไม่มีข้อมูลยศ ห้ามสร้างคอลัมน์ยศเอง (อ่าน rank เฉพาะเมื่อมีคอลัมน์ยศจริง)
[x] ตรวจคะแนนนอกช่วง 1–5 (นับเฉพาะในคอลัมน์คะแนน, 0 = ไม่ตอบ)
[x] ตรวจ duplicate respondent (คีย์ตามรหัส > อีเมล > ชื่อ)
```

## Phase 2 — Items and Score Calculations

สถานะ: ทำแล้วใน `createOutputWorkbook_` (Code.gs) — sheet `Item_Dictionary`, `Items_X_SD`,
`Individual_All_Items` สร้างจาก respondents ของ Parser v5 (Node test: `scratchpad/test_phase2.js`)

```text
[x] ดึงหัวข้อประเมินรายข้อครบ (ข้อความคำถามจริงจากหัวคอลัมน์)
[x] สร้าง Items_X_SD (เปลี่ยนชื่อจาก Items เดิม + wrap คอลัมน์คำถาม)
[x] เพิ่ม Item_Dictionary: รหัสข้อ + ข้อความเต็ม + ข้อความย่อ + sourceColumn + N
[x] คำนวณ N, X, SD, ระดับ รายข้อ
[x] สร้าง Individual_All_Items พร้อมคะแนนรายข้อ (หัวคะแนน = รหัสข้อ + ข้อความย่อ, มี X/SD/ระดับรายคน)
[x] ใช้ค่าคำนวณจริง ไม่สร้างสูตรที่เสี่ยง #NAME? (Individual ใช้ค่าคำนวณ, ScoreRows หุ้ม IFERROR)
```

## Phase 3 — Per-class Exports

```text
[ ] สร้างกลุ่ม รวมชั้นปี 1-4
[ ] สร้างกลุ่มปี 1
[ ] สร้างกลุ่มปี 2
[ ] สร้างกลุ่มปี 3
[ ] สร้างกลุ่มปี 4
[ ] ถ้าปีใดไม่มีข้อมูล ให้ QA_Log = REVIEW แต่ยังสร้าง report เปล่าพร้อมหมายเหตุ
```

## Phase 4 — PDF Reports

```text
[ ] สร้าง Print_Report_รวม
[ ] สร้าง Print_Report_ปี1
[ ] สร้าง Print_Report_ปี2
[ ] สร้าง Print_Report_ปี3
[ ] สร้าง Print_Report_ปี4
[ ] ตัด section สรุปตามชั้นปีออก
[ ] เพิ่มข้อเสนอแนะการปรับปรุงจากข้อที่ X ต่ำสุด
[ ] เพิ่มช่องลายเซ็น 3 ช่อง
[ ] export เฉพาะ gid ของ Print_Report_* เป็น PDF
```

## Phase 5 — Comments Theme Analysis

```text
[ ] ตรวจว่ามีข้อคิดเห็นหรือไม่
[ ] ถ้ามี ให้สร้าง Comments_Themes
[ ] สรุป theme / จำนวน / ร้อยละ / ตัวอย่างข้อความ
[ ] เอา theme สำคัญไปใช้ในข้อเสนอแนะการปรับปรุง
```

## Phase 6 — QA Gate

```text
[ ] ตรวจ sheet ครบ
[ ] ตรวจไม่มี formula error
[ ] ตรวจ PDF ครบ 5 ไฟล์
[ ] ตรวจหัวข้อ Excel/PDF ตรงกัน
[ ] ตรวจไม่มีสรุปตามชั้นปีใน PDF
[ ] ตรวจมีข้อเสนอแนะและลายเซ็น
[ ] ตรวจเทียบ Golden Examples
```

## Done Criteria

```text
[ ] Process file จริงสำเร็จ
[ ] Log = SUCCESS
[ ] Excel ผ่าน QA_ACCEPTANCE_CHECKLIST
[ ] PDF ผ่าน QA_ACCEPTANCE_CHECKLIST
[ ] ผู้ใช้เปิด PDF บนมือถือแล้วไม่เห็นตารางขาด/เบี้ยว
```
