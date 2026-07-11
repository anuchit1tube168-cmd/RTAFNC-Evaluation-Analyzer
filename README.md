# RTAFNC Evaluation Analyzer

ระบบประมวลผลและแปลผลแบบประเมินของวิทยาลัยพยาบาลทหารอากาศ โดยมี 2 โมดูลที่อยู่ร่วมกัน:

1. **Parent Evaluation System** — ระบบแปลผลการประเมินผู้ปกครองของแผนกปกครอง วพอ.พอ.
2. **Direct Upload v6** — ระบบประมวลผล Excel/CSV เดิม

## ทางเข้าระบบ

```text
/exec                 Modern Parent Evaluation Dashboard
/exec?mode=parent     Modern Parent Evaluation Dashboard
/exec?mode=upload     Direct Upload v6 เดิม
```

## Architecture

```text
Apps Script HTMLService Modern UI
        ↓ google.script.run
Google Apps Script backend
        ↓
Google Sheet state database
  - PE_Activities
  - PE_Item_Dictionary
  - PE_Responses
  - PE_Imports
  - PE_QA_Log
        ↓
Google Drive PDF outputs
```

ระบบ Direct Upload v6 ยังคงใช้โฟลเดอร์ Drive เดิมตามค่าใน `google-apps-script/Code.gs`

## Source of Truth

- **GitHub** — source code, Skill, Spec, test and release history
- **Google Drive** — Golden Template, previews, tested ZIP and PDF outputs
- **Google Sheet** — operational state database and receipt index
- **Local export** — backup only

## Parent Evaluation v1.3

จุดสำคัญ:

- แยกปีการศึกษาและกิจกรรม
- Item Dictionary ใช้ข้อความคำถามจริง
- Public form ตรวจชื่อผู้เรียน ชื่อผู้ปกครอง และคะแนนครบ 1–5 ฝั่ง server
- Admin functions ป้องกันด้วย Admin Key
- Import แบบ batch พร้อม SHA-256 fingerprint และ `PE_Imports` receipt
- ตัด X/S.D./ค่าเฉลี่ย/รวม/ร้อยละออกจาก question columns
- รายบุคคลค้นด้วยรหัส exact match หรือชื่อเต็ม exact normalized match
- PDF ใช้ Template `official-governance-v1` และ TH Sarabun New
- Schema migration ไม่ล้างข้อมูลเดิม

## Skill Pack

โฟลเดอร์:

```text
skills/parent-evaluation-system/
├── SKILL.md
├── LLM_WIKI.md
├── CHECKLIST.md
├── TEST_PLAN.md
├── EXAMPLES.md
└── AGENT_INJECTION.md
```

Workflow บังคับ:

```text
INSPECT → DESIGN → BUILD → VERIFY → DELIVER
```

ห้ามรายงาน PASS หากยังไม่มี runtime URL, Diagnostic และหลักฐาน

## Specification Pack

```text
docs/parent-evaluation/
├── PRD.md
├── DATA_SCHEMA.md
├── USER_FLOW.md
├── UI_SPEC.md
├── VALIDATION.md
├── DEPLOYMENT_PLAN.md
├── GOLDEN_TEMPLATE_MAP.md
└── QA_RECEIPT_TEMPLATE.md
```

Golden Template ใน Drive ใช้เป็นโครงภาพ/รูปแบบรายงานเท่านั้น ข้อคำถามต้องมาจาก `PE_Item_Dictionary` จริง ห้ามนำเลขข้อ 1–54 มาใช้แทนข้อความคำถาม

## Static Validation

```bash
python3 scripts/validate_parent_evaluation.py
```

ตรวจ:

- Required files
- Skill/Spec templates
- Apps Script และ frontend JavaScript syntax
- Route markers
- Non-destructive schema
- Import fingerprint/batch write
- Official PDF template markers
- Manifest scopes

GitHub Actions จะรัน validation ก่อน `clasp push` และ redeploy

## Automated Deployment

Workflow:

```text
.github/workflows/apps-script-deploy.yml
```

Steps:

1. Checkout
2. Setup Node 20
3. Run validation gate
4. Stage `.gs`, `.html`, `appsscript.json`
5. Append sorted `ZZ_*.gs` overrides to `Code.gs` last
6. `clasp push --force`
7. Redeploy existing deployment ID

Required secrets:

- `CLASP_JSON`
- `CLASPRC_JSON`
- `APPS_SCRIPT_DEPLOYMENT_ID` (recommended)

## Runtime Acceptance

หลัง deploy ต้องตรวจ:

1. URL หลักเปิด Modern Dashboard
2. `?mode=upload` ยังเปิด Direct Upload v6
3. `parentSelfTest()` → `allPass: true`
4. `parentDiagnostic()` → `allPass: true`
5. สร้างกิจกรรมด้วยข้อความคำถามจริง
6. Public response บันทึกครบและปฏิเสธคะแนนไม่ครบ
7. Import ใหม่ผ่าน
8. Import ซ้ำถูกปฏิเสธ
9. Dashboard รายข้อครบ
10. PDF กิจกรรมและรายบุคคลผ่าน visual check
11. Mobile layout ผ่าน
12. มี QA receipt, commit SHA และ rollback commit

## Status Rule

- **PASS** — static + workflow + runtime + PDF visual evidence ครบ
- **REVIEW** — code ผ่านแต่ runtime/deploy/evidence ยังไม่ครบ
- **FAIL** — schema/security/template/item integrity ผิด

## Pilot

เริ่มใช้งานแบบ Pilot กับกิจกรรมจริง 1 กิจกรรมก่อนเปิดทั้งองค์กร และเก็บ QA Receipt ตาม `docs/parent-evaluation/QA_RECEIPT_TEMPLATE.md`
