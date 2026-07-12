#!/usr/bin/env python3
"""ประกอบ index.html = shell.html + SheetJS + TQF mapping + engine.js (ฝังทั้งหมด ไม่พึ่ง CDN)
แก้ engine ที่ engine.js, แก้ UI ที่ shell.html, แล้วรัน: python3 build.py"""
shell = open('shell.html', encoding='utf-8').read()
eng = open('engine.js', encoding='utf-8').read()
sheetjs = open('/home/claude/node_modules/xlsx/dist/xlsx.full.min.js', encoding='utf-8').read()
tqf = open('/tmp/tqf.js', encoding='utf-8').read()   # mapping 8 ด้าน + 44 ข้อ + เกณฑ์ (จากไฟล์ตัวอย่างจริง)
for ph in ['/*__SHEETJS__*/', '/*__TQF__*/', '/*__ENGINE__*/']:
    assert ph in shell, 'shell.html ขาด placeholder ' + ph
out = (shell.replace('/*__SHEETJS__*/', sheetjs)
            .replace('/*__TQF__*/', tqf)
            .replace('/*__ENGINE__*/', eng))
open('index.html', 'w', encoding='utf-8').write(out)
print('build index.html สำเร็จ (%d KB)' % (len(out)//1024))
