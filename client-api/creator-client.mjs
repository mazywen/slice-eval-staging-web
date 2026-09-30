import { operations, definitions } from './creator-network-shape.mjs';
export function validate(value, schema, path = '$') {
  if (typeof schema === 'string') schema = definitions[schema];
  if (!schema) throw Error(`未找到字段合同：${path}`);
  if (schema.$ref) return validate(value, definitions[schema.$ref.split('/').pop()], path);
  for (const union of ['anyOf', 'oneOf']) if (schema[union]) {
    const matches = schema[union].filter(s => { try { validate(value, s, path); return true; } catch { return false; } });
    if (matches.length < 1 || (union === 'oneOf' && matches.length !== 1)) throw Error(`${path} 格式不符合要求`);
    return;
  }
  if ('const' in schema && value !== schema.const) throw Error(`${path} 必须为 ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) throw Error(`${path} 可选值：${schema.enum.join('、')}`);
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && !(schema.type === 'integer' ? Number.isInteger(value) : type === schema.type)) throw Error(`${path} 类型必须为 ${schema.type}`);
  if (type === 'object') {
    for (const key of schema.required || []) if (!(key in value)) throw Error(`${path}.${key} 缺失`);
    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) validate(item, schema.properties[key], `${path}.${key}`);
      else if (schema.additionalProperties === false) throw Error(`${path}.${key} 不是支持的字段`);
    }
  }
  if (type === 'array') {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) throw Error(`${path} 数量超出范围`);
    if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) throw Error(`${path} 含重复项`);
    value.forEach((v,i) => schema.items && validate(v,schema.items,`${path}[${i}]`));
  }
  if (type === 'string') {
    if ([...value].length < (schema.minLength ?? 0) || [...value].length > (schema.maxLength ?? Infinity)) throw Error(`${path} 长度应为 ${schema.minLength ?? 0}–${schema.maxLength ?? '不限'} 字`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) throw Error(`${path} 格式错误`);
  }
  if (type === 'number' && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) throw Error(`${path} 数值超出范围`);
}
export async function digest(value) {
  const data = value instanceof ArrayBuffer ? value : new TextEncoder().encode(JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function createCreatorClient({ fetcher = fetch, ensureSession = globalThis.sliceEnsureCreatorStudioSession, cookie = () => document.cookie } = {}) {
  return async function call(operation, params = {}, body, key) {
    const route = operations[operation];
    if (!route) throw Error('未知的创作操作');
    if (route.requestType) validate(body, route.requestType);
    let path = route.routePath.replace(/\{([^}]+)\}/g, (_,name) => {
      if (!params[name]) throw Error(`缺少 ${name}`);
      return encodeURIComponent(params[name]);
    });
    const mutation = route.httpMethod !== 'GET';
    const idempotency = mutation ? key || `creator:${await digest([operation, params, body])}` : null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers = { accept: 'application/json' };
      const player = route.authClass === 'playerCookie';
      const cookieName = player ? '__Host-SlicePlayerWebCsrf' : '__Host-SliceCreatorStudioCsrf';
      const part = cookie().split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='));
      if(player){headers['x-slice-player-origin']=location.origin;if(part)headers['x-slice-player-csrf']=decodeURIComponent(part.slice(part.indexOf('=')+1));}
      if (mutation) {
        headers['content-type'] = 'application/json'; headers['idempotency-key'] = idempotency;
        if (part && !player) headers['x-slice-studio-csrf'] = decodeURIComponent(part.slice(part.indexOf('=')+1));
        if (!part && player) { const error=Error('请先登录 App。');error.status=401;throw error; }
        if (!part && attempt === 0) { if (await ensureSession() !== 'ready') throw Error('登录已到期，请重新登录后继续。当前输入仍保留。'); continue; }
      }
      let response;
      try { response = await fetcher(path, {method:route.httpMethod,headers,body:body === undefined ? undefined : JSON.stringify(body),credentials:'include',cache:'no-store',redirect:route.responseTransport==='surface_cookie_redirect'?'manual':'error',signal:AbortSignal.timeout(30000)}); }
      catch { throw Error('网络未返回确认结果，请保留页面后重试同一操作。'); }
      if (route.responseTransport==='surface_cookie_redirect' && (response.type==='opaqueredirect'||response.status===303)) return null;
      if (response.status === 401 && player) { const error=Error('App 登录已到期，请重新登录 App。');error.status=401;throw error;}
      if (response.status === 401 && attempt === 0) { if (await ensureSession() !== 'ready') throw Error('登录已到期，请登录原账号继续。输入与任务已保留。'); continue; }
      const data = await response.json().catch(()=>null);
      if (!response.ok) {
        const code=data?.error?.code||data?.code||`HTTP_${response.status}`;
        const conflict=['SLICE_DRAFT_REVISION_CONFLICT','SLICE_REVISION_CONFLICT'].includes(code);
        const error = Error(conflict ? '内容已在其他页面更新。请导出当前内容后重新打开，避免覆盖。' : `${code}：${data?.error?.message || data?.message || '操作未完成，请稍后重试。'}`);
        error.status = response.status; error.details = data; throw error;
      }
      if (route.responseType) validate(data, route.responseType);
      return data;
    }
    throw Error('无法恢复登录，请保留当前页面。');
  };
}
