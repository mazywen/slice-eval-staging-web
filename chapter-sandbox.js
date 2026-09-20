/* Isolated Chapter Lab job UI. All generation and judgments run on Shared Backend. */
(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copy=v=>JSON.parse(JSON.stringify(v));
  const arr=v=>Array.isArray(v)?v:[];
  const data={history:[],pending:null,snapshotText:'',historyText:'',days:3,repeats:3,selected:null};
  let restored=false;
  function restore(client){if(!restored){Object.assign(data,client.chapterLabStorage()||{});restored=true;}}
  function save(client){client.chapterLabStorage(data);}
  function reset(){Object.assign(data,{history:[],pending:null,snapshotText:'',historyText:'',days:3,repeats:3,selected:null});restored=false;}
  function capture(){
    const $=s=>root.document.querySelector(s);
    if($('#chapter-sandbox-input'))data.snapshotText=$('#chapter-sandbox-input').value;
    if($('#chapter-sandbox-history'))data.historyText=$('#chapter-sandbox-history').value;
    if($('#chapter-sandbox-days'))data.days=Number($('#chapter-sandbox-days').value);
    if($('#chapter-sandbox-ordinal'))data.ordinal=Number($('#chapter-sandbox-ordinal').value);
    if($('#chapter-sandbox-repeats'))data.repeats=Number($('#chapter-sandbox-repeats').value);
    data.facts=[...root.document.querySelectorAll('[data-chapter-fact]')].filter(n=>n.value).map(n=>({predicateCode:n.dataset.chapterFact,source:n.value}));
    data.batchScenarios=[...root.document.querySelectorAll('[name="chapterBatchScenario"]:checked')].map(n=>n.value);
    data.roleCount=Number($('#chapter-sandbox-roles')?.value||1);
  }
  function initialSnapshot(base){
    const r=base.result, input=r.input||{}, form=base.form||{};
    const line=root.SliceChapterLab.mainline(r);
    const characters=arr(input.characters);
    const player=characters.find(row=>row.characterVersionId===form.playerCharacterVersionId);
    const skills=arr(line?.selectedTalent?.skills).map(row=>({...row,actorId:form.playerCharacterVersionId}));
    let worldBase=null;try{worldBase=JSON.parse(arr(r.compiledPlans?.tracks).find(t=>t.trackCode==='current')?.planJson||'null');}catch{}
    return {world:{background:worldBase?.background||input.description,environment:worldBase?.environment||input.setting,goal:input.goal},
      player:{actorId:form.playerCharacterVersionId,displayName:player?.displayName||base.player?.player||'',
        identity:player?.description||player?.content?.bio||'',skills},
      activeCharacters:characters.filter(row=>row.characterVersionId!==form.playerCharacterVersionId).map(row=>({
        actorId:row.characterVersionId,displayName:row.displayName,bio:row.description||row.content?.bio||''})),
      relationships:[],currentSituation:r.previewRuns?.current?.opening?.currentSituation||'',
      planningHorizon:'current_chapter_and_current_day_only'};
  }
  function current(){return data.history.find(row=>row.jobId===data.selected)||data.history.at(-1)||null;}
  function flowSnapshot(){
    const r=current()?.result;if(!r)return null;
    const chapterResult=data.history.find(row=>row.jobId===r.state.activeChapter?.chapterRef)?.result||r;
    return {storySpine:r.snapshot.world,history:{hypotheticalHistory:r.input.history,acceptedExperimentalEvidence:r.state.evidence},
      player:{player:r.snapshot.player,characters:r.snapshot.activeCharacters,relationships:r.snapshot.relationships},
      chapter:r.state.activeChapter,conditions:r.state.activeChapter?.conditions||[],conditionState:r.state.conditionState,
      settlementPassed:r.settlement?.passed??null,dayCard:r.state.activeChapter?.dayCard,
      chapterPrompt:chapterResult.requestEvidence?.requestBody?.messages,chapterAiOutput:chapterResult.rawAiOutput?.parsedAiOutput||chapterResult.candidate,
      chapterCalls:r.modelCallCount?[{}]:[],cost:cost(r),isolated:true};
  }
  function cost(result){
    if(!result)return null;
    if(result.modelCallCount===0)return {display:'¥0（无模型调用）',value:0};
    const evidence=result.requestEvidence;
    const call={...result.usage,modelProvider:'deepseek',model:evidence?.requestBody?.model,
      startedAt:evidence?.capturedAt||result.completedAt,callRef:result.completedAt};
    return root.SliceProductWorkbench?.charge([call])||{display:'未采集'};
  }
  function detail(value){return '<pre>'+esc(JSON.stringify(value??null,null,2))+'</pre>';}
  function render(base,busy,{scenarios=[]}={}){
    const client=root.SliceEvalConsoleClient;restore(client);
    const selected=current(), result=selected?.result;
    const ready=Boolean(base?.result?.input&&base?.form?.playerCharacterVersionId), blocked=busy||Boolean(data.pending);
    const input=data.snapshotText||(base?JSON.stringify(initialSnapshot(base),null,2):'');
    const conditions=arr(result?.state?.activeChapter?.conditions);
    const price=cost(result);
    return '<section class="panel chapter-sandbox"><div class="section-heading"><h2>隔离实验：日程、证据与章末</h2><span class="badge">假设输入 · 不写真实 Run</span></div>'
      +'<p>选择剧本与人物即可独立编章；也可承接上方基线。可改身份、人物、能力和前情；本区的所有结果都是实验结果。日程继续使用本次实验已冻结的目标与条件。</p>'
      +'<div class="chapter-sandbox-grid"><div><label>生成第几章（假设位置，当前首测 1–5）<input id="chapter-sandbox-ordinal" type="number" min="1" max="5" value="'+esc(data.ordinal||1)+'"></label><label>每章天数（实验参数）<input id="chapter-sandbox-days" type="number" min="1" max="30" value="'+esc(data.days)+'"></label>'
      +'<label>假设前情 / 剧情改写<textarea id="chapter-sandbox-history" rows="4" maxlength="4000" placeholder="例如：负责人已经出示正式通知，今天要准备试演。">'+esc(data.historyText)+'</textarea></label>'
      +'<details><summary>编辑实验世界、人物、能力与关系（JSON）</summary><textarea id="chapter-sandbox-input" rows="14" spellcheck="false">'+esc(input)+'</textarea><p class="muted">从上方作品与已选能力复制。关系默认未指定；可在此明确设置假设值。人物 ID 只作本实验引用。</p></details>'
      +'<div class="inline-controls"><button class="button primary" data-chapter-sandbox="chapter"'+(!ready||blocked?' disabled':'')+'>生成隔离章节</button><button class="button" data-chapter-sandbox="reset-input"'+(blocked?' disabled':'')+'>重取当前基线输入</button></div>'
      +'<h3>假设证据来源</h3>'+conditions.filter(c=>c.kind==='fact').map(c=>'<label>'+esc(c.label)+'<select data-chapter-fact="'+esc(c.predicateCode)+'"><option value="">不增加证据</option><option value="verified">假设：核心来源已核实</option><option value="claim">测试：仅有人如此声称</option><option value="ambient">测试：只有路人说法</option></select></label>').join('')
      +'<div class="inline-controls">'+[['evidence','测试条件判定'],['day','生成下一日'],['settlement','模拟章末结算']].map(([id,label])=>'<button class="button" data-chapter-sandbox="'+id+'"'+(!result?.state||result.state.phase!=='playing'||blocked?' disabled':'')+'>'+label+'</button>').join('')+'</div>'
      +'<p class="muted">前情文字用于生成情境，不自动成为条件证据；请明确选择证据来源。数值测试修改上方 JSON 中能力或关系值。换日仅在隔离副本中假设今日行动额度已用完。</p>'
      +'<h3>批量生成测试</h3><label>每种输入重复次数（1–9）<input id="chapter-sandbox-repeats" type="number" min="1" max="9" value="'+esc(data.repeats)+'"></label>'
      +'<details><summary>跨剧本 × 身份矩阵（可选）</summary><div class="chapter-lab-checks">'+scenarios.map(s=>'<label class="chapter-lab-check"><input type="checkbox" name="chapterBatchScenario" value="'+esc(s.id)+'"'+(arr(data.batchScenarios).includes(s.id)?' checked':'')+'>'+esc(s.title)+'</label>').join('')+'</div><label>每部剧本按人物列表顺序取前几个可扮演身份<select id="chapter-sandbox-roles">'+[1,2,3].map(n=>'<option value="'+n+'"'+(n===(data.roleCount||1)?' selected':'')+'>'+n+'</option>').join('')+'</select></label></details>'
      +'<button class="button" data-chapter-sandbox="batch"'+(!ready||blocked?' disabled':'')+'>逐次运行并保留结果</button><p class="muted">未勾选剧本则重复当前输入；勾选后使用各剧本原始设定与所选身份，不套用当前 JSON 改写。每批最多 45 次章节调用，另有每部剧本的编译成本。刷新只恢复已提交任务，未提交项不自动继续。</p>'
      +(data.pending?'<p class="notice">原任务已保留。继续只观察同一任务；接收未知时复用原幂等键。</p><button class="button" data-chapter-sandbox="resume"'+(busy?' disabled':'')+'>继续读取原实验</button>':'')
      +'</div><div><h3>实验结果</h3>'+(!selected?'<p>尚未生成隔离章节。</p>':'<p><strong>'+esc({chapter:'章节生成',day:'日程生成',evidence:'条件判定',settlement:'章末结算'}[result?.mode]||selected.mode)+' · '+esc(selected.status)+'</strong></p>'
      +(selected.errorCode?'<p class="notice error">'+esc(selected.errorCode)+'</p><details><summary>失败实验的原输入</summary>'+detail(selected.requestedInput)+'</details>':'')
      +(result?'<p>耗时 '+esc((result.durationMs/1000).toFixed(2))+' 秒 · '+esc(price?.display||'费用未采集')+'</p>'
      +'<p>章节：'+esc(result.state?.activeChapter?.title||'已结束')+' · 第 '+esc(result.state?.day)+' 天</p>'
      +(result.settlement?'<p class="chapter-settlement">模拟章末：<strong>'+ (result.settlement.passed?'PASS':'FAIL')+'</strong></p>':'')
      +detail({objective:result.state?.activeChapter?.narrativeObjective,dayCard:result.state?.activeChapter?.dayCard,conditions:result.conditionChanges})
      +[['本步输入',result.input],['实际 Provider 请求',result.requestEvidence],['模型原始输出',result.rawAiOutput],['校验后候选',result.candidate],['后端实验结果',result.state],['Token 用量',result.usage]].map(([label,v])=>'<details><summary>'+label+'</summary>'+detail(v)+'</details>').join('')
      +'<p class="muted">请求证据：'+esc(result.evidenceStatus)+'。费用为用量估算；未采集字段不视作零。</p>':'') )+'</div></div>'
      +'<h3>实验历史与对比</h3><div class="chapter-sandbox-history">'+data.history.map(row=>'<button class="button" data-chapter-sandbox-history="'+esc(row.jobId)+'">'+esc(row.title||'实验')+' · '+esc(row.mode)+' · '+esc(row.status)+'</button>').join('')+'</div>'
      +(result?'<button class="button" data-chapter-sandbox="pin">将当前结果设为对比基线</button>':'')+comparison(selected)
      +summary(data.history)+'<button class="button" data-chapter-sandbox="export">导出全部实验 JSON</button></section>';
  }
  function comparison(selected){
    const base=data.history.find(row=>row.jobId===data.compareId);
    if(!base?.result||!selected?.result||base.jobId===selected.jobId)return '<p class="muted">选一条历史设为基线，再选另一条查看逐字段差异。</p>';
    const pick=r=>({world:r.snapshot.world,player:r.snapshot.player,characters:r.snapshot.activeCharacters,
      history:r.input.history,objective:r.state.activeChapter?.narrativeObjective,conditions:r.state.activeChapter?.conditions,
      day:r.state.activeChapter?.dayCard});
    const a=pick(base.result),b=pick(selected.result);
    return '<div class="chapter-lab-compare"><table class="chapter-lab-diff"><thead><tr><th>字段</th><th>实验基线</th><th>当前结果</th></tr></thead><tbody>'+Object.keys(a).map(k=>'<tr class="'+(JSON.stringify(a[k])===JSON.stringify(b[k])?'same':'changed')+'"><td>'+esc(k)+'</td><td>'+detail(a[k])+'</td><td>'+detail(b[k])+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function summary(rows){
    const results=rows.filter(r=>r.result).map(r=>r.result), chapterResults=results.filter(r=>r.mode==='chapter');
    if(!results.length)return '';
    const times=chapterResults.map(r=>r.durationMs).sort((a,b)=>a-b);
    const percentile=p=>times.length?Math.round(times[Math.ceil(times.length*p)-1])+'ms':'未采集';
    const conditions=chapterResults.flatMap(r=>arr(r.state.activeChapter?.conditions));
    const days=results.filter(r=>r.mode==='day');
    const repeated=days.filter(r=>JSON.stringify(r.before?.activeChapter?.dayCard)===JSON.stringify(r.state?.activeChapter?.dayCard)).length;
    const prices=chapterResults.map(cost).filter(c=>typeof c?.value==='number'&&Number.isFinite(c.value));
    const average=prices.length?'¥'+(prices.reduce((n,c)=>n+c.value,0)/prices.length).toFixed(6):'未采集';
    return '<p>已采集 '+results.length+' 次成功结果，失败 '+rows.filter(r=>r.status==='dead_letter'||r.status==='cancelled').length+' 次；成功章节 P50 '+percentile(.5)+' / P95 '+percentile(.95)+'；平均条件数 '+(chapterResults.length?(conditions.length/chapterResults.length).toFixed(1):'未采集')+'；事实 / 数值 '+conditions.filter(c=>c.kind==='fact').length+' / '+conditions.filter(c=>c.kind==='numeric').length+'；日程全文重复 '+repeated+' / '+days.length+'。已计价章节平均 '+average+'（'+prices.length+'/'+chapterResults.length+'）。</p><p class="muted">编译费用在原操作诊断中查看。失败调用费用未返回时不计为零；语义可达性、剧透和路线质量需逐条审核，未自动评分。</p>';
  }
  async function observe(client,onProgress){
    const pending=data.pending;if(!pending)return;
    let row;
    if(!pending.jobId){row=await client.createChapterExperiment(pending.experimentId,pending.body,pending.key);pending.jobId=row.jobId;save(client);}
    const started=Date.now();
    while(true){
      row=await client.getChapterExperiment(pending.experimentId,pending.jobId);
      if(['succeeded','dead_letter','cancelled'].includes(row.status))break;
      onProgress?.({message:'章节隔离实验后台处理中，正在读取原任务…'});
      if(Date.now()-started>150000)throw Error('观察等待超时；原任务已保留，请继续读取，不要重新生成。');
      await new Promise(resolve=>setTimeout(resolve,1500));
    }
    data.history.push({...row,mode:pending.body.mode,title:pending.title,experimentId:pending.experimentId,requestedInput:pending.body});
    data.selected=row.jobId;data.pending=null;save(client);
    if(row.status!=='succeeded')throw Error(row.errorCode||'章节实验失败，记录已保留。');
    return row;
  }
  async function run(action,{client,base,onProgress,scenarios=[]}){
    restore(client);
    if(action==='resume')return observe(client,onProgress);
    if(action==='reset-input'){data.snapshotText='';save(client);return;}
    if(action==='pin'){data.compareId=current()?.jobId;save(client);return;}
    if(action==='export'){
      const url=URL.createObjectURL(new Blob([JSON.stringify(data.history,null,2)],{type:'application/json'}));
      const a=root.document.createElement('a');a.href=url;a.download='slice-chapter-lab.json';a.click();URL.revokeObjectURL(url);return;
    }
    if(data.pending)throw Error('请先读取原实验任务。');
    if(action==='batch'&&arr(data.batchScenarios).length){
      const count=data.repeats, roles=data.roleCount||1;
      if(!Number.isInteger(count)||count<1||count>9||![1,2,3].includes(roles)||data.batchScenarios.length*roles*count>45)throw Error('批量矩阵最多 45 次；请减少剧本、身份或重复次数。');
      for(const id of data.batchScenarios){
        const source=scenarios.find(row=>row.id===id);if(!source)throw Error('批量剧本已不在当前工作区，请重新选择。');
        const draft=await client.getScenario(source);
        const people=arr(draft.characters).filter(row=>row.playable!==false).slice(0,roles);
        if(!people.length)throw Error('剧本「'+draft.title+'」没有可扮演人物。');
        let result=await client.saveDraft(root.SliceChapterLab.experimentInput(draft,{extraCharacterVersionIds:[]},draft.characters,false),onProgress);
        result=await client.compile(result,onProgress);
        for(const person of people){
          const roleBase={title:draft.title,result,form:{playerCharacterVersionId:person.characterVersionId}};
          for(let i=0;i<count;i++){
            const body={mode:'chapter',snapshot:{...initialSnapshot(roleBase),chapterOrdinal:data.ordinal||1},history:'',daysPerChapter:data.days,facts:[]};
            data.pending={experimentId:result.experiment.experimentId,body,key:'chapter-lab-'+crypto.randomUUID(),jobId:null,title:draft.title+' / '+person.displayName};save(client);
            await observe(client,onProgress);
          }
        }
      }
      return;
    }
    const previous=current();
    if((action==='chapter'||action==='batch')&&!base?.form?.playerCharacterVersionId)throw Error('请先选择剧本与玩家身份。');
    const snapshot=JSON.parse(data.snapshotText||JSON.stringify(initialSnapshot(base)));
    const unedited=base&&JSON.stringify(snapshot)===JSON.stringify(initialSnapshot(base));
    if((action==='chapter'||action==='batch')&&!base.result.experiment?.experimentId){
      const isolated=root.SliceChapterLab.experimentInput(base.result.input,base.form,base.result.input.characters,false);
      let result=await client.saveDraft(isolated,onProgress);result=await client.compile(result,onProgress);
      base={...base,result};
      if(unedited)snapshot.world=initialSnapshot(base).world;
    }
    if(action==='chapter'||action==='batch')snapshot.chapterOrdinal=data.ordinal||1;
    const facts=data.facts||[];
    const count=action==='batch'?data.repeats:1;
    if(!Number.isInteger(count)||count<1||count>9)throw Error('重复次数须为 1–9。');
    for(let i=0;i<count;i++){
      const mode=action==='batch'?'chapter':action;
      const body={mode,snapshot,history:data.historyText,daysPerChapter:data.days,facts};
      if(mode!=='chapter')body.state=copy(previous?.result?.state);
      data.pending={experimentId:mode==='chapter'?base.result.experiment.experimentId:previous.experimentId,body,key:'chapter-lab-'+crypto.randomUUID(),jobId:null,title:base?.title||previous?.title};save(client);
      await observe(client,onProgress);
    }
  }
  root.SliceChapterSandbox={render,run,capture,reset,data,initialSnapshot,summary,flowSnapshot};
})(typeof window==='undefined'?globalThis:window);
