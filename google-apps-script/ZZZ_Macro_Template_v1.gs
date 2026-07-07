function apiGet_(p){
  var result;
  try{
    var a=p.action||'health';
    if(a==='macrotemplatev1') result=macroTemplateV1_(p);
    else if(a==='healthv6') result=getHealth_();
    else if(a==='selftestv6') result=selfTest_();
    else if(a==='list') result={ok:true,files:listPendingFiles()};
    else if(a==='process') result=processPendingRawFiles();
    else if(a==='peek') result=peekFile_(p.fileId);
    else result=getHealth_();
  }catch(e){result={ok:false,error:String(e&&e.stack?e.stack:e)};}
  return jsonp_(result,p.callback);
}

function macroTemplateV1_(p){
  if(!p.rawId) throw new Error('missing rawId');
  if(!p.templateId) throw new Error('missing templateId');
  var rawFile=DriveApp.getFileById(p.rawId);
  var tplFile=DriveApp.getFileById(p.templateId);
  var rawTempId=convertToGoogleSheet_(rawFile);
  var rawSs=SpreadsheetApp.openById(rawTempId);
  var rawSh=rawSs.getSheets()[0];
  var parsed=parseEvaluationMatrix_(rawSh.getDataRange().getValues(),rawSh.getDataRange().getDisplayValues());
  if(!parsed.found) throw new Error('raw parse failed');
  var outName=safeName_('macro_copy_'+tplFile.getName().replace(/\.xlsx$/i,'')+'_'+Utilities.formatDate(new Date(),'Asia/Bangkok','yyyyMMdd_HHmmss'));
  var outId=convertTemplateBlobV1_(tplFile.getBlob(),outName);
  var outSs=SpreadsheetApp.openById(outId);
  var sh=outSs.getSheets()[0];
  var written=writeStatsToTemplateV1_(sh,parsed,p.instructor||'',rawFile.getName());
  SpreadsheetApp.flush();
  var outFile=DriveApp.getFileById(outId);
  try{DriveApp.getFolderById(CONFIG.SUMMARY_FOLDER_ID).addFile(outFile);DriveApp.getRootFolder().removeFile(outFile);}catch(e){}
  var pdf=exportPdf_(outId,safeName_(outName)+'.pdf',sh.getSheetId());
  try{if(!CONFIG.KEEP_TEMP_SHEETS)DriveApp.getFileById(rawTempId).setTrashed(true);}catch(e){}
  appendLog_(rawFile.getName(),'SUCCESS','macro_template_v1','copy template then write values',outSs.getUrl(),pdf.url);
  return {ok:true,status:'SUCCESS',version:'macro-template-v1',rawFile:rawFile.getName(),templateFile:tplFile.getName(),outputSpreadsheetUrl:outSs.getUrl(),pdfUrl:pdf.url,items:parsed.items.length,respondents:parsed.respondentCount,written:written};
}

function convertTemplateBlobV1_(blob,name){
  if(typeof Drive!=='undefined'&&Drive.Files&&Drive.Files.create){return Drive.Files.create({name:name,mimeType:MimeType.GOOGLE_SHEETS},blob,{fields:'id'}).id;}
  return convertToGoogleSheetViaUrlFetch_(blob,name);
}

function writeStatsToTemplateV1_(sh,p,instructor,rawName){
  var d=sh.getDataRange().getDisplayValues();
  var cols=findXsdColsV1_(d);
  var rows=findItemRowsV1_(d,p.itemStats.length);
  var n=Math.min(rows.length,p.itemStats.length);
  for(var i=0;i<n;i++){
    if(cols.x) sh.getRange(rows[i],cols.x).setValue(round2_(p.itemStats[i].mean));
    if(cols.sd) sh.getRange(rows[i],cols.sd).setValue(round2_(p.itemStats[i].sd));
  }
  if(instructor) replaceNextCellV1_(sh,d,'ผู้สอน',instructor);
  replaceNextCellV1_(sh,d,'ไฟล์',rawName);
  return {rowsFound:rows.length,rowsWritten:n,xCol:cols.x,sdCol:cols.sd};
}

function findXsdColsV1_(d){
  var x=0,sd=0;
  for(var r=0;r<Math.min(d.length,30);r++)for(var c=0;c<d[r].length;c++){
    var t=String(d[r][c]||'').toLowerCase().trim();
    if(!x&&(t==='x'||t==='x̄'||t.indexOf('เฉลี่ย')>=0))x=c+1;
    if(!sd&&(t==='sd'||t==='s.d.'||t.indexOf('sd')>=0||t.indexOf('s.d')>=0))sd=c+1;
  }
  return {x:x,sd:sd};
}
function findItemRowsV1_(d,max){
  var rows=[];
  for(var r=0;r<d.length;r++){
    var s=d[r].join(' ');
    if(/^\s*\d+(\.\d+)?\s+/.test(s)||/\s\d+(\.\d+)?\s+/.test(s)){if(!/เกณฑ์|ปีการศึกษา|รวม/.test(s))rows.push(r+1);}
    if(rows.length>=max)break;
  }
  return rows;
}
function replaceNextCellV1_(sh,d,key,val){
  for(var r=0;r<d.length;r++)for(var c=0;c<d[r].length;c++)if(String(d[r][c]||'').indexOf(key)>=0){sh.getRange(r+1,c+2).setValue(val);return true;}
  return false;
}
