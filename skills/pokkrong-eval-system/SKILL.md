---
name: pokkrong-eval-system
description: Use for RTAFNC direct upload assessment processing, canonical JSON, Google Sheet output, PDF output, and category expansion.
---

# Pokkrong Eval System Skill

## Architecture

Browser Direct Upload -> SheetJS parser -> canonical JSON -> Apps Script -> Google Sheet + PDF in Drive.

This module extends RTAFNC Evaluation Analyzer and does not replace the v6 Drive Queue workflow.

## Rules

- Read the real file first.
- Let the user review detected columns before processing.
- Scores must be 1 to 5. Other values are saved as blank.
- A successful run must return both a spreadsheet link and a PDF link.
- Do not break the existing v6 queue workflow.
- If question headers look like Q1 or Column, mark QA as REVIEW.

## Runtime functions

- buildUploadPage_ opens the Direct Upload page.
- pokkrongHealth checks backend config.
- pokkrongProcess creates the workbook and PDF.
- doPost accepts JSON or form payload.

## Done

PASS means Direct Upload opens, parses a file, user confirms, backend returns SUCCESS, and outputSpreadsheetUrl plus pdfUrl exist.
