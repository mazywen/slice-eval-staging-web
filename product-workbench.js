/* Product-facing inspection of recorded Eval operations. Navigation performs no I/O. */
(function (root) {
  'use strict';
  const arr = v => Array.isArray(v) ? v : [];
  const num = v => typeof v === 'number' && Number.isFinite(v);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parse = v => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } };
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const names = {
    body:'正文', text:'内容', summary:'经历简记', narrativeSummary:'本次变化简记', description:'描述', title:'标题', name:'名字', displayName:'人物',
    background:'背景', identity:'身份', goal:'目标', currentSituation:'此刻处境', opening:'出生内容', firstPostDraft:'开场草稿',
    personality:'性格', speakingStyle:'说话方式', bio:'简介', worldDescription:'世界中的身份', worldSetting:'世界背景', worldGoal:'世界目标',
    worldCore:'世界基础', worldBase:'世界基础', world:'世界', environment:'环境', setting:'背景', gameConfig:'世界与玩法基础',
    skills:'能力', value:'当前值', relationships:'人物关系', axes:'关系数值', support:'支持', depth:'深度', conflict:'冲突', affinity:'亲近', trust:'信任', respect:'认可', tension:'紧张',
    actors:'人物', characters:'人物', activeCharacters:'当前人物', player:'我扮演的人物', selectedPlayer:'我扮演的人物', firstFollower:'初始互动人物', initialLinkedCharacter:'初始互动人物',
    publicState:'公开信息', worldLocalDefinition:'人物设定', castBindingSnapshots:'人物基础', initialRelationship:'初始关系', atmosphere:'当前氛围', unresolved:'未完事项',
    items:'记录', content:'内容', payload:'这次输入', command:'这次行动', directive:'本次安排', run:'本局材料',
    memoryType:'记忆类别', memoryKind:'记忆类别', privacyScope:'可见范围', visibilityScope:'可见范围', visibility:'发送范围',
    acquisitionMode:'获知方式', stance:'看法', salience:'重要程度', object:'记录内容', knownFacts:'已确认信息', beliefs:'人物看法',
    activeChapter:'本章', chapterState:'当时的章节状态', narrativeObjective:'本章目标', nextQuestion:'眼前的问题', conditions:'过章条件', conditionState:'条件进展', satisfied:'是否达成',
    label:'说明', threshold:'门槛', currentValue:'当前数值', day:'第几天', dayInChapter:'章内日期', postsRemaining:'剩余公开行动', dayCard:'今日安排', focus:'今日方向',
    suggestedInputs:'快捷草稿', shortInteraction:'短互动', options:'可选回应', contentWrites:'人物正文', ambientFeedback:'路人公开动态与评论', proactiveMessages:'主动私信',
    narratorBlocks:'现场描写', characterSpeech:'人物对白', suggestedActions:'行动选择', memoryFacts:'候选记忆', relationshipChanges:'关系变化', statChanges:'状态变化', skillChanges:'能力变化',
    sceneDescription:'场景', purpose:'当前目的', location:'地点', time:'时间', when:'时间', ordinal:'顺序', kind:'类别', type:'类别', speaker:'发言者', author:'作者', sender:'发言者',
    status:'状态', reason:'原因', decision:'处理结果', sourceKind:'内容来源', summaryStatus:'摘要状态', query:'本次查找', safeMemoryHints:'可表达的记忆',
    memoryContext:'本次记忆', sharedContext:'共同可用材料', directMessageHistory:'连续私聊原话', threadContext:'当前线程', participantScopedRecall:'当前对话窗口',
    responseIntent:'当前回应方向', delta:'变化', from:'此前', to:'之后', graphRetrievalActive:'图记忆是否启用', vectorRetrievalActive:'向量是否启用', knownBy:'知情人物', saidBy:'说话者',
    actorId:'人物', authorActorId:'发言人物', ownerActorId:'谁的记忆', sourceActorId:'由谁告知', speakerActorId:'说话人物', fromActorId:'人物', toActorId:'关系对象',
    stageDesignAssistance:'当前阶段写作参考', currentTensions:'当前矛盾', beatCandidates:'当前情境参考', feelings:'当下感受',
    originalBytes:'去重前字节', retainedBytes:'去重后字节', savedBytes:'减少字节', removedItems:'去掉的重复记录',
    originalChars:'整理前字数', retainedChars:'整理后字数', savedChars:'减少字数', textBefore:'整理前', textAfter:'整理后',
    contents:'帖子与评论', dmMessages:'私聊消息', canonEvents:'正式事件', relationshipMoments:'关系变化', graphEdges:'图记忆连接',
    expectedExtraCalls:'策略预计调用数', extractionRequired:'是否需要提取', progressPercent:'进展百分比', postsToday:'当天公开行动',
    operator:'比较方式', phase:'处理阶段', resolution:'结算结果', dayOnly:'仅更新今日安排', normalizedOutput:'后端规范化结果', validationStatus:'校验状态',
    accepted:'通过记忆筛选', rejected:'跳过或拒绝', reasonCode:'处理原因', surfaces:'已保存内容位置',
    destination:'保存位置', count:'实际保存数量', nextUse:'后续用途', evidence:'对应记录',
    memory:'记忆', privatePovContexts:'各人物读取的私密材料',
    retrievalPlan:'本次查找安排', queryText:'本次检索内容', growth:'成长变化', events:'事件', hooks:'后续入口',
    beforeValue:'变化前', afterValue:'变化后', memoryWriteDiagnostics:'记忆筛选结果',
    KNOWLEDGE_SOURCE_NOT_VERIFIED:'尚未取得可靠事实来源', DUPLICATE_MEMORY_SEMANTICS:'已有同义记忆',
    EPISODE_NOT_SIGNIFICANT:'未达到长期经历保留条件', ONE_EPISODE_PER_ACTOR_OUTCOME:'已保留该人物本轮更重要的经历'
  };
  const values = {knowledge:'已确认知识', episode:'重要经历', belief:'人物看法', public:'公开可见', participants:'参与者可见', scene:'场内可见', private:'私密', direct_message:'通过私聊', direct_observation:'亲眼所见', told_by:'由他人告知', public_report:'公开信息', rumor:'听说', inference:'推测', post:'动态', confirm_opening_post:'开场动态', comment:'评论', reply:'回复', dm_message:'私聊', accepted:'已接收', applied:'已保存', rejected:'未应用', succeeded:'已完成', finalized:'已完成', failed:'失败', processing:'处理中', running:'处理中', pending:'等待处理', queued:'排队中', skipped:'本次跳过', gte:'至少', lte:'至多'};
  const stageNames = {world_base_compile:'整理作品基础', run_birth:'生成出生处境', dynamic_chapter:'准备章节／日程', runtime_turn:'回应玩家与社交生成', private_pov:'角色私密记忆处理', activity_opening:'活动开场', activity_invitation:'活动参与判断', runtime_repair_l1_field:'修复个别字段', runtime_repair_l2_module:'修复一段输出', runtime_repair_l3_full:'完整重试'};
  const panels = new Map();
  let serial = 0, currentSelection = null, touchStart = null, horizontalMotion = 0, lastMotionAt = 0, lastNavigationAt = 0;
  function human(value, depth = 0) {
    if (value == null) return '<p class="pm-muted">本步未采集这项内容</p>';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value !== 'object') return '<span class="pm-prose">' + esc(values[value] || value) + '</span>';
    if (depth > 10) return '<span class="pm-muted">深层材料可在原始记录中查看</span>';
    if (Array.isArray(value)) return value.length ? '<div class="pm-values">' + value.map(v => '<div>' + human(v, depth + 1) + '</div>').join('') + '</div>' : '<span class="pm-muted">本次为空</span>';
    const rows = Object.entries(value).filter(([k,v]) => names[k] && (!/ActorId$|^actorId$/.test(k) || typeof v === 'string' && !uuid.test(v)));
    // Unknown wrapper names do not hide recognized business content nested below them.
    const nested = rows.length ? '' : Object.entries(value).filter(([k,v]) => !/id$|ref$|digest|schema|token|authorization|secret/i.test(k) && v && typeof v === 'object').map(([,v]) => human(v, depth + 1)).join('');
    return rows.length ? '<dl class="pm-fields">' + rows.map(([k,v]) => '<div><dt>' + names[k] + '</dt><dd>' + human(v, depth + 1) + '</dd></div>').join('') + '</dl>' : nested || '<p class="pm-muted">这里仅有运行定位信息；业务正文未采集。</p>';
  }
  const raw = (value, label = '查看技术原始记录') => '<details class="pm-raw"><summary>' + esc(label) + '</summary><pre>' + esc(typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2)) + '</pre></details>';
  const section = (title, value) => '<section class="pm-section"><h3>' + esc(title) + '</h3>' + human(value) + '</section>';
  function unique(rows) {
    const map = new Map(), unknown = [];
    for (const row of arr(rows)) { if (!row) continue; if (row.callRef) { const prior = map.get(row.callRef); map.set(row.callRef, {...prior, ...row}); } else unknown.push(row); }
    return [...map.values(), ...unknown];
  }
  function experimentCalls(result) {
    const trace = result?.trace;
    if (!trace || !result?.experiment?.experimentId || trace.experimentId !== result.experiment.experimentId) return [];
    return unique(arr(trace.tracks).flatMap(t => [...arr(t.aiCalls), ...arr(t.compilerCalls), ...arr(t.compileCalls), ...arr(t.runtimeCommands).flatMap(c => arr(c.aiCalls)), ...arr(t.activityInvitations).flatMap(a => arr(a.aiCalls))]));
  }
  function charge(calls, zeroKnown = false) {
    const rows = unique(calls), C = root.SliceCostEstimate;
    if (!rows.length) return {display:zeroKnown?'¥0.000000':'待计价', note:zeroKnown?'程序步骤，未调用模型':'尚未取得完整调用用量', value:zeroKnown?0:null};
    const estimated = C?.estimateCalls(rows), ledger = rows.every(r => r.currency === 'CNY' && num(r.costMinor));
    const value = ledger ? rows.reduce((n,r) => n + r.costMinor / 100, 0) : estimated?.cny;
    const missing = ledger ? 0 : rows.length - (estimated?.timedCalls || 0);
    return {display:C?.cnyMoney(value)||'待计价', value, note:ledger?'人民币账本':missing?`已计价 ${rows.length-missing}/${rows.length} 次，其余待计价`:estimated?.cacheUnknownCalls?'缓存未采集部分按未命中上界估算':'实际用量 × 当时人民币单价（估算）'};
  }
  function moneyBox(title, calls, zeroKnown = false) { const c = charge(calls, zeroKnown); return '<div class="pm-money"><small>' + esc(title) + '</small><strong>' + esc(c.display) + '</strong><span>' + esc(c.note) + '</span></div>'; }
  function candidate(call) { const v = parse(call?.rawAiOutput); return parse(v?.choices?.[0]?.message?.content ?? v?.output ?? v?.value ?? v); }
  function stepTitle(step) {
    if (step?.kind === 'ai_stage') return stageNames[step.aiCalls?.[0]?.stage] || '准备当前剧情';
    return String(step?.title || '等待操作').replace(/\s*·\s*Chapter Generation|\s*·\s*Agency/g, '');
  }
  function phaseStatus(step) { return values[step?.status] || (step?.status === 'waiting_for_user' ? '等待下一次输入' : '状态待回传'); }
  function selectedStep(history, selected) { return history.find(s => s.id === selected?.id) || history.at(-1) || null; }
  function historyTarget(history, id, direction) {
    const index = history.findIndex(s => s.id === id), next = index + direction;
    return index >= 0 && next >= 0 && next < history.length ? history[next].id : null;
  }
  function requestBlocks(call) { return root.SlicePromptWorkbench?.requestBlocks(call) ?? null; }
  function materialGroups(calls) {
    const groups = {world:[], people:[], memory:[], scene:[]};
    function add(key, block) {
      if (/^(run|dynamicTail|stablePrefix)$/.test(key) && block.value && typeof block.value === 'object') {
        for (const [k,v] of Object.entries(block.value)) add(k, {...block, path:block.path+'.'+k, value:v});
        return;
      }
      const group = /world|gameConfig/i.test(key) ? 'world' : /memory|pov|recall|history|commitment|belief/i.test(key) ? 'memory'
        : /cast|characters|actors|selectedPlayer|^player$|firstFollower|initialLinked|relationship|skill/i.test(key) ? 'people' : 'scene';
      groups[group].push({...block, title:names[key] || '本次场景材料'});
    }
    for (const [index,call] of calls.entries()) for (const b of requestBlocks(call) || []) {
      if (b.group === 'system') continue;
      add(b.path.split('.').at(-1), {...b, callRef:call.callRef, callLabel:'调用 '+(index+1)+' · '+(stageNames[call.stage]||'模型处理')});
    }
    return groups;
  }
  const blockView = blocks => blocks.length ? blocks.map(b => (b.callLabel?'<p class="pm-material-origin">进入 '+esc(b.callLabel)+'</p>':'')+section(b.title, b.value)).join('') : '<p class="pm-muted">这一步没有采集到此类模型输入。</p>'; 
  function assembly(call, step, result, V) {
    const W = root.SlicePromptWorkbench, blocks = requestBlocks(call);
    if (!blocks) return '<p class="pm-muted">实际发送请求未采集。工程上下文与真正发送的 Prompt 分开保留。</p>';
    const prior = W.priorCall(result, step, call, V);
    const compared = W.diffBlocks(blocks, prior ? requestBlocks(prior) : null);
    const changes = {first:'首次观察',same:'沿用',added:'加入',removed:'移出',changed:'更新'};
    return '<p class="pm-muted">按实际发送顺序展开。标记来自与前一次同场景请求的文字比较，并非 KV 命中证明。</p><div class="pm-assembly">' + compared.map((b,i) => {
      const title = b.group === 'system' ? '身份与本次任务' : names[b.path.split('.').at(-1)] || b.title || '当前材料';
      return '<section class="pm-assembly-block '+b.state+'"><header><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+esc(title)+'</strong><small>'+changes[b.state]+'</small></header>'+human(b.state==='removed'?b.previous:b.value)+
        (b.state==='changed'?'<details><summary>对照上一次这块内容</summary>'+human(b.previous)+'</details>':'')+
        '<footer>'+b.chars+' 字符'+(b.previousChars==null?'':' · 上次 '+b.previousChars+' 字符')+'</footer></section>';
    }).join('')+'</div>'+raw(call.requestEvidence.requestBody.messages,'逐字查看实际发送 messages');
  }
  function writeEvidence(step) {
    const o = step?.outcome || {}, m = o.debugEvidence?.memory || {};
    return {counts:o.writeCounts, diagnostics:m.writeDecisions || m.writeDiagnostics || o.gameplayEvidence?.memoryWriteDiagnostics,
      checkpoint:o.gameplayEvidence?.sceneMemoryCheckpoint,
      economy:o.debugEvidence?.engineering?.contextManifest?.memoryEconomy};
  }
  function storageDestinations(step) {
    const o=step?.outcome||{}, counts=o.writeCounts;
    if(!o.outcomeId || o.decision==='rejected' || !counts || typeof counts!=='object')return [];
    const destinations={
      contents:['本局信息流 · 帖子与评论','信息流展示、当前线程的后续回复'],
      dmMessages:['本局私聊 · 对应会话','该会话的连续原话窗口'],
      memoryFacts:['本局核心人物记忆库','按人物知情范围供后续召回'],
      canonEvents:['本局正式事件记录','世界事实与后续剧情承接'],
      relationshipMoments:['本局人物关系记录','人物当前关系与变化来历'],
      graphEdges:['本局图记忆连接','按人物与事件关系检索'],
      events:['本局事件','后续合法的事件回应'],
      activityTurns:['当前活动的局部回合','下一回合接续与结束结算'],
      skillLedgers:['本局能力变化记录','能力页与后续结果判断'],
      statLedgers:['本局数值变化记录','当前数值与条件判断']
    };
    return Object.entries(counts).filter(([,v])=>Number.isSafeInteger(v)&&v>=0).map(([key,count])=>({
      destination:destinations[key]?.[0]||names[key]||'其他本局记录',count,
      nextUse:destinations[key]?.[1]||'用途详见该项技术原始记录'
    }));
  }
  function writePanel(step) {
    const w = writeEvidence(step), destinations=storageDestinations(step);
    return section('保存到哪里',destinations.length?destinations:null)+section('正式保存的数量',w.counts)+section('记忆采用、跳过与去重',w.diagnostics)+section('会话提取检查点',w.checkpoint)+section('请求材料去重',w.economy)+
      '<p class="pm-muted">通过筛选的候选与正式保存分开显示；保存数量来自本次后端结果。后续用途是该存储的职责，不代表下一轮已经读取。图索引、摘要检查点缺少证据时保持未采集。</p>'+raw(w);
  }
  function validationPanel(step, calls = []) {
    const o=step?.outcome||{}, debug=o.debugEvidence||{}, memory=writeEvidence(step).diagnostics;
    const modelChecks=calls.map((call,index)=>({
      name:'调用 '+(index+1)+' · '+(stageNames[call.stage]||'模型处理'),
      status:call.serverProcessing?.validationStatus==='accepted'?'模型输出结构检查通过'
        :call.serverProcessing?.validationStatus==='rejected_or_failed'?'模型输出未通过或调用失败':'结构检查结果未采集',
      reason:'模型结构检查与玩法正式生效是两个环节。',
      content:call.serverProcessing?.normalizedOutput ?? null,
    }));
    const failures=arr(step?.trace?.diagnostics?.failureEvidence).filter(r=>r.status==='captured').map(r=>r.details);
    return section('每次模型返回的结构检查',modelChecks.length?modelChecks:null)+section('通过权限与格式检查的候选',debug.authorityBoundProposal)+
      section('记忆筛选：通过和跳过',memory)+section('正式生效的数值与剧情变化',o.gameplayEvidence)+
      section('校验失败记录',failures.length?failures.map(f=>({phase:f.phase,reason:f.internalCode||f.errorCode})):null)+
      '<p class="pm-muted">规范化后的 JSON 仍可能被后续校验拒绝。是否生效以本次正式结果和保存记录为准。</p>';
  }
  function deliveredForStep(result,step) {
    if(step?.outcome?.decision==='rejected')return [];
    const o=step?.outcome||{}, ids=new Set([...(o.createdContentIds||[]),...arr(o.gameplayEvidence?.surfaces).map(r=>r.contentId)].filter(Boolean));
    const found=new Map();
    const walk=(v,depth=0)=>{
      if(!v||typeof v!=='object'||depth>14)return;
      // Replies carry their parent postId as well as their own replyId.
      // Match the content itself, so a later reply cannot replace its parent.
      const id=v.contentId||v.replyId||v.messageId||v.postId;
      const body=v.body??v.text??v.content?.body;
      if(typeof body==='string' && ((id&&ids.has(id)) || (step?.commandId && [v.commandId,v.sourceCommandId].includes(step.commandId)))) {
        found.set(id||body,{author:v.author?.displayName||v.sender?.displayName||null,kind:v.kind||v.type,body});
      }
      for(const child of Object.values(v))if(child&&typeof child==='object')walk(child,depth+1);
    };
    // The current projection is usable only after an exact persisted content/command match.
    walk(step?.execution?.projections); walk(result?.finalProjections?.current);
    return [...found.values()];
  }
  function buildGraph(result,step,V) {
    const nodes=[], edges=[];
    const add=(id,title,note,data={})=>{const n={id,title,note,kind:'program',status:'未采集',...data};nodes.push(n);return id;};
    const link=(from,to)=>edges.push({from,to});
    if(!step)return {nodes,edges,calls:[]};
    const calls=V.callsFor(result,step), rawInput=step.trace?.input||step.input||step.execution?.payload||null;
    const input = step.kind==='start' ? {player:arr(result.input?.characters).find(c=>c.characterVersionId===step.input?.playerCharacterVersionId)?.displayName,
      initialLinkedCharacter:arr(result.input?.characters).find(c=>c.characterVersionId===step.input?.firstFollowerCharacterVersionId)?.displayName} : rawInput;
    add('input',step.kind==='source'?'作者提交的作品':step.kind==='start'?'本次角色选择':'收到这次输入','只属于当前选中的步骤',{kind:'input',status:input?'已记录':'未采集',input,output:input});
    if(step.kind==='source') {
      add('save','保存作品基础',step.output?'已经返回保存结果':'等待保存结果',{status:step.output?'已返回':'未采集',input,output:step.output,technical:step.output});link('input','save');return {nodes,edges,calls};
    }
    if(step.kind==='compile'&&!calls.length) {
      const available=arr(step.output?.tracks).filter(t=>t.trackCode==='current'&&t.status==='available');
      const plan=available.length===1?parse(available[0].displayJson||available[0].planJson):null;
      const observed=arr(result.trace?.tracks).some(t=>t.trackCode==='current'&&Array.isArray(t.compilerCalls||t.compileCalls||t.aiCalls));
      add('compile','整理共享世界基础',plan?'已返回当前作品产物':'等待编译产物',{status:phaseStatus(step),input,output:plan,
        inputHtml:section('作者输入',input), outputHtml:section('当前编译的实际产物',plan)+raw(step.output),
        zeroKnown:observed, technical:step.output});link('input','compile');return {nodes,edges,calls};
    }
    const groups=materialGroups(calls), materialIds=[];
    const titles={world:'世界基础',people:'人物与视角',memory:'记忆与共同经历',scene:'场景、日程与当前输入'};
    for(const [key,blocks] of Object.entries(groups))if(blocks.length){
      const id=add(key,titles[key],'实际请求里包含 '+blocks.length+' 块材料',{kind:'material',status:'已进入请求',inputHtml:blockView(blocks),outputHtml:blockView(blocks),technical:blocks.map(b=>({path:b.path,value:b.value})),note:'这里反映模型实际收到的材料，不将它自动等同于一次数据库查询。'});link('input',id);materialIds.push(id);
    }
    if(calls.length) {
      add('assembly','装配这次提示词','固定背景 → 当时材料 → 本次输入',{kind:'assembly',status:calls.some(c=>requestBlocks(c))?'已采集':'未采集',
        inputHtml:Object.entries(groups).filter(([,b])=>b.length).map(([k,b])=>section(titles[k],b.map(r=>r.value))).join(''),
        promptHtml:calls.map((c,i)=>'<h3>调用 '+(i+1)+' · '+esc(stageNames[c.stage]||'模型处理')+'</h3>'+assembly(c,step,result,V)).join(''),
        outputHtml:'<p>装配结果是实际发送的消息。点击“提示词与组装”按原顺序查看。</p>'});
      for(const id of materialIds.length?materialIds:['input'])link(id,'assembly');
      calls.forEach((c,i)=>{
        const id=add('call-'+i,stageNames[c.stage]||'模型处理','调用 '+(i+1)+' · '+V.duration(c.providerLatencyMs??c.latencyMs),{kind:'ai',status:values[c.status]||'状态待回传',call:c,
          inputHtml:blockView(requestBlocks(c)||[]),promptHtml:assembly(c,step,result,V),
          outputHtml:section('AI 实际返回（校验前）',candidate(c))+section('后端规范化结果',c.serverProcessing?.normalizedOutput)+raw(c.rawAiOutput,'AI 返回原文'),
          writeHtml:'<p>模型输出先经过程序校验；是否写入，以这次操作的正式结果为准。</p>'+writePanel(step)});link('assembly',id);
      });
    }
    const o=step.outcome||{}, failure=arr(step.trace?.diagnostics?.failureEvidence).filter(r=>r.status==='captured').map(r=>r.details);
    add('check','检查与形成正式结果',o.outcomeId?'后端已返回正式结果':failure.length?'已采集失败，展开查看':'正式结果尚未采集',{
      status:o.outcomeId?(o.decision==='rejected'?'未应用':'已保存'):failure.length?'失败':'未采集',inputHtml:calls.length?section('待检查的候选',calls.map(candidate)):section('这次操作',input),
      outputHtml:section('本次结果简记',o.narrativeSummary)+validationPanel(step,calls)+raw({status:step.status,failures:failure,chapterSettlement:o.chapterSettlement}),writeHtml:writePanel(step)});
    for(const id of calls.length?calls.map((_,i)=>'call-'+i):['input'])link(id,'check');
    const delivered=deliveredForStep(result,step);
    add('display','交付给玩家的内容',delivered.length?delivered.length+' 条正文已匹配本次保存结果':o.outcomeId&&o.decision!=='rejected'?'保存结果已返回，正文见详情':'尚未取得正式交付',{
      status:delivered.length?'已交付':o.outcomeId&&o.decision!=='rejected'?'已保存':'未采集',input:o.narrativeSummary,
      outputHtml:section('本次正式内容',delivered.length?delivered:null)+(step.kind==='ai_stage'||step.kind==='start'?section('本阶段实际返回',step.output):'')+raw(o.gameplayEvidence,'本次内容写入凭证'),writeHtml:writePanel(step)});link('check','display');
    if(o.outcomeId||o.debugEvidence?.memory) {
      add('write','记忆与状态回填','查看已写入、跳过和下一轮材料',{status:o.writeCounts?'写入已记录':'未采集',input:o.debugEvidence?.modelCandidate?.memoryFacts,outputHtml:writePanel(step),writeHtml:writePanel(step)});link('check','write');
    }
    return {nodes,edges,calls};
  }
  function box(node,step,V) {
    const id='pm-'+(++serial); panels.set(id,{...node,stepTitle:stepTitle(step)});
    const status=node.status||'未采集';
    return '<button type="button" class="pm-box '+(node.kind==='ai'?'pm-ai':'')+'" data-pm-node="'+id+'" data-node-kind="'+esc(node.kind)+'" data-node-key="'+esc(node.id)+'"><span class="pm-box-top">'+esc(status)+'</span><strong>'+esc(node.title)+'</strong><small>'+esc(node.note)+'</small>'+(node.call?'<span class="pm-node-cost">'+esc(charge([node.call]).display)+'</span>':'')+'<span class="pm-open">输入 · 提示词 · 输出 ↗</span></button>';
  }
  function graph(result,step,V) {
    const model=buildGraph(result,step,V);
    if(!model.nodes.length)return '<p class="pm-muted">右侧提交后，这里显示真实处理过程。</p>';
    const rows=[];
    for(const node of model.nodes){
      const level=node.kind==='input'?0:node.kind==='material'?1:node.kind==='assembly'?2:node.kind==='ai'?3:node.id==='check'?4:node.id==='display'||node.id==='write'?5:1;
      (rows[level] ||= []).push(node);
    }
    const present=rows.filter(Boolean);
    const overlap=root.SlicePromptWorkbench?.overlaps(model.calls);
    scheduleConnections();
    return '<p class="pm-evidence-note">'+phaseStatus(step)+' · '+(model.calls.length?model.calls.length+' 次模型调用':'模型调用以采集记录为准')+(overlap?' · 观察到最大 '+overlap.peak+' 路调用时间重叠':'')+'。方框来自本步记录，连线表示材料流向；每次调用的实际请求单独保留。</p><div class="pm-graph pm-step-swipe" data-pm-swipe data-pm-edges="'+esc(JSON.stringify(model.edges))+'" aria-label="当前步骤模块图，左右滑动回看操作"><svg class="pm-connections" aria-hidden="true"></svg>'+present.map((nodes,i)=>(i?'<div class="pm-arrow" aria-hidden="true"></div>':'')+'<div class="pm-flow-row '+(nodes.length>1?'pm-branch':'')+'">'+nodes.map(n=>box(n,step,V)).join('')+'</div>').join('')+'</div>'; 
  }
  let connectionObserver=null, connectionFrame=null;
  function drawConnections(graph) {
    const svg=graph?.querySelector('.pm-connections');if(!svg)return;
    const rect=graph.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const ns='http://www.w3.org/2000/svg';
    svg.setAttribute('viewBox','0 0 '+rect.width+' '+rect.height);
    svg.setAttribute('width',String(rect.width));svg.setAttribute('height',String(rect.height));
    const defs=root.document.createElementNS(ns,'defs'),marker=root.document.createElementNS(ns,'marker');
    marker.setAttribute('id','pm-edge-arrow');marker.setAttribute('viewBox','0 0 8 8');marker.setAttribute('refX','7');marker.setAttribute('refY','4');marker.setAttribute('markerWidth','6');marker.setAttribute('markerHeight','6');marker.setAttribute('orient','auto');
    const head=root.document.createElementNS(ns,'path');head.setAttribute('d','M 0 0 L 8 4 L 0 8 z');head.setAttribute('fill','currentColor');marker.append(head);defs.append(marker);
    const children=[defs], boxes=new Map([...graph.querySelectorAll('[data-node-key]')].map(el=>[el.dataset.nodeKey,el]));
    for(const edge of parse(graph.dataset.pmEdges)||[]) {
      const source=boxes.get(edge.from),target=boxes.get(edge.to);if(!source||!target)continue;
      const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
      const x1=a.left+a.width/2-rect.left,y1=a.bottom-rect.top,x2=b.left+b.width/2-rect.left,y2=b.top-rect.top-3;
      const mid=y1+Math.max(8,(y2-y1)/2),line=root.document.createElementNS(ns,'path');
      line.setAttribute('d',`M ${x1} ${y1} L ${x1} ${mid} L ${x2} ${mid} L ${x2} ${y2}`);
      line.setAttribute('fill','none');line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','1.5');line.setAttribute('marker-end','url(#pm-edge-arrow)');
      line.dataset.from=edge.from;line.dataset.to=edge.to;children.push(line);
    }
    svg.replaceChildren(...children);
  }
  function scheduleConnections() {
    if(!root.document||!root.requestAnimationFrame)return;
    if(connectionFrame)root.cancelAnimationFrame(connectionFrame);
    connectionFrame=root.requestAnimationFrame(()=>{
      connectionFrame=null;connectionObserver?.disconnect();
      const graph=root.document.querySelector('#pm-inspector .pm-graph');if(!graph)return;
      drawConnections(graph);
      if(root.ResizeObserver){connectionObserver=new root.ResizeObserver(()=>drawConnections(graph));connectionObserver.observe(graph);for(const box of graph.querySelectorAll('[data-node-key]'))connectionObserver.observe(box);}
    });
  }
  function historyMarkup(history,step,selected) {
    const index=history.findIndex(s=>s.id===step?.id);
    return '<div class="pm-history-controls"><button type="button" data-pm-history-delta="-1"'+(index<=0?' disabled':'')+'>← 上一步</button><span>第 '+(index+1)+' / '+history.length+' 步</span><button type="button" data-pm-history-delta="1"'+(index<0||index>=history.length-1?' disabled':'')+'>下一步 →</button><button type="button" data-pm-history="__latest__" class="'+(!selected?'active':'')+'">跟随最新</button></div>'+
      '<nav class="pm-history-strip" aria-label="操作历史，可横向滚动">'+history.map((s,i)=>'<button type="button" data-pm-history="'+esc(s.id)+'" aria-current="'+(s.id===step?.id?'step':'false')+'"><small>'+String(i+1).padStart(2,'0')+' · '+esc(phaseStatus(s))+'</small><strong>'+esc(stepTitle(s))+'</strong></button>').join('')+'</nav>'+
      '<label class="pm-history-select">跳到某一步<select id="pw-step-select"><option value="__latest__"'+(!selected?' selected':'')+'>跟随最新操作</option>'+history.map((s,i)=>'<option value="'+esc(s.id)+'"'+(s.id===selected?.id?' selected':'')+'>'+String(i+1)+' · '+esc(stepTitle(s))+'</option>').join('')+'</select></label>'+
      '<div class="pm-current-step" data-pm-swipe><small>'+(selected?'正在回看历史，右侧保持当前游玩进度':'跟随当前处理')+'</small><h3>'+esc(stepTitle(step))+'</h3><p>左右滑动模块图区或点击上方步骤。历史回看不会重新执行。</p></div>';
  }
  function costs(result,step,V) {
    const calls=step?V.callsFor(result,step):[],u=step?V.stepUsage(result,step):{};
    const ratio=num(u.cacheHit)&&num(u.cacheMiss)&&u.cacheHit+u.cacheMiss>0?(u.cacheHit/(u.cacheHit+u.cacheMiss)*100).toFixed(1)+'%':'未采集';
    const cumulative=experimentCalls(result),groups=new Map();
    for(const c of cumulative){const key=stageNames[c.stage]||'其他已采集处理';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}
    return '<section id="pm-costs" class="pw-footer pm-costs" aria-label="人民币费用"><h2>费用与速度</h2><div class="pm-cost-grid">'+moneyBox('选中这一步',calls,u.count===0)+moneyBox('本局已采集累计',V.allCalls(result))+moneyBox('本剧本当前实验累计',cumulative)+'</div><p>本步等待 '+esc(V.duration(step?.durationMs??step?.execution?.durationMs))+' · AI 调用 '+(num(u.count)?u.count:'未采集')+' 次 · KV 输入命中 '+ratio+'</p><details open><summary>各个环节累计（人民币）</summary><table class="pm-cost-table"><thead><tr><th>环节</th><th>调用</th><th>费用</th></tr></thead><tbody>'+[...groups].map(([k,r])=>'<tr><td>'+esc(k)+'</td><td>'+r.length+'</td><td>'+charge(r).display+'</td></tr>').join('')+'</tbody></table></details><p class="pm-muted">剧本累计包含当前实验已采集的编译、试玩和重试，按调用去重；其他历史实验尚未合并。人民币账本直接使用；旧外币账本保留，人民币按当时用量与单价估算。未知费用保持未知。</p></section>';
  }
  function inspector(result,selected,V) {
    const history=V.steps(result),step=selectedStep(history,selected);
    currentSelection={history,step,selected};panels.clear();serial=0;
    return '<div class="pw-heading"><h2>这一步实际发生了什么</h2><small>点方框，看输入与输出</small></div><p class="pm-evidence-note">读入材料 → 拼成请求 → AI 返回 → 检查结果 → 保存位置</p>'+historyMarkup(history,step,selected)+graph(result,step,V);
  }
  function render(result,selected,gameplay,V) {
    const inner=inspector(result,selected,V),step=currentSelection.step;
    return '<div class="pw-workbench pm-workbench"><section id="pm-inspector" class="pw-inspector" aria-label="后端流程方框图">'+inner+'</section><section class="pw-player" aria-label="玩家操作区"><div class="pw-heading"><h2>在这里继续故事</h2></div>'+gameplay+'</section></div>'+costs(result,step,V)+'<dialog id="pm-module-dialog" class="pm-dialog"><header><div><small id="pm-module-step"></small><h2>模块详情</h2></div><button type="button" data-pm-close aria-label="关闭模块详情">×</button></header><div id="pm-module-body"></div></dialog>';
  }
  function updateInspection(result,selected,V) {
    const target=root.document?.getElementById('pm-inspector');
    if(!target)return false;
    root.document.getElementById('pm-module-dialog')?.close();
    target.innerHTML=inspector(result,selected,V);
    const old=root.document.getElementById('pm-costs');if(old)old.outerHTML=costs(result,currentSelection.step,V);
    const active=target.querySelector('.pm-history-strip [aria-current="step"]');
    if(active)active.parentElement.scrollLeft=Math.max(0,active.offsetLeft-active.parentElement.offsetLeft-active.parentElement.clientWidth/2+active.clientWidth/2);
    return true;
  }
  function tabsFor(node) {
    return {input:node.inputHtml||section('进入这个模块的输入',node.input),
      prompt:node.promptHtml||'<p class="pm-muted">这是程序或材料模块。实际 Prompt 在“装配这次提示词”和各个 AI 方框中查看。</p>',
      output:node.outputHtml||section('这个模块的输出',node.output),
      writeback:node.writeHtml||'<p class="pm-muted">本模块没有独立写入凭证；实际写入请查看这一步的“记忆与状态回填”。</p>'};
  }
  function openNode(node,dialog) {
    dialog.querySelector('h2').textContent=node.title;
    dialog.querySelector('#pm-module-step').textContent=node.stepTitle;
    const tabs=tabsFor(node), labels={input:'输入',prompt:'提示词与组装',output:'输出',writeback:'写回与下一轮'};
    dialog.querySelector('#pm-module-body').innerHTML='<p class="pm-muted">'+esc(node.note)+'</p><div class="pm-module-tabs" role="tablist">'+Object.entries(labels).map(([k,v])=>'<button type="button" role="tab" id="pm-tab-'+k+'" aria-controls="pm-pane-'+k+'" data-pm-tab="'+k+'" aria-selected="'+(k==='input')+'">'+v+'</button>').join('')+'</div>'+Object.entries(tabs).map(([k,v])=>'<section class="pm-tab-pane" role="tabpanel" id="pm-pane-'+k+'" aria-labelledby="pm-tab-'+k+'"'+(k!=='input'?' hidden':'')+'>'+v+(k==='input'&&node.technical?raw(node.technical):'')+'</section>').join('')+(node.call?moneyBox('这次 AI 调用',[node.call]):'');
    dialog.showModal();dialog.querySelector('[data-pm-tab="input"]')?.focus();
  }
  function navigate(id) {
    const select=root.document?.getElementById('pw-step-select');
    if(!select||!id||![...select.options].some(o=>o.value===id))return;
    select.value=id;select.dispatchEvent(new root.Event('change',{bubbles:true}));
  }
  if(root.document){
    root.document.addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button||button.disabled)return;
      if(button.dataset.pmHistory!==undefined){navigate(button.dataset.pmHistory);return;}
      if(button.dataset.pmHistoryDelta){navigate(historyTarget(currentSelection?.history||[],currentSelection?.step?.id,Number(button.dataset.pmHistoryDelta)));return;}
      const dialog=root.document.getElementById('pm-module-dialog');
      if(button.dataset.pmNode&&dialog){const node=panels.get(button.dataset.pmNode);if(node)openNode(node,dialog);return;}
      if(button.dataset.pmTab&&dialog){for(const t of dialog.querySelectorAll('[data-pm-tab]'))t.setAttribute('aria-selected',String(t===button));for(const pane of dialog.querySelectorAll('.pm-tab-pane'))pane.hidden=pane.id!=='pm-pane-'+button.dataset.pmTab;return;}
      if(button.hasAttribute('data-pm-close'))dialog?.close();
    });
    root.document.addEventListener('touchstart',e=>{const area=e.target.closest('[data-pm-swipe]');touchStart=area&&e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY,time:Date.now(),area}:null;},{passive:true});
    root.document.addEventListener('touchend',e=>{const start=touchStart;touchStart=null;if(!start||!e.changedTouches.length||Date.now()-start.time>900)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)navigate(historyTarget(currentSelection?.history||[],currentSelection?.step?.id,dx<0?1:-1));},{passive:true});
    root.document.addEventListener('wheel',e=>{
      if(!e.target.closest('[data-pm-swipe]') || e.ctrlKey || Math.abs(e.deltaX)<Math.abs(e.deltaY)*1.5 || !e.deltaX)return;
      const now=Date.now();if(now-lastMotionAt>200)horizontalMotion=0;lastMotionAt=now;horizontalMotion+=e.deltaX;
      const next=historyTarget(currentSelection?.history||[],currentSelection?.step?.id,horizontalMotion>0?1:-1);
      if(next)e.preventDefault();
      if(next&&Math.abs(horizontalMotion)>=70&&now-lastNavigationAt>600){horizontalMotion=0;lastNavigationAt=now;navigate(next);}
    },{passive:false});
    root.document.addEventListener('keydown',e=>{if(!e.target.closest('.pm-history-strip')||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();navigate(historyTarget(currentSelection?.history||[],currentSelection?.step?.id,e.key==='ArrowRight'?1:-1));});
  }
  const api={render,updateInspection,human,charge,experimentCalls,costs,stageNames,buildGraph,materialGroups,deliveredForStep,historyTarget,tabsFor,stepTitle,writeEvidence,storageDestinations,validationPanel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SliceProductWorkbench=Object.freeze(api);
})(typeof window==='undefined'?globalThis:window);
