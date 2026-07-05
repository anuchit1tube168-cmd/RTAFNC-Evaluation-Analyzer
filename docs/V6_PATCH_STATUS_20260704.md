# V6 Patch Status — 2026-07-04

## Completed Patches

### Patch 1 — Source-driven report groups

Status: DONE in `google-apps-script/Code.gs`

What changed:

- Backend version changed to `v6-source-driven-reports`.
- Removed hard-coded success assumption for year 1-4 reports.
- New `buildSourceDrivenReportGroups_()` creates:
  - combined report always
  - year reports only when respondents contain year values from source data
- Added `Class_Source_Map` sheet.
- Output records `classYearSource`.

Acceptance rule:

```text
No source year = no invented per-class PDF.
```

### Patch 2 — QA hard failure for fake item headers

Status: DONE in `google-apps-script/ZZ_Parser_QA_v6_Override.gs`

What changed:

- Added `pIsBadItemTextV6_()`.
- Added hard failure for:
  - Q1
  - Q2
  - Question 1
  - Column 4
  - คอลัมน์_4
  - ข้อ 1 without question text
- Added failure if per-class report group has no source/data.

Acceptance rule:

```text
Fake item headers = REVIEW, never PASS.
```

### Patch 3 — V6 selftest

Status: DONE in `google-apps-script/ZZ_SelfTest_v6.gs`

What changed:

- Selftest checks good case:
  - real question text
  - Thai name not broken
  - source-driven group creation
  - no invented year 3/4
- Selftest checks bad case:
  - Q1/Q2 must be REVIEW

Acceptance rule:

```text
?action=selftest must prove both good and bad cases.
```

### Deploy Trigger

Status: TRIGGERED

File added:

```text
google-apps-script/deploy-trigger-v6-selftest.txt
```

Latest trigger commit:

```text
d6622d0a7aebbbf034b7bc6d5b000f7dab710c6a
```

## Not Yet Verified

These are still not confirmed:

```text
[ ] GitHub Actions deploy succeeded
[ ] Apps Script URL health shows v6-source-driven-reports
[ ] ?action=selftest returns allPass=true
[ ] ?action=peek passes on real file
[ ] one real file processes successfully
[ ] Excel output passes QA
[ ] PDF output is print-ready
```

## Next Step

1. Check GitHub Actions run manually.
2. Open Apps Script URL:

```text
?action=health
?action=selftest
?action=peek
```

3. Only process one real file after `selftest` and `peek` pass.
