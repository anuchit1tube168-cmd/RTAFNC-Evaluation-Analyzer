# RTAFNC Evaluation Analyzer

ระบบหน้าบ้านสำหรับประมวลผลแบบประเมิน วพอ.พอ. โดยใช้

- **GitHub Pages** เป็นหน้าบ้าน
- **Google Apps Script Web App** เป็น backend
- **Google Drive** เป็นที่เก็บไฟล์ข้อมูลดิบ ผลลัพธ์ Excel/PDF และ QA Log

## โครงระบบ

```text
GitHub Pages Frontend
        ↓ JSONP/GET
Google Apps Script Web App
        ↓ DriveApp + Advanced Drive API
Google Drive folders
```

## โฟลเดอร์ Google Drive ที่ใช้

ค่าตั้งต้นอยู่ใน `google-apps-script/Code.gs`

- `02_ข้อมูลดิบจากแบบประเมิน/00_วางไฟล์ที่นี่`
- `02_ข้อมูลดิบจากแบบประเมิน/01_ประมวลผลแล้ว`
- `02_ข้อมูลดิบจากแบบประเมิน/99_ไม่ทราบประเภท`
- `03_สรุปผลและตารางคำนวณ`
- `04_รายงานส่งออก_PDF`

## วิธีใช้งานเร็ว

1. เปิด Google Apps Script
2. วางไฟล์ `google-apps-script/Code.gs`
3. วาง `google-apps-script/appsscript.json`
4. เปิด Advanced Google Services → Drive API v3
5. Deploy เป็น Web App
6. เปิดหน้า GitHub Pages
7. วาง Web App URL ในช่องตั้งค่า backend
8. กด `ตรวจไฟล์ใน Drive`
9. กด `ประมวลผลไฟล์รอคิว`

## สถานะ

- v1 เป็นระบบ frontend พร้อมเชื่อม backend
- ข้อมูลยังเก็บใน Google Drive ตาม requirement
- ใช้งานจริงควรเริ่มแบบ Pilot ก่อนเปิดทั้งองค์กร
