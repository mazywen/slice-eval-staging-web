const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types={world:'作品',world_comment:'评论',world_story_share:'剧情卡分享',account:'玩家'};
const statuses={pending:'待处理',upheld:'维持原判',overturned:'已改判',takedown:'处置成立',no_action:'不予处置',restore:'恢复'};
const reasons={sexual:'色情低俗',violence:'暴力血腥',political:'政治敏感',illegal:'违法违规',copyright:'侵权抄袭',harassment:'骚扰辱骂',advertising:'广告引流',other:'其他'};
function pictures(value){if(!value||typeof value!=='object')return '';if(value.assetId&&/^https:\/\//.test(value.url||''))return `<img src="${esc(value.url)}" alt="举报对象配图" style="max-width:240px;max-height:300px;object-fit:contain">`;return Object.values(value).map(pictures).join('');}
export function createSafetyConsole({api,mutation,task,refresh}){
 const S={queue:'cases',status:'open',type:'',items:[],next:null,detail:null,appeal:null,reason:'',error:''};
 async function load(more=false){const page=await api(S.queue==='cases'?'evalListSafetyCases':'evalListSafetyAppeals',{},undefined,{status:S.status||undefined,subjectType:S.queue==='cases'?S.type||undefined:undefined,cursor:more?S.next:undefined});S.items=more?[...S.items,...page.items]:page.items;S.next=page.pageInfo.nextCursor;}
 function render(){const detail=S.detail;return `<section class="tile"><div class="tile-b console-form"><div class="row"><button class="btn" data-safety="cases">举报工单</button><button class="btn" data-safety="appeals">申诉队列</button></div><label>状态<select data-safety-filter="status">${(S.queue==='cases'?['open','closed','']:['pending','upheld','overturned','']).map(v=>`<option value="${v}" ${S.status===v?'selected':''}>${{open:'待处理',closed:'已关闭',pending:'待处理',upheld:'维持原判',overturned:'已改判','':'全部'}[v]}</option>`).join('')}</select></label>${S.queue==='cases'?`<label>对象类型<select data-safety-filter="type"><option value="">全部</option>${Object.entries(types).map(([v,label])=>`<option value="${v}" ${S.type===v?'selected':''}>${label}</option>`).join('')}</select></label>`:''}<button class="btn" data-safety="reload">刷新队列</button>${S.items.map(row=>`<button class="btn" style="display:block;width:100%;text-align:left;margin:8px 0" data-safety-open="${esc(row.caseId||row.appealId)}">${row.caseId?`${types[row.subjectType]} · ${row.reportCount} 条举报 · ${esc(row.openedAt)}<br>${row.categories.map(c=>`${reasons[c.category]} ${c.count}`).join(' / ')}`:`申诉 · ${esc(row.reason)} · ${esc(statuses[row.status]||row.status)}`}</button>`).join('')||'<p>暂无记录</p>'}${S.next?'<button class="btn" data-safety="more">加载更多</button>':''}</div></section>${detail?`<section class="tile"><div class="tile-h"><h2>${types[detail.subjectType]} · 工单详情</h2></div><div class="tile-b console-form"><h3>当前对象快照</h3>${pictures(detail.snapshot)}<pre>${esc(JSON.stringify(detail.snapshot,null,2))}</pre><h3>举报原因与说明</h3>${detail.reports.map(r=>`<p>${reasons[r.category]} · ${esc(r.description||'无补充说明')}${r.characterId?` · 人物 ${esc(r.characterId)}`:''}</p>`).join('')}<h3>历史判定</h3>${detail.decisions.map(d=>`<p>${esc(statuses[d.decision]||d.decision)} · ${esc(d.reason)} · ${esc(d.decidedAt)}</p>`).join('')||'<p>暂无</p>'}<h3>申诉</h3>${detail.appeals.map(a=>`<p>${esc(a.reason)} · ${esc(statuses[a.status]||a.status)}</p>`).join('')||'<p>暂无</p>'}${S.appeal?.status==='pending'||(!S.appeal&&detail.status==='open')?`<label>判定说明（必填）<textarea id="safety-reason" maxlength="500">${esc(S.reason)}</textarea></label><div class="row">${(S.appeal?['upheld','overturned']:['takedown','no_action']).map(value=>`<button class="btn" data-safety-decide="${value}">${{upheld:'维持原判',overturned:'改判并恢复',takedown:'举报成立并处置',no_action:'举报不成立'}[value]}</button>`).join('')}</div>`:''}</div></section>`:''}`;}
 document.addEventListener('input',e=>{if(e.target.id==='safety-reason')S.reason=e.target.value;});
 document.addEventListener('change',e=>{if(e.target.dataset.safetyFilter){S[e.target.dataset.safetyFilter]=e.target.value;task(()=>load());}});
 document.addEventListener('click',e=>{
  const el=e.target.closest('[data-safety],[data-safety-open],[data-safety-decide]');if(!el)return;
  task(async()=>{
   if(el.dataset.safety){const action=el.dataset.safety;if(['cases','appeals'].includes(action)){S.queue=action;S.status=action==='cases'?'open':'pending';S.detail=S.appeal=null;}await load(action==='more');}
   if(el.dataset.safetyOpen){if(S.queue==='cases'){S.detail=await api('evalGetSafetyCase',{caseId:el.dataset.safetyOpen});S.appeal=null;}else{const d=await api('evalGetSafetyAppeal',{appealId:el.dataset.safetyOpen});S.detail=d.case;S.appeal=d.appeal;}S.reason='';}
   if(el.dataset.safetyDecide){if(!S.reason.trim())throw Error('请填写判定说明');const result=el.dataset.safetyDecide;
    if(!window.confirm(result==='takedown'?'确认举报成立并执行处置？':result==='overturned'?'确认改判并恢复？':'确认提交此判定？'))return;
    const id=S.appeal?.appealId||S.detail.caseId;
    await mutation(`safety:${id}`,S.appeal?'evalResolveSafetyAppeal':'evalDecideSafetyCase',S.appeal?{appealId:id}:{caseId:id},S.appeal?{result,reason:S.reason}:{decision:result,reason:S.reason,expectedRevision:S.detail.revision});
    S.detail=S.appeal=null;S.reason='';await load();
   }
   refresh();
  });
 });
 return {render,load};
}
