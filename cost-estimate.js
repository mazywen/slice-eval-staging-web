/* Token-based estimates; deliberately separate from the server billing ledger. */
(function (root) {
  'use strict';
  const PRICING = Object.freeze({
    checkedAt: '2026-09-05', effectiveFrom: '2026-08-17T00:00:00+08:00', currency: 'CNY',
    source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
    unitTokens: 1000000,
    models: Object.freeze({
      'deepseek-v4-pro': Object.freeze({ inputMiss: 4.5, inputHit: 0.15, output: 13.5, peakMultiplier: 2 }),
      'deepseek-v4-flash': Object.freeze({ inputMiss: 1.5, inputHit: 0.05, output: 4.5, peakMultiplier: 2 }),
      'deepseek-v4-flash-vision-exp': Object.freeze({ inputMiss: 1.5, inputHit: 0.05, output: 4.5, peakMultiplier: 2 }),
    }),
  });
  const list = (value) => Array.isArray(value) ? value : [];
  const token = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
  function deduplicate(calls) {
    const seen = new Set();
    return list(calls).filter((call) => { if (!call) return false; if (!call.callRef) return true; if (seen.has(call.callRef)) return false; seen.add(call.callRef); return true; });
  }
  function estimateCalls(calls) {
    const rows = deduplicate(calls);
    let inputTokens = 0, outputTokens = 0, offPeakCny = 0, peakCny = 0, lowerBoundCny = 0, pricedCalls = 0, cacheUnknownCalls = 0;
    const unpriced = [], models = new Set();
    for (const call of rows) {
      const rate = String(call.modelProvider || '').toLowerCase() === 'deepseek' ? PRICING.models[call.model] : null;
      const input = token(call.inputTokens), output = token(call.outputTokens);
      if (!rate || input === null || output === null) { unpriced.push({ callRef: call.callRef || null, model: call.model || null, reason: !rate ? 'price_not_verified' : 'usage_not_returned' }); continue; }
      pricedCalls += 1; models.add(call.model); inputTokens += input; outputTokens += output;
      const reportedHit = token(call.cacheHitInputTokens ?? call.promptCacheHitTokens);
      const hit = reportedHit !== null && reportedHit <= input ? reportedHit : null;
      if (hit === null) cacheUnknownCalls += 1;
      const conservative = ((input - (hit || 0)) * rate.inputMiss + (hit || 0) * rate.inputHit + output * rate.output) / PRICING.unitTokens;
      offPeakCny += conservative; peakCny += conservative * rate.peakMultiplier;
      lowerBoundCny += hit === null ? (input * rate.inputHit + output * rate.output) / PRICING.unitTokens : conservative;
    }
    return {
      pricingVersion: `deepseek-cny-${PRICING.checkedAt}`, currency: 'CNY', totalCalls: rows.length, pricedCalls,
      inputTokens: pricedCalls ? inputTokens : null, outputTokens: pricedCalls ? outputTokens : null,
      offPeakCny: pricedCalls ? offPeakCny : null, peakCny: pricedCalls ? peakCny : null,
      lowerBoundCny: pricedCalls ? lowerBoundCny : null,
      cacheUnknownCalls, unpriced, models: [...models], complete: rows.length > 0 && unpriced.length === 0,
      basis: 'Official CNY list price. When cache detail is absent, offPeak/peak assume all input is cache-miss; lowerBound assumes all input is cache-hit. Not a provider invoice.',
    };
  }
  function callsForTrack(result, trackCode) {
    const key = trackCode === 'current' ? 'current' : 'v2Candidate';
    const trace = list(result?.trace?.tracks).find((item) => item.trackCode === trackCode);
    const allCommands = list(trace?.runtimeCommands);
    const runId = result?.previewRuns?.[key]?.runId;
    const ids = new Set([result?.opening?.[key], ...list(result?.turns).map((turn) => turn?.[key])].map((execution) => execution?.command?.commandId || execution?.accepted?.commandId).filter(Boolean));
    const commands = allCommands.filter((command) => command.runId && runId ? command.runId === runId : ids.has(command.commandId));
    const runtimeRefs = new Set(allCommands.flatMap((command) => list(command.aiCalls)).map((call) => call.callRef));
    return deduplicate([...list(trace?.aiCalls).filter((call) => !runtimeRefs.has(call.callRef)), ...commands.flatMap((command) => list(command.aiCalls))]);
  }
  function estimateRun(result, assumedTurns = 20) {
    const tracks = [], experimentCalls = [];
    for (const [code, key] of [['current', 'current'], ['v2_candidate', 'v2Candidate']]) {
      const trace = list(result?.trace?.tracks).find((item) => item.trackCode === code);
      const allCommands = list(trace?.runtimeCommands);
      const selectedRunId = result?.previewRuns?.[key]?.runId;
      const acceptedIds = new Set([result?.opening?.[key], ...list(result?.turns).map((turn) => turn?.[key])]
        .map((execution) => execution?.command?.commandId || execution?.accepted?.commandId).filter(Boolean));
      const commands = allCommands.filter((command) => selectedRunId ? command.runId === selectedRunId : acceptedIds.has(command.commandId));
      const runtimeRefs = new Set(allCommands.flatMap((command) => list(command.aiCalls)).map((call) => call.callRef));
      const compileCalls = list(trace?.aiCalls).filter((call) => !runtimeRefs.has(call.callRef));
      const compile = estimateCalls(compileCalls);
      const openingId = result?.opening?.[key]?.command?.commandId || result?.opening?.[key]?.accepted?.commandId;
      const opening = estimateCalls(commands.filter((command) => command.commandId === openingId).flatMap((command) => list(command.aiCalls)));
      const turnIds = new Set(list(result?.turns).map((turn) => turn?.[key]?.command?.commandId || turn?.[key]?.accepted?.commandId).filter(Boolean));
      const interaction = estimateCalls(commands.filter((command) => turnIds.has(command.commandId)).flatMap((command) => list(command.aiCalls)));
      const runtime = estimateCalls(commands.flatMap((command) => list(command.aiCalls)));
      const observedTurns = list(result?.turns).filter((turn) => turn?.[key]?.status === 'applied').length;
      const selectedCalls = [...compileCalls, ...commands.flatMap((command) => list(command.aiCalls))];
      experimentCalls.push(...selectedCalls);
      const total = { ...estimateCalls(selectedCalls), compilationUsageMissing: compile.totalCalls === 0 };
      const projection = observedTurns > 0 && opening.offPeakCny !== null && interaction.offPeakCny !== null && interaction.complete
        ? { assumedTurns, observedTurns, offPeakCny: opening.offPeakCny + interaction.offPeakCny / observedTurns * assumedTurns,
          peakCny: opening.peakCny + interaction.peakCny / observedTurns * assumedTurns,
          compileExcluded: true, assumption: 'Linear extrapolation from observed turns; longer contexts, retries, different DM/scene mixes and ending length change the actual cost.' } : null;
      tracks.push({ trackCode: code, observedTurns, compile, opening, interaction, runtime, total, projection });
    }
    return { pricing: PRICING, tracks, experimentTotal: estimateCalls(experimentCalls),
      excludes: ['cloud hosting', 'database', 'storage', 'non-returned provider usage', 'payment fees', 'tax adjustments'], isEstimate: true };
  }
  function money(value) { return typeof value === 'number' && Number.isFinite(value) ? `¥${value.toFixed(4)}` : '待 Usage'; }
  function render(result, selectedCodes = ['current', 'v2_candidate']) {
    const estimate = estimateRun(result);
    const rows = estimate.tracks.filter((track) => selectedCodes.includes(track.trackCode));
    return `<section class="experience-cost"><h3>人民币 Token 成本预估</h3><p>以 ${PRICING.checkedAt} 核对的官方人民币价计算。缺少缓存明细时按全部未命中计价；显示空闲 / 高峰两档，不是实际账单。</p><div class="experience-table-wrap"><table><thead><tr><th>轨道</th><th>一次编译</th><th>开局</th><th>互动 ${list(result.turns).length} 轮</th><th>已观测合计</th><th>复用编译后每局</th></tr></thead><tbody>${rows.map((track) => `<tr><th>${track.trackCode === 'current' ? 'Current' : 'V2'}</th>${[track.compile, track.opening, track.interaction, track.total, track.runtime].map((cost) => `<td>${money(cost.offPeakCny)}<small>高峰 ${money(cost.peakCny)}${cost.unpriced.length ? ' · 部分调用未定价' : ''}</small></td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.map((track) => track.projection ? `<p>${track.trackCode === 'current' ? 'Current' : 'V2'} · 若一局含 ${track.projection.assumedTurns} 轮、结构接近这 ${track.observedTurns} 轮：复用编译后约 ${money(track.projection.offPeakCny)}–${money(track.projection.peakCny)}。这是线性外推，不是已跑到结局的费用。</p>` : '').join('')}<small>没有编译 Usage 时，编译费用保持未知，不能把“已观测合计”理解为包含首次编译的全成本。公式：（未命中输入 × 输入单价 + 命中输入 × 缓存单价 + 输出 × 输出单价）÷ 1,000,000。缓存全部命中的理论下限、模型单价与缺失项保留在导出数据中。未包含服务器、数据库和存储费用。</small></section>`;
  }
  const api = Object.freeze({ PRICING, estimateCalls, estimateRun, callsForTrack, render, money });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SliceCostEstimate = api;
})(typeof window !== 'undefined' ? window : globalThis);
