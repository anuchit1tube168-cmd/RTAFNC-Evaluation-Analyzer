# UI Spec — Modern Dashboard แผนกปกครอง

## Brand

- Primary: Military Navy `#071A33`
- Secondary: Blue `#2563EB`
- Accent: Cyan `#06B6D4`
- Success: `#079669`
- Warning: `#D97706`
- Error: `#DC2626`
- Font stack: Noto Sans Thai / Leelawadee UI / Tahoma
- PDF font: TH Sarabun New

## Layout

### Desktop

- Sidebar 280 px
- Main content fluid
- Hero + KPI cards
- Form cards 2 columns
- Tables scroll inside container

### Mobile

- Single-column form
- Navigation collapses/scrolls safely
- Rating buttons 1–5 remain tappable
- No horizontal page overflow
- Primary action button full width where needed

## Navigation

1. ทำแบบประเมิน
2. ตั้งค่าระบบ
3. สร้างกิจกรรม
4. นำเข้าข้อมูล
5. รายงานผล

Default page: ทำแบบประเมิน

## Public Form Components

- ปีการศึกษา
- ปุ่มโหลดกิจกรรม
- Activity select
- รหัสนักเรียน (optional)
- ชื่อ-สกุลนักเรียน (required)
- ชื่อผู้ปกครอง (required)
- ความสัมพันธ์
- Item cards
- Rating 1–5
- Progress bar
- ข้อเสนอแนะ
- Submit button

Rating legend:

```text
5 มากที่สุด
4 มาก
3 ปานกลาง
2 น้อย
1 น้อยที่สุด
```

## Admin Components

### Setup

- masked credential field
- Setup
- Health
- Self Test
- Diagnostic
- status orb and diagnostic list

### Activity

- academic year
- activity date
- activity name
- multiline real item text
- validation callout

### Import

- Spreadsheet ID
- source sheet name
- academic year
- activity name
- header row (default 1)
- result KPI: imported/review/item count
- duplicate warning

### Reports

- academic year filter
- activity selector/ID
- dashboard button
- activity PDF button
- exact student ID/name fields
- individual report/PDF buttons

## UI States

### Loading

Overlay + spinner + action-specific text

### Empty

Illustration/icon + reason + next action

### Success

Toast and status chip PASS

### Review

Amber toast/status and visible reason

### Error

Red toast/status, exact server message, no silent failure

## Accessibility

- Labels associated visually with every input
- Buttons use text, not icon only
- Contrast AA target
- Touch target >= 40 px
- Keyboard focus visible
- Status not represented by color alone

## Content Rules

- Use Thai first; English only for technical labels
- Unit name exactly: `แผนกปกครอง วพอ.พอ.`
- Avoid `RTAFNC Direct Upload` on default route
- Avoid technical JSON on public form; keep console in collapsible admin area
