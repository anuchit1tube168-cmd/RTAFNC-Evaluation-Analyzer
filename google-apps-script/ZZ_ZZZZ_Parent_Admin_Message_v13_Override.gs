function PE_requireAdmin_(key) {
  if (!PE_adminKey_()) {
    throw Error('ยังไม่ได้ตั้งรหัสผู้ดูแล: เจ้าของ Apps Script ต้องตั้งค่าใน Project Settings > Script Properties ก่อน');
  }
  if (!PE_isAdmin_(key)) throw Error('รหัสผู้ดูแลไม่ถูกต้อง');
  return true;
}
