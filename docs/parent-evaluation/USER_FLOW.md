# User Flow — Parent Evaluation

## Flow A: ผู้ปกครองทำแบบประเมิน

```text
เปิด URL หลัก
→ เลือกปีการศึกษา
→ โหลดกิจกรรม
→ เลือกกิจกรรม
→ ระบบโหลด Item Dictionary
→ กรอกชื่อผู้เรียน/ผู้ปกครอง
→ เลือกคะแนน 1–5 ให้ครบ
→ กรอกข้อเสนอแนะ
→ Submit
→ Server ตรวจข้อมูลซ้ำอีกครั้ง
→ บันทึก PE_Responses
→ แสดงค่าเฉลี่ย/S.D./ระดับ
```

Error states:

- ไม่พบกิจกรรม → Empty State
- ข้อคำถามไม่มี → REVIEW
- ชื่อผู้เรียนว่าง → ไม่บันทึก
- ชื่อผู้ปกครองว่าง → ไม่บันทึก
- คะแนนไม่ครบ/เกินช่วง → ไม่บันทึก

## Flow B: ตั้งค่าระบบครั้งแรก

```text
เจ้าหน้าที่เปิดเมนูตั้งค่า
→ กรอกรหัสผู้ดูแลอย่างน้อย 8 ตัวอักษร
→ Setup Database
→ สร้าง/ตรวจ 5 sheets
→ Health
→ Self Test
→ Diagnostic
→ allPass true
```

## Flow C: สร้างกิจกรรม

```text
ยืนยันสิทธิ์ผู้ดูแล
→ ระบุปีการศึกษา
→ ระบุชื่อ/วันที่กิจกรรม
→ วางข้อความคำถามจริง ข้อละหนึ่งบรรทัด
→ ตรวจ bad item text
→ ตรวจชื่อกิจกรรมซ้ำในปีเดียวกัน
→ บันทึก PE_Activities
→ batch write PE_Item_Dictionary
→ QA receipt
```

## Flow D: Import Google Sheet

```text
ยืนยันสิทธิ์ผู้ดูแล
→ ระบุ Spreadsheet ID / Sheet / ปี / ชื่อกิจกรรม
→ อ่าน header row จริง
→ map metadata columns
→ ตัด summary columns
→ ตรวจ ratio คะแนน 1–5
→ ตรวจข้อความคำถามจริง
→ เตรียม rows
→ สร้าง fingerprint
→ ตรวจ PE_Imports
→ ถ้าซ้ำให้หยุด
→ สร้างกิจกรรม
→ batch write responses
→ เขียน import receipt
→ QA log
```

## Flow E: Dashboard รายกิจกรรม

```text
ยืนยันสิทธิ์ผู้ดูแล
→ เลือกปี
→ เลือกกิจกรรมหรือดูทุกกิจกรรม
→ สรุป responseCount/passCount/reviewCount
→ คำนวณ mean/S.D./ระดับ
→ แสดงผลรายข้อ
→ Export PDF official template
```

## Flow F: รายบุคคล

```text
ยืนยันสิทธิ์ผู้ดูแล
→ ระบุปี
→ ค้นด้วยรหัสนักเรียนเป็นหลัก
→ ถ้าไม่มีรหัส ใช้ชื่อเต็ม exact match
→ ตรวจ identity ambiguity
→ รวมกิจกรรมในปีนั้น
→ แสดงคะแนนรายข้อ
→ Export PDF รายบุคคล
```

## Flow G: Deploy

```text
push main
→ GitHub Actions checkout
→ static validation gate
→ stage .gs/.html/manifest
→ append ZZ overrides last
→ clasp push
→ redeploy deployment เดิม
→ เปิด URL จริง
→ run Self Test + Diagnostic
→ screenshot desktop/mobile
→ QA receipt + rollback commit
```
