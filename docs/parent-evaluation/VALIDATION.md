# Validation Rules — Parent Evaluation

## Academic Year

- required for activity, import and individual report
- exactly 4 digits
- never infer class/year grouping without source

## Activity

- name required
- normalized whitespace
- exact duplicate in same academic year returns REVIEW
- item count 1–200

## Item Text

Reject when:

- empty
- shorter than 5 characters
- Q followed by digits
- Question followed by digits
- Column followed by digits
- คอลัมน์ followed by digits
- digits only

## Scores

- integer or numeric value 1–5
- public form requires every item answered
- average and population S.D. rounded to 2 decimals

Interpretation:

| Range | Level |
|---:|---|
| 4.51–5.00 | มากที่สุด |
| 3.51–4.50 | มาก |
| 2.51–3.50 | ปานกลาง |
| 1.51–2.50 | น้อย |
| 1.00–1.50 | น้อยที่สุด |

## Identity

Public response requires:

- studentName
- parentName

Preferred individual key: studentId exact match

Name fallback: normalized full-name exact match

Partial-name search is not allowed

## Import Column Detection

A candidate item column must:

- not be a metadata column
- not be a summary column
- have at least one valid score
- have valid 1–5 scores in at least 70% of non-empty cells
- have valid item text

Summary headers rejected:

```text
X, x̄, Mean, Average, Avg, SD, S.D., Std, Total, Sum,
Percent, Percentage, ค่าเฉลี่ย, ส่วนเบี่ยงเบนมาตรฐาน,
รวม, คะแนนรวม, ร้อยละ
```

## Duplicate Import

Fingerprint inputs:

- source spreadsheet ID
- source sheet name
- academic year
- activity name
- item texts
- identity + scores of prepared rows

Existing PASS fingerprint → REVIEW/no write

## Security

Public allowed:

- health without database details
- list activities
- get items
- save complete response

Admin required:

- setup/diagnostic details
- create activity
- import
- dashboard
- individual report
- PDF export

## Schema Safety

- missing sheet can be added
- header mismatch must stop
- no automatic clear/delete
- write operations use script lock

## Report Template

Activity PDF must include:

- official title
- unit and academic year
- activity/date
- summary table
- item table
- comments
- data note
- signature block
- TH Sarabun New

Individual PDF must include:

- exact identity
- overall summary
- all activities
- every item score
- comments
- signature block

## Status Rules

PASS: valid and evidence complete

REVIEW: incomplete imported identity, duplicate, ambiguity, no data, or runtime unverified

FAIL: security/schema/template integrity failure
