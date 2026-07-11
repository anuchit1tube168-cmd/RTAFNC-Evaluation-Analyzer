# Checklist — Parent Evaluation System

## A. Inspect

- [ ] อ่าน `SKILL.md` และ `LLM_WIKI.md`
- [ ] ตรวจ repo branch/commit ปัจจุบัน
- [ ] ตรวจ Apps Script deployment ID
- [ ] เปิด URL ที่ผู้ใช้ใช้จริง
- [ ] ตรวจ screenshot/error/log
- [ ] ตรวจ Golden Template ใน Google Drive
- [ ] แยก source ดิบ กับ output ที่ต้องการ

## B. Spec / Template

- [ ] มี PRD
- [ ] มี Data Schema
- [ ] มี User Flow
- [ ] มี UI Spec
- [ ] มี Validation Rules
- [ ] มี Deployment Plan
- [ ] มี Golden Template Map
- [ ] หัว PDF ใช้ชื่อแผนกปกครองถูกต้อง
- [ ] ใช้ TH Sarabun New
- [ ] มีช่องลงชื่อเจ้าหน้าที่

## C. Database

- [ ] มี `PE_Activities`
- [ ] มี `PE_Item_Dictionary`
- [ ] มี `PE_Responses`
- [ ] มี `PE_Imports`
- [ ] มี `PE_QA_Log`
- [ ] Header ตรง schema
- [ ] ไม่มี `clear()` หรือ `deleteSheet()` ใน migration
- [ ] ใช้ Lock ก่อนเขียนข้อมูลสำคัญ

## D. Item Dictionary

- [ ] ใช้ข้อความคำถามจริงทุกข้อ
- [ ] ไม่มี Q1/Q2/Question 1
- [ ] ไม่มี Column/คอลัมน์_4
- [ ] ไม่มีเลขล้วน
- [ ] itemNo เรียงต่อเนื่อง
- [ ] maxScore = 5
- [ ] sourceSheet/sourceColumn ระบุได้เมื่อ Import

## E. Public Form

- [ ] โหลดกิจกรรมตามปีการศึกษา
- [ ] เลือกคะแนน 1–5 ได้
- [ ] ต้องตอบครบทุกข้อ
- [ ] ต้องมีชื่อ-สกุลนักเรียน
- [ ] ต้องมีชื่อผู้ปกครอง
- [ ] Server ตรวจซ้ำ ไม่พึ่ง frontend อย่างเดียว
- [ ] ไม่ต้องใช้ Admin Key
- [ ] ไม่เปิดข้อมูลรายบุคคล

## F. Admin Security

- [ ] Setup ใช้ Admin Key อย่างน้อย 8 ตัวอักษร
- [ ] สร้างกิจกรรมต้องใช้ Admin Key
- [ ] Import ต้องใช้ Admin Key
- [ ] Dashboard ต้องใช้ Admin Key
- [ ] รายบุคคลต้องใช้ Admin Key
- [ ] Export PDF ต้องใช้ Admin Key
- [ ] Health แบบ public ไม่เปิดเผย database URL

## G. Import

- [ ] แถวหัวตารางถูกต้อง
- [ ] ระบุชื่อ Sheet หรือใช้ชีตแรกอย่างชัดเจน
- [ ] ตัด X/SD/Average/Total/รวม/ร้อยละ
- [ ] คะแนน 1–5 อย่างน้อย 70% ของค่าที่ไม่ว่างในคอลัมน์
- [ ] สร้าง fingerprint
- [ ] ตรวจ fingerprint ก่อนเขียน
- [ ] เขียนข้อมูลแบบ batch
- [ ] มี Import Receipt
- [ ] Import ซ้ำถูกปฏิเสธ
- [ ] แถวไม่ครบเป็น REVIEW

## H. Reports

- [ ] Dashboard แยกปี/กิจกรรม
- [ ] แสดง responseCount/passCount/reviewCount
- [ ] ค่าเฉลี่ย 2 ตำแหน่ง
- [ ] S.D. 2 ตำแหน่ง
- [ ] รายข้อครบทุกข้อ
- [ ] รายบุคคลค้นรหัส exact match
- [ ] ชื่อค้น exact normalized match
- [ ] ชื่อกำกวมให้ REVIEW
- [ ] PDF กิจกรรมใช้ official-governance-v1
- [ ] PDF รายบุคคลมีคะแนนรายข้อ
- [ ] ข้อเสนอแนะไม่ตกหล่น

## I. UI

- [ ] URL หลักเปิด Modern Dashboard
- [ ] `?mode=parent` เปิด Modern Dashboard
- [ ] `?mode=upload` เปิดระบบเดิม
- [ ] CSS include สำเร็จ
- [ ] JavaScript include สำเร็จ
- [ ] Loading state
- [ ] Empty state
- [ ] Error/Toast state
- [ ] Mobile responsive
- [ ] แบรนด์ `แผนกปกครอง วพอ.พอ.`

## J. Tests / Evidence

- [ ] `python3 scripts/validate_parent_evaluation.py` ผ่าน
- [ ] `parentSelfTest()` allPass = true
- [ ] `parentDiagnostic()` allPass = true
- [ ] ทดสอบสร้างกิจกรรม
- [ ] ทดสอบบันทึกแบบประเมิน
- [ ] ทดสอบ reject คะแนนไม่ครบ
- [ ] ทดสอบ import ใหม่
- [ ] ทดสอบ reject import ซ้ำ
- [ ] ทดสอบ Dashboard
- [ ] ทดสอบรายบุคคล
- [ ] ทดสอบ PDF กิจกรรม
- [ ] ทดสอบ PDF รายบุคคล
- [ ] มี screenshot desktop/mobile
- [ ] มี runtime URL
- [ ] มี commit SHA
- [ ] มี QA Receipt
- [ ] มี rollback commit

## Ship Gate

งานนับว่า PASS เมื่อทุกข้อ Critical ด้านล่างผ่าน:

```text
Schema + Item Dictionary + Security + Import Receipt
+ Static Validation + Runtime Diagnostic + PDF Visual Check
+ URL จริง + Evidence Receipt
```

ถ้าขาดข้อใดข้อหนึ่ง ให้ใช้สถานะ REVIEW ห้ามเขียนว่าเสร็จสมบูรณ์
