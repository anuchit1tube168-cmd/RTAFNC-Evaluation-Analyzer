# Delivery Note — Parent Evaluation System v1.3

## Status

```text
STATUS: REVIEW
```

เหตุผล: Source code, Skill Pack, Spec Pack และ validation gate ถูกจัดทำแล้ว แต่ GitHub connector ยังไม่แสดง workflow run และยังไม่มีหลักฐาน runtime Diagnostic/PDF visual check ของ deployment ล่าสุด จึงห้ามรายงาน PASS

## Scope

- Modern Parent Evaluation Dashboard
- Database schema
- Public form validation
- Admin security
- Import/duplicate protection
- Dashboard and individual report
- Official PDF template
- Skill/Spec/QA templates
- GitHub Actions validation gate

## Version

```text
System: parent-evaluation-v1.3.0
PDF Template: official-governance-v1
Unit: แผนกปกครอง วพอ.พอ.
```

## Source

- Repository: `anuchit1tube168-cmd/RTAFNC-Evaluation-Analyzer`
- Apps Script source: `google-apps-script/`
- Skill: `skills/parent-evaluation-system/`
- Specs: `docs/parent-evaluation/`
- Validation: `scripts/validate_parent_evaluation.py`
- Workflow: `.github/workflows/apps-script-deploy.yml`

## Root Causes Corrected

1. URL หลักเปิด Direct Upload v6 แทน Modern Dashboard
2. ไม่มี Skill Pack และ Spec Pack เฉพาะระบบ
3. Import เขียนทีละแถวและไม่มี receipt/fingerprint
4. Import มีโอกาสนำชุด REVIEW ซ้ำ
5. Summary columns อาจถูกมองเป็นคำถาม
6. Public response พึ่ง frontend validation มากเกินไป
7. รายบุคคลใช้ partial name และเสี่ยงรวมผิดคน
8. สถิติรวมแถว REVIEW
9. Admin actions รับรหัสผ่าน GET URL
10. การตั้ง Admin Key ครั้งแรกเสี่ยงถูกผู้เข้าชมยึดก่อนเจ้าของ
11. PDF เดิมยังไม่ยึด Template แผนกปกครองครบ
12. Workflow deploy ไม่มี validation gate ก่อน push

## Changes Completed

### Data and Backend

- Schema 5 sheets: Activities, Item Dictionary, Responses, Imports, QA Log
- Non-destructive schema guard
- Script Lock for writes
- Server-side identity and complete-score validation
- Batch Item Dictionary and response import writes
- SHA-256 import fingerprint
- Duplicate import blocked for PASS and REVIEW receipts
- Summary-column exclusion
- Exact identity matching
- PASS-only statistics; REVIEW remains visible for correction

### Security

- Parent admin GET/JSONP routes blocked
- Admin Key is never accepted from URL query
- First-time Admin Key must be configured by owner in Script Properties
- Setup only verifies an already configured key
- Public Health does not expose database details

### UI

- Modern dashboard remains default route
- Header-row control added to Import UI
- Activity selector added to report UI
- PASS/REVIEW KPIs separated
- Import receipt/fingerprint shown
- Server `ok:false` stops success callback

### Reports

- TH Sarabun New
- Official unit heading
- Academic year/activity summary
- Per-item real question text
- Comments section
- Data certification note
- Signature block
- Individual report with every item score

### Knowledge and Process

- 6-file Skill Pack
- PRD/Data Schema/User Flow/UI Spec/Validation/Deployment Plan
- Golden Template Map
- Admin Setup
- QA Receipt Template
- Test Plan
- Static validation script
- GitHub Actions pre-deploy gate

## Golden Template Decision

Drive workbooks for military attributes are used only for:

- report hierarchy
- unit naming
- academic-year placement
- X/S.D. interpretation pattern
- official visual tone

They are not used as parent-question content. Parent questions must come from `PE_Item_Dictionary` with real text.

## Verification Available

### Verified by source inspection

- Required source files exist
- Modern template includes CSS and JavaScript
- Router defaults to Modern page
- Upload route remains at `?mode=upload`
- Schema code is non-destructive
- Security blocklist exists
- Import fingerprint and batch writes exist
- Official PDF template helpers exist
- Workflow runs validation before clasp push

### Still required before PASS

- GitHub Actions validation log
- clasp push/redeploy log
- live URL shows v1.3
- Self Test allPass true
- Diagnostic allPass true
- public form functional test
- new import test
- duplicate import rejection test
- activity/individual PDF generation
- visual PDF check
- desktop/mobile screenshots

## Known Risks

1. Existing production Sheet created under an older 4-sheet schema may stop at header/schema validation until owner approves adding `PE_Imports`
2. Old Direct Upload v6 API routes remain public and require a separate security audit
3. Google Apps Script quota/timeout still applies to large files
4. TH Sarabun New rendering must be visually confirmed in exported PDF
5. GitHub connector does not expose current push-triggered workflow runs in this session

## Rollback

Use the last known deployment that opened Direct Upload v6 as a fallback only. For code rollback, revert the v1.3 commits, rerun validation and redeploy the same deployment ID. Record the rollback commit and runtime screenshot.

## Next Ship Gate

Run the GitHub Actions workflow, open the deployed URL, configure the owner-only Script Property, run Setup/Self Test/Diagnostic, test one pilot activity, and attach the evidence to `QA_RECEIPT_TEMPLATE.md`.
