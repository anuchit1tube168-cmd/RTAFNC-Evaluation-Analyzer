# Admin Setup — เจ้าของ Apps Script เท่านั้น

## เหตุผล

Web App เปิดให้ผู้ปกครองเข้าถึงแบบสาธารณะ ดังนั้นการตั้งรหัสผู้ดูแลครั้งแรกต้องไม่ทำผ่าน URL หรือ API GET เพราะผู้ที่เปิดลิงก์ก่อนอาจยึดสิทธิ์ผู้ดูแลได้

## ตั้งค่าครั้งแรก

1. เปิด Apps Script project เจ้าของระบบ
2. เปิด `Project Settings`
3. ไปที่ `Script Properties`
4. เพิ่ม Property ชื่อ:

```text
RTAFNC_PARENT_ADMIN_KEY
```

5. กำหนดค่าเป็นรหัสยาวอย่างน้อย 12 ตัวอักษร ผสมตัวอักษรและตัวเลข
6. บันทึกค่า
7. เปิด Web App หน้า Modern Dashboard
8. ไปที่เมนู `ตั้งค่าระบบ`
9. กรอกรหัสเดียวกันในช่อง Admin Key
10. กด `Setup Database`
11. กด `Health`, `Self Test` และ `Diagnostic`

## กฎความปลอดภัย

- ห้ามใส่ Admin Key ใน URL
- ห้ามส่ง Admin Key ในแชท กลุ่มไลน์ หรือ screenshot
- ห้ามเก็บ Admin Key ใน GitHub source code
- หน้าเว็บเก็บรหัสเฉพาะ session ของ browser
- เมื่อใช้เครื่องส่วนกลาง ให้ปิด browser หลังใช้งาน
- การเปลี่ยนรหัสทำที่ Script Properties โดยเจ้าของระบบ

## ตรวจว่าตั้งค่าสำเร็จ

`Health` ต้องแสดง:

```text
adminConfigured: true
version: parent-evaluation-v1.3.0
```

`Diagnostic` ต้องแสดง:

```text
status: PASS
allPass: true
```

## เมื่อรหัสไม่ถูกต้อง

ระบบต้องตอบ `Admin Key ไม่ถูกต้อง` และไม่เปิดข้อมูลฐานข้อมูล รายบุคคล หรือ PDF

## เมื่อยังไม่ได้ตั้งค่า

ระบบต้องแจ้งให้เจ้าของเปิด Project Settings > Script Properties ก่อน และต้องไม่สร้างรหัสใหม่จากผู้ใช้หน้าเว็บ

## การเปลี่ยนรหัส

1. แก้ค่าที่ Script Properties
2. ปิด session browser เดิม
3. เปิดหน้า Web App ใหม่
4. กรอกรหัสใหม่
5. Run Health และ Diagnostic
6. บันทึก QA Receipt โดยไม่บันทึกค่ารหัสจริง
