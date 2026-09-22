/* Author-only compilation review. Never used by player projections. */
(function(root) {
  'use strict';
  const MAX=20;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function compiled(result) {
    const track=result?.compiledPlans?.tracks?.find(row=>row.trackCode==='current');
    if(!track?.planJson)return null;
    const base=JSON.parse(track.planJson);
    return base.worldFacts ? {bundle:clone(base.worldFacts),confirmed:base.worldFactsConfirmed===true} : null;
  }
  function add(bundle) {
    if(bundle.facts.length>=MAX)throw new Error('世界事实最多 20 条，请先合并或删除条目');
    let n=1;while(bundle.facts.some(row=>row.id==='fact_'+n))n++;
    bundle.facts.push({id:'fact_'+n,statement:'',visibility:'secret',characterVersionIds:[],knownByCharacterVersionIds:[],discovery:'',consequence:'',dependsOn:[]});
  }
  function remove(bundle,id) {
    const dependent=bundle.facts.filter(row=>(row.dependsOn||[]).includes(id));
    if(dependent.length)throw new Error('其他事实仍依赖这一条：'+dependent.map(row=>row.statement || '未填写的事实').join('、')+'。请先修改关联。');
    bundle.facts=bundle.facts.filter(row=>row.id!==id);
  }
  function render(bundle,characters=[],busy=false) {
    if(!bundle)return '';
    const disabled=busy?' disabled':'';
    const options=(selected)=>characters.map(row=>'<option value="'+esc(row.characterVersionId)+'"'+(selected.includes(row.characterVersionId)?' selected':'')+'>'+esc(row.displayName||row.characterVersionId)+'</option>').join('');
    const field=(row,key,label,max)=>'<label>'+label+'<textarea data-fact-id="'+esc(row.id)+'" data-fact-field="'+key+'" maxlength="'+max+'" rows="2"'+disabled+'>'+esc(row[key])+'</textarea></label>';
    return '<section class="form-section" id="world-facts-editor"><div class="section-heading"><h3>世界事实 <small>'+bundle.facts.length+' / '+MAX+'</small></h3></div><p class="notice">AI 已综合世界背景与全部人物，生成约 10 条事实。你可以修改、删除或添加；秘密不会直接展示给玩家。确认后按这份内容固定，不会再次抽取真相。</p>'+
      bundle.facts.map((row,index)=>'<article class="panel"><div class="section-heading"><strong>事实 '+(index+1)+'</strong><button type="button" data-remove-fact="'+esc(row.id)+'" class="text-button"'+disabled+'>删除</button></div>'+field(row,'statement','事实内容',400)+
        '<label>可见范围<select data-fact-id="'+esc(row.id)+'" data-fact-field="visibility"'+disabled+'><option value="public"'+(row.visibility==='public'?' selected':'')+'>公开事实</option><option value="secret"'+(row.visibility==='secret'?' selected':'')+'>隐藏秘密</option></select></label>'+
        '<details><summary>涉及人物、知情与剧情影响</summary><label>涉及人物（可多选）<select multiple data-fact-id="'+esc(row.id)+'" data-fact-field="characterVersionIds"'+disabled+'>'+options(row.characterVersionIds||[])+'</select></label>'+
        '<label>秘密的初始知情者（不选表示无人知道）<select multiple data-fact-id="'+esc(row.id)+'" data-fact-field="knownByCharacterVersionIds"'+disabled+'>'+options(row.knownByCharacterVersionIds||[])+'</select></label>'+field(row,'discovery','可能怎样被发现',400)+field(row,'consequence','揭露可能造成什么影响',400)+
        '<label>这条事实依赖哪些其他事实<select multiple data-fact-id="'+esc(row.id)+'" data-fact-field="dependsOn"'+disabled+'>'+bundle.facts.filter(other=>other.id!==row.id).map(other=>'<option value="'+esc(other.id)+'"'+((row.dependsOn||[]).includes(other.id)?' selected':'')+'>'+esc(other.statement||'未填写的事实')+'</option>').join('')+'</select></label></details></article>').join('')+
      '<button class="button" id="add-world-fact" type="button"'+(busy||bundle.facts.length>=MAX?' disabled':'')+'>＋ 添加事实</button><label>剧情大纲<textarea data-facts-outline rows="4" maxlength="1600"'+disabled+'>'+esc(bundle.storyOutline)+'</textarea></label>'+
      '<details><summary>检查玩家可见的背景与剧情引导</summary>'+['background','environment','storyGuide'].map((key,i)=>'<label>'+['公开背景','公开环境','不剧透的剧情引导'][i]+'<textarea data-facts-public="'+key+'" rows="3" maxlength="'+(i===2?1600:2000)+'"'+disabled+'>'+esc(bundle.publicContext[key])+'</textarea></label>').join('')+'</details><button class="button primary" id="confirm-world-facts" type="button"'+disabled+'>确认这些事实并继续</button></section>';
  }
  function capture(bundle,element) {
    const value=clone(bundle);
    for(const node of element.querySelectorAll('[data-fact-field]')) {
      const row=value.facts.find(row=>row.id===node.dataset.factId);if(!row)continue;
      const key=node.dataset.factField;
      row[key]=node.multiple ? [...node.selectedOptions].map(option=>option.value) : key==='dependsOn' ? node.value.split(/[,，]/).map(s=>s.trim()).filter(Boolean) : node.value;
    }
    for(const row of value.facts)if(row.visibility==='public')row.knownByCharacterVersionIds=[];
    const outline=element.querySelector('[data-facts-outline]');if(outline)value.storyOutline=outline.value;
    for(const node of element.querySelectorAll('[data-facts-public]'))value.publicContext[node.dataset.factsPublic]=node.value;
    return value;
  }
  const api={MAX,compiled,add,remove,render,capture};
  if(typeof module==='object')module.exports=api;else root.SliceWorldFactsEditor=api;
})(typeof window==='object'?window:globalThis);
