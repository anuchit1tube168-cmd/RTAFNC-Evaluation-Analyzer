# Deploy Guide — RTAFNC Evaluation Analyzer

## 1) Deploy Backend: Google Apps Script

1. เปิด https://script.google.com
2. สร้าง Project ใหม่ชื่อ `RTAFNC Evaluation Analyzer Backend`
3. วาง `google-apps-script/Code.gs`
4. เปิด Project Settings → ติ๊ก `Show appsscript.json manifest file in editor`
5. วาง `google-apps-script/appsscript.json`
6. ไปที่ Services → Add a service → เลือก `Drive API` → version v3
7. Run ฟังก์ชัน `doGet` หรือ `list` ผ่าน Web App หลัง deploy เพื่อ authorize
8. Deploy → New deployment → Web app
9. Execute as: `Me`
10. Who has access: สำหรับ pilot ใช้ `Anyone with the link` หรือจำกัดตามนโยบายหน่วย
11. Copy Web App URL

## 2) ตั้งค่า Frontend

1. เปิด GitHub Pages URL ของ repo
2. วาง Web App URL ในช่อง Backend URL
3. กด `บันทึก URL`
4. กด `ตรวจไฟล์ใน Drive`
5. ถ้าเห็นไฟล์ใน `00_วางไฟล์ที่นี่` แล้วค่อยกด `ประมวลผลไฟล์รอคิว`

## 3) ตรวจผลลัพธ์ใน Google Drive

- Excel/Sheet: `03_สรุปผลและตารางคำนวณ`
- PDF: `04_รายงานส่งออก_PDF`
- ไฟล์ประมวลผลแล้ว: `02_ข้อมูลดิบจากแบบประเมิน/01_ประมวลผลแล้ว`
- ไฟล์ไม่มั่นใจ: `02_ข้อมูลดิบจากแบบประเมิน/99_ไม่ทราบประเภท`

## 4) Test file แนะนำ

ใช้ไฟล์ที่พบจริงใน Drive:

```text
แบบประเมินกิจกรรม การฝึกทหารตามแผนนภาภิบาล การฝึกร่วม 4 ชั้นปี_aeeb053b.xlsx
```

Expected:

- category = `นภาภิบาล`
- output sheet มี `Dashboard`, `Items`, `ScoreRows`, `QA_Log`, `Print_Report`
- PDF ถูกสร้างใน `04_รายงานส่งออก_PDF`

## 5) ข้อควรระวัง

- อย่าประมวลผลไฟล์จำนวนมากในรอบแรก
- ตรวจ `QA_Log` ทุกครั้งก่อนใช้ทางราชการ
- ถ้าไฟล์ Excel โครงสร้างต่างกันมาก ให้เพิ่ม parser rule ใน `Code.gs`
