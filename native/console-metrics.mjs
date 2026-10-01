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
