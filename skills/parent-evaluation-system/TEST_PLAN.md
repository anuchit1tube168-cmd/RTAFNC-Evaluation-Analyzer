# Test Plan — Parent Evaluation System

## Test Levels

1. Static validation
2. Pure function self test
3. Database diagnostic
4. Functional integration
5. Runtime UI
6. PDF visual verification
7. Security verification

## Environment

- Google Apps Script V8
- Time zone: Asia/Bangkok
- Web app execute as: USER_DEPLOYING
- Browser: Chrome desktop + mobile viewport
- Test academic year: 2569
- Test activity prefix: `[TEST]`

## T01 — Static Project Validation

Command:

```bash
python3 scripts/validate_parent_evaluation.py
```

Expected:

- required files complete
- architecture markers complete
- no destructive schema operation
- Apps Script/JavaScript syntax passes
- manifest scopes complete

## T02 — Self Test

Function:

```javascript
parentSelfTest()
```

Expected:

```json
{
  "status": "PASS",
  "allPass": true
}
```

Checks:

- accept real item text
- reject Q1
- reject Column 4
- reject average column
- mean and level rules
- name normalization

## T03 — Setup and Schema

Function:

```javascript
parentSetup({adminKey: "<TEST_ADMIN_KEY>"})
parentDiagnostic({adminKey: "<TEST_ADMIN_KEY>"})
```

Expected sheets:

- PE_Activities
- PE_Item_Dictionary
- PE_Responses
- PE_Imports
- PE_QA_Log

Expected:

- no existing data cleared
- headers exact
- template files load
- allPass true

## T04 — Create Activity

Input:

```javascript
parentCreateActivity({
  adminKey: "<TEST_ADMIN_KEY>",
  academicYear: "2569",
  activityName: "[TEST] ประชุมผู้ปกครอง",
  items: [
    "ความเหมาะสมของระยะเวลาในการจัดกิจกรรม",
    "ความชัดเจนของการสื่อสารจากวิทยาลัย",
    "ประโยชน์ที่ได้รับจากกิจกรรม"
  ]
})
```

Expected:

- PASS
- itemCount = 3
- Item Dictionary has real text

Negative:

- Q1 → REVIEW/no write
- year 69 → error
- duplicate activity → REVIEW

## T05 — Public Response

Input scores: `[5,4,4]`

Expected:

- PASS
- average = 4.33
- answeredCount = itemCount = 3
- saved identity and comments

Negative:

- blank student name → error/no write
- blank parent name → error/no write
- missing score → error/no write
- score 6 → error/no write

## T06 — Import New Dataset

Template headers:

```text
ประทับเวลา
รหัสนักเรียน
ชื่อ-สกุลนักเรียน
ชื่อผู้ปกครอง
ความสัมพันธ์
ความเหมาะสมของกิจกรรม
ความชัดเจนของการสื่อสาร
ค่าเฉลี่ย
S.D.
ข้อเสนอแนะ
```

Expected:

- question columns imported
- ค่าเฉลี่ย and S.D. excluded
- batch write
- PE_Imports receipt created
- fingerprint returned

## T07 — Duplicate Import

Run T06 again without changing source data.

Expected:

```json
{
  "status": "REVIEW",
  "alreadyImported": true
}
```

No new activity/response rows.

## T08 — Dashboard

Expected:

- filter by academicYear/activityId
- responseCount correct
- average and S.D. 2 decimals
- itemStats contains every item
- passCount + reviewCount = responseCount

## T09 — Individual Report

Search by exact studentId.

Expected:

- only one identity
- all activities for academic year
- itemDetails complete

Search by partial name.

Expected:

- no accidental partial match
- duplicate exact names across IDs → REVIEW

## T10 — Security

Without Admin Key:

- create activity rejected
- import rejected
- dashboard rejected
- individual report rejected
- PDF rejected

Public allowed:

- list activities
- get items
- save complete response
- health without database details

## T11 — Routes

- `/exec` → Modern Dashboard
- `/exec?mode=parent` → Modern Dashboard
- `/exec?mode=upload` → Direct Upload v6
- API action → JSON/JSONP

## T12 — PDF Activity

Expected visual template:

- official title
- unit name
- academic year
- summary table
- per-item table
- comments
- note
- signature block
- TH Sarabun New

## T13 — PDF Individual

Expected:

- exact student identity
- overall summary
- all activities
- every item score
- comments
- signature block

## T14 — UI Responsive

Desktop:

- sidebar visible
- 2-column cards
- tables scroll safely

Mobile:

- navigation usable
- form single column
- rating buttons fit
- no horizontal page overflow

## Evidence Required

For every test run store:

```text
Test ID
Date/time
Environment
Commit SHA
Input/source
Expected
Actual
Status
Screenshot/log URL
Tester
Risk/notes
```

## Cleanup

- mark `[TEST]` activities inactive or remove only test rows through an approved cleanup function
- never delete production sheets
- never clear entire database
