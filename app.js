(() => {
  'use strict';

  const CANVAS_SIZE = { width: 4300, height: 2580 };

  const STAGES = [
    {
      id: 'source', number: '00', title: '原始输入', subtitle: '剧本、人设与固定测试路径',
      x: 80, y: 100, w: 430, h: 850, className: 'source'
    },
    {
      id: 'compiler', number: '01', title: '剧本编译', subtitle: '把创作输入变成 Runtime 可稳定调用的世界资产',
      x: 560, y: 100, w: 1900, h: 850, className: 'compiler', start: true
    },
    {
      id: 'bootstrap', number: '02', title: '开局生成', subtitle: '创建 Run、构造首轮 Context，并投影第一批玩家反馈',
      x: 2520, y: 100, w: 1600, h: 850, className: 'bootstrap'
    },
    {
      id: 'journey', number: '03', title: '玩家旅程', subtitle: '每轮都能看见输入、决策、模型调用、状态写入与产品表面输出',
      x: 80, y: 1040, w: 4040, h: 1450, className: 'journey'
    }
  ];

  const ROWS = [
    { id: 'comments', label: 'TURN 01', title: 'Opening → 真实评论', subtitle: '在服务端生成的正式首帖下提交 comment，并读取公开产品表面', x: 105, y: 1145, w: 3990, h: 252 },
    { id: 'dm', label: 'TURN 02', title: '真实私聊 → 写入记忆', subtitle: '在 Opening 创建的 Direct Channel 中发送 dm_message，并写入唯一评测代号', x: 105, y: 1435, w: 3990, h: 252 },
    { id: 'event', label: 'TURN 03', title: '正式 Event Choice → 结算', subtitle: '读取 Event API 返回的 eventId 与 choiceId，提交真实 event_action', x: 105, y: 1725, w: 3990, h: 252 },
    { id: 'memory', label: 'TURN 04', title: '同一私聊 → 记忆召回', subtitle: '再次向同一角色追问代号，验证 RAG、Graph、Vector 与私有 POV 召回', x: 105, y: 2015, w: 3990, h: 252 }
  ];

  const FALLBACK_SCENARIO = Object.freeze({
    id: 'fallback-investigation',
    title: '雾港调查',
    worldDescription: '一座港城正在经历连续停电，玩家需要调查线索并作出会改变公共信任的选择。',
    worldSetting: '城市由码头委员会管理，公开承诺和证据会改变角色关系与城市秩序。',
    worldGoal: '查明停电真相并让委员会公开承认责任',
    highlightDescription: '第一条匿名线索将玩家引向一份被隐藏的港口档案。',
    evaluationInstruction: '比较 current 与 v2_candidate：重点检查玩家能动性、信息边界、因果连续性与可玩性。',
    playerActions: ['我公开说明停电前看到的异常。', '我追问回应者掌握的证据。'],
    topicTags: ['调查', '悬疑'],
    personaOptions: ['调查者'],
    characterVersionIds: [],
    characters: [],
    sourceFile: null,
    sourceDigest: null,
    worldDraftRevisionId: null,
  });
  const SCENARIO_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  const scenarioManifest = window.SLICE_EVAL_SCENARIOS;
  const roleIndex = window.SLICE_EVAL_ROLE_INDEX;
  const scenarioManifestTrusted = ['slice.eval-scenario-library.v1', 'slice.eval-scenario-library.v2']
    .includes(scenarioManifest?.schemaVersion)
    && scenarioManifest?.backendApiOrigin === window.SLICE_EVAL_AUTH?.backendApiOrigin;
  const roleIndexTrusted = roleIndex?.schemaVersion === 'slice.eval-role-index.v1'
    && roleIndex?.backendApiOrigin === window.SLICE_EVAL_AUTH?.backendApiOrigin
    && roleIndex?.scenarios && typeof roleIndex.scenarios === 'object';
  const withRoleIndex = (item) => {
    const roleScenario = roleIndexTrusted ? roleIndex.scenarios[item.id] : null;
    if (!roleScenario) return item;
    const characters = Array.isArray(roleScenario.characters)
      ? roleScenario.characters.map((character) => ({ ...character, sourceTitle: item.title })) : [];
    return {
      ...item,
      worldDraftRevisionId: roleScenario.worldDraftRevisionId,
      characters,
      characterVersionIds: characters.map((character) => character.characterVersionId),
    };
  };
  const scenarioLibrary = scenarioManifestTrusted && Array.isArray(scenarioManifest.scenarios)
    ? scenarioManifest.scenarios.map(withRoleIndex).filter((item) => item
      && /^[a-z0-9][a-z0-9-]{2,63}$/u.test(String(item.id || ''))
      && typeof item.title === 'string' && item.title.length >= 1
      && typeof item.worldDescription === 'string' && item.worldDescription.length >= 1
      && typeof item.worldSetting === 'string' && item.worldSetting.length >= 1
      && typeof item.worldGoal === 'string' && item.worldGoal.length >= 1
      && /^[a-f0-9]{64}$/u.test(String(item.sourceDigest || ''))
      && SCENARIO_UUID_RE.test(String(item.worldDraftRevisionId || ''))
      && Array.isArray(item.characterVersionIds || [])
      && (item.characterVersionIds || []).length <= 8
      && (item.characterVersionIds || []).every((value) => SCENARIO_UUID_RE.test(String(value || '')))
      && Array.isArray(item.characters || [])
      && (item.characters || []).length === (item.characterVersionIds || []).length
      && (item.characters || []).every((character, index) => character
        && typeof character.displayName === 'string' && character.displayName.length >= 1
        && String(character.characterVersionId || '') === String((item.characterVersionIds || [])[index] || ''))
      && Array.isArray(item.playerActions)
      && item.playerActions.length >= 1 && item.playerActions.length <= 24)
    : [];
  const initialScenario = scenarioLibrary[0] || FALLBACK_SCENARIO;
  const sourceScript = {
    worldTitle: initialScenario.title,
    worldDescription: initialScenario.worldDescription,
    worldSetting: initialScenario.worldSetting,
    worldGoal: initialScenario.worldGoal,
    sourceFile: initialScenario.sourceFile || null,
    sourceDigest: initialScenario.sourceDigest || null,
    worldDraftRevisionId: initialScenario.worldDraftRevisionId || null,
  };

  const node = (data) => ({
    ...data,
    status: 'waiting',
    statusText: '等待真实执行',
    duration: '—',
    tokens: '—',
    cost: '—',
    changed: false,
    issue: '',
    input: { state: 'not_executed' },
    output: { state: 'not_executed' },
    expectedShort: data.expectedShort || '运行后显示后端证据',
    expected: data.expected || { state: 'not_executed' },
    rules: data.rules || [],
    dependencies: data.dependencies || [],
    scores: { correctness: 0, usefulness: 0, quality: 0 },
    note: '',
    preview: undefined,
    score: undefined,
    tags: []
  });

  const NODES = [
    node({
      id: 'source_script', stage: 'source', kind: 'source', kindLabel: 'SOURCE',
      title: '剧本源文件', subtitle: '创作者写入的完整开场剧本', x: 120, y: 200, w: 350, h: 260,
      inputShort: '四字段 World Core', outputShort: '运行后显示后端 Revision',
      summary: '这里放的是最原始的创作输入。评测必须先确认“编译器到底收到了什么”，否则后面的 Runtime 问题无法定位。',
      input: sourceScript,
      output: { state: 'backend_evidence_required' },
      expected: { ...sourceScript, validation: 'all required fields present' },
      rules: ['原始文本不直接进入每一轮 Runtime。', '所有角色卡必须带有身份、欲望、边界、关系和说话方式。']
    }),
    node({
      id: 'source_player', stage: 'source', kind: 'source', kindLabel: 'PLAYER',
      title: '玩家人设', subtitle: '玩家以什么身份进入世界', x: 120, y: 510, w: 350, h: 180,
      inputShort: '玩家身份', outputShort: '运行后显示后端证据',
      summary: '玩家人设不是角色介绍，而是 Runtime 判断“玩家能做什么、别人如何看她”的基础输入。',
      input: { identityOptions: ['姜允书', '继承候选人', '家族律师之女'], selectedIndex: 0 },
      output: { state: 'backend_evidence_required' },
      rules: ['不得替玩家补写未选择的过去。', 'NPC 只能依据公开身份和已知事件形成判断。'],
      dependencies: [{ id: 'source_script', relation: '受世界设定约束' }]
    }),
    node({
      id: 'source_test_plan', stage: 'source', kind: 'source', kindLabel: 'TEST PLAN',
      title: '固定玩家路径', subtitle: '本次回归要经过哪些体验节点', x: 120, y: 730, w: 350, h: 170,
      inputShort: '固定玩家行动', outputShort: '运行后显示后端证据',
      summary: '固定玩家输入用于回归对比，避免每次靠人工随便玩导致结果不可比。',
      input: ['发一条公开帖', '追问评论者', '离开宴会去书房', '选择公开录音'],
      output: { state: 'backend_evidence_required' },
      expectedShort: '同输入可稳定复现',
      expected: { deterministicInputs: true, checkpoints: 8 },
      rules: ['测试输入固定，模型参数和版本必须记录。']
    }),

    node({
      id: 'compile_normalize', stage: 'compiler', kind: 'compiler', kindLabel: 'PREPROCESS',
      title: 'Source Normalizer', subtitle: '清洗、拆段、补齐结构并生成引用 ID', x: 620, y: 330, w: 280, h: 200,
      inputShort: '四字段 Source', outputShort: '运行后显示后端证据',
      summary: '把创作者长文本拆成后续编译器可以稳定引用的小块，并保留每一条内容的来源。',
      input: sourceScript,
      output: { state: 'backend_evidence_required' },
      expectedShort: '无丢字段 · 可追溯',
      expected: { blocks: '40–55', missingFields: [], sourceTraceability: true },
      rules: ['不得在 Normalizer 阶段改写故事含义。', '每一条生成字段必须能回溯到 sourceRef。'],
      dependencies: [{ id: 'source_script', relation: '完整剧本输入' }]
    }),
    node({
      id: 'compile_world_core', stage: 'compiler', kind: 'compiler', kindLabel: 'COMPILER',
      title: 'World Core Compiler', subtitle: '提取世界承诺、冲突、行动空间与节奏边界', x: 980, y: 160, w: 300, h: 215,
      inputShort: '四字段 Source', outputShort: '运行后显示后端 Artifact',
      summary: '把长剧本文本压缩成 Runtime 可以稳定引用的世界骨架；这是后续所有 Context 的最高层指导。',
      input: { sourceRefs: ['title', 'description', 'setting', 'goal'], highlightDescription: 'optional' },
      output: { state: 'backend_evidence_required' },
      expectedShort: '冲突具体 · 玩家可行动',
      expected: {
        playerPromise: '具体、可感知、能指导前 3 轮体验',
        centralConflict: '至少包含权力、关系、旧案三层冲突',
        coreActions: '4–7 个语义不同的行动',
        toneGuards: '可被 Runtime 检查'
      },
      rules: ['World Core 必须回答：玩家为什么要继续玩？', '禁止把世界观重新摘要成文学简介。', 'Core Action 之间必须存在真实差异。'],
      dependencies: [{ id: 'compile_normalize', relation: '规范化 Source Blocks' }]
    }),
    node({
      id: 'compile_cast', stage: 'compiler', kind: 'compiler', kindLabel: 'COMPILER',
      title: 'Character Graph Compiler', subtitle: '编译 8 个角色的欲望、边界、筹码与关系图', x: 980, y: 430, w: 300, h: 230,
      inputShort: '8 个真实 CharacterVersion', outputShort: '运行后显示后端角色证据',
      summary: '角色图决定“谁会回应、为什么回应、知道什么、不能做什么”，也是评论和私聊差异的主要来源。',
      input: { characterVersionIds: '1..8 immutable UUIDs', castMode: 'authored_character_versions' },
      output: {
        castMode: 'backend evidence',
        agencyGraph: 'backend evidence'
      },
      expectedShort: '按后端 Cast 证据评估',
      expected: { castMode: 'eight authored CharacterVersions', povFactsSeparated: true },
      rules: ['内置剧本必须绑定原始人物卡对应的 8 个真实 CharacterVersion。', '禁止前端编造 CharacterVersion UUID。'],
      dependencies: [{ id: 'compile_normalize', relation: 'Source' }, { id: 'compile_world_core', relation: '世界冲突与约束' }]
    }),
    node({
      id: 'compile_narrative', stage: 'compiler', kind: 'compiler', kindLabel: 'PLANNER',
      title: 'Narrative Planner', subtitle: '生成里程碑、Seeds、压力节奏和潜在高光', x: 1350, y: 160, w: 300, h: 230,
      inputShort: 'World Core + optional highlight', outputShort: '运行后显示后端 Narrative 证据',
      summary: '不是提前写死剧情，而是给 Director 一组带触发条件、代价和后续空间的剧情种子。',
      input: { worldCoreRef: 'world_core.v5', highlightDescription: 'optional', desiredRunLength: 'medium' },
      output: { state: 'backend_evidence_required' },
      expectedShort: '高光描述只作为后端素材',
      expected: { seeds: 'backend evidence', highlightIsOptional: true, everyChoiceHasCost: true },
      rules: ['Seed 必须包含 trigger / escalation / affordance / cost。', '高光只能作为可能性，不得替玩家完成选择。'],
      dependencies: [{ id: 'compile_world_core', relation: '玩家承诺与中心冲突' }, { id: 'compile_normalize', relation: '可选高光描述' }]
    }),
    node({
      id: 'compile_social', stage: 'compiler', kind: 'compiler', kindLabel: 'SOCIAL',
      title: 'Social Surface Planner', subtitle: '规划评论、回复、私聊和群体反应如何出现', x: 1350, y: 430, w: 300, h: 230,
      inputShort: 'Cast + surfaces', outputShort: '运行后显示后端响应证据',
      summary: '把“角色会做什么”进一步映射为产品里的评论、回复、私聊、关注和沉默。',
      input: { castRef: 'character_graph.v4', surfaces: ['feed_comment', 'comment_reply', 'dm', 'event', 'follow'] },
      output: { state: 'backend_evidence_required' },
      expectedShort: '回应与沉默都有原因',
      expected: { surfacePolicies: '10–18', silenceRules: '>=3', privacyBoundaries: '>=8' },
      rules: ['不是所有角色都必须回应。', '公开评论与私聊必须使用不同的信息边界。'],
      dependencies: [{ id: 'compile_cast', relation: '角色欲望与关系边' }, { id: 'compile_world_core', relation: 'Tone Guards' }]
    }),
    node({
      id: 'compile_memory', stage: 'compiler', kind: 'compiler', kindLabel: 'MEMORY',
      title: 'Memory & Relationship Seed', subtitle: '初始化事实、关系维度和可回调的情感锚点', x: 1720, y: 160, w: 300, h: 230,
      inputShort: 'Cast + player persona', outputShort: '运行后显示后端记忆证据',
      summary: '决定哪些事实进入 Canon、哪些只是传闻，以及关系变化应落在哪个维度。',
      input: { playerRef: 'player.identity.0', castRef: 'character_graph.v4', worldFacts: 31 },
      output: { state: 'backend_evidence_required' },
      expectedShort: '事实分层 · 关系可解释',
      expected: { canonicalFacts: '25–40', privateFactsSeparated: true, relationshipDimensions: '5–8' },
      rules: ['关系不是单一好感度。', '每次变化必须有 causeRef，之后回调必须能解释来源。'],
      dependencies: [{ id: 'compile_cast', relation: '关系图' }, { id: 'source_player', relation: '玩家身份' }]
    }),
    node({
      id: 'compile_guardrails', stage: 'compiler', kind: 'compiler', kindLabel: 'POLICY',
      title: 'POV & Runtime Guardrails', subtitle: '把世界规则转成可校验的运行时边界', x: 1720, y: 430, w: 300, h: 230,
      inputShort: 'World + Cast + Memory', outputShort: '运行后显示后端 Guard 证据',
      summary: '将“不要泄漏隐私、不要替玩家选、不要让锁定角色出场”等要求变成明确的 Runtime 检查项。',
      input: { worldCoreRef: 'world_core.v5', characterGraphRef: 'character_graph.v4', memorySeedRef: 'memory_seed.v3' },
      output: { state: 'backend_evidence_required' },
      expectedShort: '27 条可执行 Guard',
      expected: { guards: '20–35', allHaveViolationCode: true, allHaveEvidenceRefs: true },
      rules: ['Guardrail 必须有 violationCode 与 evidenceRefs。', '模型文案检查和状态写入检查必须分开。'],
      dependencies: [{ id: 'compile_world_core', relation: '世界规则' }, { id: 'compile_cast', relation: 'POV' }, { id: 'compile_memory', relation: '事实权限' }]
    }),
    node({
      id: 'compile_bundle', stage: 'compiler', kind: 'output', kindLabel: 'ARTIFACT',
      title: 'Compiled World Bundle', subtitle: 'Runtime 真正读取的完整世界产物', x: 2110, y: 300, w: 300, h: 250,
      inputShort: 'Compiler artifacts', outputShort: '运行后显示后端 Artifact',
      summary: '这是编译阶段的最终答案。评测页面必须能直接展开它，并看清每一部分之后会被哪个 Runtime 节点使用。',
      input: { artifacts: ['world_core.v5', 'character_graph.v4', 'narrative_plan.v3', 'social_plan.v2', 'memory_seed.v3', 'runtime_guards.v2'] },
      output: { state: 'backend_evidence_required' },
      expectedShort: 'Runtime Ready · 0 fail',
      expected: { schemaVersion: 'world-definition.v5', runtimeReady: true, validators: { failed: 0 } },
      rules: ['只有 Bundle Validator 通过后才允许创建 Eval Run。', 'Bundle 内的 sourceRef 不得丢失。'],
      dependencies: [
        { id: 'compile_world_core', relation: 'World Core' }, { id: 'compile_cast', relation: 'Character Graph' },
        { id: 'compile_narrative', relation: 'Narrative Plan' }, { id: 'compile_social', relation: 'Social Plan' },
        { id: 'compile_memory', relation: 'Memory Seed' }, { id: 'compile_guardrails', relation: 'Runtime Guards' }
      ]
    }),

    node({
      id: 'runtime_create', stage: 'bootstrap', kind: 'apply', kindLabel: 'RUN',
      title: 'Create Eval Run', subtitle: '用世界版本和玩家身份创建隔离运行', x: 2580, y: 200, w: 260, h: 200,
      inputShort: 'WorldVersion + identity', outputShort: '运行后显示后端 Preview Run',
      summary: '创建一个不会污染线上用户数据的隔离 Run，并冻结本次评测用的世界版本、模型版本和玩家身份。',
      input: { state: 'backend_evidence_required' },
      output: { state: 'backend_evidence_required' },
      expectedShort: '隔离 Run · rev 0',
      expected: { isolation: 'eval_preview', sideEffects: 'none', revision: 0 },
      rules: ['Eval Run 不能写入 Production 社交图。', '所有后续 Command 必须带 expectedRevision。'],
      dependencies: [{ id: 'compile_bundle', relation: '世界版本' }, { id: 'source_player', relation: '身份选择' }]
    }),
    node({
      id: 'runtime_opening_context', stage: 'bootstrap', kind: 'context', kindLabel: 'CONTEXT',
      title: 'Opening Context Builder', subtitle: '为开局挑选最少但足够的世界信息', x: 2920, y: 160, w: 280, h: 220,
      inputShort: 'Bundle + player + revision', outputShort: '运行后显示后端 Context 证据',
      summary: '开局不应该把完整世界全部塞给模型，而是选择玩家承诺、当前压力、首批角色和可见事实。',
      input: { state: 'backend_evidence_required' },
      output: { state: 'backend_evidence_required' },
      expectedShort: '只取开局必要 Context',
      expected: { tokens: '<6500', privateFactsExcluded: true, lockedCharactersExcluded: true },
      rules: ['Context 必须给出 selectedRefs 与 exclusion reason。', '不得因为“可能有用”就加载全部角色。'],
      dependencies: [{ id: 'compile_bundle', relation: '编译世界包' }, { id: 'runtime_create', relation: 'Run 状态' }]
    }),
    node({
      id: 'runtime_opening_director', stage: 'bootstrap', kind: 'decision', kindLabel: 'DIRECTOR',
      title: 'Opening Director', subtitle: '决定开局压力、首个回应者和产品表面', x: 3270, y: 160, w: 280, h: 220,
      inputShort: 'Opening Context', outputShort: '运行后显示后端 Director 证据',
      summary: 'Director 不负责写文案，而是先决定“这轮要发生什么、谁回应、出现在哪个表面、强度多大”。',
      input: { state: 'backend_evidence_required' },
      output: { state: 'backend_evidence_required' },
      expectedShort: '具体压力 · 不抢玩家选择',
      expected: { pressure: 'immediate and actionable', intensity: '1–2', playerChoiceInvented: false },
      rules: ['开局 20 秒内必须出现可回应的具体压力。', '不得先写长世界观介绍。'],
      dependencies: [{ id: 'runtime_opening_context', relation: '可用 Context' }]
    }),
    node({
      id: 'runtime_opening_llm', stage: 'bootstrap', kind: 'llm', kindLabel: 'MODEL CALL',
      title: 'Opening Generation', subtitle: '根据 Director 决策生成玩家可见开局', x: 3620, y: 160, w: 280, h: 220,
      inputShort: 'Opening Prompt', outputShort: '运行后显示后端 Model 证据',
      summary: '模型只负责在已经明确的意图、角色、表面和边界内生成候选内容。',
      input: { state: 'backend_evidence_required' },
      output: { state: 'backend_evidence_required' },
      expectedShort: '短、可回应、有角色差异',
      expected: { completionTokens: '<800', exposition: 'low', immediatePressure: true },
      rules: ['不解释规则。', '不替玩家接受或拒绝座位。', '首个 NPC 只说其有权限知道的内容。'],
      dependencies: [{ id: 'runtime_opening_director', relation: '生成意图' }, { id: 'runtime_opening_context', relation: '冻结 Context' }]
    }),
    node({
      id: 'runtime_opening_validate', stage: 'bootstrap', kind: 'validator', kindLabel: 'VALIDATOR',
      title: 'Opening Validator', subtitle: '检查 POV、玩家能动性、节奏和输出 Schema', x: 3270, y: 500, w: 280, h: 220,
      inputShort: 'Candidates + Guards', outputShort: '运行后显示后端 Validator 证据',
      summary: '将模型候选与编译阶段生成的 Guardrails 对照，拒绝越权、泄漏或抢玩家选择的内容。',
      input: { state: 'backend_evidence_required' },
      output: { state: 'backend_evidence_required' },
      expectedShort: '越权候选被拒绝',
      expected: { passed: '>=1', agencyViolationsApplied: true, schemaValid: true },
      rules: ['任何 Hard Gate 失败都不得进入 Canon。', '拒绝理由必须可回溯到文本 span。'],
      dependencies: [{ id: 'runtime_opening_llm', relation: '生成候选' }, { id: 'compile_guardrails', relation: '运行时规则' }]
    }),
    node({
      id: 'runtime_opening_projection', stage: 'bootstrap', kind: 'output', kindLabel: 'PLAYER OUTPUT',
      title: 'Opening Surfaces', subtitle: '玩家真正会看到的开局卡片与第一条关注', x: 3620, y: 500, w: 440, h: 250,
      inputShort: 'Validated candidate', outputShort: '运行后显示玩家可见输出',
      summary: '最终要以产品表面来评测，而不是只看模型文本。这里同时展示开局卡、关注通知和可继续行动的 Hook。',
      input: { state: 'backend_evidence_required' },
      output: { state: 'backend_evidence_required' },
      expectedShort: '3 个表面形成同一 Hook',
      expected: { openingLength: '<120 chars', followerMeaningful: true, nextActionObvious: true },
      rules: ['产品表面之间不能重复同一段话。', 'Hook 必须允许至少两种行动。'],
      dependencies: [{ id: 'runtime_opening_validate', relation: '通过的候选' }, { id: 'runtime_create', relation: 'Run projection' }],
    })
  ];

  const TURN_CONFIGS = [
    { key: 'comments', y: 1177, action: '在 Opening 原帖下提交真实 comment。' },
    { key: 'dm', y: 1467, action: '在真实 Direct Channel 写入本轮评测代号。' },
    { key: 'event', y: 1757, action: '选择 Opening 生成的正式 Event Choice。' },
    { key: 'memory', y: 2047, action: '在同一私聊中追问代号，验证记忆召回。' }
  ];

  const TURN_X = { input: 290, context: 650, director: 1030, llm: 1410, validator: 1790, apply: 2170, surface: 2550, review: 3230 };

  for (const turn of TURN_CONFIGS) {
    const prefix = `turn_${turn.key}`;
    NODES.push(
      node({
        id: `${prefix}_input`, stage: 'journey', row: turn.key, kind: 'source', kindLabel: 'PLAYER INPUT',
        title: '玩家行为', subtitle: turn.action, x: TURN_X.input, y: turn.y, w: 260, h: 190,
        inputShort: '玩家原句', outputShort: '运行后显示后端 Command',
        summary: '每一轮都从玩家明确做出的行为开始。系统不能把模型猜测当成玩家选择。',
        expectedShort: '只规范化，不改意图', expected: { playerIntentPreserved: true, inventedAction: false },
        rules: ['只允许规范化格式，不得补写玩家未表达的动机。'],
        dependencies: [{ id: 'runtime_create', relation: '当前 Run 与 revision' }]
      }),
      node({
        id: `${prefix}_context`, stage: 'journey', row: turn.key, kind: 'context', kindLabel: 'CONTEXT',
        title: 'Context Builder', subtitle: '检索本轮真正需要的世界、关系与历史', x: TURN_X.context, y: turn.y, w: 270, h: 190,
        inputShort: 'Command + Run State', outputShort: '运行后显示后端 Context 证据',
        summary: '把编译世界包、当前 Run 状态、关系记忆和玩家行为组合成一份受预算约束的本轮 Context。',
        expectedShort: '相关信息足够，私密信息隔离', expected: { selected: 'only causally relevant refs', excluded: 'all non-eligible/private refs', contextPollution: 'low' },
        rules: ['先按 POV 与权限过滤，再做语义检索。', '必须记录 excludedRefs 及原因。'],
        dependencies: [{ id: `${prefix}_input`, relation: '本轮玩家行为' }, { id: 'compile_bundle', relation: '编译世界包' }]
      }),
      node({
        id: `${prefix}_director`, stage: 'journey', row: turn.key, kind: 'decision', kindLabel: 'DIRECTOR',
        title: 'Director Decision', subtitle: '决定回应者、表面、强度和世界后果', x: TURN_X.director, y: turn.y, w: 270, h: 190,
        inputShort: 'Filtered Context', outputShort: '运行后显示后端 Director 证据',
        summary: '把“生成一段文字”拆成明确的产品决策：谁回应、在哪里回应、为什么现在回应，以及是否触发 Event。',
        expectedShort: '回应有因果，表面选择合理', expected: { responderCausality: true, surfaceMatch: true, intensityWithinPacing: true },
        rules: ['沉默也是合法决策。', 'Director 只决定意图与结构，不直接写最终台词。'],
        dependencies: [{ id: `${prefix}_context`, relation: '本轮 Context' }, { id: 'compile_social', relation: '表面策略' }, { id: 'compile_narrative', relation: '剧情 Seeds' }]
      }),
      node({
        id: `${prefix}_llm`, stage: 'journey', row: turn.key, kind: 'llm', kindLabel: 'MODEL CALL',
        title: 'AI Generation', subtitle: '在冻结 Context 与 Director Plan 内生成候选', x: TURN_X.llm, y: turn.y, w: 270, h: 190,
        inputShort: '冻结 Context + Director Plan', outputShort: '运行后显示后端 Model 证据',
        summary: '生成层只产出语义候选。角色、表面、强度和允许使用的事实已经由上游节点固定。',
        expectedShort: '自然、具体、角色声音不同', expected: { candidateQuality: '>=3/4', characterFidelity: 'high', genericLanguage: 'low' },
        rules: ['不能输出分析或规则说明。', '每个 responder 的句式、信息量和态度必须不同。'],
        dependencies: [{ id: `${prefix}_context`, relation: '冻结 Context' }, { id: `${prefix}_director`, relation: '生成意图' }]
      }),
      node({
        id: `${prefix}_validator`, stage: 'journey', row: turn.key, kind: 'validator', kindLabel: 'VALIDATOR',
        title: 'Semantic Validator', subtitle: '检查候选是否越权、泄漏、假选择或人物失真', x: TURN_X.validator, y: turn.y, w: 270, h: 205,
        inputShort: '候选 + Guard', outputShort: '运行后显示后端 Validator 证据',
        summary: '在写入 Canon 前检查文本和结构。Event 还要检查每个 Choice 的收益、风险、信息和后续是否真正不同。',
        expectedShort: 'Hard Gate 全过，Choice 可区分', expected: { hardGateFailures: 0, choiceDifferentiation: 'backend evidence' },
        rules: ['Hard Gate：POV、玩家能动性、世界规则、Schema。', 'Soft Gate：自然度、重复、节奏、选择差异。'],
        dependencies: [{ id: `${prefix}_llm`, relation: '生成候选' }, { id: 'compile_guardrails', relation: '可执行规则' }]
      }),
      node({
        id: `${prefix}_apply`, stage: 'journey', row: turn.key, kind: 'apply', kindLabel: 'CANON APPLY',
        title: 'State & Canon Apply', subtitle: '把通过的结果写入事实、关系和 Run Revision', x: TURN_X.apply, y: turn.y, w: 270, h: 190,
        inputShort: 'Validated Outcome', outputShort: '运行后显示后端 Outcome',
        summary: '生成结果只有在这里写入后，才会成为后续轮次可以依赖的 Canon、关系变化和产品投影。',
        expectedShort: '原子写入 · causeRef 完整', expected: { atomic: true, revisionAdvanced: true, everyDeltaHasCauseRef: true },
        rules: ['Revision 冲突必须拒绝，不得静默覆盖。', '关系变化必须记录 dimension、delta 与 causeRef。'],
        dependencies: [{ id: `${prefix}_validator`, relation: '通过的 Outcome' }, { id: 'compile_memory', relation: '关系与事实 Schema' }]
      }),
      node({
        id: `${prefix}_surface`, stage: 'journey', row: turn.key, kind: 'output', kindLabel: 'PLAYER OUTPUT',
        title: '产品表面输出', subtitle: '评论、回复、私聊、Event 或状态变化的最终呈现', x: TURN_X.surface, y: turn.y, w: 560, h: 215,
        inputShort: 'Run + Outcome', outputShort: '运行后显示玩家可见输出',
        summary: '这里按玩家真实看到的 UI 表面来评测：不是看模型返回了什么 JSON，而是看评论、私聊和 Event 最终是否连贯。',
        expectedShort: '多表面互补，不重复', expected: { surfaces: 'backend evidence', coherentAcrossSurfaces: true, duplicateCopy: false },
        rules: ['每个表面只呈现该表面应知道的信息。', '评论、私聊与 Event 的文案长度和节奏不同。'],
        dependencies: [{ id: `${prefix}_apply`, relation: '已写入的 Canon 与投影' }]
      }),
      node({
        id: `${prefix}_review`, stage: 'journey', row: turn.key, kind: 'review', kindLabel: 'EVALUATION',
        title: '本轮评测结论', subtitle: '把体验质量与系统正确性分开判断', x: TURN_X.review, y: turn.y, w: 650, h: 215,
        inputShort: 'Actual + Expected', outputShort: '运行后显示评测证据',
        summary: '评测结果既要回答“好不好玩”，也要指出问题到底出现在哪个系统节点。',
        expectedShort: '>= 3.8 且无 Hard Gate', expected: { score: '>=3.8', hardGateFailures: 0 },
        rules: ['体验分不能掩盖隐私或 POV Hard Gate。', '问题必须回指最可能的上游节点。'],
        dependencies: [{ id: `${prefix}_surface`, relation: '玩家可见结果' }, { id: `${prefix}_validator`, relation: '系统校验结果' }]
      })
    );
  }

  const CONNECTIONS = [
    ['source_script', 'compile_normalize', 'blue'],
    ['compile_normalize', 'compile_world_core', 'blue'],
    ['compile_normalize', 'compile_cast', 'blue'],
    ['compile_normalize', 'compile_narrative', 'blue'],
    ['compile_world_core', 'compile_narrative', 'blue'],
    ['compile_cast', 'compile_social', 'blue'],
    ['compile_cast', 'compile_memory', 'blue'],
    ['compile_world_core', 'compile_guardrails', 'blue'],
    ['compile_narrative', 'compile_bundle', 'blue'],
    ['compile_social', 'compile_bundle', 'blue'],
    ['compile_memory', 'compile_bundle', 'blue'],
    ['compile_guardrails', 'compile_bundle', 'blue'],
    ['compile_world_core', 'compile_bundle', 'blue'],
    ['compile_bundle', 'runtime_create', 'blue'],
    ['source_player', 'runtime_create', 'blue', true],
    ['source_test_plan', 'runtime_create', 'amber', true],
    ['runtime_create', 'runtime_opening_context', 'blue'],
    ['compile_bundle', 'runtime_opening_context', 'violet', true],
    ['runtime_opening_context', 'runtime_opening_director', 'violet'],
    ['runtime_opening_director', 'runtime_opening_llm', 'amber'],
    ['runtime_opening_llm', 'runtime_opening_validate', 'violet'],
    ['runtime_opening_validate', 'runtime_opening_projection', 'green']
  ];

  for (const turn of TURN_CONFIGS) {
    const prefix = `turn_${turn.key}`;
    CONNECTIONS.push(
      [`${prefix}_input`, `${prefix}_context`, 'blue'],
      [`${prefix}_context`, `${prefix}_director`, 'violet'],
      [`${prefix}_director`, `${prefix}_llm`, 'amber'],
      [`${prefix}_llm`, `${prefix}_validator`, 'violet'],
      [`${prefix}_validator`, `${prefix}_apply`, 'blue'],
      [`${prefix}_apply`, `${prefix}_surface`, 'green'],
      [`${prefix}_surface`, `${prefix}_review`, 'green']
    );
  }

  const nodesById = new Map(NODES.map((item) => [item.id, item]));
  const state = {
    scale: 0.60,
    tx: -50,
    ty: 18,
    selectedNodeId: 'compile_world_core',
    activeTab: 'input',
    currentTool: 'select',
    dragging: false,
    dragOrigin: null,
    issueOnly: false,
    query: '',
    viewMode: 'actual',
    toastTimer: null,
    evalInput: evalInputFromScenario(initialScenario),
    lastRun: null,
    experienceTrack: 'both',
    pendingSourceDocument: null
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const viewport = $('#viewport');
  const canvas = $('#canvas');
  const nodeLayer = $('#node-layer');
  const stageLayer = $('#stage-layer');
  const rowLayer = $('#row-layer');
  const connectionLayer = $('#connection-layer');

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function pretty(value) {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }

  function scenarioById(id) {
    return scenarioLibrary.find((item) => item.id === String(id || '')) || null;
  }

  function parseCharacterVersionIds(value) {
    return String(value || '')
      .split(/[\s,，;；]+/u)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 9);
  }

  function sameStringArray(left = [], right = []) {
    return left.length === right.length
      && left.every((value, index) => String(value) === String(right[index]));
  }

  function characterVersionInputError(characterVersionIds) {
    if (characterVersionIds.length > 8) return 'CharacterVersion 最多填写 8 个';
    if (new Set(characterVersionIds).size !== characterVersionIds.length) return 'CharacterVersion 不能重复';
    if (characterVersionIds.some((value) => !SCENARIO_UUID_RE.test(value))) {
      return 'CharacterVersion 必须是有效的 staging UUID';
    }
    return '';
  }

  function evalInputFromScenario(scenario) {
    const value = scenario || FALLBACK_SCENARIO;
    const characterVersionIds = [...(value.characterVersionIds || [])].slice(0, 8);
    const scenarioCharacters = [...(value.characters || [])]
      .filter((card) => characterVersionIds.includes(card.characterVersionId));
    const recommendedPlayer = scenarioCharacters.find((card) => card.playable !== false && card.starterRecommended)
      || scenarioCharacters.find((card) => card.playable !== false)
      || null;
    return {
      title: String(value.title || ''),
      description: String(value.worldDescription || ''),
      setting: String(value.worldSetting || ''),
      goal: String(value.worldGoal || ''),
      characterVersionIds,
      characterVersionId: characterVersionIds[0] || '',
      zeroCastPolicy: characterVersionIds.length ? null : 'institutional_zero_cast',
      highlightDescription: String(value.highlightDescription || ''),
      evaluationInstruction: String(value.evaluationInstruction || FALLBACK_SCENARIO.evaluationInstruction),
      evaluationMode: 'experience',
      playerActions: [...(value.playerActions || FALLBACK_SCENARIO.playerActions)],
      baseScenarioId: String(value.id),
      sourceScenarioId: value.id === FALLBACK_SCENARIO.id ? null : String(value.id),
      sourceFile: value.sourceFile || null,
      sourceDigest: value.sourceDigest || null,
      sourceWorldDraftRevisionId: value.worldDraftRevisionId || null,
      topicTags: [...(value.topicTags || [])],
      personaOptions: [...(value.personaOptions || [])],
      characters: scenarioCharacters,
      selectedPersona: String((value.personaOptions || [])[0] || ''),
      playerCharacterVersionId: value.playerCharacterVersionId || recommendedPlayer?.characterVersionId || null,
      firstFollowerCharacterVersionId: value.firstFollowerCharacterVersionId || null,
    };
  }

  function importedSourceStillMatches(input, scenario) {
    if (!scenario) return false;
    const inputCharacterVersionIds = Array.isArray(input.characterVersionIds)
      ? input.characterVersionIds : parseCharacterVersionIds(input.characterVersionId);
    const scenarioCharacterVersionIds = [...(scenario.characterVersionIds || [])].slice(0, 8);
    if (!sameStringArray(inputCharacterVersionIds, scenarioCharacterVersionIds)) return false;
    return [
      ['title', 'title'],
      ['description', 'worldDescription'],
      ['setting', 'worldSetting'],
      ['goal', 'worldGoal'],
      ['highlightDescription', 'highlightDescription'],
    ].every(([inputKey, scenarioKey]) => String(input[inputKey] || '').trim()
      === String(scenario[scenarioKey] || '').trim());
  }

  function renderStages() {
    stageLayer.innerHTML = STAGES.map((stage) => `
      <section class="stage-zone ${stage.className}" data-stage-zone="${stage.id}" style="left:${stage.x}px;top:${stage.y}px;width:${stage.w}px;height:${stage.h}px">
        <div class="stage-label">
          <div class="stage-number">${stage.number}</div>
          <div><strong>${escapeHtml(stage.title)}</strong><span>${escapeHtml(stage.subtitle)}</span></div>
        </div>
        ${stage.start ? '<div class="stage-start-badge">从这里开始看</div>' : ''}
      </section>
    `).join('');

    rowLayer.innerHTML = ROWS.map((row) => `
      <section class="journey-row" data-row="${row.id}" style="left:${row.x}px;top:${row.y}px;width:${row.w}px;height:${row.h}px">
        <div class="journey-row-head"><span>${row.label}</span><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.subtitle)}</small></div>
      </section>
    `).join('');
  }

  function statusClass(nodeData) {
    if (nodeData.status === 'error') return 'error';
    if (nodeData.status === 'warning') return 'warning';
    if (nodeData.status === 'waiting') return 'waiting';
    if (nodeData.status === 'running') return 'running';
    return '';
  }

  function cardSummary(nodeData) {
    if (state.viewMode === 'expected') return nodeData.expectedShort || nodeData.outputShort;
    return nodeData.outputShort;
  }

  function nodeCardTemplate(nodeData) {
    const classes = [
      'node-card',
      `kind-${nodeData.kind}`,
      nodeData.issue ? 'has-issue' : '',
      nodeData.changed ? 'changed' : '',
      statusClass(nodeData),
      nodeData.id === state.selectedNodeId ? 'selected' : ''
    ].filter(Boolean).join(' ');

    let special = '';
    if (nodeData.preview?.length) {
      special = `<div class="output-preview">${nodeData.preview.slice(0, 2).map((item) => `
        <div class="output-bubble ${item.type === 'dm' ? 'dm' : item.type === 'event' ? 'event' : ''}">
          <small>${escapeHtml(item.label)}</small><p>${escapeHtml(item.text)}</p>
        </div>`).join('')}</div>`;
    } else if (state.viewMode !== 'expected' && nodeData.kind === 'review'
      && nodeData.status !== 'waiting'
      && Number.isFinite(Number(nodeData.score ?? nodeData.output?.score))) {
      const score = Number(nodeData.score ?? nodeData.output?.score ?? 0);
      special = `<div class="review-preview">
        <div class="review-score"><strong>${score.toFixed(1)}</strong><span>/ 5.0</span></div>
        <div class="score-track"><i style="width:${Math.max(0, Math.min(100, score / 5 * 100))}%"></i></div>
        <div class="review-tags">${(nodeData.tags || []).slice(0, 3).map((tag, index) => `<span class="${nodeData.issue && index === 2 ? 'bad' : ''}">${escapeHtml(tag)}</span>`).join('')}</div>
      </div>`;
    } else {
      special = `<div class="node-io">
        <div><span>INPUT</span><strong>${escapeHtml(nodeData.inputShort)}</strong></div>
        <div><span>${state.viewMode === 'expected' ? 'EXPECTED' : 'OUTPUT'}</span><strong>${escapeHtml(cardSummary(nodeData))}</strong></div>
      </div>`;
    }

    return `
      <article class="${classes}" data-node-id="${nodeData.id}" style="left:${nodeData.x}px;top:${nodeData.y}px;width:${nodeData.w}px;height:${nodeData.h}px" tabindex="0">
        <span class="node-port in"></span><span class="node-port out"></span>
        <div class="node-top">
          <span class="node-kind">${escapeHtml(nodeData.kindLabel)}</span>
          <span class="node-state ${statusClass(nodeData)}"><i></i>${state.viewMode === 'expected' ? '应达到' : escapeHtml(nodeData.statusText)}</span>
        </div>
        <h3>${escapeHtml(nodeData.title)}</h3>
        <div class="node-subtitle">${escapeHtml(nodeData.subtitle)}</div>
        ${special}
        <div class="node-metrics"><span><b>${escapeHtml(nodeData.duration)}</b></span><span>${escapeHtml(nodeData.tokens)} tokens</span><span>${escapeHtml(nodeData.cost)}</span></div>
        ${nodeData.issue ? `<div class="node-issue"><i>!</i>${escapeHtml(nodeData.issue)}</div>` : ''}
      </article>
    `;
  }

  function renderNodes() {
    nodeLayer.innerHTML = NODES.map(nodeCardTemplate).join('');
    $$('.node-card').forEach((card) => {
      card.addEventListener('click', (event) => {
        event.stopPropagation();
        selectNode(card.dataset.nodeId);
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectNode(card.dataset.nodeId);
        }
      });
    });
    applyFilters();
    renderMinimap();
  }

  function getAnchor(nodeData, side) {
    return side === 'out'
      ? { x: nodeData.x + nodeData.w, y: nodeData.y + nodeData.h / 2 }
      : { x: nodeData.x, y: nodeData.y + nodeData.h / 2 };
  }

  function connectionPath(from, to) {
    const start = getAnchor(from, 'out');
    const end = getAnchor(to, 'in');
    const dx = end.x - start.x;
    if (dx >= 80) {
      const bend = Math.max(70, Math.min(220, dx * .45));
      return `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}`;
    }
    const corridor = Math.max(start.x, end.x) + 80;
    return `M ${start.x} ${start.y} C ${corridor} ${start.y}, ${corridor} ${end.y}, ${end.x} ${end.y}`;
  }

  function renderConnections() {
    connectionLayer.innerHTML = CONNECTIONS.map(([fromId, toId, type, dashed]) => {
      const from = nodesById.get(fromId);
      const to = nodesById.get(toId);
      if (!from || !to) return '';
      return `<path class="connection ${type}${dashed ? ' dashed' : ''}" data-from="${fromId}" data-to="${toId}" d="${connectionPath(from, to)}"></path>`;
    }).join('');
  }

  function selectNode(nodeId, focus = false) {
    const nodeData = nodesById.get(nodeId);
    if (!nodeData) return;
    state.selectedNodeId = nodeId;
    $$('.node-card').forEach((card) => card.classList.toggle('selected', card.dataset.nodeId === nodeId));
    const workspace = $('.workspace');
    workspace.classList.remove('inspector-closed');
    $('#inspector').classList.remove('collapsed');
    renderInspector();
    if (focus) focusNode(nodeData);
  }

  function stageName(nodeData) {
    const stage = STAGES.find((item) => item.id === nodeData.stage);
    if (nodeData.row) {
      const row = ROWS.find((item) => item.id === nodeData.row);
      return `03 · 玩家旅程 / ${row?.title || nodeData.row}`;
    }
    return `${stage?.number || ''} · ${stage?.title || nodeData.stage}`;
  }

  function renderInspector() {
    const nodeData = nodesById.get(state.selectedNodeId);
    if (!nodeData) return;
    $('#inspector-stage').textContent = stageName(nodeData);
    $('#inspector-title').textContent = nodeData.title;
    $('#inspector-id').textContent = nodeData.id.replaceAll('_', '.');
    $('#inspector-summary').textContent = nodeData.summary;

    const status = $('#inspector-status');
    status.className = `inspector-status ${statusClass(nodeData) || 'waiting'}`;
    status.innerHTML = `<span><i></i>${state.viewMode === 'expected' ? '期望状态' : escapeHtml(nodeData.statusText)}</span><strong>${escapeHtml(nodeData.duration)}</strong><em>${escapeHtml(nodeData.tokens)} tokens</em><em>${escapeHtml(nodeData.cost)}</em>`;

    $$('.inspector-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === state.activeTab));
    renderInspectorContent(nodeData);
  }

  function renderInspectorContent(nodeData) {
    const root = $('#inspector-content');
    if (state.activeTab === 'input') {
      root.innerHTML = `
        <div class="detail-section">
          <div class="detail-heading"><strong>节点输入</strong><span>${escapeHtml(nodeData.inputShort)}</span></div>
          <pre class="code-block">${escapeHtml(pretty(nodeData.input))}</pre>
        </div>
        <div class="detail-section">
          <div class="detail-heading"><strong>输入说明</strong><span>为什么进入本节点</span></div>
          <div class="text-block">${escapeHtml(nodeData.summary)}</div>
        </div>`;
      return;
    }

    if (state.activeTab === 'output') {
      if (state.viewMode === 'diff') {
        root.innerHTML = `
          <div class="detail-section">
            <div class="detail-heading"><strong>实际输出</strong><span>Actual</span></div>
            <pre class="code-block">${escapeHtml(pretty(nodeData.output))}</pre>
          </div>
          <div class="detail-section">
            <div class="detail-heading"><strong>期望输出</strong><span>Expected</span></div>
            <pre class="code-block">${escapeHtml(pretty(nodeData.expected))}</pre>
          </div>`;
      } else {
        const value = state.viewMode === 'expected' ? nodeData.expected : nodeData.output;
        root.innerHTML = `
          <div class="detail-section">
            <div class="detail-heading"><strong>${state.viewMode === 'expected' ? '期望输出' : '实际输出'}</strong><span>${escapeHtml(state.viewMode === 'expected' ? nodeData.expectedShort : nodeData.outputShort)}</span></div>
            <pre class="code-block">${escapeHtml(pretty(value))}</pre>
          </div>`;
      }
      return;
    }

    if (state.activeTab === 'rules') {
      root.innerHTML = `
        <div class="detail-section">
          <div class="detail-heading"><strong>本节点约束</strong><span>${nodeData.rules.length} 条</span></div>
          <dl class="key-value-list">${nodeData.rules.map((rule, index) => `<div class="key-value"><dt>RULE ${String(index + 1).padStart(2, '0')}</dt><dd>${escapeHtml(rule)}</dd></div>`).join('')}</dl>
        </div>
        <div class="detail-section">
          <div class="detail-heading"><strong>Prompt / Policy Evidence</strong><span>${state.lastRun ? 'SERVER EVIDENCE' : '等待真实执行'}</span></div>
          <pre class="code-block">${escapeHtml(pretty(state.lastRun ? {
            nodeId: nodeData.id,
            evaluationInstruction: state.lastRun.input.evaluationInstruction,
            experimentId: state.lastRun.experiment?.experimentId || null,
            tracks: (state.lastRun.experiment?.tracks || []).map((track) => ({ trackCode: track.trackCode, compilerVersion: track.compilerVersion, registryDigest: track.registryDigest, compileHash: track.compileHash }))
          } : { state: 'not_executed', note: '运行后显示后端返回的 Experiment / Track 证据；前端不生成 Prompt digest。' }))}</pre>
        </div>`;
      return;
    }

    if (state.activeTab === 'deps') {
      const downstream = CONNECTIONS.filter((item) => item[0] === nodeData.id).map((item) => ({ id: item[1], relation: '下游消费本节点输出' }));
      const dependencies = [...nodeData.dependencies, ...downstream];
      root.innerHTML = `
        <div class="detail-section">
          <div class="detail-heading"><strong>上下游依赖</strong><span>${dependencies.length} 个</span></div>
          <div class="dependency-list">${dependencies.length ? dependencies.map((dep) => {
            const target = nodesById.get(dep.id);
            return `<button class="dependency-card" data-dependency-id="${dep.id}" type="button"><i>${target?.kindLabel?.slice(0, 1) || 'N'}</i><div><strong>${escapeHtml(target?.title || dep.id)}</strong><span>${escapeHtml(dep.relation)}</span></div></button>`;
          }).join('') : '<div class="text-block">该节点没有已记录的依赖。</div>'}</div>
        </div>`;
      root.querySelectorAll('[data-dependency-id]').forEach((button) => button.addEventListener('click', () => selectNode(button.dataset.dependencyId, true)));
      return;
    }

    const scores = nodeData.scores || { correctness: 0, usefulness: 0, quality: 0 };
    root.innerHTML = `
      <div class="detail-section">
        <div class="detail-heading"><strong>节点评测</strong><span>0–4</span></div>
        <div class="eval-score-grid">
          <div class="eval-score-card"><span>正确性</span><strong>${scores.correctness}</strong></div>
          <div class="eval-score-card"><span>下游有效性</span><strong>${scores.usefulness}</strong></div>
          <div class="eval-score-card"><span>体验质量</span><strong>${scores.quality}</strong></div>
        </div>
        ${nodeData.issue ? `<div class="issue-card"><strong>当前问题</strong><p>${escapeHtml(nodeData.issue)}</p></div>` : '<div class="text-block" style="margin-top:10px">本节点当前没有记录到明确问题。</div>'}
      </div>
      <div class="detail-section">
        <div class="detail-heading"><strong>评测备注</strong><span>保存在当前页面</span></div>
        <textarea id="node-note" class="note-field" placeholder="记录具体差距、证据和建议调优方向…">${escapeHtml(nodeData.note || '')}</textarea>
        <button id="save-node-note" class="button ghost save-note" type="button">保存备注</button>
      </div>`;
    $('#save-node-note')?.addEventListener('click', () => {
      nodeData.note = $('#node-note').value;
      showToast('节点备注已保存');
    });
  }

  function applyTransform() {
    state.scale = Math.max(.24, Math.min(1.35, state.scale));
    canvas.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
    $('#reset-zoom').textContent = `${Math.round(state.scale * 100)}%`;
    $('#zoom-readout').textContent = `${Math.round(state.scale * 100)}%`;
    updateMinimapViewport();
  }

  function zoomAt(nextScale, clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const worldX = (px - state.tx) / state.scale;
    const worldY = (py - state.ty) / state.scale;
    state.scale = Math.max(.24, Math.min(1.35, nextScale));
    state.tx = px - worldX * state.scale;
    state.ty = py - worldY * state.scale;
    applyTransform();
  }

  function fitRect(rect, padding = 54, maxScale = .86) {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const nextScale = Math.min(maxScale, (width - padding * 2) / rect.w, (height - padding * 2) / rect.h);
    state.scale = Math.max(.24, nextScale);
    state.tx = (width - rect.w * state.scale) / 2 - rect.x * state.scale;
    state.ty = (height - rect.h * state.scale) / 2 - rect.y * state.scale;
    applyTransform();
  }

  function focusStage(stageId) {
    if (stageId === 'compiler') {
      fitRect({ x: 80, y: 100, w: 2380, h: 850 }, 42, .72);
    } else {
      const stage = STAGES.find((item) => item.id === stageId);
      if (stage) fitRect(stage, 42, stageId === 'journey' ? .42 : .72);
    }
    $$('.stage-chip').forEach((button) => button.classList.toggle('active', button.dataset.focusStage === stageId));
  }

  function focusNode(nodeData) {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const targetScale = Math.max(state.scale, .8);
    state.scale = Math.min(1, targetScale);
    state.tx = width / 2 - (nodeData.x + nodeData.w / 2) * state.scale;
    state.ty = height / 2 - (nodeData.y + nodeData.h / 2) * state.scale;
    applyTransform();
  }

  function applyFilters() {
    const query = state.query.trim().toLowerCase();
    $$('.node-card').forEach((card) => {
      const nodeData = nodesById.get(card.dataset.nodeId);
      const searchable = `${nodeData.id} ${nodeData.title} ${nodeData.subtitle} ${pretty(nodeData.input)} ${pretty(nodeData.output)}`.toLowerCase();
      card.classList.toggle('dimmed', Boolean(query && !searchable.includes(query)));
      card.classList.toggle('issue-hidden', Boolean(state.issueOnly && !nodeData.issue));
    });
  }

  function renderMinimap() {
    const svg = $('#minimap-svg');
    svg.innerHTML = NODES.map((nodeData) => `<rect class="minimap-node ${nodeData.issue ? 'issue' : ''}" x="${nodeData.x}" y="${nodeData.y}" width="${nodeData.w}" height="${nodeData.h}" rx="20"></rect>`).join('');
    updateMinimapViewport();
  }

  function updateMinimapViewport() {
    const box = $('#minimap-viewport');
    if (!box || !viewport.clientWidth) return;
    const innerWidth = 214;
    const innerHeight = 105;
    const worldX = -state.tx / state.scale;
    const worldY = -state.ty / state.scale;
    const worldW = viewport.clientWidth / state.scale;
    const worldH = viewport.clientHeight / state.scale;
    const left = 8 + (worldX / CANVAS_SIZE.width) * innerWidth;
    const top = 38 + (worldY / CANVAS_SIZE.height) * innerHeight;
    const width = (worldW / CANVAS_SIZE.width) * innerWidth;
    const height = (worldH / CANVAS_SIZE.height) * innerHeight;
    box.style.left = `${Math.max(8, Math.min(8 + innerWidth, left))}px`;
    box.style.top = `${Math.max(38, Math.min(38 + innerHeight, top))}px`;
    box.style.width = `${Math.max(8, Math.min(innerWidth, width))}px`;
    box.style.height = `${Math.max(8, Math.min(innerHeight, height))}px`;
  }

  function showToast(message) {
    const toast = $('#toast');
    clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function setHealth(mode, label, status) {
    const health = $('#backend-health');
    health.className = `health-pill ${mode}`;
    health.querySelector('span').textContent = label;
    health.querySelector('strong').textContent = status;
  }
  function setAuthStatus(message, mode = 'error') {
    const status = $('#auth-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = `dialog-status ${mode}`;
    status.hidden = !message;
  }
  function openAuthDialog() {
    const username = $('#auth-username');
    const password = $('#auth-password');
    setAuthStatus('');
    username.value = window.SLICE_EVAL_AUTH?.username || 'slice-eval';
    password.value = '';
    $('#auth-dialog').showModal();
    queueMicrotask(() => password.focus());
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function maxFinite(values = []) {
    const valid = values.map(finiteNumber).filter((value) => value != null);
    return valid.length ? Math.max(...valid) : null;
  }
  function elapsedMs(start, end) {
    if (!start || !end) return null;
    const value = new Date(end).getTime() - new Date(start).getTime();
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
  }
  function formatDuration(value) {
    const ms = finiteNumber(value);
    if (ms == null) return '—';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  }
  function operationRecords(result, operationIds) {
    const allowed = new Set(Array.isArray(operationIds) ? operationIds : [operationIds]);
    return (result?.operations || []).filter((operation) => allowed.has(operation.operationId));
  }
  function operationDuration(result, operationIds) {
    const durations = operationRecords(result, operationIds)
      .map((operation) => finiteNumber(operation.durationMs)).filter((value) => value != null);
    return durations.length ? durations.reduce((total, value) => total + value, 0) : null;
  }
  function trackByCode(result, trackCode) {
    return (result?.experiment?.tracks || []).find((track) => track.trackCode === trackCode) || null;
  }
  function traceTrackByCode(result, trackCode) {
    return (result?.trace?.tracks || []).find((track) => track.trackCode === trackCode) || null;
  }
  function runtimeTraceCommand(result, trackCode, execution) {
    const commandId = execution?.command?.commandId || execution?.accepted?.commandId;
    if (!commandId) return null;
    return (traceTrackByCode(result, trackCode)?.runtimeCommands || [])
      .find((command) => command.commandId === commandId) || null;
  }
  function compileCalls(trackTrace) {
    const runtimeRefs = new Set((trackTrace?.runtimeCommands || [])
      .flatMap((command) => command.aiCalls || []).map((call) => call.callRef));
    return (trackTrace?.aiCalls || []).filter((call) => !runtimeRefs.has(call.callRef));
  }
  function summarizeCalls(calls = []) {
    const valid = calls.filter(Boolean);
    const currencies = new Set(valid.map((call) => call.currency).filter(Boolean));
    return {
      calls: valid.length,
      inputTokens: valid.reduce((total, call) => total + Number(call.inputTokens || 0), 0),
      outputTokens: valid.reduce((total, call) => total + Number(call.outputTokens || 0), 0),
      latencyMs: valid.reduce((total, call) => total + Number(call.latencyMs || 0), 0),
      costMinor: valid.reduce((total, call) => total + Number(call.costMinor || 0), 0),
      currency: currencies.size === 1 ? [...currencies][0] : currencies.size > 1 ? 'MULTI' : null,
      items: valid,
    };
  }
  function formatCost(summary) {
    if (!summary?.calls) return '—';
    if (!summary.currency) return `${summary.costMinor} minor`;
    if (summary.currency === 'MULTI') return `${summary.costMinor} minor`;
    return `${summary.currency} ${(summary.costMinor / 100).toFixed(2)}`;
  }
  function setNodeMetrics(item, { durationMs = null, calls = [] } = {}) {
    if (!item) return;
    const summary = summarizeCalls(calls);
    item.duration = formatDuration(durationMs);
    item.tokens = summary.calls ? `${summary.inputTokens} in · ${summary.outputTokens} out` : '—';
    item.cost = summary.calls ? formatCost(summary) : '—';
  }
  function compileDuration(result) {
    const values = (result?.trace?.tracks || []).map((track) => elapsedMs(
      track.compile?.startedAt, track.compile?.completedAt,
    )).filter((value) => value != null);
    return values.length ? Math.max(...values) : null;
  }
  function compileArtifactEvidence(result, matcher = () => true) {
    return Object.freeze(Object.fromEntries(['current', 'v2_candidate'].map((trackCode) => {
      const track = trackByCode(result, trackCode);
      return [trackCode, track ? {
        status: track.status,
        compilerVersion: track.compilerVersion,
        diagnostics: track.diagnostics || [],
        artifacts: (track.artifacts || []).filter(matcher),
        selectionTrace: track.selectionTrace || null,
      } : null];
    })));
  }
  function dualRuntimeEvidence(result, turn) {
    return {
      current: {
        execution: turn?.current || null,
        trace: runtimeTraceCommand(result, 'current', turn?.current),
      },
      v2Candidate: {
        execution: turn?.v2Candidate || null,
        trace: runtimeTraceCommand(result, 'v2_candidate', turn?.v2Candidate),
      },
    };
  }

  function resetToWaiting() {
    for (const item of NODES) {
      item.status = 'waiting';
      item.statusText = '等待真实执行';
      item.duration = '—'; item.tokens = '—'; item.cost = '—';
      item.input = { state: 'not_executed' }; item.outputShort = '等待后端证据'; item.output = { state: 'not_executed' };
      item.issue = ''; item.changed = false; item.score = undefined; item.tags = []; delete item.preview;
    }
    $('#issue-count').textContent = '—';
    $('#duration-value').textContent = '—';
    $('#trace-value').textContent = '等待';
  }

  function setNodeEvidence(item, input, output, short = '真实后端证据', metrics = {}) {
    if (!item) return;
    item.status = 'success'; item.statusText = '执行成功'; item.input = input; item.output = output;
    item.inputShort = 'Shared Backend'; item.outputShort = short; item.changed = true; item.issue = '';
    setNodeMetrics(item, metrics);
  }

  function runtimeIssue(result, label) {
    if (!result) return `${label}: missing`;
    if (result.status !== 'applied') {
      const code = result?.error?.code || result?.command?.errorCode || result?.status || 'unknown';
      const message = result?.error?.message ? ` · ${result.error.message}` : '';
      return `${label}: ${code}${message}`;
    }
    const projectionFailures = result.projectionIssues || [];
    if (projectionFailures.length) {
      return `${label}: ${projectionFailures.map((issue) =>
        `${issue.name}/${issue.error?.code || 'projection_failed'}`).join(', ')}`;
    }
    return null;
  }

  function applyRunResult(result, { progressive = false } = {}) {
    if (!result?.input) return;
    state.lastRun = result;
    renderExperience();
    const tracks = result.experiment?.tracks || [];
    const failedTracks = tracks.filter((track) => track.status !== 'succeeded');
    const scenarioDurationMs = operationDuration(result, ['evalCreateWorldDraft', 'evalCreateWorldDraftRevision']);
    if (result.scenario) {
      setNodeEvidence(nodesById.get('source_script'), {
        title: result.input.title,
        description: result.input.description,
        setting: result.input.setting,
        goal: result.input.goal,
        sourceScenarioId: result.input.sourceScenarioId,
        sourceFile: result.input.sourceFile,
        sourceDigest: result.input.sourceDigest,
      }, result.scenario,
      result.scenario.imported ? '复用内置 immutable revision' : '已保存临时 immutable revision',
      { durationMs: scenarioDurationMs });
      const characterVersionIds = result.input.characterVersionIds
        || (result.input.characterVersionId ? [result.input.characterVersionId] : []);
      setNodeEvidence(nodesById.get('source_player'), {
        selectedPersona: result.input.selectedPersona || null,
        characterVersionIds,
        castMode: characterVersionIds.length ? 'immutable CharacterVersion bindings' : 'institutional_zero_cast',
      }, {
        revision: result.scenario.revision,
        boundCharacterCount: characterVersionIds.length,
      }, `${characterVersionIds.length} 个真实 CharacterVersion`, { durationMs: scenarioDurationMs });
    }
    const configuredTurns = result.input.evaluationMode === 'experience'
      ? (result.input.playerActions?.length || 0) : 4;
    setNodeEvidence(nodesById.get('source_test_plan'), {
      sourceActions: result.input.playerActions,
      typedPath: result.input.evaluationMode === 'experience'
        ? (result.turns || []).map((turn) => turn.kind)
        : ['comment', 'dm_message_write', 'event_action', 'dm_message_recall'],
    }, {
      configuredTurns,
      completedTurns: result.turns?.length || 0,
      technicalCanvasTurns: Math.min(4, result.turns?.length || 0),
      gameplayReportTurns: result.turns?.length || 0,
      status: result.status,
      memoryVerification: result.memoryVerification,
    }, `${result.turns?.length || 0} / ${configuredTurns} 轮已返回 · Canvas 展前 4 轮，Gameplay Review 展完整旅程`);

    if (result.experiment) {
      const traceTracks = result.trace?.tracks || [];
      const compilerCalls = traceTracks.flatMap(compileCalls);
      const compilerDurationMs = compileDuration(result)
        ?? operationDuration(result, ['evalCreateCompilerExperiment', 'evalGetCompilerExperiment']);
      const compilerInput = {
        worldDraftRevisionId: result.scenario?.worldDraftRevisionId || result.experiment.worldDraftRevisionId,
        sourceDigest: result.input.sourceDigest,
        experimentInputDigest: result.experiment.inputDigest,
        evaluationInstruction: result.input.evaluationInstruction,
        evaluationInstructionDigest: result.experiment.evaluationInstructionDigest,
      };
      const availableArtifacts = compileArtifactEvidence(result);
      const planRows = result.compiledPlans?.tracks || [];
      const parsedPlanByTrack = Object.fromEntries(planRows.map((track) => [track.trackCode,
        window.SliceCompiledPlanView?.parse(track.planJson) || null]));
      const parsedConfigByTrack = Object.fromEntries(planRows.map((track) => [track.trackCode,
        window.SliceCompiledPlanView?.parse(track.gameConfigJson) || null]));
      const planProjection = (project) => Object.fromEntries(['current', 'v2_candidate'].map((trackCode) => [trackCode,
        project(parsedPlanByTrack[trackCode], parsedConfigByTrack[trackCode],
          planRows.find((row) => row.trackCode === trackCode) || null)]));
      const compilerOutputs = {
        compile_normalize: {
          evidenceScope: 'experiment input + immutable revision',
          experimentId: result.experiment.experimentId,
          inputDigest: result.experiment.inputDigest,
          worldDraftRevisionId: result.experiment.worldDraftRevisionId,
          operationCalls: operationRecords(result, ['evalCreateCompilerExperiment', 'evalGetCompilerExperiment']),
        },
        compile_world_core: {
          evidenceScope: '完整 Plan / GameConfig 正文（Shared Backend owner read）',
          tracks: planProjection((plan, config, row) => ({
            planDigest: row?.planDigest || null,
            experienceSpine: plan?.experienceSpine || null,
            displayProjection: window.SliceCompiledPlanView?.parse(row?.displayJson) || null,
            opening: window.SliceCompiledPlanView?.parse(row?.openingJson) || null,
            gameConfig: config,
          })),
        },
        compile_cast: {
          evidenceScope: 'Agency Graph + immutable CharacterVersion bindings',
          characterVersionIds: result.input.characterVersionIds
            || (result.input.characterVersionId ? [result.input.characterVersionId] : []),
          tracks: planProjection((plan) => ({ agencyGraph: plan?.agencyGraph || null })),
          currentCast: result.previewRuns?.current?.castSnapshot || null,
          v2CandidateCast: result.previewRuns?.v2Candidate?.castSnapshot || null,
        },
        compile_narrative: {
          evidenceScope: '完整 Narrative Plan 正文；Chapter rolling window / Seeds / Endings 均为真实编译产物',
          tracks: planProjection((plan, _config, row) => ({
            planDigest: row?.planDigest || null,
            chapterPlan: plan?.experienceSpine?.chapterPlan || null,
            endingProfiles: plan?.experienceSpine?.endingProfiles || [],
            narrativeSeeds: plan?.narrativeSeeds || [],
            selectionTrace: window.SliceCompiledPlanView?.parse(row?.selectionTraceJson) || null,
          })),
        },
        compile_social: {
          evidenceScope: '从真实 Plan / GameConfig 投影可见 Surface 约束，不生成第二套计划',
          tracks: planProjection((plan, config) => ({
            seedVisibility: (plan?.narrativeSeeds || []).map((seed) => ({ seedRef: seed.seedId, visibility: seed.visibility,
              actorRefs: seed.actorRefs, functionCode: seed.functionCode })),
            eventFamilies: config?.eventFamilies || null,
            activityFamilies: config?.activityFamilies || null,
            budgets: config?.budgets || null,
          })),
        },
        compile_memory: {
          evidenceScope: 'Compiler 只定义角色改变条件和规则 Pin；真实记忆/关系状态属于 Runtime World State',
          tracks: planProjection((plan, config) => ({
            actorChangeGates: (plan?.agencyGraph?.actors || []).map((actor) => ({ actorRef: actor.actorRef,
              want: actor.want, boundary: actor.boundary, changeGates: actor.changeGates })),
            relationshipPolicyPin: config?.narrativePolicyPins || config?.rulePins || null,
          })),
        },
        compile_guardrails: {
          evidenceScope: '编译诊断 + Experience Spine guards + GameConfig policy pins',
          diagnostics: Object.fromEntries(tracks.map((track) => [track.trackCode, track.diagnostics || []])),
          tracks: planProjection((plan, config) => ({
            toneGuards: plan?.experienceSpine?.toneGuards || [],
            cheapPayoffGuards: plan?.experienceSpine?.cheapPayoffGuards || [],
            narrativePolicyPins: config?.narrativePolicyPins || null,
            budgets: config?.budgets || null,
          })),
        },
        compile_bundle: {
          evidenceScope: 'complete typed Compiler Experiment response',
          experiment: result.experiment,
          traceStatus: result.trace?.status || null,
          traceSchemaVersion: result.trace?.schemaVersion || null,
          traceError: result.traceError,
          artifacts: availableArtifacts,
          completePlans: result.compiledPlans || null,
        },
      };
      for (const item of NODES.filter((candidate) => candidate.stage === 'compiler')) {
        setNodeEvidence(item, compilerInput, compilerOutputs[item.id] || compilerOutputs.compile_bundle,
          `${tracks.length} tracks · ${result.trace ? 'Compiler + Runtime Trace' : '等待最终 Trace'}`,
          { durationMs: compilerDurationMs, calls: compilerCalls });
        const compilerIssues = [
          ...failedTracks.map((track) => `${track.trackCode}: ${track.errorCode || track.status}`),
          ...(result.traceError ? [`trace: ${result.traceError.code}`] : []),
        ];
        if (compilerIssues.length) {
          item.status = 'warning'; item.statusText = '编译/Trace 异常';
          item.issue = compilerIssues.join('；');
        }
      }
    }

    const currentPreview = result.previewRuns?.current;
    const candidatePreview = result.previewRuns?.v2Candidate;
    const openingIssues = [];
    const runtimeIssues = [];
    if (currentPreview || candidatePreview) {
      const previewDurationMs = operationDuration(result, 'createCompilerExperimentPreviewRun');
      const previewInput = {
        experimentId: result.experiment?.experimentId || null,
        tracks: ['current', 'v2_candidate'],
      };
      const previewOutput = {
        current: currentPreview ? {
          runId: currentPreview.runId, revision: currentPreview.revision,
          runtimeSource: currentPreview.runtimeSource, identitySnapshot: currentPreview.identitySnapshot,
          castSnapshot: currentPreview.castSnapshot, actorStates: currentPreview.actorStates,
          rulePins: currentPreview.rulePins,
        } : null,
        v2Candidate: candidatePreview ? {
          runId: candidatePreview.runId, revision: candidatePreview.revision,
          runtimeSource: candidatePreview.runtimeSource, identitySnapshot: candidatePreview.identitySnapshot,
          castSnapshot: candidatePreview.castSnapshot, actorStates: candidatePreview.actorStates,
          rulePins: candidatePreview.rulePins,
        } : null,
      };
      setNodeEvidence(nodesById.get('runtime_create'), previewInput, previewOutput,
        'Current / V2 双 Preview Run', { durationMs: previewDurationMs });

      const currentOpening = result.opening?.current;
      const candidateOpening = result.opening?.v2Candidate;
      if (currentOpening || candidateOpening) {
        const openingDual = {
          current: {
            execution: currentOpening || null,
            trace: runtimeTraceCommand(result, 'current', currentOpening),
            preview: currentPreview || null,
          },
          v2Candidate: {
            execution: candidateOpening || null,
            trace: runtimeTraceCommand(result, 'v2_candidate', candidateOpening),
            preview: candidatePreview || null,
          },
        };
        const pairs = [openingDual.current, openingDual.v2Candidate];
        const traces = pairs.map((pair) => pair.trace).filter(Boolean);
        const calls = traces.flatMap((trace) => trace.aiCalls || []);
        const outcomes = pairs.map((pair) => pair.trace?.outcome || pair.execution?.outcome || null);
        const commandDurationMs = maxFinite(pairs.map((pair) =>
          pair.trace?.durationMs ?? pair.execution?.durationMs))
          ?? finiteNumber(result.opening?.durationMs);
        const processingDurationMs = maxFinite(traces.map((trace) => trace.processingMs))
          ?? commandDurationMs;
        const aiDurationMs = maxFinite(calls.map((call) => call.latencyMs))
          ?? processingDurationMs;
        const pairMap = (project) => ({
          current: project(openingDual.current, outcomes[0]),
          v2Candidate: project(openingDual.v2Candidate, outcomes[1]),
        });
        openingIssues.push(
          ...[
            runtimeIssue(currentOpening, 'current opening'),
            runtimeIssue(candidateOpening, 'v2_candidate opening'),
          ].filter(Boolean),
        );
        const openingNodeEvidence = {
          runtime_opening_context: {
            input: pairMap((pair) => ({
              runId: pair.preview?.runId || pair.execution?.runBefore?.runId || null,
              revision: pair.execution?.runBefore?.revision ?? pair.preview?.revision ?? null,
              openingSnapshot: pair.preview?.opening || null,
              castSnapshot: pair.preview?.castSnapshot || null,
            })),
            output: pairMap((pair) => ({
              evidenceScope: 'provider-safe Context body stays backend-owned; exact digest and token usage are auditable',
              commandInputDigest: pair.trace?.inputDigest || null,
              providerCalls: (pair.trace?.aiCalls || []).map((call) => ({
                callRef: call.callRef,
                requestDigest: call.requestDigest,
                modelProvider: call.modelProvider,
                model: call.model,
                modelVersion: call.modelVersion,
                inputTokens: call.inputTokens,
                outputTokens: call.outputTokens,
              })),
            })),
            short: 'Opening Context digest + Provider usage',
            durationMs: processingDurationMs,
            calls: [],
          },
          runtime_opening_director: {
            input: pairMap((pair) => ({
              opening: pair.preview?.opening || null,
              firstFollower: pair.preview?.firstFollower || null,
              expectedRunRevision: pair.trace?.expectedRunRevision
                ?? pair.execution?.runBefore?.revision ?? null,
            })),
            output: pairMap((_pair, outcome) => outcome ? {
              attemptInterpretation: outcome.attemptInterpretation || null,
              directorDecision: outcome.directorDecision || null,
              chapterDirective: outcome.chapterDirective || outcome.gameplayEvidence?.chapter?.directive || null,
              chapterStateBeforeEffects: outcome.chapterDirective?.evidenceStateEffectCodes || null,
            } : { state: 'not_exposed_or_command_rejected' }),
            short: 'Opening Director + Chapter Directive',
            durationMs: processingDurationMs,
            calls: [],
          },
          runtime_opening_llm: {
            input: pairMap((pair) => ({
              calls: pair.trace?.aiCalls || [],
              note: 'raw prompt 不下发浏览器；展示 requestDigest、模型、token、耗时和费用',
            })),
            output: pairMap((pair, outcome) => ({
              callStatus: (pair.trace?.aiCalls || []).map((call) => call.status),
              narrativeSummary: outcome?.narrativeSummary
                || pair.execution?.outcome?.narrativeSummary || null,
              narrativeEffects: outcome?.narrativeEffects || null,
              error: pair.execution?.error || null,
            })),
            short: calls.length ? `${calls.length} 次真实 Opening 模型调用` : '等待 Trace 中的模型调用证据',
            durationMs: aiDurationMs,
            calls,
          },
          runtime_opening_validate: {
            input: pairMap((_pair, outcome) => ({
              directorDecision: outcome?.directorDecision || null,
              narrativeEffects: outcome?.narrativeEffects || null,
            })),
            output: pairMap((pair, outcome) => ({
              commandStatus: pair.trace?.status
                || pair.execution?.command?.status || pair.execution?.status || null,
              commandErrorCode: pair.trace?.errorCode
                || pair.execution?.command?.errorCode || null,
              outcomeStatus: outcome?.status || null,
              error: pair.execution?.error || null,
            })),
            short: openingIssues.length ? 'Opening Validator/Worker 拒绝' : '双轨 Opening 校验通过',
            durationMs: processingDurationMs,
            calls: [],
          },
          runtime_opening_projection: {
            input: pairMap((pair, outcome) => ({
              commandId: pair.trace?.commandId
                || pair.execution?.command?.commandId || pair.execution?.accepted?.commandId || null,
              outcomeId: outcome?.outcomeId || pair.execution?.command?.resultOutcomeId || null,
              narrativeSummary: outcome?.narrativeSummary
                || pair.execution?.outcome?.narrativeSummary || null,
            })),
            output: pairMap((pair, outcome) => ({
              projections: pair.execution?.projections || null,
              feed: pair.execution?.feed || null,
              outcome,
              resultingRunRevision: outcome?.resultingRunRevision
                ?? pair.execution?.command?.finalizedRunRevision ?? null,
              writeCounts: outcome?.writeCounts || null,
              gameplayEvidence: outcome?.gameplayEvidence || null,
              chapterStateEffectCodes: outcome?.chapterStateEffectCodes || null,
              chapterState: outcome?.chapterState || null,
              chapterSettlement: outcome?.chapterSettlement || null,
            })),
            short: openingIssues.length ? 'Opening 产品表面未全部可用' : 'Opening Feed / Outcome 已读取',
            durationMs: commandDurationMs,
            calls: [],
          },
        };
        for (const item of NODES.filter((candidate) => candidate.stage === 'bootstrap'
          && candidate.id !== 'runtime_create')) {
          const evidence = openingNodeEvidence[item.id];
          setNodeEvidence(item, evidence.input, evidence.output, evidence.short, {
            durationMs: evidence.durationMs,
            calls: evidence.calls,
          });
          if (openingIssues.length) {
            item.status = 'warning';
            item.statusText = 'Opening 有拒绝';
            item.issue = openingIssues.join('；');
          }
        }
      }
    }

    const turnRows = ['comments', 'dm', 'event', 'memory'];
    for (const [index, row] of ROWS.entries()) {
      row.title = result.turns?.[index]?.kind || `第 ${index + 1} 轮待执行`;
      row.subtitle = result.turns?.[index]?.action || '按真实玩家行动显示；完整旅程请看玩法报告';
    }
    renderStages();
    for (let index = 0; index < turnRows.length; index += 1) {
      const turn = result.turns?.[index];
      if (!turn) continue;
      const dual = dualRuntimeEvidence(result, turn);
      const pairs = [dual.current, dual.v2Candidate];
      const traces = pairs.map((pair) => pair.trace).filter(Boolean);
      const calls = traces.flatMap((trace) => trace.aiCalls || []);
      const outcomes = pairs.map((pair) => pair.trace?.outcome || pair.execution?.outcome || null);
      const commandDurationMs = maxFinite(pairs.map((pair) =>
        pair.trace?.durationMs ?? pair.execution?.durationMs));
      const processingDurationMs = maxFinite(traces.map((trace) => trace.processingMs))
        ?? commandDurationMs;
      const aiDurationMs = maxFinite(calls.map((call) => call.latencyMs))
        ?? processingDurationMs;
      const rowIssues = [
        runtimeIssue(turn.current, 'current'),
        runtimeIssue(turn.v2Candidate, 'v2_candidate'),
      ].filter(Boolean);
      runtimeIssues.push(...rowIssues.map((issue) => `TURN ${index + 1} ${issue}`));
      const pairMap = (project) => ({
        current: project(dual.current, outcomes[0]),
        v2Candidate: project(dual.v2Candidate, outcomes[1]),
      });
      const nodeEvidence = {
        [`turn_${turnRows[index]}_input`]: {
          input: { kind: turn.kind || 'free_act', action: turn.action },
          output: pairMap((pair) => ({
            runId: pair.execution?.runBefore?.runId || null,
            expectedRunRevision: pair.execution?.runBefore?.revision ?? null,
            submitReceipt: pair.execution?.accepted || null,
            command: pair.execution?.command || null,
          })),
          short: '玩家原文 → typed Command',
          durationMs: commandDurationMs,
          calls: [],
        },
        [`turn_${turnRows[index]}_context`]: {
          input: pairMap((pair) => ({ action: turn.action, runBefore: pair.execution?.runBefore || null })),
          output: pairMap((pair) => ({
            evidenceScope: 'provider-safe Context body is restricted; digest and exact token usage are exposed',
            commandInputDigest: pair.trace?.inputDigest || null,
            modelCalls: (pair.trace?.aiCalls || []).map((call) => ({
              callRef: call.callRef, requestDigest: call.requestDigest,
              modelProvider: call.modelProvider, model: call.model, modelVersion: call.modelVersion,
              inputTokens: call.inputTokens, maxOutputObserved: call.outputTokens,
            })),
          })),
          short: 'Context digest + token 证据',
          durationMs: processingDurationMs || commandDurationMs,
          calls: [],
        },
        [`turn_${turnRows[index]}_director`]: {
          input: pairMap((pair) => ({
            action: turn.action,
            commandInputDigest: pair.trace?.inputDigest || null,
            expectedRunRevision: pair.trace?.expectedRunRevision ?? null,
          })),
          output: pairMap((_pair, outcome) => outcome ? {
            attemptInterpretation: outcome.attemptInterpretation || null,
            directorDecision: outcome.directorDecision || null,
            chapterDirective: outcome.chapterDirective || outcome.gameplayEvidence?.chapter?.directive || null,
            narrativeProjection: outcome.narrativeProjection || null,
          } : { state: 'not_exposed_or_command_rejected' }),
          short: 'Attempt Resolution + Director + Chapter Directive',
          durationMs: processingDurationMs || commandDurationMs,
          calls: [],
        },
        [`turn_${turnRows[index]}_llm`]: {
          input: pairMap((pair) => ({
            calls: pair.trace?.aiCalls || [],
            note: 'raw prompt 不返回浏览器；requestDigest、模型、token、耗时与费用可审计',
          })),
          output: pairMap((pair, outcome) => ({
            callStatus: (pair.trace?.aiCalls || []).map((call) => call.status),
            narrativeSummary: outcome?.narrativeSummary || null,
            narrativeEffects: outcome?.narrativeEffects || null,
            error: pair.execution?.error || null,
          })),
          short: calls.length ? `${calls.length} 次真实模型调用` : '无成功模型调用证据',
          durationMs: aiDurationMs || processingDurationMs || commandDurationMs,
          calls,
        },
        [`turn_${turnRows[index]}_validator`]: {
          input: pairMap((_pair, outcome) => ({
            directorDecision: outcome?.directorDecision || null,
            narrativeEffects: outcome?.narrativeEffects || null,
          })),
          output: pairMap((pair, outcome) => ({
            commandStatus: pair.trace?.status || pair.execution?.command?.status || pair.execution?.status || null,
            commandErrorCode: pair.trace?.errorCode || pair.execution?.command?.errorCode || null,
            outcomeStatus: outcome?.status || null,
            rejectionCode: pair.execution?.outcome?.rejectionCode || null,
            error: pair.execution?.error || null,
          })),
          short: rowIssues.length ? 'Validator/Worker 拒绝' : '双轨校验通过',
          durationMs: processingDurationMs || commandDurationMs,
          calls: [],
        },
        [`turn_${turnRows[index]}_apply`]: {
          input: pairMap((_pair, outcome) => outcome),
          output: pairMap((pair, outcome) => ({
            commandId: pair.trace?.commandId || pair.execution?.command?.commandId || null,
            outcomeId: outcome?.outcomeId || pair.execution?.command?.resultOutcomeId || null,
            status: pair.trace?.status || pair.execution?.status || null,
            resultingRunRevision: outcome?.resultingRunRevision
              ?? pair.execution?.command?.finalizedRunRevision ?? null,
            writeCounts: outcome?.writeCounts || null,
            gameplayEvidence: outcome?.gameplayEvidence || null,
            chapterStateEffectCodes: outcome?.chapterStateEffectCodes || null,
            chapterState: outcome?.chapterState || null,
            chapterSettlement: outcome?.chapterSettlement || null,
            finalizedAt: pair.trace?.finalizedAt || pair.execution?.command?.finalizedAt || null,
          })),
          short: rowIssues.length ? '终态已保留，未全部 Apply' : 'Canon 已原子写入',
          durationMs: processingDurationMs || commandDurationMs,
          calls: [],
        },
        [`turn_${turnRows[index]}_surface`]: {
          input: pairMap((pair, outcome) => ({
            outcomeId: outcome?.outcomeId || pair.execution?.command?.resultOutcomeId || null,
            narrativeSummary: outcome?.narrativeSummary || pair.execution?.outcome?.narrativeSummary || null,
          })),
          output: pairMap((pair) => pair.execution?.projections || pair.execution?.feed || {
            state: pair.execution?.status === 'applied' ? 'projections_not_returned' : 'not_available_after_rejection',
          }),
          short: rowIssues.length ? '部分产品表面不可用' : 'Feed / 产品表面已读取',
          durationMs: commandDurationMs,
          calls: [],
        },
        [`turn_${turnRows[index]}_review`]: {
          input: pairMap((pair, outcome) => ({
            status: pair.execution?.status || null,
            commandStatus: pair.trace?.status || pair.execution?.command?.status || null,
            outcome: outcome || null,
          })),
          output: {
            currentStatus: turn.current?.status || 'missing',
            v2CandidateStatus: turn.v2Candidate?.status || 'missing',
            currentDurationMs: dual.current.trace?.durationMs ?? turn.current?.durationMs ?? null,
            v2CandidateDurationMs: dual.v2Candidate.trace?.durationMs ?? turn.v2Candidate?.durationMs ?? null,
            currentAi: summarizeCalls(dual.current.trace?.aiCalls || []),
            v2CandidateAi: summarizeCalls(dual.v2Candidate.trace?.aiCalls || []),
            memoryVerification: turn.kind === 'dm_message_recall'
              ? result.memoryVerification : null,
            issues: rowIssues,
          },
          short: rowIssues.length ? '存在可定位的 Runtime 错误' : '双轨均 applied',
          durationMs: commandDurationMs,
          calls,
        },
      };
      for (const item of NODES.filter((candidate) => candidate.row === turnRows[index])) {
        const evidence = nodeEvidence[item.id];
        setNodeEvidence(item, evidence.input, evidence.output, evidence.short, {
          durationMs: evidence.durationMs,
          calls: evidence.calls,
        });
        if (rowIssues.length) {
          item.status = 'warning'; item.statusText = 'Runtime 有拒绝'; item.issue = rowIssues.join('；');
        }
      }
    }

    const memoryIssues = Object.entries(result.memoryVerification || {})
      .filter(([, verification]) => !verification?.passed)
      .map(([trackCode]) => `${trackCode}: memory_recall_not_verified`);
    const issueCount = failedTracks.length + openingIssues.length + runtimeIssues.length
      + memoryIssues.length + (result.traceError ? 1 : 0) + (result.error ? 1 : 0);
    $('#issue-count').textContent = String(issueCount);
    $('#duration-value').textContent = formatDuration(result.durationMs);
    $('#trace-value').textContent = result.trace ? 'Compiler + Runtime' : result.traceError ? '失败' : progressive ? '等待' : '缺失';
    const experimentLabel = result.experiment?.experimentId
      ? `Experiment ${String(result.experiment.experimentId).slice(0, 8)}` : 'Shared Backend';
    if (result.status === 'running') {
      setHealth('running', experimentLabel, `${result.turns?.length || 0} 轮已返回`);
    } else {
      setHealth(issueCount ? 'error' : '', experimentLabel,
        issueCount ? `${issueCount} 个可定位问题` : '双轨流程已结束，玩法覆盖见报告');
    }
    renderNodes(); renderInspector();
  }

  function inputFromForm() {
    const characterVersionIds = parseCharacterVersionIds($('#eval-character-version-id').value);
    const next = {
      title: $('#eval-title').value.trim(), description: $('#eval-description').value.trim(),
      setting: $('#eval-setting').value.trim(), goal: $('#eval-goal').value.trim(),
      characterVersionIds,
      characterVersionId: characterVersionIds[0] || '',
      zeroCastPolicy: characterVersionIds.length ? null : 'institutional_zero_cast',
      highlightDescription: $('#eval-highlight-description').value.trim(),
      evaluationInstruction: $('#eval-instruction').value.trim(),
      evaluationMode: $('#eval-mode').value,
      playerActions: $('#eval-actions').value.split('\n').map((item) => item.trim()).filter(Boolean),
      sourceDocument: state.pendingSourceDocument ? { ...state.pendingSourceDocument, title: $('#eval-title').value.trim() } : null,
      selectedPersona: $('#persona-select').value || state.evalInput.selectedPersona || '',
      playerCharacterVersionId: $('#eval-player-character').value || null,
      firstFollowerCharacterVersionId: $('#eval-first-follower').value || null,
      topicTags: [...(state.evalInput.topicTags || [])],
      personaOptions: [...(state.evalInput.personaOptions || [])],
      baseScenarioId: state.evalInput.baseScenarioId || state.evalInput.sourceScenarioId || null,
      sourceScenarioId: null,
      sourceFile: null,
      sourceDigest: null,
      sourceWorldDraftRevisionId: null,
      characters: characterVersionIds.map((id) => characterCatalog().find((card) => card.characterVersionId === id)).filter(Boolean),
    };
    const scenario = scenarioById(next.baseScenarioId);
    if (!next.sourceDocument && importedSourceStillMatches(next, scenario)) {
      next.sourceScenarioId = scenario.id;
      next.sourceFile = scenario.sourceFile || null;
      next.sourceDigest = scenario.sourceDigest || null;
      next.sourceWorldDraftRevisionId = scenario.worldDraftRevisionId || null;
      next.characterVersionIds = [...(scenario.characterVersionIds || [])].slice(0, 8);
      next.characterVersionId = next.characterVersionIds[0] || '';
      next.zeroCastPolicy = next.characterVersionIds.length ? null : 'institutional_zero_cast';
      next.topicTags = [...(scenario.topicTags || [])];
      next.personaOptions = [...(scenario.personaOptions || [])];
      next.characters = [...(scenario.characters || [])];
    }
    return next;
  }

  function renderQuickPlayerRole() {
    const select = $('#quick-player-character');
    const cards = (state.evalInput.characters || []).filter((card) =>
      (state.evalInput.characterVersionIds || []).includes(card.characterVersionId) && card.playable !== false);
    if (!cards.length) {
      select.innerHTML = '<option value="">零角色世界 · Preview Player</option>';
      select.value = '';
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = cards.map((card) =>
      `<option value="${escapeHtml(card.characterVersionId)}">${escapeHtml(card.displayName)}</option>`).join('');
    const recommended = cards.find((card) => card.starterRecommended) || cards[0];
    const selected = cards.find((card) => card.characterVersionId === state.evalInput.playerCharacterVersionId)
      || recommended;
    select.value = selected.characterVersionId;
    state.evalInput.playerCharacterVersionId = selected.characterVersionId;
    if (state.evalInput.firstFollowerCharacterVersionId === selected.characterVersionId) {
      state.evalInput.firstFollowerCharacterVersionId = null;
    }
  }

  function updatePersonaOptions(options = [], selected = '') {
    const values = options.length ? options : ['默认评审视角'];
    const select = $('#persona-select');
    select.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    select.value = values.includes(selected) ? selected : values[0];
    state.evalInput.selectedPersona = select.value;
  }

  function ensureCustomScenarioOption(title) {
    const select = $('#scenario-select');
    let option = select.querySelector('option[value="custom"]');
    if (!option) {
      option = document.createElement('option');
      option.value = 'custom';
      select.append(option);
    }
    option.textContent = `临时自定义 · ${title}`;
    select.value = 'custom';
  }

  function characterCatalog() {
    const seen = new Set();
    return scenarioLibrary.flatMap((scenario) => (scenario.characters || []).map((card) => ({ ...card, sourceTitle: scenario.title })))
      .concat(state.evalInput.characters || []).filter((card) => {
        if (!card?.characterVersionId || seen.has(card.characterVersionId)) return false;
        seen.add(card.characterVersionId); return true;
      });
  }

  function canContinueEvaluation(result) {
    return Boolean(
      result?.previewRuns?.current?.runId
      && result?.previewRuns?.v2Candidate?.runId
      && result?.opening?.current?.status === 'applied'
      && result?.opening?.v2Candidate?.status === 'applied'
    );
  }

  function renderExperience() {
    window.SliceExperienceReport?.render($('#experience-report'), state.lastRun, state.evalInput, state.experienceTrack);
    const result = state.lastRun;
    const continuePanel = $('#continue-panel');
    const canContinue = canContinueEvaluation(result);
    const running = document.body.classList.contains('run-active');
    continuePanel.hidden = !canContinue || running;
    $('#continue-submit').disabled = running || !canContinue;
    if (canContinue) {
      const role = (state.evalInput.characters || []).find((card) =>
        card.characterVersionId === state.evalInput.playerCharacterVersionId)?.displayName || 'Preview Player';
      $('#continue-meta').textContent = `${role} · 已有 ${result.turns?.length || 0} 轮行为 · Current / V2 都沿用现有 Run，不会重新编译`;
    }
    const compileReady = result?.experiment?.status === 'succeeded';
    const compilePending = result?.experiment?.status === 'running'
      && !['dead_letter', 'cancelled', 'succeeded'].includes(result.experiment.execution?.status);
    const canResume = (compileReady || compilePending) && result?.scenario?.worldDraftRevisionId
      && !result.previewRuns?.current && !result.previewRuns?.v2Candidate;
    $('#resume-compile').textContent = compileReady ? '使用此编译继续试玩' : '继续等待同一编译';
    $('#resume-compile').hidden = !canResume || document.body.classList.contains('run-active');
  }

  function updateSourceChangeWarning() {
    const scenario = scenarioById(state.evalInput.baseScenarioId || state.evalInput.sourceScenarioId);
    const changed = Boolean(scenario && !importedSourceStillMatches(inputFromForm(), scenario));
    $('#eval-source-change-warning').hidden = !changed || Boolean(state.pendingSourceDocument);
  }

  function renderScenarioCharacters() {
    const host = $('#eval-scenario-characters');
    const ids = parseCharacterVersionIds($('#eval-character-version-id').value);
    const query = $('#eval-character-search').value.trim().toLocaleLowerCase();
    $('#eval-scenario-character-count').textContent = `${ids.length} / 8 已选择`;
    const cards = characterCatalog();
    for (const id of ids) if (!cards.some((card) => card.characterVersionId === id)) cards.push({ characterVersionId: id, displayName: '自定义人物版本', sourceTitle: '手动 UUID' });
    cards.sort((left, right) => {
      const a = ids.indexOf(left.characterVersionId), b = ids.indexOf(right.characterVersionId);
      return (a < 0 ? 1000 : a) - (b < 0 ? 1000 : b);
    });
    host.innerHTML = cards.filter((card) => !query || [card.displayName, card.role, card.summary, card.sourceTitle].join(' ').toLocaleLowerCase().includes(query)).map((card) => {
      const id = card.characterVersionId, selected = ids.includes(id);
      return `<label class="eval-character-card${selected ? ' selected' : ''}">
        <div class="eval-character-head"><input type="checkbox" data-character-id="${escapeHtml(id)}" ${selected ? 'checked' : ''} aria-label="选择 ${escapeHtml(card.displayName)}" /><strong>${escapeHtml(card.displayName)}</strong>${selected ? `<small>第 ${ids.indexOf(id) + 1} 位</small>` : ''}</div>
        <small>${escapeHtml(card.sourceTitle || '已绑定角色卡')}</small>
        <p class="eval-character-role">${escapeHtml(card.role || '')}</p><p>${escapeHtml(card.summary || card.personalityPreview || '')}</p>
        ${card.speakingStylePreview ? `<small>说话：${escapeHtml(card.speakingStylePreview)}</small>` : ''}
        <code title="${escapeHtml(id)}">${escapeHtml(id)}</code></label>`;
    }).join('') || '<p class="experience-muted">没有匹配的基础角色卡。</p>';
    renderStartRoles();
  }

  function renderStartRoles(reset = false) {
    const ids = parseCharacterVersionIds($('#eval-character-version-id').value);
    const catalog = characterCatalog();
    const cards = ids.map((id) => catalog.find((card) => card.characterVersionId === id)
      || { characterVersionId: id, displayName: `角色 ${id.slice(0, 8)}` });
    const player = $('#eval-player-character'), follower = $('#eval-first-follower');
    const chosenPlayer = reset ? state.evalInput.playerCharacterVersionId : player.value;
    const chosenFollower = reset ? state.evalInput.firstFollowerCharacterVersionId : follower.value;
    const option = (card) => `<option value="${escapeHtml(card.characterVersionId)}">${escapeHtml(card.displayName)}</option>`;
    const playable = cards.filter((card) => card.playable !== false);
    const recommended = playable.find((card) => card.starterRecommended) || playable[0] || null;
    player.innerHTML = (playable.length
      ? '<option value="">请选择剧本角色</option>'
      : '<option value="">零角色世界 · Preview Player</option>') + playable.map(option).join('');
    player.value = playable.some((card) => card.characterVersionId === chosenPlayer)
      ? chosenPlayer : recommended?.characterVersionId || '';
    const npcs = cards.filter((card) => card.characterVersionId !== player.value);
    follower.innerHTML = '<option value="">按剧本推荐选择</option>' + npcs.map(option).join('');
    follower.value = npcs.some((card) => card.characterVersionId === chosenFollower) ? chosenFollower : '';
  }

  function updateSourceMeta() {
    const meta = $('#eval-source-meta');
    if (!meta) return;
    const castCount = state.evalInput.characterVersionIds?.length || 0;
    if (state.evalInput.sourceWorldDraftRevisionId) {
      meta.textContent = `内置剧本：${state.evalInput.sourceFile} · ${castCount} 人 Cast · Source ${String(state.evalInput.sourceDigest).slice(0, 12)} · Revision ${String(state.evalInput.sourceWorldDraftRevisionId).slice(0, 12)}`;
      meta.className = 'dialog-note source-meta imported';
    } else {
      meta.textContent = '当前为临时自定义输入；运行时会新建一条 private immutable Draft Revision。';
      meta.className = 'dialog-note source-meta custom';
    }
  }

  function fillInputForm() {
    $('#eval-title').value = state.evalInput.title;
    $('#eval-description').value = state.evalInput.description;
    $('#eval-setting').value = state.evalInput.setting;
    $('#eval-goal').value = state.evalInput.goal;
    $('#eval-character-version-id').value = (state.evalInput.characterVersionIds || []).join('\n');
    $('#eval-highlight-description').value = state.evalInput.highlightDescription || '';
    $('#eval-instruction').value = state.evalInput.evaluationInstruction;
    $('#eval-actions').value = state.evalInput.playerActions.join('\n');
    $('#eval-mode').value = state.evalInput.evaluationMode || 'experience';
    $('#eval-character-search').value = '';
    $('#eval-source-document').value = '';
    state.pendingSourceDocument = state.evalInput.sourceDocument || null;
    $('#eval-source-document-status').textContent = state.pendingSourceDocument ? `已附加 ${state.pendingSourceDocument.fileName}` : '未附加；内置剧本不改 Source 时仍使用后端完整长文。';
    $('#eval-source-change-warning').hidden = true;
    $('#instruction-count').textContent = `${state.evalInput.evaluationInstruction.length} / 2000`;
    updateSourceMeta();
    renderScenarioCharacters();
    renderStartRoles(true);
    renderQuickPlayerRole();
  }

  function initializeScenarioControls() {
    $('#eval-player-character').addEventListener('change', () => renderStartRoles());
    $('#quick-player-character').addEventListener('change', (event) => {
      const nextPlayer = event.target.value || null;
      if (nextPlayer === state.evalInput.playerCharacterVersionId) return;
      state.evalInput.playerCharacterVersionId = nextPlayer;
      if (state.evalInput.firstFollowerCharacterVersionId === nextPlayer) {
        state.evalInput.firstFollowerCharacterVersionId = null;
      }
      state.lastRun = null;
      resetToWaiting();
      renderExperience();
      showToast(nextPlayer ? '试玩角色已切换；下一次运行会以这个剧本角色进入世界' : '当前为零角色 Preview Player');
    });
    const select = $('#scenario-select');
    const scenarios = scenarioLibrary.length ? scenarioLibrary : [FALLBACK_SCENARIO];
    select.innerHTML = scenarios.map((scenario) =>
      `<option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.title)}</option>`).join('');
    select.value = state.evalInput.sourceScenarioId || initialScenario.id;
    updatePersonaOptions(state.evalInput.personaOptions, state.evalInput.selectedPersona);
    renderQuickPlayerRole();
  }

  function loadScenario(scenario) {
    state.evalInput = evalInputFromScenario(scenario);
    $('#scenario-select').value = scenario.id;
    updatePersonaOptions(state.evalInput.personaOptions, state.evalInput.selectedPersona);
    fillInputForm();
    state.lastRun = null;
    state.pendingSourceDocument = null;
    renderExperience();
    resetToWaiting();
    renderNodes();
    renderInspector();
  }

  function fatalNodeId(error, partialResult) {
    const operationId = error?.operationId;
    if (['evalCreateWorldDraft', 'evalCreateWorldDraftRevision'].includes(operationId)) return 'source_script';
    if (['evalCreateCompilerExperiment', 'evalGetCompilerExperiment', 'getCompilerRuntimeEvalTrace'].includes(operationId)) {
      return 'compile_bundle';
    }
    if (operationId === 'createCompilerExperimentPreviewRun') return 'runtime_create';
    const row = ['comments', 'dm', 'event', 'memory'][Math.min(partialResult?.turns?.length || 0, 3)];
    if (operationId === 'evalCreateDmChannel' || operationId === 'evalListDmChannels') return 'turn_dm_input';
    if (operationId === 'evalGetRun' || operationId === 'evalSubmitWorldCommand') return `turn_${row}_input`;
    if (operationId === 'evalGetWorldCommand') return `turn_${row}_validator`;
    if (operationId === 'evalGetOutcomeByCommand') return `turn_${row}_apply`;
    if (operationId === 'evalListRunFeed') return `turn_${row}_surface`;
    return 'source_script';
  }

  function markFatalRunError(error, partialResult = null) {
    const item = nodesById.get(fatalNodeId(error, partialResult));
    const failure = {
      code: error?.code || 'SLICE_EVAL_RUN_FAILED',
      backendCode: error?.backendCode || null,
      status: error?.status ?? null,
      retryability: error?.retryability || null,
      operationId: error?.operationId || null,
      routePath: error?.routePath || null,
      message: String(error?.message || error),
    };
    item.status = 'error';
    item.statusText = '链路在此中止';
    item.input = item.input?.state === 'not_executed' ? {
      sourceScenarioId: state.evalInput.sourceScenarioId,
      sourceWorldDraftRevisionId: state.evalInput.sourceWorldDraftRevisionId,
    } : item.input;
    item.output = { previousEvidence: item.output, failure };
    item.outputShort = '已保留前序证据 · 查看失败点';
    item.issue = `${failure.code}: ${failure.message}`;
    const failedOperation = (partialResult?.operations || []).findLast?.((operation) => operation.status === 'failed')
      || [...(partialResult?.operations || [])].reverse().find((operation) => operation.status === 'failed');
    if (failedOperation) setNodeMetrics(item, { durationMs: failedOperation.durationMs });
    $('#issue-count').textContent = String(Math.max(1, NODES.filter((nodeData) => nodeData.issue).length));
    $('#trace-value').textContent = partialResult?.trace ? '部分完成' : '未完成';
    renderNodes();
    selectNode(item.id);
  }

  async function runRealEvaluation({ resume = false } = {}) {
    const backend = window.SliceEvalBackend;
    if (!backend?.connected()) { openAuthDialog(); return; }
    const button = $('#run-all');
    button.disabled = true; button.textContent = '正在运行…';
    const previous = resume ? state.lastRun : null;
    const lockedControls = ['#scenario-select', '#persona-select', '#edit-input', '#import-run', '#auth-action', '#resume-compile'];
    lockedControls.forEach((selector) => { $(selector).disabled = true; });
    $('#stop-run').hidden = state.evalInput.evaluationMode === 'regression';
    $('#stop-run').disabled = false;
    $('#stop-run').textContent = '本轮后停止';
    state.lastRun = null;
    renderExperience();
    document.body.classList.add('run-active');
    resetToWaiting(); renderNodes();
    try {
      const execute = previous
        ? (notify) => backend.resumeCompilation(previous, notify)
        : (notify) => backend.runFullEvaluation(state.evalInput, notify);
      const result = await execute((progress) => {
        const message = progress.message || $('#experience-progress').textContent || '执行中';
        $('#experience-progress').textContent = message;
        setHealth('running', 'Shared Backend', message);
        if (progress.kind === 'checkpoint' && progress.partialResult?.scenario) {
          applyRunResult(progress.partialResult, { progressive: true });
        }
      });
      applyRunResult(result);
      $('#experience-progress').textContent = result.status === 'stopped' ? `已停止，保留 ${result.turns.length} 轮结果` : `已返回 ${result.turns.length} 轮真实结果；查看报告中的证据与异常。`;
      showToast(`真实 Eval 已返回：${result.turns.length} 轮 Current/V2 对比`);
    } catch (error) {
      const partialResult = error?.partialResult || null;
      if (partialResult?.input) applyRunResult(partialResult, { progressive: true });
      const unauthorized = error?.status === 401
        || ['SLICE_AUTH_REQUIRED', 'SLICE_EVAL_SESSION_EXPIRED'].includes(error?.code);
      setHealth('error', unauthorized ? 'Eval Session' : 'Shared Backend', unauthorized ? '需要重新登录' : '执行失败');
      markFatalRunError(error, partialResult);
      if (unauthorized) {
        $('#auth-action').textContent = '登录';
        setAuthStatus('Eval Session 已过期或被撤销，请重新登录。账号错误只会在登录请求本身提示。');
        if (!$('#auth-dialog').open) $('#auth-dialog').showModal();
      }
      $('#experience-progress').textContent = `执行中止：${error.message || error}`;
      showToast(`执行失败：${error.message || error}`);
    } finally {
      button.disabled = false; button.textContent = state.evalInput.evaluationMode === 'regression' ? '运行链路回归' : '连续模拟';
      lockedControls.forEach((selector) => { $(selector).disabled = false; });
      $('#stop-run').hidden = true;
      document.body.classList.remove('run-active');
      renderExperience();
    }
  }

  async function runContinuation(action) {
    const backend = window.SliceEvalBackend;
    if (!backend?.connected()) { openAuthDialog(); return; }
    if (!canContinueEvaluation(state.lastRun)) {
      showToast('当前双轨 Opening 尚未全部成功，不能继续提交下一轮');
      return;
    }
    const body = String(action || '').trim();
    if (!body) { showToast('请输入下一轮玩家行为'); return; }
    const button = $('#continue-submit');
    const lockedControls = ['#run-all', '#scenario-select', '#quick-player-character', '#edit-input', '#import-run', '#auth-action', '#resume-compile'];
    button.disabled = true;
    button.textContent = '运行中…';
    lockedControls.forEach((selector) => { $(selector).disabled = true; });
    document.body.classList.add('run-active');
    renderExperience();
    try {
      const result = await backend.continueEvaluation(state.lastRun, body, (progress) => {
        const message = progress.message || '继续运行中';
        $('#experience-progress').textContent = message;
        setHealth('running', 'Shared Backend', message);
        if (progress.partialResult?.input) applyRunResult(progress.partialResult, { progressive: true });
      });
      applyRunResult(result);
      $('#continue-action').value = '';
      const latest = result.turns?.at(-1);
      const okay = latest && [latest.current, latest.v2Candidate].every((execution) => execution?.status === 'applied');
      $('#experience-progress').textContent = okay
        ? `第 ${result.turns.length} 轮已写入同一双轨 Run；可以继续输入下一步。`
        : `第 ${result.turns.length} 轮已返回，存在可定位异常；Run 已保留，仍可继续输入。`;
      showToast(okay ? '下一轮已完成，可以继续玩' : '这一轮有异常，但同一局仍可继续');
    } catch (error) {
      const partialResult = error?.partialResult || null;
      if (partialResult?.input) applyRunResult(partialResult, { progressive: true });
      const unauthorized = error?.status === 401
        || ['SLICE_AUTH_REQUIRED', 'SLICE_EVAL_SESSION_EXPIRED'].includes(error?.code);
      setHealth('error', unauthorized ? 'Eval Session' : 'Shared Backend', unauthorized ? '需要重新登录' : '这一轮执行失败');
      $('#experience-progress').textContent = `这一轮未完成：${error.message || error}；已有 Run 未丢失。`;
      if (unauthorized) {
        $('#auth-action').textContent = '登录';
        setAuthStatus('Eval Session 已过期或被撤销，请重新登录。');
        if (!$('#auth-dialog').open) $('#auth-dialog').showModal();
      }
      showToast(`这一轮失败：${error.message || error}`);
    } finally {
      document.body.classList.remove('run-active');
      button.disabled = false;
      button.textContent = '运行下一轮';
      lockedControls.forEach((selector) => { $(selector).disabled = false; });
      renderExperience();
    }
  }

  function countRootIssues() {
    return NODES.filter((item) => item.issue && (item.stage === 'compiler' || item.kind === 'review')).length;
  }

  function exportReport() {
    if (!state.lastRun) { showToast('还没有真实 Run 可导出'); return; }
    const report = {
      schemaVersion: 'slice.eval.canvas.export.v2',
      exportedAt: new Date().toISOString(),
      evaluation: state.lastRun,
      costEstimate: window.SliceCostEstimate?.estimateRun(state.lastRun) || null,
      nodes: NODES.map((item) => ({ id: item.id, title: item.title, status: item.status, input: item.input, output: item.output, expected: item.expected, issue: item.issue, scores: item.scores, note: item.note }))
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `slice-eval-${state.lastRun.experiment?.experimentId || 'partial'}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('评测报告已导出');
  }

  function wireEvents() {
    $$('.rail-tool[data-tool]').forEach((button) => button.addEventListener('click', () => {
      state.currentTool = button.dataset.tool;
      $$('.rail-tool[data-tool]').forEach((item) => item.classList.toggle('active', item === button));
      viewport.style.cursor = state.currentTool === 'pan' ? 'grab' : 'default';
    }));

    viewport.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const clickedNode = event.target.closest('.node-card');
      if (clickedNode && state.currentTool === 'select') return;
      state.dragging = true;
      state.dragOrigin = { x: event.clientX, y: event.clientY, tx: state.tx, ty: state.ty };
      viewport.classList.add('panning');
      viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!state.dragging) return;
      state.tx = state.dragOrigin.tx + event.clientX - state.dragOrigin.x;
      state.ty = state.dragOrigin.ty + event.clientY - state.dragOrigin.y;
      applyTransform();
    });
    const stopDrag = (event) => {
      if (!state.dragging) return;
      state.dragging = false;
      viewport.classList.remove('panning');
      try { viewport.releasePointerCapture(event.pointerId); } catch (_) {}
    };
    viewport.addEventListener('pointerup', stopDrag);
    viewport.addEventListener('pointercancel', stopDrag);

    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * .002);
        zoomAt(state.scale * factor, event.clientX, event.clientY);
      } else {
        state.tx -= event.deltaX;
        state.ty -= event.deltaY;
        applyTransform();
      }
    }, { passive: false });

    $('#zoom-in').addEventListener('click', () => {
      const rect = viewport.getBoundingClientRect();
      zoomAt(state.scale * 1.14, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    $('#zoom-out').addEventListener('click', () => {
      const rect = viewport.getBoundingClientRect();
      zoomAt(state.scale / 1.14, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    $('#fit-canvas').addEventListener('click', () => fitRect({ x: 60, y: 80, w: 4080, h: 2420 }, 28, .5));
    $('#reset-zoom').addEventListener('click', () => {
      state.scale = 1;
      state.tx = 20;
      state.ty = 20;
      applyTransform();
    });
    $('#toggle-minimap').addEventListener('click', (event) => {
      $('#minimap').classList.toggle('hidden');
      event.currentTarget.classList.toggle('active');
    });
    $('#toggle-connections').addEventListener('click', (event) => {
      document.body.classList.toggle('hide-connections');
      event.currentTarget.classList.toggle('active', !document.body.classList.contains('hide-connections'));
    });

    $$('.stage-chip').forEach((button) => button.addEventListener('click', () => focusStage(button.dataset.focusStage)));

    $('#node-search').addEventListener('input', (event) => {
      state.query = event.target.value;
      applyFilters();
    });
    $('#issue-only').addEventListener('click', (event) => {
      state.issueOnly = !state.issueOnly;
      event.currentTarget.classList.toggle('active', state.issueOnly);
      applyFilters();
    });
    $$('.view-segment button').forEach((button) => button.addEventListener('click', () => {
      state.viewMode = button.dataset.view;
      document.body.dataset.viewMode = state.viewMode;
      $$('.view-segment button').forEach((item) => item.classList.toggle('active', item === button));
      renderNodes();
      renderInspector();
    }));

    $$('.inspector-tabs button').forEach((button) => button.addEventListener('click', () => {
      state.activeTab = button.dataset.tab;
      renderInspector();
    }));
    $('#close-inspector').addEventListener('click', () => {
      $('#inspector').classList.add('collapsed');
      $('.workspace').classList.add('inspector-closed');
      setTimeout(applyTransform, 0);
    });

    $('#run-all').addEventListener('click', () => runRealEvaluation());
    $('#resume-compile').addEventListener('click', () => runRealEvaluation({ resume: true }));
    $('#continue-form').addEventListener('submit', (event) => {
      event.preventDefault();
      runContinuation($('#continue-action').value);
    });
    $('#continue-action').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        $('#continue-form').requestSubmit();
      }
    });
    $('#stop-run').addEventListener('click', () => {
      window.SliceEvalBackend.requestStop();
      $('#stop-run').disabled = true;
      $('#stop-run').textContent = '正在收束本轮';
      $('#experience-progress').textContent = '当前在途请求仍会完成，之后不再提交新的行动。';
    });
    $$('[data-workbench-view]').forEach((button) => button.addEventListener('click', () => {
      document.body.dataset.workbench = button.dataset.workbenchView;
      $$('[data-workbench-view]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      if (button.dataset.workbenchView === 'canvas') {
        $('#experience-progress').textContent = '技术画布保留前 4 轮诊断槽位；完整逐轮证据请看玩法报告。';
        applyTransform();
      }
    }));
    $('#experience-track').addEventListener('change', (event) => { state.experienceTrack = event.target.value; renderExperience(); });
    $('#experience-report').addEventListener('click', (event) => {
      if (event.target.closest('[data-experience-edit]') && !document.body.classList.contains('run-active')) { fillInputForm(); $('#input-dialog').showModal(); }
    });
    $('#eval-character-search').addEventListener('input', renderScenarioCharacters);
    $('#eval-scenario-characters').addEventListener('change', (event) => {
      const checkbox = event.target.closest('[data-character-id]');
      if (!checkbox) return;
      let ids = parseCharacterVersionIds($('#eval-character-version-id').value);
      if (checkbox.checked && !ids.includes(checkbox.dataset.characterId)) {
        if (ids.length >= 8) { checkbox.checked = false; showToast('最多选择 8 张角色卡，请先取消一张'); return; }
        ids.push(checkbox.dataset.characterId);
      } else ids = ids.filter((id) => id !== checkbox.dataset.characterId);
      $('#eval-character-version-id').value = ids.join('\n');
      renderScenarioCharacters(); updateSourceChangeWarning();
    });
    $('#eval-character-version-id').addEventListener('input', () => { renderScenarioCharacters(); updateSourceChangeWarning(); });
    $('#eval-cast-reset').addEventListener('click', () => {
      const scenario = scenarioById(state.evalInput.baseScenarioId || state.evalInput.sourceScenarioId) || scenarioById($('#scenario-select').value);
      $('#eval-character-version-id').value = (scenario?.characterVersionIds || []).join('\n');
      renderScenarioCharacters(); updateSourceChangeWarning();
    });
    ['#eval-title', '#eval-description', '#eval-setting', '#eval-goal', '#eval-highlight-description'].forEach((selector) => $(selector).addEventListener('input', updateSourceChangeWarning));
    $('#eval-source-document').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      state.pendingSourceDocument = null;
      if (!file) { $('#eval-source-document-status').textContent = '未附加原文'; updateSourceChangeWarning(); return; }
      $('#input-save').disabled = true;
      try {
        if (file.size > 262144) throw new Error('原文文件不能超过 256 KiB');
        const body = await file.text();
        if (!body.trim() || [...body].length > 65536) throw new Error('原文须为 1–65536 字');
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
        const contentDigest = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
        state.pendingSourceDocument = { schemaVersion: 'slice.long-form-world-source.v1', mediaType: 'text/markdown', fileName: [...file.name].slice(0, 191).join(''), body, contentDigest };
        $('#eval-source-document-status').textContent = `已附加 ${file.name} · ${[...body].length} 字 · SHA-256 ${contentDigest.slice(0, 12)}`;
      } catch (error) { $('#eval-source-document-status').textContent = error.message; event.target.value = ''; }
      finally { $('#input-save').disabled = false; updateSourceChangeWarning(); }
    });
    $('#export-run').addEventListener('click', exportReport);
    $('#edit-input').addEventListener('click', () => { fillInputForm(); $('#input-dialog').showModal(); });
    $('#auth-action').addEventListener('click', () => {
      if (window.SliceEvalBackend?.connected()) {
        window.SliceEvalBackend.disconnect();
        setHealth('waiting', 'Backend', '未登录');
        $('#auth-action').textContent = '登录';
        showToast('已退出 Eval Backend');
      } else {
        openAuthDialog();
      }
    });
    $('#auth-form').addEventListener('submit', async (event) => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const button = $('#auth-submit'); button.disabled = true; button.textContent = '连接中…';
      try {
        const session = await window.SliceEvalBackend.connect({ username: $('#auth-username').value, password: $('#auth-password').value });
        $('#auth-password').value = ''; $('#auth-dialog').close();
        $('#auth-action').textContent = '退出'; setHealth('', 'Shared Backend', '已连接');
        setAuthStatus('');
        showToast(`已连接 Eval 工作区 ${String(session.workspaceId).slice(0, 8)}`);
      } catch (error) {
        const routeMissing = error?.code === 'SLICE_EVAL_ROUTE_NOT_DEPLOYED';
        $('#auth-password').value = '';
        $('#auth-password').focus();
        setHealth('error', routeMissing ? 'Eval API route' : 'Backend', routeMissing ? '未部署' : '登录失败');
        setAuthStatus(`${error.message || String(error)} 密码框已清空，请重新粘贴当前有效密码。`);
        showToast(`登录失败：${error.message || error}`);
      }
      finally { button.disabled = false; button.textContent = '连接后端'; }
    });
    $('#input-form').addEventListener('submit', (event) => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const next = inputFromForm();
      if (!next.title || !next.description || !next.setting || !next.goal || !next.evaluationInstruction || !next.playerActions.length) {
        showToast('请完整填写剧本、提示词和至少一轮玩家行动'); return;
      }
      const characterError = characterVersionInputError(next.characterVersionIds);
      if (characterError) { showToast(characterError); return; }
      if (next.characterVersionIds.length && !next.playerCharacterVersionId) {
        showToast('请选择一个本剧本真实角色作为“我扮演谁”'); return;
      }
      try { window.SliceEvalBackend.__testing.validateInput(next); } catch (error) { showToast(error.message); return; }
      state.evalInput = next;
      state.lastRun = null;
      resetToWaiting(); renderExperience();
      $('#run-all').textContent = next.evaluationMode === 'regression' ? '运行链路回归' : '连续模拟';
      $('#input-dialog').close();
      if (next.sourceScenarioId) $('#scenario-select').value = next.sourceScenarioId;
      else ensureCustomScenarioOption(next.title);
      updatePersonaOptions(next.personaOptions, next.selectedPersona);
      renderQuickPlayerRole();
      showToast(next.sourceWorldDraftRevisionId
        ? '评测参数已保存；继续使用内置 immutable Revision'
        : '世界 Source 已修改；运行时会新建临时 immutable Revision');
    });
    $('#eval-instruction').addEventListener('input', (event) => { $('#instruction-count').textContent = `${event.target.value.length} / 2000`; });
    $('#import-run').addEventListener('click', () => $('#file-input').click());
    $('#file-input').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        const evaluation = payload.evaluation || payload;
        if (!['slice.system-eval-run.v1', 'slice.system-eval-run.v2'].includes(evaluation.schemaVersion)) {
          throw new Error('不是 Slice System Eval Run v1/v2');
        }
        applyRunResult(evaluation);
        showToast(`已载入 Experiment ${evaluation.experiment?.experimentId || '—'}`);
      } catch (error) {
        showToast(`导入失败：${error.message}`);
      }
      event.target.value = '';
    });
    $('#scenario-select').addEventListener('change', (event) => {
      if (event.target.value === 'custom') return;
      const scenario = scenarioById(event.target.value)
        || (event.target.value === FALLBACK_SCENARIO.id ? FALLBACK_SCENARIO : null);
      if (!scenario) {
        showToast('剧本库记录不存在或尚未完成导入');
        return;
      }
      loadScenario(scenario);
      showToast(`已绑定内置剧本：${scenario.title} · Current/V2 共用同一 Revision`);
    });
    $('#persona-select').addEventListener('change', (event) => {
      state.evalInput.selectedPersona = event.target.value;
      showToast(`评测视角已切换为：${event.target.value}`);
    });

    $('#minimap').addEventListener('click', (event) => {
      if (event.target.closest('.minimap-title')) return;
      const rect = $('#minimap-svg').getBoundingClientRect();
      const worldX = ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE.width;
      const worldY = ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE.height;
      state.tx = viewport.clientWidth / 2 - worldX * state.scale;
      state.ty = viewport.clientHeight / 2 - worldY * state.scale;
      applyTransform();
    });

    window.addEventListener('resize', applyTransform);
  }

  function init() {
    initializeScenarioControls();
    resetToWaiting();
    $('#auth-username').value = window.SLICE_EVAL_AUTH?.username || 'slice-eval';
    const connected = Boolean(window.SliceEvalBackend?.connected());
    $('#auth-action').textContent = connected ? '退出' : '登录';
    setHealth(connected ? '' : 'waiting', connected ? 'Shared Backend' : 'Backend', connected ? '已连接' : '未登录');
    $('#node-count').textContent = String(NODES.length);
    renderStages();
    renderNodes();
    renderConnections();
    renderInspector();
    wireEvents();
    applyTransform();
    renderExperience();
    window.SliceEvalBackend?.loadContract().catch((error) => {
      setHealth('error', 'Backend Contract', '不可用');
      showToast(`Eval API 合同不可用：${error.message || error}`);
    });
  }

  init();
})();
