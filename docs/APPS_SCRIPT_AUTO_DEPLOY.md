# ตั้งค่าให้ GitHub แก้ Apps Script ได้อัตโนมัติ

## เป้าหมาย

เมื่อแก้ไฟล์ใน `google-apps-script/**` บน GitHub ให้ GitHub Actions ใช้ `clasp push --force` ส่งโค้ดเข้า Apps Script Project เดิมทันที

## 1) เปิด Apps Script API

เปิด Apps Script Dashboard → Settings แล้วเปิด `Google Apps Script API`

## 2) ติดตั้ง clasp ในเครื่อง Boss ครั้งเดียว

```bash
npm install -g @google/clasp
clasp login
```

## 3) เตรียม project mapping

เข้าโฟลเดอร์งาน แล้วสร้าง `.clasp.json` ด้วย Script ID ของ Apps Script Project เดิม

```json
{
  "scriptId": "PASTE_SCRIPT_ID_HERE",
  "rootDir": "google-apps-script"
}
```

หา Script ID ได้จาก Apps Script → Project Settings → Script ID

## 4) ดึงค่า secret

หลัง `clasp login` จะมีไฟล์ credential ที่เครื่อง:

```text
~/.clasprc.json
```

ต้องเอาค่า 2 ตัวไปใส่ใน GitHub Repo → Settings → Secrets and variables → Actions → New repository secret

### Secret 1

Name:

```text
CLASPRC_JSON
```

Value: เนื้อหาทั้งหมดในไฟล์ `~/.clasprc.json`

### Secret 2

Name:

```text
CLASP_JSON
```

Value:

```json
{
  "scriptId": "PASTE_SCRIPT_ID_HERE",
  "rootDir": "google-apps-script"
}
```

## 5) วิธีใช้งาน

หลังจากใส่ secret แล้ว ระบบจะ deploy เองเมื่อมีการแก้ไฟล์ใน:

```text
google-apps-script/**
```

หรือสั่งเองได้ที่ GitHub → Actions → Deploy Apps Script Backend → Run workflow

## 6) ข้อควรระวัง

- อย่า commit `.clasprc.json` หรือ `.clasp.json` ลง GitHub
- `CLASPRC_JSON` คือ credential สำคัญ ต้องเก็บใน GitHub Secret เท่านั้น
- หลัง workflow push สำเร็จ อาจยังต้องจัดการ Web App deployment/version ตามนโยบายของ Apps Script Project
