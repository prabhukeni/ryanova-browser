const api=window.rynova,$=id=>document.getElementById(id);let state={},panel='';function send(n,p){api.send(n,p)}function escape(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function nav(v){send('navigate',v);$('url').blur()}function openPanel(name){panel=panel===name?'':name;send('panel-set',panel)}function renderPanel(){let el=$('panel');if(!panel){el.classList.add('hidden');return}el.classList.remove('hidden');let h='<div class="panel-title">'+escape(panel[0].toUpperCase()+panel.slice(1))+'</div>';if(panel==='menu')h+=`<button class="panel-button" data-action="new-private-tab">◈ New Private Tab</button><button class="panel-button" data-action="privacy">⬡ Privacy Shield</button><button class="panel-button" data-action="bookmarks">☆ Bookmarks</button><button class="panel-button" data-action="history">◷ History</button><button class="panel-button" data-action="downloads">↓ Downloads folder</button><button class="panel-button" data-action="settings">⚙ Settings & privacy</button><button class="panel-button" data-action="about">ⓘ About Ryanova</button>`;if(panel==='privacy'){const tab=state.tabs?.find(x=>x.active);const stats=tab?.stats||{};h+=`<div class="muted">${tab?.private?'Private tab · temporary storage':'Regular tab'} · ${escape(tab?.url||'New Tab')}</div><label>Protection for this tab</label><select id="privacy-level"><option value="strict" ${tab?.level==='strict'?'selected':''}>Strict (default)</option><option value="balanced" ${tab?.level==='balanced'?'selected':''}>Balanced</option><option value="standard" ${tab?.level==='standard'?'selected':''}>Standard</option></select><div class="muted">Actual events blocked on this tab:</div><div class="privacy-counts">Advertising: ${stats.advertising||0}<br>Analytics: ${stats.analytics||0}<br>Social: ${stats.social||0}<br>Tracking parameters removed: ${stats.links||0}<br>Third-party cookies restricted: ${stats.cookies||0}</div><p class="muted">Changing protection reloads this tab. Strict may affect sign-in and embedded services. This is not anonymous browsing.</p><button class="panel-button" data-action="new-private-tab">+ New Private Tab</button>`;}if(panel==='settings')h+=`<label class="switch">Auto Updates (check and download) <input id="auto-updates" type="checkbox" ${state.autoUpdates!==false?'checked':''}></label><div class="muted">Privacy Shield: Strict by default; use the shield icon to change the current tab.</div><div class="muted">Block count this session: ${state.blocked||0}. Basic blocklist, not comprehensive filtering.</div><button class="panel-button" data-action="clear">Clear cookies, cache and history</button><div class="muted">Home page: ${escape(state.home)}</div><button class="panel-button" data-action="sethome">Set current page as home</button>`;if(panel==='about')h+=`<p><strong>Ryanova Browser ${escape(state.version)}</strong></p><p class="muted">Chromium ${escape(state.engine)} · ${escape(state.platform)}</p><p class="muted">Internal team beta. Chromium sandbox enabled. No telemetry in Ryanova code. Engine updates require installing a new Electron release.</p>`;if(panel==='bookmarks'||panel==='history'){let a=state[panel]||[];h+=a.length?a.slice(0,100).map(x=>`<div class="item" data-url="${escape(x.url)}" title="${escape(x.url)}">${escape(x.title||x.url)}</div>`).join(''):'<p class="muted">Nothing here yet.</p>'}if(panel==='downloads')h+='<button class="panel-button" data-action="downloads">Open Downloads folder</button>'+(state.downloads||[]).map(d=>`<div class="item">${escape(d.name)} — ${escape(d.state)}</div>`).join('');el.innerHTML=h;el.querySelectorAll('[data-action]').forEach(x=>x.onclick=()=>{let a=x.dataset.action;if(['bookmarks','history','settings','about'].includes(a))openPanel(a);else if(a==='new-private-tab'){send('new-private-tab');openPanel('')}else if(a==='privacy')openPanel('privacy');else if(a==='downloads')send('open-downloads');else if(a==='clear'&&confirm('Clear cookies, cache and history?'))send('clear-data');else if(a==='sethome'){let t=state.tabs?.find(x=>x.active);if(t)send('set-home',t.url)}});el.querySelectorAll('[data-url]').forEach(x=>x.onclick=()=>{nav(x.dataset.url);openPanel(panel)});let au=$('auto-updates');if(au)au.onchange=()=>send('set-auto-updates',au.checked);let b=$('block');if(b)b.disabled=true;let pl=$('privacy-level');if(pl)pl.onchange=()=>send('set-tab-privacy',{level:pl.value})}api.onPanelSync(name=>{panel=name;renderPanel()});api.onState(s=>{state=s;
const searchNames={
 google:'Google',
 duckduckgo:'DuckDuckGo',
 bing:'Bing',
 brave:'Brave Search',
 startpage:'Startpage'
};
const aiNames={
 chatgpt:'ChatGPT',
 gemini:'Gemini',
 claude:'Claude',
 perplexity:'Perplexity'
};
const webButton=$('web-provider');
const aiButton=$('ai-provider-home');
if(webButton)webButton.textContent='⌕ '+(searchNames[s.searchEngine]||s.searchEngine||'Google');
if(aiButton)aiButton.textContent='✦ Ask '+(aiNames[s.aiProvider]||s.aiProvider||'ChatGPT');
let tabs=$('tabs');tabs.innerHTML=(s.tabs||[]).map((t,i)=>`<div class="tab ${t.active?'active':''}" data-index="${i}"><span class="name">${escape((t.private?'◈ ':'')+(t.loading?'◌ '+t.title:t.title))}</span><span class="close" data-close="${i}">×</span></div>`).join('');tabs.querySelectorAll('[data-index]').forEach(t=>t.onclick=()=>send('select-tab',Number(t.dataset.index)));tabs.querySelectorAll('[data-close]').forEach(x=>x.onclick=e=>{e.stopPropagation();send('close-tab',Number(x.dataset.close))});let t=s.tabs?.find(x=>x.active);if(t){if(document.activeElement!==$('url'))$('url').value=t.url==='rynova://home'||t.url==='about:blank'?'':t.url;$('start').classList.toggle('hidden',!!t.url&&!['rynova://home','about:blank'].includes(t.url))}else $('start').classList.remove('hidden');$('version').textContent='Ryanova '+s.version;{
      const shield = $('shield');
      const level = ['strict','balanced','standard'].includes(t?.level)
        ? t.level : 'strict';

      shield.classList.remove(
        'shield-strict','shield-balanced',
        'shield-standard','shield-private'
      );
      shield.classList.add('shield-' + level);

      if (t?.private) shield.classList.add('shield-private');

      const label = 'Privacy Shield: ' +
        level.charAt(0).toUpperCase() + level.slice(1) +
        (t?.private ? ' · Private tab' : '');

      shield.title = label;
      shield.setAttribute('aria-label', label);

      shield.querySelector('.shield-detail').setAttribute(
        'd',
        level === 'strict'
          ? 'm8.4 12.1 2.4 2.4 4.8-5'
          : level === 'balanced'
            ? 'M12 5v13'
            : 'M8 12h8'
      );
    }renderPanel()});$('web-provider').onclick=()=>$('search').focus();
$('ai-provider-home').onclick=async()=>{
  const question=$('search').value.trim();

  if(question){
    try{
      await navigator.clipboard.writeText(question);
    }catch(e){
      $('search').focus();
      $('search').select();
      alert('Copy the selected question before switching to AI.');
      return;
    }
  }

  const urls={
    chatgpt:'https://chatgpt.com/',
    gemini:'https://gemini.google.com/',
    claude:'https://claude.ai/',
    perplexity:'https://www.perplexity.ai/'
  };

  const provider=state.aiProvider||'chatgpt';
  const url=provider==='perplexity' && question
    ? 'https://www.perplexity.ai/search?q='+encodeURIComponent(question)
    : urls[provider]||urls.chatgpt;

  const custom=(state.aiProviders||{})[provider];
  const destination=custom
    ? (custom.includes('%s')
       ? custom.replaceAll('%s',encodeURIComponent(question))
       : custom)
    : url;

  send('navigate',destination);


};
$('add').onclick=()=>send('new-tab');$('back').onclick=()=>send('back');$('forward').onclick=()=>send('forward');$('reload').onclick=()=>send('reload');$('home').onclick=()=>nav('rynova://home');$('bookmark').onclick=()=>send('bookmark');$('shield').onclick=()=>openPanel('privacy');$('menu').onclick=$('more').onclick=()=>openPanel('menu');$('url').onkeydown=e=>{if(e.key==='Enter')nav(e.target.value)};$('search').onkeydown=e=>{if(e.key==='Enter'){nav(e.target.value);e.target.value=''}};document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key==='t'){e.preventDefault();send('new-tab')}if(e.ctrlKey&&e.key==='w'){e.preventDefault();let i=state.tabs?.findIndex(t=>t.active);send('close-tab',i)}if(e.ctrlKey&&e.key==='l'){e.preventDefault();$('url').focus();$('url').select()}if(e.ctrlKey&&e.key==='d'){e.preventDefault();send('bookmark')}if(e.ctrlKey&&e.key==='r'){e.preventDefault();send('reload')}if(e.ctrlKey&&e.key==='h'){e.preventDefault();openPanel('history')}if(e.ctrlKey&&e.key==='j'){e.preventDefault();openPanel('downloads')}if(e.key==='Escape')openPanel('')});