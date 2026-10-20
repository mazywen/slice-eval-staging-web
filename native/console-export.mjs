// Export persisted evidence only; never rebuild prompts or execute a model.
const rows = page => Array.isArray(page) ? page : page?.items || [];

export function callsForStep(calls, steps, selected) {
  const ordered = [...steps].sort((a,b) => Date.parse(a.createdAt)-Date.parse(b.createdAt) || a.stepNo-b.stepNo);
  return calls.filter(call => {
    // A known command is authoritative, even if its completion overlaps another step.
    if (call.commandId) return call.commandId === selected.commandId;
    const time = Date.parse(call.startedAt || call.createdAt);
    let owner = ordered[0];
    for (const step of ordered) if (Date.parse(step.createdAt) <= time) owner = step;
    return owner?.stepNo === selected.stepNo;
  });
}

export async function collectConsoleExport({api, runId, scope, stepNo, onProgress = () => {}}) {
  if (!runId || !['run','step'].includes(scope)) throw Error('请选择测试局和导出范围。');
  const startedAt = new Date().toISOString();
  const [run, stepPage, callPage] = await Promise.all([
    api('evalGetRun', {runId}), api('evalListConsoleSteps', {runId}),
    api('evalListStoryEngineCalls', {runId}, undefined, {}, undefined, false),
  ]);
  const steps = rows(stepPage), allCalls = rows(callPage);
  // The current API is capped. Never label a possibly truncated list as a whole run.
  if (allCalls.length >= 2000) throw Error('调用记录达到接口 2000 条上限，无法保证完整，未生成导出文件。');
  if (steps.length >= 2000) throw Error('步骤记录达到接口 2000 条上限，无法保证完整，未生成导出文件。');
  const selected = steps.find(step => step.stepNo === stepNo);
  if (scope === 'step' && !selected) throw Error('当前轮已不存在，请刷新后重新选择。');
  const selectedSteps = scope === 'step' ? [selected] : steps;
  const calls = (scope === 'step' ? callsForStep(allCalls, steps, selected) : allCalls)
    .filter((call,index,list) => list.findIndex(row => row.callId === call.callId) === index)
    .sort((a,b) => Date.parse(a.startedAt || a.createdAt)-Date.parse(b.startedAt || b.createdAt) || a.callId.localeCompare(b.callId));
  const evidence = [], exportedCalls = [];
  for (let i=0; i<calls.length; i+=4) {
    exportedCalls.push(...await Promise.all(calls.slice(i,i+4).map(async call => {
      const detail = await api('evalGetStoryEngineCall', {runId,callId:call.callId});
      if (detail.runId !== runId || detail.callId !== call.callId) throw Error('调用原文与所选测试局不一致，已停止导出。');
      return {...call, requestJson:detail.requestJson ?? null, outputText:detail.outputText ?? null,
        availability:{request:detail.requestJson == null ? 'unavailable' : 'saved', output:detail.outputText == null ? 'unavailable' : 'saved'}};
    })));
    onProgress(exportedCalls.length, calls.length);
  }
  for (let i=0; i<selectedSteps.length; i+=4) {
    evidence.push(...await Promise.all(selectedSteps.slice(i,i+4).map(async step => {
      if (!step.commandId) return {step, command:null, outcome:null, outcomeAvailability:'no_command'};
      const params = {runId,commandId:step.commandId};
      const command = await api('evalGetWorldCommand', params);
      let outcome = null;
      if (['applied','rejected'].includes(command.status)) {
        try { outcome = await api('evalGetOutcomeByCommand', params); }
        catch (error) { if (error.status !== 404) throw error; }
      }
      return {step, command, outcome, outcomeAvailability:outcome == null ? 'unavailable' : 'saved'};
    })));
  }
  const missing = exportedCalls.filter(call => call.requestJson == null || call.outputText == null).length;
  return {
    schemaVersion:'slice.console-export.v1', scope, startedAt, exportedAt:new Date().toISOString(),
    run:{runId,worldId:run.worldId ?? null,worldVersionId:run.worldVersionId ?? null,revision:run.revision,status:run.status},
    selectedStepNo:scope === 'step' ? stepNo : null,
    coverage:{callCount:exportedCalls.length, missingRawCallCount:missing, notes:[
      '导出开始时已保存的运行调用；正在生成及稍后产生的后台调用需完成后再次导出。',
      'requestJson 是当时实际装配的请求，outputText 是模型原文；null 表示未采集或不可用，不重建历史。',
      '无 commandId 的调用在当前轮导出中按开始时间归属，属于时间推定；整局导出保留全部调用。',
      '作品发布编译及模板预览不属于本次 Run，未混入运行调用。',
    ]},
    steps:evidence, calls:exportedCalls,
  };
}

export function consoleExportFilename(pack) {
  const name = `slice-${pack.run.runId}-${pack.scope === 'step' ? `step-${pack.selectedStepNo}` : 'run'}-${pack.exportedAt}`;
  return name.replace(/[^a-zA-Z0-9._-]/g, '-') + '.json';
}
