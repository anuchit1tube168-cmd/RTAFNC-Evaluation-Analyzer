# Local setup checklist สำหรับ Boss

## คำสั่งที่ต้องรันในเครื่องครั้งเดียว

```bash
npm install -g @google/clasp
clasp login
```

## เช็กไฟล์ credential

macOS/Linux:

```bash
cat ~/.clasprc.json
```

นำค่าทั้งหมดไปใส่ GitHub Secret ชื่อ `CLASPRC_JSON`

## สร้างค่า CLASP_JSON

เอา Script ID จาก Apps Script → Project Settings → Script ID แล้วใส่ในรูปแบบนี้:

```json
{
  "scriptId": "PASTE_SCRIPT_ID_HERE",
  "rootDir": "google-apps-script"
}
```

นำ JSON ทั้งก้อนไปใส่ GitHub Secret ชื่อ `CLASP_JSON`

## ทดสอบ

หลังใส่ secret แล้วไปที่:

GitHub → Actions → Deploy Apps Script Backend → Run workflow

ถ้า success แปลว่า GitHub สามารถแก้ Apps Script Project ได้แล้ว
