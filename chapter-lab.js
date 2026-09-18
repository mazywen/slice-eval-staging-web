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
    input.characterVersionIds = [...ids].slice(0, 8);
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
    const choiceId = form.talentChoiceId && arr(line.talentCandidates).some(row => row.choiceId === form.talentChoiceId)
      ? form.talentChoiceId : line.talentCandidates[0].choiceId;
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
    push('question','核心问题',a.chapter?.nextQuestion,b.chapter?.nextQuestion);
    push('conditions','Conditions',a.conditions,b.conditions);
    push('day','Day Card',a.dayCard,b.dayCard);
    push('suggestions','快捷草稿',a.suggestions,b.suggestions);
    const ac=new Set(a.conditions.map(conditionKey)), bc=new Set(b.conditions.map(conditionKey));
    rows.push({field:'condition_delta',label:'条件变化',left:a.conditions.filter(row=>!bc.has(conditionKey(row))),right:b.conditions.filter(row=>!ac.has(conditionKey(row))),changed:true});
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
      settlement:{title:'判定与章末规则',input:{conditions:snapshot.conditions},output:{rule:'行动过程中更新相关条件；数值由程序比较；事实条件由正式结果证据确认；章末统一检查全部条件。',currentState:snapshot.chapter?.conditionState || null}},
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
  function render({draft,scenarios,characters,selectedScenarioId,busy,message,error,form={}}) {
    const map=characterMap(draft,characters), ids=arr(draft?.characterVersionIds);
    const defaultPlayer=form.playerCharacterVersionId || state.variant?.form?.playerCharacterVersionId || state.baseline?.form?.playerCharacterVersionId || ids[0] || '';
    const defaultFollower=form.firstFollowerCharacterVersionId || state.variant?.form?.firstFollowerCharacterVersionId || state.baseline?.form?.firstFollowerCharacterVersionId || ids.find(id=>id!==defaultPlayer) || '';
    const followerIds=ids.filter(id=>id!==defaultPlayer);
    const active=state.active==='variant'?state.variant:state.baseline;
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
      +flow(active)+'</main>'
      +'<aside class="panel chapter-lab-detail"><h2>模块详情</h2>'+(active?stageDetail(active,state.selectedNode):'<p class="muted">生成一次章节实验后，点中间任何方框查看实际输入、Prompt 和输出。</p>')
      +'<div class="chapter-lab-metrics">'+costCard(active)+'</div></aside></div>'
      +'<section class="panel chapter-lab-compare"><div class="section-heading"><h2>基线 / 变化版字段 Diff</h2><span class="badge">只比较产品字段</span></div>'+diffHtml()+'</section>';
  }

  if (root.document) {
    root.document.addEventListener('click',event=>{
      const button=event.target.closest('button'); if(!button)return;
      if(button.dataset.chapterLabNode){state.selectedNode=button.dataset.chapterLabNode;root.dispatchEvent(new CustomEvent('slice-chapter-lab-render'));return;}
      if(button.dataset.chapterLabResult){state.active=button.dataset.chapterLabResult;root.dispatchEvent(new CustomEvent('slice-chapter-lab-render'));return;}
    });
  }
  root.SliceChapterLab = Object.freeze({state,reset,render,readForm,runExperiment,experimentInput,buildSnapshot,diff,mainline,chapter});
})(typeof window==='undefined'?globalThis:window);
