# Golden-format parser (reference implementation)

`golden_parser.js` = ตัวอ่านไฟล์ตาม `docs/GOLDEN_OUTPUT_FORMAT.md` §9
เขียนเป็น pure JS (Node) ที่ **port เข้า Google Apps Script ได้** (รับ workbook =
`{ sheetName: rows[][] }` แบบเดียวกับ `ss.getSheets()` → `getValues()`)

## ทำอะไร (ประเภทที่ 1: กิจกรรม/ชมรม)
1. **จับคู่** sheet ดิบ `(ชมรมX)` กับ sheet รายงาน `X` — จับตามลำดับที่อยู่ติดกัน
   (robust ต่อชื่อสะกดต่าง เช่น แบด/แบท และวงเล็บหาย เช่น ชมรมกีฑา)
2. **อ่านข้อความคำถามจริง** จาก sheet รายงาน (คอลัมน์ A) — ไม่เดา ไม่เก็บ template
3. **อ่านคะแนนดิบ** จาก sheet ดิบ (header แถว 2, ข้อ1..n)
4. **คำนวณ** `X = AVERAGE`, `SD = STDEV.S`, แถวรวม, `ร้อยละพึงพอใจ` (ผู้ตอบ mean ≥ 3.51),
   ปัด 2 ตำแหน่งด้วย ROUND

## วิธีรัน
```bash
node scripts/golden/golden_parser.test.js   # synthetic unit test (ไม่มีข้อมูลจริง)
```

## ผลตรวจสอบกับไฟล์จริง (golden)
ทดสอบกับไฟล์ทำมือจริง (แบบประเมินแผนกปกครอง 2566, 7 ชมรม):
- **146/147 ข้อ X/SD ตรง golden เป๊ะ**
- **6/7 แถวรวม ตรง**
- **ร้อยละพึงพอใจ ตรงทุกชมรม**
- จุดเดียวที่ไม่ตรง (แอโรบิค ข้อ1) = **golden file กรอกผิด** (SD=1.06 เป็นไปไม่ได้กับคะแนน 1-5)
  parser คำนวณค่าที่ถูกต้อง

> การทดสอบกับไฟล์จริงไม่ commit ลง repo เพราะไฟล์มีชื่อนักเรียน (PII)
> ทำ local: dump workbook เป็น JSON แล้ว `require` เข้า test

## ต่อไป
- เพิ่มตัวอ่านประเภทที่ 2 (ผู้สอนรายวิชา §6) และประเภทที่ 3 (อัตลักษณ์ multi-dimension §6ก)
- port เข้า GAS แบบ additive บน v6 แล้วต่อกับ `createOutputWorkbook_`/PDF
