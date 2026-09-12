(() => {
  'use strict';

  const B = window.SliceEvalBackend;
  const T = B.consoleTools;
  const PREFIX = 'slice-eval-console-v1:';
  const SCHEMA = 'slice.eval-console-session.v1';
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const items = (value) => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
  const uid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const fail = (message, code = 'SLICE_EVAL_INPUT_INVALID') => Object.assign(new Error(message), { code });
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const capabilities = () => Object.freeze({
    environment: 'staging', images: false, diagnosticsOnly: true, manualActions: true,
    compilerTracks: ['current', 'v2_candidate'], runtimeTracks: ['current'],
    onlineTuning: false, publishing: true,
    compilerNotice: '共享编译引擎当前实际运行 Current 与 V2 两轨，全部调用和成本均展示；仅 Current 建立人工游玩会话。',
  });

  function storagePrefix() {
    const workspaceId = B.workspaceId();
    return workspaceId ? PREFIX + encodeURIComponent(workspaceId) + ':' : null;
  }
  function controlRecord(result) {
    const pending = result.pendingCommand;
    const compactPayload = (value) => {
      const payload = clone(value);
      if (typeof payload?.body === 'string' && [...payload.body].length > 400) {
        payload.originalBodyLength = [...payload.body].length;
        payload.body = [...payload.body].slice(0, 400).join('');
        payload.bodyTruncated = true; payload.fullInputSource = 'backend_trace';
      }
      return payload;
    };
    const compactExecution = (execution) => execution ? {
      status: execution.status, payload: compactPayload(execution.payload),
      startedAt: execution.startedAt, completedAt: execution.completedAt, durationMs: execution.durationMs,
      accepted: execution.accepted?.commandId ? { commandId: execution.accepted.commandId } : null,
      command: execution.command ? { commandId: execution.command.commandId || execution.accepted?.commandId,
        status: execution.command.status, errorCode: execution.command.errorCode } : null,
      error: clone(execution.error), outcome: null, evidenceNeedsRefresh: true,
    } : null;
    const recoveryInput = clone(result.input);
    if (recoveryInput) {
      recoveryInput.sourceContent = null;
      if (recoveryInput.sourceDocument) { delete recoveryInput.sourceDocument.body; recoveryInput.sourceDocument.omittedFromEvidence = true; }
      if (recoveryInput.sourceDraft) recoveryInput.sourceDraft = { worldDraftId: recoveryInput.sourceDraft.worldDraftId, worldId: recoveryInput.sourceDraft.worldId };
    }
    return {
      schemaVersion: SCHEMA, consoleSessionId: result.consoleSessionId, workspaceId: result.workspaceId,
      persistSequence: result.persistSequence, startedAt: result.startedAt, updatedAt: result.updatedAt,
      status: result.status, runtimePhase: result.runtimePhase, input: recoveryInput,
      scenario: result.scenario ? { worldDraftId: result.scenario.worldDraftId, worldDraftRevisionId: result.scenario.worldDraftRevisionId,
        draft: result.scenario.draft ? { worldDraftId: result.scenario.draft.worldDraftId, worldId: result.scenario.draft.worldId,
          stateRevision: result.scenario.draft.stateRevision, currentRevisionNumber: result.scenario.draft.currentRevisionNumber } : null } : null,
      experiment: result.experiment ? { experimentId: result.experiment.experimentId, status: result.experiment.status } : null,
      compiledPlans: null, compilerTracks: result.compilerTracks, runtimeTracks: result.runtimeTracks,
      previewRuns: { current: result.previewRuns?.current ? { runId: result.previewRuns.current.runId,
        identitySnapshot: result.previewRuns.current.identitySnapshot, actorStates: result.previewRuns.current.actorStates } : null },
      opening: { current: compactExecution(result.opening?.current) },
      pendingCommand: clone(pending),
      pendingStart: clone(result.pendingStart), release: clone(result.release),
      turns: (result.turns || []).map((turn) => ({ kind: turn.kind || turn.current?.payload?.type,
        current: compactExecution(turn.current) })), 
      initialProjections: { current: null }, finalProjections: { current: null }, finalProjectionIssues: { current: [] },
      trace: null, traceError: null, operations: [], error: clone(result.error), evidenceNeedsRefresh: true,
    };
  }
  function removeEvidence(prefix) {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix + 'evidence:')) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  }
  function saveSession(result) {
    const prefix = storagePrefix();
    if (!prefix || !result) return result;
    result.consoleSessionId ||= uid();
    result.workspaceId = B.workspaceId();
    result.updatedAt = now();
    result.persistSequence = Number(result.persistSequence || 0) + 1;
    const controlKey = prefix + 'control:' + result.consoleSessionId;
    const minimal = JSON.stringify(controlRecord(result));
    try {
      // Persist the write fence before large diagnostic evidence. Under quota
      // pressure discard reconstructible evidence, never the recovery identity.
      try { sessionStorage.setItem(controlKey, minimal); }
      catch (_) { removeEvidence(prefix); sessionStorage.setItem(controlKey, minimal); }
      sessionStorage.setItem(prefix + 'latest', result.consoleSessionId);
      delete result.storageWarning;
      try {
        const full = JSON.stringify(result);
        if (full.length <= 512000) sessionStorage.setItem(prefix + 'evidence:' + result.consoleSessionId, full);
        else sessionStorage.removeItem(prefix + 'evidence:' + result.consoleSessionId);
      } catch (_) { /* Minimal recovery record is already safe. */ }
    } catch (_) {
      result.storageWarning = '浏览器无法保存恢复信息；请保持此页面打开，后台操作仍受当前命令锁保护。';
    }
    return result;
  }
  function restoreSession(id) {
    const prefix = storagePrefix();
    if (!prefix || !id) return null;
    try {
      const control = JSON.parse(sessionStorage.getItem(prefix + 'control:' + id) || 'null');
      if (control?.schemaVersion !== SCHEMA || control.workspaceId !== B.workspaceId()) return null;
      const full = JSON.parse(sessionStorage.getItem(prefix + 'evidence:' + id) || 'null');
      return full?.persistSequence === control.persistSequence ? full : control;
    } catch (_) { return null; }
  }
  function restore() {
    const prefix = storagePrefix();
    return prefix ? restoreSession(sessionStorage.getItem(prefix + 'latest')) : null;
  }
  function listSessions() {
    const prefix = storagePrefix();
    if (!prefix) return [];
    const rows = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(prefix + 'control:')) continue;
      const result = restoreSession(key.slice((prefix + 'control:').length));
      if (result) rows.push({
        id: result.consoleSessionId, title: result.input?.title || '未命名测试',
        updatedAt: result.updatedAt, phase: result.runtimePhase,
        runId: result.previewRuns?.current?.runId || null,
        experimentId: result.experiment?.experimentId || null,
      });
    }
    return rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  function newResult(input) {
    return {
      schemaVersion: SCHEMA, consoleSessionId: uid(), workspaceId: B.workspaceId(),
      startedAt: now(), updatedAt: now(), status: 'draft', runtimePhase: 'draft',
      input, scenario: null, experiment: null, compiledPlans: null,
      compilerTracks: ['current', 'v2_candidate'], runtimeTracks: ['current'],
      previewRuns: { current: null }, opening: { current: null }, turns: [],
      initialProjections: { current: null }, finalProjections: { current: null },
      finalProjectionIssues: { current: [] }, trace: null, traceError: null,
      operations: [], error: null, pendingCommand: null,
    };
  }
  async function operation(result, onProgress, task) {
    if (!B.connected()) throw fail('请先登录测试环境', 'SLICE_EVAL_SESSION_EXPIRED');
    if (result.workspaceId && result.workspaceId !== B.workspaceId()) {
      throw fail('该会话属于其他评测工作区', 'SLICE_EVAL_WORKSPACE_MISMATCH');
    }
    const emit = (event) => {
      saveSession(result);
      onProgress({ ...event, partialResult: clone(result) });
    };
    return T.withTelemetry(result.operations, emit, async () => {
      try {
        await task(emit);
        result.updatedAt = now();
        emit({ kind: 'complete', step: result.runtimePhase, message: phaseText(result) });
        return result;
      } catch (error) {
        if (error.status !== 401 && result.experiment?.experimentId) { try { await T.refreshTrace(result); } catch (_) {} }
        result.error = T.compactError(error);
        result.status = result.pendingCommand ? 'waiting_for_backend' : 'waiting_with_issues';
        if (result.pendingCommand) result.runtimePhase = 'waiting_for_backend';
        emit({ kind: 'failed', message: error.message, error: result.error });
        error.partialResult = clone(result);
        throw error;
      }
    });
  }
  function phaseText(result) {
    if (result.pendingCommand) return '后台仍在执行原操作，正在观察同一命令';
    if (result.runtimePhase === 'opening_waiting_for_user') return '开局已建立，等待你确认开场帖子';
    if (result.runtimePhase === 'compiled_waiting_for_user') return '编译完成，等待你选角并开始';
    if (result.runtimePhase === 'draft') return '剧本已保存，等待你开始编译';
    return '本次操作已返回，等待你的下一次操作';
  }
  function normalizedInput(input) {
    const normalized = T.validateInput({
      ...input, description: input.description || input.worldDescription,
      setting: input.setting || input.worldSetting, goal: input.goal || input.worldGoal,
      evaluationMode: 'experience', evaluationInstruction: '', playerActions: [], highlightDescription: null,
      sourceWorldDraftRevisionId: null, sourceDocument: input.sourceDocument || null,
    });
    normalized.characters = (normalized.characters || []).map((row) => {
      const source = (input.characters || []).find((entry) => entry.characterVersionId === row.characterVersionId) || row;
      return { ...row, playable: source.playable !== false, starterRecommended: source.starterRecommended === true,
        starterPriority: Number.isInteger(source.starterPriority) ? source.starterPriority : null };
    });
    delete normalized.highlightDescription;
    normalized.sourceContent = clone(input.sourceContent || null);
    return normalized;
  }
  function revisionRequest(draft, input) {
    const request = T.buildCreateWorldDraftRevisionRequest(draft, input);
    if (input.sourceContent) {
      const edited = request.content;
      request.content = { ...clone(input.sourceContent), worldCore: edited.worldCore, coverAssetId: null,
        topicTags: edited.topicTags,
        ...(input.sourceDocument ? { sourceDocument: clone(input.sourceDocument) } : {}) };
    }
    delete request.content.highlightDescription; // Not part of the formal V6 write DTO.
    request.content.characterBindings = (input.characterVersionIds || []).map((characterVersionId, index) => {
      const selected = (input.characters || []).find((entry) => entry.characterVersionId === characterVersionId);
      return { characterVersionId, playable: selected?.playable !== false,
        starterRecommended: selected ? selected.starterRecommended === true : index === 0,
        starterPriority: selected ? selected.starterPriority ?? null : index + 1 };
    });
    return request;
  }

  function activityDefinitionRequest(definition, worldDraftId) {
    const result = {
      title: String(definition.title || '').trim(),
      playerSafeTeaser: String(definition.playerSafeTeaser || '').trim() || null,
      sceneDescription: String(definition.sceneDescription || '').trim(),
      locationLabel: String(definition.locationLabel || '').trim(),
      backgroundAssetId: null,
      requiredParticipantActorRefs: [...new Set(definition.requiredParticipantActorRefs || [])],
      optionalParticipantActorRefs: [...new Set(definition.optionalParticipantActorRefs || [])],
      trigger: clone(definition.trigger || { schemaVersion: 'slice.creator-activity-trigger.v1', mode: 'all', conditions: [], anyGroups: [] }),
      actorKnowledgeSeeds: clone(definition.actorKnowledgeSeeds || []),
      specialRules: clone(definition.specialRules || []),
      outcomeSpace: clone(definition.outcomeSpace || {
        resolutionMode: 'runtime_resolved', candidateResolutionPolicy: 'runtime_selects_zero_or_more',
        candidates: [], allowedOutcomeBands: ['ordinary'], relationshipAxesMayChange: [],
        worldStatsMayChange: [], endingEvidenceCodes: [], humanActorOutcomePolicy: 'attempt_resolve_only',
      }),
      sourceRefs: clone(definition.sourceRefs?.length ? definition.sourceRefs : ['world-draft:' + worldDraftId]),
    };
    const participantRefs = [...result.requiredParticipantActorRefs, ...result.optionalParticipantActorRefs];
    if (participantRefs.length < 1 || participantRefs.length > 8 || new Set(participantRefs).size !== participantRefs.length) throw fail('预制活动需要选择 1–8 位不重复的参与人物（可包含当前玩家）');
    for (const [key, label] of [['title', '标题'], ['sceneDescription', '场景描述'], ['locationLabel', '地点']]) {
      if (!result[key]) throw fail('请填写预制活动的' + label);
    }
    return result;
  }
  async function saveActivityDefinitions(input, result, worldDraftId, emit) {
    if (!Array.isArray(input.activityDefinitions)) return;
    if (input.activityDefinitions.length > 8) throw fail('一个剧本最多配置 8 个预制活动');
    const existing = items(await T.call('evalListActivityDefinitions', { params: { worldDraftId } }));
    const selectedIds = new Set(input.activityDefinitions.map((row) => row.activityDefinitionId).filter(Boolean));
    for (const id of new Set([...(input.originalActivityDefinitionIds || []), ...(input.removedActivityDefinitionIds || [])])) {
      if (selectedIds.has(id)) continue;
      const current = existing.find((row) => row.activityDefinitionId === id);
      if (!current || current.status === 'archived') continue;
      await T.call('evalArchiveActivityDefinition', {
        params: { worldDraftId, activityDefinitionId: id }, key: 'console-archive-activity-' + uid(),
        body: { expectedRevision: current.revision },
      });
    }
    const saved = [];
    for (const definition of input.activityDefinitions) {
      const body = activityDefinitionRequest(definition, worldDraftId);
      const activityDefinitionId = definition.activityDefinitionId;
      let receipt;
      if (activityDefinitionId) {
        const current = existing.find((row) => row.activityDefinitionId === activityDefinitionId);
        if (!current || current.status === 'archived') throw fail('这个预制活动已不在当前草稿中，请刷新');
        if (definition.revision && definition.revision !== current.revision) throw fail('预制活动已被修改，请重新读取后编辑', 'SLICE_ACTIVITY_REVISION_CONFLICT');
        receipt = await T.call('evalUpdateActivityDefinition', {
          params: { worldDraftId, activityDefinitionId }, key: 'console-update-activity-' + uid(),
          body: { expectedRevision: current.revision, ...body },
        });
      } else {
        receipt = await T.call('evalCreateActivityDefinition', {
          params: { worldDraftId }, key: 'console-create-activity-' + uid(), body,
        });
      }
      saved.push(receipt);
      result.input.activityDefinitions = clone([...saved, ...input.activityDefinitions.slice(saved.length)]);
      result.input.originalActivityDefinitionIds = [...new Set([...(input.originalActivityDefinitionIds || []), ...saved.map((row) => row.activityDefinitionId)])];
      emit({ kind: 'checkpoint', step: 'scenario', message: '预制活动已保存：' + body.title });
    }
    result.input.activityDefinitions = saved;
    result.input.originalActivityDefinitionIds = saved.map((row) => row.activityDefinitionId);
  }

  function stableJson(value) {
    if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
    return JSON.stringify(value) ?? 'null';
  }
  function sourceFingerprint(input) {
    return stableJson({
      title: input.title || '', description: input.description || '', setting: input.setting || '', goal: input.goal || '',
      topicTags: input.topicTags || [],
      characterVersionIds: input.characterVersionIds || [],
      characters: (input.characters || []).map((row) => ({
        characterVersionId: row.characterVersionId, playable: row.playable !== false,
        starterRecommended: row.starterRecommended === true, starterPriority: row.starterPriority ?? null,
      })),
      activityDefinitions: (input.activityDefinitions || []).map((row) => ({
        activityDefinitionId: row.activityDefinitionId || null, ...activityDefinitionRequest(row, input.worldDraftId),
      })),
      removedActivityDefinitionIds: input.removedActivityDefinitionIds || [],
      sourceDocumentDigest: input.sourceDocument?.contentDigest || null,
    });
  }
  async function saveDraft(input, onProgress = () => {}) {
    const unchangedSource = input.worldDraftRevisionId && input.sourceFingerprint
      && input.sourceFingerprint === sourceFingerprint(input);
    if (unchangedSource) {
      const normalized = normalizedInput({ ...input, sourceDocument: input.sourceDocument?.body ? input.sourceDocument : null });
      const result = newResult(normalized);
      result.input.worldDraftId = input.worldDraftId; result.input.worldDraftRevisionId = input.worldDraftRevisionId;
      result.input.activityDefinitions = clone(input.activityDefinitions || []);
      result.input.originalActivityDefinitionIds = clone(input.originalActivityDefinitionIds || []);
      result.input.sourceFingerprint = input.sourceFingerprint;
      result.input.sourceHasDocument = Boolean(input.sourceHasDocument);
      result.input.sourceDocument = clone(input.sourceDocument);
      result.input.sourceDraft = clone(input.sourceDraft);
      result.scenario = { imported: true, draft: clone(input.sourceDraft), revision: null,
        worldDraftId: input.worldDraftId, worldDraftRevisionId: input.worldDraftRevisionId };
      return operation(result, onProgress, async (emit) => {
        // Read the selected immutable source again. The compiler binds this exact
        // revision, so an existing long-form script never becomes four fields.
        result.scenario.revision = await T.call('evalGetWorldDraftRevision', {
          params: { worldDraftId: input.worldDraftId, worldDraftRevisionId: input.worldDraftRevisionId },
        });
        result.status = 'draft_saved'; result.runtimePhase = 'draft';
        emit({ kind: 'checkpoint', step: 'scenario', message: '使用原始剧本版本；原文与预制活动保持原版本内容' });
      });
    }
    if (input.sourceHasDocument && !input.sourceDocument?.body) throw fail(
      '这个剧本包含完整原文，但当前接口没有返回原文正文；可直接编译原版本，编辑后保存需要先恢复完整原文，不能只用摘要覆盖。',
      'SLICE_EVAL_SOURCE_DOCUMENT_UNAVAILABLE');
    const normalized = normalizedInput(input);
    const result = newResult(normalized);
    return operation(result, onProgress, async (emit) => {
      const existingDraftId = input.worldDraftId || input.scenario?.worldDraftId;
      let draft;
      if (existingDraftId) {
        const previousDraft = await T.call('evalGetWorldDraft', { params: { worldDraftId: existingDraftId } });
        draft = await T.call('evalSaveWorldDraftSeed', {
          params: { worldDraftId: existingDraftId }, key: 'console-save-seed-' + uid(),
          body: { expectedStateRevision: previousDraft.stateRevision, ...T.buildCreateWorldDraftRequest(normalized) },
        });
      } else {
        draft = await T.call('evalCreateWorldDraft', {
          key: 'console-draft-' + uid(), body: T.buildCreateWorldDraftRequest(normalized),
        });
      }
      const worldDraftId = draft.worldDraftId || draft.draftId;
      if (!worldDraftId) throw fail('后端没有返回草稿 ID');
      result.scenario = { draft, worldDraftId, revision: null, worldDraftRevisionId: null };
      emit({ kind: 'checkpoint', step: 'scenario', message: '草稿已保存；保存当前文本和人物配置' });
      await saveActivityDefinitions(input, result, worldDraftId, emit);
      // Activity authoring may advance the draft state; freeze from its latest authority.
      if (Array.isArray(input.activityDefinitions)) draft = await T.call('evalGetWorldDraft', { params: { worldDraftId } });
      const revision = await T.call('evalCreateWorldDraftRevision', {
        params: { worldDraftId }, key: 'console-revision-' + uid(),
        body: revisionRequest(draft, normalized),
      });
      const worldDraftRevisionId = revision.worldDraftRevisionId || revision.draftRevisionId || revision.revisionId;
      if (!worldDraftRevisionId) throw fail('后端没有返回草稿版本 ID');
      result.scenario = { imported: false, draft, revision, worldDraftId, worldDraftRevisionId };
      result.input.worldDraftId = worldDraftId;
      result.input.worldDraftRevisionId = worldDraftRevisionId;
      result.input.sourceDocument = clone(normalized.sourceDocument);
      result.input.sourceHasDocument = Boolean(normalized.sourceDocument);
      result.input.sourceDraft = clone(draft);
      result.input.sourceFingerprint = sourceFingerprint(result.input);
      result.status = 'draft_saved'; result.runtimePhase = 'draft';
    });
  }
  async function compile(previous, onProgress = () => {}) {
    let result = previous?.schemaVersion === SCHEMA ? clone(previous) : await saveDraft(previous, onProgress);
    if (!result.scenario?.worldDraftRevisionId) throw fail('请先保存剧本');
    if (result.previewRuns?.current) throw fail('已有游玩会话，不能在同一会话内重新编译');
    return operation(result, onProgress, async (emit) => {
      result.status = 'running'; result.runtimePhase = 'compiling'; result.error = null;
      if (!result.experiment?.experimentId) {
        result.experiment = await T.createCompilerExperimentWithRecovery(
          { ...result.input, evaluationMode: 'experience', evaluationInstruction: '', playerActions: [] },
          result.scenario.worldDraftRevisionId, emit,
        );
        emit({ kind: 'checkpoint', step: 'compile', message: capabilities().compilerNotice });
      }
      result.experiment = await T.waitForExperiment(result.experiment.experimentId, emit, { result });
      result.compiledPlans = await T.call('getCompilerRuntimeEvalPlans', {
        params: { experimentId: result.experiment.experimentId },
      });
      if (result.compiledPlans.experimentId !== result.experiment.experimentId
        || result.compiledPlans.worldDraftRevisionId !== result.scenario.worldDraftRevisionId
        || !result.compiledPlans.tracks?.some((track) => track.trackCode === 'current' && track.status === 'available' && track.planJson)) {
        throw fail('当前编译产物与剧本版本不一致或缺失', 'SLICE_EVAL_PLAN_PIN_MISMATCH');
      }
      await T.refreshTrace(result);
      result.status = 'compiled_waiting_for_user'; result.runtimePhase = 'compiled_waiting_for_user';
      result.evidenceNeedsRefresh = false;
    });
  }
  async function readCurrent(result) {
    const runId = result.previewRuns?.current?.runId;
    if (!runId) return;
    result.finalProjections.current = await T.readExperienceProjections(runId);
    for (const [name, operationId] of [['characterSlots', 'evalListRunCharacterSlots'], ['chapter', 'evalGetRunChapter'], ['settings', 'evalGetRunSettings'], ['customization', 'evalGetRunCustomization']]) {
      try { result.finalProjections.current[name] = { status: 'succeeded', value: await T.call(operationId, { params: { runId } }), error: null }; }
      catch (error) { if (error.status === 401) throw error; result.finalProjections.current[name] = { status: 'failed', value: null, error: T.compactError(error) }; }
    }
    result.finalProjectionIssues.current = T.projectionIssues(result.finalProjections.current);
  }
  async function start(previous, selection = {}, onProgress = () => {}) {
    const result = clone(previous);
    if (!result?.compiledPlans || result.previewRuns?.current || result.pendingCommand) throw fail('请从已编译且尚未开局的剧本开始');
    return operation(result, onProgress, async () => {
      if (selection.playerCharacterVersionId && result.input.characters?.find((row) => row.characterVersionId === selection.playerCharacterVersionId)?.playable === false) throw fail('所选人物未开放为可扮演角色');
      const input = normalizedInput({ ...result.input, ...selection, sourceDocument: result.input.sourceDocument?.body ? result.input.sourceDocument : null });
      const followerCandidateIds = (input.characterVersionIds || []).filter((id) => id !== input.playerCharacterVersionId);
      if (input.playerCharacterVersionId && !followerCandidateIds.length) throw fail('扮演角色后至少还需要一名已绑定的互动人物', 'SLICE_EVAL_FIRST_FOLLOWER_MISSING');
      if (followerCandidateIds.length && !input.firstFollowerCharacterVersionId) throw fail('请选择首位互动人物', 'SLICE_EVAL_FIRST_FOLLOWER_MISSING');
      if (input.firstFollowerCharacterVersionId && !followerCandidateIds.includes(input.firstFollowerCharacterVersionId)) throw fail('首位互动人物必须选择本次已绑定且不同于玩家的人物', 'SLICE_EVAL_FIRST_FOLLOWER_INVALID');
      const requestBody = T.previewRunRequest(input, 'current');
      if (result.pendingStart && JSON.stringify(result.pendingStart.body) !== JSON.stringify(requestBody)) throw fail('上次开局的接收状态未知，请先恢复原选择');
      result.input = { ...result.input, ...input, sourceDocument: clone(result.input.sourceDocument) };
      result.pendingStart ||= { key: 'console-preview-' + uid(), body: requestBody };
      saveSession(result);
      const current = await T.call('createCompilerExperimentPreviewRun', {
        params: { experimentId: result.experiment.experimentId }, key: result.pendingStart.key,
        body: result.pendingStart.body,
      });
      result.pendingStart = null;
      result.previewRuns.current = current;
      T.assertPreviewIdentity(current, input);
      await readCurrent(result);
      result.initialProjections.current = clone(result.finalProjections.current);
      await T.refreshTrace(result);
      result.status = 'opening_waiting_for_user'; result.runtimePhase = 'opening_waiting_for_user';
    });
  }

  function requiredId(value, label) {
    const id = String(value || '').trim();
    if (!id) throw fail('请选择' + label);
    return id;
  }
  function requiredBody(value) {
    const body = String(value || '').trim();
    if (!body || [...body].length > 4000) throw fail('请输入 1–4000 字的正文');
    return body;
  }
  function normalizeAction(input) {
    const action = clone(input || {});
    const type = action.type;
    if (type === 'confirm_opening_post') return { type, ...(action.body ? { body: requiredBody(action.body) } : {}) };
    if (type === 'post') return { type, body: requiredBody(action.body), visibility: action.visibility || 'public' };
    if (type === 'comment') return { type, rootPostId: requiredId(action.rootPostId || action.postId, '帖子'), body: requiredBody(action.body) };
    if (type === 'reply') return { type, rootPostId: requiredId(action.rootPostId || action.postId, '帖子'),
      parentContentId: requiredId(action.parentContentId || action.parentReplyId || action.replyId, '评论'), body: requiredBody(action.body) };
    if (type === 'dm_message') {
      if (!action.channelId && !action.targetActorId) throw fail('请选择私聊会话或人物');
      return { type, channelId: action.channelId || null, targetActorId: action.targetActorId || null, body: requiredBody(action.body) };
    }
    if (type === 'event_action') {
      if (Boolean(action.choiceId) === Boolean(String(action.body || '').trim())) throw fail('事件回应请选择一个选项或填写正文');
      return { type, eventId: requiredId(action.eventId, '事件'),
        ...(action.choiceId ? { choiceId: action.choiceId } : { body: requiredBody(action.body) }) };
    }
    if (['activity_create', 'activity_update'].includes(type)) {
      if (!action.payload || typeof action.payload !== 'object' || Array.isArray(action.payload)) throw fail('请填写活动配置');
      for (const [key, label, maximum] of [['title', '标题', 160], ['when', '时间', 240], ['location', '地点', 240], ['sceneDescription', '场景描述', 4000], ['purpose', '目的', 1000]]) {
        const value = String(action.payload[key] || '').trim();
        if (!value || [...value].length > maximum) throw fail('活动' + label + '需填写 1–' + maximum + ' 字');
        action.payload[key] = value;
      }
      action.payload.backgroundAssetRef = null;
      return { type, payload: action.payload, ...(type === 'activity_update' ? { activityAttemptId: requiredId(action.activityAttemptId, '活动邀请') } : {}) };
    }
    if (['activity_enter', 'activity_invite_response'].includes(type)) {
      if (type === 'activity_invite_response' && !['ACCEPTED', 'REJECTED', 'IGNORED'].includes(action.response)) throw fail('请选择有效的活动回应');
      return { type, activityAttemptId: requiredId(action.activityAttemptId, '活动邀请'),
        ...(type === 'activity_invite_response' ? { response: action.response } : {}) };
    }
    if (['activity_turn', 'activity_exit'].includes(type)) {
      return { type, activityId: requiredId(action.activityId, '进行中的活动'),
        ...(type === 'activity_turn' ? { body: requiredBody(action.body) } : { status: 'exited' }) };
    }
    if (type === 'select_character_slot') return { type, slotId: requiredId(action.slotId, '已解锁人物位'), characterVersionId: requiredId(action.characterVersionId, '人物') };
    throw fail('不支持的玩家操作：' + String(type || '未指定'));
  }

  async function resolveMutation(result, action) {
    const runId = result.previewRuns.current.runId;
    const run = await T.call('evalGetRun', { params: { runId } });
    const expectedRunRevision = run.revision;
    const payload = clone(action);
    let operationId = 'evalSubmitWorldCommand', params = { runId }, body;
    if (action.type === 'confirm_opening_post') payload.body ||= T.readOpeningBody(run);
    if (action.type === 'dm_message') {
      if (!action.channelId) {
        const cast = await T.call('evalListRunCast', { params: { runId } });
        const castRows = items(cast).length ? items(cast) : cast.entries || [];
        if (!castRows.some((row) => (row.actorId || row.actor?.actorId) === action.targetActorId)) {
          throw fail('所选人物不在当前可见人物列表中', 'SLICE_EVAL_DM_TARGET_MISSING');
        }
        // Public DmChannel has no channelType. The owner resolves/reuses the
        // exact direct channel by participant identity, so a scene conversation
        // that happens to include this actor can never become the target.
        const receipt = await T.call('evalCreateDmChannel', {
          params: { runId }, key: 'console-dm-channel-' + uid(),
          body: { channelType: 'direct', participantActorIds: [action.targetActorId] },
        });
        payload.channelId = requiredId(receipt.channelId, '服务端私聊会话');
      }
      delete payload.targetActorId;
    }
    if (action.type === 'event_action') {
      const event = items(await T.call('evalListRunEvents', { params: { runId } })).find((row) => row.eventId === action.eventId);
      if (!event || !['active', 'available'].includes(event.state)) throw fail('所选事件当前不可回应');
      if (action.choiceId && !event.choices?.some((choice) => choice.choiceId === action.choiceId)) throw fail('所选选项不属于这个事件');
      if (action.body && event.freeInputAllowed !== true) throw fail('这个事件不支持自由输入');
    }
    if (action.type === 'activity_create') {
      operationId = 'evalCreateActivityAttempt'; body = { expectedRunRevision, payload: action.payload };
    } else if (['activity_update', 'activity_enter', 'activity_invite_response'].includes(action.type)) {
      const attempt = items(await T.call('evalListActivityAttempts', { params: { runId } })).find((row) => row.activityAttemptId === action.activityAttemptId);
      if (!attempt) throw fail('找不到所选活动邀请');
      params.activityAttemptId = action.activityAttemptId;
      if (action.type === 'activity_update') {
        operationId = 'evalUpdateActivityAttempt'; body = { expectedRunRevision, expectedAttemptRevision: attempt.stateRevision, payload: action.payload };
      } else if (action.type === 'activity_enter') {
        operationId = 'evalEnterActivity'; body = { expectedRunRevision };
      } else {
        const actorId = (run.actorStates || result.previewRuns.current.actorStates || []).find((row) => row.kind === 'player')?.actorId;
        if (!actorId) throw fail('服务端没有返回当前可控玩家');
        const invitation = (attempt.invitationStates || []).find((row) => row.actorId === actorId && row.controllerType === 'human');
        if (invitation?.status !== 'PENDING') throw fail('当前玩家没有可回应的活动邀请');
        operationId = 'evalRespondActivityInvite'; body = { actorId, response: action.response };
      }
    } else if (['activity_turn', 'activity_exit'].includes(action.type)) {
      const activity = await T.call('evalGetActivityInstance', { params: { runId, activityId: action.activityId } });
      if (activity.status !== 'active') throw fail('所选活动已不在进行中');
      params.activityId = action.activityId;
      operationId = action.type === 'activity_turn' ? 'evalSubmitActivityAction' : 'evalExitActivity';
      body = { expectedRunRevision, expectedSceneRevision: activity.sceneRevision,
        ...(action.type === 'activity_turn' ? { body: action.body } : { status: 'exited' }) };
    } else if (action.type === 'select_character_slot') {
      const slot = items(await T.call('evalListRunCharacterSlots', { params: { runId } })).find((row) => row.slotId === action.slotId);
      if (slot?.state !== 'pending_selection') throw fail('所选人物位当前不可添加人物');
      const candidates = items(await T.call('evalListRunCharacterCandidates', { params: { runId, slotId: action.slotId } }));
      if (!candidates.some((row) => row.characterVersionId === action.characterVersionId)) throw fail('所选人物不在此人物位的可用列表内');
    }
    return { operationId, params, body: body || { expectedRunRevision, payload }, runBefore: run };
  }

  function currentExecution(result) {
    const index = result.pendingCommand?.turnIndex;
    return Number.isInteger(index) ? result.turns[index]?.current : null;
  }
  function finishFence(result, execution) {
    if (execution.payload.type === 'confirm_opening_post') result.opening.current = clone(execution);
    result.pendingCommand = null;
    result.runtimePhase = execution.payload.type === 'confirm_opening_post' && execution.status !== 'applied'
      ? 'opening_waiting_for_user' : 'waiting_for_user';
    result.status = execution.status === 'applied' && !execution.error ? 'waiting_for_user' : 'waiting_with_issues';
  }
  async function admitPending(result, emit) {
    const pending = result.pendingCommand;
    const execution = currentExecution(result);
    try {
      const receipt = await T.call(pending.operationId, {
        params: pending.params, key: pending.key, body: pending.body,
      });
      execution.accepted = clone(receipt);
      if (!receipt?.commandId) {
        if (['evalSubmitWorldCommand', 'evalSubmitActivityAction'].includes(pending.operationId)) {
          pending.status = 'admission_unknown';
          throw fail('已接收操作但未返回命令 ID，请检查接口记录', 'SLICE_EVAL_COMMAND_ID_MISSING');
        }
        execution.status = 'applied'; execution.activityResponse = clone(receipt);
        execution.completedAt = now(); finishFence(result, execution);
      } else {
        pending.commandId = receipt.commandId; pending.status = 'processing'; execution.status = 'processing';
        emit({ kind: 'checkpoint', step: 'runtime', message: '操作已接收；后台处理同一命令，不自动提交下一步' });
      }
    } catch (error) {
      execution.error = T.compactError(error);
      const notDispatched = ['SLICE_EVAL_OPERATION_UNAVAILABLE', 'SLICE_EVAL_INPUT_INVALID'].includes(error.code);
      const uncertain = !notDispatched && (error.status == null || error.status >= 500 || error.status === 408);
      if (uncertain) {
        pending.status = 'admission_unknown'; result.runtimePhase = 'waiting_for_backend'; result.status = 'waiting_for_backend';
      } else {
        execution.status = 'rejected'; execution.completedAt = now(); finishFence(result, execution);
      }
      throw error;
    }
  }
  async function observePending(result, emit, { budgetMs = 0 } = {}) {
    let pending = result.pendingCommand;
    if (!pending) return;
    if (!pending.commandId) {
      await admitPending(result, emit); // Same persisted key and body; never a new action.
      pending = result.pendingCommand;
      if (!pending) return;
    }
    const started = performance.now();
    let count = 0;
    do {
      const execution = currentExecution(result);
      let command;
      try {
        command = await T.call('evalGetWorldCommand', {
          params: { runId: result.previewRuns.current.runId, commandId: pending.commandId },
        });
      } catch (error) {
        execution.error = T.compactError(error);
        result.status = 'waiting_for_backend'; result.runtimePhase = 'waiting_for_backend';
        throw error;
      }
      execution.command = clone(command);
      if (command.status === 'rejected') {
        execution.status = 'rejected'; execution.completedAt = now();
        execution.error = { code: command.errorCode || 'SLICE_RUNTIME_COMMAND_REJECTED', message: '后端拒绝了本次操作' };
        finishFence(result, execution); return;
      }
      if (command.status === 'applied') {
        execution.status = 'applied'; execution.completedAt = now(); execution.error = null;
        // The command is terminal even if a projection/Outcome read subsequently fails.
        finishFence(result, execution);
        try {
          execution.outcome = await T.waitForOutcome(result.previewRuns.current.runId, pending.commandId);
          if (execution.outcome?.status === 'rejected') {
            execution.status = 'rejected'; result.status = 'waiting_with_issues';
            execution.error = { code: execution.outcome.rejectionCode, message: execution.outcome.narrativeSummary };
          }
        } catch (error) {
          execution.error = T.compactError(error); result.status = 'waiting_with_issues';
        }
        if (execution.payload.type === 'confirm_opening_post') result.opening.current = clone(execution);
        return;
      }
      if (!['accepted', 'processing'].includes(command.status)) {
        execution.error = { code: 'SLICE_EVAL_COMMAND_STATUS_UNKNOWN', message: '后端命令状态尚未识别：' + String(command.status) };
        break;
      }
      execution.status = 'processing';
      if (performance.now() - started >= budgetMs) break;
      emit({ kind: 'checkpoint', step: 'runtime', message: '后台处理中，等待同一命令的最终结果' });
      await pause(Math.min([1000, 2000, 3000, 5000][Math.min(count++, 3)], Math.max(0, budgetMs - (performance.now() - started))));
    } while (performance.now() - started <= budgetMs);
    result.status = 'waiting_for_backend'; result.runtimePhase = 'waiting_for_backend';
  }
  async function act(previous, rawAction, onProgress = () => {}) {
    const result = clone(previous);
    if (!result?.previewRuns?.current?.runId) throw fail('请先选角并开始游玩');
    if (result.pendingCommand) throw fail('上一条操作仍在后端处理，请等待完成', 'SLICE_EVAL_WRITE_PENDING');
    const action = normalizeAction(rawAction);
    if (result.runtimePhase === 'opening_waiting_for_user' && action.type !== 'confirm_opening_post') throw fail('请先确认开场帖子');
    if (action.type === 'confirm_opening_post' && result.opening.current?.status === 'applied') throw fail('开场帖子已经确认');
    return operation(result, onProgress, async (emit) => {
      result.error = null;
      const mutation = await resolveMutation(result, action);
      const execution = {
        status: 'submitting', payload: clone(action), startedAt: now(), completedAt: null,
        runBefore: mutation.runBefore, accepted: null, command: null, outcome: null,
        projectionsBefore: clone(result.finalProjections.current), projections: null, error: null,
      };
      result.turns.push({ kind: action.type, actionPayload: clone(action), current: execution });
      result.pendingCommand = {
        operationId: mutation.operationId, params: mutation.params, body: mutation.body,
        key: 'console-' + action.type + '-' + uid(), commandId: null,
        status: 'submitting', turnIndex: result.turns.length - 1,
      };
      result.status = 'waiting_for_backend'; result.runtimePhase = 'waiting_for_backend';
      emit({ kind: 'checkpoint', step: 'runtime', message: '正在提交你的操作' });
      await admitPending(result, emit);
      if (result.pendingCommand) await observePending(result, emit, { budgetMs: 45000 });
      await readCurrent(result);
      execution.projections = clone(result.finalProjections.current);
      execution.projectionIssues = clone(result.finalProjectionIssues.current);
      execution.durationMs = Date.now() - Date.parse(execution.startedAt);
      await T.refreshTrace(result);
      if (!result.pendingCommand && (execution.projectionIssues.length || result.traceError)) result.status = 'waiting_with_issues';
    });
  }
  async function refresh(previous, onProgress = () => {}) {
    const result = clone(previous);
    if (!result) throw fail('没有可恢复的会话');
    if (result.release && !['published', 'blocked'].includes(result.release.status)) return publish(result, onProgress);
    if (result.experiment?.experimentId && !result.compiledPlans && !result.previewRuns.current) return compile(result, onProgress);
    return operation(result, onProgress, async (emit) => {
      if (result.pendingCommand) await observePending(result, emit);
      if (result.input.sourceHasDocument && !result.input.sourceDocument?.body && result.scenario?.worldDraftId) {
        const revision = await T.call('evalGetWorldDraftRevision', { params: {
          worldDraftId: result.scenario.worldDraftId, worldDraftRevisionId: result.scenario.worldDraftRevisionId,
        } });
        if (revision.content?.sourceDocument) {
          result.input.sourceDocument = clone(revision.content.sourceDocument);
          result.input.sourceContent = clone(revision.content);
        }
      }
      await readCurrent(result);
      if (result.experiment?.experimentId && !result.compiledPlans) result.compiledPlans = await T.call('getCompilerRuntimeEvalPlans', { params: { experimentId: result.experiment.experimentId } });
      await T.refreshTrace(result);
      const traceCommands = (result.trace?.tracks || []).filter((track) => track.trackCode === 'current')
        .flatMap((track) => track.runtimeCommands || []).filter((command) => command.runId === result.previewRuns?.current?.runId);
      for (const turn of result.turns || []) {
        const execution = turn.current;
        const commandId = execution?.accepted?.commandId || execution?.command?.commandId;
        const evidence = traceCommands.find((command) => command.commandId === commandId);
        if (!execution || !evidence) continue;
        if (evidence.input && typeof evidence.input === 'object') execution.payload = clone(evidence.input);
        if (evidence.outcome) execution.outcome = clone(evidence.outcome);
        execution.evidenceNeedsRefresh = false;
        if (turn.kind === 'confirm_opening_post') result.opening.current = clone(execution);
      }
      result.evidenceNeedsRefresh = false;
      const last = result.turns.at(-1)?.current;
      if (last && !result.pendingCommand) {
        last.projections = clone(result.finalProjections.current);
        last.projectionIssues = clone(result.finalProjectionIssues.current);
      }
    });
  }


  async function releaseMutation(result, operationId, params, body) {
    const release = result.release;
    if (release.pendingMutation && release.pendingMutation.operationId !== operationId) throw fail('请先恢复上一项发布操作');
    release.pendingMutation ||= { operationId, params, body, key: 'console-release-' + uid() };
    saveSession(result);
    const receipt = await T.call(operationId, { ...release.pendingMutation });
    release.pendingMutation = null;
    return receipt;
  }
  async function publish(previous, onProgress = () => {}) {
    const result = clone(previous);
    const worldDraftRevisionId = result?.scenario?.worldDraftRevisionId;
    const worldId = result?.scenario?.draft?.worldId;
    if (!worldDraftRevisionId || !worldId) throw fail('请先保存属于当前工作区的剧本版本');
    if (result.pendingCommand) throw fail('请等待当前玩家操作完成', 'SLICE_EVAL_WRITE_PENDING');
    if (result.release?.worldVersion) return result;
    return operation(result, onProgress, async (emit) => {
      result.release ||= {
        status: 'compiling', startedAt: now(), worldId, worldDraftRevisionId,
        compileReport: null, reviewSubmission: null, reviewDecision: null, worldVersion: null,
        usage: { status: 'not_collected', inputTokens: null, outputTokens: null, costs: null },
        costNotice: '正式发布另行执行 Creator 编译；本次调用不包含在实验双轨费用中，当前发布计量未采集。',
      };
      const release = result.release;
      if (!release.compileReport?.compileJobId) {
        emit({ kind: 'checkpoint', step: 'publish', message: '开始正式测试发布；将额外执行 Creator 编译并保留真实结果' });
        release.compileReport = await releaseMutation(result, 'evalCompileWorldDraftRevision',
          { worldDraftRevisionId }, { worldDraftRevisionId });
        saveSession(result);
      }
      const started = performance.now();
      while (['queued', 'running'].includes(release.compileReport.status)) {
        release.status = 'compiling';
        release.compileReport = await T.call('evalGetCompileReport', { params: { compileJobId: release.compileReport.compileJobId } });
        emit({ kind: 'checkpoint', step: 'publish', message: '正式编译状态：' + release.compileReport.status });
        if (!['queued', 'running'].includes(release.compileReport.status)) break;
        if (performance.now() - started > 45000) return;
        await pause(2500);
      }
      if (release.compileReport.status !== 'succeeded') {
        release.status = 'blocked';
        throw fail('正式编译未成功，请查看编译诊断', 'SLICE_EVAL_PUBLISH_COMPILE_FAILED');
      }
      const compileJobId = release.compileReport.compileJobId;
      if (!release.reviewSubmission?.reviewSubmissionId) {
        release.status = 'reviewing';
        release.reviewSubmission = await releaseMutation(result, 'evalSubmitWorldReview',
          { worldDraftRevisionId }, { worldDraftRevisionId, compileJobId });
        saveSession(result);
      }
      if (!release.reviewDecision) {
        try {
          release.reviewDecision = await T.call('evalGetWorldReviewDecision', {
            params: { reviewSubmissionId: release.reviewSubmission.reviewSubmissionId },
          });
        } catch (error) {
          if (error.status === 409 && error.code === 'SLICE_REVIEW_NOT_READY') {
            release.status = 'reviewing';
            emit({ kind: 'checkpoint', step: 'publish', message: '发布校验仍在后台执行，继续观察同一提交' });
            return;
          }
          throw error;
        }
      }
      if (release.reviewDecision.decision !== 'approved') {
        release.status = 'blocked';
        throw fail('发布校验返回：' + release.reviewDecision.decision, 'SLICE_EVAL_PUBLISH_REVIEW_FAILED');
      }
      release.status = 'publishing';
      release.worldVersion = await releaseMutation(result, 'evalPublishWorld', { worldId }, {
        worldDraftRevisionId, compileJobId, reviewDecisionId: release.reviewDecision.reviewDecisionId,
        visibility: 'private', siteBinding: null,
      });
      release.status = 'published'; release.completedAt = now();
      emit({ kind: 'checkpoint', step: 'publish', message: '剧本已按服务端返回结果发布到测试环境，权限为私密' });
    });
  }

  function scenarioRow(row) {
    const content = row.content || row.latestRevision?.content || row.currentRevision?.content || {};
    const core = content.worldCore || row.worldCore || row.seed?.worldCore || row.seed || row;
    const characters = (row.characters || content.characterBindings || row.seed?.castBindings || []).map((entry) => ({
      ...entry, characterVersionId: entry.characterVersionId,
      displayName: entry.displayName || entry.character?.displayName || '人物 ' + String(entry.characterVersionId || '').slice(0, 8),
    }));
    return {
      ...row, id: row.worldDraftId || row.id || row.worldId,
      title: core.worldName || core.title || row.title || '未命名剧本',
      description: core.worldDescription || core.description || row.worldDescription || '',
      setting: core.worldSetting || core.setting || row.worldSetting || '',
      goal: core.worldGoal || core.goal || row.worldGoal || '',
      highlightDescription: content.highlightDescription || row.highlightDescription || '',
      topicTags: content.topicTags || row.topicTags || [],
      sourceDocument: clone(content.sourceDocument || null), sourceHasDocument: Boolean(content.sourceDocument),
      sourceContent: Object.keys(content).length ? clone(content) : null,
      characterVersionIds: characters.map((entry) => entry.characterVersionId).filter(Boolean),
      characters, raw: row,
    };
  }
  function characterRow(row) {
    const version = row.currentVersion || row.version || row;
    const content = version.content || row.content || row;
    return { ...row, characterId: row.characterId || version.characterId,
      characterVersionId: version.characterVersionId || row.characterVersionId,
      displayName: content.displayName || row.displayName || '未命名人物',
      description: content.bio || '', background: content.backgroundAndKnowledge || '',
      playable: content.playable !== false, content, raw: row };
  }
  async function listAllPages(operationId, params, mapRow, rowId) {
    const collected = [], seenIds = new Set(), seenCursors = new Set();
    let cursor = null;
    while (true) {
      const page = await T.call(operationId, { ...(params ? { params } : {}),
        query: { limit: 100, ...(cursor ? { cursor } : {}) } });
      if (!Array.isArray(page?.items) || !page.pageInfo || typeof page.pageInfo.hasMore !== 'boolean'
        || !Object.hasOwn(page.pageInfo, 'nextCursor')) {
        throw fail('列表分页响应不完整，请重试；尚未读取全部数据', 'SLICE_EVAL_PAGE_INVALID');
      }
      for (const raw of page.items) {
        const row = mapRow(raw), id = rowId(row);
        if (!id) throw fail('列表项缺少真实 ID，无法确认全部数据', 'SLICE_EVAL_PAGE_INVALID');
        if (!seenIds.has(id)) { seenIds.add(id); collected.push(row); }
      }
      const nextCursor = page.pageInfo.nextCursor;
      if (nextCursor == null) {
        if (page.pageInfo.hasMore) throw fail('后台声明仍有下一页但没有返回游标；尚未读取全部数据', 'SLICE_EVAL_PAGINATION_INVALID');
        return collected;
      }
      if (typeof nextCursor !== 'string' || !nextCursor.trim()) throw fail('后台返回了无效分页游标；尚未读取全部数据', 'SLICE_EVAL_PAGINATION_INVALID');
      if (seenCursors.has(nextCursor)) throw fail('后台分页游标重复；尚未读取全部数据', 'SLICE_EVAL_PAGINATION_LOOP');
      seenCursors.add(nextCursor); cursor = nextCursor;
    }
  }
  async function listScenarios() {
    return listAllPages('evalListWorldDrafts', null, scenarioRow, (row) => row.id);
  }
  async function getScenario(row) {
    const worldDraftId = row.worldDraftId || row.id;
    const draft = await T.call('evalGetWorldDraft', { params: { worldDraftId } });
    const revisions = items(await T.call('evalListWorldDraftRevisions', { params: { worldDraftId } }));
    const latest = revisions.find((row) => row.worldDraftRevisionId === draft.currentRevisionId) || revisions.slice().sort((a, b) => Number(b.revisionNumber || b.revision || 0) - Number(a.revisionNumber || a.revision || 0))[0];
    let content = null;
    if (latest?.worldDraftRevisionId) {
      const revision = await T.call('evalGetWorldDraftRevision', { params: { worldDraftId, worldDraftRevisionId: latest.worldDraftRevisionId } });
      content = revision.content;
    }
    const selected = scenarioRow({ ...draft, ...(content ? { content } : {}), worldDraftId,
      worldDraftRevisionId: latest?.worldDraftRevisionId || draft.currentRevisionId || null });
    const ownCharacters = await listCharacters({ worldDraftId });
    const byId = new Map(ownCharacters.map((entry) => [entry.characterVersionId, entry]));
    if (!selected.characterVersionIds.length && Array.isArray(draft.seed?.characterVersionIds)) {
      selected.characterVersionIds = draft.seed.characterVersionIds;
      selected.characters = draft.seed.characterVersionIds.map((characterVersionId) => ({ characterVersionId }));
    }
    selected.characters = selected.characters.map((entry) => {
      const candidate = byId.get(entry.characterVersionId);
      return { ...(candidate || {}), ...entry, displayName: candidate?.displayName || entry.displayName };
    });
    selected.activityDefinitions = items(await T.call('evalListActivityDefinitions', { params: { worldDraftId } })).filter((row) => row.status !== 'archived');
    selected.originalActivityDefinitionIds = selected.activityDefinitions.map((row) => row.activityDefinitionId);
    selected.sourceDraft = clone(draft);
    selected.sourceFingerprint = sourceFingerprint(selected);
    return selected;
  }
  async function listCharacters(options = {}) {
    return listAllPages(options.worldDraftId ? 'evalListCharacterSlotCandidates' : 'evalListCharacters',
      options.worldDraftId ? { worldDraftId: options.worldDraftId } : null, characterRow, (row) => row.characterVersionId);
  }
  async function listRunCharacterSlots(result) {
    return items(await T.call('evalListRunCharacterSlots', { params: { runId: requiredId(result?.previewRuns?.current?.runId, '游玩会话') } }));
  }
  async function listRunCharacterCandidates(result, slotId) {
    return items(await T.call('evalListRunCharacterCandidates', { params: { runId: requiredId(result?.previewRuns?.current?.runId, '游玩会话'), slotId: requiredId(slotId, '已解锁人物位') } }));
  }

  const workspaceOperationMemory = new Map();
  function listWorkspaceOperations() {
    const prefix = storagePrefix();
    if (!prefix) return [];
    if (workspaceOperationMemory.has(prefix)) return clone(workspaceOperationMemory.get(prefix));
    try {
      const rows = JSON.parse(sessionStorage.getItem(prefix + 'workspace-operations') || '[]');
      workspaceOperationMemory.set(prefix, Array.isArray(rows) ? rows : []);
      return clone(workspaceOperationMemory.get(prefix));
    } catch (_) { return []; }
  }
  function saveWorkspaceOperation(evidence) {
    const prefix = storagePrefix();
    if (!prefix) return;
    const rows = [...listWorkspaceOperations(), clone(evidence)].slice(-40);
    workspaceOperationMemory.set(prefix, rows);
    try {
      let serialized = JSON.stringify(rows);
      while (serialized.length > 384000 && rows.length > 1) { rows.shift(); serialized = JSON.stringify(rows); }
      sessionStorage.setItem(prefix + 'workspace-operations', serialized);
    } catch (_) { /* In-memory evidence remains available for this page. */ }
  }
  async function captureWorkspaceMutation(label, task) {
    if (!B.connected()) throw fail('请先登录测试环境', 'SLICE_EVAL_SESSION_EXPIRED');
    const evidence = {
      consoleOperationId: uid(), workspaceId: B.workspaceId(), label,
      status: 'running', startedAt: now(), completedAt: null, operations: [], error: null,
    };
    try {
      const value = await T.withTelemetry(evidence.operations, () => {}, task);
      evidence.status = 'succeeded'; evidence.completedAt = now();
      saveWorkspaceOperation(evidence);
      return { value, evidence };
    } catch (error) {
      evidence.status = 'failed'; evidence.error = T.compactError(error); evidence.completedAt = now();
      saveWorkspaceOperation(evidence); error.workspaceOperationEvidence = clone(evidence); throw error;
    }
  }

  async function createCharacter(input) {
    const displayName = String(input.displayName || '').trim();
    if (!displayName || [...displayName].length > 120) throw fail('人物姓名需填写 1–120 字');
    for (const [label, value] of [['简介', input.description || input.bio], ['性格', input.personality || input.identity], ['说话风格', input.speakingStyle], ['背景知识', input.background || input.backgroundAndKnowledge]]) {
      if (!String(value || '').trim()) throw fail('请填写人物' + label);
    }
    const content = {
      displayName, bio: String(input.description || input.bio || '').trim(),
      personality: String(input.personality || input.identity || '').trim(),
      speakingStyle: String(input.speakingStyle || '').trim(),
      backgroundAndKnowledge: String(input.background || input.backgroundAndKnowledge || '').trim(),
      avatar: null, safetyBoundaries: [], supportedLocales: ['zh-CN'], playable: true, media: [],
    };
    const captured = await captureWorkspaceMutation('创建人物：' + displayName, () => T.call('evalCreateCharacter', {
      key: 'console-character-' + uid(),
      body: { initialVersion: { visibility: 'private', reusePolicy: 'owner_worlds', content } },
    }));
    return { ...characterRow(captured.value), creationEvidence: captured.evidence };
  }

  window.SliceEvalConsoleClient = Object.freeze({
    connected: B.connected, connect: B.connect, disconnect: B.disconnect, capabilities,
    listScenarios, getScenario, listCharacters, createCharacter, listWorkspaceOperations, listRunCharacterSlots, listRunCharacterCandidates,
    saveDraft, compile, start, act, publish, refresh, restore, saveSession, listSessions, restoreSession,
    __testing: Object.freeze({ sourceFingerprint, activityDefinitionRequest, normalizeAction, scenarioRow, normalizedInput, newResult, observePending, resolveMutation }),
  });
})();
