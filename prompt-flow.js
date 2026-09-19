/* Full product prompt map. Prompt text comes from authenticated backend builders, never a second UI template. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const S = { catalog: null, loading: false, error: '', selected: null, tab: 'input', branch: 'all', search: '', scale: .6, x: 22, y: 22, context: {}, drafts: {}, preview: null, workspace: null };
  const WIDTH = 2040, HEIGHT = 1570, CARD_W = 238, CARD_H = 116;
  const branches = {
    all: { label: '全部流程', ids: [] },
    opening: { label: '开局与再抽', ids: ['author','world_base','choose','birth','talent','talent_reroll','talent_confirm','chapter','first_draft','admission'] },
    social: { label: '发帖 → 评论 / DM', ids: ['admission','context','post','comment','reply','dm','private_pov','validate','repair','commit','delivery','short_offer','short_choice','clock','memory'] },
    activity: { label: '邀请 → 活动 → 退出', ids: ['delivery','invite_trigger','invite_decision','human_response','activity_open','activity_turn','activity_exit','validate','activity_commit','memory','expired_activity','human_control'] },
    immersion: { label: '剧情卡与生图', ids: ['delivery','story_card','story_image','snapshot','rewind','expired_activity','character_memory'] },
    chapter: { label: '换日与章节', ids: ['commit','clock','next_day','day','first_draft','settlement','next_chapter','chapter','world_end','frozen_dm','rewind'] },
    memory: { label: '记忆与回溯', ids: ['commit','memory','recall','private_pov','context','memory_batch','snapshot','rewind','unlock','agency'] },
  };
  const status = n => n.status === 'not_wired' ? '尚未接通' : n.status === 'partial' ? '部分接入' : n.kind === 'ai' ? 'AI 条件调用' : '程序处理';
  const point = n => ({ x: 28 + n.col * 282, y: 46 + n.lane * 189 });
  const byId = id => S.catalog?.nodes.find(n => n.id === id);
  const root = () => document.querySelector('#prompt-flow-root');
  const workspace = () => window.SliceEvalBackend.workspaceId();
  const storageKey = id => 'slice-prompt-draft:' + workspace() + ':' + id;
  function loadDraft(n) {
    if (S.drafts[n.id]) return S.drafts[n.id];
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(storageKey(n.id)) || 'null'); } catch (_) {}
    const base = n.prompt?.messages?.[0]?.content || n.draftInstruction || '';
    const value = stored && stored.nodeId === n.id && typeof stored.systemInstruction === 'string' && typeof stored.inputText === 'string' ? stored
      : { nodeId: n.id, baseSystemHash: n.prompt?.systemSha256 || null, systemInstruction: base, inputText: JSON.stringify(n.prompt?.input || {}, null, 2), savedAt: null };
    S.drafts[n.id] = value;
    return value;
  }
  function message(text, error = false) {
    const el = document.querySelector('#pf-message');
    if (el) { el.textContent = text; el.className = error ? 'pf-message error-text' : 'pf-message'; }
  }
  function capture() {
    const n = byId(S.selected); if (!n) return;
    const draft = loadDraft(n), input = document.querySelector('#pf-input'), system = document.querySelector('#pf-system');
    if (input) draft.inputText = input.value;
    if (system) draft.systemInstruction = system.value;
  }
  function render(context = {}) {
    S.context = context;
    const currentWorkspace = workspace();
    if (S.workspace !== currentWorkspace) { Object.assign(S, { workspace: currentWorkspace, catalog: null, drafts: {}, selected: null, preview: null, error: '' }); }
    setTimeout(mount, 0);
    return '<section id="prompt-flow-root" class="pf-root" aria-label="完整产品提示词流程"><div class="pf-loading">正在读取后端真实提示词目录…</div></section>';
  }
  async function mount() {
    if (!root()) return;
    if (S.catalog) { paint(); return; }
    if (S.loading) return;
    S.loading = true; const owner = workspace();
    try {
      const catalog = await window.SliceEvalConsoleClient.getPromptCatalog();
      if (owner !== workspace()) return;
      if (catalog?.schemaVersion !== 'slice.prompt-flow-catalog.v1') throw new Error('后端流程目录版本不受支持');
      S.catalog = catalog; S.error = ''; S.selected = null;
    } catch (error) { S.error = error.message; }
    finally { S.loading = false; if (root()) paint(); }
    if (S.catalog) fit();
  }
  function active(n) {
    const ids = branches[S.branch]?.ids || [];
    return (!ids.length || ids.includes(n.id)) && (!S.search || (n.title + ' ' + n.trigger + ' ' + n.inputs.join(' ') + ' ' + n.outputs.join(' ')).toLowerCase().includes(S.search.toLowerCase()));
  }
  function relatedIds() {
    const ids = new Set(S.selected ? [S.selected] : []);
    for (const e of S.catalog.edges) if (e.from === S.selected || e.to === S.selected) { ids.add(e.from); ids.add(e.to); }
    return ids;
  }
  function pathFor(edge) {
    const a = point(byId(edge.from)), b = point(byId(edge.to));
    if (edge.from === edge.to) return `M ${a.x+CARD_W} ${a.y+46} C ${a.x+CARD_W+65} ${a.y-38}, ${a.x+CARD_W+65} ${a.y+154}, ${a.x+CARD_W} ${a.y+94}`;
    if (b.x > a.x && Math.abs(b.y-a.y)<10) return `M ${a.x+CARD_W} ${a.y+58} C ${a.x+CARD_W+22} ${a.y+58}, ${b.x-22} ${b.y+58}, ${b.x} ${b.y+58}`;
    const startY = b.y >= a.y ? a.y + CARD_H : a.y;
    const endY = b.y >= a.y ? b.y : b.y + CARD_H;
    const mid = (startY+endY)/2;
    return `M ${a.x+CARD_W/2} ${startY} C ${a.x+CARD_W/2} ${mid}, ${b.x+CARD_W/2} ${mid}, ${b.x+CARD_W/2} ${endY}`;
  }
  function graph() {
    const near = relatedIds();
    const lines = S.catalog.edges.map(e => {
      const a = byId(e.from), b = byId(e.to), selected = e.from === S.selected || e.to === S.selected;
      return '<path d="'+pathFor(e)+'" class="pf-edge'+(selected?' selected':'')+((!active(a)||!active(b))?' dim':'')+((a.status==='not_wired'||b.status==='not_wired')?' pending':'')+'" marker-end="url(#pf-arrow)"><title>'+esc(a.title+' → '+b.title+'：'+e.label)+'</title></path>';
    }).join('');
    const labels = S.catalog.lanes.map((lane,i)=>'<div class="pf-lane" style="top:'+(i*189+13)+'px">'+esc(String(i+1).padStart(2,'0')+'  '+lane)+'</div>').join('');
    const cards = S.catalog.nodes.map(n=> { const p=point(n); return '<button type="button" data-pf-node="'+esc(n.id)+'" class="pf-node '+n.kind+(S.selected===n.id?' selected':'')+(S.selected&&near.has(n.id)?' neighbor':'')+(!active(n)?' dim':'')+'" style="left:'+p.x+'px;top:'+p.y+'px" aria-pressed="'+(S.selected===n.id)+'"><span class="pf-node-top"><span class="pf-kind">'+(n.kind==='ai'?'AI':n.kind==='gap'?'待接入':'程序')+'</span><small>'+esc(n.status==='partial'?'部分接入':n.kind==='ai'?'查看真实模板':'')+'</small></span><strong>'+esc(n.title)+'</strong><span class="pf-node-sub">'+esc(n.outputs[0])+'</span></button>'; }).join('');
    return '<div id="pf-viewport" class="pf-viewport" tabindex="0" aria-label="可缩放平移的产品画布"><div id="pf-stage" class="pf-stage" style="width:'+WIDTH+'px;height:'+HEIGHT+'px"><svg class="pf-links" viewBox="0 0 '+WIDTH+' '+HEIGHT+'" width="'+WIDTH+'" height="'+HEIGHT+'" aria-hidden="true"><defs><marker id="pf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>'+lines+'</svg>'+labels+cards+'</div><div class="pf-map" aria-hidden="true"><svg viewBox="0 0 '+WIDTH+' '+HEIGHT+'">'+S.catalog.nodes.map(n=>{const p=point(n);return '<rect x="'+p.x+'" y="'+p.y+'" width="'+CARD_W+'" height="'+CARD_H+'" class="'+(n.id===S.selected?'selected':'')+'"/>';}).join('')+'<rect id="pf-map-view" class="view"/></svg></div><div class="pf-help">拖动画布 · 触控板横向滚动 · Ctrl / ⌘ + 滚轮缩放 · 点击模块查看</div></div>';
  }
  function paint() {
    const el=root(); if (!el) return;
    if (!S.catalog) { el.innerHTML='<div class="pf-loading"><h2>提示词流程暂未读取</h2><p>'+esc(S.error || '正在读取…')+'</p><button class="button" type="button" data-pf-action="reload">重新读取</button></div>'; return; }
    el.innerHTML='<header class="pf-heading"><div><span class="eyebrow">PRODUCT / PROMPT FLOW</span><h1>从用户操作，到下一步输入</h1><p>'+S.catalog.nodes.length+' 个模块 · '+S.catalog.edges.length+' 条连线 · 后端模板版本 <code>'+esc(S.catalog.version)+'</code></p></div><div class="pf-heading-actions"><button class="button" type="button" data-pf-action="reload">刷新线上模板</button><button class="button" type="button" data-pf-action="export-all">导出完整流程</button></div></header>'
      +'<div class="pf-toolbar"><div class="pf-branches">'+Object.entries(branches).map(([id,b])=>'<button type="button" data-pf-branch="'+id+'" class="'+(S.branch===id?'active':'')+'">'+b.label+'</button>').join('')+'</div><div class="pf-controls"><input id="pf-search" type="search" placeholder="查找模块、输入或输出" aria-label="查找流程模块" value="'+esc(S.search)+'"/><button class="button" type="button" data-pf-action="out" aria-label="缩小">−</button><output id="pf-scale">'+Math.round(S.scale*100)+'%</output><button class="button" type="button" data-pf-action="in" aria-label="放大">＋</button><button class="button" type="button" data-pf-action="fit">全局适配</button></div></div>'
      +'<div class="pf-legend"><span><i class="ai"></i>AI：后端真实模板</span><span><i></i>程序：规则、校验或保存</span><span><i class="gap"></i>虚线：待接入 / 部分接入</span><span>草稿可编辑、保存并请求后端组装预览；不会自动改写线上提示词。</span></div>'
      +'<div class="pf-workspace'+(S.selected?' has-detail':'')+'">'+graph()+'<aside id="pf-detail" class="pf-detail"'+(S.selected?'':' hidden')+' aria-label="模块详情"></aside></div><div id="pf-message" class="pf-message" role="status" aria-live="polite"></div>';
    updateTransform(); bindViewport(); paintDetail();
  }
  const list = values => '<ul class="pf-list">'+values.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>';
  function transfer(e, incoming=false) {
    const other = byId(incoming?e.from:e.to);
    return '<div class="pf-transfer"><button type="button" data-pf-node="'+esc(other.id)+'">'+(incoming?'← ':'→ ')+esc(other.title)+'</button><p>'+esc(e.label)+' · '+esc(e.condition)+'</p><table><thead><tr><th>上一步输出</th><th>下一步输入</th></tr></thead><tbody>'+e.mapping.map(m=>'<tr><td>'+esc(m.output)+'</td><td>'+esc(m.input)+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function paintDetail() {
    const el=document.querySelector('#pf-detail'), n=byId(S.selected); if (!el||!n)return;
    const draft=loadDraft(n), incoming=S.catalog.edges.filter(e=>e.to===n.id), outgoing=S.catalog.edges.filter(e=>e.from===n.id);
    const stale=!!(draft.baseSystemHash && n.prompt?.systemSha256!==draft.baseSystemHash);
    let content='';
    if(S.tab==='input') content='<h3>什么时候发生</h3><p>'+esc(n.trigger)+'</p><h3>需要哪些输入</h3>'+list(n.inputs)+incoming.map(e=>transfer(e,true)).join('')
      +(n.prompt?'<div class="pf-editor-head"><h3>输入草稿</h3><button class="text-button" data-pf-action="fill-world" type="button">填入当前剧本</button></div><p class="muted">以下为可编辑示例。未经过正式业务校验，不会写入当前故事。</p><textarea id="pf-input" class="pf-json" spellcheck="false" aria-label="此模块输入JSON">'+esc(draft.inputText)+'</textarea>':'<p class="notice">这是'+(n.kind==='gap'?'尚未接通的环节':'程序步骤')+'，没有已接入的 AI 输入消息；规则与字段见上方。</p>');
    if(S.tab==='prompt') content=(n.prompt||n.draftInstruction?'<div class="pf-editor-head"><h3>'+(n.prompt?'System Prompt 草稿':'补全提示词草案（未接入运行）')+'</h3><button class="text-button" data-pf-action="reset" type="button">恢复原模板</button></div><p class="muted">'+esc(n.source || '产品流程补全草案')+'</p><textarea id="pf-system" class="pf-system" spellcheck="false" aria-label="此模块提示词">'+esc(draft.systemInstruction)+'</textarea>':'<h3>这里不调用语言模型</h3><p>这个环节由程序读取状态、检查权限或执行确定规则。不能通过在这里填一段提示词替代程序规则。</p>')
      +(n.prompt?'<details class="pf-source"><summary>查看未修改的后端模板与版本</summary><p class="mono">'+esc(n.prompt.systemSha256)+'</p><pre>'+esc(n.prompt.messages[0].content)+'</pre></details>':'');
    if(S.tab==='output') content='<h3>输出给谁、怎么使用</h3>'+list(n.outputs)+'<p>'+esc(n.nextUse)+'</p>'+outgoing.map(e=>transfer(e)).join('')+'<p class="notice">这里列出输出结构与去向，不把示例 JSON 当作已经产生的模型结果。</p>';
    if(S.tab==='request') content=S.preview?.nodeId===n.id?'<p class="notice">'+esc(S.preview.notice)+'</p><h3>后端重新组装的完整请求</h3><p>模型调用次数：0 · 状态写入：无 · '+(S.preview.draft?'包含你修改的提示词草稿':'当前后端模板')+'</p><pre class="pf-request">'+esc(JSON.stringify(S.preview.requestBody,null,2))+'</pre>':'<h3>完整请求与真实记录</h3><p>编辑输入或提示词后，点击“后端组装预览”，这里会返回该分支的完整 messages。</p><p>预览不调用模型，也不是某一次实际执行的证据。真实输入、输出、校验和保存结果请在“操作与诊断”按步骤查看。</p><button class="button" type="button" data-page="records">查看当前会话的真实记录</button>';
    el.innerHTML='<div class="pf-detail-head"><div><span class="eyebrow">'+esc(status(n))+'</span><h2>'+esc(n.title)+'</h2></div><button class="icon-button" data-pf-action="close" type="button" aria-label="关闭模块详情">×</button></div>'
      +(n.note?'<p class="pf-note">'+esc(n.note)+'</p>':'')+(stale?'<p class="pf-note">这个草稿基于旧模板，线上源码已变化。不会自动覆盖你的草稿；请对照原模板后再编辑。</p>':'')
      +'<div class="pf-tabs">'+[['input','输入与前序'],['prompt','提示词'],['output','输出与后续'],['request','完整请求']].map(([id,name])=>'<button type="button" data-pf-tab="'+id+'" class="'+(S.tab===id?'active':'')+'">'+name+'</button>').join('')+'</div>'
      +'<div class="pf-detail-body">'+content+'</div><footer class="pf-detail-footer">'+((n.prompt||n.draftInstruction)?'<button class="button" data-pf-action="save" type="button">保存本地草稿</button><button class="button" data-pf-action="export-node" type="button">导出</button>':'')+(n.prompt?'<button class="button primary" data-pf-action="preview" type="button">后端组装预览</button>':'')+'</footer>';
  }
  function updateTransform() {
    const stage=document.querySelector('#pf-stage'),viewport=document.querySelector('#pf-viewport');
    if(!stage||!viewport)return;
    stage.style.transform=`translate(${S.x}px,${S.y}px) scale(${S.scale})`;
    const scale=document.querySelector('#pf-scale'); if(scale)scale.textContent=Math.round(S.scale*100)+'%';
    const view=document.querySelector('#pf-map-view');if(view){view.setAttribute('x',-S.x/S.scale);view.setAttribute('y',-S.y/S.scale);view.setAttribute('width',viewport.clientWidth/S.scale);view.setAttribute('height',viewport.clientHeight/S.scale);}
  }
  function fit() {
    const vp=document.querySelector('#pf-viewport');if(!vp)return;
    S.scale=Math.min((vp.clientWidth-36)/WIDTH,(vp.clientHeight-54)/HEIGHT,1);S.scale=Math.max(.18,S.scale);S.x=(vp.clientWidth-WIDTH*S.scale)/2;S.y=18;updateTransform();
  }
  function zoom(factor,cx,cy) {
    const vp=document.querySelector('#pf-viewport');if(!vp)return;
    const x=cx??vp.clientWidth/2,y=cy??vp.clientHeight/2,next=Math.min(2,Math.max(.18,S.scale*factor));
    S.x=x-(x-S.x)*next/S.scale;S.y=y-(y-S.y)*next/S.scale;S.scale=next;updateTransform();
  }
  function bindViewport() {
    const vp=document.querySelector('#pf-viewport');if(!vp)return;let drag=null;
    vp.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.button!==0)return;drag={x:e.clientX,y:e.clientY,sx:S.x,sy:S.y,id:e.pointerId};vp.setPointerCapture(e.pointerId);vp.classList.add('dragging');});
    vp.addEventListener('pointermove',e=>{if(!drag)return;S.x=drag.sx+e.clientX-drag.x;S.y=drag.sy+e.clientY-drag.y;updateTransform();});
    const end=()=>{drag=null;vp.classList.remove('dragging');};vp.addEventListener('pointerup',end);vp.addEventListener('pointercancel',end);
    vp.addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey||e.metaKey){const r=vp.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.005),e.clientX-r.left,e.clientY-r.top);}else{S.x-=e.deltaX;S.y-=e.deltaY;updateTransform();}},{passive:false});
    vp.addEventListener('keydown',e=>{if(e.target!==vp)return;const d={ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]}[e.key];if(d){e.preventDefault();S.x+=d[0];S.y+=d[1];updateTransform();}if(e.key==='0')fit();});
  }
  function download(name,value) { const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function fillWorld() {
    const n=byId(S.selected),draft=loadDraft(n),world=S.context.draft;
    if(!world){message('请先在“剧本与创作”选择一套剧本。',true);return;}
    let value;try{value=JSON.parse(draft.inputText);}catch{message('输入不是合法 JSON，先修正后再填入剧本。',true);return;}
    const core={title:world.title,description:world.description,setting:world.setting,goal:world.goal};
    const characters=world.characters||[];
    const player=characters.find(c=>c.characterVersionId===S.context.selectedPlayerCharacterVersionId)||characters[0];
    const first=characters.find(c=>c.characterVersionId===S.context.selectedFirstFollowerCharacterVersionId)||characters.find(c=>c!==player);
    const card=c=>c?{name:c.displayName,...clone(c.content||{}),actorId:'示例身份:'+c.displayName}:{};
    if(value.stablePrefix){value.stablePrefix.gameConfig={...(value.stablePrefix.gameConfig||{}),world:core};value.stablePrefix.castBindingSnapshots=characters.map(card);}
    else {value.world=core;if(n.id==='birth'){value.selectedPlayer=card(player);value.initialLinkedCharacter=card(first);}else{value.player=card(player);value.activeCharacters=characters.filter(c=>c!==player).map(card);}}
    draft.inputText=JSON.stringify(value,null,2);paintDetail();message('已填入当前剧本与人物原文。actorId 明确标为示例；这不是正在游玩会话的权限快照。');
  }
  async function action(name) {
    capture();const n=byId(S.selected);
    if(name==='close'){S.selected=null;S.preview=null;paint();return;}
    if(name==='in'){zoom(1.2);return;}if(name==='out'){zoom(1/1.2);return;}if(name==='fit'){fit();return;}
    if(name==='reload'){S.catalog=null;S.error='';S.preview=null;await mount();return;}
    if(name==='export-all'){download('Slice_完整提示词流程_'+S.catalog.version+'.json',{catalog:S.catalog,localDrafts:S.drafts,exportedAt:new Date().toISOString(),appliedToRuntime:false});return;}
    if(!n)return;const draft=loadDraft(n);
    if(name==='fill-world'){fillWorld();return;}
    if(name==='save'){try{draft.savedAt=new Date().toISOString();localStorage.setItem(storageKey(n.id),JSON.stringify(draft));message('草稿已保存在当前浏览器、当前工作区。尚未替换线上提示词。');}catch{message('本地存储不可用，请使用导出保存草稿。',true);}return;}
    if(name==='export-node'){download('Slice_Prompt_'+n.id+'.json',{catalogVersion:S.catalog.version,node:n,draft,preview:S.preview?.nodeId===n.id?S.preview:null,appliedToRuntime:false});return;}
    if(name==='reset'){draft.systemInstruction=n.prompt?.messages[0].content||n.draftInstruction||'';draft.baseSystemHash=n.prompt?.systemSha256||null;S.preview=null;paintDetail();message('已恢复当前后端模板；输入草稿保持不变。点击保存可更新本地草稿。');return;}
    if(name==='preview'){
      let input;try{input=JSON.parse(draft.inputText);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error();}catch{message('输入必须是合法 JSON 对象。',true);return;}
      const button=document.querySelector('[data-pf-action="preview"]');if(button)button.disabled=true;
      message('正在通过真实后端组装这个分支的请求（不调用模型）…');
      try{const result=await window.SliceEvalConsoleClient.previewPromptRequest({nodeId:n.id,input,...(draft.systemInstruction!==n.prompt.messages[0].content?{systemInstruction:draft.systemInstruction}:{})});S.preview=result;if(S.selected===n.id){S.tab='request';paintDetail();}message('后端组装完成：0 次模型调用，0 次故事状态写入。');}
      catch(error){message(error.message,true);if(button)button.disabled=false;}
    }
  }
  document.addEventListener('click',event=>{
    if(!event.target.closest('#prompt-flow-root'))return;
    const n=event.target.closest('[data-pf-node]'),branch=event.target.closest('[data-pf-branch]'),tab=event.target.closest('[data-pf-tab]'),a=event.target.closest('[data-pf-action]');
    if(n){capture();S.selected=n.dataset.pfNode;S.tab='input';S.preview=null;paint();return;}
    if(branch){capture();S.branch=branch.dataset.pfBranch;paint();return;}
    if(tab){capture();S.tab=tab.dataset.pfTab;paintDetail();return;}
    if(a){event.preventDefault();action(a.dataset.pfAction).catch(error=>message(error.message,true));}
  });
  document.addEventListener('input',event=>{if(event.target.id==='pf-search'){S.search=event.target.value;document.querySelectorAll('[data-pf-node].pf-node').forEach(el=>el.classList.toggle('dim',!active(byId(el.dataset.pfNode))));}if(event.target.id==='pf-input'||event.target.id==='pf-system'){capture();S.preview=null;}});
  window.SlicePromptFlow={render,load:mount,getState:()=>({version:S.catalog?.version,nodes:S.catalog?.nodes.length,selected:S.selected,scale:S.scale,branch:S.branch})};
})();
