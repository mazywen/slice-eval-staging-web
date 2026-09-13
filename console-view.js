/* Read-only console presentation. All observations come from backend evidence. */
(function (root) {
  'use strict';
  const arr = (value) => Array.isArray(value) ? value : [];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parse = (value) => { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return value; } };
  const items = (value) => arr(value?.items || value?.value?.items || (Array.isArray(value) ? value : []));
  const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const duration = (value) => number(value) === null ? '未采集' : value < 1000 ? value + ' ms' : (value / 1000).toFixed(1) + ' s';
  function chapterSettlementValue(projection) {
    const chapter = projection?.status === 'succeeded' ? projection.value : null;
    if (!chapter || !Object.hasOwn(chapter, 'lastSettlement')) return undefined;
    return chapter.lastSettlement === null ? '尚未结算' : chapter.lastSettlement;
  }
  const labels = Object.freeze({
    draft_saved:'草稿已保存', compiling:'编译中', compiled:'编译完成', compiled_waiting_for_user:'编译完成，等待选角',
    waiting_for_user:'等待你的操作', waiting_with_issues:'存在待诊断问题', waiting_for_backend:'后台处理中',
    waiting_for_opening:'等待确认开场', starting_runtime:'准备开局', running:'处理中', processing:'处理中',
    succeeded:'已完成', applied:'已应用', accepted:'已接收', pending:'待处理', queued:'排队中',
    pending_invites:'等待邀请处理', invitation_failed:'邀请处理失败', inviting:'邀请中', ready:'可以进入', entered:'已进入',
    acceptance_unknown:'接收状态未知', admission_unknown:'接收状态未知',
    awaiting_response:'等待你的回应', superseded:'已被后续修改替代', invitationResolution:'邀请处理过程',
    invitationResolutionError:'邀请处理错误', invitationRevision:'邀请版本', invitationStates:'各人物邀请状态',
    activity_opening:'活动开场', openingResolution:'活动开场处理过程', activityId:'活动实例', sceneRevision:'场景版本', observedSceneRevision:'已读取场景版本', participantStates:'参与人物状态', currentScene:'实际场景',
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
    queuedChapterCount:'待推进章节数', completedChapterCount:'已完成章节数', lastSettlement:'最近结算',
    requiredStateEffectCodes:'所需进展', evidenceStateEffectCodes:'已有进展', missingStateEffectCodes:'缺少进展',
    chapterType:'章节类型', narrativeObjective:'本章目标', progressPercent:'章节进度百分比',
    stateEffectCodes:'真实状态变化', nextQuestion:'尚待回应的问题', goalEvidence:'目标完成证据',
    minimumMeaningfulOutcomes:'最少有效操作', meaningfulOutcomeCount:'有效操作次数',
    preferredSurface:'优先呈现位置', seedRef:'剧情种子', narrativeFunction:'叙事功能',
    debugEvidence:'过程证据', memory:'记忆', memoryAssemblyMs:'上下文组装总耗时',
    directorMs:'调度耗时', retrievalMs:'召回耗时', privatePovMs:'人物视角耗时',
    mainRuntimeMs:'主模型耗时', validationMs:'校验耗时', finalizationMs:'结算耗时',
    materializationMs:'内容生成耗时', persistenceMs:'提交耗时',
  });
  const label = (value) => labels[value] || value || '未采集';
  const badge = (value) => '<span class="badge ' + (/fail|reject|error/.test(value || '') ? 'danger' : /process|running|queued|pending|backend|compiling/.test(value || '') ? 'working' : /applied|succeeded|completed|compiled|available/.test(value || '') ? 'success' : '') + '">' + esc(label(value)) + '</span>';
  const empty = (title, text = '') => '<div class="empty-state"><span class="empty-glyph" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M12 8h20l6 6v24a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V11a3 3 0 0 1 2-3Z"/><path d="M31 8v8h7M18 23v2m12-2v2m-12 7q6 5 12 0M5 13l-2-1m39 8 3-1"/></svg></span><strong>' + esc(title) + '</strong>' + (text ? '<p>' + esc(text) + '</p>' : '') + '</div>';
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
    return {players,followers,playerId:selectedPlayer,followerId:selectedFollower,defaultPlayerSelected,playerChoiceMade:defaultPlayerSelected || Boolean(selectedPlayer),requiresPlayer:true,requiresFollower:followers.length>0,
      missingInteractionCharacter:bound.size>0 && Boolean(selectedPlayer) && !followers.length,
      ready:(defaultPlayerSelected || Boolean(selectedPlayer)) && (!bound.size || (followers.length>0 && Boolean(selectedFollower)))};
  }
  function trace(result) { return arr(result?.trace?.tracks).find((row) => row.trackCode === 'current') || {}; }
  function preview(result) { return result?.previewRuns?.current || {}; }
  function openingSnapshot(result) {
    const projected = projections(result).run;
    return (projected?.status === 'succeeded' ? projected.value?.opening : preview(result).opening) || {};
  }
  function openingDraftValue(result) {
    const editor = result?.openingEditor;
    if (editor?.runId === preview(result).runId && editor.edited) return String(editor.body ?? '');
    const opening = openingSnapshot(result);
    return typeof opening.firstPostDraft === 'string' ? opening.firstPostDraft : '';
  }
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
  function invitationTraceFor(result, execution) {
    const identity=execution?.invitationResolution || execution?.accepted;
    const runId=preview(result).runId,activityAttemptId=identity?.activityAttemptId;
    const invitationRevision=Number(identity?.invitationRevision);
    if(!runId || !activityAttemptId || !Number.isInteger(invitationRevision) || invitationRevision<1)return null;
    const matches=arr(trace(result).activityInvitations).filter(row=>row.runId===runId && row.activityAttemptId===activityAttemptId && row.invitationRevision===invitationRevision);
    return matches.length===1?matches[0]:null;
  }
  function steps(result) {
    if (!result) return [];
    const list = [];
    if (result.scenario || result.input) list.push({id:'source',title:'剧本输入与保存',kind:'source',status:result.scenario ? 'succeeded' : 'draft',input:result.input,output:result.scenario});
    if (result.release) list.push({id:'publish',title:'发布到测试环境',kind:'publish',status:result.release.status,input:result.scenario,output:result.release});
    if (result.experiment) list.push({id:'compile',title:'编译剧本',kind:'compile',status:result.experiment.status,output:result.compiledPlans,input:result.input});
    if (preview(result).runId) {
      const opening=openingSnapshot(result);
      const status=({pending:'processing',ready:'succeeded',failed:'failed'})[opening.generationStatus] || '未采集';
      list.push({id:'start',title:'开局与选角',kind:'start',status,input:{playerCharacterVersionId:result.input?.playerCharacterVersionId,firstFollowerCharacterVersionId:result.input?.firstFollowerCharacterVersionId},output:{...preview(result),opening}});
    }
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
      const commandTrace=commandId?arr(trace(result).runtimeCommands).find((t)=>t.commandId===commandId):null;
      const invitationTrace=commandId?null:invitationTraceFor(result,row.execution);
      list.push({...row,kind:'runtime',commandId,status:commandTrace?.diagnostics?.executionStatus || row.execution?.status || '未采集',trace:commandTrace || invitationTrace,observationKind:row.execution?.openingResolution?'activity_opening':invitationTrace || row.execution?.invitationResolution?'activity_invitation':'runtime_command',outcome:{...row.execution?.outcome,...commandTrace?.outcome},durationMs:row.execution?.durationMs});
    }
    const runId=preview(result).runId;
    const standaloneStages={dynamic_chapter:'章节生成 · Chapter Generation',character_onboarding:'人物加入 · Agency'};
    for(const call of uniqueCalls(trace(result).aiCalls)) {
      if(!runId || !standaloneStages[call.stage] || call.runId!==runId)continue;
      const stage={id:'ai-'+call.callRef,title:standaloneStages[call.stage],kind:'ai_stage',status:call.status,
        startedAt:call.startedAt,input:call.engineeringInput,output:call.serverProcessing?.normalizedOutput,aiCalls:[call]};
      const next=list.findIndex(row=>['runtime','ai_stage'].includes(row.kind)
        && Date.parse(row.startedAt || row.trace?.acceptedAt)>Date.parse(call.startedAt));
      if(next<0)list.push(stage);else list.splice(next,0,stage);
    }
    return list;
  }
  function uniqueCalls(calls) {
    const seen=new Set();
    return arr(calls).filter(row=>{if(!row.callRef)return true;if(seen.has(row.callRef))return false;seen.add(row.callRef);return true;});
  }
  function compilerCallsForTrack(track) {
    const runtimeRefs=new Set([...arr(track.runtimeCommands),...arr(track.activityInvitations)]
      .flatMap(entry=>arr(entry.aiCalls)).map(call=>call.callRef).filter(Boolean));
    return uniqueCalls(arr(track.compilerCalls || track.compileCalls || track.aiCalls).filter(call=>
      !runtimeRefs.has(call.callRef) && call.ownerDomain!=='world_runtime' && call.businessSubjectType!=='runtime_run' && (call.ownerDomain==='creator_platform' || Boolean(track.compilerCalls || track.compileCalls))));
  }
  function compileCalls(result) {
    return uniqueCalls(arr(result?.trace?.tracks).flatMap(compilerCallsForTrack));
  }
  function compileUsageGroups(result) {
    const tracks=arr(result?.trace?.tracks),owners=new Map();
    for(const track of tracks)for(const call of compilerCallsForTrack(track)) {
      if(!call.callRef)continue;
      if(!owners.has(call.callRef))owners.set(call.callRef,new Set());
      owners.get(call.callRef).add(track.trackCode);
    }
    const shared=new Set([...owners].filter(([,codes])=>codes.size>1).map(([ref])=>ref));
    const groups=['current','v2_candidate'].map(trackCode=>{
      const selected=tracks.filter(track=>track.trackCode===trackCode);
      return {trackCode,title:trackCode==='current'?'Compiler Current':'Compiler V2 Candidate',
        calls:uniqueCalls(selected.flatMap(compilerCallsForTrack)).filter(call=>!shared.has(call.callRef)),
        callsRecorded:selected.length>0 && selected.every(track=>Array.isArray(track.compilerCalls || track.compileCalls || track.aiCalls))};
    });
    if(shared.size)groups.push({trackCode:'shared',title:'两轨共同引用的编译调用',
      calls:compileCalls(result).filter(call=>shared.has(call.callRef)),callsRecorded:true});
    return groups;
  }
  function compileUsageHtml(result) {
    return '<p class="notice">编译调用按真实轨道分列。共同引用的调用单独列出，合计按 callRef 去重；当前游玩仅执行 Current。</p>'+
      compileUsageGroups(result).map(group=>'<section class="evidence-section"><h3>'+esc(group.title)+'</h3>'+
        usageHtml(usage(group.calls,{callsRecorded:group.callsRecorded}))+'</section>').join('');
  }
  function runOpeningCalls(result) {
    const runId=preview(result).runId;
    if(!runId)return [];
    return uniqueCalls(arr(trace(result).aiCalls).filter(call=>
      call.ownerDomain==='world_runtime' && call.businessSubjectType==='runtime_run' && call.runId===runId
      && (!call.stage || call.stage==='run_birth' || call.trigger?.useCase==='world_runtime.run_birth_compile')));
  }
  function callsFor(result, step) {
    if (step?.kind==='ai_stage') return uniqueCalls(step.aiCalls);
    if (step?.observationKind==='activity_opening') return activityOpeningCalls(result,step);
    if (step?.kind==='runtime') return uniqueCalls([...arr(step.trace?.aiCalls),
      ...arr(trace(result).aiCalls).filter(call=>step.outcome?.outcomeId
        && call.businessReferenceType==='runtime_outcome' && call.businessReferenceId===step.outcome.outcomeId)]);
    if (step?.kind==='compile') return compileCalls(result);
    if (step?.kind==='start') return runOpeningCalls(result);
    return [];
  }
  function activityIdentity(step) {
    const input=step?.trace?.input || step?.input || step?.execution?.payload || {};
    const settlement=step?.outcome?.activitySettlement || step?.outcome?.gameplayEvidence?.activitySettlement;
    return settlement?.activityId || input.activityId || step?.execution?.openingResolution?.activityId
      || step?.execution?.activityResponse?.activityId || step?.execution?.accepted?.activityId || null;
  }
  function activityOpeningCalls(result,step) {
    const runId=preview(result).runId,activityId=activityIdentity(step);
    if(!runId || !activityId)return [];
    return uniqueCalls(arr(trace(result).aiCalls).filter(call=>call.runId===runId
      && call.businessSubjectType==='runtime_activity' && call.serverProcessing?.businessSubjectId===activityId
      && (call.stage==='activity_opening' || call.trigger?.useCase==='world_runtime.activity_opening')));
  }
  function activityCostGroups(result,step) {
    const activityId=activityIdentity(step),runId=preview(result).runId;
    if(!activityId || !runId)return null;
    const sameSteps=steps(result).filter(row=>activityIdentity(row)===activityId);
    const instance=items(projections(result).activityInstances).find(row=>row.activityId===activityId)
      || sameSteps.map(row=>row.execution?.activityResponse || row.execution?.accepted).find(row=>row?.activityId===activityId);
    const attemptId=instance?.activityAttemptId;
    const buckets={invitation:[],opening:[],turn:[],exit:[],repair:[]};
    const push=(phase,calls)=>arr(calls).forEach(call=>{
      const repair=call.repair || /repair/.test(call.stage || '') || call.engineeringInput?.repair===true;
      buckets[repair?'repair':phase].push(call);
    });
    if(attemptId)push('invitation',arr(trace(result).activityInvitations)
      .filter(row=>row.runId===runId && row.activityAttemptId===attemptId).flatMap(row=>arr(row.aiCalls)));
    push('opening',activityOpeningCalls(result,step));
    for(const row of sameSteps) {
      if(row.observationKind==='activity_opening')continue;
      const input=row.trace?.input || row.input || row.execution?.payload || {};
      const phase=row.outcome?.activitySettlement?.phase || row.outcome?.gameplayEvidence?.activitySettlement?.phase;
      push(phase==='exit' || input.activityPhase==='exit' || input.type==='activity_exit'?'exit':'turn',callsFor(result,row));
    }
    // The same ledger call may be nested in several traces; count it in one stage only.
    const seen=new Set();
    const groups=Object.entries(buckets).map(([phase,calls])=>({phase,calls:uniqueCalls(calls).filter(call=>{
      if(!call.callRef)return true;if(seen.has(call.callRef))return false;seen.add(call.callRef);return true;
    })}));
    return {activityId,activityAttemptId:attemptId || null,groups,totalCalls:uniqueCalls(groups.flatMap(group=>group.calls))};
  }
  function activityCostHtml(result,step) {
    const value=activityCostGroups(result,step);
    if(!value)return '';
    const titles={invitation:'邀请',opening:'开篇',turn:'活动内所有 Turn',exit:'退出必要调用',repair:'Repair'};
    return '<section class="evidence-section"><h3>本次活动 · 分阶段成本</h3><p class="muted">仅归集同一 Run、活动实例与邀请来源的实际调用，按 callRef 去重。未采集的阶段保持未知；下面合计是已观测费用。</p>'+
      value.groups.map(group=>'<h4>'+titles[group.phase]+'</h4>'+usageHtml(usage(group.calls))).join('')+
      '<h4>活动已观测合计</h4>'+usageHtml(usage(value.totalCalls))+
      (!value.activityAttemptId?'<p class="missing">未读取活动对应的邀请标识，邀请费用尚不能归集。</p>':'')+'</section>';
  }
  function usage(calls, {callsRecorded=false} = {}) {
    const seen = new Set();
    const rows = arr(calls).filter((row)=>{if(!row.callRef)return true;if(seen.has(row.callRef))return false;seen.add(row.callRef);return true;});
    const sum = (key) => rows.length && rows.every((row)=>number(row[key])!==null) ? rows.reduce((n,r)=>n+r[key],0) : null;
    const costs = new Map();
    let missingCost=0;
    for(const row of rows) {
      if(!row.currency || number(row.costMinor)===null) {missingCost++;continue;}
      costs.set(row.currency,(costs.get(row.currency)||0)+row.costMinor);
    }
    return {count:rows.length || (callsRecorded?0:null),inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),cacheHit:sum('promptCacheHitTokens'),cacheMiss:sum('promptCacheMissTokens'),estimate:root.SliceCostEstimate?.estimateCalls(rows),cost:[...costs].map(([currency,n])=>currency+' '+(n/100).toFixed(4)).join(' + '),missingCost};
  }
  function stepUsage(result,step) {
    const diagnostics=step?.trace?.diagnostics;
    const callsRecorded=!['unavailable','not_collected','partial'].includes(diagnostics?.evidence?.callAttribution)
      && diagnostics?.evidence?.aiCalls!=='unavailable'
      && (diagnostics?.evidence?.aiCalls==='none_recorded' || diagnostics?.usage?.recordedCallCount===0);
    return usage(callsFor(result,step),{callsRecorded});
  }
  function allCalls(result) {
    const currentIds=new Set([result?.opening?.current,...arr(result?.turns).map(turn=>turn.current)]
      .flatMap(execution=>[execution?.command?.commandId,execution?.accepted?.commandId]).filter(Boolean));
    const runId=result?.previewRuns?.current?.runId;
    const runtime=arr(trace(result).runtimeCommands).filter(command=>command.runId ? command.runId===runId : currentIds.has(command.commandId));
    const invitations=runId?arr(trace(result).activityInvitations).filter(row=>row.runId===runId):[];
    const outcomeIds=new Set(runtime.map(command=>command.outcome?.outcomeId).filter(Boolean));
    const ownedCalls=arr(trace(result).aiCalls).filter(call=>call.runId===runId && runId
      || call.businessReferenceType==='runtime_outcome' && outcomeIds.has(call.businessReferenceId));
    return uniqueCalls([...compileCalls(result),...ownedCalls,...runtime.flatMap(command=>arr(command.aiCalls)),...invitations.flatMap(row=>arr(row.aiCalls))]);
  }
  function usageHtml(value) {
    const n=(v)=>number(v)===null?'未采集':v.toLocaleString();
    return '<div class="metric-strip"><div><small>模型调用</small><strong>'+ n(value.count) +'</strong></div><div><small>输入 Token</small><strong>'+n(value.inputTokens)+'</strong></div><div><small>输出 Token</small><strong>'+n(value.outputTokens)+'</strong></div><div><small>输入缓存命中 / 未命中</small><strong>'+n(value.cacheHit)+' / '+n(value.cacheMiss)+'</strong></div><div><small>账本费用</small><strong>'+esc(value.cost || '未采集')+'</strong>'+(value.missingCost?'<small>'+value.missingCost+' 次调用费用未采集</small>':'')+'</div></div>'+
      (value.estimate?.pricedCalls?'<p class="muted">Provider 价格估算：'+esc(root.SliceCostEstimate.money(value.estimate.offPeakCny))+'～'+esc(root.SliceCostEstimate.money(value.estimate.peakCny))+' · 按已登记价格与真实 Token / Cache 计算；与账本金额分别展示。'+(value.estimate.unpriced.length?' '+value.estimate.unpriced.length+' 次调用尚无价格或用量。':'')+'</p>':'');
  }
  function modelRequests(calls) {
    if(!calls.length)return '<p class="missing">实际模型请求未采集。</p>';
    const stageNames={world_base_compile:'World Base Compile',run_birth:'Run Birth Compile',dynamic_chapter:'Chapter Generation',character_onboarding:'Character Onboarding',runtime_turn:'Runtime Turn',activity_invitation:'Activity Invitation',activity_opening:'Activity Opening',private_pov:'人物当前视角',runtime_repair_l1_field:'字段修复',runtime_repair_l2_module:'模块修复',runtime_repair_l3_full:'完整重试'};
    return calls.map(call=>{
      const evidence=call.requestEvidence,body=evidence?.requestBody;
      const repair=call.repair || null,processing=call.serverProcessing || {};
      const explanation=evidence?.dispatchState==='acceptance_unknown'?'发送尝试已记录，Provider 是否接收未知':
        evidence?.dispatchState==='response_received'?'已收到 Provider 响应 · HTTP '+String(evidence.providerStatus ?? '未回传'):
        call.requestEvidenceStatus==='unavailable'?'请求证据暂时无法读取':'最终提示词未采集';
      return '<article class="request-call"><div class="section-heading"><h3>'+esc(stageNames[call.stage] || call.stage || 'AI Call')+'</h3>'+badge(call.status)+'</div><p class="muted">'+esc(body?.model || call.model || '模型未回传')+' · '+esc(explanation)+'</p>'+
        section('Trigger · 实际触发',call.trigger)+section('Engineering Input · 工程输入',call.engineeringInput)+
        (body?section('调用参数',Object.fromEntries(Object.entries(body).filter(([key])=>key!=='messages')))+arr(body.messages).map(message=>'<div class="request-message"><small>'+esc(message.role)+'</small>'+raw(message.role==='system'?'完整 System 提示词':'完整 '+(message.role || '消息')+' 内容',message.content)+'</div>').join(''):'')+
        usageHtml(usage([call]))+section('缓存命中率',call.promptCacheHitRatio==null?null:(call.promptCacheHitRatio*100).toFixed(1)+'%')+
        raw('Raw AI Output · 原始输出',call.rawAiOutput)+section('Server Normalize / Derive · 工程校验',processing)+
        section('Repair · 本次修复',repair || (processing.processingEvidenceStatus==='captured'?{occurred:false}:null))+
        section('Latency · 实际耗时',{providerMs:call.providerLatencyMs ?? call.latencyMs})+
        section('校验后交给产品的候选',call.userVisibleResult,'最终是否应用，以这次操作的已落库结果为准。')+
        section('Downstream Consumer · 下游消费',call.downstreamConsumer)+raw('完整请求与用量记录',call)+'</article>';
    }).join('');
  }
  function invitationReasonsHtml(result,attempt) {
    return arr(attempt?.invitationStates).map(row=>'<div class="message-item"><strong>'+
      esc(actorName(result,row.actorId))+' · '+esc({accepted:'同意',rejected:'拒绝',conditional:'提出条件',
      ACCEPTED:'同意',REJECTED:'拒绝',CONDITIONAL:'提出条件'}[row.status || row.decision] || label(row.status || row.decision))+
      '</strong><p>'+esc(row.reason || '暂未返回理由')+'</p></div>').join('');
  }
  function activitySceneHtml(result,instance) {
    const scene=instance?.currentScene || {};
    return arr(scene.narratorBlocks).map(row=>'<p>'+esc(row.text)+'</p>').join('')+
      arr(scene.characterSpeech).map(row=>'<div class="message-item"><strong>'+esc(actorName(result,row.actorId))+
        '</strong><p>'+esc(row.text)+'</p></div>').join('')+
      (arr(scene.suggestedActions).length?'<p class="muted">建议行动：'+arr(scene.suggestedActions)
        .map(row=>esc(row.label || row.prompt)).join(' · ')+'</p>':'');
  }
  function invitationSummary(result,step) {
    const attempt=step?.execution?.activityResponse || step?.execution?.accepted || {};
    const states=Array.isArray(attempt.invitationStates)?attempt.invitationStates:null;
    const calls=callsFor(result,step);
    const batches=calls.map(call=>{
      const input=call.modelEvidence?.modelInput || call.engineeringInput;
      return {callRef:call.callRef,actorCount:Array.isArray(input?.actors)?input.actors.length:null,
        repair:input?.repair===true || Boolean(call.repair),status:call.status};
    });
    return section('批量邀请 · 实际人数与调用',batches.length?batches:null,
      '人数来自已采集的模型输入，调用数来自实际账本。重读邀请结果不会在此生成新的调用。')+
      section('每位人物的决定与理由',states?.map(row=>({actor:actorName(result,row.actorId),
        decision:row.status || row.decision,reason:row.reason ?? null,condition:row.condition ?? row.conditionText ?? null})))+
      section('复用与修复记录',attempt.invitationDiagnostics || step?.trace?.diagnostics?.invitation || null,
        '没有对应记录时不推断复用次数；单纯重读成功不代表重新调用了模型。');
  }
  function activitySettlementHtml(outcome) {
    const settlement=outcome.activitySettlement || outcome.gameplayEvidence?.activitySettlement;
    if(!settlement)return '';
    const local=settlement.phase==='turn' && settlement.gameplaySettled===false;
    const settled=settlement.phase==='exit' && settlement.gameplaySettled===true;
    const title=local?'Activity Turn · 正式游戏状态未结算':settled?'Activity Exit · 一次性正式结算':'Activity · 结算状态待核对';
    return section(title,settlement,local
      ? '本次记录保存活动内过程与暂存效果；它不是已结算的 Gameplay Outcome。'
      : settled?'唯一结果以服务端回执为准，重复读取不会产生新的奖励。':'当前证据不足以确认正式结算完成。')+
      (local?section('活动内暂存材料',outcome.gameplayEvidence?.activityTurns):'');
  }
  function memoryContextHtml(outcome) {
    const debug=outcome.debugEvidence || {},memory=debug.memory || {},input=debug.modelInput || {};
    return section('Memory · R0–R5 与真实启用通路',memory.retrievalPlan || debug.engineering?.retrievalPlan,
        '这是实际选择的召回计划；没有回传的通路不标记为已执行。')+
      section('召回候选与权限、预算剔除',memory.retrievalDiagnostics || memory.rejected || memory.sharedContext,
        '权限过滤与 Token 裁剪各自保留原因。estimatedTokens 是程序估算，Provider 输入 Token 见费用页。')+
      section('最终进入 Prompt 的记忆材料',input.memoryContext,
        '来自实际模型上下文快照，候选不等于最终送入模型。')+
      section('私密处理 · 角色范围与调用安排',memory.privatePovSchedule || debug.engineering?.privatePovSchedule)+
      section('私密处理 · 实际调用与安全投影',{actualCallCount:outcome.memoryEvidence?.privatePovCallCount,
        responderActorIds:memory.responderActorIds,safeHints:input.privatePovHints || memory.privatePovHints})+
      section('Memory · 写入与不写入依据',memory.writeDiagnostics || outcome.gameplayEvidence?.memoryWriteDiagnostics,
        '写入理由、去重和替代必须来自后端记录；候选 memoryFacts 不代表已写入长期记忆。')+
      section('召回与过滤证据',outcome.memoryEvidence)+
      section('上下文组成与预算',debug.engineering?.contextManifest)+threadContextHtml(outcome)+raw('全部上下文过程证据',debug);
  }
  function threadContextHtml(outcome) {
    const input=outcome.debugEvidence?.modelInput;
    const thread=input?.command?.threadContext || input?.threadContext;
    if(!thread)return '';
    return section('长线程 · Root / Target / Recent / Thread State',{
      rootPostId:thread.rootPostId,targetContentId:thread.targetContentId,contextMode:thread.contextMode,
      recentContentIds:thread.recentContentIds,parentContentIds:thread.parentContentIds,
      exactRecallContentIds:thread.exactRecallContentIds,threadState:thread.threadState,
      inputSizes:thread.diagnostics || outcome.debugEvidence?.engineering?.contextManifest?.threadContext},'字节数与 estimatedTokens 来自组装记录，不能当作 Provider 实际 Token。旧消息只按当前线程和权限读取。');
  }
  function socialDeliveryHtml(outcome) {
    const evidence=outcome.gameplayEvidence || {};
    if(!Array.isArray(evidence.surfaces))return '';
    const surfaces=evidence.surfaces,ai=surfaces.filter(row=>row.origin==='runtime_ai');
    const count=(kind)=>ai.filter(row=>row.kind===kind).length;
    return section('社交交付 · 实际落库',{aiPosts:count('post'),aiComments:count('comment'),aiReplies:count('reply'),
      aiDirectMessages:ai.filter(row=>['dm','dm_message'].includes(row.kind)).length,
      actorDelivery:evidence.socialDelivery || null,
      targets:surfaces.map(row=>({contentId:row.contentId,kind:row.kind,authorActorId:row.authorActorId,
        rootPostId:row.rootPostId,parentContentId:row.parentContentId,channelId:row.channelId}))},
      '条数来自已落库的产品证据。Core / Ambient 未标注时保持未分类，不根据角色名字猜测。');
  }
  function eventDecisionHtml(outcome) {
    const policy=outcome.debugEvidence?.engineering?.directive?.generation?.eventPolicy;
    const evidence=outcome.gameplayEvidence || {};
    if(!policy && !Array.isArray(evidence.events) && !Array.isArray(evidence.eventResolutions))return '';
    return section('Event · 保留、补位、处理与通关禁止',{policy,created:evidence.events,
      handled:evidence.eventResolutions,contentOnly:evidence.contentOnly},
      '生成依据来自本轮授权策略与正式结果；计划补位不代表已经生成成功。');
  }
  function observedStages(outcome, diagnostics) {
    const timing=outcome.stageTimings || outcome.debugEvidence?.stageTimings;
    const rows=[['调度','directorMs'],['记忆召回','retrievalMs'],['人物独立视角','privatePovMs'],['主模型','mainRuntimeMs'],['结果校验','validationMs'],['规则结算','finalizationMs'],['内容物化','materializationMs'],['数据库提交','persistenceMs']].filter(([,key])=>number(timing?.[key])!==null && timing[key]>0);
    const names={input:'操作输入',modelInput:'Runtime 上下文',finalPrompt:'最终模型请求',modelCandidate:'模型候选',authorityBoundProposal:'工程绑定后结果',memory:'记忆证据',stageTimings:'阶段耗时',outcome:'已落库结果',aiCalls:'AI 调用记录',failureDetails:'失败原因详情'};
    const coverage=Object.entries(diagnostics?.evidence || {}).map(([key,status])=>'<div class="observed-stage"><span class="step-dot"></span><strong>'+esc(names[key] || key)+'</strong><span>'+esc({captured:'已采集',not_collected:'未采集',partial:'部分采集',unavailable:'读取失败',none_recorded:'无调用记录'}[status] || status)+'</span></div>').join('');
    return executedGameplayStages(outcome)+'<section class="evidence-section"><h3>执行阶段耗时</h3><div class="observed-stages">'+rows.map(([title,key],i)=>'<div class="observed-stage"><small>'+String(i+1).padStart(2,'0')+'</small><strong>'+title+'</strong><span>'+duration(timing?.[key])+'</span></div>').join('')+'</div><p class="muted">只列出实际记录了耗时的阶段。没有耗时记录不能据此判断未执行；并行与包含关系不重复加总。</p></section>'+
      (coverage?'<section class="evidence-section"><h3>本次证据覆盖</h3>'+coverage+'</section>':'');
  }
  function executedGameplayStages(outcome) {
    const evidence=outcome.gameplayEvidence || {},progress=evidence.gameplayProgression;
    const rows=[],counts=outcome.writeCounts || {};
    const add=(title,value)=>{if(value!=null)rows.push(section(title,value));};
    if(evidence.contentOnly===true)add('Content-only Free Play · 状态已冻结',{contentOnly:true});
    const settlement=activitySettlementHtml(outcome);
    if(settlement)rows.push(settlement);
    add('Chapter · 已提交章节结算',outcome.chapterSettlement);
    const dynamic=evidence.dynamicNarrativeState;
    if(arr(dynamic?.currentTensions || dynamic?.tensions).length)add('Current Tension · 当前矛盾',dynamic.currentTensions || dynamic.tensions);
    if(arr(dynamic?.beatCandidates || dynamic?.beats).length)add('Dynamic Beat · 近期候选',dynamic.beatCandidates || dynamic.beats);
    if(progress)add('Valid Outcome / XP / Goal · 工程结算',progress);
    if(progress?.goalState==='completed' || progress?.goalState==='world_complete')add('World Complete · 完成判定',progress);
    for(const [pattern,title] of [[/relationship/i,'Relationship · 实际变化'],[/memory|knowledge|episode|belief/i,'Memory · 实际写入'],[/event/i,'Event · 实际写入'],[/activity/i,'Activity · 实际写入']]) {
      const written=Object.fromEntries(Object.entries(counts).filter(([key,value])=>pattern.test(key) && Number(value)>0));
      if(Object.keys(written).length)add(title,written);
    }
    return rows.length?'<div class="observed-gameplay-stages">'+rows.join('')+'</div>':'';
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
  function invitationModelEvidence(calls, contextOnly=false) {
    if(!calls.length)return section('活动邀请模型上下文',null);
    return calls.map(call=>{
      const evidence=call.modelEvidenceStatus==='captured'?call.modelEvidence:null;
      const note=call.modelEvidenceStatus==='unavailable'?'这次调用的模型证据暂时无法读取。':evidence?'来自本次邀请调用，校验状态：'+(evidence.validationStatus==='validated'?'已校验':'已拒绝'):'这次邀请调用未采集模型输入与候选。';
      return '<article class="request-call"><div class="section-heading"><h3>'+esc(call.model || '模型调用')+'</h3><span class="mono">'+esc(call.callRef || '')+'</span></div><p class="muted">'+esc(note)+'</p>'+
        section('活动邀请模型上下文',evidence?.modelInput)+(!contextOnly?
          section('模型原始候选',evidence?.modelCandidate)+section('Gateway 校验后的候选',evidence?.validatedCandidate,'这里只表示模型输出的校验结果；实际邀请决定见本次操作的已保存结果。'):'')+'</article>';
    }).join('');
  }
  function modelObjects(debug) {
    if (!debug) return null;
    const entries=Object.entries(debug).filter(([key])=>/model|provider|candidate|proposal|prompt/i.test(key));
    return entries.length ? Object.fromEntries(entries) : null;
  }
  function compileTrackEvidence(track) {
    const record=(value)=>{const parsed=parse(value); return parsed && typeof parsed==='object' && !Array.isArray(parsed)?parsed:null;};
    const available=track?.status==='available';
    const plan=available?record(track.planJson):null;
    const display=available?record(track.displayJson):null;
    const config=available?record(track.gameConfigJson):null;
    const policyKeys=['playModePolicies','relationshipPolicy','goalCompletionPolicy','outcomePolicy','aiContextPolicy','budgets','registryVersions','narrativePolicyPins'];
    return {
      worldCore:display?.worldCore ?? null,
      worldBase:display?.worldBase ?? null,
      compiler:display?.compiler ?? null,
      runtimePolicy:available?{
        worldDefinition:{characterMode:display?.characterMode ?? null,identityPolicy:display?.identityPolicy ?? null,defaultPlayMode:display?.defaultPlayMode ?? null},
        worldGameConfig:Object.fromEntries(policyKeys.map(key=>[key,config?.[key] ?? null])),
      }:null,
      gameConfig:config,
      opening:available?record(track.openingJson):null,
      selectionTrace:available?record(track.selectionTraceJson):null,
      selectionTraceNotApplicable:available && track.trackCode==='current' && track.selectionTraceJson===null,
      provenance:plan?.provenance ?? null,
      display,
    };
  }
  function compiledPlansHtml(result) {
    return ['current','v2_candidate'].map(trackCode=>{
      const matches=arr(result?.compiledPlans?.tracks).filter(row=>row.trackCode===trackCode);
      const track=matches.length===1?matches[0]:null, value=compileTrackEvidence(track);
      const title=trackCode==='current'?'Compiler Current':'Compiler V2 Candidate';
      const selectionNote=value.selectionTraceNotApplicable
        ? 'N/A · Current 编译器不生成 Game Design Selection Trace；这不是采集失败。'
        : '来自本轨实际保存的 Game Design Selection Trace；缺失时不推断选择理由。';
      return '<article class="compiled-track"><div class="section-heading"><h3>'+title+'</h3>'+badge(track?.status)+'</div>'+
        section('编译产物标识',{compileJobId:track?.compileJobId,compilerVersion:track?.compilerVersion,definitionDigest:track?.definitionDigest,planDigest:track?.planDigest})+
        section('World Core · 世界设定',value.worldCore,'来自已校验摘要的不可变 WorldDefinition；与当前编辑中的输入分开。')+
        section('World Base · 世界基础',value.worldBase)+
        section('Compiler · 实际执行',value.compiler,value.compiler?.deterministic?'由工程直接整理的世界基础没有 Provider Prompt 或 Token 费用。':'来自实际编译记录。')+
        section('Runtime Policy · 运行规则',value.runtimePolicy,'分别列出 WorldDefinition 的身份规则与 WorldGameConfig 中固定的策略和预算。')+
        section('Game Config · 完整游戏配置',value.gameConfig)+
        section('Opening Config · 开场配置',value.opening)+
        (value.selectionTraceNotApplicable?'<section class="evidence-section"><h3>Selection Trace · 编译选择依据</h3><p class="muted">'+esc(selectionNote)+'</p></section>':section('Selection Trace · 编译选择依据',value.selectionTrace,selectionNote))+
        section('Provenance · 来源依据',value.provenance)+
        section('编译目标与展示投影',value.display?{goal:value.display.goal,displayProjection:value.display.displayProjection}:null);
    }).join('');
  }
  function diagnostic(result, step, tab) {
    if (!step) return empty('选择一条操作记录','每次操作的输入、调度、模型调用和结果会在这里关联展示。');
    const outcome=step.outcome||{}, debug=outcome.debugEvidence, command=step.trace||{};
    const invitation=step.observationKind==='activity_invitation',activityOpening=step.observationKind==='activity_opening';
    const openingResult=activityOpening?{observation:step.execution?.openingResolution,acceptedInstance:step.execution?.accepted,observedInstance:step.execution?.activityResponse}:null;
    const invitationResult=invitation?{observation:step.execution?.invitationResolution,attempt:step.execution?.activityResponse || step.execution?.accepted}:null;
    const inputNotice=step.execution?.payload?.bodyTruncated && !command.input?'<p class="notice">摘要，完整输入待读取。原正文 '+esc(step.execution.payload.originalBodyLength)+' 字；刷新后从后端 Trace 读取完整内容。</p>':'';
    if(tab==='input') return inputNotice+section('本次实际输入',command.input || step.input || step.execution?.payload)+section('操作提交结果',step.execution?.accepted || step.output);
    if(tab==='context' && step.kind==='start')return '<section class="evidence-section"><h3>开局模型实际上下文</h3>'+modelRequests(callsFor(result,step))+'</section>';
    if(tab==='context' && invitation)return invitationModelEvidence(callsFor(result,step),true)+section('独立记忆召回证据',null,'邀请链未单独采集 Memory / Director 证据；上方展示实际送入邀请模型的上下文。');
    if(tab==='context') return memoryContextHtml(outcome);
    if(tab==='decisions' && activityOpening)return failureDetails(command.diagnostics,step.status)+section('活动实例与开场状态',openingResult)+section('异常与错误',step.execution?.error);
    if(tab==='decisions' && invitation)return failureDetails(command.diagnostics,step.status)+invitationSummary(result,step)+section('活动邀请判定与结果',invitationResult)+section('后台处理过程',command.diagnostics);
    if(tab==='decisions') return failureDetails(command.diagnostics,step.status)+eventDecisionHtml(outcome)+section('用户意图与可执行结果',outcome.attemptInterpretation)+section('调度、人物与内容选择',outcome.directorDecision)+section('工程决策',debug?.engineering)+section('章节触发依据',outcome.chapterDirective || outcome.gameplayEvidence?.chapter?.directive);
    if(tab==='model') {
      const calls=callsFor(result,step);
      const requests=calls.map(call=>({callRef:call.callRef,model:call.model,requestEvidenceStatus:call.requestEvidenceStatus || 'not_collected',
        ...(call.requestEvidence?{requestBody:call.requestEvidence.requestBody,captureStage:call.requestEvidence.captureStage,dispatchState:call.requestEvidence.dispatchState,providerStatus:call.requestEvidence.providerStatus}:{}),
        explanation:call.requestEvidence?.dispatchState==='acceptance_unknown'?'发送尝试已记录，Provider 是否接收未知':call.requestEvidenceStatus==='captured'?'来自 Transport 发送边界的真实请求体':'最终提示词未采集'}));
      return (step.kind==='compile'?compileUsageHtml(result):usageHtml(stepUsage(result,step)))+'<section class="evidence-section"><h3>实际模型请求</h3>'+modelRequests(calls)+'</section>'+
        (step.kind==='start'?section('已返回开局内容',openingSnapshot(result)):invitation?invitationModelEvidence(calls):section('Runtime 组装上下文',debug?.modelInput)+section('模型原始候选',debug?.modelCandidate)+section('工程绑定后的结果',debug?.authorityBoundProposal))+section('模型调用明细',calls);
    }
    if(tab==='applied' && step.kind==='start')return section('开局生成状态',openingSnapshot(result).generationStatus)+section('当前开局内容',openingSnapshot(result),'首帖仍需玩家明确确认；生成草稿不表示已经发布帖子。');
    if(tab==='applied' && activityOpening)return section('活动实例与开场状态',openingResult,'实例已创建与开场已完成分开记录；只有读取到 active 才表示本次进入操作已完成。')+section('操作后的读取结果',step.execution?.projections);
    if(tab==='applied' && invitation)return invitationSummary(result,step)+section('活动邀请处理与结果',invitationResult)+section('操作后的读取结果',step.execution?.projections);
    if(tab==='applied') return executedGameplayStages(outcome)+socialDeliveryHtml(outcome)+eventDecisionHtml(outcome)+section('结果摘要',outcome.narrativeSummary)+section('最终应用到产品的变化',outcome.gameplayEvidence)+section('剧情与章节结果',{narrativeEffects:outcome.narrativeEffects,chapterState:outcome.chapterState,chapterSettlement:outcome.chapterSettlement})+section('操作后的读取结果',step.execution?.projections || step.output);
    if(tab==='cost') return (step.kind==='compile'?compileUsageHtml(result):usageHtml(stepUsage(result,step)))+activityCostHtml(result,step)+section('独立阶段耗时',outcome.stageTimings || debug?.stageTimings,'只显示实际采集的耗时。并行步骤不相加冒充用户等待时间。')+section('后端用量汇总',command.diagnostics?.usage || command.usage)+section('全部调用账单',callsFor(result,step));
    if(tab==='raw') return raw('完整操作证据',step)+raw('编译与运行 Trace',result?.trace)+raw('API 请求记录',step.kind==='workspace'?step.operations:result?.operations);
    if(step.kind==='compile') {
      return compileUsageHtml(result)+section('编译状态',result?.experiment)+compiledPlansHtml(result)+raw('完整编译产物',result?.compiledPlans);
    }
    if(step.kind==='workspace')return section('执行状态',{status:step.status,error:step.error})+arr(step.operations).map(operation=>section('实际输入 · '+operation.operationId,operation.input)+section('实际输出',operation.output)+section('操作结果',{status:operation.status,httpStatus:operation.httpStatus,durationMs:operation.durationMs,error:operation.error})).join('');
    if(step.kind==='publish')return '<p class="notice">'+esc('正式发布会额外执行 Creator 编译。当前评测接口未提供这次发布编译的用量与费用，暂不计入上方实验合计。')+'</p>'+section('测试发布状态与结果',step.output)+section('本次发布使用的剧本',step.input);
    if(step.kind==='ai_stage')return modelRequests(callsFor(result,step));
    if(step.kind==='start')return '<div class="diagnostic-title">'+badge(step.status)+'</div>'+usageHtml(stepUsage(result,step))+section('所选人物',step.input)+section('开局结果',step.output);
    if(step.kind==='source' || step.kind==='start') return section(step.kind==='source'?'输入内容':'所选人物',step.input)+section(step.kind==='source'?'已保存的剧本':'开局结果',step.output)+(step.kind==='source'?section('保存剧本与预制活动的真实操作',arr(result.operations).filter(operation=>/WorldDraft|ActivityDefinition/.test(operation.operationId))):'');
    if(activityOpening)return '<div class="diagnostic-title">'+badge(step.status)+'</div>'+section('活动实例与开场状态',openingResult)+failureDetails(command.diagnostics,step.status)+usageHtml(stepUsage(result,step))+section('异常与错误',step.execution?.error)+raw('原始操作记录',step);
    if(invitation)return '<div class="diagnostic-title">'+badge(step.status)+'</div>'+invitationSummary(result,step)+section('活动邀请处理与结果',invitationResult)+failureDetails(command.diagnostics,step.status)+usageHtml(stepUsage(result,step))+section('后台邀请任务与证据覆盖',command.diagnostics || {status:step.status})+section('异常与错误',command.diagnostics?.errors || step.execution?.error)+raw('原始操作记录',step);
    return inputNotice+'<div class="diagnostic-title">'+badge(step.status)+'<span class="mono">'+esc(step.commandId || '')+'</span></div>'+
      (outcome.narrativeSummary?'<p class="result-summary">'+esc(outcome.narrativeSummary)+'</p>':'')+
      failureDetails(command.diagnostics,step.status)+usageHtml(stepUsage(result,step))+
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
  root.SliceEvalConsoleView=Object.freeze({arr,esc,parse,items,number,duration,label,badge,empty,avatar,raw,renderValue,section,projections,trace,preview,cast,actorName,steps,callsFor,usage,allCalls,usageHtml,diagnostic,projectionNotice,hydrateEvidence,invitationReasonsHtml,activitySceneHtml,activityIdentity,activityOpeningCalls,activityCostGroups,activityCostHtml,activitySettlementHtml,invitationSummary,memoryContextHtml,threadContextHtml,socialDeliveryHtml,eventDecisionHtml,compileCalls,runOpeningCalls,compileUsageGroups,compileUsageHtml,stepUsage,uniqueCalls,modelRequests,startSelection,openingSnapshot,openingDraftValue,failureDetails,chapterSettlementValue,invitationTraceFor,compileTrackEvidence,clearLazyEvidence:()=>lazyValues.clear()});
})(typeof window !== 'undefined' ? window : globalThis);
