function findTemplateAutoV1_(kind,rawName){
  var queries=[];
  if(kind==='instructor')queries=["title contains 'ผู้สอนรายบุคคล' and title contains '2566'","title contains 'ผู้สอนรายบุคคล' and title contains '2567'"];
  else if(kind==='course')queries=["title contains 'แบบประเมินรายวิชา' and title contains '2566'","title contains 'ประเมินรายวิชา' and title contains '2567'"];
  else if(kind==='naphapiban')queries=["title contains 'นภาภิบาล' and title contains '2567'","title contains 'นภาภิบาล' and title contains '2566'"];
  else return null;
  var candidates=[];
  for(var i=0;i<queries.length;i++){
    var it=DriveApp.searchFiles(queries[i]);
    var guard=0;
    while(it.hasNext()&&guard<40){
      guard++;
      var f=it.next();
      var t=f.getName();
      if(/\.pdf$/i.test(t))continue;
      var score=scoreTemplateAutoV1_(t,kind,rawName);
      if(score>=5)candidates.push({file:f,title:t,score:score});
    }
  }
  if(!candidates.length)return null;
  candidates.sort(function(a,b){return b.score-a.score;});
  var top=candidates[0].score;
  var tied=candidates.filter(function(c){return c.score===top;});
  if(kind==='instructor'&&tied.length>1&&!rawHasCourseSignalV1_(rawName)){
    throw new Error('REVIEW_AMBIGUOUS_TEMPLATE: raw มีแต่ชื่อผู้สอน ไม่พบวิชา/ชั้นปี จึงห้ามเลือก template เอง | candidates=' + tied.slice(0,8).map(function(c){return c.title;}).join(' || '));
  }
  return candidates[0].file;
}
function rawHasCourseSignalV1_(name){return /ฝึกทหาร\s*[1234]|ทหาร\s*[1234]|ปี\s*[1234]|ชั้นปี\s*[1234]|รายวิชา|นภาภิบาล/.test(String(name||''));}
