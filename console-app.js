/* Slice staging console. UI calls only the shared console client. */
(() => {
  'use strict';
  const C=window.SliceEvalConsoleClient, V=window.SliceEvalConsoleView;
  const $=(selector,root=document)=>root.querySelector(selector);
  const e=V.esc, A=V.arr, I=V.items;
  const state={
    page:'scripts',playTab:'feed',scenarios:[],characters:[],selectedScenarioId:'',
    draft:null,result:null,busy:false,message:'',error:null,search:'',
    selectedStepId:null,diagnosticTab:'overview',drawer:false,compose:null,composeBody:'',
    selectedChannelId:'',selectedPlayerCharacterVersionId:'',selectedFirstFollowerCharacterVersionId:'',activityEditing:null,
    characterSlots:[],slotCandidates:[],selectedSlotId:'',pollTimer:null,
  };
  const pageNames={scripts:'剧本与创作',play:'交互运行',records:'操作与诊断',guide:'流程总览'};
  const diagnosticTabs={overview:'概览',input:'输入',context:'上下文',decisions:'调度与判定',model:'模型',applied:'实际应用',cost:'耗时与费用',raw:'原始证据'};
  const blankDraft=()=>({title:'',description:'',setting:'',goal:'',characterVersionIds:[],characters:[],topicTags:[],activityDefinitions:[],removedActivityDefinitionIds:[]});
  const pendingRelease=()=>!!state.result?.release && !['published','blocked','failed'].includes(state.result.release.status);
  const needsPolling=()=>!!state.result?.pendingCommand && state.result.pendingCommand.status!=='admission_unknown' || pendingRelease() && state.result.release.status!=='admission_unknown';
  const locked=()=>state.busy || !!state.result?.pendingCommand || state.result?.runtimePhase==='waiting_for_backend' || pendingRelease();
  const playerActorId=()=>A(V.projections(state.result).run?.value?.actorStates || V.preview(state.result).actorStates).find(row=>row.kind==='player')?.actorId;
  const visibleNpcs=()=>V.cast(state.result).filter(row=>row.actorId && row.actorId!==playerActorId() && row.kind!=='player');
  const canAct=()=>!!V.preview(state.result).runId && !locked() && state.result?.runtimePhase==='waiting_for_user';
  const disable=(condition)=>condition?' disabled':'';
  const workspaceSteps=()=>A(C.listWorkspaceOperations?.()).map(operation=>({id:'workspace-'+operation.consoleOperationId,title:operation.label || '创建人物',kind:'workspace',status:operation.status,operations:operation.operations,error:operation.error,input:operation.operations?.[0]?.input,output:operation.operations?.at(-1)?.output}));
  const consoleSteps=()=>[...workspaceSteps(),...V.steps(state.result)];
  const selectedStep=()=>consoleSteps().find((s)=>s.id===state.selectedStepId) || consoleSteps().at(-1);
  const time=(v)=>v?new Date(v).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'时间未采集';
  function showError(error) {
    state.error=error?.message || String(error);
    $('#global-error').textContent=state.error;
    $('#global-error').hidden=false;
  }
  function toast(message) {
    const node=$('#toast');node.textContent=message;node.hidden=false;
    window.setTimeout(()=>{node.hidden=true;},3500);
  }
  function syncHeader() {
    $('#page-title').textContent=pageNames[state.page];
    document.querySelectorAll('[data-page]').forEach((node)=>{node.classList.toggle('active',node.dataset.page===state.page);node.setAttribute('aria-current',node.dataset.page===state.page?'page':'false');});
    const connected=C.connected();
    $('#connection-state').classList.toggle('connected',connected);
    $('#connection-state').innerHTML='<i></i>'+(connected?'已连接':'未连接');
    $('#login-button').textContent=connected?'退出工作区':'登录工作区';
    $('#login-button').disabled=state.busy;
    $('#refresh-button').disabled=!connected || state.busy;
    $('#global-status').hidden=!state.message;
    $('#global-status').textContent=state.message;
    $('#global-error').hidden=!state.error;
    $('#global-error').textContent=state.error || '';
    const result=state.result,run=V.preview(result);
    $('#sidebar-session').innerHTML=result?'<strong>'+e(result.input?.title || '当前剧本')+'</strong><small>'+e(V.label(result.runtimePhase))+'</small>'+(run.runId?'<div class="mono">'+e(run.runId.slice(0,18))+'…</div>':''):'<p class="muted">尚未开始游玩</p>';
    $('#footer-context').textContent=result?.storageWarning || (run.runId?'当前会话 '+run.runId:'选择剧本，完成一次操作，观察实际过程。');
  }
  function pageHeading(title,description,actions='') {
    return '<div class="page-heading"><div><span class="eyebrow">SLICE / '+e(state.page.toUpperCase())+'</span><h1>'+e(title)+'</h1><p>'+e(description)+'</p></div><div class="page-actions">'+actions+'</div></div>';
  }
  function loginEmpty() {
    return '<section class="panel login-empty">'+V.empty('连接你的测试工作区','在同一条真实业务链路里创建剧本、选择人物、亲自操作，并观察每一步的处理结果。').replace('</div>','<button class="button primary" type="button" data-open-login>登录工作区</button></div>')+'</section>';
  }
  function render() {
    V.clearLazyEvidence();
    syncHeader();
    let html='';
    if(state.page==='guide')html=renderGuide();
    else if(!C.connected())html=pageHeading(pageNames[state.page],'完整连接 Slice 测试环境，按你的输入逐步运行。')+loginEmpty();
    else if(state.page==='scripts')html=renderScripts();
    else if(state.page==='play')html=renderPlay();
    else html=renderRecords();
    $('#console-main').innerHTML=html;
    if(state.drawer)renderDrawer();
    else $('#diagnostics').hidden=true;
  }
  function characterOptions() {
    const selected=new Set(state.draft?.characterVersionIds || []);
    const map=new Map([...state.characters,...A(state.draft?.characters)].filter(x=>x?.characterVersionId).map(row=>[row.characterVersionId,row]));
    const rows=[...map.values()].sort((a,b)=>Number(selected.has(b.characterVersionId))-Number(selected.has(a.characterVersionId)));
    if(!rows.length)return '<p class="muted">当前没有可用人物。可以先创建人物，或保存零人物的测试剧本。</p>';
    return '<div class="characters-grid">'+rows.map(row=>'<label class="character-option">'+V.avatar(row.displayName)+'<span><strong>'+e(row.displayName || '未回传姓名')+'</strong><small>'+e(row.description || row.identity || row.characterVersionId)+'</small></span><input type="checkbox" name="characterVersionIds" value="'+e(row.characterVersionId)+'"'+(selected.has(row.characterVersionId)?' checked':'')+disable(state.busy || (!selected.has(row.characterVersionId)&&selected.size>=8))+' aria-label="选择 '+e(row.displayName)+'" /></label>').join('')+'</div>';
  }
  function presetActivities() {
    const rows=A(state.draft?.activityDefinitions),characters=A(state.draft?.characters);
    const field=(index,key,label,value,multiline=false)=>'<label>'+label+(multiline?'<textarea data-preset-index="'+index+'" data-preset-field="'+key+'" rows="3" maxlength="'+(key==='playerSafeTeaser'?400:key==='purpose'?1000:4000)+'"'+disable(state.busy)+'>'+e(value)+'</textarea>':'<input data-preset-index="'+index+'" data-preset-field="'+key+'" value="'+e(value)+'" maxlength="'+(key==='when'?240:160)+'"'+disable(state.busy)+' />')+'</label>';
    const structuredFields=(row,index)=>'<details class="raw-details preset-rules"><summary>触发条件、特殊规则与结果空间</summary><p class="muted">这些是本次剧本的创作定义。已有内容按原定义保留；只在保存并重新编译后生效。填写结构化 JSON，后端按正式合同校验。</p>'+[
      ['trigger','触发条件','object'],['specialRules','特殊规则','array'],['outcomeSpace','结果空间','object'],
    ].map(([key,label,shape])=>'<label>'+label+'<textarea data-preset-index="'+index+'" data-preset-field="'+key+'" data-preset-json="'+shape+'" rows="5" spellcheck="false" placeholder="留空使用正式默认定义"'+disable(state.busy)+'>'+e(typeof row[key]==='string'?row[key]:row[key]?JSON.stringify(row[key],null,2):'')+'</textarea></label>').join('')+'</details>';
    return '<div class="form-section"><div class="section-heading"><h3>预制活动 <small>'+rows.length+' 个</small></h3><button id="add-preset-activity" class="text-button" type="button"'+disable(state.busy || rows.length>=8)+'>＋ 添加预制活动</button></div><p class="muted">设定剧本中的活动场景与参与人物，保存后成为编译输入。</p>'+rows.map((row,index)=>'<details class="preset-activity" open><summary>'+e(row.title || '预制活动 '+(index+1))+'</summary><div class="form-grid" style="margin-top:12px">'+field(index,'title','活动标题',row.title)+field(index,'locationLabel','地点',row.locationLabel)+field(index,'when','时间（可选）',row.when)+'<div class="full">'+field(index,'purpose','活动目的（可选）',row.purpose,true)+'</div><div class="full">'+field(index,'sceneDescription','场景描述',row.sceneDescription,true)+'</div><div class="full">'+field(index,'playerSafeTeaser','玩家可见介绍（可选）',row.playerSafeTeaser,true)+'</div>'+[['requiredParticipantActorRefs','必选人物'],['optionalParticipantActorRefs','可选人物']].map(([key,label])=>'<label>'+label+'<select data-preset-index="'+index+'" data-preset-field="'+key+'" multiple size="3"'+disable(state.busy)+'><option value="player"'+(A(row[key]).includes('player')?' selected':'')+'>当前玩家</option>'+characters.map(character=>'<option value="'+e('character:'+character.characterVersionId)+'"'+(A(row[key]).includes('character:'+character.characterVersionId)?' selected':'')+'>'+e(character.displayName || character.characterVersionId)+'</option>').join('')+'</select></label>').join('')+'</div>'+structuredFields(row,index)+'<button class="text-button" type="button" data-remove-preset="'+index+'"'+disable(state.busy)+'>移除这个预制活动</button></details>').join('')+'</div>';
  }
  function draftEditor() {
    if(!state.draft)return V.empty('选择一个剧本开始','从左侧读取已有剧本，或新建一个文本剧本。');
    const d=state.draft,compiled=state.result?.compiledPlans && state.result?.input?.title===d.title;
    return '<div class="section-heading"><h2>'+e(d.title || '新建剧本')+'</h2>'+V.badge(state.result?.status || 'draft')+'</div><form id="draft-form"><div class="form-grid">'+
      '<label class="full">剧本名称<input name="title" maxlength="160" value="'+e(d.title)+'" required'+disable(state.busy)+' /></label>'+
      '<label class="full">世界简介<textarea name="description" rows="3" maxlength="4000" required'+disable(state.busy)+'>'+e(d.description)+'</textarea></label>'+
      '<label class="full">世界观与背景<textarea name="setting" rows="5" maxlength="4000" required'+disable(state.busy)+'>'+e(d.setting)+'</textarea></label>'+
      '<label class="full">世界目标<textarea name="goal" rows="2" maxlength="160" required'+disable(state.busy)+'>'+e(d.goal)+'</textarea></label>'+
      '</div><div class="form-section"><div class="section-heading"><h3>剧本人物 <small id="character-count">'+A(d.characterVersionIds).length+' / 8</small></h3><button id="create-character" type="button" class="text-button"'+disable(state.busy)+'>＋ 创建人物</button></div>'+characterOptions()+'</div>'+
      presetActivities()+
      '<div class="form-actions"><span class="muted">封面与头像使用默认占位</span><button id="save-draft" class="button" type="submit"'+disable(state.busy)+'>保存测试草稿</button><button id="compile-draft" class="button primary" type="button"'+disable(state.busy)+'>编译剧本</button></div></form>'+
      (compiled?'<div class="form-section"><div class="section-heading"><h3>编译结果已返回</h3><button class="text-button" type="button" data-inspect-step="compile">查看完整编译结果 →</button></div><p class="notice">'+e(C.capabilities().compilerNotice || '编译费用以实际调用为准。')+'</p><div class="inline-controls"><button class="button primary" data-page="play" type="button">选择人物并开始</button>'+(typeof C.publish==='function'?'<button id="publish-draft" class="button" type="button"'+disable(locked())+'>发布到测试环境</button>':'')+'</div>'+(typeof C.publish==='function'?'<p class="muted" style="margin-top:10px">正式发布会额外执行 Creator 编译。当前评测接口未提供这次发布编译的用量与费用，暂不计入上方实验合计。</p>':'')+'</div>':'');
  }
  function renderScripts() {
    const rows=state.scenarios.filter(s=>!state.search || (s.title+' '+s.description).toLowerCase().includes(state.search.toLowerCase()));
    return pageHeading('从剧本开始，看到每一步','读取真实剧本、编辑文本和人物，再查看完整编译结果。','<button id="new-draft" class="button primary" type="button"'+disable(locked())+'>＋ 新建剧本</button>')+
      '<div class="split-layout"><section class="panel"><div class="section-heading"><h3>测试剧本</h3><small>'+state.scenarios.length+' 个已读取</small></div><div class="scenario-toolbar"><input id="scenario-search" type="search" placeholder="搜索剧本名称或简介" value="'+e(state.search)+'" aria-label="搜索剧本" /></div><label class="muted">快速选择<select id="scenario-select"'+disable(locked())+'><option value="">选择剧本</option>'+state.scenarios.map(row=>'<option value="'+e(row.id)+'"'+(row.id===state.selectedScenarioId?' selected':'')+'>'+e(row.title)+'</option>').join('')+'</select></label><div class="scenario-list">'+
      (rows.length?rows.map(row=>'<button type="button" class="scenario-row'+(row.id===state.selectedScenarioId?' active':'')+'" data-scenario-id="'+e(row.id)+'"'+disable(locked())+'>'+V.avatar(row.title,true)+'<span><strong>'+e(row.title)+'</strong><small>'+e(row.updatedAt?time(row.updatedAt):row.status?V.label(row.status):'测试环境剧本')+'</small></span><span class="chevron">›</span></button>').join(''):V.empty('没有找到剧本','新建文本剧本，或刷新重新读取。'))+'</div></section><section class="panel" id="draft-editor">'+draftEditor()+'</section></div>';
  }
  function renderSetup() {
    const r=state.result;
    if(!r?.compiledPlans)return '<section class="panel">'+V.empty('先完成剧本编译','保存剧本并编译后，在这里选择你要扮演的人物。')+'<div class="inline-controls"><button class="button primary" data-page="scripts" type="button">前往剧本与创作</button></div></section>';
    const selection=V.startSelection(r.input,state.selectedPlayerCharacterVersionId,state.selectedFirstFollowerCharacterVersionId);
    const characters=selection.players,followers=selection.followers,pendingStart=!!r.pendingStart;
    return '<section class="panel"><div class="section-heading"><h2>'+e(r.input?.title)+'</h2>'+V.badge(r.status)+'</div><p class="muted">编译已完成。请选择你要扮演的人物，以及首位互动人物，开始当前剧本的一次游玩。</p><div class="form-section"><div class="inline-controls"><label>我扮演谁<select id="player-character"'+disable(locked() || pendingStart)+'><option value="">'+'请选择玩家身份'+'</option><option value="__default_player__"'+(state.selectedPlayerCharacterVersionId==='__default_player__'?' selected':'')+'>使用默认玩家身份</option>'+characters.map(row=>'<option value="'+e(row.characterVersionId)+'"'+(state.selectedPlayerCharacterVersionId===row.characterVersionId?' selected':'')+'>'+e(row.displayName || row.characterVersionId)+'</option>').join('')+'</select></label><label>首位互动人物<select id="first-follower-character"'+disable(locked() || pendingStart || !followers.length || (selection.requiresPlayer&&!selection.playerChoiceMade))+'><option value="">'+(followers.length?'请选择首位互动人物':'当前剧本没有其他可互动人物')+'</option>'+followers.map(row=>'<option value="'+e(row.characterVersionId)+'"'+(state.selectedFirstFollowerCharacterVersionId===row.characterVersionId?' selected':'')+'>'+e(row.displayName || row.characterVersionId)+'</option>').join('')+'</select></label><button id="start-run" class="button primary" type="button"'+disable(locked() || (!pendingStart&&!selection.ready))+'>'+(pendingStart?'继续确认上次开局':'开始游玩')+'</button></div>'+(pendingStart?'<p class="notice" style="margin-top:12px">上次开局的接收状态尚未确认，继续时保留原人物选择和同一请求。</p>':selection.missingInteractionCharacter?'<p class="notice" style="margin-top:12px">所选人物成为玩家后，剧本中没有其他可互动人物。可以选择默认玩家身份，与该人物互动；也可以再绑定一名人物并重新编译。</p>':'')+'</div><div class="form-section"><button class="text-button" type="button" data-inspect-step="compile">查看编译输入与完整结果 →</button><p class="notice" style="margin-top:12px">'+e(C.capabilities().compilerNotice || '')+'</p></div></section>';
  }
  function stepButtons(limit) {
    let steps=consoleSteps();
    if(limit)steps=steps.slice(-limit).reverse();
    return steps.map(step=>'<button class="step-button'+(selectedStep()?.id===step.id?' active':'')+'" type="button" data-inspect-step="'+e(step.id)+'"><span class="step-dot"></span><span><strong>'+e(step.index?String(step.index).padStart(2,'0')+' · '+step.title:step.title)+'</strong><small>'+e(step.action || V.label(step.status))+'</small></span>'+V.badge(step.status)+'</button>').join('') || '<p class="muted">尚无操作记录</p>';
  }
  function openingBody() {
    const p=V.projections(state.result),run=V.preview(state.result),opening=p.run?.status==='succeeded'?p.run.value?.opening:run.opening;
    return [opening?.firstPostDraft,opening?.playerPost?.body,opening?.playerPost?.text,opening?.post?.body,opening?.post?.text,opening?.draft?.body,opening?.draft?.text,opening?.body,opening?.text,opening?.openingHook].find(value=>typeof value==='string'&&value.trim()) || null;
  }
  function renderPlay() {
    const result=state.result,run=V.preview(result),p=V.projections(result);
    const heading=pageHeading('亲自操作，观察系统回应','后台自然完成本次处理后，等待你的下一次输入。');
    if(!run.runId)return heading+renderSetup();
    const opening=result.runtimePhase==='opening_waiting_for_user';
    return heading+'<div class="context-bar">'+V.avatar(result.input?.title,true)+'<div><h2>'+e(result.input?.title)+'</h2><span class="mono">'+e(run.runId)+'</span></div>'+V.badge(result.runtimePhase)+'<button class="button" id="add-cast-button" type="button"'+disable(!canAct())+'>添加人物</button><button class="button" id="inspect-latest" type="button">查看本次过程</button></div>'+
      (opening?'<section class="panel" style="margin-bottom:20px"><div class="section-heading"><h3>确认开场</h3>'+V.badge('waiting_for_user')+'</div><p class="muted">开局已经建立。确认后提交开场帖子，随后查看世界动态与处理过程。</p>'+V.section('将要发布的开场帖子',openingBody())+(openingBody()?'':'<p class="notice">开场正文尚未读取，请刷新后再确认。</p>')+'<button id="confirm-opening" class="button primary" type="button"'+disable(locked() || !openingBody())+'>确认开场</button></section>':'')+
      '<div class="play-layout"><section class="panel play-content"><div id="play-tabs" class="tabs" role="tablist">'+Object.entries({feed:'世界动态',dm:'私聊',events:'事件',activities:'活动',cast:'人物',chapter:'章节'}).map(([key,label])=>'<button type="button" role="tab" aria-selected="'+(state.playTab===key)+'" class="'+(state.playTab===key?'active':'')+'" data-play-tab="'+key+'">'+label+'</button>').join('')+'</div>'+renderSurface()+'</section><aside class="session-aside"><section class="panel"><div class="section-heading"><h3>会话消耗</h3><small>已采集部分</small></div>'+V.usageHtml(V.usage(V.allCalls(result)))+'<p class="muted">汇总实验编译、当前游玩与邀请的已采集调用。缺失记录不等于零；尚未计量的发布编译不计入此小计。</p></section><section class="panel"><div class="section-heading"><h3>最近操作</h3><button class="text-button" type="button" data-page="records">全部</button></div><div class="step-list">'+stepButtons(5)+'</div></section></aside></div>';
  }
  function composeForm(defaultType='post',target={}) {
    const selected=state.compose || {type:defaultType,...target};
    const type=selected.type,title=V.label(type);
    return '<form id="action-form" class="compose" data-action-type="'+e(type)+'"><div class="compose-header"><strong>'+e(title)+(selected.label?' · '+e(selected.label):'')+'</strong>'+(state.compose?'<button class="text-button" type="button" id="cancel-compose">取消</button>':'')+'</div><textarea id="action-body" rows="3" maxlength="4000" placeholder="'+(type==='post'?'以当前人物的身份发一条动态…':'输入这次真实发送的内容…')+'" aria-label="'+e(title)+'正文" required'+disable(!canAct())+'>'+e(state.composeBody)+'</textarea><div class="compose-actions"><small>'+(!canAct()?'完成开场或等待后台返回后可继续输入。':'发送后，后台按实际产品流程执行。')+'</small><button id="action-submit" class="button primary" type="submit"'+disable(!canAct())+'>'+e(title)+'</button></div></form>';
  }
  function renderFeed(p) {
    const posts=I(p.feed),replyThreads=I(p.replies);
    return composeForm()+V.projectionNotice(p.feed,'动态')+(posts.length?posts.map(post=>{
      const name=post.author?.displayName || V.actorName(state.result,post.author?.actorId || post.actorId);
      const replies=I(replyThreads.find(row=>row.postId===post.postId)?.value);
      return '<article class="message-card"><div class="message-head">'+V.avatar(name)+'<span><strong>'+e(name)+'</strong><small>'+e(time(post.createdAt))+'</small></span></div><p class="message-body">'+e(post.body || post.text || post.content?.body || '')+'</p><div class="message-actions"><button class="text-button" type="button" data-comment-post="'+e(post.postId)+'"'+disable(!canAct())+'>评论'+(post.replyCount!==undefined?' · '+e(post.replyCount):'')+'</button><button class="text-button" type="button" data-inspect-content="'+e(post.commandId || post.sourceCommandId || '')+'">查看关联过程</button></div>'+
        (replies.length?'<div class="reply-list">'+replies.map(reply=>'<div class="reply-item"><strong>'+e(reply.author?.displayName || V.actorName(state.result,reply.author?.actorId))+'</strong><p>'+e(reply.body || reply.text || '')+'</p><button class="text-button" type="button" data-reply-post="'+e(post.postId)+'" data-reply-id="'+e(reply.replyId)+'"'+disable(!canAct())+'>回复</button></div>').join('')+'</div>':'')+'</article>';
    }).join(''):V.empty('暂无已读取的动态','确认开场或发送帖子后，观察生成内容与实际写入结果。'))+V.projectionNotice(p.replies,'评论');
  }
  function renderDm(p) {
    const channels=I(p.dmChannels),cast=V.cast(state.result),threads=I(p.dmThreads);
    const selected=channels.find(row=>row.channelId===state.selectedChannelId);
    const messages=I(threads.find(row=>row.channelId===state.selectedChannelId)?.value);
    const channelName=(row)=>row.title || row.displayName || A(row.participantActorIds).map(id=>V.actorName(state.result,id)).join('、') || row.channelId;
    const target=state.compose?.type==='dm_message'?state.compose:{type:'dm_message',channelId:selected?.channelId};
    return '<div class="select-row"><select id="dm-channel-select" aria-label="选择私聊会话"><option value="">选择已有私聊会话</option>'+channels.map(row=>'<option value="'+e(row.channelId)+'"'+(state.selectedChannelId===row.channelId?' selected':'')+'>'+e(channelName(row))+'</option>').join('')+'</select><select id="dm-person-select" aria-label="选择私聊人物"'+disable(!canAct())+'><option value="">或选择人物发起私聊</option>'+cast.filter(row=>row.actorId && row.actorId!==playerActorId() && row.kind!=='player').map(row=>'<option value="'+e(row.actorId)+'"'+(state.compose?.targetActorId===row.actorId?' selected':'')+'>'+e(row.displayName || V.actorName(state.result,row.actorId))+'</option>').join('')+'</select></div>'+
      (target.channelId || target.targetActorId?composeForm('dm_message',target):'<p class="notice">先选择一个私聊会话或当前可见人物。</p>')+V.projectionNotice(p.dmChannels,'私聊会话')+
      (messages.length?messages.map(row=>'<article class="message-card"><div class="message-head">'+V.avatar(row.sender?.displayName || V.actorName(state.result,row.senderActorId))+'<span><strong>'+e(row.sender?.displayName || V.actorName(state.result,row.senderActorId))+'</strong><small>'+e(time(row.createdAt))+'</small></span></div><p class="message-body">'+e(row.body || row.text || '')+'</p></article>').join(''):V.empty('尚无已读取的消息',selected?'发送私聊后，在这里查看实际回复。':'选择会话查看消息记录。'))+V.projectionNotice(p.dmThreads,'私聊消息');
  }
  function renderEvents(p) {
    const events=I(p.events),canRespond=row=>['active','available'].includes(row.state || row.status) && (A(row.choices).length>0 || row.freeInputAllowed===true);
    const empty=p.events?.status==='succeeded'&&!events.some(canRespond)?V.empty('当前没有可回应事件','事件是否生成、何时触发，可在每次操作的调度与判定中检查。'):'';
    return (state.compose?.type==='event_action'?composeForm('event_action'): '')+V.projectionNotice(p.events,'事件')+empty+
      events.map(row=>'<article class="entity-card"><div class="section-heading"><h3>'+e(row.title || '事件')+'</h3>'+V.badge(row.status || row.state)+'</div><p>'+e(row.description || row.setup || row.body || '')+'</p><div class="choice-list">'+A(row.choices).map(choice=>'<button class="button" type="button" data-event-choice="'+e(choice.choiceId || choice.id || '')+'" data-event-id="'+e(row.eventId)+'"'+disable(!canAct() || !canRespond(row))+'>'+e(choice.label || choice.text || choice)+'</button>').join('')+'</div>'+(row.freeInputAllowed?'<button class="text-button" type="button" data-event-input="'+e(row.eventId)+'"'+disable(!canAct() || !canRespond(row))+'>输入我的回应</button>':'')+V.raw('事件详情与状态',row)+'</article>').join('');
  }
  function activityForm() {
    const value=state.activityEditing?.payload || {};
    return '<form id="activity-form" class="activity-form"><div class="section-heading"><h3>'+ (state.activityEditing?.activityAttemptId?'修改活动':'发起活动')+'</h3><button id="cancel-activity" type="button" class="text-button">取消</button></div>'+[['title','活动标题'],['when','时间'],['location','地点']].map(([key,label])=>'<label>'+label+'<input name="'+key+'" value="'+e(value[key])+'" required maxlength="'+(key==='title'?160:240)+'" /></label>').join('')+'<label>场景描述<textarea name="sceneDescription" rows="3" required maxlength="4000">'+e(value.sceneDescription)+'</textarea></label><label>活动目的<textarea name="purpose" rows="2" required maxlength="1000">'+e(value.purpose)+'</textarea></label><label>邀请人物<select name="invitedActorIds" multiple size="3">'+visibleNpcs().map(row=>'<option value="'+e(row.actorId)+'"'+(A(value.invitedActorIds).includes(row.actorId)?' selected':'')+'>'+e(row.displayName || V.actorName(state.result,row.actorId))+'</option>').join('')+'</select><small>可多选，提交后由后端决定邀请结果。</small></label><div class="form-actions"><button class="button primary" type="submit"'+disable(!canAct())+'>提交活动</button></div></form>';
  }
  function canAnswerInvitation(row) {
    return A(row.invitationStates).some(invitation=>invitation.actorId===playerActorId() && invitation.controllerType==='human' && invitation.status==='PENDING');
  }
  function renderActivities(p) {
    const attempts=I(p.activityAttempts),instances=I(p.activityInstances),candidates=I(p.activityCandidates);
    return '<div class="section-heading"><h3>活动与邀请</h3><button id="create-activity" class="button small" type="button"'+disable(!canAct())+'>＋ 发起活动</button></div>'+
      (state.activityEditing?activityForm():'')+(state.compose?.type==='activity_turn'?composeForm('activity_turn'):'')+
      V.projectionNotice(p.activityAttempts,'活动邀请')+
      attempts.map(row=>'<article class="entity-card"><div class="section-heading"><h3>'+e(row.title || row.setup?.title || row.payload?.title || '活动邀请')+'</h3>'+V.badge(row.status || row.state)+'</div><p>'+e(row.setup?.sceneDescription || row.payload?.sceneDescription || row.sceneDescription || '')+'</p>'+(row.status==='pending_invites'?'<p class="notice">活动已保存，后台正在处理邀请；如有需要你回应的邀请，请手动选择。邀请确认后才能进入活动。</p>':row.status==='invitation_failed'?'<p class="notice warning">邀请处理失败：'+e(row.invitationResolutionError || '后台未返回错误码')+'。活动记录已保留，可查看本次操作的诊断信息。</p>':'')+'<div class="message-actions"><button class="button small" type="button" data-activity-enter="'+e(row.activityAttemptId)+'"'+disable(!canAct() || row.status!=='ready')+'>进入活动</button><button class="button small" type="button" data-activity-edit="'+e(row.activityAttemptId)+'"'+disable(!canAct() || !['inviting','ready','pending_invites','invitation_failed'].includes(row.status) || row.creatorActorId!==playerActorId())+'>修改</button>'+(canAnswerInvitation(row)?[['ACCEPTED','接受邀请'],['REJECTED','拒绝邀请'],['IGNORED','忽略邀请']]:[]).map(([response,label])=>'<button class="text-button" type="button" data-activity-response="'+response+'" data-attempt-id="'+e(row.activityAttemptId)+'"'+disable(!canAct())+'>'+label+'</button>').join('')+'</div>'+V.raw('活动邀请详情',row)+'</article>').join('')+
      V.projectionNotice(p.activityInstances,'进行中的活动')+instances.map(row=>'<article class="entity-card"><div class="section-heading"><h3>'+e(row.currentScene?.title || row.title || row.setup?.title || '活动')+'</h3>'+V.badge(row.status==='opening'?'waiting_for_backend':row.status)+'</div>'+(row.status==='opening'?'<p class="notice">活动实例已创建，后台正在生成开场。完成后再输入你的行动；刷新会继续读取同一个活动。</p>':row.status==='failed'?'<p class="notice warning">'+(row.openingResolutionError?'活动开场失败：'+e(row.openingResolutionError)+'。':'活动处理失败，失败原因未采集。')+'原活动记录已保留，可查看操作诊断。</p>':'')+'<p>'+e(row.currentScene?.sceneDescription || row.sceneDescription || '')+'</p><small class="muted">回合 '+e(row.currentTurn ?? row.turnCount ?? '未回传')+'</small><div class="message-actions"><button class="button small primary" type="button" data-activity-turn="'+e(row.activityId)+'"'+disable(!canAct() || row.status!=='active')+'>输入活动行动</button><button class="button small" type="button" data-activity-exit="'+e(row.activityId)+'"'+disable(!canAct() || row.status!=='active')+'>退出活动</button></div>'+V.raw('活动运行详情',row)+'</article>').join('')+
      (!attempts.length&&!instances.length?V.empty('尚无已读取的活动','你可以发起活动，或查看系统生成的活动候选与触发条件。'):'')+
      V.section('活动候选与解锁条件',p.activityCandidates?.status==='succeeded'?candidates:null)+V.section('活动历史',p.activityHistory?.status==='succeeded'?I(p.activityHistory):null);
  }
  function renderSurface() {
    const p=V.projections(state.result);
    if(state.playTab==='feed')return renderFeed(p);
    if(state.playTab==='dm')return renderDm(p);
    if(state.playTab==='events')return renderEvents(p);
    if(state.playTab==='activities')return renderActivities(p);
    if(state.playTab==='cast')return V.projectionNotice(p.cast,'人物')+(V.cast(state.result).map(row=>'<article class="message-card"><div class="message-head">'+V.avatar(row.displayName)+'<span><strong>'+e(row.displayName || V.actorName(state.result,row.actorId))+'</strong><small>'+e(row.role || row.kind || '')+'</small></span></div>'+V.renderValue(row)+'</article>').join('') || V.empty('尚未读取人物'))+V.section('人物关系',p.relationships?.status==='succeeded'?I(p.relationships):null);
    const last=V.steps(state.result).filter(row=>row.kind==='runtime').at(-1),outcome=last?.outcome || {},chapter=p.chapter?.status==='succeeded'?p.chapter.value:null;
    return '<p class="notice">章节按后台规则推进与总结。这里显示当前章节、完成依据与实际结算结果。</p>'+V.projectionNotice(p.chapter,'章节')+V.section('当前章节',chapter)+V.section('章节总结与结算',V.chapterSettlementValue(p.chapter))+V.section('章节调度依据',outcome.chapterDirective || outcome.gameplayEvidence?.chapter?.directive)+V.section('总体进度',p.progression?.status==='succeeded'?p.progression.value:null)+V.section('里程碑',p.milestones?.status==='succeeded'?I(p.milestones):null)+V.section('游玩历史',p.history?.status==='succeeded'?I(p.history):null);
  }
  function tabsHtml() {
    return '<div id="diagnostic-tabs" class="tabs" role="tablist">'+Object.entries(diagnosticTabs).map(([key,text])=>'<button type="button" data-diagnostic-tab="'+key+'" role="tab" aria-selected="'+(state.diagnosticTab===key)+'" class="'+(state.diagnosticTab===key?'active':'')+'">'+text+'</button>').join('')+'</div>';
  }
  function renderRecords() {
    if(!state.result && !workspaceSteps().length)return pageHeading('操作与诊断','从一次输入追踪到最终产品结果。')+'<section class="panel">'+V.empty('还没有执行记录','创建或选择剧本后，保存、编译与每次游玩操作都会在此关联。')+'</section>';
    const step=selectedStep();
    return pageHeading('操作与诊断','选择一次操作，检查输入、上下文、调度、模型与最终结果。','<button id="export-evidence" type="button" class="button">导出本次证据</button>')+
      '<section class="panel record-list"><aside><div class="section-heading"><h3>'+e(state.result?.input?.title || '工作区操作')+'</h3><small>'+consoleSteps().length+' 条</small></div>'+stepButtons()+'</aside><div class="record-inspector"><h2>'+e(step?.title || '操作诊断')+'</h2>'+tabsHtml()+'<div id="diagnostic-content">'+V.diagnostic(state.result,step,state.diagnosticTab)+'</div></div></section>';
  }
  function renderDrawer() {
    const step=selectedStep(),node=$('#diagnostics');
    node.hidden=false;
    node.innerHTML='<div class="diagnostics-header"><div><span><small>本次操作的真实证据</small><h2>'+e(step?.title || '操作诊断')+'</h2></span><button class="icon-button" id="close-diagnostics" type="button" aria-label="关闭诊断">×</button></div>'+tabsHtml()+'</div><div class="diagnostics-body" id="diagnostic-content">'+V.diagnostic(state.result,step,state.diagnosticTab)+'</div>';
  }
  function renderGuide() {
    const definitions=[
      ['01','创作与编译','编辑世界设定、人物与预制活动。保存剧本后执行真实编译，查看系统如何转成可运行的世界。'],
      ['02','选角与开场','编译完成后由你选择扮演人物并开始。开局建立后，等待你确认开场内容。'],
      ['03','交互与观察','你自己发帖、评论、私聊、回应事件或进入活动。后台正常处理，并留下可以查看的过程证据。'],
    ];
    const stages=[['输入与当前状态','提交的正文、目标人物与业务对象，以及本轮开始时的世界和人物状态。'],['记忆与上下文','召回查询、共享记忆、人物私有视角，以及实际进入 Runtime 的上下文。'],['调度与规则判定','本轮选择谁参与、在哪个位置回应、事件活动与章节如何触发。'],['模型与校验','模型调用记录、Runtime 组装上下文、模型候选与经过工程绑定的结果。'],['应用与返回','内容、关系、技能、经验、事件、活动和章节实际写入了什么，接口读取返回了什么。']];
    return pageHeading('看懂从创作到游玩的流程','以下是业务流程说明；实际执行和跳过原因以每次操作的诊断记录为准。')+
      '<div class="guide-grid">'+definitions.map(([n,title,text])=>'<section class="guide-step"><span class="eyebrow">STEP '+n+'</span><h3>'+title+'</h3><p>'+text+'</p></section>').join('')+'</div>'+
      '<section class="panel" style="margin-top:22px"><div class="section-heading"><h2>一次用户操作，可以观察什么</h2><span class="badge">流程定义</span></div><div class="flow-list">'+stages.map(([title,text],i)=>'<div><span class="flow-number">'+String(i+1).padStart(2,'0')+'</span><span><strong>'+title+'</strong><p>'+text+'</p></span></div>').join('')+'</div><p class="notice" style="margin-top:20px">所有耗时、Token 和账本费用来自后端实际记录。缺少的证据显示未采集；不会用推测填补执行过程。</p></section>';
  }
  function captureDraft() {
    const form=$('#draft-form');
    if(!form || !state.draft)return;
    const data=new FormData(form);
    for(const key of ['title','description','setting','goal'])state.draft[key]=String(data.get(key) || '');
    const previousIds=A(state.draft.characterVersionIds), selectedIds=data.getAll('characterVersionIds');
    const selectedSet=new Set(selectedIds), previousSet=new Set(previousIds);
    state.draft.characterVersionIds=[...previousIds.filter(id=>selectedSet.has(id)),...selectedIds.filter(id=>!previousSet.has(id))];
    const all=[...A(state.draft.characters),...state.characters];
    state.draft.characters=state.draft.characterVersionIds.map(id=>all.find(row=>row.characterVersionId===id) || {characterVersionId:id});
  }
  function progress(event) {
    if(event.partialResult){state.result=event.partialResult;C.saveSession(state.result);}
    if(event.message)state.message=event.message;
    if(event.kind==='checkpoint' && state.page==='play')render();
    else syncHeader();
  }
  async function task(message,fn,{renderEnd=true}={}) {
    if(state.busy)return null;
    state.busy=true;state.error=null;state.message=message;render();
    try {
      const result=await fn(progress);
      if(result?.schemaVersion && result.input){state.result=result;C.saveSession(result);}
      return result;
    } catch(error) {
      if(error.partialResult){state.result=error.partialResult;C.saveSession(state.result);}
      showError(error);return null;
    } finally {
      state.busy=false;state.message=(state.result?.pendingCommand?.status==='admission_unknown' || state.result?.release?.status==='admission_unknown')?'接收状态未知，原操作记录已保留。刷新只读取后台证据，不会重新提交。':needsPolling()?'本次操作已提交，后台仍在处理。正在持续读取同一任务。':'';
      if(renderEnd)render();else syncHeader();
      schedulePoll();
    }
  }
  function schedulePoll() {
    window.clearTimeout(state.pollTimer);
    if(!C.connected() || !needsPolling())return;
    state.pollTimer=window.setTimeout(async()=>{
      if(state.busy){schedulePoll();return;}
      await task('正在读取本次后台处理状态…',(onProgress)=>C.refresh(state.result,onProgress));
    },3000);
  }
  async function loadWorkspace() {
    const result=await Promise.allSettled([C.listScenarios(),C.listCharacters()]);
    if(result[0].status==='fulfilled')state.scenarios=A(result[0].value);
    else showError(result[0].reason);
    if(result[1].status==='fulfilled')state.characters=A(result[1].value);
    else showError(result[1].reason);
    if(!state.result) {
      const restored=C.restore();
      if(restored){state.result=restored;state.draft={...restored.input};state.selectedPlayerCharacterVersionId=restored.input?.playerCharacterVersionId || (restored.pendingStart?'__default_player__':'');state.selectedFirstFollowerCharacterVersionId=restored.input?.firstFollowerCharacterVersionId || '';}
    }
    render();schedulePoll();
    if(state.result?.evidenceNeedsRefresh && !state.busy)await task('重新读取已保存的会话证据…',onProgress=>C.refresh(state.result,onProgress));
  }
  async function selectScenario(id) {
    if(!id || locked())return;
    captureDraft();
    const row=state.scenarios.find(x=>x.id===id);
    if(!row)return;
    const selected=await task('正在读取剧本与可用人物…',async()=>{
      const full=typeof C.getScenario==='function'?await C.getScenario(row):row;
      state.selectedScenarioId=id;state.draft={...full};state.result=null;
      state.selectedPlayerCharacterVersionId='';state.selectedFirstFollowerCharacterVersionId='';state.compose=null;state.composeBody='';
      state.characters=await C.listCharacters({worldDraftId:full.worldDraftId || full.id});
      return full;
    });
    if(selected)render();
  }
  async function saveOrCompile(compile) {
    if(locked()){toast('当前后台任务仍在处理，请等待返回后继续。');return;}
    const form=$('#draft-form');
    if(!form?.reportValidity())return;
    captureDraft();
    const input={...state.draft,characters:A(state.draft.characters),characterVersionIds:A(state.draft.characterVersionIds)};
    const previous=state.result;
    const same=previous?.scenario?.worldDraftRevisionId && !V.preview(previous).runId &&
      ['title','description','setting','goal'].every(k=>String(previous.input?.[k] || '')===String(input[k] || '')) &&
      JSON.stringify(previous.input?.characterVersionIds || [])===JSON.stringify(input.characterVersionIds) &&
      JSON.stringify(previous.input?.activityDefinitions || [])===JSON.stringify(input.activityDefinitions || []) && !A(input.removedActivityDefinitionIds).length;
    const result=await task(compile?'正在保存输入并编译剧本…':'正在保存剧本…',async(onProgress)=>{
      const saved=compile&&same?previous:await C.saveDraft(input,onProgress);
      state.result=saved;
      return compile?C.compile(saved,onProgress):saved;
    });
    if(result){state.draft={...result.input};toast(compile?'编译结果已返回，可选择人物开始游玩。':'测试草稿已保存。');render();}
  }
  async function perform(action) {
    if(locked() || (!canAct() && action.type!=='confirm_opening_post'))return;
    if(action.type==='confirm_opening_post' && (!openingBody() || state.result?.runtimePhase!=='opening_waiting_for_user'))return;
    const previousBody=state.composeBody;
    const result=await task('正在提交'+V.label(action.type)+'…',onProgress=>C.act(state.result,action,onProgress));
    if(result){state.compose=null;state.composeBody='';state.activityEditing=null;state.selectedStepId=V.steps(result).at(-1)?.id;render();}
    else {state.composeBody=previousBody;render();}
  }
  function inspect(id) {
    state.selectedStepId=id || consoleSteps().at(-1)?.id;
    state.diagnosticTab='overview';
    if(state.page==='records'){state.drawer=false;render();}
    else {state.drawer=true;renderDrawer();}
  }
  function activateCompose(value) {
    state.compose=value;state.composeBody='';render();
    $('#action-body')?.focus();
    $('#action-form')?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function openCastDialog() {
    if(!canAct())return;
    const dialog=$('#add-cast-dialog');$('#add-cast-error').hidden=true;
    $('#add-cast-options').innerHTML='<p class="muted">读取可选择的人物位置…</p>';dialog.showModal();
    try {
      if(typeof C.listRunCharacterSlots!=='function')throw new Error('当前接口未提供可选择的人物位置。');
      state.characterSlots=I(await C.listRunCharacterSlots(state.result));
      const pending=state.characterSlots.filter(row=>row.state==='pending_selection');
      $('#add-cast-options').innerHTML=pending.length?'<label>选择人物位置<select id="cast-slot-select" name="slotId" required><option value="">请选择</option>'+pending.map(row=>'<option value="'+e(row.slotId)+'">'+e(row.title || row.label || row.slotId)+'</option>').join('')+'</select></label><div id="cast-candidate-options"></div>':V.empty('当前没有已解锁人物位','后续人物的开放时机由当前剧本与实际运行状态决定。');
      $('#add-cast-form button[type=submit]').disabled=!pending.length;
    }catch(error){$('#add-cast-error').textContent=error.message;$('#add-cast-error').hidden=false;$('#add-cast-options').innerHTML='';}
  }
  document.addEventListener('click',async(event)=>{
    const button=event.target.closest('button');if(!button || button.disabled)return;
    if(button.dataset.removePreset!==undefined){captureDraft();const index=Number(button.dataset.removePreset),row=state.draft.activityDefinitions[index];if(row?.activityDefinitionId){state.draft.removedActivityDefinitionIds ||= [];state.draft.removedActivityDefinitionIds.push(row.activityDefinitionId);}state.draft.activityDefinitions.splice(index,1);render();return;}
    if(button.dataset.closeDialog!==undefined){button.closest('dialog')?.close();return;}
    if(button.dataset.openLogin!==undefined){$('#auth-dialog').showModal();return;}
    if(button.dataset.page){captureDraft();state.page=button.dataset.page;state.drawer=false;render();return;}
    if(button.dataset.scenarioId){await selectScenario(button.dataset.scenarioId);return;}
    if(button.dataset.playTab){state.playTab=button.dataset.playTab;state.compose=null;state.composeBody='';render();return;}
    if(button.dataset.inspectStep){inspect(button.dataset.inspectStep);return;}
    if(button.dataset.diagnosticTab){state.diagnosticTab=button.dataset.diagnosticTab;state.drawer?renderDrawer():render();return;}
    if(button.dataset.commentPost){activateCompose({type:'comment',postId:button.dataset.commentPost,label:'选中的帖子'});return;}
    if(button.dataset.replyPost){activateCompose({type:'reply',postId:button.dataset.replyPost,parentReplyId:button.dataset.replyId,label:'选中的评论'});return;}
    if(button.dataset.inspectContent!==undefined) {
      const step=V.steps(state.result).find(row=>row.commandId && row.commandId===button.dataset.inspectContent);
      if(step)inspect(step.id);else toast('这条内容未回传关联命令，无法确定其生成步骤。');
      return;
    }
    if(button.dataset.eventInput){activateCompose({type:'event_action',eventId:button.dataset.eventInput,label:'事件回应'});return;}
    if(button.dataset.eventChoice){await perform({type:'event_action',eventId:button.dataset.eventId,choiceId:button.dataset.eventChoice});return;}
    if(button.dataset.activityEnter){await perform({type:'activity_enter',activityAttemptId:button.dataset.activityEnter});return;}
    if(button.dataset.activityResponse){await perform({type:'activity_invite_response',activityAttemptId:button.dataset.attemptId,response:button.dataset.activityResponse});return;}
    if(button.dataset.activityTurn){activateCompose({type:'activity_turn',activityId:button.dataset.activityTurn,label:'当前活动'});return;}
    if(button.dataset.activityExit){await perform({type:'activity_exit',activityId:button.dataset.activityExit});return;}
    if(button.dataset.activityEdit) {
      const row=I(V.projections(state.result).activityAttempts).find(x=>x.activityAttemptId===button.dataset.activityEdit);
      state.activityEditing={activityAttemptId:button.dataset.activityEdit,payload:row?.payload || row?.setup || row || {}};render();return;
    }
    if(button.dataset.restoreSession) {
      if(locked())return;
      const restored=C.restoreSession(button.dataset.restoreSession);
      if(!restored){toast('会话记录已不可用。');return;}
      state.result=restored;state.draft={...restored.input};state.page='play';state.selectedPlayerCharacterVersionId=restored.input?.playerCharacterVersionId || (restored.pendingStart?'__default_player__':'');state.selectedFirstFollowerCharacterVersionId=restored.input?.firstFollowerCharacterVersionId || '';
      $('#sessions-dialog').close();await task('重新读取会话状态…',onProgress=>C.refresh(restored,onProgress));return;
    }
    switch(button.id) {
      case 'login-button':
        if(C.connected()){C.disconnect();window.clearTimeout(state.pollTimer);state.result=null;state.draft=null;state.scenarios=[];state.characters=[];state.error=null;state.message='';render();}
        else $('#auth-dialog').showModal();break;
      case 'new-draft':captureDraft();state.draft=blankDraft();state.selectedScenarioId='';state.result=null;state.selectedPlayerCharacterVersionId='';state.selectedFirstFollowerCharacterVersionId='';state.error=null;render();break;
      case 'compile-draft':await saveOrCompile(true);break;
      case 'add-preset-activity':captureDraft();state.draft.activityDefinitions ||= [];state.draft.activityDefinitions.push({title:'',locationLabel:'',sceneDescription:'',playerSafeTeaser:'',requiredParticipantActorRefs:['player'],optionalParticipantActorRefs:[]});render();break;
      case 'create-character':captureDraft();$('#character-error').hidden=true;$('#character-dialog').showModal();break;
      case 'start-run': {
        const selection=V.startSelection(state.result?.input,state.selectedPlayerCharacterVersionId,state.selectedFirstFollowerCharacterVersionId);
        if(!state.result?.pendingStart && !selection.ready){toast('请明确选择扮演人物和首位互动人物。');break;}
        const startIds=state.result?.pendingStart?.body || {playerCharacterVersionId:selection.playerId,firstFollowerCharacterVersionId:selection.followerId};
        await task('正在创建所选人物的游玩会话…',onProgress=>C.start(state.result,{playerCharacterVersionId:startIds.playerCharacterVersionId || null,firstFollowerCharacterVersionId:startIds.firstFollowerCharacterVersionId || null},onProgress));break;
      }
      case 'confirm-opening':await perform({type:'confirm_opening_post',body:openingBody()});break;
      case 'refresh-button':
        captureDraft();
        if(state.result?.experiment || V.preview(state.result).runId)await task('正在读取最新后台状态…',onProgress=>C.refresh(state.result,onProgress));
        else await task('正在读取测试工作区…',async()=>{await loadWorkspace();});
        break;
      case 'publish-draft':if(typeof C.publish==='function')await task('正在执行正式编译与测试发布…',onProgress=>C.publish(state.result,onProgress));break;
      case 'inspect-latest':inspect();break;
      case 'close-diagnostics':state.drawer=false;$('#diagnostics').hidden=true;break;
      case 'cancel-compose':state.compose=null;state.composeBody='';render();break;
      case 'create-activity':state.activityEditing={payload:{}};render();break;
      case 'cancel-activity':state.activityEditing=null;render();break;
      case 'add-cast-button':await openCastDialog();break;
      case 'session-history':
        $('#sessions-list').innerHTML=A(C.listSessions()).map(row=>'<div class="session-row"><span><strong>'+e(row.title)+'</strong><small>'+e(time(row.updatedAt))+' · '+e(V.label(row.phase))+'</small></span><button type="button" class="button small" data-restore-session="'+e(row.id)+'"'+disable(locked())+'>恢复会话</button></div>').join('') || V.empty('暂无保存的会话');
        $('#sessions-dialog').showModal();break;
      case 'export-evidence': {
        if(!state.result)return;
        const blob=new Blob([JSON.stringify(state.result,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download='slice-eval-'+(state.result.consoleSessionId || Date.now())+'.json';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);break;
      }
    }
  });
  document.addEventListener('toggle',(event)=>{V.hydrateEvidence(event.target);},true);
  document.addEventListener('input',(event)=>{
    if(event.target.dataset.presetField){const row=state.draft?.activityDefinitions?.[Number(event.target.dataset.presetIndex)];if(row)row[event.target.dataset.presetField]=event.target.multiple?Array.from(event.target.selectedOptions).map(option=>option.value):event.target.value;}
    if(event.target.id==='scenario-search') {
      state.search=event.target.value;captureDraft();
      const start=event.target.selectionStart;render();$('#scenario-search').focus();$('#scenario-search').setSelectionRange(start,start);return;
    }
    if(event.target.closest('#draft-form'))captureDraft();
    if(event.target.id==='action-body')state.composeBody=event.target.value;
  });
  document.addEventListener('change',async(event)=>{
    if(event.target.dataset.presetField){const row=state.draft?.activityDefinitions?.[Number(event.target.dataset.presetIndex)];if(row)row[event.target.dataset.presetField]=event.target.multiple?Array.from(event.target.selectedOptions).map(option=>option.value):event.target.value;}
    if(event.target.id==='scenario-select'){await selectScenario(event.target.value);return;}
    if(event.target.id==='player-character'){
      state.selectedPlayerCharacterVersionId=event.target.value;
      const selection=V.startSelection(state.result?.input,state.selectedPlayerCharacterVersionId,state.selectedFirstFollowerCharacterVersionId);
      state.selectedFirstFollowerCharacterVersionId=selection.followerId || '';render();return;
    }
    if(event.target.id==='first-follower-character'){
      state.selectedFirstFollowerCharacterVersionId=event.target.value;
      $('#start-run').disabled=locked() || !V.startSelection(state.result?.input,state.selectedPlayerCharacterVersionId,state.selectedFirstFollowerCharacterVersionId).ready;return;
    }
    if(event.target.name==='characterVersionIds') {
      captureDraft();
      $('#character-count').textContent=A(state.draft.characterVersionIds).length+' / 8';
      document.querySelectorAll('[name=characterVersionIds]').forEach(node=>{node.disabled=state.busy || (!node.checked&&state.draft.characterVersionIds.length>=8);});return;
    }
    if(event.target.id==='dm-channel-select'){state.selectedChannelId=event.target.value;state.compose=event.target.value?{type:'dm_message',channelId:event.target.value}:null;state.composeBody='';render();return;}
    if(event.target.id==='dm-person-select'){state.selectedChannelId='';state.compose=event.target.value?{type:'dm_message',targetActorId:event.target.value,label:V.actorName(state.result,event.target.value)}:null;state.composeBody='';render();return;}
    if(event.target.id==='cast-slot-select') {
      state.selectedSlotId=event.target.value;
      $('#cast-candidate-options').innerHTML='<p class="muted">正在读取可选人物…</p>';
      try {
        state.slotCandidates=I(await C.listRunCharacterCandidates(state.result,state.selectedSlotId));
        $('#cast-candidate-options').innerHTML=state.slotCandidates.length?state.slotCandidates.map(row=>'<label class="character-option">'+V.avatar(row.displayName)+'<span><strong>'+e(row.displayName || row.name || row.characterVersionId)+'</strong><small>'+e(row.description || row.bio || '')+'</small></span><input type="radio" name="characterVersionId" value="'+e(row.characterVersionId)+'" required /></label>').join(''):'<p class="muted">当前没有可选择的人物。</p>';
      }catch(error){$('#cast-candidate-options').innerHTML='<p class="notice error">'+e(error.message)+'</p>';}
    }
  });
  document.addEventListener('submit',async(event)=>{
    const form=event.target;
    if(!['auth-form','draft-form','character-form','action-form','activity-form','add-cast-form'].includes(form.id))return;
    event.preventDefault();
    if(form.id==='auth-form') {
      if(state.busy)return;
      const submit=$('#auth-submit');submit.disabled=true;$('#auth-error').hidden=true;
      try {await C.connect({username:$('#auth-username').value.trim(),password:$('#auth-password').value});$('#auth-password').value='';$('#auth-dialog').close();state.error=null;await loadWorkspace();}
      catch(error){$('#auth-error').textContent=error.message;$('#auth-error').hidden=false;}
      finally{submit.disabled=false;render();}return;
    }
    if(form.id==='draft-form'){await saveOrCompile(false);return;}
    if(form.id==='character-form') {
      const submit=$('button[type=submit]',form);submit.disabled=true;$('#character-error').hidden=true;
      try {
        const row=await C.createCharacter(Object.fromEntries(new FormData(form)));
        state.characters.push(row);
        if(state.draft && A(state.draft.characterVersionIds).length<8){state.draft.characterVersionIds.push(row.characterVersionId);state.draft.characters.push(row);}
        form.reset();$('#character-dialog').close();toast('人物已保存。');render();
      }catch(error){$('#character-error').textContent=error.message;$('#character-error').hidden=false;}
      finally{submit.disabled=false;}return;
    }
    if(form.id==='action-form') {
      const body=$('#action-body').value.trim();
      const action={...(state.compose || {type:form.dataset.actionType}),body};
      if(action.type==='dm_message'&&!action.channelId&&!action.targetActorId)action.channelId=state.selectedChannelId;
      delete action.label;await perform(action);return;
    }
    if(form.id==='activity-form') {
      const data=new FormData(form);
      const payload=Object.fromEntries(['title','when','location','sceneDescription','purpose'].map(key=>[key,String(data.get(key)||'').trim()]));
      payload.invitedActorIds=data.getAll('invitedActorIds');
      if(state.activityEditing)state.activityEditing.payload=payload;
      await perform({type:state.activityEditing?.activityAttemptId?'activity_update':'activity_create',...(state.activityEditing?.activityAttemptId?{activityAttemptId:state.activityEditing.activityAttemptId}:{}),payload});return;
    }
    if(form.id==='add-cast-form') {
      const data=new FormData(form);$('#add-cast-error').hidden=true;
      const slotId=String(data.get('slotId') || ''),characterVersionId=String(data.get('characterVersionId') || '');
      if(!slotId || !characterVersionId){$('#add-cast-error').textContent='请选择人物位置与人物。';$('#add-cast-error').hidden=false;return;}
      $('#add-cast-dialog').close();await perform({type:'select_character_slot',slotId,characterVersionId});
    }
  });
  document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&state.drawer){state.drawer=false;$('#diagnostics').hidden=true;}});
  window.SliceEvalConsole=Object.freeze({
    getState:()=>Object.freeze({page:state.page,connected:C.connected(),busy:state.busy,phase:state.result?.runtimePhase || null,
      selectedScenarioId:state.selectedScenarioId,runId:V.preview(state.result).runId || null,hasResult:!!state.result,
      currentOperationStatus:state.result?.status || null,characterOptionCount:A(state.draft?.characters).length,
      selectedPlayerCharacterVersionId:state.selectedPlayerCharacterVersionId,playerCharacterVersionId:state.result?.input?.playerCharacterVersionId || null,
      selectedFirstFollowerCharacterVersionId:state.selectedFirstFollowerCharacterVersionId,firstFollowerCharacterVersionId:state.result?.input?.firstFollowerCharacterVersionId || null,defaultPlayerSelected:state.selectedPlayerCharacterVersionId==='__default_player__',
      currentRevision:state.result?.scenario?.worldDraftRevisionId || null,operationCount:A(state.result?.operations).length,turnCount:A(state.result?.turns).length}),
  });
  render();
  if(C.connected())loadWorkspace().catch(showError);
})();
