# PRD — ระบบแปลผลการประเมินผู้ปกครอง

## หน่วยงาน

แผนกปกครอง วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ

## Problem

ข้อมูลแบบประเมินกระจายอยู่ใน Excel/Google Sheet หลายปี หลายกิจกรรม รูปแบบหัวตารางไม่สม่ำเสมอ และระบบเดิมเปิดหน้า Upload ที่ไม่ตรงงานผู้ปกครอง ทำให้ใช้งานยาก เสี่ยง import ซ้ำ และรายงานรายบุคคลผิดคน

## Goal

สร้าง Web App บน Google Apps Script ที่:

- หน้าแรกเป็นแบบประเมินผู้ปกครอง
- แยกข้อมูลตามปีการศึกษาและกิจกรรม
- ใช้คำถามจริงใน Item Dictionary
- แปลผล 1–5 รายข้อ รายกิจกรรม และรายบุคคล
- Import Google Sheet แบบป้องกันซ้ำ
- ส่งออก PDF ตาม Template แผนกปกครอง
- ป้องกันเมนูผู้ดูแลและข้อมูลรายบุคคล

## Users

### ผู้ปกครอง

กรอกข้อมูลและคะแนน ไม่มีสิทธิ์ดูรายงาน

### เจ้าหน้าที่แผนกปกครอง

Setup, สร้างกิจกรรม, Import, Dashboard, รายบุคคล, PDF, QA

### ผู้ดูแลระบบ

ดูแล Apps Script, GitHub Actions, deployment, rollback

## In Scope

- Apps Script HTMLService frontend
- Google Sheet database
- Google Drive PDF output
- Admin Key
- Import fingerprint/receipt
- QA Log
- Modern responsive UI
- PDF รายกิจกรรมและรายบุคคล

## Out of Scope

- LINE Login/LIFF
- SSO ขององค์กร
- การแก้ข้อมูลดิบแบบ full CRUD
- การลบข้อมูล production ผ่านหน้าเว็บ
- การคำนวณสถิติขั้นสูงนอกเหนือจาก mean/S.D./ระดับ

## Success Metrics

- ผู้ปกครองกรอกแบบประเมินบนมือถือได้
- บันทึกไม่สำเร็จเมื่อคะแนนไม่ครบ
- Import ชุดเดิมซ้ำไม่เกิดแถวเพิ่ม
- Dashboard รายข้อครบ 100%
- รายบุคคลไม่รวมชื่อบางส่วน
- PDF ผ่าน visual check ตาม Template
- Runtime Diagnostic allPass = true

## Acceptance Criteria

1. URL หลักเปิด Modern Dashboard
2. `?mode=upload` เปิดระบบเดิม
3. Sheet schema ครบ 5 ตาราง
4. Item Dictionary ไม่มี Q1/Q2/Column/เลขล้วน
5. Public form ตรวจข้อมูลฝั่ง server
6. Admin functions ปฏิเสธเมื่อไม่มีสิทธิ์
7. Import มี fingerprint และ receipt
8. PDF ใช้ TH Sarabun New และหัวรายงานถูกต้อง
9. Static validation ผ่านก่อน deploy
10. ส่งมอบพร้อม URL, commit, test receipt และ rollback
