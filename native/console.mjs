import {operations,definitions} from '../client-api/creator-network-shape.mjs?v=13ec2c0c37ae';
import {validate} from '../client-api/creator-client.mjs?v=13ec2c0c37ae';
import {callCost,callLane,waitMs,stateDiff} from './console-metrics.mjs?v=13ec2c0c37ae';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=v=>JSON.stringify(v,null,2),pre=v=>`<pre>${esc(typeof v==='string'?v:json(v))}</pre>`,items=v=>Array.isArray(v)?v:v?.items||[];
const read=(store,key,fallback=null)=>{try{return JSON.parse(store.getItem(key))??fallback;}catch{return fallback;}};
const write=(store,key,value)=>{try{store.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const q=new URLSearchParams(location.search);
const S={auth:read(sessionStorage,'slice-console-auth'),view:'play',sub:'raw',worldId:q.get('worldId')||'',version:q.get('version')||'draft',
  runId:q.get('runId')||'',worlds:[],versions:[],runs:[],steps:[],calls:new Map(),detail:new Map(),evidence:new Map(),selected:0,
  busy:false,error:'',notice:'',action:'vn_reply',input:'',target:'',post:'',activity:'',attempt:'',catalog:null,prices:{},current:{},startOptions:[],promptNode:'',promptInput:'',promptPreview:null};
const storageKey=()=>`slice-console-journal:${S.auth?.workspaceId}`;
let journal={};
function saveJournal(){if(!write(localStorage,storageKey(),journal))throw Error('无法保存操作恢复信息，请允许本机存储后再提交。');}
async function api(op,params={},body,query={},key){
  const route=operations[op];if(!route)throw Error(`未部署接口合同：${op}`);
  if(route.requestType)validate(body,route.requestType);
  const url=new URL(route.routePath.replace(/\{([^}]+)\}/g,(_,name)=>{if(!params[name])throw Error(`缺少 ${name}`);return encodeURIComponent(params[name]);}),document.querySelector('meta[name="slice-api-origin"]')?.content||location.origin);
  for(const [k,v]of Object.entries(query))if(v!=null)url.searchParams.set(k,v);
  const headers={accept:'application/json'};if(S.auth?.accessToken)headers.authorization=`Bearer ${S.auth.accessToken}`;
  if(body!==undefined)headers['content-type']='application/json';if(key)headers['idempotency-key']=key;
  const response=await fetch(url,{method:route.httpMethod,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(45000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok){const error=Error(`${data?.error?.code||response.status}：${data?.error?.message||'请求未完成'}`);error.status=response.status;
    if(response.status===401){S.auth=null;write(sessionStorage,'slice-console-auth',null);}throw error;}
  if(route.responseType)validate(data,route.responseType);return data;
}
async function mutation(slot,op,params,body){
  let record=journal[slot];if(!record){
    if(operations[op]?.requestType){try{validate(body,operations[op].requestType);}catch(e){e.status=422;throw e;}}record=journal[slot]={op,params,body,key:`console:${crypto.randomUUID()}`};saveJournal();}
  if(record.result)return record.result;
  // Always reuse the exact original request after an uncertain response.
  record.result=await api(record.op,record.params,record.body,{},record.key);saveJournal();return record.result;
}
async function task(fn){if(S.busy)return;S.busy=true;S.error='';render();try{await fn();}catch(e){S.error=e.message;const a=journal.action;if(a&&!journal[`${a.id}:command`]?.result&&((e.status>=400&&e.status<500&&e.status!==408)||!journal[`${a.id}:command`]&&!journal[`${a.id}:channel`])){delete journal.action;write(localStorage,storageKey(),journal);}if(journal.startSlot&&!journal[journal.startSlot]?.result&&e.status>=400&&e.status<500&&e.status!==408){delete journal.startSlot;write(localStorage,storageKey(),journal);}}finally{S.busy=false;render();}}
const button=(label,action,disabled=false)=>`<button class="btn" data-action="${action}" ${disabled?'disabled':''}>${label}</button>`;
const tile=(title,body,span='c4',extra='')=>`<section class="tile ${span}"><div class="tile-h"><h2>${title}</h2>${extra}</div><div class="tile-b">${body}</div></section>`;
const money=v=>v==null?'未配置 / 未采集':`¥${v.toFixed(4)}`,sec=v=>v==null?'未采集':`${(v/1000).toFixed(2)}s`;
const option=(value,label,selected)=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;
const cost=c=>callCost(c.usage,S.prices[c.usage?.model],c.usage?.imageCount);
const sumCosts=calls=>{const values=calls.map(cost);return !values.length||values.some(v=>v==null)?null:values.reduce((a,b)=>a+b,0);};
function render(){
  const focused=document.activeElement,focusId=focused?.id,selection=[focused?.selectionStart,focused?.selectionEnd];
  $('#world').innerHTML=option('','选择作品',S.worldId)+S.worlds.map(w=>option(w.worldId,w.title,S.worldId)).join('');
  $('#version').innerHTML=option('draft','草稿',S.version)+S.versions.map(v=>option(v.worldVersionId,`发布 v${v.versionNumber} · ${v.publicationStatus}`,S.version)).join('');
  $('#world').disabled=$('#version').disabled=S.busy||!!journal.action;
  document.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.view===S.view)));
  if(!S.auth){$('#main').innerHTML=`<section class="tile login"><div class="tile-h"><h2>登录试玩中台</h2></div><form id="login" class="tile-b console-form"><p class="note">使用内部 Eval 账号，连接 staging。</p><label>账号<input name="username" autocomplete="username" value="slice-eval" required></label><label>密码<input name="password" type="password" autocomplete="current-password" required></label><button class="btn primary" ${S.busy?'disabled':''}>登录</button><p role="alert" class="error">${esc(S.error)}</p></form></section>`;return;}
  $('#main').innerHTML=`${S.error?`<div class="notice error" role="alert">${esc(S.error)}</div>`:''}${S.notice?`<div class="notice" role="status">${esc(S.notice)}</div>`:''}<div class="head"><div><h1>${{play:'逐步试玩',timeline:'这一局的时间线',flow:'流程与成本',prompts:'提示词'}[S.view]}</h1><p>每次由你提交一步，查看真实结果。回溯与切换尝试暂未接入。</p></div><div class="row">${button('刷新','refresh',S.busy)}${button('退出登录','logout',S.busy)}</div></div>${S.view==='play'?renderPlay():S.view==='timeline'?renderTimeline():S.view==='flow'?renderStats():renderPrompts()}`;
  if(focusId){const next=document.getElementById(focusId);if(next){next.focus({preventScroll:true});try{next.setSelectionRange(...selection);}catch{}}}
}
function launchPanel(){return tile('开局与恢复',`<details ${!S.runId||S.startOptions.length?'open':''}><summary>${S.runId?'切换测试局 / 开新局':'选择人物与测试局'}</summary><div class="console-form"><label>已有测试局<select id="run-pick">${option('','选择测试局',S.runId)}${S.runs.map(r=>option(r.runId,`${r.title} · ${r.runId.slice(-8)}`,S.runId)).join('')}</select></label><div class="row">${button(S.version==='draft'?'编译草稿 · 准备开局':'读取开局人物','prepare',S.busy||!S.worldId||!!journal.action)}</div>${S.startOptions.length?`<label>扮演人物<select id="playable">${S.startOptions.filter(c=>c.playable).map(c=>option(c.bindingId,c.name,S.playable)).join('')}</select></label><label>首位 AI 人物<select id="initial">${S.startOptions.filter(c=>c.bindingId!==S.playable).map(c=>option(c.characterId,c.name,S.initial)).join('')}</select></label>${button('开一局','start',S.busy||!!journal.action)}`:''}<p class="note">${esc(S.runId||'选择作品和版本后开局，也可恢复服务端保存的步骤。')}</p></div></details>`,'c12');}
function renderPlay(){
  const step=S.steps.find(s=>s.stepNo===S.selected),calls=S.calls.get(step?.commandId)||[],e=S.evidence.get(step?.commandId)||{};
  const all=[...S.calls.values()].flat(),waits=[...S.evidence.values()].map(v=>waitMs(v.command)).filter(v=>v!=null);
  const kpi=(name,value,note)=>`<div class="tile c3 kpi"><div class="l">${name}</div><div class="v">${value}</div><div class="d">${note}</div></div>`;
  return `<div class="bento">${launchPanel()}${S.runId?`${kpi('这一步 · 玩家等待',sec(waitMs(e.command)),e.command?.status||'开局')}${kpi('这一步 · 成本',money(sumCosts(calls)),`${calls.length} 次调用`)}${kpi('本局累计成本',money(sumCosts(all)),`${all.length} 次已读取调用；不含编译及无命令的开局`)}${kpi('本局累计等待',sec(waits.length?waits.reduce((a,b)=>a+b,0):null),'命令受理到完成')}
    ${tile('玩家看到的',playerOutput(e.outcome,step,e.playerRecords),'c5')}${tile('提交下一步',inputPanel(),'c4')}${tile('步骤记录',S.steps.map(s=>`<button class="btn history-row" data-step="${s.stepNo}" aria-pressed="${s.stepNo===S.selected}"><b>${s.stepNo}. ${esc(actions.find(([id])=>id===s.actionType)?.[1]|| (s.actionType==='create_run'?'开局':s.actionType))}</b><br><small>${esc(s.inputText||s.commandId||'开局')}</small></button>`).join(''),'c3 r2')}
    ${tile('模型输出',resultPanel(calls,e),'c5',`<div class="subtabs">${[['raw','原文'],['data','解析数据'],['judge','判定']].map(([v,l])=>`<button data-sub="${v}" aria-pressed="${S.sub===v}">${l}</button>`).join('')}</div>`)}
    ${tile('这一步的调用',callsTable(calls,e.command),'c4')}${tile('状态变化',diffPanel(e),'c12')}
    ${tile('当前玩家读接口',`<p class="note">当前有效分支的最新画面；历史步骤结果以上方 Outcome 为准。</p>${Object.entries(S.current).filter(([k])=>['run','chapter','feed','messages','turns','replies','activities','attempts'].includes(k)).map(([k,v])=>`<details><summary>${esc({run:'开局 / 天赋',chapter:'章节 / VN',feed:'信息流',messages:'私聊',turns:'活动回合',replies:'评论',activities:'活动',attempts:'活动邀请'}[k])}</summary>${pre(v)}</details>`).join('')}`,'c12')}`:''}</div>`;
}
function playerOutput(outcome,step,records=[]){
  if(!step)return '<p class="note">提交后在这里查看。</p>';
  if(!step.commandId&&!step.sourceId&&S.current.run?.opening?.generationStatus==='failed')return '<p class="error">开局生成失败，本局尚不能继续试玩。请排查模型服务后重新开局。</p>';
  if(!outcome)return `<p class="note">${step.commandId?'结果尚未读取。':step.sourceId?'活动管理接口无 Outcome，详情见下方当前活动状态。':'开局状态见下方当前玩家读接口。'}</p>`;
  const texts=[];
  const walk=(v,key='')=>{if(typeof v==='string'&&['narrativeSummary','text','body','narration','outputText','contentText'].includes(key))texts.push(v);else if(Array.isArray(v))v.forEach(x=>walk(x));else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))if(!['record','facts','memories','world','request'].includes(k))walk(x,k);};
  // Outcome is the existing player-authorized projection, never model text.
  walk(outcome);walk(records);return texts.length?`<div class="screen">${[...new Set(texts)].map(t=>`<p>${esc(t)}</p>`).join('')}</div>`:'<p class="note">该 Outcome 没有玩家正文，查看解析数据与当前玩家读接口。</p>';
}
function talentChoices(){const find=v=>{if(!v||typeof v!=='object')return [];if(Array.isArray(v.talentCandidates)&&v.talentCandidates.length)return v.talentCandidates;for(const x of Object.values(v)){const found=find(x);if(found.length)return found;}return [];};return find(S.current.chapter).length?find(S.current.chapter):find(S.current.run);}
const actions=[['vn_enter','进入 VN'],['vn_reply','VN 回应'],['confirm_talent','选择天赋'],['post','发帖'],['comment','评论'],['dm_message','私聊'],['activity_create','创建活动'],['activity_enter','进入活动'],['activity_turn','活动行动'],['activity_exit','退出活动'],['advance_day','换日'],['end_chapter','结束本章'],['next_chapter','下一章']];
function inputPanel(){return `<div class="console-form"><label>操作<select id="action">${actions.map(([v,l])=>option(v,l,S.action)).join('')}</select></label><label>玩家输入<textarea id="input" maxlength="500" ${S.busy?'disabled':''}>${esc(S.input)}</textarea></label>
  ${S.action==='dm_message'?`<label>人物<select id="target">${option('','选择人物',S.target)}${items(S.current.cast).filter(c=>c.actorId!==S.current.run?.playerActorId).map(c=>option(c.actorId,c.displayName||c.actorId,S.target)).join('')}</select></label>`:''}
  ${S.action==='comment'?`<label>帖子<select id="post">${option('','选择帖子',S.post)}${items(S.current.feed).map(p=>option(p.postId||p.contentId,p.text||p.body||p.postId,S.post)).join('')}</select></label>`:''}
  ${S.action==='confirm_talent'?`<label>天赋<select id="choice">${option('','选择服务端返回的天赋',S.choice)}${talentChoices().map(c=>option(c.choiceId,`${c.title} · ${c.description}`,S.choice)).join('')}</select></label>`:''}
  ${S.action.startsWith('activity_')?`<label>活动<select id="activity">${option('','选择活动',S.activity)}${items(S.current.activities).map(a=>option(a.activityId,`${a.title||a.activityId} · ${a.status}`,S.activity)).join('')}</select></label><label>待进入的活动<select id="attempt">${option('','选择活动邀请',S.attempt)}${items(S.current.attempts).map(a=>option(a.activityAttemptId,`${a.title||a.activityAttemptId} · ${a.status}`,S.attempt)).join('')}</select></label>`:''}
  ${S.action==='activity_create'?`<label>标题<input id="activity-title" value="${esc(S.activityTitle)}"></label><label>时间<input id="activity-when" value="${esc(S.activityWhen)}"></label><label>地点<input id="activity-location" value="${esc(S.activityLocation)}"></label><label>目的<input id="activity-purpose" value="${esc(S.activityPurpose)}"></label><label>邀请人物<select id="invite" multiple>${items(S.current.cast).map(c=>`<option value="${esc(c.actorId)}">${esc(c.displayName||c.actorId)}</option>`).join('')}</select></label>`:''}
  ${button(journal.action?'继续上次提交':'提交这一步','submit',S.busy)}<small class="note">${journal.action?'上次提交尚未完成，继续会复用原始请求和幂等键。':'不自动连续执行。'}</small></div>`;}
function callsTable(calls,command){if(!calls.length)return '<p class="note">尚无已保存调用。</p>';const start=Math.min(...calls.map(c=>Date.parse(c.startedAt)||Infinity)),end=Math.max(...calls.map(c=>Date.parse(c.completedAt)||0)),span=Math.max(1,end-start);
  return `<table class="calls"><tbody>${calls.map(c=>{const lane=callLane(c,command?.completedAt);return `<tr data-call="${c.callId}" tabindex="0" role="button"><td>${esc(c.chainId)}<small>${esc(c.usage?.model||'模型未采集')} · ${{foreground:'玩家要等',background:'后台',unknown:'时间未采集'}[lane]}</small></td><td><div class="track"><i class="${lane==='background'?'bg':''}" style="left:${Number.isFinite(start)?Math.max(0,(Date.parse(c.startedAt)-start)/span*100)||0:0}%;width:${Math.max(1,(c.latencyMs||0)/span*100)}%"></i></div></td><td>${sec(c.latencyMs)}<br>${money(cost(c))}</td></tr>`;}).join('')}</tbody></table>`;}
function parseOutput(text){try{return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{return null;}}
function resultPanel(calls,e){if(S.sub==='data')return e.outcome?`<h3>已提交 Outcome</h3>${pre(e.outcome)}<h3>模型解析记录</h3>${calls.map(c=>{const raw=S.detail.get(c.callId)?.outputText||'';const section=raw.split('【记录】')[1]?.split(/【[^】]+】/)[0];return section?pre(parseOutput(section.trim())||'记录未能解析，请查看原文'):'';}).join('')||'<p class="note">无已保存的记录段。</p>'}`:'<p class="note">Outcome 尚未返回。</p>';
  if(S.sub==='judge'){const judges=calls.filter(c=>['turn_judgment','vn_judgment','chapter_condition','outline_drift'].includes(c.chainId));return judges.length?judges.map(c=>{const d=S.detail.get(c.callId),out=parseOutput(d?.outputText||'');const user=d?.requestJson?.find(m=>m.role==='user');const input=parseOutput(user?.content||'');return `<h3>${esc(c.chainId)}</h3>${out?.answers?Object.entries(out.answers).map(([k,v])=>`<div class="raw-block"><b>${esc(input?.questions?.[k]?.instructions||input?.questions?.[k]?.question||input?.questions?.[k]?.text||k)}</b><span class="chip">${esc(json(v.value))}</span><p>${esc(v.reason)}</p></div>`).join(''):'<p class="note">未采集判定原文或尚未加载。</p>'}`;}).join(''):'<p class="note">这一步暂无已保存的判定调用。</p>';}
  return calls.map(c=>`<details><summary>${esc(c.chainId)} · ${esc(c.status)}</summary>${pre(S.detail.get(c.callId)?.outputText??'未开启测试模式或没有保存原文')}</details>`).join('')||'<p class="note">尚无调用原文。</p>';
}
function diffPanel(e){
  const exact=e.before?.revision===e.before?.requestedRevision&&e.after?.revision===e.after?.requestedRevision;
  const d=exact?stateDiff(e.before?.memory,e.after?.memory):null;
  const rows=e.outcome?.numericSettlement?.relationships;
  const relationships=!rows?'<p class="note">未采集正式关系结算。</p>':rows.length?`<table class="rel"><thead><tr><th>人物关系</th><th>亲密</th><th>信任</th><th>认可</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.fromDisplayName||r.fromActorId)} → ${esc(r.toDisplayName||r.toActorId)}</td>${['affinity','trust','respect'].map(axis=>{const change=r.changes.find(c=>c.axis===axis);return `<td>${change?`${esc(change.before)} → ${esc(change.after)}`:'未变更'}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`:'<p class="note">无变化</p>';
  const missing='<p class="note">该步骤精确的前后记忆快照尚未齐全，不能计算变化。</p>';
  const world=!d?missing:d.world.length?d.world.map(r=>`<div class="world-item"><span class="chip">${r.kind}</span> ${esc(r.after?.text||r.before?.text||r.key)}</div>`).join(''):'<p class="note">无变化</p>';
  return `<div class="state"><div><h3>关系三轴 · 正式结算</h3>${relationships}</div><div><h3>本章目标</h3>${!d?missing:d.goals.length?pre(d.goals):'<p class="note">无变化</p>'}</div><div><h3>世界现状</h3>${world}</div></div>`;
}
function renderTimeline(){return `<div class="bento">${S.steps.map(s=>tile(`第 ${s.stepNo} 步 · ${esc(s.actionType)}`,`<p>${esc(s.inputText)}</p>${callsTable(S.calls.get(s.commandId)||[],S.evidence.get(s.commandId)?.command)}`,'c12')).join('')||'<p class="note">先开一局。</p>'}</div>`;}
function chainCost(chain){const values=(chain.models||[]).map(m=>callCost(m.usage,S.prices[m.model]));return !values.length||values.some(v=>v==null)?null:values.reduce((a,b)=>a+b,0);}
function renderStats(){const v=S.stats;return `${button('读取本作品最近 30 天','stats',S.busy||!S.worldId)}${v?`<p class="note">最多最近 ${v.sampleLimit} 条调用，${v.possiblyTruncated?'已达到上限，统计可能截断':'未达到截断上限'}；同批存档已完成章数 ${v.completedChapters}。</p><div class="bento">${v.items.map(c=>tile(esc(c.chainId),`<div class="stats"><div><b>${c.count}</b><span>调用</span></div><div><b>${sec(c.p50Ms)}</b><span>P50</span></div><div><b>${sec(c.p95Ms)}</b><span>P95</span></div><div><b>${(c.failureRate*100).toFixed(1)}%</b><span>失败</span></div></div><p>样本成本 ${money(chainCost(c))} · 按章均摊 ${money(chainCost(c)==null||!v.completedChapters?null:chainCost(c)/v.completedChapters)}</p>${pre({输入均值:c.inputTokensMean,输出均值:c.outputTokensMean,缓存命中率:c.cacheHitRate,每章调用:c.callsPerChapter})}`,'c6')).join('')}${tile('作品编译 · 仅 Token 与用时',pre(v.compiler),'c12')}</div>`:'<p class="note">从真实调用记录聚合，缺失的用量不计为零。</p>'}`;}
function renderPrompts(){const nodes=S.catalog?.nodes||[];return `<div class="bento">${tile('提示词装配',`<div class="console-form">${button('读取提示词目录','catalog',S.busy)}<label>链路<select id="prompt-node">${option('','选择链路',S.promptNode)}${nodes.map(n=>option(n.nodeId,n.label,S.promptNode)).join('')}</select></label><p class="note">使用目录样例输入；真实调用原文见步骤详情。按步骤重装暂缓。</p><label>链路输入（JSON）<textarea id="prompt-input" rows="12">${esc(S.promptInput)}</textarea></label>${button('拼装预览 · 不调用模型','preview',S.busy||!S.promptNode)}</div>`,'c4')}${tile('实际拼装的 messages',S.promptPreview?pre(S.promptPreview):'<p class="note">只预览，不编辑 system，不保存到 Runtime。</p>','c8')}</div>`;}
async function listAll(op,params={}){const rows=[];let cursor;do{const page=await api(op,params,undefined,cursor?{cursor}:{});rows.push(...items(page));cursor=page.pageInfo?.nextCursor;if(!page.pageInfo?.hasMore)break;}while(cursor);return rows;}
async function boot(){S.steps=[];S.current={};S.calls.clear();S.detail.clear();S.evidence.clear();journal=read(localStorage,storageKey(),{});S.worlds=await listAll('evalListWorldDrafts');S.runs=items(await api('evalListConsoleRuns'));const prices=await api('evalGetModelPricing');S.prices={...prices.models,...read(localStorage,'slice-console-prices',{})};if(!S.worldId)S.worldId=S.worlds[0]?.worldId||'';if(S.worldId&&!S.worlds.some(w=>w.worldId===S.worldId))throw Error('当前 Eval 账号或工作区无权读取这个作品，请使用创作时的账号登录。');if(S.worldId)await versions(true);if(S.runId)await loadRun();}
async function versions(requireRequestedVersion=false){S.versions=await listAll('evalListWorldVersions',{worldId:S.worldId});if(S.version!=='draft'&&!S.versions.some(v=>v.worldVersionId===S.version)){if(requireRequestedVersion)throw Error('指定的作品版本不可读取，请从创作端重新进入。');S.version='draft';}S.startOptions=[];}
async function prepare(){const world=S.worlds.find(w=>w.worldId===S.worldId);if(!world)throw Error('当前工作区没有这个作品');
  if(S.version==='draft'){
    const draft=await api('evalGetWorldDraft',{worldDraftId:world.worldDraftId});if(!journal.prepare||journal.prepare.worldId!==S.worldId){journal.prepare={worldId:S.worldId,slot:`compile:${crypto.randomUUID()}`};saveJournal();}const slot=journal.prepare.slot;
    const allowed=definitions.WorldDraftContent.properties;const content=Object.fromEntries(Object.entries(draft.seed||{}).filter(([k])=>Object.hasOwn(allowed,k)));
    content.schemaVersion='slice.world-draft-content.v6';content.characterBindings=draft.seed.castBindings;
    S.notice='第 0 步 · 保存草稿版本';render();const rev=await mutation(`${slot}:revision`,'evalCreateWorldDraftRevision',{worldDraftId:draft.worldDraftId},{expectedDraftRevision:draft.currentRevisionNumber,content});
    S.notice='第 0 步 · 编译草稿';render();let report=await mutation(`${slot}:compile`,'evalCompileWorldDraftRevision',{worldDraftRevisionId:rev.worldDraftRevisionId},{worldDraftRevisionId:rev.worldDraftRevisionId});
    report=await poll(()=>api('evalGetCompileReport',{compileJobId:report.compileJobId}),r=>!['queued','running'].includes(r.status));if(report.status!=='succeeded')throw Error(`编译失败：${json(report.diagnostics)}`);
    S.notice='第 0 步 · 发布校验';render();const review=await mutation(`${slot}:review`,'evalSubmitWorldReview',{worldDraftRevisionId:rev.worldDraftRevisionId},{worldDraftRevisionId:rev.worldDraftRevisionId,compileJobId:report.compileJobId});
    const decision=await poll(async()=>{try{return await api('evalGetWorldReviewDecision',{reviewSubmissionId:review.reviewSubmissionId});}catch(e){if(e.status===409)return {decision:'pending'};throw e;}},r=>['approved','rejected'].includes(r.decision));if(decision.decision!=='approved')throw Error('发布校验未通过');
    const published=await mutation(`${slot}:publish`,'evalPublishWorld',{worldId:S.worldId},{worldDraftRevisionId:rev.worldDraftRevisionId,compileJobId:report.compileJobId,reviewDecisionId:decision.reviewDecisionId,visibility:'private',siteBinding:null});
    delete journal.prepare;saveJournal();S.version=published.worldVersionId;await versions();S.notice='第 0 步 · 编译并私密发布完成，请选择扮演人物。';
  }
  S.startOptions=items(await api('evalGetConsoleStartOptions',{worldId:S.worldId},undefined,{worldVersionId:S.version}));S.playable=S.startOptions.find(c=>c.playable)?.bindingId||'';S.initial=(S.startOptions.find(c=>c.bindingId!==S.playable&&c.initialLinkedCharacterCandidate)||S.startOptions.find(c=>c.bindingId!==S.playable))?.characterId||'';
}
async function poll(read,done){const deadline=Date.now()+120000;while(true){const value=await read();if(done(value))return value;if(Date.now()>deadline)throw Error('仍在处理中，请点击刷新或继续原操作；不会创建重复请求。');await pause(1800);}}
async function start(){const person=S.startOptions.find(c=>c.bindingId===S.playable);if(!person||!S.initial)throw Error('请选择扮演人物与首位 AI');
  journal.startSlot ||= `start:${crypto.randomUUID()}`;saveJournal();const value=await mutation(journal.startSlot,'evalCreateRun',{worldId:S.worldId},{worldVersionId:S.version,identitySelection:{sourceType:'playable_character',characterVersionId:person.characterVersionId,worldCastBindingId:person.bindingId},initialLinkedCharacterId:S.initial});
  observation++;S.runId=value.runId;S.current={};await mutation(`session:${S.runId}`,'evalRecordConsoleStep',{runId:S.runId},{});delete journal.startSlot;saveJournal();S.startOptions=[];setRunUrl();await loadRun();S.runs=items(await api('evalListConsoleRuns'));S.notice='已开局。先在章节状态中查看开场与天赋，再手动提交下一步。';}
function setRunUrl(){const url=new URL(location.href);url.searchParams.set('runId',S.runId);url.searchParams.set('worldId',S.worldId);url.searchParams.set('version',S.version);history.replaceState(null,'',url);}
async function loadCurrent(){const params={runId:S.runId};const names={run:'evalGetRun',chapter:'evalGetRunChapter',cast:'evalListRunCast',feed:'evalListRunFeed',activities:'evalListActivityInstances',attempts:'evalListActivityAttempts'};const values=await Promise.allSettled(Object.entries(names).map(async([name,op])=>[name,await api(op,params)]));const errors=[];for(const v of values)if(v.status==='fulfilled')S.current[v.value[0]]=v.value[1];else errors.push(v.reason.message);if(errors.length)S.notice=`部分当前读接口未就绪：${errors.join('；')}`;}
async function loadRun(){observation++;S.calls.clear();S.detail.clear();S.evidence.clear();await loadCurrent();S.steps=items(await api('evalListConsoleSteps',{runId:S.runId}));S.selected=S.steps.at(-1)?.stepNo||0;
  const historySteps=S.steps.filter(s=>s.commandId);for(let i=0;i<historySteps.length;i+=4)await Promise.all(historySteps.slice(i,i+4).map(step=>loadEvidence(step,{full:step.stepNo===S.selected})));
  setRunUrl();}
async function playerRecords(step,outcome){
  if(!outcome)return [];
  const payload=step.payload||{},params={runId:S.runId},ids=new Set(outcome.createdContentIds||[]);
  if(payload.channelId)return items(await api('evalListDmMessages',{...params,channelId:payload.channelId})).filter(m=>m.sourceOutcomeId===outcome.outcomeId);
  if(payload.rootPostId)return items(await api('evalListPostReplies',{...params,postId:payload.rootPostId})).filter(m=>ids.has(m.replyId));
  if(payload.activityId)return items(await api('evalListRunActivityTurns',{...params,activityId:payload.activityId})).filter(t=>t.commandId===step.commandId||t.sourceOutcomeId===outcome.outcomeId);
  if(step.actionType==='post'){
    const posts=items(await api('evalListRunFeed',params)).filter(p=>ids.has(p.postId));const result=[...posts];
    for(const p of posts)result.push(...items(await api('evalListPostReplies',{...params,postId:p.postId})).filter(r=>ids.has(r.replyId)));return result;
  }
  return [];
}
async function loadEvidence(step,{full=true}={}){const runId=S.runId;const params={runId,commandId:step.commandId};const e=S.evidence.get(step.commandId)||{};e.command=await api('evalGetWorldCommand',params);const calls=items(await api('evalListStoryEngineCalls',{runId},undefined,{commandId:step.commandId}));if(S.runId!==runId)return;S.calls.set(step.commandId,calls);
  if(full&&(e.command.status==='applied'||e.command.status==='rejected')){try{e.outcome=await api('evalGetOutcomeByCommand',params);}catch(err){if(err.status!==404)throw err;}}
  if(full&&e.outcome)e.playerRecords=await playerRecords(step,e.outcome);
  for(const [key,revision]of [['before',step.beforeRevision],['after',step.afterRevision]])if(full&&revision!=null){try{e[key]=await api('evalGetStoryEngineSnapshot',{runId:S.runId},undefined,{revision,branchId:step.branchId});}catch(err){if(err.status!==404)throw err;}}
  if(S.runId!==runId)return;
  for(const c of S.calls.get(step.commandId)){const model=c.usage?.model;if(model&&!S.prices[model])S.prices[model]={cacheHit:null,cacheMiss:null,output:null};}
  S.evidence.set(step.commandId,e);for(const c of full?S.calls.get(step.commandId):[])if(!S.detail.has(c.callId))S.detail.set(c.callId,await api('evalGetStoryEngineCall',{runId:S.runId,callId:c.callId}));
}
async function submit(){
  if(!journal.action){journal.action={id:crypto.randomUUID(),runId:S.runId,type:S.action,text:S.input,target:S.target,post:S.post,choice:S.choice,
    activity:S.activity,attempt:S.attempt,activityTitle:S.activityTitle,activityWhen:S.activityWhen,activityLocation:S.activityLocation,activityPurpose:S.activityPurpose,invite:S.invite||[]};saveJournal();}
  const a=journal.action;if(a.runId!==S.runId)throw Error('请先恢复上次提交所在的测试局。');const params={runId:a.runId};
  const run=await api('evalGetRun',params);const revision=run.revision;let op='evalSubmitWorldCommand',body;
  // playerBody is a string in the canonical command contract; attachments use separate media workflows.
  if(a.type==='dm_message'){
    if(!a.target)throw Error('请选择私聊人物');let channels=items(await api('evalListDmChannels',params));
    let channel=channels.find(c=>c.participantActorIds.includes(a.target));
    if(!channel)channel=await mutation(`${a.id}:channel`,'evalCreateDmChannel',params,{channelType:'direct',participantActorIds:[a.target]});
    a.channelId=channel.channelId;saveJournal();body={expectedRunRevision:(await api('evalGetRun',params)).revision,payload:{type:'dm_message',channelId:channel.channelId,body:a.text}};
  }else if(a.type.startsWith('activity_')){
    if(a.type==='activity_create'){op='evalCreateActivityAttempt';body={expectedRunRevision:revision,payload:{title:a.activityTitle,when:a.activityWhen,location:a.activityLocation,invitedActorIds:a.invite,sceneDescription:a.text,purpose:a.activityPurpose}};}
    else if(a.type==='activity_enter'){op='evalEnterActivity';params.activityAttemptId=a.attempt;body={expectedRunRevision:revision};}
    else {params.activityId=a.activity;const activity=await api('evalGetActivityInstance',params);op=a.type==='activity_turn'?'evalSubmitActivityAction':'evalExitActivity';
      body={expectedRunRevision:revision,expectedSceneRevision:activity.sceneRevision,...(a.type==='activity_turn'?{body:a.text}:{status:'exited'})};}
  }else{
    let payload={type:a.type};if(a.type==='vn_reply')payload.text=a.text;
    if(a.type==='post')Object.assign(payload,{body:a.text,visibility:'public'});
    if(a.type==='comment')Object.assign(payload,{body:a.text,rootPostId:a.post});
    if(a.type==='confirm_talent')Object.assign(payload,{choiceId:a.choice,plannerStrategy:'baseline'});
    body={expectedRunRevision:revision,payload};
  }
  const result=await mutation(`${a.id}:command`,op,params,body);const commandId=result.commandId;
  if(commandId){
    await mutation(`${a.id}:record`,'evalRecordConsoleStep',{runId:a.runId},{commandId});
    S.steps=items(await api('evalListConsoleSteps',{runId:a.runId}));const step=S.steps.find(s=>s.commandId===commandId);S.selected=step.stepNo;
    S.notice='命令已受理，正在等待结果。';render();
    const command=await poll(async()=>{await loadEvidence(step);render();return S.evidence.get(commandId).command;},c=>['applied','rejected'].includes(c.status));
    S.notice=command.status==='rejected'?`命令未应用：${command.errorCode||'查看结果'}`:'结果已返回，继续观察后台调用。';
    delete journal.action;saveJournal();S.input='';await loadCurrent();S.steps=items(await api('evalListConsoleSteps',{runId:a.runId}));
    await loadEvidence(S.steps.find(s=>s.commandId===commandId));render();observeBackground(a.runId,commandId);
  }else{const sourceId=result.activityAttemptId&&a.type==='activity_create'?result.activityAttemptId:result.activityId||a.activity;if(sourceId)await mutation(`${a.id}:record`,'evalRecordConsoleStep',{runId:a.runId},{sourceId,actionType:a.type});delete journal.action;saveJournal();await loadCurrent();S.steps=items(await api('evalListConsoleSteps',{runId:a.runId}));S.selected=S.steps.at(-1)?.stepNo||0;S.notice='活动管理步骤已保存。该接口没有命令调用记录，详情见当前活动状态。';}
  if(a.channelId)S.current.messages=await api('evalListDmMessages',{runId:a.runId,channelId:a.channelId});
  if(a.post)S.current.replies=await api('evalListPostReplies',{runId:a.runId,postId:a.post});
  if(a.activity)S.current.turns=await api('evalListRunActivityTurns',{runId:a.runId,activityId:a.activity});
}
let observation=0;
async function observeBackground(runId,commandId){const generation=observation;const start=Date.now();let changed=start,last=(S.calls.get(commandId)||[]).map(c=>c.callId).join(',');
  try{while(Date.now()-start<120000&&Date.now()-changed<15000){await pause(2500);if(generation!==observation||S.runId!==runId||!S.auth)return;
    const step=S.steps.find(s=>s.commandId===commandId);await loadEvidence(step);const now=(S.calls.get(commandId)||[]).map(c=>c.callId).join(',');if(now!==last){last=now;changed=Date.now();}render();}
    if(generation===observation&&!S.busy){S.notice='后台观察结束：连续 15 秒无新调用，或已达到 120 秒上限。可手动刷新。';render();}
  }catch(e){if(generation===observation&&!S.busy){S.notice=`后台观察中止：${e.message}`;render();}}
}
async function preview(){const node=S.catalog.nodes.find(n=>n.nodeId===S.promptNode);if(!node)throw Error('请选择链路');const input=JSON.parse(S.promptInput||'{}');
  S.promptPreview=await api('evalPreviewPromptRequest',{}, {nodeId:node.nodeId,input});
}
function drawer(title,content){$('#dr-title').textContent=title;$('#dr-sub').textContent='';$('#dr-body').innerHTML=content;$('#drawer').classList.add('open');$('#scrim').classList.add('on');$('#drawer').setAttribute('aria-hidden','false');}
function closeDrawer(){$('#drawer').classList.remove('open');$('#scrim').classList.remove('on');$('#drawer').setAttribute('aria-hidden','true');}
function prices(){drawer('单价 · 人民币 / 百万 Token；生图按张',`<form id="prices" class="console-form"><p class="note">留空表示未配置，只保存本机覆盖。模型名称需和真实调用一致。</p>${Object.entries(S.prices).map(([model,p])=>`<fieldset><legend>${esc(model)}</legend>${('image'in p?['image']:['cacheHit','cacheMiss','output']).map(k=>`<label>${{cacheHit:'缓存命中输入',cacheMiss:'未命中输入',output:'输出',image:'每张图片'}[k]}<input type="number" min="0" step="any" data-model="${esc(model)}" data-price="${k}" value="${p[k]??''}"></label>`).join('')}</fieldset>`).join('')}<button class="btn primary">保存本机单价</button></form>`);}
document.addEventListener('submit',e=>{if(e.target.id==='login'){e.preventDefault();const data=new FormData(e.target);task(async()=>{S.auth=await api('createCompilerRuntimeEvalSession',{},Object.fromEntries(data));write(sessionStorage,'slice-console-auth',S.auth);await boot();});}
  if(e.target.id==='prices'){e.preventDefault();const prices=structuredClone(S.prices);for(const el of e.target.querySelectorAll('[data-price]'))prices[el.dataset.model][el.dataset.price]=el.value===''?null:Number(el.value);S.prices=prices;if(!write(localStorage,'slice-console-prices',prices))S.notice='本机存储不可用，本次价格只在当前页面生效。';closeDrawer();render();}});
document.addEventListener('click',e=>{const el=e.target.closest('button,[data-call]');if(!el)return;
  if(el.id==='theme'){const dark=document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.dataset.theme=dark?'light':'dark';write(localStorage,'slice-console-theme',document.documentElement.dataset.theme);return;}
  if(el.id==='open-prices')return prices();if(el.id==='dr-close')return closeDrawer();
  if(el.dataset.view){S.view=el.dataset.view;render();return;}
  if(el.dataset.sub){S.sub=el.dataset.sub;render();return;}
  if(el.dataset.step){S.selected=Number(el.dataset.step);const step=S.steps.find(s=>s.stepNo===S.selected);if(step?.commandId)task(()=>loadEvidence(step));else render();return;}
  if(el.dataset.call){const c=[...S.calls.values()].flat().find(c=>c.callId===el.dataset.call),d=S.detail.get(el.dataset.call);drawer('模型调用',`${pre({chain:c.chainId,usage:c.usage,startedAt:c.startedAt,completedAt:c.completedAt,latencyMs:c.latencyMs,cost:cost(c),errorCode:c.errorCode})}<h3>实际 messages</h3>${pre(d?.requestJson??'未开启测试模式或没有保存原文')}<h3>模型原文</h3>${pre(d?.outputText??'未开启测试模式或没有保存原文')}`);return;}
  const action=el.dataset.action;if(!action)return;
  task(async()=>{if(action==='logout'){S.auth=null;write(sessionStorage,'slice-console-auth',null);observation++;return;}
    if(action==='prepare')return prepare();if(action==='start')return start();if(action==='submit')return submit();
    if(action==='refresh'){if(S.runId)return loadRun();return boot();}
    if(action==='stats'){S.stats=await api('evalGetChainStats',{worldId:S.worldId});for(const c of S.stats.items)for(const m of c.models||[])if(!S.prices[m.model])S.prices[m.model]={cacheHit:null,cacheMiss:null,output:null};}
    if(action==='catalog')S.catalog=await api('evalGetPromptCatalog');if(action==='preview')await preview();});
});
$('#scrim').addEventListener('click',closeDrawer);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();if(e.key==='Enter'&&e.target.matches('[data-call]'))e.target.click();});
const inputs={input:'input',target:'target',post:'post',choice:'choice',activity:'activity',attempt:'attempt','activity-title':'activityTitle','activity-when':'activityWhen','activity-location':'activityLocation','activity-purpose':'activityPurpose','prompt-input':'promptInput'};
document.addEventListener('input',e=>{if(inputs[e.target.id])S[inputs[e.target.id]]=e.target.value;});
document.addEventListener('change',e=>{const el=e.target;if(inputs[el.id])S[inputs[el.id]]=el.value;
  if(el.id==='action'){S.action=el.value;render();}if(el.id==='invite')S.invite=[...el.selectedOptions].map(o=>o.value);
  if(el.id==='world')task(async()=>{S.worldId=el.value;S.version='draft';S.stats=null;S.runId='';S.steps=[];S.current={};observation++;await versions();});
  if(el.id==='version'){S.version=el.value;S.startOptions=[];render();}
  if(el.id==='run-pick'&&journal.action&&el.value!==journal.action.runId){S.error='请先完成上次提交';render();return;}
  if(el.id==='run-pick')task(async()=>{observation++;S.runId=el.value;const run=S.runs.find(r=>r.runId===S.runId);if(run){S.worldId=run.worldId;await versions();await loadRun();}});
  if(el.id==='playable'){S.playable=el.value;S.initial=(S.startOptions.find(c=>c.bindingId!==S.playable&&c.initialLinkedCharacterCandidate)||S.startOptions.find(c=>c.bindingId!==S.playable))?.characterId||'';render();}
  if(el.id==='initial')S.initial=el.value;
  if(el.id==='prompt-node'){S.promptNode=el.value;const node=S.catalog.nodes.find(n=>n.nodeId===el.value);S.promptInput=json(node?.prompt.input||{});render();}
});
const theme=read(localStorage,'slice-console-theme');if(theme)document.documentElement.dataset.theme=theme;
render();if(S.auth)task(boot);
