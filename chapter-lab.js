/* Slice Chapter Lab: runs real compiler/birth/chapter paths through the existing Eval client. */
(function (root) {
  'use strict';
  const arr = value => Array.isArray(value) ? value : [];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const parse = value => { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return value; } };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const STAGES = Object.freeze([
    ['spine','01','整局故事方向','作品目标、核心矛盾与当前故事阶段'],
    ['history','02','已发生剧情','当前有效历史、已经解决和仍未解决的内容'],
    ['player','03','玩家与人物状态','扮演身份、首位关联人物、能力与人物关系'],
    ['writer','04','当前章节编剧','实际发给章节生成模型的材料和 Prompt'],
    ['chapter','05','本章定义','标题、目标、当前问题与参与人物'],
    ['conditions','06','本章条件','事实条件 / 数值条件 / 一次达成或章末维持'],
    ['day','07','今日安排','今天的处境、方向与世界变化'],
    ['suggestions','08','快捷草稿','首帖以后使用的三条第一视角可编辑草稿'],
    ['settlement','09','判定与章末规则','条件如何更新，以及章末 PASS / FAIL 的规则'],
  ]);
  const state = { selectedNode:'spine', baseline:null, variant:null, active:'baseline' };
  function reset() { state.selectedNode='spine'; state.baseline=null; state.variant=null; state.active='baseline'; }

  function stripPersistent(input) {
    const clean = clone(input || {});
    for (const key of ['worldDraftId','worldDraftRevisionId','sourceFingerprint','sourceDraft','scenario','playerCharacterVersionId','firstFollowerCharacterVersionId']) delete clean[key];
    clean.sourceHasDocument = Boolean(clean.sourceDocument?.body);
    if (!clean.sourceHasDocument) clean.sourceDocument = null;
    clean.activityDefinitions = arr(clean.activityDefinitions).map(row => {
      const next = clone(row);
      delete next.activityDefinitionId;
      return next;
    });
    clean.removedActivityDefinitionIds = [];
    return clean;
  }
  function characterMap(input, workspaceCharacters) {
    return new Map([...arr(workspaceCharacters), ...arr(input?.characters)].filter(row => row?.characterVersionId)
      .map(row => [row.characterVersionId, row]));
  }
  function experimentInput(draft, form, workspaceCharacters, variant) {
    const input = stripPersistent(draft);
    input.title = '[Chapter Lab] ' + String(draft?.title || '未命名剧本') + ' · ' + (variant ? '变化版' : '基线');
    if (variant && form.goalOverride) input.goal = form.goalOverride;
    if (variant && form.storyRewrite) input.setting = String(input.setting || '') + '\n\n【章节实验改写】\n' + form.storyRewrite;
    const ids = new Set(arr(input.characterVersionIds));
    if (variant) for (const id of form.extraCharacterVersionIds) ids.add(id);
    if(ids.size>8)throw new Error('实验人物最多 8 位，请减少额外人物；不会静默截掉已选择的人物。');
    input.characterVersionIds = [...ids];
    const map = characterMap(input, workspaceCharacters);
    input.characters = input.characterVersionIds.map(id => map.get(id)).filter(Boolean).map(clone);
    input.topicTags = arr(input.topicTags);
    return input;
  }
  function mainline(result) { return result?.finalProjections?.current?.chapter?.value?.mainline || null; }
  function chapter(result) { return mainline(result)?.activeChapter || null; }
  function opening(result) { return result?.finalProjections?.current?.run?.value?.opening || result?.previewRuns?.current?.opening || null; }
  function actorName(input, id) { return arr(input?.characters).find(row => row.characterVersionId === id)?.displayName || '未返回人物名称'; }
  function usableFollowerIds(input, playerId) { return arr(input?.characterVersionIds).filter(id => id !== playerId); }

  async function settle(client, result, predicate, onProgress, timeoutMs = 120000) {
    const started = Date.now();
    let current = result;
    while (!predicate(current)) {
      if (Date.now() - started > timeoutMs) throw new Error('章节实验等待后台结果超时；原实验与 Run 已保留，可从历史记录恢复。');
      current = current?.runtimePhase === 'opening_waiting_for_user' && !current?.pendingCommand
        ? await client.refreshOpening(current)
        : await client.refresh(current, onProgress);
      onProgress?.({ kind:'chapter-lab-refresh', partialResult:current, message:'正在读取同一个章节实验的后台结果…' });
      if (current?.error) throw new Error(current.error.message || current.error.code || '章节实验后台返回失败');
      if (!predicate(current)) await wait(1000);
    }
    return current;
  }

  async function runExperiment({client,draft,workspaceCharacters,form,variant,onProgress}) {
    if (!draft) throw new Error('请先选择一份剧本。');
    const input = experimentInput(draft, form, workspaceCharacters, variant);
    if (!form.playerCharacterVersionId) throw new Error('请选择本次实验中玩家扮演的人物。');
    const followers = usableFollowerIds(input, form.playerCharacterVersionId);
    if (followers.length && !form.firstFollowerCharacterVersionId) throw new Error('请选择首位关联人物。');
    if (form.firstFollowerCharacterVersionId && !followers.includes(form.firstFollowerCharacterVersionId)) throw new Error('首位关联人物必须属于当前实验人物，并与玩家身份不同。');
    let result = await client.saveDraft(input, onProgress);
    result = await client.compile(result, onProgress);
    result = await client.start(result, {
      playerCharacterVersionId: form.playerCharacterVersionId,
      firstFollowerCharacterVersionId: form.firstFollowerCharacterVersionId || null,
    }, onProgress);
    result = await settle(client, result, r => {
      const line = mainline(r);
      return line?.phase === 'awaiting_talent' && arr(line.talentCandidates).length === 3;
    }, onProgress);
    const line = mainline(result);
    if(form.talentChoiceId && !arr(line.talentCandidates).some(row=>row.choiceId===form.talentChoiceId))throw new Error('已选能力卡未返回，请重新读取实际候选。');
    const choiceId = form.talentChoiceId || line.talentCandidates[0].choiceId;
    result = await client.act(result, { type:'confirm_talent', choiceId, plannerStrategy:'guided' }, onProgress);
    result = await settle(client, result, r => mainline(r)?.phase === 'playing' && Boolean(chapter(r)), onProgress);
    const snapshot = buildSnapshot(result, { ...form, talentChoiceId:choiceId }, variant);
    if (variant) state.variant = snapshot;
    else state.baseline = snapshot;
    state.active = variant ? 'variant' : 'baseline';
    return snapshot;
  }

  function allCalls(result) {
    return root.SliceEvalConsoleView?.allCalls(result) || [];
  }
  function chapterCalls(result) {
    return allCalls(result).filter(call => ['dynamic_chapter','run_birth'].includes(call.stage));
  }
  function dynamicChapterCall(result) {
    return [...chapterCalls(result)].reverse().find(call => call.stage === 'dynamic_chapter') || null;
  }
  function requestMessages(call) { return call?.requestEvidence?.requestBody?.messages || null; }
  function modelCandidate(call) {
    const raw = parse(call?.rawAiOutput);
    return parse(raw?.choices?.[0]?.message?.content ?? raw?.output ?? raw?.value ?? raw);
  }
  function storyDirection(result) {
    const input = result?.input || {};
    return {
      worldGoal: input.goal || null,
      coreSetting: input.setting || null,
      currentStage: chapter(result)?.ordinal ? '第 ' + chapter(result).ordinal + ' 章' : '首章准备',
      note: '当前后端没有独立 Story Spine Artifact；这里展示真正约束首章生成的作品目标与当前阶段材料。',
    };
  }
  function historySnapshot(result) {
    const history = result?.finalProjections?.current?.history?.value;
    return history || { note:'新建章节实验从首章开始，因此没有前章正式历史。测试后续章节应从真实 Run 的当前章读取，而不是伪造跳章。' };
  }
  function playerSnapshot(result, form) {
    const line = mainline(result);
    const picked = arr(line?.talentCandidates).find(row => row.choiceId === form.talentChoiceId);
    return {
      player: actorName(result.input, form.playerCharacterVersionId),
      initialLinkedCharacter: actorName(result.input, form.firstFollowerCharacterVersionId),
      selectedTalent: line?.selectedTalent || picked || null,
      availableCharacterCount: arr(result.input?.characters).length,
    };
  }
  function buildSnapshot(result, form, variant) {
    const active = clone(chapter(result));
    const call = dynamicChapterCall(result);
    const calls = chapterCalls(result);
    return {
      kind: variant ? 'variant' : 'baseline',
      createdAt: new Date().toISOString(),
      title: result?.input?.title || '',
      result,
      form: clone(form),
      storySpine: storyDirection(result),
      history: historySnapshot(result),
      player: playerSnapshot(result, form),
      chapter: active,
      conditions: clone(active?.conditions || []),
      conditionState: clone(mainline(result)?.conditionState || null),
      settlementPassed: mainline(result)?.settlementPassed ?? null,
      dayCard: clone(active?.dayCard || null),
      suggestions: clone(active?.suggestedInputs || []),
      chapterPrompt: requestMessages(call),
      chapterAiOutput: modelCandidate(call),
      chapterCalls: calls,
      cost: root.SliceProductWorkbench?.charge(calls) || null,
    };
  }

  function conditionKey(row) { return [row?.kind,row?.label,row?.predicateCode,row?.metric,row?.code,row?.operator,row?.threshold].join('|'); }
  function diff(a,b) {
    if (!a || !b) return [];
    const rows = [];
    const push = (field,label,left,right) => {
      const l=JSON.stringify(left??null), r=JSON.stringify(right??null);
      rows.push({field,label,left,right,changed:l!==r});
    };
    push('objective','本章目标',a.chapter?.narrativeObjective,b.chapter?.narrativeObjective);
    push('spine','整局故事方向',a.storySpine,b.storySpine);
    push('player','玩家与人物状态',a.player,b.player);
    push('question','核心问题',a.chapter?.nextQuestion,b.chapter?.nextQuestion);
    push('conditions','Conditions',a.conditions,b.conditions);
    push('day','Day Card',a.dayCard,b.dayCard);
    push('suggestions','快捷草稿',a.suggestions,b.suggestions);
    const ac=new Set(a.conditions.map(conditionKey)), bc=new Set(b.conditions.map(conditionKey));
    rows.push({field:'condition_delta',label:'条件变化',left:a.conditions.filter(row=>!bc.has(conditionKey(row))),right:b.conditions.filter(row=>!ac.has(conditionKey(row))),changed:ac.size!==bc.size||[...ac].some(key=>!bc.has(key))});
    return rows;
  }

  function readForm(rootNode = document) {
    return {
      playerCharacterVersionId: rootNode.querySelector('#chapter-lab-player')?.value || '',
      firstFollowerCharacterVersionId: rootNode.querySelector('#chapter-lab-follower')?.value || '',
      talentChoiceId: rootNode.querySelector('#chapter-lab-talent')?.value || '',
      goalOverride: rootNode.querySelector('#chapter-lab-goal')?.value.trim() || '',
      storyRewrite: rootNode.querySelector('#chapter-lab-rewrite')?.value.trim() || '',
      extraCharacterVersionIds: [...rootNode.querySelectorAll('[name="chapterLabExtraCharacter"]:checked')].map(node => node.value),
    };
  }
  function peopleOptions(draft, selectedPlayer, workspaceCharacters) {
    const map=characterMap(draft,workspaceCharacters), ids=arr(draft?.characterVersionIds);
    return ids.map(id=>'<option value="'+esc(id)+'"'+(id===selectedPlayer?' selected':'')+'>'+esc(map.get(id)?.displayName || '未返回人物名称')+'</option>').join('');
  }
  function extras(draft, workspaceCharacters, selected = []) {
    const existing=new Set(arr(draft?.characterVersionIds));
    return arr(workspaceCharacters).filter(row=>row?.characterVersionId&&!existing.has(row.characterVersionId)).slice(0,12).map(row =>
      '<label class="chapter-lab-check"><input type="checkbox" name="chapterLabExtraCharacter" value="'+esc(row.characterVersionId)+'"'+(selected.includes(row.characterVersionId)?' checked':'')+' /> <span><strong>'+esc(row.displayName || '未命名人物')+'</strong><small>'+esc(row.description || row.personality || '')+'</small></span></label>'
    ).join('') || '<p class="muted">工作区里没有额外可加入的现有人物。需要新人物时先在“剧本与创作”创建，再回到这里加入实验副本。</p>';
  }

  function stageData(snapshot,key) {
    if (!snapshot) return {title:'尚未运行',input:null,output:null,prompt:null};
    const data = {
      spine:{title:'整局故事方向',input:snapshot.storySpine,output:snapshot.storySpine},
      history:{title:'已发生剧情',input:snapshot.history,output:snapshot.history},
      player:{title:'玩家与人物状态',input:snapshot.player,output:snapshot.player},
      writer:{title:'当前章节编剧',input:{storySpine:snapshot.storySpine,history:snapshot.history,player:snapshot.player},prompt:snapshot.chapterPrompt,output:snapshot.chapterAiOutput},
      chapter:{title:'本章定义',input:snapshot.chapterAiOutput,output:snapshot.chapter},
      conditions:{title:'本章条件',input:snapshot.chapter,output:snapshot.conditions},
      day:{title:'今日安排',input:{chapter:snapshot.chapter?.title,conditions:snapshot.conditions},output:snapshot.dayCard},
      suggestions:{title:'快捷草稿',input:{dayCard:snapshot.dayCard,conditions:snapshot.conditions},output:snapshot.suggestions},
      settlement:{title:'判定与章末规则',input:{conditions:snapshot.conditions},output:{rule:'行动过程中更新相关条件；数值由程序比较；事实条件由正式结果证据确认；章末统一检查全部条件。',currentState:snapshot.conditionState,settlementPassed:snapshot.settlementPassed}},
    };
    return data[key] || {title:key,input:null,output:null};
  }
  function readable(value) { return root.SliceProductWorkbench?.human(value) || '<pre>'+esc(JSON.stringify(value,null,2))+'</pre>'; }
  function technical(value) { return '<details class="chapter-lab-raw"><summary>查看技术原始记录</summary><pre>'+esc(JSON.stringify(value??null,null,2))+'</pre></details>'; }
  function stageDetail(snapshot,key) {
    const data=stageData(snapshot,key);
    return '<h3>'+esc(data.title)+'</h3><section><h4>输入</h4>'+readable(data.input)+'</section>'
      +(data.prompt?'<section><h4>实际 Prompt</h4>'+readable(data.prompt)+technical(data.prompt)+'</section>':'')
      +'<section><h4>输出</h4>'+readable(data.output)+technical(data.output)+'</section>';
  }
  function flow(snapshot) {
    return '<div class="chapter-lab-flow">'+STAGES.map((stage,index)=>{
      const [key,n,title,note]=stage;
      return (index?'<div class="chapter-lab-arrow">↓</div>':'')+'<button type="button" class="chapter-lab-node'+(state.selectedNode===key?' active':'')+'" data-chapter-lab-node="'+key+'"><small>'+n+'</small><strong>'+title+'</strong><span>'+note+'</span></button>';
    }).join('')+'</div>';
  }
  function diffHtml() {
    const rows=diff(state.baseline,state.variant);
    if (!state.baseline || !state.variant) return '<p class="muted">分别生成“基线”和“变化版”后，这里会逐字段显示变化。</p>';
    return '<table class="chapter-lab-diff"><thead><tr><th>字段</th><th>基线</th><th>变化版</th></tr></thead><tbody>'
      +rows.map(row=>'<tr class="'+(row.changed?'changed':'same')+'"><td>'+esc(row.label)+'</td><td>'+readable(row.left)+'</td><td>'+readable(row.right)+'</td></tr>').join('')
      +'</tbody></table>';
  }
  function costCard(snapshot) {
    if (!snapshot) return '<div class="chapter-lab-metric"><small>章节生成费用</small><strong>尚未运行</strong></div>';
    return '<div class="chapter-lab-metric"><small>章节相关模型调用</small><strong>'+snapshot.chapterCalls.length+' 次</strong><span>'+esc(snapshot.cost?.display || '待计价')+'</span></div>';
  }
  // Read-only review of the existing session. No compiler, Run or state is created here.
  function reviewDays(result, V) {
    const rows = [];
    for (const step of V.steps(result)) {
      const projection = step.execution?.projections?.chapter;
      const line = projection?.status === 'succeeded' ? projection.value?.mainline : null;
      if (line?.activeChapter?.dayCard) rows.push({stepId:step.id, line});
    }
    const projection = result?.finalProjections?.current?.chapter;
    const current = projection?.status === 'succeeded' ? projection.value?.mainline : null;
    if (current?.activeChapter?.dayCard) rows.push({stepId:null, line:current});
    const days = new Map();
    for (const row of rows) {
      const key = [row.line.activeChapter.chapterRef, row.line.day].join(':');
      const previous = days.get(key);
      days.set(key, {...row, versions:(previous?.versions || 0) + 1});
    }
    return [...days.values()];
  }
  function renderReview(result, V) {
    const P = root.SliceProductWorkbench;
    const field = (title,value) => '<div class="story-review-field"><h3>'+esc(title)+'</h3>'+readable(value)+'</div>';
    const panel = (id,title,body) => '<section id="story-review-'+id+'" class="panel story-review-section"><h2>'+title+'</h2>'+body+'</section>';
    const tracks = arr(result?.compiledPlans?.tracks).filter(row=>row.trackCode==='current');
    const track = tracks.length===1 ? tracks[0] : null;
    const compiled = V.compileTrackEvidence(track);
    const plan = track?.status==='available' ? parse(track.planJson) : null;
    const spine = plan && typeof plan==='object' ? plan.experienceSpine : null;
    const projection = result?.finalProjections?.current?.chapter;
    const line = projection?.status==='succeeded' ? projection.value?.mainline : null;
    const chapter = line?.activeChapter;
    const steps = V.steps(result).filter(row=>row.kind==='runtime');
    const days = reviewDays(result,V);
    const opening = V.openingSnapshot(result);
    const name = id => arr(result?.input?.characters).find(row=>row.characterVersionId===id)?.displayName || '未采集';
    const conditionRows = arr(chapter?.conditions).map(condition=>{
      const progress=line.conditionState?.[condition.id];
      const status=progress?.satisfied===true?'已满足':progress?.satisfied===false?'未满足':'未采集';
      return '<tr><td>'+esc(condition.label)+'</td><td>'+(condition.kind==='numeric'?'数值':'事实')+'</td><td>'+status+'</td><td>'
        +(condition.kind==='numeric'?esc(progress?.currentValue??'未采集')+' '+esc(condition.operator==='gte'?'≥':condition.operator==='lte'?'≤':'比较方式未采集')+' '+esc(condition.threshold):'依据见对应操作；当前章节投影未提供证据明细')+'</td></tr>';
    }).join('');
    return '<div class="page-heading"><div><span class="eyebrow">STORY REVIEW</span><h1>剧情评审</h1><p>先看故事，再看判定。这里读取当前会话已有的编译、开局与正式游玩结果。</p></div></div>'
      +'<section class="panel story-review-context"><div><strong>'+esc(result?.input?.title||'尚未选择评测剧本')+'</strong><p class="muted">我扮演 '+esc(name(result?.input?.playerCharacterVersionId))+' · 首位关联 '+esc(name(result?.input?.firstFollowerCharacterVersionId))+'</p></div><div class="inline-controls"><button class="button" type="button" data-page="scripts">修改剧本与人物</button><button class="button primary" type="button" data-page="play">'+(V.preview(result).runId?'继续本局游玩':'选择人物与开局')+'</button><button class="text-button" type="button" id="story-review-advanced">高级隔离实验</button></div><p class="muted">修改输入后沿原流程保存、编译并开新局；下方始终标明当前结果所属剧本，不把未提交的编辑当作生成结果。</p></section>'
      +'<nav class="story-review-nav" aria-label="剧情审核内容">'+[['spine','编译与 Spine'],['opening','开局'],['chapter','章节判定'],['days','每日日程'],['story','实际剧情'],['loops','伏笔回收'],['numbers','数值']].map(([key,label])=>'<a href="#story-review-'+key+'">'+label+'</a>').join('')+'</nav>'
      +panel('spine','01 · 编译与故事方向',field('本次编译输入的目标',result?.input?.goal)
        +(spine?'<p class="notice">该记录实际返回了 experienceSpine；历史编译规划不代表后续内容已经发生，也不证明当前主线仍使用旧规划。</p>'+field('编译返回的 Spine',spine):'<p class="notice">本次记录未提供独立 Spine。以下为实际编译世界基础；作品目标不冒充已生成大纲。</p>')
        +field('编译后的世界基础',compiled.worldBase||compiled.worldCore)
        +'<button class="text-button" type="button" data-inspect-step="compile">查看完整编译证据</button>')
      +panel('opening','02 · 开局与人物',field('出生处境',opening.currentSituation||opening.openingHook)+field('身份与目标',{identity:opening.identity,goal:opening.goal})+field('本局天赋',line?.selectedTalent))
      +panel('chapter','03 · 当前章与过章判定',V.projectionNotice(projection,'章节')+(chapter?'<h3>'+esc(chapter.title)+'</h3><p>'+esc(chapter.narrativeObjective)+'</p><div class="story-review-table"><table><thead><tr><th>条件</th><th>类型</th><th>正式状态</th><th>当前值 / 依据</th></tr></thead><tbody>'+conditionRows+'</tbody></table></div>':'<p class="muted">当前章尚未返回。请先完成原有开局与天赋确认。</p>')
        +'<p class="notice">条件满足与章末过章分开。章末结果：'+(line?.settlementPassed===true?'通过':line?.settlementPassed===false?'未通过':'未返回正式结算')+'。技术异常不等于游戏失败。</p>')
      +panel('days','04 · 每一天怎么展开','<p class="muted">按已采集游戏日排列；同一天展示最后一次记录。未来日程按游玩展开，未采集的历史不拿今天的安排补齐。</p>'
        +(days.length?days.map(({line:day,stepId})=>'<article class="story-review-day"><span class="eyebrow">第 '+esc(day.day)+' 天 · 第 '+esc(day.activeChapter.ordinal)+' 章</span><h3>'+esc(day.activeChapter.dayCard.title)+'</h3><p>'+esc(day.activeChapter.dayCard.description)+'</p>'+field('今日方向',day.activeChapter.dayCard.focus)+field('当时的快捷草稿',day.activeChapter.suggestedInputs)+(stepId?'<button class="text-button" type="button" data-inspect-step="'+esc(stepId)+'">查看当时记录</button>':'<small class="muted">当前正式投影</small>')+'</article>').join(''):'<p class="muted">尚未采集日程。</p>'))
      +panel('story','05 · 玩家输入与实际剧情',steps.length?steps.map(step=>{
        const delivered=P?.deliveredForStep(result,step)||[];
        const input=step.input||step.execution?.payload||step.trace?.input;
        return '<article class="story-review-turn"><div class="section-heading"><h3>'+esc(step.title)+'</h3>'+V.badge(step.status)+'</div>'+field('我的输入',input?.body||input?.text||input)
          +(delivered.length?delivered.map(row=>'<blockquote><small>'+esc(row.author||'已保存正文')+'</small><p>'+esc(row.body)+'</p></blockquote>').join(''):'<p class="muted">该操作未采集到可关联的已保存正文。</p>')
          +field('后端记录的结果摘要',step.outcome?.narrativeSummary)+'<button class="text-button" type="button" data-inspect-step="'+esc(step.id)+'">判定依据与原始记录</button></article>';
      }).join(''):'<p class="muted">尚未执行玩家操作。先确认开局，再回到这里阅读。</p>')
      +panel('loops','06 · 伏笔与回收','<p class="notice">当前主线投影没有提供完整的伏笔台账，暂时不能判断是否全部回收。不能把“没有返回”显示成“没有伏笔”或“已经回收”。</p>'
        +steps.filter(step=>step.outcome?.narrativeEffects?.openLoopChanges?.length).map(step=>'<article>'+field('本次记录的伏笔变化',step.outcome.narrativeEffects.openLoopChanges)+'<button class="text-button" type="button" data-inspect-step="'+esc(step.id)+'">查看来源操作</button></article>').join(''))
      +panel('numbers','07 · 数值与剧情代价',field('本局能力',line?.selectedTalent?.skills)+field('未分配能力点',line?.abilityPoints)+field('当前运行节奏',line?.policy)
        +field('后端正式成长状态',result?.finalProjections?.current?.progression?.status==='succeeded'?result.finalProjections.current.progression.value:null)
        +'<p class="muted">以上只读本局后端数据。v0.5 表格的首测参数尚不等于当前运行配置；本页不自行计算或补发经验、关系与过章结果。</p>'
        +'<button class="button" type="button" data-page="play">回到游玩查看人物关系与继续操作</button>');
  }
  function render({draft,scenarios,characters,selectedScenarioId,busy,message,error,form={}}) {
    const map=characterMap(draft,characters), ids=arr(draft?.characterVersionIds);
    const defaultPlayer=[form.playerCharacterVersionId,state.variant?.form?.playerCharacterVersionId,state.baseline?.form?.playerCharacterVersionId,...ids].find(id=>ids.includes(id))||'';
    const defaultFollower=[form.firstFollowerCharacterVersionId,state.variant?.form?.firstFollowerCharacterVersionId,state.baseline?.form?.firstFollowerCharacterVersionId,...ids].find(id=>ids.includes(id)&&id!==defaultPlayer)||'';
    const followerIds=ids.filter(id=>id!==defaultPlayer);
    const active=state.active==='variant'?state.variant:state.baseline;
    const sandboxHtml=root.SliceChapterSandbox?root.SliceChapterSandbox.render(active||{title:draft?.title,result:{input:draft},form:{...form,playerCharacterVersionId:defaultPlayer,firstFollowerCharacterVersionId:defaultFollower}},busy,{scenarios}):'';
    const displayed=active||root.SliceChapterSandbox?.flowSnapshot();
    return '<div class="page-heading"><div><span class="eyebrow">SLICE / CHAPTER LAB</span><h1>章节实验</h1><p>单独测试“故事方向 → 当前章 → Conditions → Day Card → 快捷草稿”，用真实编译和真实章节生成比较不同剧本与人物。</p></div></div>'
      +'<div class="chapter-lab-layout"><aside class="panel chapter-lab-input"><h2>实验输入</h2>'
      +'<label>剧本<select id="chapter-lab-scenario"><option value="">请选择剧本</option>'+arr(scenarios).map(row=>'<option value="'+esc(row.id)+'"'+(row.id===selectedScenarioId?' selected':'')+'>'+esc(row.title||'未命名剧本')+'</option>').join('')+'</select></label>'
      +(!draft?'<p class="notice">先选择剧本。Chapter Lab 会创建实验副本，不修改已发布世界。</p>':
        '<label>玩家扮演人物<select id="chapter-lab-player">'+peopleOptions(draft,defaultPlayer,characters)+'</select></label>'
        +'<label>首位关联人物<select id="chapter-lab-follower">'+followerIds.map(id=>'<option value="'+esc(id)+'"'+(id===defaultFollower?' selected':'')+'>'+esc(map.get(id)?.displayName||'未返回人物名称')+'</option>').join('')+'</select></label>'
        +'<label>能力候选<select id="chapter-lab-talent"><option value=""'+(!form.talentChoiceId?' selected':'')+'>自动采用第 1 张候选</option><option value="first_1"'+(form.talentChoiceId==='first_1'?' selected':'')+'>第 1 张</option><option value="first_2"'+(form.talentChoiceId==='first_2'?' selected':'')+'>第 2 张</option><option value="first_3"'+(form.talentChoiceId==='first_3'?' selected':'')+'>第 3 张</option></select></label>'
        +'<label>变化版：改写整局目标<textarea id="chapter-lab-goal" rows="3" placeholder="留空沿用原目标">'+esc(form.goalOverride||'')+'</textarea></label>'
        +'<label>变化版：追加剧情改写<textarea id="chapter-lab-rewrite" rows="4" placeholder="例如：把通知矛盾改成剧社内部有人故意隐瞒安排。不会覆盖已发布世界，只写进实验副本。">'+esc(form.storyRewrite||'')+'</textarea></label>'
        +'<h3>变化版：额外加入现有人物</h3><div class="chapter-lab-checks">'+extras(draft,characters,form.extraCharacterVersionIds||[])+'</div>'
        +'<div class="chapter-lab-actions"><button id="chapter-lab-baseline" class="button" type="button"'+(busy?' disabled':'')+'>生成基线</button><button id="chapter-lab-variant" class="button primary" type="button"'+(busy?' disabled':'')+'>生成变化版</button></div>'
      )+(message?'<p class="notice">'+esc(message)+'</p>':'')+(error?'<p class="notice error">'+esc(error)+'</p>':'')
      +'<p class="muted">首版真实实验生成首章。后续章节从真实 Run 当前章读取；不伪造“跳到第 N 章”。</p></aside>'
      +'<main class="panel chapter-lab-main"><div class="chapter-lab-switch"><button type="button" data-chapter-lab-result="baseline" class="'+(state.active==='baseline'?'active':'')+'">基线</button><button type="button" data-chapter-lab-result="variant" class="'+(state.active==='variant'?'active':'')+'">变化版</button></div>'
      +(displayed?.isolated?'<p class="notice">当前展示：隔离实验结果</p>':'')+flow(displayed)+'</main>'
      +'<aside class="panel chapter-lab-detail"><h2>模块详情</h2>'+(displayed?stageDetail(displayed,state.selectedNode):'<p class="muted">生成一次章节实验后，点中间任何方框查看实际输入、Prompt 和输出。</p>')
      +'<div class="chapter-lab-metrics">'+costCard(displayed)+'</div></aside></div>'
      +'<section class="panel chapter-lab-compare"><div class="section-heading"><h2>基线 / 变化版字段 Diff</h2><span class="badge">只比较产品字段</span></div>'+diffHtml()+'</section>'
      +sandboxHtml;
  }

  if (root.document) {
    root.document.addEventListener('click',event=>{
      const button=event.target.closest('button'); if(!button)return;
      if(button.dataset.chapterLabNode){state.selectedNode=button.dataset.chapterLabNode;root.dispatchEvent(new CustomEvent('slice-chapter-lab-render'));return;}
      if(button.dataset.chapterLabResult){state.active=button.dataset.chapterLabResult;root.dispatchEvent(new CustomEvent('slice-chapter-lab-render'));return;}
    });
  }
  root.SliceChapterLab = Object.freeze({state,reset,render,renderReview,reviewDays,readForm,runExperiment,experimentInput,buildSnapshot,diff,mainline,chapter});
})(typeof window==='undefined'?globalThis:window);
