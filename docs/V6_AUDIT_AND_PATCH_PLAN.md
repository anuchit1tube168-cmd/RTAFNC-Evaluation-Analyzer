# V6 Audit and Patch Plan

## Audit Result

Claude has improved the backend in the right direction, but the system is not yet v6-compliant.

## Current good points

- Parser reads wide/matrix form.
- Parser uses real question header text instead of creating Q1/column names.
- Parser has Thai name cleaning to prevent broken Thai names.
- Output creates Item_Dictionary.
- Output creates Individual_All_Items with per-item score columns.

## Blocking issues before production

### 1) Per-class reports must not be invented

Current code defines year report groups for year 1, 2, 3, 4 by default. In v6, year reports may be generated only when the year value comes from a trusted source.

Required rule:

```text
If no trusted year source exists, create only the combined report and mark per-class export as REVIEW or SKIPPED.
```

### 2) Empty year reports must not count as success

Current QA treats missing year groups as warnings and still expects 5 PDFs. In v6, empty year reports are not success.

Required rule:

```text
Year 1/2/3/4 PDF is created only if source data has that year.
No source = no PDF, no invented class split.
```

### 3) Q1 / column names must be a hard failure

Any final report with Q1, Q2, คอลัมน์_4, คอลัมน์_5 as item text must be REVIEW.

### 4) Item_Dictionary must be the source of truth

Every Items_X_SD and Individual_All_Items column must map to Item_Dictionary.

### 5) PDF should summarize, Excel should store all details

PDF should not compress all person-by-item scores. Excel must keep all individual item scores with question text.

## Patch order

1. Patch group generation: create year reports only from trusted source.
2. Patch QA Gate: empty year group is not PASS, and 5 PDFs are not required unless source supports all years.
3. Patch item validation: reject Q1/Q2/คอลัมน์_4 final item names.
4. Patch Class_Source_Map sheet.
5. Run selftest.
6. Run peek on a real pending file.
7. Process one real file and inspect Excel/PDF.

## Definition of Done

- No invented year split.
- Item_Dictionary contains full question text for every item.
- Individual_All_Items has per-item score columns with question text.
- PDF is print-ready and not overloaded.
- QA_Log clearly states PASS/REVIEW.
