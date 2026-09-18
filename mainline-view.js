/* Pure presentation of authoritative mainline state. No game simulation. */
(function (root) {
  'use strict';
  const POLICY = 'slice-mainline-first-test-2026-09-18';
  const arr = value => Array.isArray(value) ? value : [];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const disabled = value => value ? ' disabled' : '';

  function projection(result, name) {
    const row = result?.finalProjections?.current?.[name];
    return row?.status === 'succeeded' ? row.value : null;
  }
  function opening(result) {
    return projection(result, 'run')?.opening || result?.previewRuns?.current?.opening || {};
  }
  function current(result) {
    const chapter = projection(result, 'chapter');
    const state = chapter?.mainline;
    // MainlinePlayerProjection is the public, POV-filtered Network Shape.
    // Preserve its nested policy / activeChapter; never manufacture defaults
    // from the old flat draft or inspect the private Runtime aggregate.
    return state?.version === '2026-09-18' && state?.policy?.version === POLICY ? state : null;
  }
  function isLatest(result) {
    return opening(result).mainlineVersion === '2026-09-18' || Boolean(current(result));
  }
  function preparing(result) {
    return current(result)?.phase === 'planning' || projection(result, 'chapter')?.status === 'planning';
  }
  function canPost(result) {
    const state = current(result);
    return Boolean(state && ['playing', 'epilogue'].includes(state.phase)
      && state.postsToday < state.policy.postsPerDay);
  }
  function canContinue(result) {
    const state = current(result);
    return Boolean(state && ['playing', 'epilogue'].includes(state.phase));
  }
  function canAdvance(result) {
    const state = current(result);
    return Boolean(state && ['playing', 'epilogue'].includes(state.phase)
      && state.canAdvanceDay === true);
  }
  function readyForFirstPost(result) {
    return opening(result).generationStatus === 'ready' && !preparing(result)
      && (!isLatest(result) || Boolean(current(result)?.phase === 'playing'));
  }
  function strategyField(value = 'guided', locked = false) {
    return '<label>当前章编译方式<select id="planner-strategy"' + disabled(locked) + '>'
      + '<option value="guided"' + (value === 'guided' ? ' selected' : '') + '>融合：当前章按需参考叙事规则</option>'
      + '<option value="baseline"' + (value === 'baseline' ? ' selected' : '') + '>基线：当前章直接生成</option>'
      + '</select><small>两种方式都不提前写未来章节。同一份作品可分别开局比较。</small></label>';
  }
  function talentPanel(result, locked = false) {
    const state = current(result);
    if (state?.phase !== 'awaiting_talent' || preparing(result)) return '';
    const birth = opening(result);
    if (birth.generationStatus !== 'ready') return '';
    const cards = arr(state.talentCandidates);
    if (!cards.length) return '<section class="panel"><p class="notice">尚未读取到服务端能力候选。请刷新；页面不会自行抽取或伪造候选。</p></section>';
    return '<section class="panel"><div class="section-heading"><h3>选择这一次的能力配置</h3>'
      + '<span class="badge">首测配置 · 非付费抽卡验收</span></div>'
      + '<p class="muted">候选由服务端固定；选择后才结合当前能力生成首章和今日安排。</p>'
      + strategyField(result.plannerStrategy || 'guided', locked)
      + '<div class="mainline-talent-grid">' + cards.map(card =>
        '<article class="entity-card"><div class="section-heading"><h3>' + esc(card.title) + '</h3>'
        + '<span class="badge">' + esc(card.rarity) + '</span></div>'
        + arr(card.skills).map(skill => '<p>' + esc(skill.name) + ' <strong>' + esc(skill.value) + '</strong> / 100</p>').join('')
        + '<button class="button primary" type="button" data-confirm-talent="' + esc(card.choiceId) + '"'
        + disabled(locked) + '>采用这张</button></article>').join('') + '</div></section>';
  }
  function suggestions(result, locked = false, location = 'feed') {
    const state = current(result);
    const rows = arr(state?.activeChapter?.suggestedInputs);
    // A first post has its own editable draft. Quick fills start after it is committed.
    if (location === 'opening' || result?.opening?.current?.status !== 'applied'
      || !rows.length || state.phase !== 'playing') return '';
    return '<div class="mainline-suggestions"><small>不知道发什么？选一句填入草稿</small>'
      + rows.map((text, index) => '<button class="button" type="button" data-mainline-suggestion="'
        + index + '" data-suggestion-location="' + location + '"' + disabled(locked || !canPost(result))
        + '>' + esc(text) + '</button>').join('') + '</div>';
  }
  function dayCard(result, locked = false) {
    if (!isLatest(result) && !preparing(result)) return '';
    if (preparing(result)) return '<section class="panel mainline-day"><h3>正在准备当前阶段</h3>'
      + '<p class="muted">保留已完成的结果，等待后台交付本章或今日安排。刷新只读取原任务。</p></section>';
    const state = current(result);
    if (!state || state.phase === 'awaiting_talent') return '';
    if (state.phase === 'failed') return '<section class="panel mainline-day"><h3>这一章，到这里结束</h3>'
      + '<p>你可以回到已有回溯点重新选择，或者退出当前局。</p>'
      + '<p class="muted">回溯入口只有在服务端提供可恢复节点时开放；本页不会用重新生成冒充恢复。</p></section>';
    const chapter = state.activeChapter;
    const day = chapter?.dayCard;
    return '<section id="today-schedule" aria-label="今日安排" class="panel mainline-day"><div class="section-heading"><div><small class="eyebrow">今日安排</small>'
      + '<span class="eyebrow">第 ' + esc(state.day) + ' 天' + (chapter ? ' · 第 ' + esc(chapter.ordinal) + ' 章' : ' · 故事之后')
      + '</span><h3>' + esc(day?.title || (chapter ? '今日安排尚未返回' : '继续你的故事')) + '</h3></div>'
      + '<span class="badge">今日公开行动 ' + esc(state.postsToday) + ' / ' + esc(state.policy.postsPerDay) + '</span></div>'
      + (day?.description ? '<p>' + esc(day.description) + '</p>' : '')
      + (day?.focus ? '<p class="muted">' + esc(day.focus) + '</p>' : '')
      + '<div class="inline-controls"><button class="button" type="button" id="advance-day"'
      + disabled(locked || !canAdvance(result)) + '>进入下一日</button>'
      + '<small>公开行动用完后手动推进；评论与私聊不消耗次数。</small></div></section>';
  }
  function chapterDetails(result) {
    const state = current(result);
    if (!state) return '';
    const chapter = state.activeChapter;
    if (!chapter || state.phase === 'failed') return '';
    return '<section class="mainline-conditions"><h3>' + esc(chapter.title) + '</h3><p>'
      + esc(chapter.narrativeObjective) + '</p>'
      + arr(chapter.conditions).map(condition => {
        const progress = state.conditionState?.[condition.id];
        return '<article class="entity-card"><strong>' + esc(condition.label) + '</strong><p>'
          + (progress?.satisfied ? '已达成' : '尚未达成')
          + (condition.kind === 'numeric' ? ' · 当前 ' + esc(progress?.currentValue ?? '未采集')
            + ' / 要求 ' + (condition.operator === 'gte' ? '至少 ' : '至多 ') + esc(condition.threshold) : '')
          + '</p></article>';
      }).join('') + '<p class="muted">条件随实际行动更新，章末才正式结算。</p></section>';
  }
  function journey(result) {
    const birth = opening(result), state = current(result);
    const first = result?.opening?.current?.status === 'applied';
    const steps = [
      ['世界基础', Boolean(result?.compiledPlans)], ['选择身份', Boolean(result?.previewRuns?.current?.runId)],
      ['出生内容', birth.generationStatus === 'ready'], ['能力与首章', Boolean(state?.activeChapter || state?.phase === 'epilogue')],
      ['首条动态', first], ['逐日与章末', arr(state?.completedChapters).length > 0],
    ];
    return '<nav class="mainline-journey" aria-label="游玩流程">' + steps.map(([label, done], index) =>
      '<span class="' + (done ? 'done' : '') + '"><small>' + String(index + 1).padStart(2, '0')
      + '</small>' + esc(label) + (done ? ' ✓' : '') + '</span>').join('') + '</nav>';
  }
  root.SliceMainlineView = Object.freeze({ POLICY, current, opening, isLatest, preparing,
    canPost, canContinue, canAdvance, readyForFirstPost, strategyField, talentPanel,
    suggestions, dayCard, chapterDetails, journey });
})(typeof window === 'undefined' ? globalThis : window);
