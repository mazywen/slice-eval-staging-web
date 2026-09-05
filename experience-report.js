/* Read-only presentation of authoritative Eval evidence. No provider calls or inferred writes. */
(function (root) {
  'use strict';
  const tracks = [{ key: 'current', code: 'current', label: 'Current' }, { key: 'v2Candidate', code: 'v2_candidate', label: 'V2 Candidate' }];
  const array = (value) => Array.isArray(value) ? value : [];
  const items = (value) => array(value?.items);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const labels = { xp: '经验', level: '等级', affinity: '好感度', trust: '信任', intimacy: '亲密度', respect: '尊重', value: '数值', tension: '张力', followerCount: '粉丝', score: '分数', progress: '进度', statValue: '数值', currentValue: '当前值', totalXp: '总经验' };
  const narrative = { OPENING_HOOK: '开场钩子', BOND: '关系推进', INVESTIGATE: '调查', NEGOTIATE: '协商', PUBLIC_CHALLENGE: '公开挑战', PRIVATE_TEST: '私下试探', COMPLICATION: '矛盾升级', REVEAL: '揭示', REVERSAL: '反转', BETRAYAL: '背叛', RESCUE: '救援', REUNION: '重逢', BREAKTHROUGH: '突破', CRISIS_CHOICE: '危机抉择', AFTERMATH: '余波', RECOVERY: '恢复', ENDING_GATE: '结局条件', EPILOGUE: '尾声' };
  const tension = { QUIET: '平静', BUILD: '铺垫', PRESSURE: '施压', PEAK: '高潮', RELEASE: '释放', RECOVERY: '恢复' };
  const status = { running: '执行中', completed: '已完成', completed_with_issues: '完成，有问题', stopped: '已停止', failed: '失败', applied: '已生效', rejected: '被拒绝', succeeded: '成功', queued: '排队中' };
  function duration(ms) { return number(ms) === null ? '未回传' : ms < 1000 ? `${Math.round(ms)} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)}m ${Math.round(ms % 60000 / 1000)}s`; }
  function uniqueCalls(calls) {
    const seen = new Set();
    return array(calls).filter((call) => {
      if (!call || typeof call !== 'object') return false;
      if (!call.callRef) return true;
      if (seen.has(call.callRef)) return false;
      seen.add(call.callRef); return true;
    });
  }
  function usage(calls) {
    const rows = uniqueCalls(calls);
    const sum = (key) => !rows.length || rows.some((row) => number(row[key]) === null) ? null : rows.reduce((total, row) => total + row[key], 0);
    const cost = new Map();
    let unknownCost = !rows.length;
    for (const row of rows) {
      if (!row.currency || number(row.costMinor) === null) { unknownCost = true; continue; }
      cost.set(row.currency, (cost.get(row.currency) || 0) + row.costMinor);
    }
    return { count: rows.length, input: sum('inputTokens'), output: sum('outputTokens'), latencyMs: sum('latencyMs'), cost: [...cost].map(([currency, minor]) => `${currency} ${(minor / 100).toFixed(2)}`).join(' + '), unknownCost };
  }
  function traceTrack(result, track) { return array(result?.trace?.tracks).find((item) => item.trackCode === track.code); }
  function traceCommand(result, track, execution) {
    const id = execution?.command?.commandId || execution?.accepted?.commandId;
    return id ? array(traceTrack(result, track)?.runtimeCommands).find((item) => item.commandId === id) : null;
  }
  function actorNames(result, track, execution) {
    const names = new Map();
    for (const item of array(result?.input?.characters)) names.set(item.characterVersionId, item.displayName);
    const preview = result?.previewRuns?.[track.key];
    const player = array(preview?.actorStates).find((item) => item.kind === 'player');
    if (player) names.set(player.actorId, preview?.identitySnapshot?.displayName || '玩家');
    for (const item of array(execution?.projections?.stats?.value?.skills)) names.set(item.skillId, item.name || item.skillId);
    for (const item of array(result?.previewRuns?.[track.key]?.castSnapshot?.entries)) names.set(item.actorId, item.displayName || names.get(item.characterVersionId) || item.actorId);
    for (const item of items(execution?.projections?.cast?.value)) names.set(item.actorId, item.displayName || names.get(item.actorId) || item.actorId);
    for (const item of [...items(execution?.projectionsBefore?.relationships?.value), ...items(execution?.projections?.relationships?.value)]) {
      if (item.edgeId) names.set(item.edgeId, `${names.get(item.fromActorId) || item.fromActorId} → ${names.get(item.toActorId) || item.toActorId}`);
    }
    return names;
  }
  function numericValues(value, path = '', result = new Map()) {
    if (number(value) !== null) { result.set(path, value); return result; }
    if (!value || typeof value !== 'object') return result;
    if (Array.isArray(value)) {
      for (const item of value) {
        // Stable identities prevent array reorder from creating false relationship/stat changes.
        const skill = item?.skillId || item?.skillCode || (path.endsWith('skills') ? item?.code || item?.key : null);
        const key = skill ? `${item?.actorId ? `${item.actorId}.` : ''}${skill}`
          : item?.edgeId || item?.relationshipId || item?.key || item?.statCode || item?.statId || item?.code || item?.actorId || item?.id || item?.milestoneId;
        if (key) numericValues(item, `${path}.${key}`, result);
      }
    } else for (const [key, child] of Object.entries(value)) {
      if (/^(revision|resultingRevision|axesSchemaVersion|schemaVersion|pageInfo|createdAt|updatedAt|.*Id|.*Ids|.*Ms)$/u.test(key)) continue;
      numericValues(child, path ? `${path}.${key}` : key, result);
    }
    return result;
  }
  function stateDiff(before, after) {
    const changes = [], gaps = [];
    for (const scope of ['stats', 'progression', 'relationships']) {
      if (before?.[scope]?.status !== 'succeeded' || after?.[scope]?.status !== 'succeeded') { gaps.push(scope); continue; }
      const left = numericValues(before[scope].value), right = numericValues(after[scope].value);
      for (const [path, value] of right) {
        const old = left.has(path) ? left.get(path) : null;
        if (old !== value) changes.push({ scope, path, before: old, after: value, delta: old === null ? null : value - old });
      }
    }
    return { changes, gaps };
  }
  function incomplete(projection) {
    return projection?.status !== 'succeeded' || Boolean(projection?.value?.truncated || projection?.value?.pageInfo?.hasMore || projection?.value?.pageInfo?.nextCursor);
  }
  function flattenSurface(projections, scope) {
    if (scope === 'feed') return items(projections?.feed?.value);
    if (scope === 'replies') return items(projections?.replies?.value).flatMap((page) => items(page.value));
    if (scope === 'dmThreads') return items(projections?.dmThreads?.value).flatMap((page) => items(page.value).map((message) => ({ ...message, channelId: page.channelId })));
    return [];
  }
  function surfaceChanges(before, after) {
    const rows = [], gaps = [];
    for (const [scope, label, id] of [['feed', '帖子', 'postId'], ['replies', '评论', 'replyId'], ['dmThreads', '私聊', 'messageId']]) {
      if (incomplete(before?.[scope]) || incomplete(after?.[scope]) || items(after?.[scope]?.value).some((page) => page?.status && incomplete(page))) gaps.push(label);
      const seen = new Set(flattenSurface(before, scope).map((row) => row[id]).filter(Boolean));
      for (const row of flattenSurface(after, scope)) {
        if (!row[id] || seen.has(row[id])) continue;
        rows.push({ ...row, surface: label, isDelta: before?.[scope]?.status === 'succeeded', actorId: row.author?.actorId || row.senderActorId || row.actorId, displayName: row.author?.displayName || row.sender?.displayName || row.displayName, text: row.text || row.body || '' });
      }
    }
    return { rows, gaps };
  }
  function entityChanges(before, after) {
    const rows = [], gaps = [];
    for (const [scope, label, key] of [['events', '事件', 'eventId'], ['activities', '活动', 'activityId'], ['milestones', '里程碑', 'milestoneId']]) {
      if (incomplete(before?.[scope]) || incomplete(after?.[scope])) gaps.push(label);
      const prior = new Map(items(before?.[scope]?.value).map((row) => [row[key], row]));
      for (const row of items(after?.[scope]?.value)) {
        if (!row[key] || JSON.stringify(prior.get(row[key])) === JSON.stringify(row)) continue;
        rows.push({ scope, label, row, previous: prior.get(row[key]) || null,
          isDelta: !incomplete(before?.[scope]) && !incomplete(after?.[scope]) });
      }
    }
    return { rows, gaps };
  }
  function entitiesHtml(changes) {
    return changes.rows.map(({ label, row, previous, isDelta }) => `<article class="experience-message"><div><span>${label}</span><strong>${esc(row.title || '未回传标题')}</strong><small>${isDelta ? previous ? '本轮更新' : '本轮新增' : '已观测，缺少可比基线'}</small></div><p>${esc(row.setup || row.description || '')}</p>${row.objective ? `<p>目标：${esc(row.objective)}</p>` : ''}<small>状态：${esc([previous?.state, row.state, row.resolution].filter(Boolean).join(' → ') || '未回传')}</small>${row.currentTurn !== undefined ? `<p>回合 ${esc(row.currentTurn)} / ${esc(row.maxTurns ?? '未回传')}</p>` : ''}${array(row.choices).length ? `<ol>${row.choices.map((choice) => `<li>${esc(typeof choice === 'string' ? choice : choice.label)}</li>`).join('')}</ol>` : ''}${row.freeInputAllowed ? '<small>支持自由输入回应</small>' : ''}${array(row.evidence).map((item) => `<p>证据：${esc(item.summary)}</p>`).join('')}</article>`).join('');
  }
  function stepModel(result, track, step, index) {
    const execution = step?.[track.key];
    if (!execution) return null;
    const trace = traceCommand(result, track, execution);
    const outcome = { ...(execution.outcome || {}), ...(trace?.outcome || {}) };
    const surfaces = surfaceChanges(execution.projectionsBefore, execution.projections);
    const playerActorId = array(result?.previewRuns?.[track.key]?.actorStates).find((row) => row.kind === 'player')?.actorId;
    const npcMessages = playerActorId ? surfaces.rows.filter((row) => row.isDelta && row.actorId && row.actorId !== playerActorId) : [];
    return {
      index, track, execution, trace, outcome,
      action: execution.payload?.body || (execution.payload?.choiceId ? `事件选项：${execution.payload.choiceId}` : step.action || '服务端开场'),
      usage: usage(trace?.aiCalls),
      director: outcome.directorDecision,
      effects: outcome.narrativeEffects,
      diff: stateDiff(execution.projectionsBefore, execution.projections),
      surfaces, npcMessages, playerActorId,
      entities: entityChanges(execution.projectionsBefore, execution.projections),
      summaryCopies: npcMessages.filter((row) => row.text.trim() && row.text.trim() === String(outcome.narrativeSummary || '').trim()),
      names: actorNames(result, track, execution),
      seedEvidence: root.SliceCompiledPlanView?.seedEvidence(result, track.code, outcome.directorDecision?.seedRef) || '',
      noVisibleFeedback: execution.status === 'applied' && Boolean(playerActorId)
        && surfaces.gaps.length === 0 && npcMessages.length === 0,
    };
  }
  function raw(title, value) { return `<details class="experience-raw"><summary>${esc(title)}</summary><pre>${esc(JSON.stringify(value ?? null, null, 2))}</pre></details>`; }
  function usageHtml(value, elapsed) {
    const token = (item) => item === null ? '—' : item.toLocaleString();
    return `<div class="experience-usage"><span>输入 <b>${token(value.input)}</b></span><span>输出 <b>${token(value.output)}</b></span><span>模型 <b>${duration(value.latencyMs)}</b></span><span>命令 <b>${duration(elapsed)}</b></span><span>账本费用 <b>${esc(value.cost || '未回传')}${value.unknownCost && value.cost ? '（不完整）' : ''}</b></span></div>`;
  }
  function stepHtml(model) {
    if (!model) return '<p class="experience-muted">等待该轨道的真实结果。</p>';
    const { execution, outcome, director, effects, diff, surfaces, names } = model;
    const stateRows = diff.changes.map((change) => {
      const path = change.path.split('.').map((part) => names.get(part) || labels[part] || part).join(' / ');
      return `<tr><td>${esc(path)}</td><td>${change.before ?? '未观测'}</td><td>${change.after}</td><td>${change.delta === null ? '新观测' : `${change.delta > 0 ? '+' : ''}${change.delta}`}</td></tr>`;
    }).join('');
    const messages = surfaces.rows.map((row) => `<article class="experience-message"><div><span>${esc(row.surface)}</span><strong>${esc(row.displayName || names.get(row.actorId) || row.actorId || '未回传角色名')}</strong>${row.isDelta ? '' : '<small>历史快照，非本轮增量</small>'}</div><p>${esc(row.text)}</p></article>`).join('');
    return `<section class="experience-track">
      <div class="experience-track-head"><strong>${model.track.label}</strong><span class="experience-status ${execution.status === 'applied' ? '' : 'has-issue'}">${esc(status[execution.status] || execution.status)}</span></div>
      <p class="experience-summary">${esc(outcome.narrativeSummary || execution.error?.message || '后端尚未返回剧情摘要')}</p>
      ${model.noVisibleFeedback ? '<p class="experience-warning">玩法观察：命令已生效，但完整快照中没有新增 NPC 回应。玩家自己的帖子、经验奖励和剧情摘要均不能替代 NPC 互动。</p>' : ''}
      ${director ? `<div class="experience-director"><strong>${esc(narrative[director.narrativeFunction] || director.narrativeFunction)} · ${esc(tension[director.tensionBand] || director.tensionBand)}</strong><p>${esc(director.reason)}</p><small>聚焦：${esc(array(director.spotlightActorIds).map((id) => names.get(id) || id).join('、') || '无')} · 剧情种子 ${esc(director.seedRef || '未回传')}</small></div>` : '<p class="experience-muted">本轮 Director 决策未回传；不从生成文字推测。</p>'}
      ${effects ? `<div class="experience-effects"><span>结果 ${esc(effects.outcomeBandCode)}</span><span>影响 ${esc(array(effects.stateEffectCodes).join(' / '))}</span>${effects.endingProfileCode ? `<strong>结局证据 ${esc(effects.endingProfileCode)}</strong>` : ''}${array(effects.openLoopChanges).map((loop) => `<small>伏笔 ${esc(loop.loopRef)} · ${esc(loop.kind)} · ${esc(loop.operation)}</small>`).join('')}</div>` : ''}
      ${model.seedEvidence || ''}
      <p class="experience-muted">AI 调用记录 ${model.usage.count || '未回传'} · 命令 ${esc(status[execution.status] || execution.status)} · 新增 NPC 消息 ${model.playerActorId && !surfaces.gaps.length ? model.npcMessages.length : '证据不完整'}</p>
      ${model.summaryCopies.length ? '<p class="experience-warning">有 NPC 消息与剧情摘要完全相同，需要核查是否仍在复制旁白，而非生成角色台词。</p>' : ''}
      <h4>角色回应 <small>按真实内容 ID 对比前后快照</small></h4>
      ${messages || `<p class="experience-muted">${surfaces.gaps.length ? '该步缺少完整消息快照，不能判定没有回应。' : '已读取范围内，本轮没有新增帖子、评论或私聊。'}</p>`}
      ${surfaces.gaps.length ? `<p class="experience-warning">证据不完整：${esc(surfaces.gaps.join('、'))}。分页/历史报告未采集的内容不计为零。</p>` : ''}
      <h4>事件、活动与里程碑</h4>
      ${entitiesHtml(model.entities) || '<p class="experience-muted">本轮未观测到新的玩法卡片或状态变化。</p>'}
      ${model.entities.gaps.length ? `<p class="experience-muted">缺少完整对比：${esc(model.entities.gaps.join('、'))}。未采集不代表没有发生。</p>` : ''}
      <h4>数值变化</h4>
      ${stateRows ? `<div class="experience-table-wrap"><table><thead><tr><th>指标</th><th>前</th><th>后</th><th>变化</th></tr></thead><tbody>${stateRows}</tbody></table></div>` : '<p class="experience-muted">完整可比的指标中，未观测到数值变化。</p>'}
      ${diff.gaps.length ? `<p class="experience-warning">缺少前后快照：${esc(diff.gaps.join('、'))}，无法计算这些指标。</p>` : ''}
      ${usageHtml(model.usage, execution.durationMs)}
      ${raw('本步实际请求 / Outcome / Director / 模型调用', { input: execution.payload, command: execution.command, outcome, aiCalls: model.trace?.aiCalls || [], errors: execution.error, projectionIssues: execution.projectionIssues })}
      ${raw('本步状态前后快照', { before: execution.projectionsBefore || null, after: execution.projections || null })}
    </section>`;
  }
  function gameplayCoverage(result, track) {
    const models = [{ ...result.opening }, ...array(result.turns)]
      .map((step, index) => stepModel(result, track, step, index)).filter(Boolean);
    const messages = models.flatMap((model) => model.npcMessages);
    const changes = models.flatMap((model) => model.diff.changes);
    const entities = models.flatMap((model) => model.entities.rows);
    return [
      { label: 'NPC 公开回应', observed: messages.some((row) => row.surface !== '私聊') },
      { label: 'NPC 私信', observed: messages.some((row) => row.surface === '私聊') },
      { label: '事件呈现', observed: entities.some((item) => item.scope === 'events') },
      { label: '关系变化', observed: changes.some((item) => item.scope === 'relationships' && item.delta !== null && item.delta !== 0)
        || models.some((model) => model.outcome.writeCounts?.relationshipMoments > 0) },
      { label: '技能变化', observed: changes.some((item) => item.scope === 'stats' && item.path.startsWith('skills.') && item.delta !== null && item.delta !== 0) },
      { label: '里程碑完成', observed: entities.some((item) => item.scope === 'milestones' && item.isDelta
        && (item.row.resolution === 'completed' || item.row.state === 'completed') && item.previous?.resolution !== 'completed' && item.previous?.state !== 'completed') },
      { label: '经验增长', observed: changes.some((item) => /(^|\.)xp$/.test(item.path) && item.delta > 0) },
    ];
  }
  function coverageHtml(result, track) {
    const preview = result?.previewRuns?.[track.key];
    return `<section class="experience-track"><h3>${esc(track.label)} · 实际玩法覆盖</h3><p>玩家：<strong>${esc(preview?.identitySnapshot?.displayName || '尚未创建')}</strong> · 身份来源：${esc(preview?.identitySnapshot?.sourceType || '未回传')}</p><p>首位互动 NPC：${esc(preview?.firstFollower?.displayName || array(preview?.castSnapshot?.entries).find((row) => row.characterVersionId === preview?.firstFollower?.characterVersionId)?.displayName || '未回传')}</p><div class="experience-effects">${gameplayCoverage(result, track).map((item) => `<span>${item.label}：<b>${item.observed ? '已观测' : '未观测 / 未验证'}</b></span>`).join('')}</div><small>这是本次运行的覆盖情况，不是全部功能已完成的认证；私信不产生经验、技能或里程碑奖励。</small></section>`;
  }
  function selectedTracks(code) { return code === 'both' ? tracks : tracks.filter((track) => track.code === code); }
  function compileHtml(result, track) {
    const compiled = array(result.experiment?.tracks).find((item) => item.trackCode === track.code);
    const trace = traceTrack(result, track);
    const runtimeCalls = new Set(array(trace?.runtimeCommands).flatMap((command) => array(command.aiCalls)).map((call) => call.callRef));
    const calls = array(trace?.aiCalls).filter((call) => !runtimeCalls.has(call.callRef));
    return `<section class="experience-track"><div class="experience-track-head"><strong>${track.label}</strong><span>${esc(status[compiled?.status] || compiled?.status || '待编译')}</span></div>
      <p>编译器 ${esc(compiled?.compilerVersion || '未回传')} · ${array(compiled?.artifacts).length} 个已返回产物引用</p>
      ${array(compiled?.diagnostics).map((item) => `<p class="experience-warning">${esc(item.messageArgs?.find((arg) => arg.key === 'detail')?.value || item.message || item.code || JSON.stringify(item))}</p>`).join('')}
      ${root.SliceCompiledPlanView?.renderTrack(result, track.code) || '<p class="experience-muted">本报告未提供完整四块 Plan 正文；旧报告不能仅凭产物引用还原正文。</p>'}
      ${usageHtml(usage(calls), trace?.compile?.startedAt && trace?.compile?.completedAt ? Math.max(0, Date.parse(trace.compile.completedAt) - Date.parse(trace.compile.startedAt)) : null)}
      ${raw('编译选择 / 冲突与规则证据', compiled?.selectionTrace || null)}
      ${raw('编译产物引用与诊断', { artifacts: compiled?.artifacts || [], diagnostics: compiled?.diagnostics || [], compile: trace?.compile || null })}
    </section>`;
  }
  function render(host, result, input, view = 'both') {
    if (!host) return;
    const detailState = new Map([...host.querySelectorAll('details')].map((el) => [el.dataset.detailKey, el.open]));
    const selected = selectedTracks(view);
    if (!result) {
      host.innerHTML = `<section class="experience-welcome"><div class="experience-kicker">GAMEPLAY REVIEW</div><h1>先看故事怎样发生，再检查它为什么发生。</h1><p>选择剧本和基础角色卡，填好一组玩家行动，自动跑完后在这里看每步剧情、人物评论与私聊、数值变化和真实消耗。</p><div class="experience-setup-summary"><strong>${esc(input?.title || '选择测试剧本')}</strong><span>${array(input?.characterVersionIds).length} 张人物卡 · ${array(input?.playerActions).length} 轮行动 · ${input?.evaluationMode === 'regression' ? '链路回归' : '剧情体验'}</span></div><button type="button" class="button primary" data-experience-edit>配置剧本、人物与行动</button><p class="experience-muted">尚未执行。没有模拟成功、预计评论或预填数值。</p></section>`;
      return;
    }
    const steps = [{ ...result.opening, action: '确认服务端生成的开场', kind: 'opening' }, ...array(result.turns)];
    const costModel = root.SliceCostEstimate || (typeof module !== 'undefined' && module.exports ? require('./cost-estimate.js') : null);
    const allCalls = selected.flatMap((track) => costModel?.callsForTrack(result, track.code) || []);
    const outline = steps.map((step, index) => {
      const texts = selected.map((track) => stepModel(result, track, step, index)).filter(Boolean);
      return `<a href="#experience-step-${index}" class="experience-outline-step"><span>${index === 0 ? '开局' : String(index).padStart(2, '0')}</span><div><strong>${esc(index === 0 ? '故事开场' : step.action)}</strong>${texts.map((model) => `<p><b>${model.track.label}</b> ${esc(model.outcome.narrativeSummary || model.execution.error?.message || '待返回')}</p>`).join('')}</div></a>`;
    }).join('');
    host.innerHTML = `<header class="experience-report-head"><div><div class="experience-kicker">GAMEPLAY REVIEW · ${esc(result.input?.evaluationMode === 'regression' ? '链路回归' : '剧情体验')}</div><h1>${esc(result.input?.title || input?.title)}</h1><p>${esc(status[result.status] || result.status)} · ${array(result.turns).length} / ${array(result.input?.playerActions).length} 轮 · 总墙钟 ${duration(result.durationMs)}</p></div><div class="experience-source"><span>Source ${esc(result.scenario?.worldDraftRevisionId || '待创建')}</span><span>Experiment ${esc(result.experiment?.experimentId || '待创建')}</span></div></header>
      ${result.error ? `<p role="alert" class="experience-warning">${esc(result.error.code)} · ${esc(result.error.message)}</p>` : ''}
      ${result.stoppedReason ? `<p class="experience-warning">${result.stoppedReason === 'user_requested' ? '已在回合边界停止；已接受的请求没有撤销。' : '命令未成功应用，已停止后续行动，避免把不连续的状态当成完整玩法。'}</p>` : ''}
      <div class="experience-total">${usageHtml(usage(allCalls), result.durationMs)}<small>仅本次 Preview Run 与编译调用，按 callRef 去重；不累计旧试玩。未回传不显示为 0；不同币种分别统计。</small></div>
      ${root.SliceCostEstimate?.render(result, selected.map((track) => track.code)) || ''}
      <div class="experience-columns ${selected.length === 1 ? 'single' : ''}">${selected.map((track) => coverageHtml(result, track)).join('')}</div>
      ${result.compiledPlans?.tracks?.length === 2 && result.compiledPlans.tracks[0].planDigest && result.compiledPlans.tracks[0].planDigest === result.compiledPlans.tracks[1].planDigest ? '<p class="experience-warning">本次 Current / V2 的完整 Plan 摘要相同。请核对是否复用历史编译基线；本次双轨结果不足以证明两套编译器的质量差异。</p>' : ''}
      <section class="experience-section"><div class="experience-section-title"><span>01</span><h2>世界编译与剧情依据</h2></div><p class="experience-goal">源目标：${esc(result.input?.goal || '未提供')}</p><div class="experience-columns ${selected.length === 1 ? 'single' : ''}">${selected.map((track) => compileHtml(result, track)).join('')}</div></section>
      <section class="experience-section"><div class="experience-section-title"><span>02</span><h2>本次剧情走向</h2></div><div class="experience-outline">${outline}</div></section>
      <section class="experience-section"><div class="experience-section-title"><span>03</span><h2>逐步体验与消耗</h2></div>${steps.map((step, index) => `<article id="experience-step-${index}" class="experience-step"><header><span>${index === 0 ? 'OPENING' : `TURN ${String(index).padStart(2, '0')}`}</span><h3>${esc(index === 0 ? '确认服务端开场' : step.action)}</h3><small>${esc(step.kind || '')} · 双轨墙钟 ${duration(step.durationMs)}</small></header><div class="experience-columns ${selected.length === 1 ? 'single' : ''}">${selected.map((track) => stepHtml(stepModel(result, track, step, index))).join('')}</div></article>`).join('')}</section>`;
    [...host.querySelectorAll('details')].forEach((el, index) => { el.dataset.detailKey = String(index); if (detailState.has(String(index))) el.open = detailState.get(String(index)); });
  }
  const api = Object.freeze({ render, usage, uniqueCalls, stateDiff, numericValues, surfaceChanges, entityChanges, gameplayCoverage, stepModel, esc, duration });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SliceExperienceReport = api;
})(typeof window !== 'undefined' ? window : globalThis);
