/* Read-only assembly inspector. Every observed value comes from Eval evidence. */
(function (root) {
  'use strict';
  const array = value => Array.isArray(value) ? value : [];
  const text = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const names = {
    stablePrefix: '固定基础', dynamicTail: '本次变化', world: '这个世界', worldBase: '世界基础',
    worldCore: '作者原始世界', gameConfig: '本次玩法约束', characters: '人物设定', actors: '场内人物',
    activeChapter: '当前章节', chapter: '章节', chapterDirective: '本章判断依据',
    memoryContext: '选入的记忆', sharedContext: '共同可用记忆', privatePovHints: '人物可表达的信息',
    participantScopedRecall: '当前对话原话', command: '这次玩家输入', directive: '本次生成安排',
    run: '本局锚点', player: '玩家扮演的角色', selectedPlayer: '玩家身份',
    firstOutcome: '此前实际结果', currentSituation: '眼前处境', dayCard: '当日日程',
    stageDesignAssistance: '当前阶段写作参考', threadContext: '正在继续的对话',
    summary: '已整理经历', relationships: '当前人物关系', skills: '当前三项能力',
    system: '身份、目标与输出要求', user: '提供给模型的材料', assistant: '已有模型原话',
  };

  function parseJson(value) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch (_) { return value; }
  }

  function requestBlocks(call) {
    const body = call?.requestEvidence?.requestBody;
    if (!body || !Array.isArray(body.messages)) return null;
    const blocks = [];
    body.messages.forEach((message, index) => {
      const prefix = `messages[${index}].${message.role || 'unknown'}`;
      const parsed = parseJson(message.content);
      // Preserve provider order. This is a display decomposition, not a new request.
      if (message.role === 'user' && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed).forEach(([key, value]) => {
          if (['stablePrefix', 'dynamicTail'].includes(key) && value && typeof value === 'object' && !Array.isArray(value)) {
            Object.entries(value).forEach(([child, data]) => blocks.push({
              path: `${prefix}.${key}.${child}`, title: names[child] || child,
              group: key, value: data, exact: false,
            }));
          } else blocks.push({ path: `${prefix}.${key}`, title: names[key] || key,
            group: key, value, exact: false });
        });
      } else blocks.push({ path: prefix, title: names[message.role] || message.role || '消息',
        group: message.role === 'system' ? 'system' : 'conversation', value: message.content, exact: true });
    });
    return blocks;
  }

  function diffBlocks(current, previous) {
    const before = new Map(array(previous).map(block => [block.path, block]));
    const now = array(current).map(block => {
      const prior = before.get(block.path); before.delete(block.path);
      return { ...block, state: previous == null ? 'first' : !prior ? 'added'
        : text(prior.value) === text(block.value) ? 'same' : 'changed',
        previous: prior?.value, chars: [...String(text(block.value) ?? '')].length,
        previousChars: prior ? [...String(text(prior.value) ?? '')].length : null };
    });
    return [...now, ...[...before.values()].map(block => ({ ...block, state: 'removed', chars: 0,
      previous: block.value, previousChars: [...String(text(block.value) ?? '')].length }))];
  }

  function identity(call) {
    const input = call?.engineeringInput || {};
    const role = input.actor?.actorId || input.actorId || '';
    const command = input.dynamicTail?.command || input.command || {};
    return [call?.stage || call?.trigger?.useCase || '', call?.model || '', role,
      command.type || '', command.channelId || ''].join('|');
  }

  function priorCall(result, step, call, view) {
    const steps = view.steps(result);
    const boundary = steps.findIndex(row => row.id === step?.id);
    if (boundary < 0) return null;
    const earlier = steps.slice(0, boundary).flatMap(row => view.callsFor(result, row));
    return earlier.reverse().find(row => row.callRef !== call.callRef && identity(row) === identity(call)
      && requestBlocks(row) !== null) || null;
  }

  function overlaps(calls) {
    const intervals = array(calls).map(call => {
      const start = call.providerStartedAt || call.startedAt;
      const end = call.providerCompletedAt || call.completedAt;
      if (typeof start !== 'string' || typeof end !== 'string'
          || !/(Z|[+-]\d\d:\d\d)$/.test(start) || !/(Z|[+-]\d\d:\d\d)$/.test(end)) return null;
      const a = Date.parse(start), b = Date.parse(end);
      return Number.isFinite(a) && Number.isFinite(b) && b >= a ? { id: call.callRef, a, b } : null;
    });
    if (!intervals.length || intervals.some(row => row === null)) return null;
    const points = intervals.flatMap(row => [{ time: row.a, delta: 1 }, { time: row.b, delta: -1 }])
      .sort((a, b) => a.time - b.time || a.delta - b.delta);
    let active = 0, peak = 0;
    points.forEach(point => { active += point.delta; peak = Math.max(peak, active); });
    return { peak, note: '由已采集调用起止时间观察重叠；不是模型内部并行度。' };
  }

  function node(title, value, options = {}) {
    const { state = '', children = '', note = '', open = false } = options;
    const missing = value === undefined || value === null;
    return `<details class="pw-node ${esc(state)}"${open ? ' open' : ''}>
      <summary><span class="pw-dot" aria-hidden="true"></span><strong>${esc(title)}</strong>
      ${state ? `<small class="pw-tag">${esc({ added: '新增', changed: '变化', same: '复用', removed: '移出', first: '首次观察', read: '读取证据', write: '写入证据' }[state] || state)}</small>` : ''}</summary>
      <div class="pw-node-body">${note ? `<p class="pw-note">${esc(note)}</p>` : ''}
      ${children || (missing ? '<p class="pw-missing">未采集</p>' : `<pre>${esc(text(value))}</pre>`)}</div></details>`;
  }

  function renderedCall(result, step, call, view) {
    const previous = priorCall(result, step, call, view);
    const blocks = requestBlocks(call);
    const compared = diffBlocks(blocks, previous ? requestBlocks(previous) : null);
    const body = call.requestEvidence?.requestBody;
    const groupNames = { system: '① 身份与任务', stablePrefix: '② 固定基础', dynamicTail: '③ 当前事实与输入', conversation: '对话窗口' };
    const groups = new Map();
    compared.forEach(block => { if (!groups.has(block.group)) groups.set(block.group, []); groups.get(block.group).push(block); });
    const tree = [...groups].map(([key, rows]) => node(groupNames[key] || names[key] || key, null, {
      open: true, children: rows.map(block => node(block.title, block.value, {
        state: block.state,
        note: `${block.path} · 展示 ${block.chars} 字符${block.previousChars === null ? '' : ` / 上次 ${block.previousChars} 字符`}；字符数不等于 Token。`,
        children: block.state === 'changed'
          ? `<div class="pw-comparison"><div><small>这次</small><pre>${esc(text(block.value))}</pre></div><div><small>上次同类调用</small><pre>${esc(text(block.previous))}</pre></div></div>` : '',
      })).join(''),
    })).join('');
    const latency = call.providerLatencyMs ?? call.latencyMs;
    return node(`${call.stage || call.trigger?.useCase || '模型调用'} · ${call.model || '模型未采集'}`, null, {
      open: true,
      note: `${call.callRef || '调用编号未采集'} · ${view.label(call.status)} · ${view.duration(latency)}${previous ? ` · 对比 ${previous.callRef}` : ' · 尚无同类前次请求'}`,
      children: node('触发与实际参数', { trigger: call.trigger,
        parameters: body ? Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'messages')) : null })
        + (blocks === null ? '<p class="pw-missing">尚未取得这次请求的最终 Prompt；没有用工程输入冒充实际请求。</p>' : tree)
        + node('实际发送的完整 messages（原顺序）', body?.messages,
          { note: '上方按字段拆开便于阅读；这里保留实际请求消息和内容。' })
        + node('模型返回的字段与原始正文', call.rawAiOutput)
        + node('后端归一化、校验和修复', { processing: call.serverProcessing, repair: call.repair })
        + view.usageHtml(view.usage([call])),
    });
  }

  function operationTree(result, step, view) {
    if (!step) return '<p class="pw-missing">开始编译或进行一次操作后，这里显示实际执行记录。</p>';
    const outcome = step.outcome || {}, debug = outcome.debugEvidence || {};
    const memory = debug.memory || {};
    const input = debug.modelInput || {};
    const calls = view.callsFor(result, step);
    const timing = overlaps(calls);
    const counts = outcome.writeCounts;
    const destinations = counts && typeof counts === 'object'
      ? Object.fromEntries(Object.entries(counts).filter(([key]) => /memory|knowledge|episode|belief|graph|content|relationship/i.test(key))) : null;
    return `<div class="pw-flow" aria-label="本次后端执行树">
      ${node('1 · 收到玩家操作', step.trace?.input || step.input || step.execution?.payload, { open: true })}
      ${node('2 · 读取同一世界与当前视角', null, { open: true, state: 'read', children:
        node('世界、当前人物和章节快照', input.stablePrefix || input.world || input.run)
        + node('实际召回计划', memory.retrievalPlan || debug.engineering?.retrievalPlan)
        + node('合格记忆与权限、预算筛选', memory.sharedContext || memory.retrievalDiagnostics || outcome.memoryEvidence)
        + node('角色 POV 与图记忆', { schedule: memory.privatePovSchedule, contexts: memory.evalDebug?.privatePovContexts,
          shared: memory.sharedContext, selectedActorIds: memory.responderActorIds,
          graphActive: memory.graphRetrievalActive, vectorActive: memory.vectorRetrievalActive })
        + node('当前对话窗口', input.command?.threadContext || input.threadContext || input.participantScopedRecall)
        + node('本次输入装配清单', debug.engineering?.contextManifest) })}
      ${node('3 · Prompt 装配与实际模型调用', null, { open: true, children:
        `<p class="pw-note">${calls.length ? `已观察 ${calls.length} 次调用` : '调用数量以底部采集覆盖为准'} · ${timing ? `最大重叠 ${timing.peak} 路（按调用起止时间）` : '并行起止时间未完整采集'}。展开模块查看内容；增减标记是文本比较，不代表缓存命中。</p>`
        + calls.map(call => renderedCall(result, step, call, view)).join('')
        + (!calls.length ? '<p class="pw-missing">这个步骤没有可展示的 Provider 请求。程序步骤和未采集调用以原始证据区分。</p>' : '') })}
      ${node('4 · 确认事实、数值和剧情进度', { status: step.status, candidate: debug.modelCandidate,
        finalizer: debug.authorityBoundProposal, chapterSettlement: outcome.chapterSettlement,
        conditions: outcome.gameplayEvidence?.chapter, timings: outcome.stageTimings || debug.stageTimings })}
      ${node('5 · 保存结果并回填下一轮', null, { open: true, state: 'write', children:
        node('实际写入计数', destinations, { note: '采用后端写入计数；模型提出的 memoryFacts 仍是候选。' })
        + node('记忆写入、跳过与去重', memory.writeDiagnostics || outcome.gameplayEvidence?.memoryWriteDiagnostics)
        + node('正式结果与落库内容', outcome.gameplayEvidence || step.output)
        + node('会话批量提取与摘要覆盖点', outcome.gameplayEvidence?.sceneMemoryCheckpoint,
          { note: '这一项需要后端会话记忆检查点证据。缺失时不表示已在离开私聊后完成摘要。' }) })}
    </div>`;
  }

  function footer(result, step, view) {
    const usage = step ? view.stepUsage(result, step) : view.usage([]);
    const ratio = finite(usage.cacheHit) && finite(usage.cacheMiss) && usage.cacheHit + usage.cacheMiss > 0
      ? (usage.cacheHit / (usage.cacheHit + usage.cacheMiss) * 100).toFixed(1) + '%' : '未采集';
    return `<section class="pw-footer" aria-label="本次耗时、费用与缓存">
      <div class="pw-footer-heading"><strong>本次操作 · ${esc(step?.title || '等待操作')}</strong>
      <span>操作等待 ${esc(view.duration(step?.durationMs ?? step?.execution?.durationMs))}</span>
      <span>KV 输入命中 ${esc(ratio)}</span></div>
      ${view.usageHtml(usage)}
      <details><summary>本局已采集调用合计</summary>${view.usageHtml(view.usage(view.allCalls(result)))}</details>
      <p class="pw-note">人民币 Token 估算与账本分开。重试计入；未返回的费用保持未知。模型各阶段时长不相加冒充操作等待。</p>
    </section>`;
  }

  function render(result, selected, gameplay, view) {
    const history = view.steps(result);
    const step = history.find(row => row.id === selected?.id) || history.at(-1);
    return `<div class="pw-workbench">
      <section class="pw-inspector" aria-label="后端提示词装配树">
        <div class="pw-heading"><div><small>BACKEND / 存 · 取 · 用</small><h2>这一轮，模型实际看到了什么</h2></div><span class="badge">真实 Trace</span></div>
        <label class="pw-history">对照哪次操作<select id="pw-step-select" aria-label="选择要查看的操作">
          <option value="__latest__"${!selected ? ' selected' : ''}>跟随最新操作</option>
          ${history.map(row => `<option value="${esc(row.id)}"${selected?.id === row.id ? ' selected' : ''}>${esc(row.title)} · ${esc(row.commandId?.slice(0, 8) || row.id)}</option>`).join('')}
        </select></label>
        <p class="pw-note">左侧只读后端证据；右侧操作复用正式 Eval 客户端。新会话摘要策略尚未接入时，旧链实际行为仍如实显示。</p>
        ${operationTree(result, step, view)}
      </section>
      <section class="pw-player" aria-label="玩家操作区"><div class="pw-heading"><div><small>PLAYER / 实际游玩</small><h2>在这里继续故事</h2></div></div>${gameplay}</section>
    </div>${footer(result, step, view)}`;
  }

  const api = Object.freeze({ requestBlocks, diffBlocks, identity, priorCall, overlaps, node, operationTree, footer, render });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlicePromptWorkbench = api;
})(typeof window !== 'undefined' ? window : globalThis);
