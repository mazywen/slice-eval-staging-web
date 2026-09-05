/* Complete, digest-bound Compiler Plan presentation. All content comes from Eval Plan API. */
(function (root) {
  'use strict';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const arr = (value) => Array.isArray(value) ? value : [];
  const phases = { PROMISE: '开场承诺', INVESTMENT: '投入', COMPLICATION: '矛盾升级', REVERSAL: '反转', CRISIS: '危机', RESOLUTION: '解决', AFTERGLOW: '余韵' };
  const functions = { OPENING_HOOK: '开场钩子', BOND: '关系推进', INVESTIGATE: '调查', NEGOTIATE: '协商', PUBLIC_CHALLENGE: '公开挑战', PRIVATE_TEST: '私下试探', COMPLICATION: '矛盾升级', REVEAL: '揭示', REVERSAL: '反转', BETRAYAL: '背叛', RESCUE: '救援', REUNION: '重逢', BREAKTHROUGH: '突破', CRISIS_CHOICE: '危机抉择', AFTERMATH: '余波', RECOVERY: '恢复', ENDING_GATE: '结局条件', EPILOGUE: '尾声' };
  const visibility = { public: '公开', private: '私密', participants: '仅参与者可见' };
  const endings = { INTEGRATION: '整合', VICTORY_WITH_COST: '有代价的胜利', RENUNCIATION: '放下', RECONCILIATION: '和解', BITTERSWEET: '苦甜交织', FALSE_VICTORY: '虚假的胜利', TRAGIC_COLLAPSE: '悲剧崩塌' };
  function parse(value) { try { return JSON.parse(value); } catch { return null; } }
  function raw(label, value) { return `<details class="experience-raw"><summary>${esc(label)}</summary><pre>${esc(typeof value === 'string' ? value : JSON.stringify(value, null, 2))}</pre></details>`; }
  function facts(rows) { return `<dl class="plan-facts">${rows.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(Array.isArray(value) ? value.join('；') : value)}</dd>`).join('')}</dl>`; }
  function namesFor(input) {
    const names = new Map();
    for (const card of arr(input?.characters)) { names.set(card.characterVersionId, card.displayName); names.set(`character:${card.characterVersionId}`, card.displayName); }
    return names;
  }
  function renderTrack(result, trackCode) {
    const track = arr(result?.compiledPlans?.tracks).find((row) => row.trackCode === trackCode);
    if (!track || track.status !== 'available') return '<p class="experience-muted">完整 Plan 尚未读取。旧报告只有产物引用，不能据此还原正文。</p>';
    const plan = parse(track.planJson);
    if (plan?.schemaVersion !== 'slice.playable-world-plan.v5' || !plan.experienceSpine || !plan.agencyGraph || !Array.isArray(plan.narrativeSeeds) || !Array.isArray(plan.provenance)) return '<p class="experience-warning">Plan 正文格式无效，已停止展示。</p>';
    const names = namesFor(result.input), name = (id) => names.get(id) || id;
    const spine = plan.experienceSpine;
    const tension = spine.centralTension || {};
    return `<div class="compiled-plan"><p class="experience-muted">完整冻结 Plan · ${arr(plan.narrativeSeeds).length} 个剧情种子 · ${arr(plan.agencyGraph.actors).length} 个角色 · ${arr(spine.endingProfiles).length} 类候选结局<br>以下是可达路线与触发约束，不代表本次已发生。</p>
      <details class="plan-block" open><summary>体验主线 · Experience Spine</summary>
        ${facts([['玩家承诺', spine.playerPromise], ['开局状态', spine.startState], ['目标变化', spine.desiredChange], ['核心行动', spine.coreActions], ['主要体验回报', spine.primaryPayoffCodes], ['次要体验回报', spine.secondaryPayoffCodes], ['核心问题', tension.humanQuestion], ['拉力 A', tension.pullA], ['拉力 B', tension.pullB], ['情绪余味', tension.emotionalAftertaste], ['基调约束', spine.toneGuards], ['廉价反馈禁区', spine.cheapPayoffGuards]])}
        <h4>候选结局及证据条件</h4>${arr(spine.endingProfiles).map((ending) => `<article class="plan-entry"><strong>${esc(endings[ending.profileCode] || ending.profileCode)}</strong>${facts([['对核心冲突的回答', ending.answerToCentralTension], ['必须积累的证据', ending.requiredEvidenceFamilies], ['不可同时出现的证据', ending.incompatibleEvidenceFamilies], ['代价', ending.costShape], ['余味', ending.aftertaste], ['关联种子', ending.seedRefs]])}</article>`).join('')}
      </details>
      <details class="plan-block"><summary>角色行动与冲突 · Agency Graph</summary>
        ${arr(plan.agencyGraph.actors).map((actor) => `<article class="plan-entry"><strong>${esc(name(actor.actorRef))}</strong>${facts([['叙事功能', actor.roleCodes], ['想要什么', actor.want], ['不会越过的边界', actor.boundary], ['筹码', actor.leverage], ['需要玩家做什么', actor.needFromPlayer], ['阻力', actor.resistance], ['改变条件', actor.changeGates], ['公开与私下的差异', actor.publicPrivateDifference], ['来源', actor.sourceRefs]])}</article>`).join('')}
        ${['central', 'supporting'].map((kind) => arr(plan.agencyGraph.conflicts?.[kind]).map((conflict) => `<article class="plan-entry"><strong>${kind === 'central' ? '核心冲突' : '支线冲突'} · ${esc(conflict.conflictRef)}</strong>${facts([['相关角色', arr(conflict.actorRefs).map(name)], ['利害关系', conflict.stakes], ['对立', conflict.opposition], ['来源', conflict.sourceRefs]])}</article>`).join('')).join('')}
      </details>
      <details class="plan-block" open><summary>剧情种子与触发约束 · Narrative Seeds</summary>
        ${arr(plan.narrativeSeeds).map((seed) => `<article class="plan-entry" id="plan-${esc(trackCode)}-${esc(seed.seedId)}"><strong>${esc(functions[seed.functionCode] || seed.functionCode)} <small>${esc(seed.seedId)}</small></strong>${facts([['可用阶段', arr(seed.eligiblePhaseCodes).map((phase) => phases[phase] || phase)], ['可见范围', visibility[seed.visibility] || seed.visibility], ['参与角色', arr(seed.actorRefs).map(name)], ['角色功能', seed.actorRoleCodes], ['冲突', seed.conflictRefs], ['前置铺垫', seed.setupSeedRefs], ['允许结果', seed.outcomeBandCodes], ['允许改变', seed.stateEffectCodes], ['产生的结局证据', seed.evidenceFamilyCodes], ['种子来源', seed.sourceKind], ['来源引用', seed.sourceRefs]])}${seed.authoredHighlight ? raw('创作者高光完整定义', seed.authoredHighlight) : ''}</article>`).join('')}
      </details>
      <details class="plan-block"><summary>来源证明 · Provenance（${plan.provenance.length} 项）</summary>${plan.provenance.map((item) => `<article class="plan-entry"><strong>${esc(item.sourceRef)}</strong>${facts([['来源类型', item.sourceKind], ['来源摘要', item.sourceDigest], ['置信度', item.confidence], ['推导字段', item.derivedFieldRefs], ['替代原因', item.fallbackReason]])}</article>`).join('')}</details>
      ${raw('服务端编译开局完整配置', parse(track.openingJson))}${raw('玩家展示与目标定义', parse(track.displayJson))}${raw('WorldGameConfig 完整运行规则', parse(track.gameConfigJson))}${track.selectionTraceJson ? raw('V2 设计选择完整依据', parse(track.selectionTraceJson)) : ''}${raw('完整 Plan JSON 与校验摘要', { planDigest: track.planDigest, definitionDigest: track.definitionDigest, plan })}
    </div>`;
  }
  function seedEvidence(result, trackCode, seedRef) {
    const track = arr(result?.compiledPlans?.tracks).find((item) => item.trackCode === trackCode);
    const plan = parse(track?.planJson);
    const seed = arr(plan?.narrativeSeeds).find((item) => item.seedId === seedRef);
    if (!seed) return '';
    return `<p class="experience-muted">对应编译种子：<a href="#plan-${esc(trackCode)}-${esc(seedRef)}">${esc(seedRef)}</a> · ${esc(arr(seed.eligiblePhaseCodes).map((phase) => phases[phase] || phase).join(' / '))} · ${esc(visibility[seed.visibility] || seed.visibility)}</p>`;
  }
  const api = Object.freeze({ renderTrack, seedEvidence, parse });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SliceCompiledPlanView = api;
})(typeof window !== 'undefined' ? window : globalThis);
