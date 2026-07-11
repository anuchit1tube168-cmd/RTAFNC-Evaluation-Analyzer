# Golden Template Map — แผนกปกครอง วพอ.พอ.

## Golden References in Google Drive

### Reference A — Visual/Structure

Title: `แบบประเมินคุณลักษณะทางทหารและอัตลักษณ์ของนักเรียนพยาบาลทหารอากาศ (นพอ.ทุกชั้นปี)แก้ไขงาม สง่า.xlsx`

Drive ID: `1YMnxP9IXHRdjymtL6CRV5-S3iBTqzRjw`

Use for:

- heading hierarchy
- unit naming
- academic-year placement
- official evaluation-report tone
- readable summary-table structure

Do not use for:

- parent evaluation question content
- automatic class/year inference
- copying numbered item headers as question text

### Reference B — Data/Calculation Pattern

Title: `แบบประเมินคุณลักษณะทางทหารและอัตลักษณ์ของนักเรียนพยาบาลทหารอากาศ (นพอ.ทุกชั้นปี)แก้ไข 2.xlsx`

Drive ID: `1MgU_BOg9c75n_cZD-rrMd6SZv0NUMqk8`

Observed pattern:

- report heading contains `ผลประเมินต่างแผนกปกครอง วพอ.พอ. ปีการศึกษา ...`
- identity columns precede item scores
- item-score columns are followed by `X` and `SD`
- summary columns must not be treated as questions

## Mapping to Parent Evaluation System

| Golden element | Parent system output | Rule |
|---|---|---|
| Unit heading | แผนกปกครอง วิทยาลัยพยาบาลทหารอากาศ | exact unit name |
| Academic year | ปีการศึกษา XXXX | source-driven only |
| Report subject | รายงานผลการประเมินผู้ปกครอง | activity-specific |
| Identity | studentId/studentName/parentName | no unnecessary disclosure |
| Item columns | PE_Item_Dictionary itemText | real text required |
| X / Mean | average | 2 decimals |
| SD | sd | 2 decimals |
| Interpretation | level | 5-level rule |
| Comment section | comments | preserve all nonblank comments |
| Approval | signature block | officer of governance section |

## Correct Official PDF Template

```text
รายงานผลการประเมินผู้ปกครอง
แผนกปกครอง วิทยาลัยพยาบาลทหารอากาศ กรมแพทย์ทหารอากาศ
ปีการศึกษา XXXX

ชื่อกิจกรรม: ...
วันที่ดำเนินกิจกรรม: ...

1. สรุปผลการประเมิน
   จำนวนผู้ตอบ | ค่าเฉลี่ย | S.D. | ระดับ

2. ผลการประเมินรายข้อ
   ข้อ | รายการประเมิน | n | ค่าเฉลี่ย | S.D. | แปลผล

3. ข้อเสนอแนะจากผู้ปกครอง

4. หมายเหตุและการรับรองข้อมูล

(ลงชื่อ) ........................................
เจ้าหน้าที่แผนกปกครอง วพอ.พอ.
```

## Formatting Rules

- Font: TH Sarabun New
- Main title: 20 pt bold centered
- Unit/year: 16 pt centered
- Body: 16 pt
- Table body: 14 pt
- Header fill: light military blue
- Average/S.D.: 2 decimals
- Use Thai official wording, concise and factual

## Critical Differences from Historical Workbook

1. Historical workbook may display item numbers only; new report must show real item text.
2. Historical workbook may contain class-year-specific sheets; new system may only use class/year when source explicitly provides it.
3. `X`, `SD`, totals and percentages are derived fields, never Item Dictionary entries.
4. Golden file style can be copied; data meaning cannot be assumed.
5. PDF must include comments and data-certification note, which may not exist in older files.

## Template Acceptance

Template is accepted only when:

- unit name is correct
- academic year comes from source
- question text is real
- average/S.D. use 2 decimals
- summary columns are excluded from import
- comments remain present
- signature block exists
- visual PDF is checked after actual export
