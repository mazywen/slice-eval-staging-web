(() => {
  'use strict';

  const CONTRACT_URLS = location.pathname.includes('/tools/runtime-eval-web/')
    ? ['../../packages/contracts/backend-contract.lock.json', './network-contract.json']
    : ['./network-contract.json'];
  const SESSION_KEY = 'slice-system-eval-session-v1';
  const EXPECTED = Object.freeze({
    createCompilerRuntimeEvalSession: ['POST', '/eval-api/v1/session', 201, 'compiler_runtime_eval_credential_proof', 'compiler_runtime_eval_login', 'none'],
    evalCreateWorldDraft: ['POST', '/eval-api/v1/world-drafts', 201, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    evalCreateWorldDraftRevision: ['POST', '/eval-api/v1/world-drafts/{worldDraftId}/revisions', 201, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    evalCreateCompilerExperiment: ['POST', '/eval-api/v1/world-draft-revisions/{worldDraftRevisionId}/compiler-experiments', 201, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    evalGetCompilerExperiment: ['GET', '/eval-api/v1/compiler-experiments/{experimentId}', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    createCompilerExperimentPreviewRun: ['POST', '/eval-api/v1/compiler-experiments/{experimentId}/preview-runs', 201, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    getCompilerRuntimeEvalTrace: ['GET', '/eval-api/v1/compiler-experiments/{experimentId}/trace', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    getCompilerRuntimeEvalPlans: ['GET', '/eval-api/v1/compiler-experiments/{experimentId}/plans', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalGetRun: ['GET', '/eval-api/v1/runs/{runId}', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalSubmitWorldCommand: ['POST', '/eval-api/v1/runs/{runId}/commands', 202, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    evalGetWorldCommand: ['GET', '/eval-api/v1/runs/{runId}/commands/{commandId}', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalGetOutcomeByCommand: ['GET', '/eval-api/v1/runs/{runId}/commands/{commandId}/outcome', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListRunFeed: ['GET', '/eval-api/v1/runs/{runId}/feed', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListPostReplies: ['GET', '/eval-api/v1/runs/{runId}/feed/posts/{postId}/replies', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListRunMilestones: ['GET', '/eval-api/v1/runs/{runId}/milestones', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListRunRelationships: ['GET', '/eval-api/v1/runs/{runId}/relationships', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalGetRunStats: ['GET', '/eval-api/v1/runs/{runId}/stats', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalGetRunProgression: ['GET', '/eval-api/v1/runs/{runId}/progression', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListRunEvents: ['GET', '/eval-api/v1/runs/{runId}/events', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListRunActivities: ['GET', '/eval-api/v1/runs/{runId}/activities', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListActivityInstances: ['GET', '/eval-api/v1/runs/{runId}/activity-instances', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalGetActivityInstance: ['GET', '/eval-api/v1/runs/{runId}/activity-instances/{activityId}', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListActivityAttempts: ['GET', '/eval-api/v1/runs/{runId}/activity-attempts', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListActivityCandidates: ['GET', '/eval-api/v1/runs/{runId}/activity-candidates', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalCreateActivityAttempt: ['POST', '/eval-api/v1/runs/{runId}/activity-attempts', 201, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    evalUpdateActivityAttempt: ['PATCH', '/eval-api/v1/runs/{runId}/activity-attempts/{activityAttemptId}', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    evalRespondActivityInvite: ['POST', '/eval-api/v1/runs/{runId}/activity-attempts/{activityAttemptId}/invite-response', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    evalEnterActivity: ['POST', '/eval-api/v1/runs/{runId}/activity-attempts/{activityAttemptId}/enter', 201, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    evalSubmitActivityAction: ['POST', '/eval-api/v1/runs/{runId}/activity-instances/{activityId}/actions', 202, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    evalExitActivity: ['POST', '/eval-api/v1/runs/{runId}/activity-instances/{activityId}/exit', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    evalListActivityHistory: ['GET', '/eval-api/v1/runs/{runId}/activity-history', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListRunCast: ['GET', '/eval-api/v1/runs/{runId}/cast', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListRunHistory: ['GET', '/eval-api/v1/runs/{runId}/history', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalListDmChannels: ['GET', '/eval-api/v1/runs/{runId}/dm-channels', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
    evalCreateDmChannel: ['POST', '/eval-api/v1/runs/{runId}/dm-channels', 201, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'required'],
    evalListDmMessages: ['GET', '/eval-api/v1/runs/{runId}/dm-channels/{channelId}/messages', 200, 'compiler_runtime_eval_bearer', 'compiler_runtime_eval', 'none'],
  });
  const OPERATION_STAGES = Object.freeze({
    evalCreateWorldDraft: 'scenario',
    evalCreateWorldDraftRevision: 'scenario',
    evalCreateCompilerExperiment: 'compile',
    evalGetCompilerExperiment: 'compile',
    createCompilerExperimentPreviewRun: 'preview',
    evalGetRun: 'runtime',
    evalSubmitWorldCommand: 'runtime',
    evalGetWorldCommand: 'runtime',
    evalGetOutcomeByCommand: 'runtime',
    evalListRunFeed: 'runtime',
    evalListPostReplies: 'runtime',
    evalListRunMilestones: 'runtime',
    evalListRunRelationships: 'runtime',
    evalGetRunStats: 'runtime',
    evalGetRunProgression: 'runtime',
    evalListRunEvents: 'runtime',
    evalListRunActivities: 'runtime',
    evalListActivityInstances: 'runtime',
    evalGetActivityInstance: 'runtime',
    evalListActivityAttempts: 'runtime',
    evalListActivityCandidates: 'runtime',
    evalCreateActivityAttempt: 'runtime',
    evalUpdateActivityAttempt: 'runtime',
    evalRespondActivityInvite: 'runtime',
    evalEnterActivity: 'runtime',
    evalSubmitActivityAction: 'runtime',
    evalExitActivity: 'runtime',
    evalListActivityHistory: 'runtime',
    evalListRunCast: 'runtime',
    evalListRunHistory: 'runtime',
    evalListDmChannels: 'runtime',
    evalCreateDmChannel: 'runtime',
    evalListDmMessages: 'runtime',
    getCompilerRuntimeEvalTrace: 'trace',
    getCompilerRuntimeEvalPlans: 'compile',
  });
  const state = {
    contract: null,
    operations: new Map(),
    session: readJson(sessionStorage.getItem(SESSION_KEY)),
    activeTelemetry: null,
  };

  function readJson(value) { try { return value ? JSON.parse(value) : null; } catch (_) { return null; } }
  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  const PROJECTION_READ_CONCURRENCY = 2;
  const PROJECTION_TRANSIENT_RETRY_DELAYS_MS = Object.freeze([250, 1000]);
  const COMMAND_POLL_DELAYS_MS = Object.freeze([1000, 2000, 3000, 5000]);
  const COMMAND_POLL_BUDGET_MS = 180000;
  let projectionReadsInFlight = 0;
  const projectionReadWaiters = [];
  function idempotency(prefix) { return `${prefix}-${Date.now()}-${crypto.randomUUID()}`; }
  function cloneEvidence(value) {
    if (value === undefined) return null;
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return { state: 'unserializable' }; }
  }
  function telemetryInput(operationId, { params, query, body, key } = {}) {
    return Object.freeze({
      params: cloneEvidence(params || {}),
      query: cloneEvidence(query || {}),
      body: safeOperationBody(operationId, body),
      idempotencyKeyPresent: Boolean(key),
    });
  }
  function beginOperation(operation, path, options) {
    const telemetry = state.activeTelemetry;
    if (!telemetry) return null;
    const record = {
      sequence: telemetry.records.length + 1,
      stage: OPERATION_STAGES[operation.operationId] || 'system',
      operationId: operation.operationId,
      method: operation.httpMethod.toUpperCase(),
      routePath: operation.routePath,
      resolvedPath: path,
      status: 'running',
      httpStatus: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: null,
      input: telemetryInput(operation.operationId, options),
      output: null,
      error: null,
    };
    telemetry.records.push(record);
    telemetry.onProgress({ kind: 'operation-start', operation: cloneEvidence(record) });
    return { record, startedAtMs: performance.now() };
  }
  function finishOperation(active, { response, data, error } = {}) {
    if (!active) return;
    active.record.status = error ? 'failed' : 'succeeded';
    active.record.httpStatus = response?.status ?? error?.status ?? null;
    active.record.completedAt = new Date().toISOString();
    active.record.durationMs = Math.max(0, Math.round(performance.now() - active.startedAtMs));
    active.record.output = error ? null : safeOperationOutput(active.record.operationId, data);
    active.record.error = error ? Object.freeze({
      code: String(error.code || 'SLICE_EVAL_BACKEND_REQUEST_FAILED'),
      backendCode: error.backendCode || null,
      retryability: error.retryability || null,
      message: String(error.message || error).slice(0, 500),
      response: safeOperationOutput(active.record.operationId, data),
    }) : null;
    state.activeTelemetry?.onProgress({
      kind: error ? 'operation-error' : 'operation-complete',
      operation: cloneEvidence(active.record),
    });
  }
  function messageFrom(data, response) {
    return data?.error?.message || data?.error?.messageKey || data?.message
      || data?.error?.code || data?.code || `${response.status} ${response.statusText}`;
  }
  function backendRouteError(operation, data, response) {
    const code = data?.error?.code || data?.code;
    if (response.status !== 404 || code !== 'ROUTE_NOT_FOUND') return null;
    const error = new Error(
      `staging 后端还没有部署 Eval API route：${operation.httpMethod.toUpperCase()} ${operation.routePath} 返回 404 ROUTE_NOT_FOUND。` +
      '这不是账号密码错误；需要确认对应 Eval route 已进入 slice-eval-api 并完成稳定 Origin 路由。',
    );
    error.code = 'SLICE_EVAL_ROUTE_NOT_DEPLOYED';
    error.status = response.status;
    error.operationId = operation.operationId;
    error.routePath = operation.routePath;
    return error;
  }
  function authenticationError(operation, data, response, useSession) {
    if (response.status !== 401) return null;
    const backendCode = data?.error?.code || data?.code || 'SLICE_AUTH_REQUIRED';
    const isCredentialProof = !useSession
      && operation.operationId === 'createCompilerRuntimeEvalSession';
    const error = new Error(isCredentialProof
      ? 'Eval 账号或密码不正确（POST /eval-api/v1/session → 401）。'
      : `Eval Session 已过期或被撤销（${operation.httpMethod.toUpperCase()} ${operation.routePath} → 401），请重新登录。`);
    error.code = isCredentialProof ? 'SLICE_EVAL_CREDENTIAL_INVALID' : 'SLICE_EVAL_SESSION_EXPIRED';
    error.backendCode = backendCode;
    error.status = response.status;
    return error;
  }
  function connected() {
    const valid = Boolean(state.session?.accessToken
      && new Date(state.session.expiresAt).getTime() > Date.now());
    if (!valid && state.session) disconnect();
    return valid;
  }
  function apiOrigin() {
    const value = String(window.SLICE_EVAL_AUTH?.backendApiOrigin || '').replace(/\/$/, '');
    let url;
    try { url = new URL(value); } catch (_) { throw new Error('部署包缺少有效 backendApiOrigin'); }
    if (url.protocol !== 'https:' || url.origin !== value) throw new Error('backendApiOrigin 必须是精确 HTTPS Origin');
    return value;
  }
  function validateContract(contract) {
    if (contract?.contractVersion !== '4.0.0' || !Array.isArray(contract?.operations)) {
      throw new Error('不是 Slice v4 Network Shape contract');
    }
    const operations = new Map(contract.operations.map((operation) => [operation.operationId, operation]));
    for (const [operationId, [method, path, status, authClass, , idempotency]] of Object.entries(EXPECTED)) {
      const operation = operations.get(operationId);
      if (operation?.httpMethod?.toUpperCase() !== method || operation.routePath !== path
        || operation.successStatus !== status || operation.authClass !== authClass
        || operation.idempotency !== idempotency) {
        throw new Error(`Eval operation 未通过 Network Shape 校验：${operationId}`);
      }
    }
  }
  async function loadContract() {
    if (state.contract) return state.contract;
    let lastError;
    for (const url of CONTRACT_URLS) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const contract = await response.json();
        validateContract(contract);
        state.contract = contract;
        state.operations = new Map(contract.operations.map((operation) => [operation.operationId, operation]));
        return contract;
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('Eval Network Shape contract 不可用');
  }
  function operationPath(operation, params = {}, query = {}) {
    let path = operation.routePath.replace(/\{([A-Za-z0-9]+)\}/gu, (_, key) => {
      if (!params[key]) throw new Error(`${operation.operationId} 缺少 ${key}`);
      return encodeURIComponent(params[key]);
    });
    const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (entries.length) path += `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)]))}`;
    return path;
  }
  function safeOperationBody(operationId, body) {
    if (body === undefined) return null;
    if (operationId === 'createCompilerRuntimeEvalSession') {
      return { username: String(body?.username || ''), password: '[redacted]' };
    }
    return omitSourceDocumentBody(cloneEvidence(body));
  }
  function omitSourceDocumentBody(value) {
    if (!value || typeof value !== 'object') return value;
    for (const document of [value.sourceDocument, value.content?.sourceDocument]) {
      if (document && typeof document === 'object' && Object.hasOwn(document, 'body')) {
        delete document.body;
        document.omittedFromEvidence = true;
      }
    }
    return value;
  }
  function safeOperationOutput(operationId, data) {
    if (operationId !== 'createCompilerRuntimeEvalSession' || !data || typeof data !== 'object') {
      return omitSourceDocumentBody(cloneEvidence(data));
    }
    const safe = cloneEvidence(data) || {};
    if (Object.hasOwn(safe, 'accessToken')) safe.accessToken = '[redacted]';
    return safe;
  }
  async function call(operationId, { params, query, body, key, useSession = true, recordTelemetry = true } = {}) {
    await loadContract();
    const operation = state.operations.get(operationId);
    // Additional console operations use the generated Eval bearer surface only.
    // This is an auth/transport boundary, never a deployment capability gate.
    const generatedEvalOperation = operation?.authClass === 'compiler_runtime_eval_bearer'
      && /^\/eval-api\/v1\//u.test(operation?.routePath || '')
      && !String(operation?.routePath || '').includes('..');
    if (!operation || (!EXPECTED[operationId] && !generatedEvalOperation)) {
      throw Object.assign(new Error(`Eval Network Shape 缺少对应操作：${operationId}`), { code: 'SLICE_EVAL_OPERATION_UNAVAILABLE', operationId });
    }
    if (operation.idempotency === 'required' && !key) {
      throw new Error(operationId + ' 缺少 Idempotency-Key');
    }
    const path = operationPath(operation, params, query);
    const activeOperation = recordTelemetry === false && operation.httpMethod.toUpperCase() === 'GET'
      ? null : beginOperation(operation, path, { params, query, body, key });
    if (useSession && !connected()) {
      const error = new Error('Eval Session 已过期，请重新登录');
      error.code = 'SLICE_EVAL_SESSION_EXPIRED';
      error.status = 401;
      error.operationId = operation.operationId;
      error.routePath = operation.routePath;
      disconnect();
      finishOperation(activeOperation, { error });
      throw error;
    }
    const hasBody = body !== undefined;
    let response;
    let data = {};
    try {
      response = await fetch(`${apiOrigin()}${path}`, {
        method: operation.httpMethod.toUpperCase(), mode: 'cors', cache: 'no-store',
        headers: {
          Accept: 'application/json',
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
          ...(useSession ? { Authorization: `Bearer ${state.session.accessToken}` } : {}),
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
        body: hasBody ? JSON.stringify(body) : undefined,
      });
      data = await response.json().catch(() => ({}));
    } catch (cause) {
      const error = new Error(`Eval API 网络请求失败：${operation.httpMethod.toUpperCase()} ${path}`);
      error.code = 'SLICE_EVAL_NETWORK_FAILED';
      error.status = null;
      error.operationId = operation.operationId;
      error.routePath = operation.routePath;
      error.cause = cause;
      finishOperation(activeOperation, { error });
      throw error;
    }
    if (response.status !== operation.successStatus) {
      const routeError = backendRouteError(operation, data, response);
      const authError = authenticationError(operation, data, response, useSession);
      const error = routeError || authError || new Error(messageFrom(data, response));
      error.code ||= data?.error?.code || data?.code || 'SLICE_EVAL_BACKEND_REQUEST_FAILED';
      error.backendCode ||= data?.error?.code || data?.code || null;
      error.retryability = data?.error?.retryability || null;
      error.status = response.status;
      error.operationId = operation.operationId;
      error.routePath = operation.routePath;
      error.currentRevision = data?.error?.currentRevision ?? null;
      error.requestId = response.headers.get('x-request-id') || data?.requestId || null;
      error.traceId = response.headers.get('x-trace-id') || data?.traceId || null;
      error.diagnosticPhase = response.headers.get('x-slice-diagnostic-phase') || null;
      error.internalErrorCode = response.headers.get('x-slice-internal-error-code') || null;
      error.internalErrorDetail = response.headers.get('x-slice-internal-error-detail') || null;
      if (useSession && response.status === 401) disconnect();
      finishOperation(activeOperation, { response, data, error });
      throw error;
    }
    finishOperation(activeOperation, { response, data });
    return data;
  }
  async function connect({ username, password }) {
    const session = await call('createCompilerRuntimeEvalSession', {
      useSession: false,
      body: { username: String(username || '').trim(), password: String(password || '') },
    });
    if (!session?.accessToken || !session?.expiresAt || !session?.workspaceId) throw new Error('后端没有返回 typed Eval Session');
    state.session = session;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { workspaceId: session.workspaceId, expiresAt: session.expiresAt };
  }
  function disconnect() {
    state.session = null;
    sessionStorage.removeItem(SESSION_KEY);
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  const ZERO_CAST_POLICY = 'institutional_zero_cast';

  function readCharacterVersionIds(input) {
    if (input?.characterVersionIds !== undefined && !Array.isArray(input.characterVersionIds)) {
      throw new Error('CharacterVersion 必须以数组提供');
    }
    const raw = Array.isArray(input?.characterVersionIds)
      ? input.characterVersionIds
      : String(input?.characterVersionId ?? '').trim() === '' ? [] : [input.characterVersionId];
    if (raw.length > 8) throw new Error('CharacterVersion 最多选择 8 个');
    const ids = raw.map((value) => String(value ?? '').trim());
    if (ids.some((value) => !value)) throw new Error('CharacterVersion 不能包含空值');
    if (new Set(ids).size !== ids.length) throw new Error('CharacterVersion 不能重复');
    for (const characterVersionId of ids) {
      if (!UUID_RE.test(characterVersionId)) {
        throw new Error('CharacterVersion 必须是 staging CharacterVersion UUID');
      }
    }
    return ids;
  }

  function normalizeInputCharacters(value, characterVersionIds) {
    const allowed = new Set(characterVersionIds);
    const rows = Array.isArray(value) ? value.slice(0, 8) : [];
    const seen = new Set();
    return Object.freeze(rows.flatMap((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
      const displayName = String(row.displayName || '').trim();
      const characterVersionId = String(
        row.characterVersionId || characterVersionIds[index] || '',
      ).trim();
      if (!displayName || [...displayName].length > 160
          || !allowed.has(characterVersionId) || seen.has(characterVersionId)) return [];
      seen.add(characterVersionId);
      return [Object.freeze({ displayName, characterVersionId })];
    }));
  }

  function previewRunRequest(input, track) {
    return { track,
      ...(input.playerCharacterVersionId ? { playerCharacterVersionId: input.playerCharacterVersionId } : {}),
      ...(input.firstFollowerCharacterVersionId ? { firstFollowerCharacterVersionId: input.firstFollowerCharacterVersionId } : {}),
    };
  }

  function assertPreviewIdentity(preview, input) {
    const identity = preview?.identitySnapshot;
    const player = input.playerCharacterVersionId;
    if (player && (identity?.sourceType !== 'playable_character' || identity.sourceCharacterVersionId !== player
      || (preview.castSnapshot?.entries || []).some((row) => row.characterVersionId === player))) {
      throw Object.assign(new Error('服务端未按所选角色建立玩家身份，或仍把玩家角色当成 NPC；停止开局'), { code: 'SLICE_EVAL_PLAYER_IDENTITY_MISMATCH' });
    }
    if (input.firstFollowerCharacterVersionId && preview?.firstFollower?.characterVersionId !== input.firstFollowerCharacterVersionId) {
      throw Object.assign(new Error('服务端首位互动角色与选择不一致；停止开局'), { code: 'SLICE_EVAL_FIRST_FOLLOWER_MISMATCH' });
    }
  }

  function normalizeSourceDocument(value) {
    if (value == null) return null;
    if (typeof value !== 'object' || Array.isArray(value)
      || value.schemaVersion !== 'slice.long-form-world-source.v1' || value.mediaType !== 'text/markdown'
      || typeof value.body !== 'string' || !value.body.trim() || [...value.body].length > 65536
      || typeof value.fileName !== 'string' || !value.fileName || [...value.fileName].length > 191
      || typeof value.title !== 'string' || !value.title || [...value.title].length > 160
      || !/^[a-f0-9]{64}$/.test(value.contentDigest || '')) throw new Error('完整剧本原文格式不符合 LongFormWorldSourceV1 合同');
    return Object.freeze({ schemaVersion: value.schemaVersion, mediaType: value.mediaType, body: value.body, fileName: value.fileName, title: value.title, contentDigest: value.contentDigest });
  }

  function validateInput(input = {}) {
    const characterVersionIds = readCharacterVersionIds(input);
    const normalized = {
      title: String(input.title || '').trim(),
      description: String(input.description || '').trim(),
      setting: String(input.setting || '').trim(),
      goal: String(input.goal || '').trim(),
      characterVersionIds,
      // 数组是权威来源；首项仅保留给旧报告读取兼容。
      characterVersionId: characterVersionIds[0] || '',
      zeroCastPolicy: characterVersionIds.length ? null : ZERO_CAST_POLICY,
      highlightDescription: String(input.highlightDescription || '').trim() || null,
      evaluationInstruction: String(input.evaluationInstruction || '').trim(),
      evaluationMode: input.evaluationMode === 'regression' ? 'regression' : 'experience',
      playerActions: (Array.isArray(input.playerActions) ? input.playerActions : []).map((item) => String(item).trim()).filter(Boolean),
      sourceScenarioId: String(input.sourceScenarioId || '').trim() || null,
      sourceFile: String(input.sourceFile || '').trim() || null,
      sourceDigest: String(input.sourceDigest || '').trim().toLowerCase() || null,
      sourceWorldDraftRevisionId: String(input.sourceWorldDraftRevisionId || '').trim() || null,
      topicTags: Array.isArray(input.topicTags)
        ? input.topicTags.map((item) => String(item).trim()).filter(Boolean).slice(0, 20) : [],
      personaOptions: Array.isArray(input.personaOptions)
        ? input.personaOptions.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : [],
      selectedPersona: String(input.selectedPersona || '').trim() || null,
      playerCharacterVersionId: String(input.playerCharacterVersionId || '').trim() || null,
      firstFollowerCharacterVersionId: String(input.firstFollowerCharacterVersionId || '').trim() || null,
      characters: normalizeInputCharacters(input.characters, characterVersionIds),
      sourceDocument: normalizeSourceDocument(input.sourceDocument),
    };
    for (const field of ['title', 'description', 'setting', 'goal']) {
      if (!normalized[field]) throw new Error(field + ' 不能为空');
    }
    for (const key of ['playerCharacterVersionId', 'firstFollowerCharacterVersionId']) {
      if (normalized[key] && !characterVersionIds.includes(normalized[key])) throw new Error('玩家与互动 NPC 必须从本次已绑定角色卡中选择');
    }
    if (normalized.playerCharacterVersionId && normalized.playerCharacterVersionId === normalized.firstFollowerCharacterVersionId) {
      throw new Error('玩家扮演角色不能同时成为首位互动 NPC');
    }
    if (normalized.title.length > 160) throw new Error('世界标题不能超过 160 字');
    // Experience mode is interactive: compilation is allowed with zero scripted
    // actions and always pauses before Runtime. playerActions are optional notes /
    // regression fixtures and are never auto-played in interactive mode.
    if (normalized.playerActions.length > 24) throw new Error('一次最多保存 24 条预设行动；不会静默截断');
    if (normalized.playerActions.some((action) => [...action].length > 4000)) throw new Error('每轮行动不能超过 4000 字');
    if (normalized.evaluationMode === 'experience') normalized.playerActions.forEach(parseJourneyAction);
    if (normalized.description.length > 4000 || normalized.setting.length > 4000) {
      throw new Error('世界简介和世界观设定不能超过 4000 字');
    }
    if (normalized.goal.length > 160) throw new Error('世界目标不能超过 160 字');
    if (normalized.highlightDescription && normalized.highlightDescription.length > 4000) {
      throw new Error('高光时刻描述不能超过 4000 字');
    }
    if (normalized.evaluationInstruction.length > 2000) throw new Error('中间提示词不能超过 2000 字');
    if (normalized.sourceWorldDraftRevisionId && normalized.sourceDocument) throw new Error('附加原文时必须建立新 Revision，不能同时复用内置 Revision');
    if (normalized.sourceWorldDraftRevisionId) {
      if (!UUID_RE.test(normalized.sourceWorldDraftRevisionId)
        || !normalized.sourceScenarioId
        || !/^[a-f0-9]{64}$/.test(normalized.sourceDigest || '')) {
        throw new Error('内置剧本缺少可信的 immutable Revision/source digest');
      }
    }
    return normalized;
  }

  function buildWorldSeed(input) {
    const characterVersionIds = readCharacterVersionIds(input);
    return {
      description: input.description,
      setting: input.setting,
      goal: input.goal,
      characterVersionIds,
    };
  }

  function buildWorldDraftContent(input) {
    const characterVersionIds = readCharacterVersionIds(input);
    return {
      schemaVersion: 'slice.world-draft-content.v6',
      worldCore: {
        schemaVersion: 'slice.world-core-source.v1',
        worldName: input.title,
        worldDescription: input.description,
        worldSetting: input.setting,
        worldGoal: input.goal,
      },
      primaryWorldTagId: null,
      topicTags: input.topicTags || [],
      coverAssetId: null,
      characterBindings: characterVersionIds.map((characterVersionId, index) => ({
        characterVersionId,
        playable: true,
        starterRecommended: index === 0,
        starterPriority: index + 1,
      })),
      extendedLoreRefs: [],
      ...(input.sourceDocument ? { sourceDocument: input.sourceDocument } : {}),
    };
  }
  function buildCreateWorldDraftRequest(input) {
    return {
      title: input.title,
      targetVisibility: 'private',
      seed: buildWorldSeed(input),
    };
  }
  function buildCreateWorldDraftRevisionRequest(draft, input) {
    return {
      expectedDraftRevision: Number.isInteger(draft.currentRevisionNumber)
        ? draft.currentRevisionNumber
        : Number.isInteger(draft.revision) ? draft.revision : 0,
      content: buildWorldDraftContent(input),
    };
  }
  function buildCreateCompilerExperimentRequest(input) {
    return {
      ...(input.evaluationInstruction ? { evaluationInstruction: input.evaluationInstruction } : {}),
    };
  }
  async function createScenario(input) {
    if (input.sourceWorldDraftRevisionId) {
      return {
        imported: true,
        draft: null,
        revision: {
          worldDraftRevisionId: input.sourceWorldDraftRevisionId,
          sourceScenarioId: input.sourceScenarioId,
          sourceFile: input.sourceFile,
          sourceDigest: input.sourceDigest,
          immutable: true,
        },
        worldDraftId: null,
        worldDraftRevisionId: input.sourceWorldDraftRevisionId,
      };
    }
    const draft = await call('evalCreateWorldDraft', {
      key: idempotency('eval-draft'),
      body: buildCreateWorldDraftRequest(input),
    });
    const worldDraftId = draft.worldDraftId || draft.draftId;
    if (!worldDraftId) throw new Error('CreateWorldDraft 没有返回 worldDraftId');
    const revision = await call('evalCreateWorldDraftRevision', {
      params: { worldDraftId }, key: idempotency('eval-revision'),
      body: buildCreateWorldDraftRevisionRequest(draft, input),
    });
    const worldDraftRevisionId = revision.worldDraftRevisionId || revision.draftRevisionId || revision.revisionId;
    if (!worldDraftRevisionId) throw new Error('CreateWorldDraftRevision 没有返回 revision ID');
    return { imported: false, draft, revision, worldDraftId, worldDraftRevisionId };
  }
  function compactError(error) {
    return Object.freeze({
      code: String(error?.code || 'SLICE_EVAL_RUNTIME_FAILED'),
      backendCode: error?.backendCode || null,
      status: Number.isInteger(error?.status) ? error.status : null,
      retryability: error?.retryability || null,
      message: String(error?.message || error || 'Runtime 执行失败').slice(0, 500),
      operationId: error?.operationId || null,
      routePath: error?.routePath || null,
      currentRevision: Number.isInteger(error?.currentRevision) ? error.currentRevision : null,
      requestId: error?.requestId || null,
      traceId: error?.traceId || null,
      diagnosticPhase: error?.diagnosticPhase || null,
      internalErrorCode: error?.internalErrorCode || null,
      internalErrorDetail: error?.internalErrorDetail || null,
    });
  }
  async function waitForOutcome(runId, commandId) {
    try {
      return await call('evalGetOutcomeByCommand', { params: { runId, commandId } });
    } catch (cause) {
      if (cause?.status !== 404) throw cause;
      const error = new Error(
        `Command ${commandId} 已进入 applied，但原子 Outcome 仍返回 404；这是后端状态合同不一致，不应继续盲轮询。`,
      );
      error.code = 'SLICE_EVAL_OUTCOME_MISSING_AFTER_APPLY';
      error.backendCode = cause.code || cause.backendCode || null;
      error.retryability = cause.retryability || null;
      error.status = 404;
      error.operationId = 'evalGetOutcomeByCommand';
      error.routePath = '/eval-api/v1/runs/{runId}/commands/{commandId}/outcome';
      error.cause = cause;
      throw error;
    }
  }
  function readOpeningBody(run) {
    const opening = run?.opening;
    const body = opening?.firstPostDraft;
    if (typeof body !== 'string' || !body.trim()) {
      const error = new Error('Preview Run 没有返回可确认的服务端 Opening Post');
      error.code = 'SLICE_EVAL_OPENING_MISSING';
      throw error;
    }
    return body.trim();
  }
  function pageItems(value) {
    return Array.isArray(value?.items) ? value.items : [];
  }
  function resourceUnavailable(code, message, evidence = null) {
    const error = new Error(message);
    error.code = code;
    error.resourceEvidence = cloneEvidence(evidence);
    return error;
  }
  function transientProjectionFailure(error) {
    return [502, 503, 504].includes(Number(error?.status));
  }
  async function withProjectionReadSlot(task) {
    if (projectionReadsInFlight >= PROJECTION_READ_CONCURRENCY) {
      await new Promise((resolve) => projectionReadWaiters.push(resolve));
    }
    projectionReadsInFlight += 1;
    try {
      return await task();
    } finally {
      projectionReadsInFlight -= 1;
      projectionReadWaiters.shift()?.();
    }
  }
  async function readProjection(operationId, params) {
    let attempt = 0;
    while (true) {
      try {
        const value = await withProjectionReadSlot(() => call(operationId, { params }));
        return Object.freeze({ status: 'succeeded', value, error: null });
      } catch (error) {
        if (error?.status === 401) throw error;
        const delay = PROJECTION_TRANSIENT_RETRY_DELAYS_MS[attempt];
        if (delay !== undefined && transientProjectionFailure(error)) {
          attempt += 1;
          await sleep(delay);
          continue;
        }
        return Object.freeze({ status: 'failed', value: null, error: compactError(error) });
      }
    }
  }
  async function mapWithConcurrency(items, limit, mapper) {
    const values = Array.from(items || []);
    const results = new Array(values.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, Number(limit) || 1), values.length);
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index], index);
      }
    }));
    return results;
  }
  const FULL_PROJECTION_REQUESTS = Object.freeze({
    run: ['evalGetRun'],
    feed: ['evalListRunFeed'],
    milestones: ['evalListRunMilestones'],
    relationships: ['evalListRunRelationships'],
    stats: ['evalGetRunStats'],
    progression: ['evalGetRunProgression'],
    events: ['evalListRunEvents'],
    activities: ['evalListRunActivities'],
    activityInstances: ['evalListActivityInstances'],
    activityAttempts: ['evalListActivityAttempts'],
    activityCandidates: ['evalListActivityCandidates'],
    activityHistory: ['evalListActivityHistory'],
    cast: ['evalListRunCast'],
    history: ['evalListRunHistory'],
    dmChannels: ['evalListDmChannels'],
  });
  const COMMAND_PROJECTION_NAMES = Object.freeze({
    confirm_opening_post: Object.freeze(['feed']),
    comment: Object.freeze(['feed']),
    event_action: Object.freeze(['events']),
    dm_message: Object.freeze(['dmChannels']),
    free_act: Object.freeze(['feed']),
  });
  async function readRunProjectionSubset(runId, names, preferredChannelId = null) {
    const requestedNames = [...new Set(Array.from(names || []))]
      .filter((name) => Object.hasOwn(FULL_PROJECTION_REQUESTS, name));
    const entries = await mapWithConcurrency(
      requestedNames.map((name) => [name, FULL_PROJECTION_REQUESTS[name]]),
      PROJECTION_READ_CONCURRENCY,
      async ([name, [operationId]]) => [name, await readProjection(operationId, { runId })],
    );
    const projections = Object.fromEntries(entries);
    if (requestedNames.includes('dmChannels') || preferredChannelId) {
      const channelId = preferredChannelId
        || pageItems(projections.dmChannels?.value).find((item) => item?.channelId)?.channelId
        || null;
      projections.dmMessages = channelId
        ? await readProjection('evalListDmMessages', { runId, channelId })
        : Object.freeze({
          status: 'skipped', value: null, error: null,
          reason: 'no_direct_message_channel',
        });
    }
    return Object.freeze(projections);
  }
  async function readRunProjections(runId, preferredChannelId = null) {
    return readRunProjectionSubset(runId, Object.keys(FULL_PROJECTION_REQUESTS), preferredChannelId);
  }
  async function readCommandProjections(runId, payload) {
    return readRunProjectionSubset(
      runId,
      COMMAND_PROJECTION_NAMES[payload?.type] || ['feed'],
      payload?.channelId || null,
    );
  }
  function projectionIssues(projections) {
    return Object.entries(projections || {})
      .filter(([, result]) => result?.status === 'failed')
      .map(([name, result]) => Object.freeze({ name, error: result.error }));
  }
  function firstFeedPost(feed) {
    return pageItems(feed).find((item) => item?.postId) || null;
  }
  function selectableEvent(events) {
    return pageItems(events).find((item) => ['active', 'available'].includes(item?.state)
      && Array.isArray(item?.choices) && item.choices.some((choice) => choice?.choiceId)) || null;
  }
  function regexpEscape(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  }
  function resolveScenarioDmTarget(input, action) {
    const body = String(action || '');
    const characters = (Array.isArray(input?.characters) ? input.characters : [])
      .filter((row) => row.characterVersionId !== input?.playerCharacterVersionId);
    const addressed = characters.map((character) => {
      const name = String(character.displayName || '');
      if (!name || !body.includes(name)) return null;
      const escaped = regexpEscape(name);
      const patterns = [
        new RegExp(`(?:私下|单独|悄悄)?(?:询问|问|告诉)\\s*${escaped}(?=[：:，,。！？!?\\s]|$)`, 'u'),
        new RegExp(`(?:私下|单独|悄悄)?(?:对|向)\\s*${escaped}(?:说|询问|问|表示|解释)?(?=[：:，,。！？!?\\s]|$)`, 'u'),
        new RegExp(`${escaped}\\s*[：:]`, 'u'),
      ];
      const indexes = patterns.map((pattern) => body.search(pattern)).filter((index) => index >= 0);
      return indexes.length ? { character, index: Math.min(...indexes), length: [...name].length } : null;
    }).filter(Boolean).sort((left, right) => left.index - right.index || right.length - left.length);
    const matched = addressed[0]?.character || characters
      .filter((character) => body.includes(String(character.displayName || '')))
      .sort((left, right) => [...String(right.displayName)].length - [...String(left.displayName)].length)[0];
    const fallbackId = input?.firstFollowerCharacterVersionId
      || input?.characterVersionIds?.find((id) => id !== input?.playerCharacterVersionId);
    const fallback = matched || characters.find((row) => row.characterVersionId === fallbackId)
      || characters[0] || (fallbackId ? { displayName: null, characterVersionId: fallbackId } : null);
    if (!fallback?.characterVersionId) throw resourceUnavailable(
      'SLICE_EVAL_DM_TARGET_MISSING',
      '评测输入没有可绑定的 CharacterVersion，无法创建同角色私聊。',
      { action: body },
    );
    return Object.freeze({
      displayName: fallback.displayName || null,
      characterVersionId: String(fallback.characterVersionId),
    });
  }
  function actorIdForCharacterVersion(preview, target) {
    const entry = (preview?.castSnapshot?.entries || []).find((row) => (
      String(row?.characterVersionId || '') === String(target?.characterVersionId || '')
    ));
    if (!entry?.actorId) throw resourceUnavailable(
      'SLICE_EVAL_DM_TARGET_MISSING',
      'Preview Cast 没有目标 CharacterVersion 对应的 Actor。',
      { runId: preview?.runId || null, target },
    );
    return String(entry.actorId);
  }
  function directMessageChannel(channels, preferredChannelId = null, targetActorId = null) {
    const rows = pageItems(channels);
    if (targetActorId) {
      const targeted = rows.find((item) => Array.isArray(item?.participantActorIds)
        && item.participantActorIds.map(String).includes(String(targetActorId)));
      if (targeted?.channelId) return targeted;
    }
    // 指定目标时绝不落到别人的会话；否则会把同一段私聊发送给错误角色。
    if (targetActorId) return null;
    if (preferredChannelId) return rows.find((item) => item?.channelId === preferredChannelId) || null;
    return rows.find((item) => item?.channelId) || null;
  }
  async function ensureDirectDmChannel(runId, preview, target) {
    const actorId = actorIdForCharacterVersion(preview, target);
    const channels = await call('evalListDmChannels', { params: { runId } });
    const existing = directMessageChannel(channels, null, actorId);
    if (existing?.channelId) return Object.freeze({
      channelId: String(existing.channelId), actorId,
      characterVersionId: target.characterVersionId,
      displayName: target.displayName,
      operation: 'existing',
    });
    const receipt = await call('evalCreateDmChannel', {
      params: { runId }, key: idempotency(`eval-dm-channel-${target.characterVersionId}`),
      body: { channelType: 'direct', participantActorIds: [actorId] },
    });
    if (!receipt?.channelId) throw resourceUnavailable(
      'SLICE_EVAL_DM_CHANNEL_MISSING',
      'CreateDmChannel 没有返回 channelId。',
      { runId, actorId, target, receipt },
    );
    return Object.freeze({
      channelId: String(receipt.channelId), actorId,
      characterVersionId: target.characterVersionId,
      displayName: target.displayName,
      operation: String(receipt.operation || 'created'),
      receiptId: receipt.receiptId || null,
    });
  }
  async function executeRunCommand(runId, run, payload) {
    const startedAtMs = performance.now();
    let accepted = null;
    let command = null;
    try {
      accepted = await call('evalSubmitWorldCommand', {
        params: { runId }, key: idempotency(`eval-${payload.type}`),
        body: { expectedRunRevision: run.revision, payload },
      });
      if (!accepted?.commandId) throw new Error('Runtime 没有返回 commandId');
      let attempt = 0;
      while (performance.now() - startedAtMs < COMMAND_POLL_BUDGET_MS) {
        command = await call('evalGetWorldCommand', { params: { runId, commandId: accepted.commandId } });
        if (command.status === 'rejected') {
          return {
            status: 'rejected', payload: cloneEvidence(payload),
            durationMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
            runBefore: run, accepted, command, outcome: null, feed: null,
            projections: null, projectionIssues: [],
            error: compactError(Object.assign(new Error('Runtime Command 被 Worker 拒绝'), {
              code: command.errorCode || 'SLICE_RUNTIME_COMMAND_REJECTED',
            })),
          };
        }
        if (command.status === 'applied') {
          const outcome = await waitForOutcome(runId, accepted.commandId);
          const projections = await readCommandProjections(runId, payload);
          const issues = projectionIssues(projections);
          const feed = projections.feed?.value || null;
          if (outcome.status === 'rejected') {
            return {
              status: 'rejected', payload: cloneEvidence(payload),
              durationMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
              runBefore: run, accepted, command, outcome, feed, projections,
              projectionIssues: issues,
              error: compactError(Object.assign(new Error(
                outcome.rejectionCode || outcome.narrativeSummary || 'Runtime Outcome 被拒绝',
              ), { code: outcome.rejectionCode || 'SLICE_RUNTIME_OUTCOME_REJECTED' })),
            };
          }
          return {
            status: 'applied', payload: cloneEvidence(payload),
            durationMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
            runBefore: run, accepted, command, outcome, feed, projections,
            projectionIssues: issues, error: null,
          };
        }
        if (!['accepted', 'processing'].includes(command.status)) {
          throw new Error(`未知 Command 状态：${command.status}`);
        }
        const delay = COMMAND_POLL_DELAYS_MS[Math.min(attempt, COMMAND_POLL_DELAYS_MS.length - 1)];
        attempt += 1;
        const remaining = COMMAND_POLL_BUDGET_MS - (performance.now() - startedAtMs);
        if (remaining <= 0) break;
        await sleep(Math.min(delay, remaining));
      }
      return {
        status: 'processing', payload: cloneEvidence(payload),
        durationMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
        runBefore: run, accepted, command, outcome: null, feed: null,
        projections: null, projectionIssues: [], error: null,
        pendingReason: 'command_poll_budget_exhausted',
      };
    } catch (error) {
      error.runtimeEvidence = { runBefore: run, accepted, command, payload: cloneEvidence(payload) };
      error.runtimeDurationMs = Math.max(0, Math.round(performance.now() - startedAtMs));
      throw error;
    }
  }
  async function executeOpeningRun(runId) {
    const run = await call('evalGetRun', { params: { runId } });
    return executeRunCommand(runId, run, { type: 'confirm_opening_post', body: readOpeningBody(run) });
  }
  async function executeCommentRun(runId, body) {
    const [run, feed] = await Promise.all([
      call('evalGetRun', { params: { runId } }),
      call('evalListRunFeed', { params: { runId } }),
    ]);
    const post = firstFeedPost(feed);
    if (!post?.postId) throw resourceUnavailable(
      'SLICE_EVAL_COMMENT_TARGET_MISSING',
      'Opening 没有生成可评论的正式 Feed Post',
      { runId, feed },
    );
    return executeRunCommand(runId, run, {
      type: 'comment', rootPostId: post.postId, body,
    });
  }
  async function executeEventRun(runId) {
    const [run, events] = await Promise.all([
      call('evalGetRun', { params: { runId } }),
      call('evalListRunEvents', { params: { runId } }),
    ]);
    const event = selectableEvent(events);
    const choice = event?.choices?.find((item) => item?.choiceId) || null;
    if (!event?.eventId || !choice?.choiceId) throw resourceUnavailable(
      'SLICE_EVAL_EVENT_CHOICE_MISSING',
      'Opening 没有生成可选择的正式 Event Choice',
      { runId, events },
    );
    return executeRunCommand(runId, run, {
      type: 'event_action', eventId: event.eventId, choiceId: choice.choiceId,
    });
  }
  async function executeDmRun(runId, body, preferredChannelId = null) {
    const [run, channels] = await Promise.all([
      call('evalGetRun', { params: { runId } }),
      call('evalListDmChannels', { params: { runId } }),
    ]);
    const channel = directMessageChannel(channels, preferredChannelId);
    if (!channel?.channelId) throw resourceUnavailable(
      'SLICE_EVAL_DM_CHANNEL_MISSING',
      'Opening 没有生成可用的 Direct Message Channel',
      { runId, channels, preferredChannelId },
    );
    return executeRunCommand(runId, run, {
      type: 'dm_message', channelId: channel.channelId, body,
    });
  }
  async function executeRun(runId, action) {
    const run = await call('evalGetRun', { params: { runId } });
    return executeRunCommand(runId, run, { type: 'free_act', body: action });
  }
  function failedExecution(error, fallbackPayload = null) {
    return {
      status: 'failed',
      payload: error.runtimeEvidence?.payload || cloneEvidence(fallbackPayload),
      durationMs: error.runtimeDurationMs ?? null,
      runBefore: error.runtimeEvidence?.runBefore || null,
      accepted: error.runtimeEvidence?.accepted || null,
      command: error.runtimeEvidence?.command || null,
      outcome: null,
      feed: null,
      projections: null,
      projectionIssues: [],
      error: compactError(error),
    };
  }
  async function safeExecuteOpeningRun(runId) {
    try {
      return await executeOpeningRun(runId);
    } catch (error) {
      if (error?.status === 401) throw error;
      return failedExecution(error, { type: 'confirm_opening_post' });
    }
  }
  async function safeExecuteCommentRun(runId, body) {
    try {
      return await executeCommentRun(runId, body);
    } catch (error) {
      if (error?.status === 401) throw error;
      return failedExecution(error, { type: 'comment', body });
    }
  }
  async function safeExecuteEventRun(runId) {
    try {
      return await executeEventRun(runId);
    } catch (error) {
      if (error?.status === 401) throw error;
      return failedExecution(error, { type: 'event_action' });
    }
  }
  async function safeExecuteDmRun(runId, body, preferredChannelId = null) {
    try {
      return await executeDmRun(runId, body, preferredChannelId);
    } catch (error) {
      if (error?.status === 401) throw error;
      return failedExecution(error, { type: 'dm_message', channelId: preferredChannelId, body });
    }
  }
  async function safeExecuteRun(runId, action) {
    try {
      return await executeRun(runId, action);
    } catch (error) {
      if (error?.status === 401) throw error;
      return failedExecution(error, { type: 'free_act', body: action });
    }
  }
  function latestCharacterDmReply(projections) {
    const playerActorId = pageItems(projections?.cast?.value)
      .find((item) => item?.kind === 'player' && item?.actorId)?.actorId || null;
    if (!playerActorId) return null;
    return [...pageItems(projections?.dmMessages?.value)]
      .filter((item) => typeof item?.text === 'string' && item.text.trim()
        && item?.senderActorId && item.senderActorId !== playerActorId)
      .sort((left, right) => new Date(left.createdAt || 0).getTime()
        - new Date(right.createdAt || 0).getTime())
      .at(-1) || null;
  }
  function verifyMemoryRecall(projections, memoryCode) {
    const latest = latestCharacterDmReply(projections);
    const playerActorId = pageItems(projections?.cast?.value)
      .find((item) => item?.kind === 'player' && item?.actorId)?.actorId || null;
    return Object.freeze({
      passed: Boolean(latest && String(latest.text).includes(memoryCode)),
      playerActorId,
      latestMessageId: latest?.messageId || null,
      latestSenderActorId: latest?.senderActorId || null,
      latestText: latest?.text || null,
      expectedMemoryCode: memoryCode,
      verificationScope: 'latest_non_player_reply_in_same_direct_channel',
    });
  }
  function commandBody(primary, fallback, suffix = '') {
    const base = String(primary || '').trim() || fallback;
    const suffixChars = [...String(suffix || '')];
    const baseLimit = Math.max(0, 4000 - suffixChars.length);
    return `${[...base].slice(0, baseLimit).join('')}${suffixChars.slice(0, 4000).join('')}`;
  }
  async function createCompilerExperimentWithRecovery(input, revisionId, onProgress) {
    // HTTP/network retries reuse the same idempotency key for one explicit Eval run.
    // The public CreateCompilerExperimentRequest contract currently accepts only
    // evaluationInstruction; do not send frontend-only attempt identities.
    const options = {
      params: { worldDraftRevisionId: revisionId },
      key: idempotency('eval-compile'),
      body: buildCreateCompilerExperimentRequest(input),
    };
    const started = performance.now();
    for (let attempt = 0; ; attempt += 1) {
      try { return await call('evalCreateCompilerExperiment', options); }
      catch (error) {
        if (![502, 503, 504].includes(error?.status) || attempt >= 4 || performance.now() - started > 360000) throw error;
        checkExperienceStop(input);
        onProgress({ kind: 'checkpoint', step: 'compile', message: '网关响应暂未确定，使用原请求身份恢复同一编译实验；不会新建另一组编译' });
        await sleep(Math.min(5000 * (attempt + 1), 15000));
      }
    }
  }

  async function waitForExperiment(experimentId, onProgress, options = {}) {
    const now = options.now || (() => performance.now());
    const pause = options.pause || sleep;
    const budgetMs = options.budgetMs ?? 600000;
    const started = now();
    let lastTraceAt = Number.NEGATIVE_INFINITY;
    let failures = 0;
    for (let attempt = 0; now() - started < budgetMs; attempt += 1) {
      if (options.input) checkExperienceStop(options.input);
      let experiment;
      try {
        experiment = await call('evalGetCompilerExperiment', { params: { experimentId } });
        failures = 0;
      } catch (error) {
        if (![502, 503, 504].includes(error?.status) || ++failures > 3) throw error;
        onProgress({ kind: 'checkpoint', step: 'compile', message: '编译任务已持久保存；读取进度暂时失败，稍后读取同一实验' });
        await pause(3000); continue;
      }
      if (options.result) {
        options.result.experiment = experiment;
        if (now() - lastTraceAt >= 15000 || experiment.status !== 'running') {
          await refreshTrace(options.result); lastTraceAt = now();
        }
      }
      const tracks = Array.isArray(experiment.tracks) ? experiment.tracks : [];
      if (['succeeded', 'partial', 'failed'].includes(experiment.status)) {
        if (!['current', 'v2_candidate'].every((code) => tracks.some((track) => track.trackCode === code && track.status === 'succeeded'))) {
          const error = new Error(`Compiler Experiment 已结束：${experiment.status}；${tracks.filter((track) => track.status !== 'succeeded').map((track) => track.errorCode || track.status).join(' / ')}`);
          error.code = 'SLICE_EVAL_COMPILER_FAILED'; error.experiment = experiment; throw error;
        }
        return experiment;
      }
      if (experiment.status !== 'running') throw new Error(`未知 Compiler Experiment 状态：${experiment.status}`);
      const job = experiment.execution;
      if (['dead_letter', 'cancelled', 'succeeded'].includes(job?.status)) {
        const error = new Error(`Compiler Job ${job.status}，Experiment 尚未完成：${job.errorCode || '状态不一致'}`);
        error.code = 'SLICE_EVAL_COMPILER_JOB_FAILED'; error.experiment = experiment; throw error;
      }
      const stage = job?.status === 'queued' ? (job.attemptCount ? '等待恢复重试' : '排队中')
        : job?.status === 'running' || job?.status === 'leased' ? 'Worker 编译中' : '等待 Worker';
      onProgress({ kind: 'checkpoint', step: 'compile', message: `${stage} · ${tracks.filter((track) => track.status === 'succeeded').length}/2 轨已完成${job ? ` · 尝试 ${job.attemptCount}/${job.maxAttempts}` : ''}${job?.errorCode ? ` · ${job.errorCode}` : ''}` });
      await pause(Math.min(attempt < 5 ? 1000 : 3000, Math.max(0, budgetMs - (now() - started))));
    }
    const error = new Error('页面等待预算已用完；编译任务仍在后端。已保留实验身份，可继续等待同一实验，不会重新编译计费。');
    error.code = 'SLICE_EVAL_COMPILER_WAIT_PENDING'; error.experimentId = experimentId; throw error;
  }
  async function refreshTrace(result) {
    const experimentId = result?.experiment?.experimentId;
    if (!experimentId) return null;
    try {
      const trace = await call('getCompilerRuntimeEvalTrace', { params: { experimentId } });
      result.trace = trace;
      result.traceError = null;
      return trace;
    } catch (error) {
      if (error?.status === 401) throw error;
      result.traceError = compactError(error);
      return null;
    }
  }
  let stopRequested = false;
  function requestStop() { stopRequested = true; }
  function checkExperienceStop(input) {
    if (input.evaluationMode === 'experience' && stopRequested) {
      const error = new Error('已停止提交后续阶段');
      error.code = 'SLICE_EVAL_STOP_REQUESTED';
      throw error;
    }
  }

  function normalizeJourneyAction(value) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return parseJourneyAction(value);
    const payload = cloneEvidence(value);
    const type = String(payload.type || '').trim();
    const body = typeof payload.body === 'string' ? payload.body.trim() : '';
    const requiredBody = () => {
      if (!body) throw new Error(`${type} 缺少正文`);
      if ([...body].length > 4000) throw new Error('每轮正文不能超过 4000 字');
      return body;
    };
    if (type === 'free_act') return { type, body: requiredBody() };
    if (type === 'post') return { type, body: requiredBody(), visibility: payload.visibility || 'public' };
    if (type === 'comment' || type === 'reply') return { type, body: requiredBody() };
    if (type === 'dm_message') return { type, targetName: String(payload.targetName || '').trim(), body: requiredBody() };
    if (type === 'event_action') {
      const eventId = String(payload.eventId || '').trim() || null;
      const choiceId = String(payload.choiceId || '').trim() || null;
      if (!choiceId && !body) throw new Error('event_action 必须提供 choiceId 或 body');
      if (choiceId && body) throw new Error('event_action 的 choiceId 与 body 只能二选一');
      return { type, eventId, choiceId, ...(body ? { body } : {}) };
    }
    if (type === 'activity_create') {
      if (!payload.payload || typeof payload.payload !== 'object' || Array.isArray(payload.payload)) throw new Error('创建 Activity 缺少 payload');
      return { type, payload: cloneEvidence(payload.payload) };
    }
    if (type === 'activity_update') {
      if (!String(payload.activityAttemptId || payload.targetTitle || '').trim()) throw new Error('修改 Activity 需要 Activity 标题或 attemptId');
      if (!payload.payload || typeof payload.payload !== 'object' || Array.isArray(payload.payload)) throw new Error('修改 Activity 缺少 payload');
      return { type, activityAttemptId: String(payload.activityAttemptId || '').trim() || null,
        targetTitle: String(payload.targetTitle || '').trim() || null, payload: cloneEvidence(payload.payload) };
    }
    if (type === 'activity_invite_response') {
      const response = String(payload.response || '').trim().toUpperCase();
      if (!['ACCEPTED', 'REJECTED', 'IGNORED'].includes(response)) throw new Error('Activity 邀请回应必须是 ACCEPTED / REJECTED / IGNORED');
      if (!String(payload.activityAttemptId || payload.targetTitle || '').trim()) throw new Error('Activity 邀请回应需要 Activity 标题或 attemptId');
      return { type, activityAttemptId: String(payload.activityAttemptId || '').trim() || null,
        targetTitle: String(payload.targetTitle || '').trim() || null,
        actorId: String(payload.actorId || '').trim() || null, response };
    }
    if (type === 'activity_enter') {
      if (!String(payload.activityAttemptId || payload.targetTitle || '').trim()) throw new Error('进入 Activity 需要 Activity 标题或 attemptId');
      return { type, activityAttemptId: String(payload.activityAttemptId || '').trim() || null,
        targetTitle: String(payload.targetTitle || '').trim() || null };
    }
    if (type === 'activity_turn') {
      if (!String(payload.activityId || payload.targetTitle || '').trim()) throw new Error('Activity 回合需要 Activity 标题或 activityId');
      return { type, activityId: String(payload.activityId || '').trim() || null,
        targetTitle: String(payload.targetTitle || '').trim() || null, body: requiredBody() };
    }
    if (type === 'activity_exit') {
      const exitStatus = String(payload.status || 'exited').trim();
      if (!['completed', 'interrupted', 'failed', 'exited'].includes(exitStatus)) throw new Error('Activity 退出状态无效');
      if (!String(payload.activityId || payload.targetTitle || '').trim()) throw new Error('退出 Activity 需要 Activity 标题或 activityId');
      return { type, activityId: String(payload.activityId || '').trim() || null,
        targetTitle: String(payload.targetTitle || '').trim() || null, status: exitStatus };
    }
    throw new Error(`不支持的 Eval 玩家操作：${type || '(empty)'}`);
  }

  function parseJsonAction(value, label) {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not object');
      return parsed;
    } catch (_) { throw new Error(`${label} 必须是 JSON object`); }
  }

  function parseJourneyAction(value) {
    const action = String(value || '').trim();
    const post = action.match(/^发帖\s*[：:]\s*([\s\S]+)$/u);
    if (post) return { type: 'post', body: post[1].trim(), visibility: 'public' };
    const reply = action.match(/^回复评论\s*[：:]\s*([\s\S]+)$/u);
    if (reply) return { type: 'reply', body: reply[1].trim() };
    const comment = action.match(/^评论\s*[：:]\s*([\s\S]+)$/u);
    if (comment) return { type: 'comment', body: comment[1].trim() };
    const dm = action.match(/^私聊\s+([^：:]+)[：:]\s*([\s\S]+)$/u);
    if (dm) return { type: 'dm_message', targetName: dm[1].trim(), body: dm[2].trim() };
    const eventInput = action.match(/^事件输入\s+([^：:]+)[：:]\s*([\s\S]+)$/u);
    if (eventInput) return { type: 'event_action', eventId: eventInput[1].trim(), body: eventInput[2].trim() };
    const event = action.match(/^事件\s*[：:]\s*(\S+)$/u);
    if (event) return { type: 'event_action', eventId: null, choiceId: event[1] };
    const createActivity = action.match(/^创建活动\s*[：:]\s*([\s\S]+)$/u);
    if (createActivity) return { type: 'activity_create', payload: parseJsonAction(createActivity[1], 'Activity payload') };
    const updateActivity = action.match(/^修改活动\s+([^：:]+)[：:]\s*([\s\S]+)$/u);
    if (updateActivity) return { type: 'activity_update', activityAttemptId: updateActivity[1].trim(), payload: parseJsonAction(updateActivity[2], 'Activity payload') };
    const invite = action.match(/^活动回应\s+(\S+)\s+(\S+)\s*[：:]\s*(ACCEPTED|REJECTED|IGNORED)$/iu);
    if (invite) return { type: 'activity_invite_response', activityAttemptId: invite[1], actorId: invite[2], response: invite[3].toUpperCase() };
    const enter = action.match(/^进入活动\s*[：:]\s*(\S+)$/u);
    if (enter) return { type: 'activity_enter', activityAttemptId: enter[1] };
    const activityTurn = action.match(/^活动\s+([^：:]+)[：:]\s*([\s\S]+)$/u);
    if (activityTurn) return { type: 'activity_turn', activityId: activityTurn[1].trim(), body: activityTurn[2].trim() };
    const exit = action.match(/^退出活动\s+([^：:]+)[：:]\s*(completed|interrupted|failed|exited)$/iu);
    if (exit) return { type: 'activity_exit', activityId: exit[1].trim(), status: exit[2].toLowerCase() };
    if (/^(发帖|回复评论|评论|私聊|事件输入|事件|创建活动|修改活动|活动回应|进入活动|退出活动)(?:\s|[：:]|$)/u.test(action)
      || /^活动(?:\s|[：:]|$)/u.test(action)) {
      throw new Error('行动格式不完整；可使用页面的操作类型选择器，或按帮助中的 DSL 输入');
    }
    if (!action) throw new Error('请输入这一轮玩家行为');
    return { type: 'free_act', body: action };
  }

  function journeyActionLabel(value) {
    const action = normalizeJourneyAction(value);
    if (action.type === 'post') return `发帖：${action.body}`;
    if (action.type === 'comment') return `评论：${action.body}`;
    if (action.type === 'reply') return `回复评论：${action.body}`;
    if (action.type === 'dm_message') return `私聊 ${action.targetName || '目标角色'}：${action.body}`;
    if (action.type === 'event_action') return action.choiceId ? `事件：${action.choiceId}` : `事件输入 ${action.eventId}：${action.body}`;
    if (action.type === 'activity_create') return `创建活动：${JSON.stringify(action.payload)}`;
    if (action.type === 'activity_update') return `修改活动 ${action.targetTitle || action.activityAttemptId}：${JSON.stringify(action.payload)}`;
    if (action.type === 'activity_invite_response') return `活动回应 ${action.targetTitle || action.activityAttemptId} ${action.actorId || '当前玩家'}：${action.response}`;
    if (action.type === 'activity_enter') return `进入活动：${action.targetTitle || action.activityAttemptId}`;
    if (action.type === 'activity_turn') return `活动 ${action.targetTitle || action.activityId}：${action.body}`;
    if (action.type === 'activity_exit') return `退出活动 ${action.targetTitle || action.activityId}：${action.status}`;
    return action.body;
  }

  function activityTitle(value) {
    return String(value?.setup?.title || value?.currentScene?.title || value?.title || value?.payload?.title || '').trim();
  }
  function latestActivityRow(rows, { id, title, activeOnly = false } = {}) {
    const list = pageItems(rows);
    const filtered = list.filter((item) => !activeOnly || item?.status === 'active');
    const byId = id ? filtered.find((item) => item.activityAttemptId === id || item.activityId === id) : null;
    if (byId) return byId;
    const byTitle = title ? filtered.filter((item) => activityTitle(item) === title).at(-1) : null;
    return byTitle || filtered.at(-1) || null;
  }
  function activityPayloadForPreview(preview, input, rawPayload) {
    const payload = cloneEvidence(rawPayload || {});
    const invitedNames = Array.isArray(payload.invitedNames)
      ? [...new Set(payload.invitedNames.map((name) => String(name || '').trim()).filter(Boolean))]
      : [];
    delete payload.invitedNames;
    if (invitedNames.length) {
      payload.invitedActorIds = invitedNames.map((name) => {
        const matches = (input.characters || []).filter((character) => character.displayName === name);
        if (matches.length !== 1) throw resourceUnavailable(
          'SLICE_EVAL_ACTIVITY_INVITEE_MISSING', `Activity 邀请角色「${name}」必须唯一匹配本次 Cast`, { name });
        return actorIdForCharacterVersion(preview, matches[0]);
      });
    }
    return payload;
  }

  async function executeActivityMutation(preview, input, payload) {
    const runId = preview.runId;
    const run = await call('evalGetRun', { params: { runId } });
    const startedAtMs = performance.now();
    let response;
    if (payload.type === 'activity_create') {
      response = await call('evalCreateActivityAttempt', {
        params: { runId }, key: idempotency('eval-activity-create'),
        body: { expectedRunRevision: run.revision, payload: activityPayloadForPreview(preview, input, payload.payload) },
      });
    } else if (payload.type === 'activity_update') {
      const attempts = await call('evalListActivityAttempts', { params: { runId } });
      const attempt = latestActivityRow(attempts, { id: payload.activityAttemptId, title: payload.targetTitle });
      if (!attempt) throw resourceUnavailable('SLICE_EVAL_ACTIVITY_ATTEMPT_MISSING', `找不到 Activity Attempt ${payload.targetTitle || payload.activityAttemptId || ''}`, { attempts });
      response = await call('evalUpdateActivityAttempt', {
        params: { runId, activityAttemptId: attempt.activityAttemptId }, key: idempotency('eval-activity-update'),
        body: { expectedRunRevision: run.revision, expectedAttemptRevision: attempt.stateRevision,
          payload: activityPayloadForPreview(preview, input, payload.payload) },
      });
    } else if (payload.type === 'activity_invite_response') {
      const attempts = await call('evalListActivityAttempts', { params: { runId } });
      const attempt = latestActivityRow(attempts, { id: payload.activityAttemptId, title: payload.targetTitle });
      if (!attempt) throw resourceUnavailable('SLICE_EVAL_ACTIVITY_ATTEMPT_MISSING', '当前轨道找不到对应 Activity Attempt', { attempts });
      const playerActorId = (preview.actorStates || []).find((item) => item.kind === 'player')?.actorId;
      const actorId = payload.actorId || playerActorId;
      if (!actorId) throw resourceUnavailable('SLICE_EVAL_ACTIVITY_ACTOR_MISSING', '当前 Preview Run 没有可控玩家 Actor');
      response = await call('evalRespondActivityInvite', {
        params: { runId, activityAttemptId: attempt.activityAttemptId }, key: idempotency('eval-activity-invite'),
        body: { actorId, response: payload.response },
      });
    } else if (payload.type === 'activity_enter') {
      const attempts = await call('evalListActivityAttempts', { params: { runId } });
      const attempt = latestActivityRow(attempts, { id: payload.activityAttemptId, title: payload.targetTitle });
      if (!attempt) throw resourceUnavailable('SLICE_EVAL_ACTIVITY_ATTEMPT_MISSING', '当前轨道找不到可进入的 Activity Attempt', { attempts });
      response = await call('evalEnterActivity', {
        params: { runId, activityAttemptId: attempt.activityAttemptId }, key: idempotency('eval-activity-enter'),
        body: { expectedRunRevision: run.revision },
      });
    } else if (payload.type === 'activity_exit') {
      const instances = await call('evalListActivityInstances', { params: { runId } });
      const selected = latestActivityRow(instances, { id: payload.activityId, title: payload.targetTitle, activeOnly: true });
      if (!selected?.activityId) throw resourceUnavailable('SLICE_EVAL_ACTIVITY_INSTANCE_MISSING', '当前轨道没有对应的 Active Activity', { instances });
      const activity = await call('evalGetActivityInstance', { params: { runId, activityId: selected.activityId } });
      response = await call('evalExitActivity', {
        params: { runId, activityId: selected.activityId }, key: idempotency('eval-activity-exit'),
        body: { status: payload.status, expectedRunRevision: run.revision, expectedSceneRevision: activity.sceneRevision },
      });
    } else {
      throw new Error(`不支持的同步 Activity 操作：${payload.type}`);
    }
    return {
      status: 'applied', payload: cloneEvidence(payload),
      durationMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
      runBefore: run, accepted: null, command: null, outcome: null,
      activityResponse: cloneEvidence(response), feed: null, projections: null,
      projectionIssues: [], error: null,
    };
  }

  async function executeActivityTurn(preview, payload) {
    const runId = preview.runId;
    const [run, instances] = await Promise.all([
      call('evalGetRun', { params: { runId } }),
      call('evalListActivityInstances', { params: { runId } }),
    ]);
    const selected = latestActivityRow(instances, { id: payload.activityId, title: payload.targetTitle, activeOnly: true });
    if (!selected?.activityId) throw resourceUnavailable('SLICE_EVAL_ACTIVITY_INSTANCE_MISSING', '当前轨道没有对应的 Active Activity', { instances });
    const activity = await call('evalGetActivityInstance', { params: { runId, activityId: selected.activityId } });
    const startedAtMs = performance.now();
    let accepted = null;
    let command = null;
    try {
      accepted = await call('evalSubmitActivityAction', {
        params: { runId, activityId: selected.activityId }, key: idempotency('eval-activity-turn'),
        body: { body: payload.body, expectedRunRevision: run.revision, expectedSceneRevision: activity.sceneRevision },
      });
      if (!accepted?.commandId) throw new Error('Activity Turn 没有返回 commandId');
      let attempt = 0;
      while (performance.now() - startedAtMs < COMMAND_POLL_BUDGET_MS) {
        command = await call('evalGetWorldCommand', { params: { runId, commandId: accepted.commandId } });
        if (command.status === 'rejected') {
          return {
            status: 'rejected', payload: cloneEvidence(payload), durationMs: Math.round(performance.now() - startedAtMs),
            runBefore: run, accepted, command, outcome: null, activityResponse: accepted,
            feed: null, projections: null, projectionIssues: [],
            error: compactError(Object.assign(new Error('Activity Turn 被 Worker 拒绝'), { code: command.errorCode || 'SLICE_RUNTIME_COMMAND_REJECTED' })),
          };
        }
        if (command.status === 'applied') {
          const outcome = await waitForOutcome(runId, accepted.commandId);
          return {
            status: outcome.status === 'rejected' ? 'rejected' : 'applied',
            payload: cloneEvidence(payload), durationMs: Math.round(performance.now() - startedAtMs),
            runBefore: run, accepted, command, outcome, activityResponse: accepted,
            feed: null, projections: null, projectionIssues: [],
            error: outcome.status === 'rejected'
              ? compactError(Object.assign(new Error(outcome.rejectionCode || outcome.narrativeSummary), { code: outcome.rejectionCode || 'SLICE_RUNTIME_OUTCOME_REJECTED' }))
              : null,
          };
        }
        if (!['accepted', 'processing'].includes(command.status)) throw new Error(`未知 Activity Command 状态：${command.status}`);
        const delay = COMMAND_POLL_DELAYS_MS[Math.min(attempt, COMMAND_POLL_DELAYS_MS.length - 1)];
        attempt += 1;
        await sleep(delay);
      }
      return {
        status: 'processing', payload: cloneEvidence(payload),
        durationMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
        runBefore: run, accepted, command, outcome: null, activityResponse: accepted,
        feed: null, projections: null, projectionIssues: [], error: null,
        pendingReason: 'command_poll_budget_exhausted',
      };
    } catch (error) {
      error.runtimeEvidence = { runBefore: run, accepted, command, payload: cloneEvidence(payload) };
      error.runtimeDurationMs = Math.max(0, Math.round(performance.now() - startedAtMs));
      throw error;
    }
  }

  async function executeJourneyAction(preview, input, action) {
    const payload = normalizeJourneyAction(action);
    try {
      if (payload.type === 'post') {
        const run = await call('evalGetRun', { params: { runId: preview.runId } });
        return await executeRunCommand(preview.runId, run, payload);
      }
      if (payload.type === 'reply') return await executeNpcReplyRun(preview, payload.body);
      if (payload.type === 'comment') return await executeCommentRun(preview.runId, payload.body);
      if (payload.type === 'dm_message') {
        const matches = payload.targetName
          ? input.characters.filter((character) => character.displayName === payload.targetName)
          : [];
        if (payload.targetName && matches.length !== 1) throw resourceUnavailable('SLICE_EVAL_DM_TARGET_MISSING', `私聊目标「${payload.targetName}」必须唯一匹配本次已选择的人物卡`);
        const target = matches[0] || resolveScenarioDmTarget(input, payload.body);
        const channel = await ensureDirectDmChannel(preview.runId, preview, target);
        return await executeDmRun(preview.runId, payload.body, channel.channelId);
      }
      if (payload.type === 'event_action') {
        const [run, events] = await Promise.all([
          call('evalGetRun', { params: { runId: preview.runId } }),
          call('evalListRunEvents', { params: { runId: preview.runId } }),
        ]);
        const rows = pageItems(events).filter((item) => ['active', 'available'].includes(item.state));
        const event = payload.eventId
          ? rows.find((item) => item.eventId === payload.eventId)
          : rows.find((item) => item.choices?.some((choice) => choice.choiceId === payload.choiceId));
        if (!event) throw resourceUnavailable('SLICE_EVAL_EVENT_CHOICE_MISSING', payload.eventId
          ? `当前轨道没有可操作的事件 ${payload.eventId}`
          : `当前轨道没有可用的事件选项 ${payload.choiceId}；未替换为第一项`, { events });
        if (payload.choiceId && !event.choices?.some((choice) => choice.choiceId === payload.choiceId)) {
          throw resourceUnavailable('SLICE_EVAL_EVENT_CHOICE_MISSING', `事件 ${event.eventId} 不包含选项 ${payload.choiceId}`, { event });
        }
        if (payload.body && event.freeInputAllowed !== true) {
          throw resourceUnavailable('SLICE_EVAL_EVENT_FREE_INPUT_UNAVAILABLE', `事件 ${event.eventId} 不允许自由输入`, { event });
        }
        return await executeRunCommand(preview.runId, run, {
          type: 'event_action', eventId: event.eventId,
          ...(payload.choiceId ? { choiceId: payload.choiceId } : { body: payload.body }),
        });
      }
      if (['activity_create', 'activity_update', 'activity_invite_response', 'activity_enter', 'activity_exit'].includes(payload.type)) {
        return await executeActivityMutation(preview, input, payload);
      }
      if (payload.type === 'activity_turn') return await executeActivityTurn(preview, payload);
      return await executeRun(preview.runId, payload.body);
    } catch (error) {
      if (error?.status === 401) throw error;
      return failedExecution(error, payload);
    }
  }

  async function executeNpcReplyRun(preview, body) {
    const runId = preview.runId;
    const player = (preview.actorStates || []).find((row) => row.kind === 'player');
    if (!player?.actorId) throw resourceUnavailable('SLICE_EVAL_REPLY_TARGET_MISSING', '缺少服务器确认的玩家身份，不能猜测评论作者');
    const snapshot = await readExperienceProjections(runId);
    if (snapshot.replies?.status !== 'succeeded' || snapshot.replies.value?.truncated) {
      throw resourceUnavailable('SLICE_EVAL_REPLY_TARGET_MISSING', '评论未完整读取，不能猜测回复目标');
    }
    const targets = pageItems(snapshot.replies.value).flatMap((thread) => pageItems(thread.value)
      .filter((row) => row.replyId && row.author?.actorId && row.author.actorId !== player.actorId)
      .map((row) => ({ ...row, rootPostId: thread.postId })));
    targets.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || String(b.replyId).localeCompare(String(a.replyId)));
    const target = targets[0];
    if (!target) throw resourceUnavailable('SLICE_EVAL_REPLY_TARGET_MISSING', '本轮没有真实 NPC 评论可回复；不会替换成自由行动');
    const run = await call('evalGetRun', { params: { runId } });
    return executeRunCommand(runId, run, { type: 'reply', rootPostId: target.rootPostId, parentContentId: target.replyId, body });
  }

  async function readExperienceProjections(runId) {
    const projections = { ...await readRunProjections(runId) };
    const posts = pageItems(projections.feed?.value).filter((item) => item?.postId && item.replyCount > 0);
    const replies = await mapWithConcurrency(posts.slice(0, 12), PROJECTION_READ_CONCURRENCY,
      async (post) => ({ postId: post.postId, ...await readProjection('evalListPostReplies', { runId, postId: post.postId }) }));
    projections.replies = {
      status: projections.feed?.status !== 'succeeded' || replies.some((item) => item.status === 'failed') ? 'failed' : 'succeeded',
      value: { items: replies, truncated: posts.length > 12 || Boolean(projections.feed?.value?.pageInfo?.hasMore || projections.feed?.value?.pageInfo?.nextCursor) },
      error: projections.feed?.status !== 'succeeded' || replies.some((item) => item.status === 'failed') ? { code: 'SLICE_EVAL_REPLY_PROJECTION_PARTIAL', message: '评论读取不完整，不能推断没有评论' } : null,
    };
    const channels = pageItems(projections.dmChannels?.value).filter((item) => item?.channelId);
    const messages = await mapWithConcurrency(channels.slice(0, 8), PROJECTION_READ_CONCURRENCY,
      async (channel) => ({ channelId: channel.channelId, ...await readProjection('evalListDmMessages', { runId, channelId: channel.channelId }) }));
    projections.dmThreads = {
      status: projections.dmChannels?.status !== 'succeeded' || messages.some((item) => item.status === 'failed') ? 'failed' : 'succeeded',
      value: { items: messages, truncated: channels.length > 8 || Boolean(projections.dmChannels?.value?.pageInfo?.hasMore || projections.dmChannels?.value?.pageInfo?.nextCursor) },
      error: projections.dmChannels?.status !== 'succeeded' || messages.some((item) => item.status === 'failed') ? { code: 'SLICE_EVAL_DM_PROJECTION_PARTIAL', message: '部分私聊读取失败，不能推断没有消息' } : null,
    };
    return cloneEvidence(projections);
  }

  async function continueEvaluation(previous, rawAction, onProgress = () => {}) {
    if (!connected()) {
      const error = new Error('请先登录 Eval Backend');
      error.code = 'SLICE_EVAL_SESSION_EXPIRED';
      error.status = 401;
      throw error;
    }
    if (state.activeTelemetry) throw new Error('已有评测正在运行，请等待当前轮收束');
    if (!previous?.input || !previous?.previewRuns?.current?.runId
      || !previous?.previewRuns?.v2Candidate?.runId) {
      throw new Error('当前报告没有可继续的双轨 Preview Run');
    }
    const normalizedAction = normalizeJourneyAction(rawAction);
    const action = journeyActionLabel(normalizedAction);
    const input = validateInput({
      ...previous.input,
      sourceDocument: null,
      evaluationMode: 'experience',
      playerActions: [action],
    });
    const result = cloneEvidence(previous);
    const startedAtMs = performance.now();
    const previousDurationMs = Number.isFinite(Number(result.durationMs)) ? Number(result.durationMs) : 0;
    result.status = 'running';
    result.completedAt = null;
    result.stoppedReason = null;
    result.operations = Array.isArray(result.operations) ? result.operations : [];
    result.turns = Array.isArray(result.turns) ? result.turns : [];
    const publish = (event) => onProgress({
      ...event,
      partialResult: cloneEvidence({
        ...result,
        durationMs: previousDurationMs + Math.max(0, Math.round(performance.now() - startedAtMs)),
      }),
    });
    state.activeTelemetry = { records: result.operations, onProgress: publish };
    try {
      const priorTurn = result.turns.at(-1);
      const previousProjections = {
        current: result.finalProjections?.current || priorTurn?.current?.projections
          || result.opening?.current?.projections || result.initialProjections?.current || null,
        v2Candidate: result.finalProjections?.v2Candidate || priorTurn?.v2Candidate?.projections
          || result.opening?.v2Candidate?.projections || result.initialProjections?.v2Candidate || null,
      };
      publish({
        kind: 'checkpoint', step: 'runtime', index: result.turns.length,
        message: `继续同一双轨 Run：第 ${result.turns.length + 1} 轮玩家行为`,
      });
      const turnStartedAtMs = performance.now();
      const [currentExecution, candidateExecution] = await Promise.all([
        executeJourneyAction(result.previewRuns.current, input, normalizedAction),
        executeJourneyAction(result.previewRuns.v2Candidate, input, normalizedAction),
      ]);
      currentExecution.projectionsBefore = previousProjections.current;
      candidateExecution.projectionsBefore = previousProjections.v2Candidate;
      currentExecution.projections = await readExperienceProjections(result.previewRuns.current.runId);
      candidateExecution.projections = await readExperienceProjections(result.previewRuns.v2Candidate.runId);
      currentExecution.projectionIssues = projectionIssues(currentExecution.projections);
      candidateExecution.projectionIssues = projectionIssues(candidateExecution.projections);
      result.turns.push({
        kind: normalizedAction.type,
        action,
        actionPayload: cloneEvidence(normalizedAction),
        current: currentExecution,
        v2Candidate: candidateExecution,
        durationMs: Math.max(0, Math.round(performance.now() - turnStartedAtMs)),
        continued: true,
      });
      result.finalProjections = {
        current: currentExecution.projections,
        v2Candidate: candidateExecution.projections,
      };
      result.finalProjectionIssues = {
        current: projectionIssues(currentExecution.projections),
        v2Candidate: projectionIssues(candidateExecution.projections),
      };
      await refreshTrace(result);
      const currentRoundPending = [currentExecution, candidateExecution]
        .some((execution) => execution.status === 'processing');
      const currentRoundHasIssue = [currentExecution, candidateExecution].some((execution) =>
        !['applied', 'processing'].includes(execution.status) || (execution.projectionIssues || []).length > 0);
      const historicalIssue = Boolean(result.error || result.traceError)
        || result.turns.slice(0, -1).some((turn) => [turn.current, turn.v2Candidate]
          .some((execution) => execution?.status !== 'applied' || (execution?.projectionIssues || []).length > 0))
        || [result.opening?.current, result.opening?.v2Candidate]
          .some((execution) => execution && execution.status !== 'applied');
      result.status = currentRoundPending ? 'waiting_for_backend'
        : currentRoundHasIssue || historicalIssue ? 'waiting_with_issues' : 'waiting_for_user';
      result.runtimePhase = currentRoundPending ? 'waiting_for_backend' : 'waiting_for_user';
      result.lastContinuation = {
        action,
        actionPayload: cloneEvidence(normalizedAction),
        completedAt: new Date().toISOString(),
        currentStatus: currentExecution.status,
        v2CandidateStatus: candidateExecution.status,
      };
      result.completedAt = result.lastContinuation.completedAt;
      result.durationMs = previousDurationMs + Math.max(0, Math.round(performance.now() - startedAtMs));
      publish({
        kind: 'complete', step: 'runtime', index: result.turns.length - 1,
        message: currentRoundPending
          ? '这一轮仍在后端处理；保留原 commandId，完成前不会开放下一步世界写入'
          : currentRoundHasIssue
            ? '这一轮已返回并保留双轨状态；存在异常，可检查证据后决定下一步'
            : '这一轮已写入同一双轨 Run，可继续输入下一轮行为',
      });
      return result;
    } catch (error) {
      if (error?.status !== 401 && result.experiment?.experimentId) {
        try { await refreshTrace(result); } catch {}
      }
      result.status = 'waiting_with_issues';
      result.runtimePhase = 'waiting_for_user';
      result.completedAt = new Date().toISOString();
      result.durationMs = previousDurationMs + Math.max(0, Math.round(performance.now() - startedAtMs));
      result.lastContinuation = { action, actionPayload: cloneEvidence(normalizedAction), completedAt: result.completedAt, error: compactError(error) };
      error.partialResult = cloneEvidence(result);
      throw error;
    } finally {
      state.activeTelemetry = null;
    }
  }

  async function startInteractiveRuntime(previous, onProgress = () => {}) {
    if (!connected()) {
      const error = new Error('请先登录 Eval Backend');
      error.code = 'SLICE_EVAL_SESSION_EXPIRED'; error.status = 401; throw error;
    }
    if (state.activeTelemetry) throw new Error('已有评测正在运行，请等待当前阶段收束');
    if (!previous?.input || previous?.experiment?.status !== 'succeeded'
      || !previous?.compiledPlans || !previous?.scenario?.worldDraftRevisionId
      || previous.previewRuns?.current || previous.previewRuns?.v2Candidate) {
      throw new Error('只能从“编译完成、尚未创建 Preview Run”的 Eval 结果进入 Runtime');
    }
    const input = validateInput({ ...previous.input, sourceDocument: null, evaluationMode: 'experience', playerActions: [] });
    const result = cloneEvidence(previous);
    const startedAtMs = performance.now();
    const previousDurationMs = Number.isFinite(Number(result.durationMs)) ? Number(result.durationMs) : 0;
    result.status = 'running'; result.runtimePhase = 'starting_runtime'; result.completedAt = null;
    result.operations = Array.isArray(result.operations) ? result.operations : [];
    const publish = (event) => onProgress({
      ...event,
      partialResult: cloneEvidence({ ...result,
        durationMs: previousDurationMs + Math.max(0, Math.round(performance.now() - startedAtMs)) }),
    });
    state.activeTelemetry = { records: result.operations, onProgress: publish };
    try {
      publish({ kind: 'checkpoint', step: 'preview', message: '按手机端开始游戏：创建 Current / V2 Preview Run' });
      const [current, candidate] = await Promise.all([
        call('createCompilerExperimentPreviewRun', {
          params: { experimentId: result.experiment.experimentId }, key: idempotency('preview-current'),
          body: previewRunRequest(input, 'current'),
        }),
        call('createCompilerExperimentPreviewRun', {
          params: { experimentId: result.experiment.experimentId }, key: idempotency('preview-v2'),
          body: previewRunRequest(input, 'v2_candidate'),
        }),
      ]);
      result.previewRuns = { current, v2Candidate: candidate };
      assertPreviewIdentity(current, input); assertPreviewIdentity(candidate, input);
      result.initialProjections.current = await readExperienceProjections(current.runId);
      result.initialProjections.v2Candidate = await readExperienceProjections(candidate.runId);
      publish({ kind: 'checkpoint', step: 'opening', message: '按手机端确认 Opening；本步结束后暂停等待玩家操作' });
      const openingStartedAtMs = performance.now();
      const [currentOpening, candidateOpening] = await Promise.all([
        safeExecuteOpeningRun(current.runId), safeExecuteOpeningRun(candidate.runId),
      ]);
      currentOpening.projectionsBefore = result.initialProjections.current;
      candidateOpening.projectionsBefore = result.initialProjections.v2Candidate;
      currentOpening.projections = await readExperienceProjections(current.runId);
      candidateOpening.projections = await readExperienceProjections(candidate.runId);
      currentOpening.projectionIssues = projectionIssues(currentOpening.projections);
      candidateOpening.projectionIssues = projectionIssues(candidateOpening.projections);
      result.opening = {
        current: currentOpening, v2Candidate: candidateOpening,
        durationMs: Math.max(0, Math.round(performance.now() - openingStartedAtMs)),
      };
      result.finalProjections = { current: currentOpening.projections, v2Candidate: candidateOpening.projections };
      result.finalProjectionIssues = {
        current: projectionIssues(currentOpening.projections),
        v2Candidate: projectionIssues(candidateOpening.projections),
      };
      await refreshTrace(result);
      const pending = [currentOpening, candidateOpening].some((execution) => execution.status === 'processing');
      const issue = [currentOpening, candidateOpening].some((execution) =>
        !['applied', 'processing'].includes(execution.status) || (execution.projectionIssues || []).length > 0) || Boolean(result.traceError);
      result.status = pending ? 'waiting_for_backend' : issue ? 'waiting_with_issues' : 'waiting_for_user';
      result.runtimePhase = pending ? 'waiting_for_backend' : 'waiting_for_user';
      result.completedAt = new Date().toISOString();
      result.durationMs = previousDurationMs + Math.max(0, Math.round(performance.now() - startedAtMs));
      publish({ kind: 'complete', step: 'opening', message: pending
        ? 'Opening 仍在后端处理；保留原 commandId，终态前不开放玩家下一步输入'
        : issue
          ? 'Opening 已返回并暂停；存在可定位问题，先检查证据再决定是否继续'
          : 'Opening 已完成并暂停；现在等待你输入下一步手机端操作' });
      return result;
    } catch (error) {
      if (result.experiment?.experimentId) { try { await refreshTrace(result); } catch {} }
      result.status = 'waiting_with_issues'; result.runtimePhase = 'runtime_start_failed';
      result.completedAt = new Date().toISOString();
      result.durationMs = previousDurationMs + Math.max(0, Math.round(performance.now() - startedAtMs));
      error.partialResult = cloneEvidence(result); throw error;
    } finally {
      state.activeTelemetry = null;
    }
  }

  async function resumeCompilation(previous, onProgress = () => {}) {
    if (!previous?.input || !UUID_RE.test(previous?.experiment?.experimentId || '')
      || !UUID_RE.test(previous?.scenario?.worldDraftRevisionId || '')
      || previous.previewRuns?.current || previous.previewRuns?.v2Candidate) {
      throw new Error('只能恢复已经持久保存、尚未创建试玩 Run 的编译实验');
    }
    return runFullEvaluation({ ...previous.input, sourceDocument: null }, onProgress, previous);
  }

  async function runFullEvaluation(rawInput, onProgress = () => {}, resume = null) {
    if (!connected()) {
      const error = new Error('请先登录 Eval Backend');
      error.code = 'SLICE_EVAL_SESSION_EXPIRED';
      error.status = 401;
      throw error;
    }
    if (state.activeTelemetry) throw new Error('已有评测正在运行，请等待当前轮收束');
    const input = validateInput(rawInput);
    stopRequested = false;
    const startedAtMs = performance.now();
    const result = {
      schemaVersion: 'slice.system-eval-run.v2',
      status: 'running',
      runtimePhase: 'compiling',
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: 0,
      input: { ...input, sourceDocument: input.sourceDocument ? { fileName: input.sourceDocument.fileName, contentDigest: input.sourceDocument.contentDigest, omittedFromEvidence: true } : null },
      scenario: null,
      experiment: null,
      compiledPlans: null,
      previewRuns: { current: null, v2Candidate: null },
      opening: { current: null, v2Candidate: null, durationMs: null },
      initialProjections: { current: null, v2Candidate: null },
      stoppedReason: null,
      turns: [],
      memoryCode: null,
      dmTargets: { target: null, current: null, v2Candidate: null },
      memoryVerification: null,
      finalProjections: { current: null, v2Candidate: null },
      finalProjectionIssues: { current: [], v2Candidate: [] },
      trace: null,
      traceError: null,
      operations: [],
      error: null,
    };
    const publish = (event) => {
      // Full snapshots are emitted only at review checkpoints. Cloning the growing
      // history for every projection/poll request makes long journeys quadratic.
      const checkpoint = ['checkpoint', 'complete', 'failed'].includes(event.kind);
      onProgress({
        ...event,
        ...(checkpoint ? { partialResult: cloneEvidence({
          ...result,
          durationMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
        }) } : {}),
      });
    };
    state.activeTelemetry = { records: result.operations, onProgress: publish };
    try {
      publish({
        kind: 'checkpoint', step: 'scenario',
        message: input.sourceWorldDraftRevisionId ? '加载内置 immutable 剧本 Revision' : '保存临时剧本与 Revision',
      });
      result.scenario = resume ? cloneEvidence(resume.scenario) : await createScenario(input);
      checkExperienceStop(input);
      publish({ kind: 'checkpoint', step: 'compile', message: '运行 Current / V2 Candidate 双轨编译' });
      const createdExperiment = resume ? cloneEvidence(resume.experiment)
        : await createCompilerExperimentWithRecovery(input, result.scenario.worldDraftRevisionId, publish);
      if (!createdExperiment?.experimentId) throw new Error('编译接口没有返回 experimentId');
      result.experiment = createdExperiment;
      publish({ kind: 'checkpoint', step: 'compile', message: resume ? '恢复同一持久编译任务；不重新创建 Source 或 Compiler 调用' : '编译任务已保存；开始读取 Worker 进度' });
      result.experiment = await waitForExperiment(createdExperiment.experimentId, publish, { result, input });
      await refreshTrace(result);
      checkExperienceStop(input);
      publish({ kind: 'checkpoint', step: 'compile', message: '读取双轨完整 Plan 正文与冻结规则' });
      result.compiledPlans = await call('getCompilerRuntimeEvalPlans', { params: { experimentId: result.experiment.experimentId } });
      if (result.compiledPlans?.schemaVersion !== 'slice.compiler-runtime-eval-plans.v1'
        || result.compiledPlans.experimentId !== result.experiment.experimentId
        || result.compiledPlans.worldDraftRevisionId !== result.scenario.worldDraftRevisionId
        || !['current', 'v2_candidate'].every((trackCode) => result.compiledPlans.tracks?.some((track) => track.trackCode === trackCode && track.status === 'available' && track.planJson))) {
        const error = new Error('完整 Plan 的 Experiment/Source 绑定或双轨正文不完整，已停止后续运行');
        error.code = 'SLICE_EVAL_PLAN_PIN_MISMATCH'; throw error;
      }
      if (input.evaluationMode === 'experience') {
        // Interactive Eval deliberately stops at the product boundary: source →
        // compile. Creating a Run, confirming Opening, or replaying a prefilled
        // action here would hide the exact input/output boundary the lab exists
        // to inspect.
        result.status = 'compiled_waiting_for_user';
        result.runtimePhase = 'compiled_waiting_for_user';
        result.completedAt = new Date().toISOString();
        result.durationMs = Math.max(0, Math.round(performance.now() - startedAtMs));
        publish({
          kind: 'complete', step: 'compile',
          message: '双轨编译完成并已暂停；完整 Plan / GameConfig / Opening / Selection Trace 已可查看，等待你显式进入 Runtime',
        });
        return result;
      }
      publish({ kind: 'checkpoint', step: 'compile', message: '完整 Plan 已读取；回归模式继续创建试玩 Run' });
      checkExperienceStop(input);
      publish({ kind: 'checkpoint', step: 'preview', message: '创建双 Preview Run' });
      const [current, candidate] = await Promise.all([
        call('createCompilerExperimentPreviewRun', { params: { experimentId: result.experiment.experimentId }, key: idempotency('preview-current'), body: previewRunRequest(input, 'current') }),
        call('createCompilerExperimentPreviewRun', { params: { experimentId: result.experiment.experimentId }, key: idempotency('preview-v2'), body: previewRunRequest(input, 'v2_candidate') }),
      ]);
      result.previewRuns = { current, v2Candidate: candidate };
      assertPreviewIdentity(current, input);
      assertPreviewIdentity(candidate, input);
      checkExperienceStop(input);

      publish({ kind: 'checkpoint', step: 'opening', message: '确认双轨服务端 Opening Post' });
      if (input.evaluationMode === 'experience') {
        result.initialProjections.current = await readExperienceProjections(current.runId);
        result.initialProjections.v2Candidate = await readExperienceProjections(candidate.runId);
      }
      checkExperienceStop(input);
      const openingStartedAtMs = performance.now();
      const [currentOpening, candidateOpening] = await Promise.all([
        safeExecuteOpeningRun(current.runId), safeExecuteOpeningRun(candidate.runId),
      ]);
      result.opening = {
        current: currentOpening,
        v2Candidate: candidateOpening,
        durationMs: Math.max(0, Math.round(performance.now() - openingStartedAtMs)),
      };
      if (input.evaluationMode === 'experience') {
        currentOpening.projectionsBefore = result.initialProjections.current;
        candidateOpening.projectionsBefore = result.initialProjections.v2Candidate;
        currentOpening.projections = await readExperienceProjections(current.runId);
        candidateOpening.projections = await readExperienceProjections(candidate.runId);
        currentOpening.projectionIssues = projectionIssues(currentOpening.projections);
        candidateOpening.projectionIssues = projectionIssues(candidateOpening.projections);
      }
      await refreshTrace(result);
      publish({ kind: 'checkpoint', step: 'opening', message: '双轨 Opening 已返回终态，Trace 已刷新' });
      if ([currentOpening, candidateOpening].some((execution) => execution.status !== 'applied')) {
        const error = new Error('至少一条 Preview Track 的 Opening Command 未成功 Apply，后续 Runtime 已停止。');
        error.code = 'SLICE_EVAL_OPENING_FAILED';
        error.opening = cloneEvidence(result.opening);
        throw error;
      }

      if (input.evaluationMode === 'experience') {
        let previous = { current: currentOpening.projections, v2Candidate: candidateOpening.projections };
        for (let index = 0; index < input.playerActions.length; index += 1) {
          if (stopRequested) { result.stoppedReason = 'user_requested'; break; }
          const action = input.playerActions[index];
          publish({ kind: 'checkpoint', step: 'runtime', index, message: `剧情体验 ${index + 1}/${input.playerActions.length}：提交同一玩家行动` });
          const turnStarted = performance.now();
          const [left, right] = await Promise.all([
            executeJourneyAction(current, input, action), executeJourneyAction(candidate, input, action),
          ]);
          // 当前步骤的投影必须在下一步命令前读取、复制，不能事后用最终快照回填。
          left.projectionsBefore = previous.current;
          right.projectionsBefore = previous.v2Candidate;
          left.projections = await readExperienceProjections(current.runId);
          right.projections = await readExperienceProjections(candidate.runId);
          left.projectionIssues = projectionIssues(left.projections);
          right.projectionIssues = projectionIssues(right.projections);
          result.turns.push({ kind: parseJourneyAction(action).type, action, current: left, v2Candidate: right, durationMs: Math.round(performance.now() - turnStarted) });
          previous = { current: left.projections, v2Candidate: right.projections };
          await refreshTrace(result);
          publish({ kind: 'checkpoint', step: 'runtime', index, message: `第 ${index + 1} 轮已完成：剧情、角色回应与数值快照已保存` });
          if ([left, right].some((execution) => execution.status !== 'applied')) {
            result.stoppedReason = 'command_not_applied'; break;
          }
        }
        result.finalProjections = previous;
        result.finalProjectionIssues = { current: projectionIssues(previous.current), v2Candidate: projectionIssues(previous.v2Candidate) };
        const executions = [currentOpening, candidateOpening, ...result.turns.flatMap((turn) => [turn.current, turn.v2Candidate])];
        const issues = result.traceError || executions.some((execution) => execution.status !== 'applied' || execution.projectionIssues?.length);
        result.status = result.stoppedReason === 'user_requested' ? 'stopped' : issues ? 'completed_with_issues' : 'completed';
        result.completedAt = new Date().toISOString();
        result.durationMs = Math.round(performance.now() - startedAtMs);
        publish({ kind: 'complete', step: 'complete', message: result.status === 'stopped' ? '已在回合边界停止，保留全部已完成证据' : '剧情体验已结束' });
        return result;
      }

      result.memoryCode = `蓝鲸-${String(result.experiment.experimentId).slice(-8)}`;
      const appendTypedTurn = async ({ kind, action, currentTask, candidateTask }) => {
        const index = result.turns.length;
        publish({
          kind: 'checkpoint', step: 'runtime', index,
          message: `执行第 ${index + 1} 轮双 Runtime：${kind}`,
        });
        const turnStartedAtMs = performance.now();
        const [currentResult, candidateResult] = await Promise.all([currentTask(), candidateTask()]);
        result.turns.push({
          kind, action,
          current: currentResult,
          v2Candidate: candidateResult,
          durationMs: Math.max(0, Math.round(performance.now() - turnStartedAtMs)),
        });
        await refreshTrace(result);
        publish({
          kind: 'checkpoint', step: 'runtime', index,
          message: `第 ${index + 1} 轮 ${kind} 已返回终态，Trace 已刷新`,
        });
        return result.turns.at(-1);
      };

      const commentBody = commandBody(
        input.playerActions[0],
        '我先确认这条公开信息里，哪些是事实，哪些只是推测。',
      );
      await appendTypedTurn({
        kind: 'comment', action: commentBody,
        currentTask: () => safeExecuteCommentRun(current.runId, commentBody),
        candidateTask: () => safeExecuteCommentRun(candidate.runId, commentBody),
      });

      const dmTarget = resolveScenarioDmTarget(input, input.playerActions[1]);
      publish({
        kind: 'checkpoint', step: 'runtime',
        message: `为双轨绑定同一角色私聊：${dmTarget.displayName || dmTarget.characterVersionId}`,
      });
      const [currentDmTarget, candidateDmTarget] = await Promise.all([
        ensureDirectDmChannel(current.runId, current, dmTarget),
        ensureDirectDmChannel(candidate.runId, candidate, dmTarget),
      ]);
      result.dmTargets = {
        target: dmTarget,
        current: currentDmTarget,
        v2Candidate: candidateDmTarget,
      };

      const dmWriteBody = commandBody(
        input.playerActions[1],
        '请记住我接下来告诉你的评测代号。',
        `\n本轮评测代号是「${result.memoryCode}」。稍后我会再次问你。`,
      );
      const dmWriteTurn = await appendTypedTurn({
        kind: 'dm_message_write', action: dmWriteBody,
        currentTask: () => safeExecuteDmRun(current.runId, dmWriteBody, currentDmTarget.channelId),
        candidateTask: () => safeExecuteDmRun(candidate.runId, dmWriteBody, candidateDmTarget.channelId),
      });
      const currentChannelId = dmWriteTurn.current?.payload?.channelId || null;
      const candidateChannelId = dmWriteTurn.v2Candidate?.payload?.channelId || null;

      const eventActionLabel = commandBody(
        input.playerActions[2],
        '选择 Opening 生成的第一条正式 Event Choice。',
      );
      await appendTypedTurn({
        kind: 'event_action', action: eventActionLabel,
        currentTask: () => safeExecuteEventRun(current.runId),
        candidateTask: () => safeExecuteEventRun(candidate.runId),
      });

      const dmRecallBody = commandBody(
        input.playerActions[3],
        '请回忆我们刚才的私聊。',
        '\n上一条私聊里，我让你记住的评测代号是什么？只回答你实际记得的内容。',
      );
      await appendTypedTurn({
        kind: 'dm_message_recall', action: dmRecallBody,
        currentTask: () => safeExecuteDmRun(current.runId, dmRecallBody, currentChannelId),
        candidateTask: () => safeExecuteDmRun(candidate.runId, dmRecallBody, candidateChannelId),
      });
      publish({ kind: 'checkpoint', step: 'runtime', message: '读取双轨最终完整产品表面快照' });
      result.finalProjections = {
        current: await readRunProjections(current.runId, currentChannelId),
        v2Candidate: await readRunProjections(candidate.runId, candidateChannelId),
      };
      result.finalProjectionIssues = {
        current: projectionIssues(result.finalProjections.current),
        v2Candidate: projectionIssues(result.finalProjections.v2Candidate),
      };
      result.memoryVerification = {
        current: verifyMemoryRecall(result.finalProjections.current, result.memoryCode),
        v2Candidate: verifyMemoryRecall(result.finalProjections.v2Candidate, result.memoryCode),
      };

      publish({ kind: 'checkpoint', step: 'trace', message: '刷新最终 Compiler + Runtime 受限 Trace' });
      await refreshTrace(result);
      const executions = [
        result.opening.current, result.opening.v2Candidate,
        ...result.turns.flatMap((turn) => [turn.current, turn.v2Candidate]),
      ];
      const hasIssues = Boolean(result.traceError)
        || executions.some((execution) => execution?.status !== 'applied'
          || (execution?.projectionIssues || []).length > 0)
        || Object.values(result.finalProjectionIssues || {}).some((issues) => (issues || []).length > 0)
        || Object.values(result.memoryVerification || {}).some((verification) => !verification?.passed);
      result.status = hasIssues ? 'completed_with_issues' : 'completed';
      result.completedAt = new Date().toISOString();
      result.durationMs = Math.max(0, Math.round(performance.now() - startedAtMs));
      publish({
        kind: 'complete', step: 'complete',
        message: hasIssues ? '全链路完成，存在可定位问题' : '全链路执行成功',
      });
      return result;
    } catch (error) {
      if (error?.status !== 401 && result.experiment?.experimentId) {
        try { await refreshTrace(result); } catch {}
      }
      if (error?.code === 'SLICE_EVAL_STOP_REQUESTED') {
        result.status = 'stopped'; result.stoppedReason = 'user_requested';
        result.completedAt = new Date().toISOString();
        result.durationMs = Math.round(performance.now() - startedAtMs);
        publish({ kind: 'complete', step: 'complete', message: '已停止，保留已完成阶段的证据' });
        return result;
      }
      result.status = 'failed';
      result.completedAt = new Date().toISOString();
      result.durationMs = Math.max(0, Math.round(performance.now() - startedAtMs));
      result.error = compactError(error);
      error.partialResult = cloneEvidence(result);
      publish({
        kind: 'failed',
        step: OPERATION_STAGES[error.operationId] || (error.code === 'SLICE_EVAL_OPENING_FAILED' ? 'opening' : 'system'),
        message: error.message || String(error),
      });
      throw error;
    } finally {
      state.activeTelemetry = null;
    }
  }

  async function withConsoleTelemetry(records, onProgress, task) {
    if (state.activeTelemetry) throw new Error('已有操作正在执行，请等待当前操作返回');
    state.activeTelemetry = { records, onProgress };
    try { return await task(); } finally { state.activeTelemetry = null; }
  }

  window.SliceEvalBackend = Object.freeze({
    workspaceId: () => connected() ? state.session.workspaceId : null,
    consoleTools: Object.freeze({
      call, withTelemetry: withConsoleTelemetry, validateInput, compactError,
      buildCreateWorldDraftRequest, buildCreateWorldDraftRevisionRequest,
      buildCreateCompilerExperimentRequest, createCompilerExperimentWithRecovery,
      waitForExperiment, readExperienceProjections, projectionIssues, refreshTrace,
      previewRunRequest, assertPreviewIdentity, readOpeningBody, waitForOutcome,
    }),
    loadContract, connect, disconnect, connected, runFullEvaluation, startInteractiveRuntime, continueEvaluation, resumeCompilation, requestStop,
    __testing: Object.freeze({
      validateInput, normalizeSourceDocument, normalizeInputCharacters, previewRunRequest, assertPreviewIdentity, buildWorldSeed, buildWorldDraftContent,
      parseJourneyAction, normalizeJourneyAction, journeyActionLabel, executeJourneyAction, executeActivityMutation, executeActivityTurn,
      executeNpcReplyRun, readExperienceProjections, directMessageChannel,
      waitForExperiment,
      buildCreateWorldDraftRequest, buildCreateWorldDraftRevisionRequest,
      buildCreateCompilerExperimentRequest, backendRouteError, compactError,
      executeOpeningRun, executeCommentRun, executeEventRun, executeDmRun, executeRun,
      safeExecuteOpeningRun, safeExecuteCommentRun, safeExecuteEventRun, safeExecuteDmRun, safeExecuteRun,
      readOpeningBody, readRunProjectionSubset, readRunProjections, readCommandProjections,
      projectionIssues, verifyMemoryRecall,
      resolveScenarioDmTarget, actorIdForCharacterVersion, ensureDirectDmChannel,
      refreshTrace, waitForOutcome, createCompilerExperimentWithRecovery, safeOperationBody, safeOperationOutput, ZERO_CAST_POLICY,
    }),
  });
})();
