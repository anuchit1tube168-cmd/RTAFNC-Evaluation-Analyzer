---
name: parent-evaluation-system
description: >
  Skill สำหรับพัฒนา ตรวจ แก้ และส่งมอบระบบแปลผลการประเมินผู้ปกครอง
  ของแผนกปกครอง วพอ.พอ. ใช้เมื่อทำ Apps Script, Google Sheet,
  Dashboard, Import, รายงานรายกิจกรรม/รายบุคคล, PDF หรือแก้ปัญหา deploy.
  Trigger: ผู้ใช้พูดว่า แบบประเมินผู้ปกครอง, แผนกปกครอง, template ถูกต้อง,
  deploy Apps Script, import Sheet, รายงานรายบุคคล หรือทำตามระบบเดิม.
---

# Parent Evaluation System Skill

## Mission

สร้างและดูแลระบบประเมินผู้ปกครองที่:

- แยกข้อมูลตามปีการศึกษาและกิจกรรม
- ใช้ข้อความคำถามจริง ไม่ใช้ Q1/Q2/Column/เลขล้วน
- แปลผลรายกิจกรรม รายข้อ และรายบุคคล
- ป้องกันข้อมูลส่วนบุคคลและเมนูผู้ดูแลด้วย Admin Key
- นำเข้าข้อมูลแบบตรวจซ้ำได้และมี Import Receipt
- ส่งออก PDF ตาม Template แผนกปกครอง
- ห้ามถือว่าสำเร็จจนมีหลักฐานทดสอบและ URL runtime

## Required Skill Stack

1. `fable-workflow` — INSPECT → CLARIFY → DESIGN → BUILD → VERIFY → DELIVER
2. `apps-script-processor` — backend, Sheet, Drive, quota, auth, error log
3. `dashboard-design` — KPI, filter, empty/error state, mobile
4. `qa-debug` — reproduce → isolate → patch → retest
5. `evidence-gate-receipt` — before/after/test/log/link/version/risk
6. `github-repo-operating` — source of truth, commit, deploy, rollback

## Source of Truth

- **GitHub**: source code, Skill, Spec, tests, release history
- **Google Drive**: working knowledge, Golden Template, preview, exported PDF/ZIP
- **Google Sheet**: operational state database and receipt index
- **Local export**: backup only ไม่ใช่ source of truth

## Architecture

```text
Browser / Apps Script HTMLService
        ↓ google.script.run
Google Apps Script
        ↓
Google Sheet database
  - PE_Activities
  - PE_Item_Dictionary
  - PE_Responses
  - PE_Imports
  - PE_QA_Log
        ↓
Google Drive PDF folder
```

## Invariants — ห้ามเปลี่ยนโดยไม่มี Migration Plan

1. `PE_Item_Dictionary` ต้องมีข้อความคำถามจริงทุกข้อ
2. คะแนนต้องอยู่ในช่วง 1–5 และครบทุกข้อก่อนบันทึก public form
3. รายงานรายบุคคลค้นด้วยรหัสแบบ exact match; ชื่อใช้ exact normalized match
4. ห้ามสร้างชั้นปี/กลุ่ม/กิจกรรมที่ไม่มี source จริง
5. Import ต้องมี fingerprint และ receipt; ชุดเดิมห้ามนำเข้าซ้ำ
6. คอลัมน์ X, SD, Average, Total, ค่าเฉลี่ย, รวม, ร้อยละ ห้ามเป็นข้อคำถาม
7. การแก้ schema ห้าม `clear()` หรือ `deleteSheet()` ใน production
8. เมนูสร้างกิจกรรม, import, dashboard, รายบุคคล และ PDF ต้องใช้ Admin Key
9. PDF ใช้ Template `official-governance-v1`, ฟอนต์ TH Sarabun New
10. Deploy status เป็น PASS ได้เมื่อ runtime URL และ Diagnostic ผ่านเท่านั้น

## Standard Workflow

### 1. INSPECT

ตรวจของจริงก่อน:

- ไฟล์ Golden Template ใน Drive
- repo และ commit ปัจจุบัน
- Apps Script workflow
- Sheet schema และหัวตาราง
- URL ที่ผู้ใช้เปิดจริง
- screenshot/error/log

บันทึกข้อเท็จจริงและ root cause ห้ามเดาจากชื่อไฟล์

### 2. DESIGN

จัดทำเอกสารก่อนโค้ด:

- `PRD.md`
- `DATA_SCHEMA.md`
- `USER_FLOW.md`
- `UI_SPEC.md`
- `VALIDATION.md`
- `DEPLOYMENT_PLAN.md`
- `GOLDEN_TEMPLATE_MAP.md`

### 3. BUILD

กฎการสร้าง:

- Config แยกจาก logic
- batch write แทน `appendRow` ในงาน import จำนวนมาก
- Lock ก่อนเขียนข้อมูล
- server-side validation ต้องซ้ำกับ frontend validation
- error ต้องส่งกลับให้ผู้ใช้เห็น ห้ามกลืน error
- HTML/CSS/JavaScript แยกไฟล์และ include ผ่าน Helper

### 4. VERIFY

ขั้นต่ำ:

- static validation script ผ่าน
- JavaScript syntax ผ่าน
- Self Test ผ่าน
- Diagnostic ผ่าน
- ทดสอบ public form 1 ชุด
- ทดสอบ import ใหม่ 1 ชุด
- ทดสอบ import ซ้ำ ต้องถูกปฏิเสธ
- Dashboard และ PDF รายกิจกรรมผ่าน
- รายบุคคล exact match ผ่าน
- mobile layout ผ่าน

### 5. DEPLOY

- push `main` เฉพาะเมื่อ validation ผ่าน
- GitHub Actions ต้อง run validation ก่อน `clasp push`
- redeploy deployment เดิม
- ตรวจ URL หลัก, `?mode=parent`, `?mode=upload`
- เก็บ deployment evidence และ rollback commit

### 6. DELIVER

ส่งมอบพร้อม:

- live URL
- commit SHA
- test receipt
- screenshot ก่อน/หลัง
- PDF ตัวอย่าง
- Known limitations
- rollback instruction
- ZIP backup

## Pass / Review / Fail

### PASS

- Code/static test ผ่าน
- Runtime Diagnostic `allPass: true`
- Template PDF ถูกต้อง
- ไม่มีข้อมูลซ้ำจาก import
- มี evidence ครบ

### REVIEW

- Code ผ่านแต่ยังไม่ยืนยัน runtime
- ข้อมูล import บางแถวขาดชื่อ/ผู้ปกครอง/คะแนน
- ชื่อค้นหาแล้วกำกวม
- PDF ยังไม่ได้ตรวจด้วยสายตา

### FAIL

- Q1/Q2/Column/เลขล้วนใน Item Dictionary
- deploy URL เปิดหน้าเก่า/ผิด route
- schema ถูกล้าง
- report หลุดข้อคำถาม
- เปิดรายงานส่วนบุคคลได้โดยไม่มี Admin Key
- อ้างว่า PASS โดยไม่มี log/หลักฐาน

## Output Contract

ทุกครั้งต้องรายงาน:

```text
STATUS: PASS / REVIEW / FAIL
SCOPE: ส่วนที่ตรวจหรือแก้
SOURCE: ไฟล์/Drive/commit ที่ใช้
ROOT CAUSE: ปัญหาเดิม
CHANGES: ไฟล์ที่แก้
TESTS: รายการและผล
EVIDENCE: URL / screenshot / log / receipt
RISK: ความเสี่ยงคงเหลือ
NEXT: ขั้นถัดไปหนึ่งข้อ
```
