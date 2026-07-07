function apiGet_(p){
  var result;
  try{
    var a=p.action||'health';
    if(a==='automacrofromrawv1') result=autoMacroFromRawV1_(p);
    else if(a==='macrotemplatev1') result=macroTemplateV1_(p);
    else if(a==='healthv6') result=getHealth_();
    else if(a==='selftestv6') result=selfTest_();
    else if(a==='list') result={ok:true,files:listPendingFiles()};
    else if(a==='process') result=processPendingRawFiles();
    else if(a==='peek') result=peekFile_(p.fileId);
    else result=getHealth_();
  }catch(e){result={ok:false,error:String(e&&e.stack?e.stack:e)};}
  return jsonp_(result,p.callback);
}
function autoMacroFromRawV1_(p){
  var rawId=normalizeDriveIdV1_(p.rawId||p.rawUrl,'rawId');
  var rawFile=getDriveFileSafeV1_(rawId,'raw');
  var rawName=rawFile.getName();
  var kind=detectRawKindAutoV1_(rawName,p.type||'');
  var tpl=findTemplateAutoV1_(kind,rawName);
  if(!tpl){return {ok:false,status:'REVIEW',version:'auto-macro-from-raw-v1',rawFile:rawName,kind:kind,reason:'ไม่พบ Template Excel ปี 2566-2567 ที่ตรงกับไฟล์ดิบ'};}
  var q={rawId:rawId,templateId:tpl.getId(),instructor:p.instructor||inferNameAutoV1_(rawName)};
  var r=macroTemplateV1_(q);
  r.version='auto-macro-from-raw-v1';
  r.autoSelectedTemplate=true;
  r.kind=kind;
  r.templateId=tpl.getId();
  return r;
}
function detectRawKindAutoV1_(name,type){
  var s=String(name||'')+' '+String(type||'');
  if(/นภาภิบาล|ฝึกร่วม|ฝึกทหารร่วม/.test(s))return 'naphapiban';
  if(/ประเมินรายวิชา|รายวิชา/.test(s))return 'course';
  if(/ผู้สอนรายบุคคล|ผู้สอน|อาจารย์|น\.ท\.|น\.ต\.|ร\.อ\.|ร\.ท\.|ร\.ต\.|พ\.อ\.|จ\.อ\.|จ\.ท\.|จ\.ต\./.test(s))return 'instructor';
  return 'review';
}
function findTemplateAutoV1_(kind,rawName){
  var queries=[];
  if(kind==='instructor')queries=["title contains 'ผู้สอนรายบุคคล' and title contains '2566'","title contains 'ผู้สอนรายบุคคล' and title contains '2567'"];
  else if(kind==='course')queries=["title contains 'แบบประเมินรายวิชา' and title contains '2566'","title contains 'ประเมินรายวิชา' and title contains '2567'"];
  else if(kind==='naphapiban')queries=["title contains 'นภาภิบาล' and title contains '2567'","title contains 'นภาภิบาล' and title contains '2566'"];
  else return null;
  var best=null,score=-1;
  for(var i=0;i<queries.length;i++){
    var it=DriveApp.searchFiles(queries[i]);
    var n=0;
    while(it.hasNext()&&n<30){
      n++;
      var f=it.next();
      var t=f.getName();
      if(/\.pdf$/i.test(t))continue;
      var s=scoreTemplateAutoV1_(t,kind,rawName);
      if(s>score){best=f;score=s;}
    }
  }
  if(score<5)return null;
  return best;
}
function scoreTemplateAutoV1_(title,kind,rawName){
  var s=0;
  if(/\.xlsx$/i.test(title))s+=3;
  if(/2566|2567/.test(title))s+=2;
  if(kind==='instructor'&&/ผู้สอนรายบุคคล/.test(title))s+=6;
  if(kind==='course'&&/รายวิชา/.test(title))s+=6;
  if(kind==='naphapiban'&&/นภาภิบาล/.test(title))s+=6;
  if(/ฝึกทหาร/.test(title)&&/ฝึก|ทหาร/.test(rawName))s+=2;
  return s;
}
function inferNameAutoV1_(name){return String(name||'').replace(/\.xlsx$/i,'').replace(/^raw[_\s-]*/i,'').trim();}
