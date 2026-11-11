const api=window.rynova;
let panel='',state={};
const el=document.getElementById('panel');
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function setPanel(name){api.send('panel-set',name);}
function render(){
  if(!panel){el.replaceChildren();return;}
  let h='<div class="panel-heading"><div class="panel-title">'+
  esc(panel[0].toUpperCase()+panel.slice(1))+
  '</div><button id="close-panel" title="Close panel" aria-label="Close panel">×</button></div>';
  if(panel==='menu')h+=`<button class="panel-button" data-action="bookmarks">☆ Bookmarks</button><button class="panel-button" data-action="history">◷ History</button><button class="panel-button" data-action="downloads">↓ Downloads folder</button><button class="panel-button" data-action="settings">⚙ Settings & privacy</button><button class="panel-button" data-action="about">ⓘ About Ryanova</button>`;
  if(panel==='settings'){
  const select=(id,options,current)=>'<label class="search-setting-label">'+
    (id==='search-engine'?'Default search engine':'Preferred AI assistant')+
    '</label><select class="search-setting-select" id="'+id+'">'+
    options.map(([v,label])=>'<option value="'+v+'" '+(current===v?'selected':'')+'>'+label+'</option>').join('')+
    '</select>';
  h+=select('search-engine',[
    ['google','Google'],['duckduckgo','DuckDuckGo'],
    ['bing','Bing'],['brave','Brave Search'],['startpage','Startpage']
  ],state.searchEngine||'google');
  h+=select('ai-provider',[
    ['chatgpt','ChatGPT'],['gemini','Gemini'],
    ['claude','Claude'],['perplexity','Perplexity']
  ],state.aiProvider||'chatgpt');

  const defaultsSearch={
    google:'https://www.google.com/search?q=%s',
    duckduckgo:'https://duckduckgo.com/?q=%s',
    bing:'https://www.bing.com/search?q=%s',
    brave:'https://search.brave.com/search?q=%s',
    startpage:'https://www.startpage.com/sp/search?query=%s'
  };
  const defaultsAI={
    chatgpt:'https://chatgpt.com/',
    gemini:'https://gemini.google.com/',
    claude:'https://claude.ai/',
    perplexity:'https://www.perplexity.ai/search?q=%s'
  };
  const providerRows=(type,defaults,custom)=>{
    const merged={...defaults,...custom};
    return Object.entries(merged).map(([id,url])=>
      '<div class="provider-row"><div><strong>'+esc(id)+
      '</strong><div class="provider-url">'+esc(url)+
      '</div></div><button class="provider-edit" data-type="'+type+
      '" data-id="'+esc(id)+'">Edit</button></div>'
    ).join('');
  };
  h+='<div class="provider-heading">Manage search engines</div>';
  h+=providerRows('search',defaultsSearch,state.searchProviders||{});
  h+='<button class="provider-add" data-type="search">+ Add search engine</button>';
  h+='<div class="provider-heading">Manage AI assistants</div>';
  h+=providerRows('ai',defaultsAI,state.aiProviders||{});
  h+='<button class="provider-add" data-type="ai">+ Add AI assistant</button>';
  h+='<button class="panel-button" data-action="open-ai">✦ Open AI assistant</button>';
}
if(panel==='settings')h+=`<label class="switch">Auto Updates (check and download) <input id="auto-updates" type="checkbox" ${state.autoUpdates!==false?'checked':''}></label><label class="switch">Block common ads & trackers <input id="block" type="checkbox" ${state.blocking?'checked':''}></label><div class="muted">Block count this session: ${state.blocked||0}. Basic blocklist, not comprehensive filtering.</div><button class="panel-button" data-action="clear">Clear cookies, cache and history</button><div class="muted">Home page: ${esc(state.home)}</div><button class="panel-button" data-action="sethome">Set current page as home</button>`;
  if(panel==='about')h+=`<p><strong>Ryanova Browser ${esc(state.version)}</strong></p><p class="muted">Chromium ${esc(state.engine)} · ${esc(state.platform)}</p><p class="muted">Internal team beta. Chromium sandbox enabled. No telemetry in Ryanova code.</p>`;
  if(panel==='bookmarks'||panel==='history'){
    const items=state[panel]||[];
    h+=items.length?items.slice(0,100).map(x=>`<div class="item" data-url="${esc(x.url)}" title="${esc(x.url)}">${esc(x.title||x.url)}</div>`).join(''):'<p class="muted">Nothing here yet.</p>';
  }
  if(panel==='downloads')h+='<button class="panel-button" data-action="downloads">Open Downloads folder</button>'+(state.downloads||[]).map(d=>`<div class="item">${esc(d.name)} — ${esc(d.state)}</div>`).join('');
  // RYANOVA_ABOUT_UPDATE_V1
if(panel==='about'){
  h += '<div style="margin-top:14px">' +
    '<button class="panel-button" id="ryanova-check-updates">' +
    '↻ Check for Updates</button></div>' +
    '<p class="muted">Updates: GitHub Releases</p>' +
    '<p class="muted">Electron: ' +
    esc(state.electron || '45.2.3') + '</p>';
}
el.innerHTML=h;
const ryanovaUpdateButton=el.querySelector('#ryanova-check-updates');
if(ryanovaUpdateButton){
  ryanovaUpdateButton.onclick=()=>api.send('check-updates');
}

  const closeButton=el.querySelector('#close-panel');
  if(closeButton)closeButton.onclick=()=>setPanel('');



  el.querySelectorAll('.provider-edit,.provider-add').forEach(btn=>{
    btn.onclick=()=>{
      const type=btn.dataset.type;
      const editing=btn.classList.contains('provider-edit');
      const oldId=editing?btn.dataset.id:'';
      const row=editing?btn.closest('.provider-row'):null;
      const current=row?.querySelector('.provider-url')?.textContent||'';

      // Close any previous editor.
      el.querySelector('#provider-editor')?.remove();

      const editor=document.createElement('div');
      editor.id='provider-editor';
      editor.className='provider-editor';

      editor.innerHTML=`
        <div class="provider-editor-title">
          ${editing?'Edit':'Add'} ${type==='search'?'search engine':'AI assistant'}
        </div>
        <label>Name / shortcut</label>
        <input id="provider-name" value="${esc(oldId)}"
          ${editing?'readonly':''}
          placeholder="e.g. mysearch">
        <label>URL ${type==='search'?'(use %s for query)':'(optional %s for query)'}</label>
        <input id="provider-url-input" value="${esc(current)}"
          placeholder="https://example.com/search?q=%s">
        <div class="provider-editor-actions">
          <button id="provider-cancel">Cancel</button>
          <button id="provider-save">Save</button>
        </div>
        <div id="provider-error"></div>
      `;

      // Insert editor immediately below the selected provider,
      // or below the Add button.
      btn.closest('.provider-row')?.after(editor);
      if(!editing)btn.after(editor);

      editor.querySelector('#provider-cancel').onclick=()=>{
        editor.remove();
      };

      editor.querySelector('#provider-save').onclick=()=>{
        const id=editor.querySelector('#provider-name').value.trim().toLowerCase();
        const url=editor.querySelector('#provider-url-input').value.trim();
        const error=editor.querySelector('#provider-error');

        if(!/^[a-z][a-z0-9_-]{0,39}$/.test(id)){
          error.textContent='Use letters, numbers, hyphens or underscores. Start with a letter.';
          return;
        }

        let parsed;
        try{
          parsed=new URL(url.replaceAll('%s','test'));
        }catch{
          error.textContent='Enter a valid HTTPS URL.';
          return;
        }

        if(parsed.protocol!=='https:'){
          error.textContent='Only HTTPS URLs are allowed.';
          return;
        }

        if(type==='search'&&!url.includes('%s')){
          error.textContent='Search engine URL must contain %s.';
          return;
        }

        api.send('save-provider',{type,id,url});
        editor.remove();
      };

      editor.querySelector('#provider-name').focus();
    };
  });
  const se=el.querySelector('#search-engine');
  if(se)for(const id of Object.keys(state.searchProviders||{}))
    if(!Array.from(se.options).some(o=>o.value===id))
      se.add(new Option(id,id));
  if(se)se.value=state.searchEngine||'google';
  if(se)se.onchange=()=>api.send('set-search-engine',se.value);
  const ai=el.querySelector('#ai-provider');
  if(ai)for(const id of Object.keys(state.aiProviders||{}))
    if(!Array.from(ai.options).some(o=>o.value===id))
      ai.add(new Option(id,id));
  if(ai)ai.value=state.aiProvider||'chatgpt';
  if(ai)ai.onchange=()=>api.send('set-ai-provider',ai.value);

  const aiButton=el.querySelector('[data-action="open-ai"]');
  if(aiButton)aiButton.onclick=()=>api.send('open-ai');
  el.querySelectorAll('[data-action]').forEach(x=>x.onclick=()=>{
    const a=x.dataset.action;
    if(a==='open-ai')api.send('open-ai');else if(['bookmarks','history','settings','about'].includes(a))setPanel(a);
    else if(a==='downloads')api.send('open-downloads');
    else if(a==='clear'&&confirm('Clear cookies, cache and history?'))api.send('clear-data');
    else if(a==='sethome'){
      const t=state.tabs?.find(t=>t.active);
      if(t)api.send('set-home',t.url);
    }
  });
  el.querySelectorAll('[data-url]').forEach(x=>x.onclick=()=>{
    api.send('navigate',x.dataset.url);setPanel('');
  });
  const au=document.getElementById('auto-updates');if(au)au.onchange=()=>api.send('set-auto-updates',au.checked);
  const b=document.getElementById('block');if(b)b.onchange=()=>api.send('set-blocking',b.checked);
}
api.onPanel(name=>{panel=name;render()});
api.onState(s=>{state=s;render()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')setPanel('')});
