# V6 Risk Register

## Risk 1 — Apps Script file load order

### Risk

Apps Script มีหลายไฟล์ `.gs` และอาจไม่รับประกันว่าไฟล์ `ZZ_Parser_QA_v6_Override.gs` หรือ `ZZ_SelfTest_v6.gs` จะ override function เดิมหลังสุดเสมอ

### Symptom

เมื่อเปิด:

```text
?action=selftest
```

แล้วยังเห็น:

```text
version = v5-per-class-reports
```

หรือ selftest ไม่ตรวจ Q1/Q2 hard failure

### Mitigation

ถ้าเกิด symptom นี้ ให้ทำอย่างใดอย่างหนึ่ง:

```text
1) รวม v6 selftest และ QA gate เข้า Code.gs โดยตรง
2) หรือเปลี่ยนชื่อ function ใน Code.gs ให้เรียก pRunQaGateV6_() และ selfTestV6_() โดยตรง แทนการ override function เดิม
```

### Acceptance

```text
health.version = v6-source-driven-reports
selftest.version = v6-source-driven-reports
selftest.allPass = true
selftest มี case Q1/Q2 เป็น REVIEW
```

---

## Risk 2 — Workflow not visible from connector

### Risk

GitHub connector อาจไม่แสดง workflow run ของ push commit แม้ workflow จะทำงานจริง

### Mitigation

ตรวจใน GitHub UI โดยตรง:

```text
Repo > Actions > Deploy Apps Script Backend
```

ดู run ล่าสุดหลัง commit:

```text
d6622d0a7aebbbf034b7bc6d5b000f7dab710c6a
```

หรือ commit ล่าสุดกว่าใน `google-apps-script/**`

---

## Risk 3 — Fake item headers still get parsed as score columns

### Risk

Microsoft Forms บางไฟล์อาจ export เป็น Q1/Q2 เพราะหัวข้อจริงหายตั้งแต่ต้นทาง

### Mitigation

ระบบต้อง REVIEW ไม่ใช่ PASS และให้ผู้ใช้แก้ต้นทางหรือ map จาก Golden Example ที่ยืนยันแล้ว

### Acceptance

```text
Item_Dictionary ต้องมีข้อความคำถามเต็มทุกข้อ
Q1/Q2/คอลัมน์_4 ต้องเป็น REVIEW
```

---

## Risk 4 — Per-class PDF expectation

### Risk

ผู้ใช้คาดว่าจะมี PDF ปี 1-4 ครบทุกครั้ง แต่ v6 ห้ามสร้างถ้าไม่มี source

### Mitigation

แสดงใน `Class_Source_Map` ว่า:

```text
รายงานแยกปี 1-4 = NO / SKIPPED/REVIEW / ไม่พบ source ชั้นปี
```

### Acceptance

```text
pdfCount อาจน้อยกว่า 5 ได้ ถ้าไม่มี source ครบปี 1-4
```
