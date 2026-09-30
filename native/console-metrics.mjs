const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function callCost(usage, price, imageCount = null) {
  if (!price) return null;
  if ('image' in price) return number(imageCount) && number(price.image) ? imageCount * price.image : null;
  if (!usage) return null;
  const input = usage.inputTokens ?? usage.prompt_tokens;
  const output = usage.outputTokens ?? usage.completion_tokens;
  const hit = usage.cacheHitTokens ?? usage.prompt_cache_hit_tokens ?? 0;
  const miss = usage.cacheMissTokens ?? usage.prompt_cache_miss_tokens ?? (number(input) ? input - hit : null);
  if (![hit, miss, output].every(number)) return null;
  const parts = [[hit,price.cacheHit],[miss,price.cacheMiss],[output,price.output]];
  if (parts.some(([tokens,rate])=>tokens > 0 && !number(rate))) return null;
  return parts.reduce((sum,[tokens,rate])=>sum+(tokens ? tokens*rate : 0),0)/1e6;
}
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
