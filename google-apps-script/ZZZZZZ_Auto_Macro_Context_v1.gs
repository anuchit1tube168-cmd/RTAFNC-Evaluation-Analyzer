function autoMacroFromRawV1_(p){
  var rawId=normalizeDriveIdV1_(p.rawId||p.rawUrl,'rawId');
  var rawFile=getDriveFileSafeV1_(rawId,'raw');
  var rawName=rawFile.getName();
  var context=String(p.course||p.context||p.title||p.type||'').trim();
  var searchName=rawName+(context?' '+context:'');
  var kind=detectRawKindAutoV1_(searchName,p.type||'');
  var tpl=findTemplateAutoV1_(kind,searchName);
  if(!tpl){return {ok:false,status:'REVIEW',version:'auto-macro-from-raw-v1',rawFile:rawName,context:context,kind:kind,reason:'ไม่พบ Template Excel ปี 2566-2567 ที่ตรงกับไฟล์ดิบ'};}
  var q={rawId:rawId,templateId:tpl.getId(),instructor:p.instructor||inferNameAutoV1_(rawName)};
  var r=macroTemplateV1_(q);
  r.version='auto-macro-from-raw-v1';
  r.autoSelectedTemplate=true;
  r.kind=kind;
  r.context=context;
  r.templateId=tpl.getId();
  return r;
}
function scoreTemplateAutoV1_(title,kind,rawName){
  var s=0;
  if(/\.xlsx$/i.test(title))s+=3;
  if(/2566|2567/.test(title))s+=2;
  if(kind==='instructor'&&/ผู้สอนรายบุคคล/.test(title))s+=6;
  if(kind==='course'&&/รายวิชา/.test(title))s+=6;
  if(kind==='naphapiban'&&/นภาภิบาล/.test(title))s+=6;
  var rc=extractCourseSignalV1_(rawName);
  var tc=extractCourseSignalV1_(title);
  if(rc&&tc&&rc===tc)s+=20;
  if(rc&&tc&&rc!==tc)s-=20;
  if(/ฝึกทหาร/.test(title)&&/ฝึก|ทหาร/.test(rawName))s+=2;
  return s;
}
function extractCourseSignalV1_(s){
  s=String(s||'');
  var m=s.match(/ฝึกทหาร\s*([1234])/); if(m)return 'ฝึกทหาร '+m[1];
  m=s.match(/การฝึกทหาร\s*([1234])/); if(m)return 'ฝึกทหาร '+m[1];
  m=s.match(/ทหาร\s*([1234])/); if(m)return 'ฝึกทหาร '+m[1];
  m=s.match(/ชั้นปี\s*ที่?\s*([1234])/); if(m)return 'ชั้นปี '+m[1];
  return '';
}
