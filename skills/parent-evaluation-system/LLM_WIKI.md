# LLM Wiki — ระบบแปลผลการประเมินผู้ปกครอง แผนกปกครอง วพอ.พอ.

## ระบบนี้ใช้ทำอะไร

ระบบนี้รับข้อมูลแบบประเมินผู้ปกครอง แยกตามปีการศึกษาและกิจกรรม แล้วสรุปผลเป็น:

- ภาพรวมรายกิจกรรม
- ผลรายข้อ
- รายงานรายบุคคล
- PDF ตามรูปแบบแผนกปกครอง
- QA Log และ Import Receipt

## ผู้ใช้ 2 กลุ่ม

### ผู้ปกครอง

- เลือกปีการศึกษา
- เลือกกิจกรรม
- กรอกข้อมูลนักเรียนและผู้ปกครอง
- ให้คะแนน 1–5 ทุกข้อ
- ส่งข้อเสนอแนะ
- ไม่ต้องใช้ Admin Key

### เจ้าหน้าที่แผนกปกครอง

- Setup Database
- สร้างกิจกรรมและ Item Dictionary
- Import จาก Google Sheet
- ดู Dashboard
- ค้นรายบุคคล
- Export PDF
- ตรวจ Diagnostic
- ต้องใช้ Admin Key

## หน้าและ Route

```text
/exec                    หน้า Modern Dashboard
/exec?mode=parent        หน้า Modern Dashboard เช่นกัน
/exec?mode=upload        ระบบ Upload v6 เดิม
/exec?action=parenthealth
/exec?action=parentselftest
```

## โครงสร้างข้อมูล

### PE_Activities

เก็บกิจกรรมจริงตามปีการศึกษา

### PE_Item_Dictionary

เก็บข้อความคำถามจริง ห้ามใช้ Q1/Q2/Column/เลขล้วน

### PE_Responses

เก็บผู้ตอบ คะแนน JSON ค่าเฉลี่ย S.D. ระดับ และข้อเสนอแนะ

### PE_Imports

เก็บ fingerprint และ receipt ของการ import เพื่อป้องกันข้อมูลซ้ำ

### PE_QA_Log

เก็บเหตุการณ์ PASS/REVIEW/FAIL

## Template ที่ถูกต้อง

### หน้าเว็บ

- แบรนด์: `แผนกปกครอง วพอ.พอ.`
- สีหลัก: Military Navy / Blue / Cyan
- หน้าแรก: แบบประเมินสำหรับผู้ปกครอง
- เมนู Admin แยกชัดเจน
- รองรับ desktop/tablet/mobile
- มี empty state, loading, toast และ error state

### PDF

หัวรายงาน:

```text
รายงานผลการประเมินผู้ปกครอง
แผนกปกครอง วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ
ปีการศึกษา XXXX
```

ส่วนประกอบ:

1. ข้อมูลกิจกรรม
2. สรุปจำนวนผู้ตอบ/ค่าเฉลี่ย/S.D./ระดับ
3. ผลรายข้อด้วยข้อความจริง
4. ข้อเสนอแนะ
5. หมายเหตุการรับรองข้อมูล
6. ช่องลงชื่อเจ้าหน้าที่แผนกปกครอง

ฟอนต์: `TH Sarabun New`

## วิธีสร้างกิจกรรมให้ถูกต้อง

ข้อคำถามต้องเป็นข้อความที่อ่านรู้เรื่อง เช่น:

```text
ความเหมาะสมของระยะเวลาในการจัดกิจกรรม
ความชัดเจนของการสื่อสารจากวิทยาลัย
ประโยชน์ที่ผู้ปกครองได้รับจากกิจกรรม
```

ห้ามใช้:

```text
Q1
Q2
Column 4
1
2
3
```

## วิธี Import

1. แถวหัวตารางต้องเป็นข้อความคำถามจริง
2. คอลัมน์ข้อมูลบุคคลใช้ชื่อชัดเจน เช่น `ชื่อ-สกุลนักเรียน`
3. คะแนนต้องเป็น 1–5
4. ระบบตัด X, S.D., ค่าเฉลี่ย, รวม, ร้อยละ อัตโนมัติ
5. ระบบสร้าง fingerprint
6. ชุดเดิมที่เคย Import จะถูกหยุด
7. แถวข้อมูลไม่ครบถูกเก็บเป็น REVIEW

## การค้นรายบุคคล

- ใช้รหัสนักเรียนเป็นหลัก
- ถ้าใช้ชื่อ ระบบค้นแบบ exact normalized match
- ถ้าชื่อซ้ำหลายรหัส ต้องกลับไปใช้รหัสนักเรียน

## การแก้ปัญหา

### เปิดแล้วเป็น Upload v6

ตรวจ `doGet()` ให้ URL หลักเรียก `buildParentEvaluationPage_()` และ Upload อยู่ที่ `?mode=upload`

### หน้าไม่มี CSS/กดปุ่มไม่ได้

ตรวจไฟล์:

- `Parent_Evaluation_Styles.html`
- `Parent_Evaluation_App.html`
- `Parent_Evaluation_Helpers.gs`

### Import ซ้ำ

ตรวจ `PE_Imports` และ fingerprint ห้ามลบ receipt เพื่อฝืน import

### Diagnostic ไม่ผ่าน

อ่านรายการ check ที่ FAIL แล้วแก้เฉพาะจุด ห้ามล้างฐานข้อมูลหรือเขียนทับทั้งระบบ

## Manual Fallback

เมื่อ GitHub Actions ใช้ไม่ได้:

1. ดาวน์โหลด ZIP จาก repo
2. เปิด Apps Script project เดิม
3. วางไฟล์ `.gs`, `.html`, `appsscript.json`
4. ตรวจ `Parent_Evaluation_Helpers.gs`
5. Run `parentSelfTest`
6. Run `parentDiagnostic` ด้วย Admin Key
7. Deploy new version ที่ deployment เดิม
8. เปิด URL จริงและเก็บ screenshot

## ข้อจำกัด

- Google Apps Script มี execution quota และ timeout
- PDF ต้องตรวจด้วยสายตาหลังสร้างจริง
- Google Drive HTML ไม่ใช่ hosting สำหรับ Web App
- Status code/static test ผ่าน ไม่เท่ากับ runtime ผ่าน
