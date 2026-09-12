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
  const chapterEffects = { RELATIONSHIP: '关系', KNOWLEDGE: '知识', RESOURCE: '资源', ACTIVE_CONFLICT: '冲突', OPEN_LOOP: '未决线索', MILESTONE_PATH: '阶段推进', ENDING_EVIDENCE: '结局证据' };
  const status = { running: '执行中', compiled_waiting_for_user: '编译完成，等待进入 Runtime', waiting_for_backend: '后端处理中，下一步已锁定', waiting_for_user: '已暂停，等待用户输入', waiting_with_issues: '已暂停，存在可定位问题', completed: '流程执行结束', coverage_incomplete: '流程结束，玩法覆盖未通过', verified: '玩法覆盖通过', completed_with_issues: '流程结束，有问题', stopped: '已停止', failed: '失败', applied: '已生效', processing: '处理中', rejected: '被拒绝', succeeded: '成功', queued: '排队中' };
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
    if (scope === 'replies') return items(projections?.replies?.value).flatMap((page) => items(page.value).map((row) => ({ ...row, rootPostId: page.postId || row.rootPostId })));
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
    for (const [scope, label, key] of [['events', '事件', 'eventId'], ['activities', '活动', 'activityId'], ['activityInstances', 'Activity Instance', 'activityId'], ['activityAttempts', 'Activity Attempt', 'activityAttemptId'], ['milestones', '里程碑', 'milestoneId']]) {
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
    return changes.rows.map(({ label, row, previous, isDelta }) => `<article class="experience-message"><div><span>${label}</span><strong>${esc(row.title || row.currentScene?.title || row.setup?.title || '未回传标题')}</strong><small>${isDelta ? previous ? '本轮更新' : '本轮新增' : '已观测，缺少可比基线'}</small></div><p>${esc(row.setup?.sceneDescription || row.currentScene?.sceneDescription || row.setup || row.description || '')}</p>${row.objective ? `<p>目标：${esc(row.objective)}</p>` : ''}<small>状态：${esc([previous?.state || previous?.status, row.state || row.status, row.resolution].filter(Boolean).join(' → ') || '未回传')}</small>${row.currentTurn !== undefined ? `<p>回合 ${esc(row.currentTurn)} / ${esc(row.maxTurns ?? '未回传')}</p>` : row.turnCount !== undefined ? `<p>Activity 回合 ${esc(row.turnCount)}</p>` : ''}${array(row.choices).length ? `<ol>${row.choices.map((choice) => `<li>${esc(typeof choice === 'string' ? choice : choice.label)}</li>`).join('')}</ol>` : ''}${row.freeInputAllowed ? '<small>支持自由输入回应</small>' : ''}${array(row.evidence).map((item) => `<p>证据：${esc(item.summary)}</p>`).join('')}</article>`).join('');
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
      chapterDirective: outcome.chapterDirective || outcome.gameplayEvidence?.chapter?.directive || null,
      chapterStateEffectCodes: array(outcome.chapterStateEffectCodes || outcome.gameplayEvidence?.chapter?.committedStateEffectCodes),
      gameplayEvidence: outcome.gameplayEvidence || null,
      narrativeProjection: outcome.narrativeProjection || null,
      chapterState: outcome.chapterState || outcome.gameplayEvidence?.chapter?.state || null,
      chapterSettlement: outcome.chapterSettlement || outcome.gameplayEvidence?.chapter?.settlement || null,
      debug: outcome.debugEvidence || null,
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
  function stageTimingsHtml(value) {
    if (value?.schemaVersion !== 'slice.runtime-stage-timings.v1') return '<p class="experience-muted">独立阶段耗时未采集；不从命令总时长反推。</p>';
    const stages = [['directorMs', '导演'], ['retrievalMs', '记忆召回与排序'], ['privatePovMs', 'Private POV'],
      ['mainRuntimeMs', '主 Runtime'], ['validationMs', '绑定与校验'], ['finalizationMs', '规则结算'],
      ['materializationMs', '内容物化'], ['persistenceMs', '数据库事务提交']];
    return `<details class="experience-raw"><summary>执行阶段耗时</summary><div class="experience-usage">${stages.map(([key, label]) => `<span>${label} <b>${duration(number(value[key]))}</b></span>`).join('')}</div><p class="experience-muted">服务端单调时钟实测。记忆组装总计 ${duration(number(value.memoryAssemblyMs))}，包含召回与 Private POV，不重复加总。事务提交耗时未采集时保留未知；各阶段之和不冒充命令总时长。</p></details>`;
  }
  function chapterHtml(model) {
    const state = model?.chapterState;
    const settlement = model?.chapterSettlement;
    const directive = model?.chapterDirective;
    if (!state && !settlement && !directive) return '<p class="experience-muted">本轮未回传 Chapter State；无法判断宏观章节是否推进。</p>';
    const active = state?.activeChapter || directive?.activeChapter || null;
    const evidence = array(state?.evidenceStateEffectCodes);
    const required = array(active?.requiredStateEffectCodes || directive?.requiredStateEffectCodes);
    const missing = required.filter((code) => !evidence.includes(code));
    const queue = array(state?.queuedChapters);
    const committed = array(model?.chapterStateEffectCodes);
    return `<div class="experience-director chapter-director">
      ${directive ? `<div class="experience-authority-line"><span>本轮前仍缺：<b>${esc(array(directive.missingStateEffectCodes).map((code) => chapterEffects[code] || code).join('、') || '无')}</b></span><span>Director 偏好 Surface：<b>${esc(directive.preferredSurface || 'any')}</b></span><span>语义判定：<b>${directive.semanticEvaluationRequested ? '本轮请求' : '未到门槛'}</b></span><span>重规划：<b>${directive.planningRequested ? '若结算则生成下一窗口' : '本轮不请求'}</b></span></div>` : ''}
      ${committed.length ? `<p class="experience-authority-note">Finalizer 本轮实际提交的 Chapter 结构证据：<strong>${esc(committed.map((code) => chapterEffects[code] || code).join('、'))}</strong></p>` : '<p class="experience-muted">本轮没有提交新的 Chapter 结构证据，或旧 Outcome 未记录该字段。</p>'}
      ${settlement ? `<p class="experience-summary"><strong>Chapter ${esc(settlement.ordinal)} 已结算</strong> · ${esc(settlement.resolution || settlement.chapterRef)}${settlement.nextChapterRef ? ` → 下一章 ${esc(settlement.nextChapterRef)}` : ''}</p>` : ''}
      ${active ? `<strong>当前 Chapter ${esc(active.ordinal)} · ${esc(active.title || active.chapterRef)}</strong><p>${esc(active.narrativeObjective || '')}</p><small>有效 Outcome ${esc(state?.meaningfulOutcomeCount ?? directive?.meaningfulOutcomeCount ?? 0)} / ${esc(active.minimumMeaningfulOutcomes ?? directive?.minimumMeaningfulOutcomes ?? '—')} · 已有结构证据 ${esc(evidence.map((code) => chapterEffects[code] || code).join('、') || '无')} · 仍缺 ${esc(missing.map((code) => chapterEffects[code] || code).join('、') || '无')}</small><p class="experience-muted">完成后：${esc(active.resolution || '未回传')} · 下一问题：${esc(active.nextQuestion || '未回传')}</p>` : '<strong>全部 Chapter 已结算</strong>'}
      ${queue.length ? `<small>滚动窗口：${esc(queue.map((chapter) => `Ch.${chapter.ordinal} ${chapter.title}`).join(' → '))}</small>` : ''}
    </div>`;
  }
  function signed(value) { return number(value) === null ? '—' : `${value > 0 ? '+' : ''}${value}`; }
  function authoritativeEvidenceHtml(model) {
    const evidence = model?.gameplayEvidence;
    if (!evidence) return '<p class="experience-muted">该 Outcome 来自旧 Trace，尚未回传 Finalizer Gameplay Evidence；下方仍保留产品表面前后快照。</p>';
    const names = model.names;
    const surfaceRows = array(evidence.surfaces).map((row) => `<tr><td>${esc(row.kind === 'dm_message' ? '私信' : row.kind)}</td><td>${esc(names.get(row.authorActorId) || row.authorActorId)}</td><td>${esc(row.origin === 'runtime_ai' ? 'AI 角色' : '玩家')}</td><td>${esc(row.channelId || row.rootPostId || row.contentId)}</td></tr>`).join('');
    const relationRows = array(evidence.relationshipChanges).flatMap((row) => Object.keys(row.after || {}).filter((axis) => number(row.before?.[axis]) !== null && number(row.after?.[axis]) !== null && row.before[axis] !== row.after[axis]).map((axis) => `<tr><td>${esc(`${names.get(row.fromActorId) || row.fromActorId} → ${names.get(row.toActorId) || row.toActorId} / ${labels[axis] || axis}`)}</td><td>${esc(row.before[axis])}</td><td>${esc(row.after[axis])}</td><td>${esc(signed(row.after[axis] - row.before[axis]))} · ${esc(row.reasonCode)}</td></tr>`)).join('');
    const numericRows = [...array(evidence.statChanges), ...array(evidence.skillChanges)].map((row) => `<tr><td>${esc(`${row.kind === 'skill' ? '技能' : 'Stat'} / ${names.get(row.actorId) || row.actorId || '玩家'} / ${row.code}`)}</td><td>${esc(row.before)}</td><td>${esc(row.after)}</td><td>${esc(signed(row.delta))} · ${esc(row.reasonCode)}</td></tr>`).join('');
    const growthRows = array(evidence.growth).map((row) => `<tr><td>经验 / ${esc(names.get(row.actorId) || row.actorId)}</td><td>${esc(row.beforeXp)} · Lv.${esc(row.beforeLevel)}</td><td>${esc(row.afterXp)} · Lv.${esc(row.afterLevel)}</td><td>${esc(signed(row.delta))} · ${esc(row.reasonCode)}</td></tr>`).join('');
    const entities = [...array(evidence.events), ...array(evidence.activities)].map((row) => `${row.type === 'event' ? 'Event' : 'Activity'} ${row.entityId}${row.familyCode ? ` · ${row.familyCode}` : ''}`);
    const dmChannels = array(evidence.proactiveDmChannels).map((row) => `${names.get(row.createdByActorId) || row.createdByActorId} → ${row.channelId}`);
    return `<div class="experience-authority"><div class="experience-authority-title"><strong>Finalizer 实际结算</strong><small>只展示已物化并进入 Outcome 的写入；不把 Candidate 声明当事实。</small></div>
      ${surfaceRows ? `<div class="experience-table-wrap"><table><thead><tr><th>Surface</th><th>作者</th><th>身份</th><th>绑定 ID</th></tr></thead><tbody>${surfaceRows}</tbody></table></div>` : '<p class="experience-muted">本轮没有物化新的 Feed/Comment/DM 内容。</p>'}
      ${dmChannels.length ? `<p class="experience-authority-note">主动私信频道：${esc(dmChannels.join('；'))}</p>` : ''}
      ${(relationRows || numericRows || growthRows) ? `<div class="experience-table-wrap"><table><thead><tr><th>结算项</th><th>前</th><th>后</th><th>变化 / 原因</th></tr></thead><tbody>${relationRows}${numericRows}${growthRows}</tbody></table></div>` : '<p class="experience-muted">本轮没有关系、Stat、Skill 或 XP 的实际账本变化。</p>'}
      ${entities.length ? `<p class="experience-authority-note">新物化玩法实体：${esc(entities.join('；'))}</p>` : ''}
      ${array(evidence.eventResolutions).length ? `<p class="experience-authority-note">Event 结算：${esc(array(evidence.eventResolutions).map((row) => `${row.eventId}@r${row.resolvedRevision}`).join('；'))}</p>` : ''}
      ${array(evidence.activityTurns).length ? `<p class="experience-authority-note">Activity 回合：${esc(array(evidence.activityTurns).map((row) => `${row.activityId} #${row.turnOrdinal}${row.completed ? ' 完成' : ''}`).join('；'))}</p>` : ''}
    </div>`;
  }
  function runtimeProcessHtml(model) {
    const outcome = model?.outcome || {};
    const attempt = outcome.attemptInterpretation;
    const memory = outcome.memoryEvidence;
    const debug = model?.debug;
    const selectedItems = array(debug?.memory?.sharedContext?.items);
    const privateHints = array(debug?.memory?.privatePovHints);
    const projection = model?.narrativeProjection;
    const claims = attempt ? [...array(attempt.claimedNpcStates), ...array(attempt.claimedWorldChanges)] : [];
    const lanes = array(memory?.lanes).map((row) => `${row.lane}:${row.status}/${row.candidateCount}`).join(' · ');
    return `<div class="experience-process-grid">
      <div><span>Attempt Resolution</span>${attempt ? `<strong>${esc(attempt.selfAction || '未回传')}</strong><p>玩家想要：${esc(attempt.desiredOutcome || '未回传')}</p><small>${claims.length ? `需抵抗/核验的玩家主张 ${esc(claims.join('；'))}` : '没有把玩家对 NPC / 世界的主张直接当成事实'}</small>` : '<p class="experience-muted">旧 Outcome 未回传 Attempt Interpretation。</p>'}</div>
      <div><span>Memory / POV</span>${memory ? `<strong>召回 ${esc(memory.selectedItemCount)} 条</strong><p>${esc(memory.strategy)}</p><small>${esc(lanes || 'lane 证据未回传')} · Private POV ${esc(memory.privatePovCallCount)} 次</small>` : '<p class="experience-muted">本轮没有可展示的记忆召回证据。</p>'}${debug ? `<p><b>实际送入主模型：</b>${esc(selectedItems.length)} 条共享记忆 · ${esc(privateHints.length)} 组安全 POV Hint</p>${selectedItems.slice(0, 6).map((item) => `<small>${esc(item.sourceRef || item.sourceOutcomeId || 'memory')} · ${esc(item.summary || item.text || JSON.stringify(item))}</small>`).join('')}` : ''}</div>
      <div><span>Engineering / Director</span>${debug?.engineering ? `<strong>${esc(debug.engineering.costClass || '未标记 Cost Class')}</strong><p>Vector ${debug.engineering.vectorRetrievalActive ? 'ON' : 'OFF'} · Graph ${debug.engineering.graphRetrievalActive ? 'ON' : 'OFF'}</p><small>Context 预算 ${esc(debug.engineering.contextManifest?.estimatedDynamicTailTokens ?? '—')} tokens · Responder ${esc(array(debug.memory?.responderActorIds).length)}</small>` : '<p class="experience-muted">该回合没有 Eval Debug Engineering Evidence。</p>'}</div>
      <div><span>Narrative Projection</span>${projection ? `<strong>${esc(projection.arcPhase || '—')} · ${esc(tension[projection.tensionBand] || projection.tensionBand || '—')}</strong><p>已使用 Seed：${esc(array(projection.usedSeedRefs).join('、') || '无')}</p><small>Open Loops ${array(projection.activeOpenLoops).length} · Recent Beats ${array(projection.recentBeats).length}</small>` : '<p class="experience-muted">旧 Trace 未回传 Narrative Projection 摘要。</p>'}</div>
    </div>`;
  }
  function planSummary(result, track) {
    const compiled = array(result?.compiledPlans?.tracks).find((row) => row.trackCode === track.code);
    const plan = root.SliceCompiledPlanView?.parse(compiled?.planJson);
    if (!plan) return null;
    const spine = plan.experienceSpine || {};
    const selection = root.SliceCompiledPlanView?.parse(compiled?.selectionTraceJson);
    return {
      digest: compiled?.planDigest || null,
      compilerVersion: compiled?.compilerVersion || null,
      seeds: array(plan.narrativeSeeds).length,
      functions: new Set(array(plan.narrativeSeeds).map((row) => row.functionCode)).size,
      actors: array(plan.agencyGraph?.actors).length,
      targetChapters: spine.chapterPlan?.targetChapterCount ?? null,
      initialChapters: array(spine.chapterPlan?.initialWindow).length,
      selectedDesignCodes: array(selection?.selectedCodes),
    };
  }
  function countBy(values, picker) {
    const counts = new Map();
    for (const value of values) { const key = picker(value); if (key) counts.set(key, (counts.get(key) || 0) + 1); }
    return counts;
  }
  function journeyAggregate(result, track) {
    const models = [{ ...result?.opening }, ...array(result?.turns)]
      .map((step, index) => stepModel(result, track, step, index)).filter(Boolean);
    const applied = models.filter((model) => model.execution.status === 'applied');
    const evidence = applied.map((model) => model.gameplayEvidence).filter(Boolean);
    const surfaces = evidence.flatMap((row) => array(row.surfaces));
    const aiSurfaces = surfaces.filter((row) => row.origin === 'runtime_ai');
    const relationships = evidence.flatMap((row) => array(row.relationshipChanges));
    const stats = evidence.flatMap((row) => array(row.statChanges));
    const skills = evidence.flatMap((row) => array(row.skillChanges));
    const growth = evidence.flatMap((row) => array(row.growth));
    const directors = applied.map((model) => model.director).filter(Boolean);
    const seedCounts = countBy(directors, (row) => row.seedRef);
    const functionCounts = countBy(directors, (row) => row.narrativeFunction);
    const actorCounts = countBy(aiSurfaces, (row) => row.authorActorId);
    const surfaceCounts = countBy(surfaces, (row) => row.kind === 'dm_message' ? '私信' : row.kind);
    const relationshipAxisTotals = {};
    for (const row of relationships) for (const [axis, after] of Object.entries(row.after || {})) {
      if (number(after) === null || number(row.before?.[axis]) === null) continue;
      relationshipAxisTotals[axis] = (relationshipAxisTotals[axis] || 0) + after - row.before[axis];
    }
    const settlements = applied.filter((model) => model.chapterSettlement).map((model) => model.chapterSettlement);
    const last = applied.at(-1) || models.at(-1) || null;
    const plan = planSummary(result, track);
    const peakSeed = [...seedCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
    const peakActor = [...actorCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
    const observations = [];
    if (applied.length >= 10 && applied.filter((model) => model.noVisibleFeedback).length / applied.length >= 0.35) observations.push('超过三分之一已应用回合没有新增 NPC 可见反馈；结合本轮候选资格与角色意图评估沉默是否合理，零回应本身不构成失败');
    if (directors.length >= 10 && peakSeed[1] / directors.length >= 0.5) observations.push(`剧情种子 ${peakSeed[0]} 占 Director 决策 ${Math.round(peakSeed[1] / directors.length * 100)}%，建议检查重复选择`);
    if (aiSurfaces.length >= 10 && actorCounts.size <= 1 && (plan?.actors || 0) >= 3) observations.push('长局 AI 可见输出几乎只来自一个角色，角色轮转不足');
    const active = last?.chapterState?.activeChapter || null;
    if (applied.length >= 10 && active && last.chapterState.meaningfulOutcomeCount >= (active.minimumMeaningfulOutcomes || 0) + 3
        && !settlements.length) observations.push('有效 Outcome 已明显超过当前 Chapter 最低门槛但仍未结算，需检查结构证据或语义完成判定');
    return {
      trackCode: track.code, configuredTurns: array(result?.input?.playerActions).length,
      executedTurns: array(result?.turns).length, appliedCommands: applied.length, failedCommands: models.length - applied.length,
      plan, surfaceCounts: Object.fromEntries(surfaceCounts), npcActorCount: actorCounts.size, peakActorId: peakActor[0], peakActorCount: peakActor[1],
      relationshipMoments: relationships.length, relationshipAxisTotals, statWrites: stats.length, skillWrites: skills.length,
      xpDelta: growth.reduce((sum, row) => sum + (number(row.delta) || 0), 0),
      levelStart: growth[0]?.beforeLevel ?? null, levelEnd: growth.at(-1)?.afterLevel ?? null,
      eventsCreated: evidence.reduce((sum, row) => sum + array(row.events).length, 0),
      activitiesCreated: evidence.reduce((sum, row) => sum + array(row.activities).length, 0),
      eventResolutions: evidence.reduce((sum, row) => sum + array(row.eventResolutions).length, 0),
      activityTurns: evidence.reduce((sum, row) => sum + array(row.activityTurns).length, 0),
      uniqueSeeds: seedCounts.size, peakSeedRef: peakSeed[0], peakSeedCount: peakSeed[1],
      narrativeFunctions: Object.fromEntries(functionCounts),
      noVisibleFeedback: applied.filter((model) => model.noVisibleFeedback).length,
      summaryCopies: applied.reduce((sum, model) => sum + model.summaryCopies.length, 0),
      chaptersSettled: settlements.length, completedChapterCount: array(last?.chapterState?.completedChapters).length,
      activeChapter: active ? { chapterRef: active.chapterRef, ordinal: active.ordinal, title: active.title,
        meaningfulOutcomeCount: last.chapterState?.meaningfulOutcomeCount ?? 0,
        minimumMeaningfulOutcomes: active.minimumMeaningfulOutcomes,
        evidence: array(last.chapterState?.evidenceStateEffectCodes),
        missing: array(active.requiredStateEffectCodes).filter((code) => !array(last.chapterState?.evidenceStateEffectCodes).includes(code)) } : null,
      observations,
    };
  }
  function aggregateHtml(result, track) {
    const value = journeyAggregate(result, track);
    const names = actorNames(result, track, [{ projections: result.finalProjections?.[track.key] }][0]);
    const surfaceText = Object.entries(value.surfaceCounts).map(([key, count]) => `${key} ${count}`).join(' · ') || '无 Outcome Surface 写入证据';
    const functionText = Object.entries(value.narrativeFunctions).sort((a, b) => b[1] - a[1]).map(([key, count]) => `${narrative[key] || key} ${count}`).join(' · ') || '无';
    const relationText = Object.entries(value.relationshipAxisTotals).map(([key, delta]) => `${labels[key] || key} ${signed(delta)}`).join(' · ') || '无';
    return `<section class="experience-track experience-aggregate"><div class="experience-track-head"><strong>${track.label} · 长局轨迹</strong><span>${value.executedTurns} / ${value.configuredTurns} 玩家行动</span></div>
      <div class="experience-metric-grid"><div><span>已应用 Command</span><strong>${value.appliedCommands}</strong><small>失败/拒绝 ${value.failedCommands}</small></div><div><span>XP</span><strong>${signed(value.xpDelta)}</strong><small>${value.levelStart == null ? '等级证据未回传' : `Lv.${value.levelStart} → Lv.${value.levelEnd}`}</small></div><div><span>Chapter</span><strong>${value.chaptersSettled} 次结算</strong><small>${value.completedChapterCount} 章已完成</small></div><div><span>AI 角色轮转</span><strong>${value.npcActorCount} 人</strong><small>${value.peakActorId ? `最高频 ${esc(names.get(value.peakActorId) || value.peakActorId)} · ${value.peakActorCount} 条` : '暂无 AI Surface 证据'}</small></div><div><span>Event / Activity</span><strong>${value.eventsCreated} / ${value.activitiesCreated}</strong><small>Event 结算 ${value.eventResolutions} · Activity 回合 ${value.activityTurns}</small></div><div><span>剧情种子</span><strong>${value.uniqueSeeds} 个</strong><small>${value.peakSeedRef ? `最高频 ${esc(value.peakSeedRef)} · ${value.peakSeedCount} 次` : '暂无 Director 证据'}</small></div></div>
      <div class="experience-aggregate-lines"><p><b>Surface Mix</b> ${esc(surfaceText)}</p><p><b>关系累计净变化</b> ${esc(relationText)}</p><p><b>Director 功能分布</b> ${esc(functionText)}</p><p><b>Stat / Skill 实际写入</b> ${value.statWrites} / ${value.skillWrites} · <b>无可见 NPC 反馈</b> ${value.noVisibleFeedback} · <b>摘要复制</b> ${value.summaryCopies}</p></div>
      ${value.activeChapter ? `<div class="experience-director"><strong>当前 Chapter ${esc(value.activeChapter.ordinal)} · ${esc(value.activeChapter.title || value.activeChapter.chapterRef)}</strong><p>有效 Outcome ${esc(value.activeChapter.meaningfulOutcomeCount)} / ${esc(value.activeChapter.minimumMeaningfulOutcomes)} · 已有 ${esc(value.activeChapter.evidence.map((code) => chapterEffects[code] || code).join('、') || '无')} · 仍缺 ${esc(value.activeChapter.missing.map((code) => chapterEffects[code] || code).join('、') || '无')}</p></div>` : '<p class="experience-muted">当前没有 Active Chapter。</p>'}
      ${value.plan ? `<p class="experience-muted">编译计划：${value.plan.seeds} seeds / ${value.plan.functions} 种叙事功能 / ${value.plan.actors} actors / 目标 ${value.plan.targetChapters ?? '—'} 章 / 初始窗口 ${value.plan.initialChapters}${value.plan.selectedDesignCodes.length ? ` · V2 设计策略 ${esc(value.plan.selectedDesignCodes.join('、'))}` : ''}</p>` : ''}
      ${value.observations.length ? `<div class="experience-observations"><strong>Eval 派生观察（不是 Runtime Authority）</strong>${value.observations.map((text) => `<p>${esc(text)}</p>`).join('')}</div>` : '<p class="experience-muted">当前未触发长局异常观察阈值；这不等于剧情质量自动通过。</p>'}
    </section>`;
  }
  function comparisonHtml(result) {
    const left = journeyAggregate(result, tracks[0]), right = journeyAggregate(result, tracks[1]);
    if (!left.plan || !right.plan) return '';
    const samePlan = left.plan.digest && left.plan.digest === right.plan.digest;
    return `<div class="experience-comparison"><strong>Current ↔ V2 对照</strong><span>Plan ${samePlan ? '摘要相同' : '摘要不同'}</span><span>Seeds ${left.plan.seeds} ↔ ${right.plan.seeds}</span><span>叙事功能 ${left.plan.functions} ↔ ${right.plan.functions}</span><span>XP ${signed(left.xpDelta)} ↔ ${signed(right.xpDelta)}</span><span>Chapter 结算 ${left.chaptersSettled} ↔ ${right.chaptersSettled}</span><span>AI 角色轮转 ${left.npcActorCount} ↔ ${right.npcActorCount}</span><small>这里只陈列同输入下的差异，不自动判定哪一轨更好。</small></div>`;
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
      <p class="experience-summary">${esc(outcome.narrativeSummary || execution.activityResponse?.currentScene?.summary || execution.activityResponse?.setup?.title || execution.activityResponse?.outcomeSummary || execution.error?.message || '本步为同步产品操作，没有 Runtime 剧情摘要')}</p>
      ${model.noVisibleFeedback ? '<p class="experience-muted">本轮没有新增 NPC 回应。公开行动允许角色保持沉默；可结合候选资格、角色意图和真实结果评估合理性。</p>' : ''}
      <h4>本轮 Runtime 调度链</h4>
      ${runtimeProcessHtml(model)}
      ${director ? `<div class="experience-director"><strong>${esc(narrative[director.narrativeFunction] || director.narrativeFunction)} · ${esc(tension[director.tensionBand] || director.tensionBand)}</strong><p>${esc(director.reason)}</p><small>聚焦：${esc(array(director.spotlightActorIds).map((id) => names.get(id) || id).join('、') || '无')} · 剧情种子 ${esc(director.seedRef || '未回传')}</small></div>` : '<p class="experience-muted">本轮 Director 决策未回传；不从生成文字推测。</p>'}
      ${effects ? `<div class="experience-effects"><span>模型 Candidate 结果 ${esc(effects.outcomeBandCode)}</span><span>模型声明影响 ${esc(array(effects.stateEffectCodes).join(' / '))}</span>${effects.endingProfileCode ? `<strong>结局证据 ${esc(effects.endingProfileCode)}</strong>` : ''}${array(effects.openLoopChanges).map((loop) => `<small>伏笔 ${esc(loop.loopRef)} · ${esc(loop.kind)} · ${esc(loop.operation)}</small>`).join('')}</div>` : ''}
      <h4>真实结算 · Outcome Authority</h4>
      ${authoritativeEvidenceHtml(model)}
      <h4>章节推进 · Chapter Director</h4>
      ${chapterHtml(model)}
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
      ${stageTimingsHtml(outcome.stageTimings)}
      ${model.debug ? raw('Eval Debug · 实际召回记忆 / Provider-safe Context / 工程判定', {
        engineering: model.debug.engineering,
        memory: model.debug.memory,
        modelInput: model.debug.modelInput,
      }) : ''}
      ${model.debug ? raw('Eval Debug · 模型 Candidate → Authority Bound Proposal', {
        modelCandidate: model.debug.modelCandidate,
        authorityBoundProposal: model.debug.authorityBoundProposal,
      }) : ''}
      ${raw('本步实际请求 / 产品返回 / Outcome / Director / 模型调用', { input: execution.payload, activityResponse: execution.activityResponse || null, submitReceipt: execution.accepted || null, command: execution.command, outcome, aiCalls: model.trace?.aiCalls || [], errors: execution.error, projectionIssues: execution.projectionIssues })}
      ${raw('本步状态前后快照（含 Activity Attempt / Instance / History）', { before: execution.projectionsBefore || null, after: execution.projections || null })}
    </section>`;
  }
  function gameplayCoverage(result, track) {
    const models = [{ ...result.opening }, ...array(result.turns)]
      .map((step, index) => stepModel(result, track, step, index)).filter((model) => model?.execution.status === 'applied');
    const messages = models.flatMap((model) => model.npcMessages);
    const changes = models.flatMap((model) => model.diff.changes);
    const entities = models.flatMap((model) => model.entities.rows);
    return [
      { label: 'NPC 公开回应', observed: messages.some((row) => row.surface !== '私聊') },
      { label: 'NPC 私信', observed: messages.some((row) => row.surface === '私聊') },
      { label: '事件呈现', observed: entities.some((item) => item.scope === 'events' && item.isDelta) },
      { label: '关系变化', observed: changes.some((item) => item.scope === 'relationships' && item.delta !== null && item.delta !== 0) },
      { label: '技能变化', observed: models.some((model) => model.playerActorId && model.execution.payload?.type !== 'dm_message'
        && model.diff.changes.some((item) => item.scope === 'stats' && /\.(value|currentValue)$/.test(item.path)
          && item.delta !== null && item.delta !== 0 && array(model.execution.projections?.stats?.value?.skills)
            .filter((skill) => !skill.actorId || skill.actorId === model.playerActorId)
            .some((skill) => item.path.startsWith(`skills.${skill.actorId ? `${skill.actorId}.` : ''}${skill.skillId || skill.skillCode || skill.code || skill.key}.`)))) },
      { label: '里程碑完成', observed: entities.some((item) => item.scope === 'milestones' && item.isDelta
        && (item.row.resolution === 'completed' || item.row.state === 'completed') && item.previous?.resolution !== 'completed' && item.previous?.state !== 'completed') },
      { label: '章节推进', observed: models.some((model) => model.chapterState?.activeChapter
        && (model.chapterState.meaningfulOutcomeCount > 0 || array(model.chapterState.evidenceStateEffectCodes).length > 0
          || model.chapterSettlement)) },
      { label: '章节结算', observed: models.some((model) => Boolean(model.chapterSettlement)) },
      { label: '经验增长', observed: models.some((model) => model.execution.payload?.type !== 'dm_message'
        && model.diff.changes.some((item) => item.scope === 'progression' && /^(progression\.)?(xp|totalXp)$/.test(item.path) && item.delta > 0)) },
    ];
  }
  // A flow ending is not acceptance. Every check is tied to applied Commands
  // and actual read APIs; model prose, write counts and old snapshots are not proof.
  function gameplayAcceptance(result, track) {
    const preview = result?.previewRuns?.[track.key];
    const all = [{ ...result?.opening }, ...array(result?.turns)]
      .map((step, index) => stepModel(result, track, step, index)).filter(Boolean);
    const models = all.filter((model) => model.execution.status === 'applied');
    const playerId = array(preview?.actorStates).find((row) => row.kind === 'player')?.actorId;
    const commandId = (model) => model.execution.command?.commandId || model.execution.accepted?.commandId;
    const checks = [];
    const add = (key, label, matches, reason) => checks.push({ key, label, observed: matches.length > 0,
      commandIds: [...new Set(matches.map(commandId).filter(Boolean))], reason: matches.length ? null : reason });
    const completeSurfaces = (model) => model.surfaces.gaps.length === 0;
    const sameText = (row, body) => typeof body === 'string' && String(row.text || row.body || '').trim() === body.trim();
    const completed = (row) => row?.resolution === 'completed' || row?.state === 'completed';
    const active = (row) => ['active', 'available'].includes(row?.state);
    const realNpc = (model, surface) => model.npcMessages.filter((row) => (!surface || row.surface === surface)
      && row.text.trim() && !model.summaryCopies.includes(row));
    const opening = models.filter((model) => model.execution.payload?.type === 'confirm_opening_post'
      && completeSurfaces(model) && model.surfaces.rows.some((row) => row.surface === '帖子'
        && row.actorId === playerId && row.postId && row.isDelta && sameText(row, model.execution.payload.body)));
    add('opening', '开局应用并回读', opening, '缺少已应用的开局及玩家原文回读');
    const followerId = array(preview?.castSnapshot?.entries).find((row) =>
      row.characterVersionId === preview?.firstFollower?.characterVersionId)?.actorId;
    add('first_follower', '所选首位 NPC 回应', opening.filter((model) => followerId
      && realNpc(model).some((row) => row.actorId === followerId)), '开局未回读到所选首位 NPC 的独立正文');
    add('post_comment', '发帖收到 NPC 评论', models.filter((model) => {
      if (model.execution.payload?.type !== 'post' || !completeSurfaces(model)) return false;
      const posts = model.surfaces.rows.filter((row) => row.surface === '帖子' && row.actorId === playerId
        && row.postId && row.isDelta && sameText(row, model.execution.payload.body));
      return realNpc(model, '评论').some((row) => posts.some((post) => post.postId === row.rootPostId));
    }), '没有同一发帖命令下、引用该帖的真实 NPC 评论');
    add('comment_reply', '回复真实评论并继续互动', models.filter((model) => {
      const payload = model.execution.payload;
      if (payload?.type !== 'reply' || !completeSurfaces(model)) return false;
      const target = flattenSurface(model.execution.projectionsBefore, 'replies').find((row) =>
        row.replyId === payload.parentContentId && row.rootPostId === payload.rootPostId
        && row.author?.actorId && row.author.actorId !== playerId);
      if (!target) return false;
      // ReplyView uses parentReplyId; parentContentId belongs to the Command.
      // Verify the actual player -> NPC child chain, not any comment on the
      // same root post (which could belong to an unrelated conversation).
      const playerReplies = model.surfaces.rows.filter((row) => row.surface === '评论'
        && row.isDelta && row.replyId && row.actorId === playerId && row.rootPostId === payload.rootPostId
        && row.parentReplyId === payload.parentContentId && sameText(row, payload.body));
      return realNpc(model, '评论').some((row) => row.rootPostId === payload.rootPostId
        && row.actorId === target.author.actorId
        && playerReplies.some((playerReply) => row.parentReplyId === playerReply.replyId));
    }), '缺少正确 root/parent 引用、玩家回复与后续 NPC 评论的回读');
    const proactive = models.filter((model) => model.execution.payload?.type !== 'dm_message'
      && completeSurfaces(model) && realNpc(model, '私聊').some((row) => row.channelId && row.messageId));
    add('proactive_dm', '公开行动触发主动私信', proactive, '空频道、手动建频道及玩家先发起的 DM 不算主动私信');
    add('dm_reply', '回复主动私信并收到后续回复', models.filter((model) => {
      const payload = model.execution.payload;
      if (payload?.type !== 'dm_message' || !completeSurfaces(model)) return false;
      const incoming = proactive.filter((origin) => origin.index < model.index)
        .flatMap((origin) => realNpc(origin, '私聊')).filter((row) => row.channelId === payload.channelId);
      return incoming.length > 0 && model.surfaces.rows.some((row) => row.surface === '私聊'
        && row.channelId === payload.channelId && row.actorId === playerId && sameText(row, payload.body))
        && realNpc(model, '私聊').some((row) => row.channelId === payload.channelId
          && incoming.some((message) => message.actorId === row.actorId));
    }), '尚未验证同一主动来信人物和频道的后续回复');
    add('event_resolution', '真实事件回应与结算', models.filter((model) => {
      const payload = model.execution.payload;
      if (payload?.type !== 'event_action') return false;
      const before = items(model.execution.projectionsBefore?.events?.value).find((row) => row.eventId === payload.eventId);
      const validInput = payload.choiceId ? array(before?.choices).some((choice) => choice.choiceId === payload.choiceId)
        : before?.freeInputAllowed === true && typeof payload.body === 'string' && payload.body.trim();
      return active(before) && validInput && model.entities.rows.some((item) => item.scope === 'events'
        && item.isDelta && item.row.eventId === payload.eventId && item.row.state === 'resolved');
    }), '未回读到指定 eventId 的有效选择/自由输入及 resolved 状态');
    for (const row of gameplayCoverage(result, track).filter((row) => ['关系变化', '技能变化', '经验增长'].includes(row.label))) {
      checks.push({ key: ({ '关系变化': 'relationship', '技能变化': 'skill', '经验增长': 'xp' })[row.label],
        ...row, commandIds: [], reason: row.observed ? null : '缺少可比的真实前后数值' });
    }
    add('milestone_next', '里程碑证据、完成与下一条', models.filter((model) => model.execution.payload?.type !== 'dm_message'
      && model.entities.rows.some((item) => item.scope === 'milestones' && item.isDelta
        && completed(item.row) && !completed(item.previous) && array(item.row.evidence).some((entry) => entry.summary)
        && items(model.execution.projections?.milestones?.value).some((next) =>
          next.milestoneId !== item.row.milestoneId && active(next)
          && !active(items(model.execution.projectionsBefore?.milestones?.value).find((prior) => prior.milestoneId === next.milestoneId))))), '缺少本轮完成证据或正式接口返回的下一里程碑');
    const authoritative = all.length > 0 && all.every((model) => {
      const execution = model.execution;
      return execution.status === 'applied' && execution.command?.status === 'applied'
        && execution.outcome?.status === 'applied' && execution.outcome?.outcomeId
        && execution.outcome.commandId === commandId(model) && execution.outcome.runId === preview?.runId
        && execution.projectionsBefore?.run?.status === 'succeeded' && execution.projections?.run?.status === 'succeeded'
        && execution.projectionsBefore.run.value.revision + 1 === execution.outcome.resultingRevision
        && execution.projections.run.value.revision === execution.outcome.resultingRevision;
    });
    checks.push({ key: 'continuous_applied', label: '同一 Run 连续应用与 Outcome 回读', observed: Boolean(authoritative),
      commandIds: all.map(commandId).filter(Boolean), reason: authoritative ? null : '存在未应用命令或缺少匹配的正式 Outcome' });
    const replay = models.length > 0 && models.every((model) => model.execution.idempotencyVerification?.sameCommandId === true
      && model.execution.idempotencyVerification?.sameOutcomeId === true
      && model.execution.idempotencyVerification?.revisionUnchanged === true
      && model.execution.idempotencyVerification?.projectionsUnchanged === true);
    checks.push({ key: 'idempotency', label: '重试不重复消息或奖励', observed: replay,
      commandIds: models.map(commandId).filter(Boolean), reason: replay ? null : '未完成同 key 重试与 Outcome/revision/投影复读对比' });
    const dmRules = models.filter((model) => model.execution.payload?.type === 'dm_message');
    const dmValid = dmRules.length > 0 && dmRules.every((model) => !model.diff.gaps.includes('stats')
      && !model.diff.gaps.includes('progression') && !model.entities.gaps.includes('里程碑')
      && !model.diff.changes.some((change) => change.scope === 'stats' || change.scope === 'progression')
      && !model.entities.rows.some((item) => item.scope === 'milestones'));
    checks.push({ key: 'dm_growth_boundary', label: '私信不单独产生数值成长', observed: dmValid,
      commandIds: dmRules.map(commandId).filter(Boolean), reason: dmValid ? null : 'DM 成长边界缺少完整前后快照或存在变化' });
    const missing = checks.filter((row) => !row.observed).map((row) => row.key);
    return { schemaVersion: 'slice.core-gameplay-acceptance.v1', trackCode: track.code,
      passed: missing.length === 0, checks, missing,
      workflowFinished: result?.workflowFinished === true || ['completed', 'coverage_incomplete', 'verified'].includes(result?.status),
      deviceVerified: false, sourceReused: result?.sourceReused ?? null };
  }
  function coverageHtml(result, track) {
    const preview = result?.previewRuns?.[track.key];
    const acceptance = gameplayAcceptance(result, track);
    return `<section class="experience-track"><h3>${esc(track.label)} · 实际玩法覆盖</h3><p class="${acceptance.passed ? 'experience-muted' : 'experience-warning'}">${acceptance.passed ? '本轨道核心玩法覆盖通过' : '本次运行尚未覆盖全部玩法'} · 流程${acceptance.workflowFinished ? '已结束' : '尚未完整结束'} · 手机设备未验收</p><details><summary>连续链与持久化验收 ${acceptance.checks.filter((row) => row.observed).length} / ${acceptance.checks.length}</summary>${acceptance.checks.map((row) => `<p>${esc(row.label)}：${row.observed ? '有回读证据' : esc(row.reason)}</p>`).join('')}</details><p>玩家：<strong>${esc(preview?.identitySnapshot?.displayName || '尚未创建')}</strong> · 身份来源：${esc(preview?.identitySnapshot?.sourceType || '未回传')}</p><p>首位互动 NPC：${esc(preview?.firstFollower?.displayName || array(preview?.castSnapshot?.entries).find((row) => row.characterVersionId === preview?.firstFollower?.characterVersionId)?.displayName || '未回传')}</p><div class="experience-effects">${gameplayCoverage(result, track).map((item) => `<span>${item.label}：<b>${item.observed ? '已观测' : '未观测 / 未验证'}</b></span>`).join('')}</div><small>这是本次运行的覆盖情况，不是全部功能已完成的认证。Event、公开回应、主动私信和数值变化均按真实情境可选产生，未观测到不等于 Runtime 失败；私信不产生经验、技能或里程碑奖励。</small></section>`;
  }
  function selectedTracks(code) { return code === 'both' ? tracks : tracks.filter((track) => track.code === code); }
  function operationLedgerHtml(result) {
    const rows = array(result?.operations);
    const tableRows = rows.map((row) => `<tr><td>${esc(row.sequence ?? '—')}</td><td>${esc(row.stage || '—')}</td><td><code>${esc(row.operationId || '—')}</code></td><td>${esc(row.method || '—')}</td><td>${esc(row.httpStatus ?? '—')}</td><td>${esc(row.status || '—')}</td><td>${esc(duration(row.durationMs))}</td></tr>`).join('');
    return `<section class="experience-section"><div class="experience-section-title"><span>IO</span><h2>真实 API 输入 / 输出 Ledger</h2></div><p class="experience-goal">记录本次 Eval 实际调用的 operation、HTTP 状态、耗时，以及浏览器允许展示的请求/响应字段。失败也保留，不用“成功摘要”覆盖。</p>${rows.length ? `<div class="experience-table-wrap"><table><thead><tr><th>#</th><th>阶段</th><th>Operation</th><th>Method</th><th>HTTP</th><th>状态</th><th>耗时</th></tr></thead><tbody>${tableRows}</tbody></table></div>` : '<p class="experience-muted">还没有 API 调用记录。</p>'}${raw('全部 API 请求 / 响应（安全投影）', rows)}</section>`;
  }
  function aiCallLedgerHtml(result, selected) {
    const rows = [];
    const seen = new Set();
    for (const track of selected) {
      const trace = traceTrack(result, track);
      const candidates = [...array(trace?.aiCalls), ...array(trace?.runtimeCommands).flatMap((command) => array(command.aiCalls).map((call) => ({ ...call, runtimeCommandId: command.commandId, runtimeCommandType: command.commandType })))];
      for (const call of candidates) {
        const key = `${track.code}:${call.callRef || JSON.stringify(call)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ ...call, trackCode: track.code, trackLabel: track.label });
      }
    }
    const tableRows = rows.map((call) => `<tr><td>${esc(call.trackLabel)}</td><td>${esc(call.purpose || call.runtimeCommandType || 'compile/runtime')}</td><td>${esc(call.modelProvider || '—')} / ${esc(call.model || '—')}</td><td>${esc(number(call.inputTokens) ?? '—')}</td><td>${esc(number(call.outputTokens) ?? '—')}</td><td>${esc(duration(call.latencyMs))}</td><td>${esc(call.currency && number(call.costMinor) !== null ? `${call.currency} ${(call.costMinor / 100).toFixed(2)}` : '未回传')}</td></tr>`).join('');
    return `<section class="experience-section"><div class="experience-section-title"><span>AI</span><h2>模型调用、Token 与费用 Ledger</h2></div><p class="experience-goal">按真实 callRef 去重；输入/输出 token、模型耗时和账本费用只在后端确实回传时显示，未知不会记成 0。</p>${rows.length ? `<div class="experience-table-wrap"><table><thead><tr><th>轨道</th><th>用途</th><th>模型</th><th>Input</th><th>Output</th><th>耗时</th><th>费用</th></tr></thead><tbody>${tableRows}</tbody></table></div>` : '<p class="experience-muted">当前阶段没有模型调用证据。</p>'}${raw('全部模型调用证据', rows)}</section>`;
  }
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
    host.innerHTML = `<header class="experience-report-head"><div><div class="experience-kicker">GAMEPLAY REVIEW · ${esc(result.input?.evaluationMode === 'regression' ? '链路回归' : '剧情体验')}</div><h1>${esc(result.input?.title || input?.title)}</h1><p>${esc(status[result.status] || result.status)} · ${array(result.turns).length}${result.adaptiveAcceptance ? ' 轮 · 按当前局面继续验收' : ` / ${array(result.input?.playerActions).length} 轮`} · 总墙钟 ${duration(result.durationMs)}</p></div><div class="experience-source"><span>Source ${esc(result.scenario?.worldDraftRevisionId || '待创建')}</span><span>Experiment ${esc(result.experiment?.experimentId || '待创建')}</span></div></header>
      ${result.error ? `<p role="alert" class="experience-warning">${esc(result.error.code)} · ${esc(result.error.message)}</p>` : ''}
      ${result.stoppedReason ? `<p class="experience-warning">${result.stoppedReason === 'user_requested' ? '已在回合边界停止；已接受的请求没有撤销。' : '命令未成功应用，已停止后续行动，避免把不连续的状态当成完整玩法。'}</p>` : ''}
      <div class="experience-total">${usageHtml(usage(allCalls), result.durationMs)}<small>仅本次 Preview Run 与编译调用，按 callRef 去重；不累计旧试玩。未回传不显示为 0；不同币种分别统计。</small></div>
      ${root.SliceCostEstimate?.render(result, selected.map((track) => track.code)) || ''}
      <div class="experience-columns ${selected.length === 1 ? 'single' : ''}">${selected.map((track) => coverageHtml(result, track)).join('')}</div>
      ${result.compiledPlans?.tracks?.length === 2 && result.compiledPlans.tracks[0].planDigest && result.compiledPlans.tracks[0].planDigest === result.compiledPlans.tracks[1].planDigest ? '<p class="experience-warning">本次 Current / V2 的完整 Plan 摘要相同。请核对是否复用历史编译基线；本次双轨结果不足以证明两套编译器的质量差异。</p>' : ''}
      <section class="experience-section"><div class="experience-section-title"><span>01</span><h2>世界编译与剧情依据</h2></div><p class="experience-goal">源目标：${esc(result.input?.goal || '未提供')}</p><div class="experience-columns ${selected.length === 1 ? 'single' : ''}">${selected.map((track) => compileHtml(result, track)).join('')}</div></section>
      <section class="experience-section"><div class="experience-section-title"><span>02</span><h2>长局轨迹与双轨对照</h2></div>${selected.length === 2 ? comparisonHtml(result) : ''}<div class="experience-columns ${selected.length === 1 ? 'single' : ''}">${selected.map((track) => aggregateHtml(result, track)).join('')}</div></section>
      <section class="experience-section"><div class="experience-section-title"><span>03</span><h2>本次剧情走向</h2></div><div class="experience-outline">${outline}</div></section>
      <section class="experience-section"><div class="experience-section-title"><span>04</span><h2>逐步体验、Director 与结算</h2></div>${steps.map((step, index) => `<article id="experience-step-${index}" class="experience-step"><header><span>${index === 0 ? 'OPENING' : `TURN ${String(index).padStart(2, '0')}`}</span><h3>${esc(index === 0 ? '确认服务端开场' : step.action)}</h3><small>${esc(step.kind || '')} · 双轨墙钟 ${duration(step.durationMs)}</small></header><div class="experience-columns ${selected.length === 1 ? 'single' : ''}">${selected.map((track) => stepHtml(stepModel(result, track, step, index))).join('')}</div></article>`).join('')}</section>`;
    [...host.querySelectorAll('details')].forEach((el, index) => { el.dataset.detailKey = String(index); if (detailState.has(String(index))) el.open = detailState.get(String(index)); });
  }
  const api = Object.freeze({ render, usage, uniqueCalls, stateDiff, numericValues, surfaceChanges, entityChanges, gameplayCoverage, gameplayAcceptance, stepModel, journeyAggregate, planSummary, esc, duration });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SliceExperienceReport = api;
})(typeof window !== 'undefined' ? window : globalThis);
