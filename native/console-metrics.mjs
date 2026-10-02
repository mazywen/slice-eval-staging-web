export function callLane(call, completedAt) {
  const end=Date.parse(call.completedAt ?? call.usage?.completedAt), done=Date.parse(completedAt);
  return !Number.isFinite(end)||!Number.isFinite(done) ? 'unknown' : end<=done ? 'foreground' : 'background';
}
export function waitMs(command) {
  const start=Date.parse(command?.submittedAt),end=Date.parse(command?.completedAt);
  return Number.isFinite(start)&&Number.isFinite(end)&&end>=start ? end-start : null;
}
export function stateDiff(before, after) {
  if (!before || !after) return null;
  const changes=(a={},b={})=>[...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(key=>JSON.stringify(a[key])===JSON.stringify(b[key])?[]:[{key,before:a[key]??null,after:b[key]??null}]);
  const world=s=>Object.fromEntries((s.worldState||[]).map(w=>[w.id,w]));
  return {goals:changes({conditions:before.chapterState?.activeChapter?.conditions,progress:before.chapterState?.conditionState,tasks:before.chapterState?.activeChapter?.dayCard},{conditions:after.chapterState?.activeChapter?.conditions,progress:after.chapterState?.conditionState,tasks:after.chapterState?.activeChapter?.dayCard}),
    world:changes(world(before),world(after)).map(row=>({...row,kind:row.before==null?'新增':row.after==null||row.after.status!=='active'?'了结':'更新'}))};
}

// Display statistics from the selected Run only; pricing and completion stay server-owned.
export function runUnitStats(tree) {
  const groups=new Map();
  function walk(node) {
    if(!['unattributed','other'].includes(node.kind)) {
      const kind=node.kind==='chapter'&&node.chapter===1?'first_chapter':node.kind;
      if(!groups.has(kind))groups.set(kind,{label:node.kind==='chapter'?(node.chapter===1?'第一章':'一章'):node.kind==='day'?'一天':node.label,count:0,pricedCount:0,missingCount:0,values:[],failedCny:0,failedComplete:true});
      const g=groups.get(kind);
      if(node.finished){g.count++;if(node.complete&&Number.isFinite(node.cny)){g.pricedCount++;g.values.push(node.cny);}else g.missingCount++;}
      if(node.status==='failed'){g.failedCny+=node.cny;g.failedComplete&&=node.complete;}
    }
    node.children.forEach(walk);
  }
  walk(tree);
  return [...groups.values()].map(({values,...g})=>{
    values.sort((a,b)=>a-b);
    return {...g,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,p50:values[Math.ceil(values.length*.5)-1]??null,
      p90:values[Math.ceil(values.length*.9)-1]??null,max:values.at(-1)??null,failedPerFinished:g.count&&g.failedComplete?g.failedCny/g.count:null};
  });
}
// Console history starts at October 2 in the product's Shanghai timezone.
export function visibleConsoleRun(run){
  return Date.parse(run?.createdAt)>=Date.parse('2026-10-02T00:00:00+08:00');
}

export function callElapsedMs(calls){
  if(!calls.length)return null;
  const ranges=calls.map(c=>[Date.parse(c.startedAt),Date.parse(c.completedAt)]);
  if(ranges.some(([start,end])=>!Number.isFinite(start)||!Number.isFinite(end)||end<start))return null;
  return Math.max(...ranges.map(r=>r[1]))-Math.min(...ranges.map(r=>r[0]));
}

export function promptHeadings(content){
  const text=typeof content==='string'?content:Array.isArray(content)?content.filter(p=>p.type==='text').map(p=>p.text||'').join('\n'):'';
  const headings=[];let fence=null;
  for(const line of text.split(/\r?\n/)){
    const marker=line.match(/^\s*(`{3,}|~{3,})/);
    if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence=null;continue;}
    if(fence)continue;
    const markdown=line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    const bracket=line.match(/^\s*【([^】\n]+)】\s*$/);
    if(markdown)headings.push({level:markdown[1].length,title:markdown[2]});
    else if(bracket)headings.push({level:2,title:bracket[1]});
  }
  return headings;
}
