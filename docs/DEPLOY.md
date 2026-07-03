# Deploy Guide — RTAFNC Evaluation Analyzer

## เป้าหมายระบบจริง

ระบบนี้ต้องทำได้ครบตาม workflow:

```text
อัปโหลดไฟล์จากหน้าเว็บ
→ เก็บไฟล์ดิบใน Google Drive
→ แปลง .xlsx/.xls/.csv/.tsv เป็น Google Sheets
→ วิเคราะห์ X / SD / หมวดงาน / QA
→ ส่งออกตารางคำนวณ Excel/Sheet
→ ส่งออก PDF
→ ย้ายไฟล์ต้นฉบับไปโฟลเดอร์ประมวลผลแล้ว
```

## สถาปัตยกรรมที่ใช้จริง

```text
GitHub Pages = Portal / Dashboard / ปุ่มเปิดระบบ
Apps Script Web App = หน้า Upload จริง + Process Engine
Google Drive = Storage ไฟล์ดิบ ผลลัพธ์ PDF และ QA Log
```

## 1) Deploy Backend: Google Apps Script แบบง่ายที่สุด

ใช้ไฟล์เดียวจบ: `google-apps-script/Code.gs`

1. เปิด https://script.google.com
2. เปิด Project เดิมหรือสร้าง Project ใหม่ชื่อ `RTAFNC Evaluation Analyzer Backend`
3. เปิดไฟล์ `.gs` หลัก เช่น `รหัส.gs` หรือ `Code.gs`
4. ลบโค้ดเดิมออกทั้งหมด
5. วางโค้ดจาก `google-apps-script/Code.gs` รุ่น v3 Production Single File
6. เปิด Project Settings → ติ๊ก `Show appsscript.json manifest file in editor`
7. วาง `google-apps-script/appsscript.json`
8. ไปที่ Services → Add a service → เลือก `Drive API` → version v3
9. กด Save
10. Deploy → Manage deployments → Edit
11. Version เลือก `New version`
12. Execute as: `Me`
13. Who has access: สำหรับ pilot ใช้ `Anyone with the link` หรือจำกัดตามนโยบายหน่วย
14. กด Deploy

> รุ่น v3 ไม่ต้องสร้าง `Upload.html` แล้ว เพราะหน้า Upload ถูกฝังใน `Code.gs` โดยตรง

## 2) ใช้งานระบบจริง

เปิด Google Apps Script Web App URL โดยตรง จะเจอหน้า Upload จริง มีปุ่ม:

- `อัปโหลดเข้า Drive อย่างเดียว`
- `อัปโหลด + แปลง + ประมวลผลทันที`
- `รีเฟรชรายการไฟล์`
- `ประมวลผลไฟล์รอคิว`

## 3) ใช้งานผ่าน GitHub Pages Dashboard

1. เปิด GitHub Pages URL ของ repo
2. กด `เปิดหน้าอัปโหลดจริง`
3. หรือกด `ตรวจไฟล์ใน Drive`
4. ถ้าเห็นไฟล์ใน `00_วางไฟล์ที่นี่` แล้วค่อยกด `ประมวลผลคิว`

## 4) โครง folder Google Drive

- รับไฟล์ดิบ: `02_ข้อมูลดิบจากแบบประเมิน/00_วางไฟล์ที่นี่`
- ประมวลผลแล้ว: `02_ข้อมูลดิบจากแบบประเมิน/01_ประมวลผลแล้ว`
- ไม่ทราบประเภท: `02_ข้อมูลดิบจากแบบประเมิน/99_ไม่ทราบประเภท`
- Excel/Sheet: `03_สรุปผลและตารางคำนวณ`
- PDF: `04_รายงานส่งออก_PDF`
- QA/Log: `RTAFNC_Evaluation_Process_Log_2568` ในโฟลเดอร์สรุปผล

## 5) Test file แนะนำ

ใช้ไฟล์ที่พบจริงใน Drive:

```text
แบบประเมินกิจกรรม การฝึกทหารตามแผนนภาภิบาล การฝึกร่วม 4 ชั้นปี_aeeb053b.xlsx
```

Expected:

- category = `นภาภิบาล`
- output sheet มี `Dashboard`, `Items`, `ScoreRows`, `QA_Log`, `Print_Report`
- PDF ถูกสร้างใน `04_รายงานส่งออก_PDF`
- ไฟล์ต้นฉบับย้ายไป `01_ประมวลผลแล้ว`

## 6) ข้อควรระวัง

- ทดสอบทีละ 1 ไฟล์ก่อนเปิดใช้งานจริง
- ตรวจ `QA_Log` ทุกครั้งก่อนใช้ทางราชการ
- ถ้าไฟล์ Excel โครงสร้างต่างกันมาก ให้เพิ่ม parser rule ใน `Code.gs`
- ถ้าหน้าเว็บยังเป็นรุ่นเก่า ต้อง redeploy Apps Script เป็น `New version`
