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
    if (cards.length !== 1) return '<section class="panel"><p class="notice">尚未读取到服务端本次单张完整天赋卡。请刷新后继续。</p></section>';
    return '<section class="panel"><div class="section-heading"><h3>确认这一次的天赋</h3>'
      + '<span class="badge">首次免费 · 单张完整卡</span></div>'
      + '<p class="muted">本局首次完整卡由服务端固定；确认后应用三项能力并生成首章和今日日程。后续付费抽取与能力替换等待价格配置。</p>'
      + strategyField(result.plannerStrategy || 'guided', locked)
      + '<div class="mainline-talent-grid">' + cards.map(card =>
        '<article class="entity-card"><div class="section-heading"><h3>' + esc(card.title) + '</h3>'
        + '<span class="badge">' + esc(card.rarity) + '</span></div>'
        + arr(card.skills).map(skill => '<p>' + esc(skill.name) + ' <strong>' + esc(skill.value) + '</strong> / 100</p>').join('')
        + '<button class="button primary" type="button" data-confirm-talent="' + esc(card.choiceId) + '"'
        + disabled(locked) + '>采用这张</button></article>').join('') + '</div></section>';
  }
  function suggestions(result, locked = false, location = 'feed', job = null) {
    const state = current(result);
    const run = result?.finalProjections?.current?.run?.value;
    if (location === 'opening' || result?.opening?.current?.status !== 'applied'
      || !job || !['playing', 'epilogue'].includes(state?.phase) || locked || !canPost(result)) return '';
    if (job.runId !== run?.runId || job.sourceRevision !== run?.revision) return '';
    if (job.status === 'failed' || job.status === 'stale') return '<p class="muted" role="status">'
      + (job.status === 'stale' ? '剧情已更新，请刷新后重新打开草稿。' : '建议暂未生成，你可以直接写帖子。') + '</p>';
    if (job.status !== 'ready') return '<p class="muted" role="status">正在准备你的下一条发帖草稿，你可以先自己写。</p>';
    const rows = arr(job.suggestedInputs);
    return rows.length === 3 ? '<div class="mainline-suggestions"><small>下一条动态可以怎么说？选一句填入后再修改</small>'
      + rows.map((text, index) => '<button class="button" type="button" data-mainline-suggestion="'
        + index + '" data-suggestion-location="' + location + '"'
        + '>' + esc(text) + '</button>').join('') + '</div>' : '';
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
  function shortInteraction(result, locked = false, speakerName = '人物') {
    const state = current(result), card = state?.shortInteraction;
    if (state?.phase !== 'playing' || !card?.id || !card.description || arr(card.options).length !== 3) return '';
    return '<section class="panel" aria-label="短互动邀请"><h3>' + esc(speakerName) + '邀请你回应</h3><p>'
      + esc(card.description) + '</p><div class="mainline-suggestions">'
      + card.options.map((option, index) => '<button type="button" class="button" data-short-interaction="'
        + esc(card.id) + '" data-interaction-option="' + index + '"' + disabled(locked) + '>'
        + esc(option) + '</button>').join('') + '</div><small>选择后继续这段互动，不消耗公开发帖次数。</small></section>';
  }
  function chapterDetails(result) {
    const state = current(result);
    if (!state) return '';
    const chapter = state.activeChapter;
    const grade = { perfect: '完美通过', partial: '勉强通过', bad_ending: 'Bad Ending' }[state.settlementGrade];
    const resultCard = grade ? '<p class="notice" data-settlement-grade="' + esc(state.settlementGrade) + '">上次章节结算：' + grade + '</p>' : '';
    if (!chapter || state.phase === 'failed') return resultCard;
    return resultCard + '<section class="mainline-conditions"><h3>' + esc(chapter.title) + '</h3><p>'
      + esc(chapter.narrativeObjective) + '</p>'
      + arr(chapter.conditions).map(condition => {
        const progress = state.conditionState?.[condition.id];
        return '<article class="entity-card"><strong>' + esc(condition.label) + '</strong><p>'
          + (condition.kind === 'fact' && progress?.status !== 'settled' ? '待章末验收'
            : progress?.satisfied ? '已达成' : '尚未达成')
          + (condition.kind === 'numeric' ? ' · 当前 ' + esc(progress?.currentValue ?? '未采集')
            + ' / 要求 ' + (condition.operator === 'gte' ? '至少 ' : '至多 ') + esc(condition.threshold) : '')
          + '</p></article>';
      }).join('') + '<p class="muted">本章条件已固定。数值按实际状态检查；语义只在你发起章末验收时判断。数值通过一定过章，语义决定通过质量。</p></section>';
  }
  function growthPanel(result, locked = false) {
    const state = current(result);
    if (!state) return '';
    const wallet = state.experience;
    if (!wallet) return '<p class="notice">经验余额未采集，请读取新版后端结果。</p>';
    const skills = arr(projection(result, 'stats')?.skills);
    const price = state.policy.xpPerAbilityPoint;
    return '<section class="panel mainline-growth"><h3>经验与能力</h3><p>累计获得 '
      + esc(wallet.earned) + ' · 已消费 ' + esc(wallet.spent) + ' · 可用 <strong>' + esc(wallet.available)
      + '</strong></p><p class="muted">能力升级由后端执行；消费经验不倒扣等级或重新锁定人物。</p>'
      + skills.map(skill => '<article class="entity-card"><strong>' + esc(skill.name) + ' ' + esc(skill.value)
        + ' / 100</strong> <button type="button" class="button small" data-allocate-skill="' + esc(skill.skillId) + '"'
        + disabled(locked || state.phase !== 'playing' || !Number.isFinite(price) || wallet.available < price || skill.value >= 100)
        + '>消耗 ' + esc(price ?? '未采集') + ' 经验 · 提升 1 点</button></article>').join('') + '</section>';
  }
  function numericSettlement(receipt) {
    if (!receipt || !['committed', 'local_pending'].includes(receipt.status)) {
      return '<section class="panel"><h3>本轮数值与经验</h3><p class="muted">未采集正式结算，不能把缺失数据当成零变化。</p></section>';
    }
    const n = value => Number.isFinite(value) ? esc(value) : '未采集';
    const signed = value => Number.isFinite(value) ? (value > 0 ? '+' : '') + esc(value) : '未采集';
    const experience = receipt.experience || {};
    const axes = { affinity: '亲密', trust: '信任', respect: '认可' };
    const numericRows = [...arr(receipt.abilities).map(row => ({ ...row, label: row.name || row.code })),
      ...arr(receipt.worldStats).map(row => ({ ...row, label: row.name || row.code })),
      ...arr(receipt.relationships).flatMap(edge => arr(edge.changes).filter(row => axes[row.axis])
        .map(row => ({ ...row, label: String(edge.fromActorId) + ' → ' + String(edge.toActorId) + ' · ' + axes[row.axis] })))];
    return '<section class="panel" data-numeric-status="' + esc(receipt.status) + '"><h3>本轮数值与经验</h3>'
      + (receipt.status === 'local_pending' ? '<p class="notice">活动内暂存：尚未结算到主线，也未提前发放经验。</p>' : '<p class="muted">以下来自后端已提交结果，不是模型建议。</p>')
      + '<p>本轮获得 <strong>' + signed(experience.gained) + '</strong> · 本轮消费 <strong>' + n(experience.spent)
      + '</strong> · 可用经验 <strong>' + n(experience.available) + '</strong></p>'
      + '<p class="muted">累计获得 ' + n(experience.totalEarned) + ' · 累计消费 ' + n(experience.totalSpent) + '</p>'
      + (numericRows.length ? '<div class="story-review-table"><table><thead><tr><th>变化项</th><th>之前</th><th>之后</th><th>变化</th></tr></thead><tbody>'
        + numericRows.map(row => '<tr><td>' + esc(row.label) + '</td><td>' + n(row.before) + '</td><td>' + n(row.after)
          + '</td><td>' + signed(row.delta) + '</td></tr>').join('') + '</tbody></table></div>'
        : '<p class="muted">本次没有已提交的能力、世界数值或关系变化。</p>')
      + (arr(receipt.characterSlots).length ? '<p>本轮开放人物槽位：' + arr(receipt.characterSlots).map(row => esc(row.ordinal)).join('、') + '</p>' : '')
      + '</section>';
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
    suggestions, dayCard, shortInteraction, chapterDetails, growthPanel, numericSettlement, journey });
})(typeof window === 'undefined' ? globalThis : window);
