# Data Schema — Parent Evaluation

## PE_Activities

| Field | Type | Required | Rule |
|---|---|---:|---|
| activityId | text | yes | `PE-XXXXXXXX`, unique |
| academicYear | text | yes | 4 digits |
| activityName | text | yes | normalized, duplicate blocked per year |
| activityDate | text | no | Thai display date allowed |
| ownerUnit | text | yes | default แผนกปกครอง วพอ.พอ. |
| status | text | yes | ACTIVE / INACTIVE |
| createdAt | datetime text | yes | Asia/Bangkok |

## PE_Item_Dictionary

| Field | Type | Required | Rule |
|---|---|---:|---|
| activityId | text | yes | foreign key to PE_Activities |
| itemNo | integer | yes | starts at 1, continuous |
| itemText | text | yes | real question text, length >= 5 |
| itemType | text | yes | Likert 1-5 |
| maxScore | integer | yes | 5 |
| sourceSheet | text | no | web or source tab |
| sourceColumn | text | no | A/B/C... |
| qaStatus | text | yes | PASS / REVIEW |
| createdAt | datetime text | yes | Asia/Bangkok |

## PE_Responses

| Field | Type | Required | Rule |
|---|---|---:|---|
| responseId | text | yes | `RESP-XXXXXXXXXX`, unique |
| timestamp | datetime text | yes | Asia/Bangkok |
| activityId | text | yes | foreign key |
| academicYear | text | yes | copied from activity |
| studentId | text | no | exact-match key when present |
| studentName | text | yes | normalized full name |
| parentName | text | yes for public | normalized full name |
| relationship | text | no | father/mother/guardian |
| scoresJson | JSON text | yes | ordered by itemNo |
| answeredCount | integer | yes | valid scores count |
| itemCount | integer | yes | Item Dictionary count |
| average | number | yes when scores exist | 2 decimals |
| sd | number | yes when scores exist | population S.D., 2 decimals |
| level | text | yes | 5-level interpretation |
| comments | text | no | max 2000 chars |
| qaStatus | text | yes | PASS / REVIEW |

## PE_Imports

| Field | Type | Required | Rule |
|---|---|---:|---|
| importId | text | yes | `IMP-XXXXXXXXXX`, unique |
| timestamp | datetime text | yes | Asia/Bangkok |
| fingerprint | SHA-256 hex | yes | unique for unchanged source set |
| sourceSpreadsheetId | text | yes | Google Sheet ID |
| sourceSheetName | text | yes | actual source tab |
| academicYear | text | yes | 4 digits |
| activityId | text | yes | created activity |
| activityName | text | yes | normalized |
| rowCount | integer | yes | imported response rows |
| itemCount | integer | yes | imported question columns |
| status | text | yes | PASS / REVIEW |

## PE_QA_Log

| Field | Type | Required | Rule |
|---|---|---:|---|
| timestamp | datetime text | yes | Asia/Bangkok |
| scope | text | yes | function/process name |
| status | text | yes | PASS / REVIEW / FAIL |
| message | text | yes | human-readable |
| detailsJson | JSON text | no | evidence details |

## Relationships

```text
PE_Activities 1 ── * PE_Item_Dictionary
PE_Activities 1 ── * PE_Responses
PE_Activities 1 ── * PE_Imports
PE_Imports    1 ── * PE_Responses (logical receipt link by activityId)
```

## Migration Rule

- Add missing sheet non-destructively
- Existing header mismatch → stop with error
- Never clear or delete production sheet automatically
- Any header change requires versioned migration and backup receipt
