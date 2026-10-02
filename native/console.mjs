import {operations,definitions} from '../client-api/creator-network-shape.mjs?v=19d6eb9af344';
import {validate} from '../client-api/creator-client.mjs?v=19d6eb9af344';
import {callLane,waitMs,stateDiff,runUnitStats,promptHeadings,visibleConsoleRun,callElapsedMs} from './console-metrics.mjs?v=19d6eb9af344';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=v=>JSON.stringify(v,null,2),pre=v=>`<pre>${esc(typeof v==='string'?v:json(v))}</pre>`,items=v=>Array.isArray(v)?v:v?.items||[];
const read=(store,key,fallback=null)=>{try{return JSON.parse(store.getItem(key))??fallback;}catch{return fallback;}};
const write=(store,key,value)=>{try{store.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const q=new URLSearchParams(location.search);
const S={auth:read(sessionStorage,'slice-console-auth'),view:'play',sub:'raw',promptMode:'full',selectedCall:'',worldId:q.get('worldId')||'',version:q.get('version')||'draft',
  runId:q.get('runId')||'',worlds:[],versions:[],runs:[],steps:[],calls:new Map(),detail:new Map(),evidence:new Map(),selected:0,
  runCalls:[],traceRunId:'',traceError:'',costTree:null,costTreeError:'',costExpanded:new Set(['0']),busy:false,error:'',notice:'',action:'vn_reply',input:'',target:'',post:'',activity:'',attempt:'',catalog:null,prices:{},current:{},currentErrors:{},openingNotice:'',startOptions:[],promptNode:'',promptInput:'',promptPreview:null};
const storageKey=()=>`slice-console-journal:${S.auth?.workspaceId}`;
let journal={};
function saveJournal(){if(!write(localStorage,storageKey(),journal))throw Error('无法保存操作恢复信息，请允许本机存储后再提交。');}
async function api(op,params={},body,query={},key,validateResponse=true){
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
  if(route.responseType&&validateResponse)validate(data,route.responseType);return data;
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
const money=v=>v==null?'待计价':`¥${v.toFixed(6)}`,sec=v=>v==null?'未采集':`${(v/1000).toFixed(2)}s`;
const option=(value,label,selected)=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;
const cost=c=>c.cost?.cny??null;
const sumCosts=calls=>{const values=calls.map(cost);return !values.length||values.some(v=>v==null)?null:values.reduce((a,b)=>a+b,0);};
const fmtTime=value=>{if(!value)return '时间未采集';const date=new Date(value);if(!Number.isFinite(date.getTime()))return String(value);return date.toLocaleString('zh-CN',{hour12:false});};
const runMeta=()=>S.runs.find(row=>row.runId===S.runId)||null;
const runReadOnly=()=>runMeta()?.readOnly===true;
const stepCallKey=step=>step?.commandId||`step:${step?.stepNo??0}`;
function assignRunCallsToSteps(){
  const ordered=[...S.steps].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.stepNo-b.stepNo);
  const byCommand=new Map(ordered.filter(s=>s.commandId).map(s=>[s.commandId,s]));
  for(const call of S.runCalls){
    let step=call.commandId?byCommand.get(call.commandId):null;
    if(!step){
      const time=Date.parse(call.startedAt||call.createdAt||'');
      if(Number.isFinite(time))for(const candidate of ordered){
        const started=Date.parse(candidate.createdAt||'');
        if(Number.isFinite(started)&&started<=time)step=candidate;else if(Number.isFinite(started)&&started>time)break;
      }
      step ||= ordered[0];
    }
    if(!step)continue;
    const key=stepCallKey(step),current=S.calls.get(key)||[];
    if(!current.some(row=>row.callId===call.callId)){
      current.push(call);current.sort((a,b)=>Date.parse(a.startedAt||a.createdAt)-Date.parse(b.startedAt||b.createdAt));
      S.calls.set(key,current);
    }
  }
}
function render(){
  if(document.querySelector('.cost-tree'))S.costExpanded=new Set([...document.querySelectorAll('[data-cost-node][open]')].map(el=>el.dataset.costNode));
  const focused=document.activeElement,focusId=focused?.id,selection=[focused?.selectionStart,focused?.selectionEnd];
  $('#world').innerHTML=option('','选择作品',S.worldId)+S.worlds.map(w=>option(w.worldId,w.title,S.worldId)).join('');
  $('#version').innerHTML=(S.worlds.find(w=>w.worldId===S.worldId)?.publishedWorldVersionId||S.versions.some(v=>v.current&&v.publicationStatus==='published')?'':option('draft','草稿',S.version))+S.versions.map(v=>option(v.worldVersionId,`发布 v${v.versionNumber} · ${v.publicationStatus}`,S.version)).join('');
  $('#world').disabled=$('#version').disabled=S.busy||!!journal.action;
  document.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.view===S.view)));
  if(!S.auth){$('#main').innerHTML=`<section class="tile login"><div class="tile-h"><h2>登录试玩中台</h2></div><form id="login" class="tile-b console-form"><p class="note">使用内部 Eval 账号，连接 staging。</p><label>账号<input name="username" autocomplete="username" value="slice-eval" required></label><label>密码<input name="password" type="password" autocomplete="current-password" required></label><button class="btn primary" ${S.busy?'disabled':''}>登录</button><p role="alert" class="error">${esc(S.error)}</p></form></section>`;return;}
  $('#main').innerHTML=`${S.error?`<div class="notice error" role="alert">${esc(S.error)}</div>`:''}${S.notice?`<div class="notice" role="status">${esc(S.notice)}</div>`:''}${Object.keys(S.currentErrors).length?`<div class="notice error" role="status">当前读取失败：${esc(Object.values(S.currentErrors).join('；'))}。请点击刷新重新读取。</div>`:''}<div class="head"><div><h1>${{play:'逐步试玩',timeline:'这一局的时间线',flow:'流程与成本',prompts:'提示词'}[S.view]}</h1><p>每次由你提交一步，查看真实结果。回溯与切换尝试暂未接入。</p></div><div class="row">${button('刷新','refresh',S.busy)}${button('退出登录','logout',S.busy)}</div></div>${S.view==='play'?renderPlay():S.view==='timeline'?renderTimeline():S.view==='flow'?renderStats():renderPrompts()}`;
  if(focusId){const next=document.getElementById(focusId);if(next){next.focus({preventScroll:true});try{next.setSelectionRange(...selection);}catch{}}}
}
function launchPanel(){const current=runMeta();return tile('开局与恢复',`<details ${!S.runId||S.startOptions.length?'open':''}><summary>${S.runId?'切换测试局 / 开新局':'选择人物与测试局'}</summary><div class="console-form"><label>10 月 2 日起的开局<select id="run-pick">${option('','选择测试局',S.runId)}${S.runs.map(r=>option(r.runId,`${r.title} · ${fmtTime(r.createdAt)} · ${r.runId.slice(-8)}`,S.runId)).join('')}</select></label><div class="row">${button(S.version==='draft'?'编译草稿 · 准备开局':'读取开局人物','prepare',S.busy||!S.worldId||!!journal.action)}</div>${S.startOptions.length?`<label>扮演人物<select id="playable">${S.startOptions.filter(c=>c.playable).map(c=>option(c.bindingId,c.name,S.playable)).join('')}</select></label><label>首位 AI 人物<select id="initial">${S.startOptions.filter(c=>c.bindingId!==S.playable).map(c=>option(c.characterId,c.name,S.initial)).join('')}</select></label>${button('开一局','start',S.busy||!!journal.action)}`:''}<p class="note">${current?`开局时间：${fmtTime(current.createdAt)} · ${current.readOnly?'外部入口创建，只读观察':'中台可操作'} · ${current.hasConsoleSteps?'含中台登记步骤':'流程直接读取后端命令'}`:esc(S.runId||'选择作品和版本后开局，也可恢复服务端保存的步骤。')}</p></div></details>`,'c12');}
function renderPlay(){
  const step=S.steps.find(s=>s.stepNo===S.selected),stepCalls=S.calls.get(stepCallKey(step))||[],e=S.evidence.get(step?.commandId)||{};
  const selectedCall=stepCalls.find(c=>c.callId===S.selectedCall),calls=selectedCall?[selectedCall]:stepCalls;
  const name=selectedCall?.chainId||stepLabel(step);
  const kpi=(label,value,note)=>`<div class="kpi"><div class="l">${label}</div><div class="v">${value}</div><div class="d">${note}</div></div>`;
  return `<div class="bento">${launchPanel()}${S.runId?`
    ${tile('环节记录',`<div class="step-list">${S.steps.map(s=>`<button class="btn history-row" data-step="${s.stepNo}" aria-pressed="${s.stepNo===S.selected}" ${S.busy?'disabled':''}><b>${s.stepNo}. ${esc(stepLabel(s))}</b><small>${esc(fmtTime(s.createdAt))}</small></button>`).join('')||'<p class="note">暂无环节记录。</p>'}</div>`,'c12')}
    <section id="stage-detail" class="tile c12 stage-detail" aria-label="环节详情">
      <div class="tile-h"><h2>${esc(name)}</h2><span class="sub">${esc(fmtTime(selectedCall?.startedAt||step?.createdAt))}</span></div>
      <div class="stage-metrics">${kpi('环节用时',sec(callElapsedMs(calls)),`首个调用开始至最后完成${selectedCall?'':` · 玩家等待 ${sec(waitMs(e.command))}`}`)}${kpi('环节费用',money(sumCosts(calls)),calls.some(c=>c.cost?.cny==null)?'包含未计价调用，费用尚不完整':'人民币 · 实际调用用量计价')}${kpi('调用次数',String(calls.length),'含失败及重试调用')}</div>
      ${stepCalls.length?`<nav class="call-picker" aria-label="选择环节调用"><button class="btn" data-inspect-call="" aria-pressed="${!selectedCall}">整个环节</button>${stepCalls.map((c,i)=>`<button class="btn" data-inspect-call="${esc(c.callId)}" aria-pressed="${selectedCall?.callId===c.callId}">${i+1}. ${esc(c.chainId)}</button>`).join('')}</nav>`:''}
      <div class="stage-columns">
        <section class="stage-output"><h3>环节输出</h3><div id="step-result">${!selectedCall&&e.outcome?playerOutput(e.outcome,step,e.playerRecords):''}${calls.length?calls.map(c=>`<article class="raw-block"><h4>${esc(c.chainId)} · ${esc(c.status)}</h4>${pre(parseOutput(S.detail.get(c.callId)?.outputText||'')??S.detail.get(c.callId)?.outputText??'尚未保存或读取到该环节的输出')}</article>`).join(''):playerOutput(e.outcome,step,e.playerRecords)}</div></section>
        <section class="stage-prompt"><div class="prompt-heading"><h3>原始提示词 · 输入与输出</h3><div class="subtabs">${[['full','查看原文'],['outline','查看简版']].map(([value,label])=>`<button data-prompt-mode="${value}" aria-pressed="${S.promptMode===value}">${label}</button>`).join('')}</div></div>${stagePromptPanel(calls)}</section>
      </div>
    </section>
    ${tile('继续试玩',`<details><summary>当前开场、章节与操作</summary><div class="bento current-reading">${initialOutlinePanel()}${openingPanel()}${tile('提交下一步',inputPanel(),'c12')}</div></details>`,'c12')}
    ${tile('操作与诊断',`<details><summary>调用明细、解析结果与状态变化</summary>${callsTable(stepCalls,e.command)}<div class="subtabs">${[['raw','原文'],['data','解析数据'],['judge','判定']].map(([v,l])=>`<button data-sub="${v}" aria-pressed="${S.sub===v}">${l}</button>`).join('')}</div>${resultPanel(stepCalls,e)}${diffPanel(e)}</details>`,'c12')}
    ${tile('本局成本树',`<details><summary>累计 ${money(S.costTree?.tree.cny)} · 查看费用明细</summary>${renderCostTree()}</details>`,'c12')}
    ${tile('当前玩家读接口',`<details><summary>查看当前状态</summary><p class="note">当前有效分支的最新画面；历史环节结果以上方输出为准。</p>${Object.entries(S.current).filter(([k])=>['run','chapter','feed','messages','turns','replies','activities','attempts'].includes(k)).map(([k,v])=>`<details><summary>${esc({run:'开局 / 天赋',chapter:'章节 / VN',feed:'信息流',messages:'私聊',turns:'活动回合',replies:'评论',activities:'活动',attempts:'活动邀请'}[k])}</summary>${pre(v)}</details>`).join('')}</details>`,'c12')}`:''}</div>`;
}
function stepLabel(step){return actions.find(([id])=>id===step?.actionType)?.[1]||(step?.actionType==='create_run'?'开局':step?.actionType)||'选择环节';}
function stagePromptPanel(calls){
  if(!calls.length)return '<p class="note">该环节尚无已保存的模型调用。</p>';
  return `${S.promptMode==='outline'?'<p class="note">按实际发送顺序只展示提示词小标题，缩进保留标题层级。</p>':''}${calls.map(c=>{
    const d=S.detail.get(c.callId),request=d?.requestJson,messages=Array.isArray(request)?request:request?.messages;
    return `<article class="prompt-call"><h4>${esc(c.chainId)} · ${esc(c.status)}</h4><h4>原始输入</h4>${Array.isArray(messages)?messages.map((m,i)=>{
      const headings=promptHeadings(m.content);
      return `<div class="raw-block"><b>${i+1}. ${esc(m.role||'unknown')}</b>${S.promptMode==='outline'?(headings.length?`<ol class="prompt-outline">${headings.map(h=>`<li style="--heading-depth:${h.level-1}">${esc(h.title)}</li>`).join('')}</ol>`:'<p class="note">此消息没有小标题，可切换原文查看。</p>'):pre(m.content??m)}</div>`;
    }).join(''):S.promptMode==='outline'?'<p class="note">未读取到可提取标题的消息，请切换原文查看。</p>':pre(request??'尚未保存或读取到实际提示词')}<details ${S.promptMode==='full'?'open':''}><summary>模型原始输出</summary>${pre(d?.outputText??'尚未保存或读取到模型原文')}</details></article>`;
  }).join('')}`;
}
function playerOutput(outcome,step,records=[]){
  if(!step)return '<p class="note">提交后在这里查看。</p>';
  if(!step.commandId&&!step.sourceId&&S.current.run?.opening?.generationStatus==='failed')return '<p class="error">开局生成失败，本局尚不能继续试玩。请排查模型服务后重新开局。</p>';
  if(!outcome)return `<p class="note">${step.commandId?'结果尚未读取。':step.sourceId?'活动管理接口无 Outcome，详情见下方当前活动状态。':'开局进度、天赋和剧情见上方开局区域。'}</p>`;
  const texts=[];
  const walk=(v,key='')=>{if(typeof v==='string'&&['narrativeSummary','text','body','narration','outputText','contentText'].includes(key))texts.push(v);else if(Array.isArray(v))v.forEach(x=>walk(x));else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))if(!['record','facts','memories','world','request'].includes(k))walk(x,k);};
  // Outcome is the existing player-authorized projection, never model text.
  walk(outcome);walk(records);return texts.length?`<div class="screen">${[...new Set(texts)].map(t=>`<p>${esc(t)}</p>`).join('')}</div>`:'<p class="note">该 Outcome 没有玩家正文，查看解析数据与当前玩家读接口。</p>';
}
function openingStage(){
  if(S.current.run?.opening?.generationStatus==='failed')return 'failed';
  if(S.currentErrors.run||S.currentErrors.chapter)return 'unavailable';
  const phase=S.current.chapter?.mainline?.phase;
  if(phase==='failed')return 'failed';
  if(phase==='awaiting_talent')return 'talents';
  if(!phase||phase==='planning')return 'preparing';
  return 'ready';
}
function initialOutlinePanel(){
  const outline=runMeta()?.initialOutline;
  if(!outline)return tile('初始章节规划','<p class="note">这局尚未生成整体走向，或旧开局没有保存可读取的初始规划。</p>','c12');
  const stages=Array.isArray(outline.stages)?outline.stages:[];
  return tile('初始章节规划',`<p class="note">这是开局后台第一次生成并保存的整体走向，不会随之后的偏离修订覆盖。</p>${outline.synopsis?`<details open><summary>整篇故事构思</summary><p style="white-space:pre-wrap">${esc(outline.synopsis)}</p></details>`:''}<div class="state">${stages.map(row=>`<div class="screen"><h3>${esc(row.title||'阶段')} · 第 ${esc(row.start)}–${esc(row.end)} 章</h3><p><strong>目标：</strong>${esc(row.goal||'')}</p><p><strong>冲突：</strong>${esc(row.conflict||'')}</p><p><strong>阶段转折：</strong>${esc(row.turn||'')}</p></div>`).join('')||'<p class="note">章节阶段尚未采集。</p>'}</div>`,'c12');
}
function openingPanel(){
  const stage=openingStage(),chapter=S.current.chapter,selected=chapter?.mainline?.selectedTalent,readOnly=runReadOnly();
  if(stage==='failed')return tile('开局生成失败','<p class="error">后台未能完成本局开局。请查看错误记录后重试，不会自动新建另一局。</p>','c12');
  if(stage==='unavailable')return tile('开局状态暂未读到','<p class="note">请点击刷新，继续读取当前测试局。</p>','c12');
  if(stage==='preparing')return tile(selected?'正在生成开场与第一章':'正在生成三张天赋',`<p role="status">${esc(S.openingNotice||(selected?'天赋已经确认，正在等待开场和首章。':'测试局已创建，正在等后台返回天赋。'))}</p><p class="note">本页会自动读取进度，不会自动选择天赋或提交下一步。</p>`,'c12');
  if(stage==='talents')return tile('选择开局天赋',`<p class="note">${readOnly?'这是其他入口创建的局；中台只展示服务端返回的天赋，不代替原入口确认。':'开局已准备好。选择一张天赋并确认，随后生成开场与第一章。'}</p><div class="opening-talents">${talentChoices().map(c=>`<article class="opening-talent"><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><p class="note">${esc(c.overall)}</p>${c.skills.map(skill=>`<p><strong>${esc(skill.name)} ${Number(skill.value)} / 100</strong> · ${esc(skill.talentName)}<br><small>${esc(skill.narrativeRule)}</small></p>`).join('')}${readOnly?'':`<button class="btn ${S.choice===c.choiceId?'primary':''}" data-talent="${esc(c.choiceId)}" aria-pressed="${S.choice===c.choiceId}" ${S.busy||journal.action?'disabled':''}>${S.choice===c.choiceId?'已选择':'选择这张'}</button>`}</article>`).join('')}</div>${readOnly?'':button(journal.action?'继续确认原天赋':'确认天赋，生成开场','confirm-opening',S.busy||(!journal.action&&!S.choice))}`,'c12');
  const story=chapter.story||{},active=chapter.mainline?.activeChapter;
  if(story.phase==='vn'){
    const vn=story.vn;
    const prose=(vn?.segments||[]).map(row=>`<div class="screen">${row.reply?`<p><strong>你的回应：</strong>${esc(row.reply)}</p>`:''}<p style="white-space:pre-wrap">${esc(row.text)}</p></div>`).join('');
    const control=readOnly?'<p class="note">外部入口创建的局：这里只观察 VN 进度，请回原入口继续操作。</p>':vn?.status==='prepared'?button('进入本章互动小说','vn_enter',S.busy):vn?.status==='ready'?button('结束互动小说，进入自由环节','vn_exit',S.busy):vn?.status==='active'?`<h3>你的回应 · ${vn.repliesUsed+1} / 3</h3>${(vn.segments.at(-1)?.options||[]).map((text,i)=>`<button class="btn" data-vn-option="${i}" ${S.busy?'disabled':''}>${esc(text)}</button>`).join('')}<label>也可以自行回应<textarea id="input" maxlength="300" ${S.busy?'disabled':''}>${esc(S.input)}</textarea></label>${button('提交回应','vn_reply',S.busy)}`:'<p>正在准备互动小说。</p>';
    return tile('章节互动小说',`${story.introduction?.text?`<p>${esc(story.introduction.text)}</p>`:''}${prose}${control}`,'c12');
  }
  const birth=story.birth?['firstAct','secondAct','thirdAct'].map(key=>story.birth[key]).filter(v=>typeof v==='string'&&v.trim()):[];
  return tile('开场与当前章节',`${birth.length?birth.map((text,i)=>`<div class="screen"><h3>第 ${i+1} 幕</h3><p style="white-space:pre-wrap">${esc(text)}</p></div>`).join(''):''}${active?`<h3>第 ${active.ordinal} 章 · ${esc(active.title)}</h3><p>${esc(active.narrativeObjective)}</p>${(active.conditions||[]).map(c=>`<p>目标：${esc(c.label)}</p>`).join('')}<h3>今日日程</h3><p>${esc(active.dayCard?.description||'')}</p>`:'<p class="note">开局已完成，可在下方继续当前剧情操作。</p>'}`,'c12');
}
function syncOpeningAction(previousPhase){
  const phase=S.current.chapter?.mainline?.phase;
  if(phase==='awaiting_talent'){
    S.action='confirm_talent';if(!talentChoices().some(c=>c.choiceId===S.choice))S.choice='';
  }else if(phase==='playing'&&previousPhase!=='playing'&&['confirm_talent','vn_enter','vn_reply','vn_exit'].includes(S.action))S.action='post';
}
function talentChoices(){const find=v=>{if(!v||typeof v!=='object')return [];if(Array.isArray(v.talentCandidates)&&v.talentCandidates.length)return v.talentCandidates;for(const x of Object.values(v)){const found=find(x);if(found.length)return found;}return [];};return find(S.current.chapter).length?find(S.current.chapter):find(S.current.run);}
const actions=[['vn_enter','进入 VN'],['vn_reply','VN 回应'],['vn_exit','结束 VN'],['confirm_talent','选择天赋'],['post','发帖'],['comment','评论'],['dm_message','私聊'],['activity_create','创建活动'],['activity_enter','进入活动'],['activity_turn','活动行动'],['activity_exit','退出活动'],['advance_day','换日'],['end_chapter','结束本章'],['next_chapter','下一章']];
function inputPanel(){if(runReadOnly())return '<p class="note">这是网页 Demo 或其他入口创建的局，中台只读展示其后端流程；请回原入口继续操作。</p>';if(S.current.chapter?.story?.phase==='vn')return '<p class="note">请先完成上方章节互动小说。</p>';if(['preparing','talents','failed','unavailable'].includes(openingStage()))return '<p class="note">先完成上方开局步骤，再提交剧情行动。</p>';return `<div class="console-form"><label>操作<select id="action">${actions.map(([v,l])=>option(v,l,S.action)).join('')}</select></label><label>玩家输入<textarea id="input" maxlength="500" ${S.busy?'disabled':''}>${esc(S.input)}</textarea></label>
  ${S.action==='dm_message'?`<label>人物<select id="target">${option('','选择人物',S.target)}${items(S.current.cast).filter(c=>c.actorId!==S.current.run?.playerActorId).map(c=>option(c.actorId,c.displayName||c.actorId,S.target)).join('')}</select></label>`:''}
  ${S.action==='comment'?`<label>帖子<select id="post">${option('','选择帖子',S.post)}${items(S.current.feed).map(p=>option(p.postId||p.contentId,p.text||p.body||p.postId,S.post)).join('')}</select></label>`:''}
  ${S.action==='confirm_talent'?`<label>天赋<select id="choice">${option('','选择服务端返回的天赋',S.choice)}${talentChoices().map(c=>option(c.choiceId,`${c.title} · ${c.description}`,S.choice)).join('')}</select></label>`:''}
  ${S.action.startsWith('activity_')?`<label>活动<select id="activity">${option('','选择活动',S.activity)}${items(S.current.activities).map(a=>option(a.activityId,`${a.title||a.activityId} · ${a.status}`,S.activity)).join('')}</select></label><label>待进入的活动<select id="attempt">${option('','选择活动邀请',S.attempt)}${items(S.current.attempts).map(a=>option(a.activityAttemptId,`${a.title||a.activityAttemptId} · ${a.status}`,S.attempt)).join('')}</select></label>`:''}
  ${S.action==='activity_create'?`<label>标题<input id="activity-title" value="${esc(S.activityTitle)}"></label><label>时间<input id="activity-when" value="${esc(S.activityWhen)}"></label><label>地点<input id="activity-location" value="${esc(S.activityLocation)}"></label><label>目的<input id="activity-purpose" value="${esc(S.activityPurpose)}"></label><label>邀请人物<select id="invite" multiple>${items(S.current.cast).map(c=>`<option value="${esc(c.actorId)}">${esc(c.displayName||c.actorId)}</option>`).join('')}</select></label>`:''}
  ${button(journal.action?'继续上次提交':'提交这一步','submit',S.busy)}<small class="note">${journal.action?'上次提交尚未完成，继续会复用原始请求和幂等键。':'不自动连续执行。'}</small></div>`;}
function callsTable(calls,command){if(!calls.length)return '<p class="note">尚无已保存调用。</p>';const start=Math.min(...calls.map(c=>Date.parse(c.startedAt)||Infinity)),end=Math.max(...calls.map(c=>Date.parse(c.completedAt)||0)),span=Math.max(1,end-start);
  return `<table class="calls"><tbody>${calls.map(c=>{const lane=callLane(c,command?.completedAt);return `<tr data-call="${c.callId}" tabindex="0" role="button"><td>${esc(c.chainId)}<small>${esc(c.usage?.model||'模型未采集')} · ${{foreground:'玩家要等',background:'后台',unknown:'时间未采集'}[lane]}</small></td><td><div class="track"><i class="${lane==='background'?'bg':''}" style="left:${Number.isFinite(start)?Math.max(0,(Date.parse(c.startedAt)-start)/span*100)||0:0}%;width:${Math.max(1,(c.latencyMs||0)/span*100)}%"></i></div></td><td>${sec(c.latencyMs)}<br>${money(cost(c))}${c.cost?.cacheEstimated?'<small>缓存未采集 · 按未命中</small>':''}${c.cost?.reason?`<small>${esc(c.cost.reason)}</small>`:''}</td></tr>`;}).join('')}</tbody></table>`;}
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
function renderTimeline(){return `<div class="bento">${S.steps.map(s=>tile(`第 ${s.stepNo} 步 · ${esc(s.actionType)}`,`<p class="note">${esc(fmtTime(s.createdAt))}</p><p>${esc(s.inputText)}</p>${callsTable(S.calls.get(stepCallKey(s))||[],S.evidence.get(s.commandId)?.command)}`,'c12')).join('')||'<p class="note">先开一局。</p>'}</div>`;}
function costNote(c){return !c?'费用未采集':`${c.pricedCalls} / ${c.totalCalls} 次已计价${c.missingCalls?`；${c.missingCalls} 次缺用量、时间或单价，未计入`:''}${c.cacheEstimatedCalls?`；${c.cacheEstimatedCalls} 次缺缓存明细，按未命中计价`:''}`;}
function costCard(label,c){return tile(label,`<div class="kpi"><div class="v">${money(c?.cny)}</div><p class="note">${esc(costNote(c))}${c?.missingCalls?'；此金额仅为已计价小计':''}</p></div>`,'c4');}
function renderCostTree(){
  if(S.costTreeError)return `<p class="error">${esc(S.costTreeError)}</p>`;
  if(!S.costTree)return '<p class="note">本局成本尚未读取。</p>';
  const row=(node,key)=>{
    const steps=S.steps.filter(step=>node.commandIds.includes(step.commandId)||node.kind==='opening'&&step.actionType==='create_run');
    const jump=!node.children.length?steps.map(step=>`<button class="btn" data-step="${step.stepNo}">步骤 ${step.stepNo}</button>`).join(''):'';
    const title=`<span class="cost-node-label">${esc(node.label)}${node.branch==='rewound'?' · 回溯后':''}</span><strong>${money(node.cny)}${node.complete?'':'（已计价小计）'}</strong><span class="note">${node.status==='failed'?'操作失败':node.finished?'已完成':'未完成'}${node.passed===null?'':node.passed?' · 通过':' · 未通过'}</span>`;
    const counts=node.kind==='day'?['post','comment','dm','activity'].map(kind=>{const children=node.children.filter(child=>child.kind===kind);return children.length?`${esc(children[0].label)} ×${children.length}`:'';}).filter(Boolean).join(' · '):'';
    const detail=`<div class="cost-node-info">${counts?`${counts}<br>`:''}${node.calls} 次调用 · 失败／修复 ${node.retries.count} 次，${money(node.retries.cny)}${node.retries.complete?'':'（小计）'} · 命令受理到完成：${sec(node.waitMs)}<br>${esc(costNote(node))}${jump?`<div class="row">${jump}</div>`:''}</div>`;
    return `<details class="cost-node" data-cost-node="${key}" ${S.costExpanded.has(key)?'open':''}><summary>${title}</summary>${detail}${node.children.map((child,index)=>row(child,`${key}.${index}`)).join('')}</details>`;
  };
  return `<p class="note">本局全部运行调用，包含开局、后台跟进、失败及已放弃分支；编译费用单独展示。父级金额是下方子级的汇总。读取时间 ${esc(S.costTree.asOf)}。</p><div class="cost-tree">${row(S.costTree.tree,'0')}</div>`;
}
function renderUnitStats(){
  if(!S.runId)return '<p class="note">选择一局后查看业务单元单价。</p>';
  if(S.costTreeError)return `<p class="error">${esc(S.costTreeError)}</p>`;
  if(!S.costTree)return '<p class="note">本局成本尚未读取。</p>';
  const units=runUnitStats(S.costTree.tree);
  return `<p class="note">当前局 ${esc(S.runId)}，只统计这一局的全部调用。读取时间 ${esc(S.costTree.asOf)}。均价和分位数只含已完成且全部计价的单元；首章单列。发帖、评论和私聊完成满 10 分钟后纳入。</p><div class="cost-table-wrap"><table class="call-table unit-prices"><thead><tr><th>业务单元</th><th>完成／已计价</th><th>均价</th><th>P50</th><th>P90</th><th>最高</th><th>失败成本</th><th>每完成一次分摊失败</th></tr></thead><tbody>${units.map(u=>`<tr><td>${esc(u.label)}</td><td>${u.count} / ${u.pricedCount}${u.missingCount?`<br><small>${u.missingCount} 个缺价</small>`:''}</td><td>${money(u.mean)}</td><td>${money(u.p50)}</td><td>${money(u.p90)}</td><td>${money(u.max)}</td><td>${money(u.failedCny)}${u.failedComplete?'':'（小计）'}</td><td>${money(u.failedPerFinished)}</td></tr>`).join('')||'<tr><td colspan="8">暂无单元记录</td></tr>'}</tbody></table></div>`;
}
async function loadCostTree(){
  const runId=S.runId,auth=S.auth;
  try{const value=await api('evalGetRunCostTree',{runId});if(S.runId===runId&&S.auth===auth){S.costTree=value;S.costTreeError='';}}
  catch(error){if(S.runId===runId&&S.auth===auth){S.costTree=null;S.costTreeError=`成本树读取失败：${error.message}`;}}
}
function renderStats(){const v=S.stats;return `<div class="bento">${launchPanel()}${tile('本局业务单元单价',renderUnitStats(),'c12')}${tile('本局成本明细',renderCostTree(),'c12')}</div>${button('读取本作品最近 30 天','stats',S.busy||!S.worldId)}${v?`<p class="note">${esc(v.pricing?.basis||'按真实用量计价')} 价格核对日期 ${esc(v.pricing?.checkedAt||'未知')}。统计自 ${esc(v.since)}，运行调用最多 ${v.sampleLimit} 条，${v.possiblyTruncated||v.compiler?.possiblyTruncated?'已达到上限，以下仅为样本费用':'未达到截断上限'}；同批存档已完成章数 ${v.completedChapters}。</p><div class="bento">${costCard('人民币总费用 · 已读取样本',v.cost)}${costCard('游玩流程费用',v.runtimeCost)}${costCard('作品编译费用',v.compiler?.cost)}${v.items.map(c=>tile(esc(c.chainId),`<div class="stats"><div><b>${c.count}</b><span>调用</span></div><div><b>${sec(c.p50Ms)}</b><span>P50</span></div><div><b>${sec(c.p95Ms)}</b><span>P95</span></div><div><b>${(c.failureRate*100).toFixed(1)}%</b><span>失败</span></div></div><p><strong>人民币费用 ${money(c.cost?.cny)}</strong></p><p class="note">${esc(costNote(c.cost))}</p><details><summary>Token 与调用统计</summary>${pre({输入均值:c.inputTokensMean,输出均值:c.outputTokensMean,缓存命中率:c.cacheHitRate,每章调用:c.callsPerChapter})}</details>`,'c6')).join('')}${tile('作品编译 · 用量与用时',pre(v.compiler),'c12')}</div>`:'<p class="note">读取真实调用记录，展示总额、各流程和编译的人民币费用；失败重试中已返回的用量也计入。</p>'}`;}
function renderActualPromptTrace(){
  if(!S.runId)return '<p class="note">先选择一个开局。</p>';
  if(S.traceError)return `<p class="error">${esc(S.traceError)}</p>${button('重新读取这局实际调用','trace',S.busy)}`;
  if(S.traceRunId!==S.runId)return `<p class="note">这里展示数据库里这局实际发给模型的 messages、模型原文和逐次费用，不是模板预览。</p>${button('读取这局实际调用','trace',S.busy)}`;
  if(!S.runCalls.length)return '<p class="note">这局尚未保存任何模型调用。</p>';
  const known=S.runCalls.filter(c=>cost(c)!=null),missing=S.runCalls.length-known.length,total=known.reduce((sum,c)=>sum+cost(c),0);
  const byChain=[...new Set(S.runCalls.map(c=>c.chainId))].map(chainId=>{const calls=S.runCalls.filter(c=>c.chainId===chainId),priced=calls.filter(c=>cost(c)!=null);
    return `<span class="chip">${esc(chainId)} · ${priced.length?money(priced.reduce((s,c)=>s+cost(c),0)):'待计价'} · ${calls.length} 次</span>`;}).join(' ');
  const rows=S.runCalls.map((c,index)=>{const d=S.detail.get(c.callId),messages=d?.requestJson;
    const scope=c.commandId?`命令 ${c.commandId.slice(-8)}`:'开局 / 后台无命令调用';
    return `<details class="prompt-call" ${index===0?'open':''}><summary><strong>${esc(c.chainId)}</strong> · ${esc(c.usage?.model||'模型未采集')} · ${money(cost(c))} · ${esc(fmtTime(c.startedAt||c.createdAt))} · ${esc(c.status)}</summary>
      <p class="note">${esc(scope)} · ${sec(c.latencyMs)} · 输入 ${c.usage?.inputTokens??'未采集'} / 输出 ${c.usage?.outputTokens??'未采集'} Token</p>
      <h3>实际发送给模型的 messages</h3>
      ${Array.isArray(messages)?messages.map((m,i)=>`<div class="raw-block"><b>${i+1}. ${esc(m.role||'unknown')}</b>${pre(m.content??m)}</div>`).join(''):pre(messages??'未保存实际 prompt；只有开启 staging Story Test Mode 的调用才会记录')}
      <h3>模型原始输出</h3>${pre(d?.outputText??'未保存模型原文')}
      <h3>本次调用与费用</h3>${pre({callId:c.callId,chainId:c.chainId,commandId:c.commandId,status:c.status,latencyMs:c.latencyMs,usage:c.usage,cost:c.cost,errorCode:c.errorCode,createdAt:c.createdAt})}
    </details>`;}).join('');
  return `<p class="note">本局共 ${S.runCalls.length} 次真实模型调用；已计价 ${known.length} 次合计 ${money(total)}${missing?`，${missing} 次待计价`:''}。下方每条都是当时数据库保存的实际 request_json / output_text。</p><div class="row">${byChain}</div>${rows}`;
}
function renderPrompts(){const nodes=S.catalog?.nodes||[];return `<div class="bento">
  ${tile('真实执行 · 这局实际发给模型的内容',renderActualPromptTrace(),'c12')}
  ${tile('模板装配预览',`<div class="console-form">${button('读取提示词目录','catalog',S.busy)}<label>链路<select id="prompt-node">${option('','选择链路',S.promptNode)}${nodes.map(n=>option(n.nodeId,n.label,S.promptNode)).join('')}</select></label><p class="note">这里仅用于查看当前代码如何组装模板，不代表某次历史调用。上面的“真实执行”才是实际发送内容。</p><label>链路输入（JSON）<textarea id="prompt-input" rows="12">${esc(S.promptInput)}</textarea></label>${button('拼装预览 · 不调用模型','preview',S.busy||!S.promptNode)}</div>`,'c4')}
  ${tile('模板预览 messages',S.promptPreview?pre(S.promptPreview):'<p class="note">未执行模型、不保存 Runtime，只展示当前模板组装结果。</p>','c8')}
</div>`;}
async function listAll(op,params={}){const rows=[];let cursor;do{const page=await api(op,params,undefined,cursor?{cursor}:{});rows.push(...items(page));cursor=page.pageInfo?.nextCursor;if(!page.pageInfo?.hasMore)break;}while(cursor);return rows;}
async function loadConsoleRuns(){
  const rows=items(await api('evalListConsoleRuns'));
  S.runs=rows.filter(visibleConsoleRun);
  const excluded=id=>rows.some(r=>r.runId===id&&!visibleConsoleRun(r));
  if(journal.action&&excluded(journal.action.runId)){delete journal.action;saveJournal();}
  if(S.runId&&!S.runs.some(r=>r.runId===S.runId)){
    observation++;S.runId='';S.steps=[];S.current={};S.currentErrors={};S.calls.clear();S.detail.clear();S.evidence.clear();S.runCalls=[];S.costTree=null;S.selectedCall='';
    const url=new URL(location.href);url.searchParams.delete('runId');history.replaceState(null,'',url);
    S.notice='仅展示北京时间 2026 年 10 月 2 日及之后创建的局，请重新选择。';
  }
}
async function boot(){S.costTree=null;S.costTreeError='';S.stats=null;S.steps=[];S.current={};S.currentErrors={};S.calls.clear();S.detail.clear();S.evidence.clear();journal=read(localStorage,storageKey(),{});S.worlds=await listAll('evalListWorldDrafts');await loadConsoleRuns();const prices=await api('evalGetModelPricing');S.prices=prices.models;S.pricing=prices;if(!S.worldId)S.worldId=S.worlds[0]?.worldId||'';if(S.worldId&&!S.worlds.some(w=>w.worldId===S.worldId))throw Error('当前 Eval 账号或工作区无权读取这个作品，请使用创作时的账号登录。');if(S.worldId)await versions(true);if(S.runId)await loadRun();}
async function versions(requireRequestedVersion=false){const world=S.worlds.find(w=>w.worldId===S.worldId);if(S.version==='draft'&&world?.publishedWorldVersionId)S.version=world.publishedWorldVersionId;S.versions=await listAll('evalListWorldVersions',{worldId:S.worldId});if(S.version==='draft'){const published=S.versions.find(v=>v.current&&v.publicationStatus==='published');if(published)S.version=published.worldVersionId;}if(S.version!=='draft'&&!S.versions.some(v=>v.worldVersionId===S.version)){if(requireRequestedVersion)throw Error('指定的作品版本不可读取，请从创作端重新进入。');S.version='draft';}S.startOptions=[];}
async function prepare(){const world=S.worlds.find(w=>w.worldId===S.worldId);if(!world)throw Error('当前工作区没有这个作品');
  if(S.version==='draft'){
    const draft=await api('evalGetWorldDraft',{worldDraftId:world.worldDraftId});if(draft.publishedWorldVersionId){S.version=draft.publishedWorldVersionId;await versions(true);return prepare();}if(!journal.prepare||journal.prepare.worldId!==S.worldId){journal.prepare={worldId:S.worldId,slot:`compile:${crypto.randomUUID()}`};saveJournal();}const slot=journal.prepare.slot;
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
  S.notice='正在创建测试局…';S.openingNotice='';render();journal.startSlot ||= `start:${crypto.randomUUID()}`;saveJournal();const value=await mutation(journal.startSlot,'evalCreateRun',{worldId:S.worldId},{worldVersionId:S.version,identitySelection:{sourceType:'playable_character',characterVersionId:person.characterVersionId,worldCastBindingId:person.bindingId},initialLinkedCharacterId:S.initial});
  observation++;S.runId=value.runId;S.costTree=null;S.costTreeError='';S.current={};S.currentErrors={};S.steps=[];S.selected=0;S.calls.clear();S.detail.clear();S.evidence.clear();S.runCalls=[];S.traceRunId='';S.traceError='';S.notice='测试局已创建，正在读取开局进度。';setRunUrl();render();await mutation(`session:${S.runId}`,'evalRecordConsoleStep',{runId:S.runId},{});delete journal.startSlot;saveJournal();S.startOptions=[];setRunUrl();await loadRun();await loadConsoleRuns();S.notice='测试局已创建，开局进度显示在下方。';}
function setRunUrl(){const url=new URL(location.href);url.searchParams.set('runId',S.runId);url.searchParams.set('worldId',S.worldId);url.searchParams.set('version',S.version);history.replaceState(null,'',url);}
async function loadCurrent(){
  const runId=S.runId,auth=S.auth,params={runId};
  const reads=[['run','开局状态','evalGetRun',true],['chapter','章节 / 天赋','evalGetRunChapter',false],['cast','人物','evalListRunCast',true],['feed','信息流','evalListRunFeed',true],['activities','活动','evalListActivityInstances',true],['attempts','活动邀请','evalListActivityAttempts',true]];
  const values=await Promise.allSettled(reads.map(([, ,op,validateResponse])=>api(op,params,undefined,{},undefined,validateResponse)));
  if(S.runId!==runId||S.auth!==auth)return;
  const current={},errors={};
  values.forEach((value,i)=>{const [name,label]=reads[i];if(value.status==='fulfilled')current[name]=value.value;else{const message=value.reason?.message;errors[name]=`${label}：${message==='Failed to fetch'?'网络连接中断，未收到响应':message||'读取失败'}`;}});
  const previousPhase=S.current.chapter?.mainline?.phase;S.current=current;S.currentErrors=errors;syncOpeningAction(previousPhase);
}
async function loadRun(){observation++;S.selectedCall='';S.costTree=null;S.costTreeError='';S.calls.clear();S.detail.clear();S.evidence.clear();S.runCalls=[];S.traceRunId='';S.traceError='';await loadCurrent();S.steps=items(await api('evalListConsoleSteps',{runId:S.runId}));S.selected=S.steps.at(-1)?.stepNo||0;
  const historySteps=S.steps.filter(s=>s.commandId);const evidenceErrors=[];for(let i=0;i<historySteps.length;i+=4){const batch=await Promise.allSettled(historySteps.slice(i,i+4).map(step=>loadEvidence(step,{full:step.stepNo===S.selected})));for(const result of batch)if(result.status==='rejected')evidenceErrors.push(result.reason?.message||'步骤证据读取失败');}
  if(evidenceErrors.length)S.currentErrors.evidence=`操作证据：${evidenceErrors[0]}${evidenceErrors.length>1?`（另有 ${evidenceErrors.length-1} 项）`:''}`;
  else delete S.currentErrors.evidence;
  try{await loadRunCallMetadata();}catch(error){S.currentErrors.calls=`整局调用：${error.message}`;}
  await loadStepDetails(S.steps.find(s=>s.stepNo===S.selected));await loadCostTree();setRunUrl();observeOpening();}
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
async function loadEvidence(step,{full=true}={}){const runId=S.runId;const params={runId,commandId:step.commandId};const e=S.evidence.get(step.commandId)||{};e.command=await api('evalGetWorldCommand',params);const calls=items(await api('evalListStoryEngineCalls',{runId},undefined,{commandId:step.commandId}));if(S.runId!==runId)return;S.calls.set(stepCallKey(step),calls);
  if(full&&(e.command.status==='applied'||e.command.status==='rejected')){try{e.outcome=await api('evalGetOutcomeByCommand',params);}catch(err){if(err.status!==404)throw err;}}
  if(full&&e.outcome)e.playerRecords=await playerRecords(step,e.outcome);
  for(const [key,revision]of [['before',step.beforeRevision],['after',step.afterRevision]])if(full&&revision!=null){try{e[key]=await api('evalGetStoryEngineSnapshot',{runId:S.runId},undefined,{revision,branchId:step.branchId});}catch(err){if(err.status!==404)throw err;}}
  if(S.runId!==runId)return;
  S.evidence.set(step.commandId,e);for(const c of full?(S.calls.get(stepCallKey(step))||[]):[])if(!S.detail.has(c.callId))S.detail.set(c.callId,await api('evalGetStoryEngineCall',{runId:S.runId,callId:c.callId}));
}
async function submit(){
  if(runReadOnly())throw Error('外部入口创建的 Run 在输出中台只读，请回原入口继续操作。');
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
    delete journal.action;saveJournal();S.input='';await loadCurrent();observeOpening();S.steps=items(await api('evalListConsoleSteps',{runId:a.runId}));
    await loadEvidence(S.steps.find(s=>s.commandId===commandId));render();observeBackground(a.runId,commandId);
  }else{const sourceId=result.activityAttemptId&&a.type==='activity_create'?result.activityAttemptId:result.activityId||a.activity;if(sourceId)await mutation(`${a.id}:record`,'evalRecordConsoleStep',{runId:a.runId},{sourceId,actionType:a.type});delete journal.action;saveJournal();await loadCurrent();S.steps=items(await api('evalListConsoleSteps',{runId:a.runId}));S.selected=S.steps.at(-1)?.stepNo||0;S.notice='活动管理步骤已保存。该接口没有命令调用记录，详情见当前活动状态。';}
  await loadCostTree();
  if(a.channelId)S.current.messages=await api('evalListDmMessages',{runId:a.runId,channelId:a.channelId});
  if(a.post)S.current.replies=await api('evalListPostReplies',{runId:a.runId,postId:a.post});
  if(a.activity)S.current.turns=await api('evalListRunActivityTurns',{runId:a.runId,activityId:a.activity});
}
let openingObservation=0;
async function observeOpening(){
  const generation=++openingObservation,runId=S.runId,auth=S.auth;
  if(!runId||!auth||openingStage()!=='preparing')return;
  const deadline=Date.now()+120000;S.openingNotice='';
  const current=()=>generation===openingObservation&&S.runId===runId&&S.auth===auth;
  try{
    while(current()&&Date.now()<deadline){
      await pause(2500);if(!current())return;if(S.busy)continue;
      const [run,chapter]=await Promise.all([api('evalGetRun',{runId}),api('evalGetRunChapter',{runId},undefined,{},undefined,false)]);
      if(!current())return;
      const previousPhase=S.current.chapter?.mainline?.phase;S.current.run=run;S.current.chapter=chapter;delete S.currentErrors.run;delete S.currentErrors.chapter;syncOpeningAction(previousPhase);render();
      if(openingStage()!=='preparing'){await loadCostTree();if(current())render();return;}
    }
    if(current()){S.openingNotice='后台仍在生成，进度已保留。点击刷新继续读取当前局，无需再次开局。';render();}
  }catch(e){if(current()){S.openingNotice=`进度读取中断：${e.message}。点击刷新继续当前局，无需再次开局。`;render();}}
}
let observation=0;
async function observeBackground(runId,commandId){const generation=observation;const start=Date.now();let changed=start,last=(S.calls.get(commandId)||[]).map(c=>c.callId).join(',');
  try{while(Date.now()-start<120000&&Date.now()-changed<15000){await pause(2500);if(generation!==observation||S.runId!==runId||!S.auth)return;
    const step=S.steps.find(s=>s.commandId===commandId);await loadEvidence(step);const now=(S.calls.get(commandId)||[]).map(c=>c.callId).join(',');if(now!==last){last=now;changed=Date.now();await loadCostTree();}render();}
    if(generation===observation&&!S.busy){S.notice='后台观察结束：连续 15 秒无新调用，或已达到 120 秒上限。可手动刷新。';render();}
  }catch(e){if(generation===observation&&!S.busy){S.notice=`后台观察中止：${e.message}`;render();}}
}
async function loadRunCallMetadata(){
  if(!S.runId)return;
  const runId=S.runId,auth=S.auth;
  const page=await api('evalListStoryEngineCalls',{runId},undefined,{},undefined,false);
  if(S.runId!==runId||S.auth!==auth)return;
  S.runCalls=items(page);assignRunCallsToSteps();
}
async function loadStepDetails(step){
  const runId=S.runId,auth=S.auth;
  const calls=S.calls.get(stepCallKey(step))||[];
  for(let i=0;i<calls.length;i+=8){
    const batch=calls.slice(i,i+8).filter(c=>!S.detail.has(c.callId));
    const values=await Promise.allSettled(batch.map(c=>api('evalGetStoryEngineCall',{runId,callId:c.callId})));
    if(S.runId!==runId||S.auth!==auth)return;
    values.forEach((v,index)=>{if(v.status==='fulfilled')S.detail.set(batch[index].callId,v.value);});
    const failed=values.find(v=>v.status==='rejected');
    if(failed)S.currentErrors.prompt=`环节原文：${failed.reason?.message||'读取失败，请刷新重试'}`;
  }
}
async function loadRunTrace(force=false){
  if(!S.runId)return;
  if(!force&&S.traceRunId===S.runId&&!S.traceError)return;
  const runId=S.runId,auth=S.auth;S.traceError='';
  try{
    if(!S.runCalls.length)await loadRunCallMetadata();
    if(S.runId!==runId||S.auth!==auth)return;
    for(let i=0;i<S.runCalls.length;i+=8){
      const batch=S.runCalls.slice(i,i+8).filter(c=>!S.detail.has(c.callId));
      const values=await Promise.allSettled(batch.map(c=>api('evalGetStoryEngineCall',{runId,callId:c.callId})));
      if(S.runId!==runId||S.auth!==auth)return;
      values.forEach((value,index)=>{if(value.status==='fulfilled')S.detail.set(batch[index].callId,value.value);});
      render();
    }
    if(S.runId===runId&&S.auth===auth)S.traceRunId=runId;
  }catch(error){
    if(S.runId===runId&&S.auth===auth){S.runCalls=[];S.traceRunId=runId;S.traceError=`实际调用读取失败：${error.message}`;}
  }
}
async function preview(){const node=S.catalog.nodes.find(n=>n.nodeId===S.promptNode);if(!node)throw Error('请选择链路');const input=JSON.parse(S.promptInput||'{}');
  S.promptPreview=await api('evalPreviewPromptRequest',{}, {nodeId:node.nodeId,input});
}
function drawer(title,content){$('#dr-title').textContent=title;$('#dr-sub').textContent='';$('#dr-body').innerHTML=content;$('#drawer').classList.add('open');$('#scrim').classList.add('on');$('#drawer').setAttribute('aria-hidden','false');}
function closeDrawer(){$('#drawer').classList.remove('open');$('#scrim').classList.remove('on');$('#drawer').setAttribute('aria-hidden','true');}
function prices(){drawer('官方单价 · 人民币 / 百万 Token',`<p class="note">价格核对日期 ${esc(S.pricing?.checkedAt)}。${esc(S.pricing?.basis)} DeepSeek 下表为空闲单价，高峰乘 2；Qwen 按每次输入长度选档。</p>${Object.entries(S.prices).map(([model,p])=>`<h3>${esc(model)}</h3>${pre(p)}`).join('')}<h3>时段规则</h3>${pre(S.pricing?.deepseek)}<p>${(S.pricing?.sources||[]).map(url=>`<a href="${esc(url)}" target="_blank" rel="noopener">官方价格来源</a>`).join(' · ')}</p>`);}
document.addEventListener('submit',e=>{if(e.target.id==='login'){e.preventDefault();const data=new FormData(e.target);task(async()=>{S.auth=await api('createCompilerRuntimeEvalSession',{},Object.fromEntries(data));write(sessionStorage,'slice-console-auth',S.auth);await boot();});}});
document.addEventListener('click',e=>{const el=e.target.closest('button,[data-call]');if(!el)return;
  if(el.id==='theme'){const dark=document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.dataset.theme=dark?'light':'dark';write(localStorage,'slice-console-theme',document.documentElement.dataset.theme);return;}
  if(el.id==='open-prices')return prices();if(el.id==='dr-close')return closeDrawer();
  if(el.dataset.view){S.view=el.dataset.view;if(S.view==='flow'&&S.worldId&&!S.stats)return task(async()=>{S.stats=await api('evalGetChainStats',{worldId:S.worldId});});if(S.view==='prompts'&&S.runId&&S.traceRunId!==S.runId)return task(()=>loadRunTrace());render();return;}
  if(el.dataset.sub){S.sub=el.dataset.sub;render();return;}
  if(el.dataset.promptMode){S.promptMode=el.dataset.promptMode;render();return;}
  if(el.dataset.inspectCall!==undefined){S.selectedCall=el.dataset.inspectCall;render();return;}
  if(el.dataset.step){if(S.busy)return;S.view='play';S.selected=Number(el.dataset.step);S.selectedCall='';const step=S.steps.find(s=>s.stepNo===S.selected);task(async()=>{if(step?.commandId)await loadEvidence(step);assignRunCallsToSteps();await loadStepDetails(step);}).then(()=>$('#stage-detail')?.scrollIntoView({behavior:'smooth',block:'start'}));return;}
  if(el.dataset.call){const c=[...S.calls.values()].flat().find(c=>c.callId===el.dataset.call),d=S.detail.get(el.dataset.call);drawer('模型调用',`${pre({chain:c.chainId,usage:c.usage,startedAt:c.startedAt,completedAt:c.completedAt,latencyMs:c.latencyMs,cost:c.cost,errorCode:c.errorCode})}<h3>实际 messages</h3>${pre(d?.requestJson??'未开启测试模式或没有保存原文')}<h3>模型原文</h3>${pre(d?.outputText??'未开启测试模式或没有保存原文')}`);return;}
  if(el.dataset.vnOption!==undefined){if(S.busy)return;S.input=S.current.chapter.story.vn.segments.at(-1).options[Number(el.dataset.vnOption)];render();return;}
  if(el.dataset.talent){if(S.busy||journal.action)return;S.choice=el.dataset.talent;S.action='confirm_talent';render();return;}
  const action=el.dataset.action;if(!action)return;
  task(async()=>{if(action==='logout'){S.auth=null;write(sessionStorage,'slice-console-auth',null);observation++;return;}
    if(['vn_enter','vn_reply','vn_exit'].includes(action)){S.action=action;return submit();}
    if(action==='confirm-opening'){S.action='confirm_talent';return submit();}if(action==='prepare')return prepare();if(action==='start')return start();if(action==='submit')return submit();
    if(action==='refresh'){await loadConsoleRuns();if(S.view==='flow'&&S.worldId){if(S.runId)await loadCostTree();S.stats=await api('evalGetChainStats',{worldId:S.worldId});return;}if(S.runId){await loadRun();if(S.view==='prompts')await loadRunTrace(true);return;}return boot();}
    if(action==='stats'){S.stats=await api('evalGetChainStats',{worldId:S.worldId});}
    if(action==='trace')await loadRunTrace(true);
    if(action==='catalog')S.catalog=await api('evalGetPromptCatalog');if(action==='preview')await preview();});
});
$('#scrim').addEventListener('click',closeDrawer);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();if(e.key==='Enter'&&e.target.matches('[data-call]'))e.target.click();});
const inputs={input:'input',target:'target',post:'post',choice:'choice',activity:'activity',attempt:'attempt','activity-title':'activityTitle','activity-when':'activityWhen','activity-location':'activityLocation','activity-purpose':'activityPurpose','prompt-input':'promptInput'};
document.addEventListener('input',e=>{if(inputs[e.target.id])S[inputs[e.target.id]]=e.target.value;});
document.addEventListener('change',e=>{const el=e.target;if(inputs[el.id])S[inputs[el.id]]=el.value;
  if(el.id==='action'){S.action=el.value;render();}if(el.id==='invite')S.invite=[...el.selectedOptions].map(o=>o.value);
  if(el.id==='world')task(async()=>{S.costTree=null;S.costTreeError='';S.worldId=el.value;S.version='draft';S.stats=null;S.runId='';S.steps=[];S.current={};S.runCalls=[];S.traceRunId='';S.traceError='';observation++;await versions();});
  if(el.id==='version'){S.version=el.value;S.startOptions=[];render();}
  if(el.id==='run-pick'&&journal.action&&el.value!==journal.action.runId){S.error='请先完成上次提交';render();return;}
  if(el.id==='run-pick')task(async()=>{observation++;S.runId=el.value;S.costTree=null;S.costTreeError='';S.costExpanded=new Set(['0']);S.runCalls=[];S.traceRunId='';S.traceError='';const run=S.runs.find(r=>r.runId===S.runId);if(run){S.stats=null;S.worldId=run.worldId;await versions();await loadRun();if(S.view==='prompts')await loadRunTrace();}});
  if(el.id==='playable'){S.playable=el.value;S.initial=(S.startOptions.find(c=>c.bindingId!==S.playable&&c.initialLinkedCharacterCandidate)||S.startOptions.find(c=>c.bindingId!==S.playable))?.characterId||'';render();}
  if(el.id==='initial')S.initial=el.value;
  if(el.id==='prompt-node'){S.promptNode=el.value;const node=S.catalog.nodes.find(n=>n.nodeId===el.value);S.promptInput=json(node?.prompt.input||{});render();}
});
const theme=read(localStorage,'slice-console-theme');if(theme)document.documentElement.dataset.theme=theme;
render();if(S.auth)task(boot);
