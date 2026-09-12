/* Read-only console presentation. All observations come from backend evidence. */
(function (root) {
  'use strict';
  const arr = (value) => Array.isArray(value) ? value : [];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parse = (value) => { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return value; } };
  const items = (value) => arr(value?.items || value?.value?.items || (Array.isArray(value) ? value : []));
  const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const duration = (value) => number(value) === null ? '未采集' : value < 1000 ? value + ' ms' : (value / 1000).toFixed(1) + ' s';
  const labels = Object.freeze({
    draft_saved:'草稿已保存', compiling:'编译中', compiled:'编译完成', compiled_waiting_for_user:'编译完成，等待选角',
    waiting_for_user:'等待你的操作', waiting_with_issues:'存在待诊断问题', waiting_for_backend:'后台处理中',
    waiting_for_opening:'等待确认开场', starting_runtime:'准备开局', running:'处理中', processing:'处理中',
    succeeded:'已完成', applied:'已应用', accepted:'已接收', pending:'待处理', queued:'排队中',
    failed:'执行失败', rejected:'已拒绝', available:'可查看', skipped:'已跳过', cancelled:'已取消',
    completed:'已完成', active:'进行中', exited:'已退出', interrupted:'已中断', draft:'草稿',
    post:'发帖', comment:'评论帖子', reply:'回复评论', dm_message:'发送私聊', event_action:'回应事件',
    confirm_opening_post:'确认开场', activity_create:'发起活动', activity_update:'修改活动',
    activity_enter:'进入活动', activity_turn:'活动内行动', activity_exit:'退出活动',
    activity_invite_response:'回应活动邀请', add_cast:'添加人物', select_character_slot:'选择加入人物', opening_waiting_for_user:'等待确认开场',
    description:'简介', setting:'世界观', goal:'世界目标', title:'标题', content:'内容',
    worldCore:'世界设定', experienceSpine:'体验主线', agencyGraph:'人物与关系', narrativeSeeds:'剧情种子',
    runtimePolicy:'运行规则', gameConfig:'游戏配置', opening:'开场', planJson:'完整编译结果',
    directorDecision:'调度决策', narrativeSummary:'结果摘要', memoryEvidence:'记忆召回证据',
    attemptInterpretation:'用户意图判定', desiredOutcome:'期望结果', selfAction:'用户行为',
    claimedNpcStates:'关于其他人物的主张', claimedWorldChanges:'关于世界变化的主张',
    reasonCode:'原因', strategy:'策略', selectedItemCount:'选中记忆数', candidateCount:'候选数量',
    sharedContext:'共享上下文', privatePovHints:'人物独立视角', responderActorIds:'参与回应的人物',
    engineering:'工程决策', costClass:'成本级别', contextManifest:'上下文组成',
    vectorRetrievalActive:'向量召回', graphRetrievalActive:'关系图召回',
    providerInput:'提供方输入证据', modelInput:'Runtime 组装上下文', providerSafeInput:'安全输入证据',
    authorityBoundProposal:'工程绑定后的结果', requestEvidence:'实际模型请求', requestEvidenceStatus:'请求采集状态',
    candidate:'模型原始候选', modelCandidate:'模型原始候选', proposal:'校验后的结果',
    runtimeProposal:'校验后的结果', boundProposal:'绑定后的结果', finalizer:'结果应用',
    narrativeEffects:'剧情影响', gameplayEvidence:'实际应用证据', chapterState:'章节状态',
    chapterSettlement:'章节结算', chapterDirective:'章节调度', narrativeProjection:'剧情进度',
    surfaces:'已生成内容', relationshipChanges:'关系变化', statChanges:'属性变化',
    skillChanges:'技能变化', growth:'经验变化', events:'事件', activities:'活动',
    sourceRef:'内容来源', sourceOutcomeId:'来源结果', summary:'摘要', text:'正文', body:'正文',
    status:'状态', executionStatus:'执行状态', inputTokens:'输入 Token', outputTokens:'输出 Token',
    costMinor:'账本费用（分）', currency:'币种', latencyMs:'模型耗时', model:'模型',
    policyVersion:'策略版本', modelPolicyVersion:'模型策略版本', createdAt:'创建时间',
    input:'输入', output:'输出', code:'代码', message:'说明', errors:'错误', evidence:'采集状态',
    command:'操作', diagnostics:'诊断', job:'后台任务', usage:'消耗', selected:'已选中',
    activeChapter:'当前章节', completedChapters:'已完成章节', queuedChapters:'后续章节',
    requiredStateEffectCodes:'所需进展', evidenceStateEffectCodes:'已有进展', missingStateEffectCodes:'缺少进展',
    minimumMeaningfulOutcomes:'最少有效操作', meaningfulOutcomeCount:'有效操作次数',
    preferredSurface:'优先呈现位置', seedRef:'剧情种子', narrativeFunction:'叙事功能',
    debugEvidence:'过程证据', memory:'记忆', memoryAssemblyMs:'上下文组装总耗时',
    directorMs:'调度耗时', retrievalMs:'召回耗时', privatePovMs:'人物视角耗时',
    mainRuntimeMs:'主模型耗时', validationMs:'校验耗时', finalizationMs:'结算耗时',
    materializationMs:'内容生成耗时', persistenceMs:'提交耗时',
  });
  const label = (value) => labels[value] || value || '未采集';
  const badge = (value) => '<span class="badge ' + (/fail|reject|error/.test(value || '') ? 'danger' : /process|running|queued|pending|backend|compiling/.test(value || '') ? 'working' : /applied|succeeded|completed|compiled|available/.test(value || '') ? 'success' : '') + '">' + esc(label(value)) + '</span>';
  const empty = (title, text = '') => '<div class="empty-state"><span class="empty-glyph" aria-hidden="true">◇</span><strong>' + esc(title) + '</strong>' + (text ? '<p>' + esc(text) + '</p>' : '') + '</div>';
  const avatar = (name, large) => '<span class="avatar' + (large ? ' large' : '') + '" aria-hidden="true">' + esc(Array.from(name || 'S').slice(0,1).join('')) + '</span>';
  const lazyValues = new Map();
  let lazySequence = 0;
  function deferred(value, title, rawMode = false) {
    const key = String(++lazySequence);
    lazyValues.set(key, { value, rawMode });
    return '<details class="'+(rawMode?'raw-details':'lazy-evidence')+'" data-evidence-key="'+key+'"><summary>'+esc(title)+'</summary><div class="lazy-evidence-body"></div></details>';
  }
  const raw = (title, value) => deferred(value, title, true);
  function hydrateEvidence(node) {
    if (!node?.open || !node.dataset.evidenceKey || node.dataset.evidenceLoaded) return;
    const saved=lazyValues.get(node.dataset.evidenceKey);
    if (!saved) return;
    node.dataset.evidenceLoaded='true';
    node.querySelector('.lazy-evidence-body').innerHTML=saved.rawMode
      ? '<pre>'+esc(JSON.stringify(saved.value ?? null,null,2))+'</pre>' : renderValue(saved.value);
    lazyValues.delete(node.dataset.evidenceKey);
  }
  function renderValue(value, depth = 0) {
    if (value === null || value === undefined) return '<span class="missing">未采集</span>';
    if (typeof value === 'boolean') return '<span>' + (value ? '是' : '否') + '</span>';
    if (typeof value !== 'object') return '<span class="value-text">' + esc(value === '' ? '空值' : value) + '</span>';
    if (depth > 0 && (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0)) return deferred(value,Array.isArray(value)?value.length+' 项，展开查看':Object.keys(value).length+' 个字段，展开查看');
    if (Array.isArray(value)) {
      if (!value.length) return '<span class="muted">已返回空列表</span>';
      return '<div class="evidence-list">' + value.map((row, i) => '<div class="evidence-list-item"><span class="row-index">' + (i+1) + '</span>' + renderValue(row, depth+1) + '</div>').join('') + '</div>';
    }
    const entries = Object.entries(value);
    if (!entries.length) return '<span class="muted">已返回空对象</span>';
    return '<dl class="evidence-fields">' + entries.map(([key, child]) => {
      const complex = child && typeof child === 'object';
      return '<div class="evidence-field"><dt title="' + esc(key) + '">' + esc(label(key)) + (labels[key] ? '<small>' + esc(key) + '</small>' : '') + '</dt><dd>' +
        (complex && depth > 1 ? '<details><summary>' + (Array.isArray(child) ? child.length+' 项' : Object.keys(child).length+' 个字段') + '</summary>' + renderValue(child,depth+1) + '</details>' : renderValue(child,depth+1)) + '</dd></div>';
    }).join('') + '</dl>';
  }
  const section = (title, value, note) => '<section class="evidence-section"><h3>' + esc(title) + '</h3>' + (note ? '<p class="muted">' + esc(note) + '</p>' : '') + renderValue(value) + '</section>';
  function projections(result) {
    return result?.finalProjections?.current || arr(result?.turns).at(-1)?.current?.projections || result?.opening?.current?.projections || result?.initialProjections?.current || {};
  }
  function startSelection(input, playerId, followerId) {
    const bound=new Set(arr(input?.characterVersionIds));
    const seen=new Set();
    const characters=arr(input?.characters).filter(row=>row.characterVersionId && bound.has(row.characterVersionId) && !seen.has(row.characterVersionId) && seen.add(row.characterVersionId));
    const players=characters.filter(row=>row.playable!==false);
    const defaultPlayerSelected=playerId==='__default_player__';
    const selectedPlayer=players.some(row=>row.characterVersionId===playerId)?playerId:null;
    const followers=characters.filter(row=>row.characterVersionId!==selectedPlayer);
    const selectedFollower=followers.some(row=>row.characterVersionId===followerId)?followerId:null;
    return {players,followers,playerId:selectedPlayer,followerId:selectedFollower,defaultPlayerSelected,playerChoiceMade:defaultPlayerSelected || Boolean(selectedPlayer) || !bound.size,requiresPlayer:bound.size>0,requiresFollower:followers.length>0,
      missingInteractionCharacter:bound.size>0 && Boolean(selectedPlayer) && !followers.length,
      ready:!bound.size || ((defaultPlayerSelected || Boolean(selectedPlayer)) && followers.length>0 && Boolean(selectedFollower))};
  }
  function trace(result) { return arr(result?.trace?.tracks).find((row) => row.trackCode === 'current') || {}; }
  function preview(result) { return result?.previewRuns?.current || {}; }
  function cast(result) {
    const p = projections(result);
    if (p.cast?.status === 'succeeded') return items(p.cast);
    return arr(preview(result).castSnapshot?.entries);
  }
  function actorName(result, id) {
    const row = cast(result).find((a) => a.actorId === id || a.characterVersionId === id);
    if (row) return row.displayName || row.name || id;
    const input = arr(result?.input?.characters).find((a) => a.characterVersionId === id);
    const player = arr(preview(result).actorStates).find((a) => a.kind === 'player' && a.actorId === id);
    return input?.displayName || (player && preview(result).identitySnapshot?.displayName) || id || '未回传姓名';
  }
  function steps(result) {
    if (!result) return [];
    const list = [];
    if (result.scenario || result.input) list.push({id:'source',title:'剧本输入与保存',kind:'source',status:result.scenario ? 'succeeded' : 'draft',input:result.input,output:result.scenario});
    if (result.release) list.push({id:'publish',title:'发布到测试环境',kind:'publish',status:result.release.status,input:result.scenario,output:result.release});
    if (result.experiment) list.push({id:'compile',title:'编译剧本',kind:'compile',status:result.experiment.status,output:result.compiledPlans,input:result.input});
    if (preview(result).runId) list.push({id:'start',title:'开局与选角',kind:'start',status:'succeeded',input:{playerCharacterVersionId:result.input?.playerCharacterVersionId,firstFollowerCharacterVersionId:result.input?.firstFollowerCharacterVersionId},output:preview(result)});
    const opening = result.opening?.current;
    const openingId=opening?.command?.commandId || opening?.accepted?.commandId;
    const openingAlreadyListed=arr(result.turns).some(turn => openingId
      ? [turn.current?.command?.commandId,turn.current?.accepted?.commandId].includes(openingId)
      : (turn.kind || turn.actionPayload?.type || turn.current?.payload?.type)==='confirm_opening_post');
    const executions = [...(opening && !openingAlreadyListed ? [{id:'opening',title:'确认开场',execution:opening}] : []),...arr(result.turns).map((turn,i)=>({id:'turn-'+i,title:label(turn.kind || turn.actionPayload?.type || turn.current?.payload?.type || '用户操作'),action:turn.action,execution:turn.current,input:turn.actionPayload,index:i+1}))];
    const seenCommands=new Set();
    for (const row of executions) {
      const commandId=row.execution?.command?.commandId || row.execution?.accepted?.commandId;
      if(commandId && seenCommands.has(commandId))continue;
      if(commandId)seenCommands.add(commandId);
      const commandTrace=arr(trace(result).runtimeCommands).find((t)=>t.commandId===commandId);
      list.push({...row,kind:'runtime',commandId,status:commandTrace?.diagnostics?.executionStatus || row.execution?.status || '未采集',trace:commandTrace,outcome:{...row.execution?.outcome,...commandTrace?.outcome},durationMs:row.execution?.durationMs});
    }
    return list;
  }
  function uniqueCalls(calls) {
    const seen=new Set();
    return arr(calls).filter(row=>{if(!row.callRef)return true;if(seen.has(row.callRef))return false;seen.add(row.callRef);return true;});
  }
  function compileCalls(result) {
    return uniqueCalls(arr(result?.trace?.tracks).flatMap(track=>{
      const runtimeRefs=new Set(arr(track.runtimeCommands).flatMap(command=>arr(command.aiCalls)).map(call=>call.callRef).filter(Boolean));
      return arr(track.compilerCalls || track.compileCalls || track.aiCalls).filter(call=>
        !runtimeRefs.has(call.callRef) && (call.ownerDomain==='creator_platform' || Boolean(track.compilerCalls || track.compileCalls)));
    }));
  }
  function callsFor(result, step) {
    if (step?.kind==='runtime') return uniqueCalls(step.trace?.aiCalls);
    if (step?.kind==='compile') return compileCalls(result);
    return [];
  }
  function usage(calls) {
    const seen = new Set();
    const rows = arr(calls).filter((row)=>{if(!row.callRef)return true;if(seen.has(row.callRef))return false;seen.add(row.callRef);return true;});
    const sum = (key) => rows.length && rows.every((row)=>number(row[key])!==null) ? rows.reduce((n,r)=>n+r[key],0) : null;
    const costs = new Map();
    let missingCost=0;
    for(const row of rows) {
      if(!row.currency || number(row.costMinor)===null) {missingCost++;continue;}
      costs.set(row.currency,(costs.get(row.currency)||0)+row.costMinor);
    }
    return {count:rows.length,inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),cost:[...costs].map(([currency,n])=>currency+' '+(n/100).toFixed(4)).join(' + '),missingCost};
  }
  function allCalls(result) {
    const currentIds=new Set([result?.opening?.current,...arr(result?.turns).map(turn=>turn.current)]
      .flatMap(execution=>[execution?.command?.commandId,execution?.accepted?.commandId]).filter(Boolean));
    const runId=result?.previewRuns?.current?.runId;
    const runtime=arr(trace(result).runtimeCommands).filter(command=>command.runId ? command.runId===runId : currentIds.has(command.commandId));
    return uniqueCalls([...compileCalls(result),...runtime.flatMap(command=>arr(command.aiCalls))]);
  }
  function usageHtml(value) {
    const n=(v)=>number(v)===null?'未采集':v.toLocaleString();
    return '<div class="metric-strip"><div><small>模型调用</small><strong>'+ (value.count || '未采集') +'</strong></div><div><small>输入 Token</small><strong>'+n(value.inputTokens)+'</strong></div><div><small>输出 Token</small><strong>'+n(value.outputTokens)+'</strong></div><div><small>账本费用</small><strong>'+esc(value.cost || '未采集')+'</strong>'+(value.missingCost?'<small>'+value.missingCost+' 次调用费用未采集</small>':'')+'</div></div>';
  }
  function modelRequests(calls) {
    if(!calls.length)return '<p class="missing">实际模型请求未采集。</p>';
    return calls.map(call=>{
      const evidence=call.requestEvidence,body=evidence?.requestBody;
      const explanation=evidence?.dispatchState==='acceptance_unknown'?'发送尝试已记录，Provider 是否接收未知':
        evidence?.dispatchState==='response_received'?'已收到 Provider 响应 · HTTP '+String(evidence.providerStatus ?? '未回传'):
        call.requestEvidenceStatus==='unavailable'?'请求证据暂时无法读取':'最终提示词未采集';
      return '<article class="request-call"><div class="section-heading"><h3>'+esc(body?.model || call.model || '模型未回传')+'</h3><span class="badge">'+(call.requestEvidenceStatus==='captured'?'请求已采集':call.requestEvidenceStatus==='unavailable'?'读取失败':'未采集')+'</span></div><p class="muted">'+esc(explanation)+'</p>'+
        (body?section('调用参数',Object.fromEntries(Object.entries(body).filter(([key])=>key!=='messages')))+arr(body.messages).map(message=>'<div class="request-message"><small>'+esc(message.role)+'</small>'+raw(message.role==='system'?'完整 System 提示词':'完整 '+(message.role || '消息')+' 内容',message.content)+'</div>').join(''):'')+
        raw('完整请求与用量记录',call)+'</article>';
    }).join('');
  }
  function observedStages(outcome, diagnostics) {
    const timing=outcome.stageTimings || outcome.debugEvidence?.stageTimings;
    const rows=[['调度','directorMs'],['记忆召回','retrievalMs'],['人物独立视角','privatePovMs'],['主模型','mainRuntimeMs'],['结果校验','validationMs'],['规则结算','finalizationMs'],['内容物化','materializationMs'],['数据库提交','persistenceMs']];
    const names={input:'操作输入',modelInput:'Runtime 上下文',finalPrompt:'最终模型请求',modelCandidate:'模型候选',authorityBoundProposal:'工程绑定后结果',memory:'记忆证据',stageTimings:'阶段耗时',outcome:'已落库结果',aiCalls:'AI 调用记录',failureDetails:'失败原因详情'};
    const coverage=Object.entries(diagnostics?.evidence || {}).map(([key,status])=>'<div class="observed-stage"><span class="step-dot"></span><strong>'+esc(names[key] || key)+'</strong><span>'+esc({captured:'已采集',not_collected:'未采集',partial:'部分采集',unavailable:'读取失败',none_recorded:'无调用记录'}[status] || status)+'</span></div>').join('');
    return '<section class="evidence-section"><h3>执行阶段耗时</h3><div class="observed-stages">'+rows.map(([title,key],i)=>'<div class="observed-stage"><small>'+String(i+1).padStart(2,'0')+'</small><strong>'+title+'</strong><span>'+duration(timing?.[key])+'</span></div>').join('')+'</div><p class="muted">阶段顺序为诊断分组。未采集耗时不能据此判断该步骤未执行；并行与包含关系不重复加总。</p></section>'+
      (coverage?'<section class="evidence-section"><h3>本次证据覆盖</h3>'+coverage+'</section>':'');
  }
  function failureDetails(diagnostics, status) {
    const rows=arr(diagnostics?.failureEvidence);
    if(!rows.length && !/fail|reject|error/.test(status || '') && !arr(diagnostics?.errors).length)return '';
    const phases={load_context:'读取操作上下文',director:'调度与人物选择',memory:'记忆召回',model_input:'组装模型输入',model_call:'模型调用',proposal_validation:'模型结果校验',finalization:'结果结算',materialization:'内容生成',persistence:'保存结果',relationship_selection:'关系选择'};
    const states={captured:'已采集',not_collected:'未采集',unavailable:'读取失败'};
    const counts={sceneActorCount:'场景人物数',participantCount:'参与人物数',knownActorCount:'已知人物数',providerCallCount:'模型调用数'};
    const body=rows.length?rows.map((row,index)=>{
      const detail=row.status==='captured'?row.details:null;
      const heading='<div class="section-heading"><h3>失败记录 '+(index+1)+'</h3><span class="badge">'+esc(states[row.status] || '未采集')+'</span></div>';
      if(!detail)return '<article class="request-call">'+heading+'<p class="missing">'+(row.status==='unavailable'?'这条失败记录暂时无法读取。':'这条失败记录没有采集到具体原因。')+'</p></article>';
      const fields=arr(detail.validationFieldPaths);
      const scope=Object.entries(counts).filter(([key])=>number(detail.scopeCounts?.[key])!==null).map(([key,title])=>'<span>'+title+'：'+esc(detail.scopeCounts[key])+'</span>').join(' · ');
      return '<article class="request-call">'+heading+'<p><strong>失败环节：</strong>'+esc(phases[detail.phase] || detail.phase || '未返回')+'</p>'+
        '<p><strong>具体错误码：</strong><code>'+esc(detail.internalCode || detail.errorCode || '未返回')+'</code></p>'+
        (detail.reasonCode?'<p><strong>判定原因：</strong><code>'+esc(detail.reasonCode)+'</code></p>':'')+
        (fields.length?'<p><strong>相关字段：</strong>'+fields.map(field=>'<code>'+esc(field)+'</code>').join('、')+'</p>':'')+
        (scope?'<p class="muted">'+scope+'</p>':'')+
        (detail.failedAt?'<p class="muted">记录时间：'+esc(detail.failedAt)+'</p>':'')+'</article>';
    }).join(''):'<p class="missing">具体失败原因未采集；当前只能查看后台返回的通用错误码。</p>';
    return '<section class="evidence-section"><h3>失败原因与环节</h3>'+body+'</section>';
  }
  function modelObjects(debug) {
    if (!debug) return null;
    const entries=Object.entries(debug).filter(([key])=>/model|provider|candidate|proposal|prompt/i.test(key));
    return entries.length ? Object.fromEntries(entries) : null;
  }
  function diagnostic(result, step, tab) {
    if (!step) return empty('选择一条操作记录','每次操作的输入、调度、模型调用和结果会在这里关联展示。');
    const outcome=step.outcome||{}, debug=outcome.debugEvidence, command=step.trace||{};
    const inputNotice=step.execution?.payload?.bodyTruncated && !command.input?'<p class="notice">摘要，完整输入待读取。原正文 '+esc(step.execution.payload.originalBodyLength)+' 字；刷新后从后端 Trace 读取完整内容。</p>':'';
    if(tab==='input') return inputNotice+section('本次实际输入',command.input || step.input || step.execution?.payload)+section('操作提交结果',step.execution?.accepted || step.output);
    if(tab==='context') return section('召回与过滤证据',outcome.memoryEvidence)+section('实际记忆与人物视角',debug?.memory)+section('上下文组成与预算',debug?.engineering?.contextManifest)+raw('全部上下文过程证据',debug);
    if(tab==='decisions') return failureDetails(command.diagnostics,step.status)+section('用户意图与可执行结果',outcome.attemptInterpretation)+section('调度、人物与内容选择',outcome.directorDecision)+section('工程决策',debug?.engineering)+section('章节触发依据',outcome.chapterDirective || outcome.gameplayEvidence?.chapter?.directive);
    if(tab==='model') {
      const calls=callsFor(result,step);
      const requests=calls.map(call=>({callRef:call.callRef,model:call.model,requestEvidenceStatus:call.requestEvidenceStatus || 'not_collected',
        ...(call.requestEvidence?{requestBody:call.requestEvidence.requestBody,captureStage:call.requestEvidence.captureStage,dispatchState:call.requestEvidence.dispatchState,providerStatus:call.requestEvidence.providerStatus}:{}),
        explanation:call.requestEvidence?.dispatchState==='acceptance_unknown'?'发送尝试已记录，Provider 是否接收未知':call.requestEvidenceStatus==='captured'?'来自 Transport 发送边界的真实请求体':'最终提示词未采集'}));
      return usageHtml(usage(calls))+'<section class="evidence-section"><h3>实际模型请求</h3>'+modelRequests(calls)+'</section>'+
        section('Runtime 组装上下文',debug?.modelInput)+section('模型原始候选',debug?.modelCandidate)+section('工程绑定后的结果',debug?.authorityBoundProposal)+section('模型调用明细',calls);
    }
    if(tab==='applied') return section('结果摘要',outcome.narrativeSummary)+section('最终应用到产品的变化',outcome.gameplayEvidence)+section('剧情与章节结果',{narrativeEffects:outcome.narrativeEffects,chapterState:outcome.chapterState,chapterSettlement:outcome.chapterSettlement})+section('操作后的读取结果',step.execution?.projections || step.output);
    if(tab==='cost') return (step.kind==='compile'?'<p class="notice">包含本实验 Current 与 V2 两轨的真实编译调用，按 callRef 去重；当前游玩仅执行 Current。</p>':'')+usageHtml(usage(callsFor(result,step)))+section('独立阶段耗时',outcome.stageTimings || debug?.stageTimings,'只显示实际采集的耗时。并行步骤不相加冒充用户等待时间。')+section('后端用量汇总',command.diagnostics?.usage || command.usage)+section('全部调用账单',callsFor(result,step));
    if(tab==='raw') return raw('完整操作证据',step)+raw('编译与运行 Trace',result?.trace)+raw('API 请求记录',step.kind==='workspace'?step.operations:result?.operations);
    if(step.kind==='compile') {
      const compiled=arr(result.compiledPlans?.tracks).find((row)=>row.trackCode==='current');
      const plan=parse(compiled?.planJson);
      return usageHtml(usage(callsFor(result,step)))+section('编译状态',result.experiment)+section('世界编译结果',plan)+section('游戏配置',parse(compiled?.gameConfigJson))+section('编译选择依据',parse(compiled?.selectionTraceJson))+raw('完整编译产物',result.compiledPlans);
    }
    if(step.kind==='workspace')return section('执行状态',{status:step.status,error:step.error})+arr(step.operations).map(operation=>section('实际输入 · '+operation.operationId,operation.input)+section('实际输出',operation.output)+section('操作结果',{status:operation.status,httpStatus:operation.httpStatus,durationMs:operation.durationMs,error:operation.error})).join('');
    if(step.kind==='publish')return '<p class="notice">'+esc('正式发布会额外执行 Creator 编译。当前评测接口未提供这次发布编译的用量与费用，暂不计入上方实验合计。')+'</p>'+section('测试发布状态与结果',step.output)+section('本次发布使用的剧本',step.input);
    if(step.kind==='source' || step.kind==='start') return section(step.kind==='source'?'输入内容':'所选人物',step.input)+section(step.kind==='source'?'已保存的剧本':'开局结果',step.output)+(step.kind==='source'?section('保存剧本与预制活动的真实操作',arr(result.operations).filter(operation=>/WorldDraft|ActivityDefinition/.test(operation.operationId))):'');
    return inputNotice+'<div class="diagnostic-title">'+badge(step.status)+'<span class="mono">'+esc(step.commandId || '')+'</span></div>'+
      (outcome.narrativeSummary?'<p class="result-summary">'+esc(outcome.narrativeSummary)+'</p>':'')+
      failureDetails(command.diagnostics,step.status)+usageHtml(usage(callsFor(result,step)))+
      observedStages(outcome,command.diagnostics)+section('流程执行状态',command.diagnostics || {executionStatus:step.status},'展示真实后台状态；“已接收”表示操作已提交，最终结果以应用状态为准。')+
      section('调度决策',outcome.directorDecision)+section('实际应用的产品变化',outcome.gameplayEvidence)+
      section('异常与错误',command.diagnostics?.errors || step.execution?.error || command.error)+
      raw('原始操作记录',step);
  }
  function projectionNotice(projection, noun) {
    if(!projection) return '<p class="notice">尚未读取'+esc(noun)+'。</p>';
    if(projection.status!=='succeeded')return '<p class="notice error">'+esc(noun)+'读取失败：'+esc(projection.error?.message || projection.error?.code || projection.status)+'</p>';
    if(projection.value?.truncated || projection.value?.pageInfo?.hasMore || projection.value?.pageInfo?.nextCursor)return '<p class="notice">当前只展示已读取的'+esc(noun)+'，结果尚未完整加载。</p>';
    return '';
  }
  root.SliceEvalConsoleView=Object.freeze({arr,esc,parse,items,number,duration,label,badge,empty,avatar,raw,renderValue,section,projections,trace,preview,cast,actorName,steps,callsFor,usage,allCalls,usageHtml,diagnostic,projectionNotice,hydrateEvidence,compileCalls,uniqueCalls,modelRequests,startSelection,failureDetails,clearLazyEvidence:()=>lazyValues.clear()});
})(typeof window !== 'undefined' ? window : globalThis);
