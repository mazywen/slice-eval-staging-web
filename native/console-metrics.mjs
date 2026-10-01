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
