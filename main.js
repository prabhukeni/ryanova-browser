
// RYANOVA_UPDATE_MANAGER_V1
const httpsRyanova = require('node:https');

const RYANOVA_RELEASES =
  'https://github.com/prabhukeni/ryanova-browser/releases';

const RYANOVA_API =
  'https://api.github.com/repos/prabhukeni/ryanova-browser/releases?per_page=30';

let ryanovaUpdateBusy = false;
let ryanovaLastNotice = '';

function ryanovaVersionParts(value) {
  const m = String(value).replace(/^v/, '')
    .match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.(\d+))?$/i);
  if (!m) return null;
  return {
    nums: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] || '',
    preNum: Number(m[5] || 0)
  };
}

function ryanovaCompareVersions(a, b) {
  const x = ryanovaVersionParts(a);
  const y = ryanovaVersionParts(b);
  if (!x || !y) return 0;

  for (let i = 0; i < 3; i++) {
    if (x.nums[i] !== y.nums[i])
      return x.nums[i] > y.nums[i] ? 1 : -1;
  }

  if (!x.pre && y.pre) return 1;
  if (x.pre && !y.pre) return -1;
  if (x.pre !== y.pre)
    return x.pre > y.pre ? 1 : -1;
  return Math.sign(x.preNum - y.preNum);
}

function ryanovaFetchReleases() {
  return new Promise((resolve, reject) => {
    const req = httpsRyanova.get(RYANOVA_API, {
      headers: {
        'User-Agent': 'Ryanova-Browser-Updater',
        'Accept': 'application/vnd.github+json'
      },
      timeout: 10000
    }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('GitHub HTTP ' + res.statusCode));
        return;
      }

      let body = '';
      res.on('data', chunk => {
        body += chunk;
        if (body.length > 1024 * 1024)
          res.destroy(new Error('Response too large'));
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!Array.isArray(parsed))
            throw new Error('Unexpected GitHub response');
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    });

    req.on('timeout', () =>
      req.destroy(new Error('Update check timed out')));
    req.on('error', reject);
  });
}

async function checkRyanovaUpdates(manual = false) {
  if (ryanovaUpdateBusy) return;
  ryanovaUpdateBusy = true;

  try {
    const current = app.getVersion();
    const releases = await ryanovaFetchReleases();

    const candidates = releases.filter(r =>
      !r.draft &&
      r.tag_name &&
      ryanovaVersionParts(r.tag_name) &&
      typeof r.html_url === 'string' &&
      r.html_url.startsWith(RYANOVA_RELEASES + '/tag/')
    );

    candidates.sort((a, b) =>
      ryanovaCompareVersions(b.tag_name, a.tag_name));

    const newest = candidates[0];

    if (!newest ||
        ryanovaCompareVersions(newest.tag_name, current) <= 0) {
      if (manual) {
        await dialog.showMessageBox({
          type: 'info',
          title: 'Ryanova Updates',
          message: 'Ryanova Browser is up to date',
          detail: 'Installed version: ' + current +
            '\nElectron: ' + process.versions.electron +
            '\nChromium: ' + process.versions.chrome,
          buttons: ['OK']
        });
      }
      return;
    }

    if (!manual && ryanovaLastNotice === newest.tag_name)
      return;

    ryanovaLastNotice = newest.tag_name;

    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Ryanova Update Available',
      message: 'Ryanova Browser ' + newest.tag_name +
        ' is available',
      detail: 'Installed: ' + current +
        '\nAvailable: ' + newest.tag_name +
        '\n\nReview the official GitHub release before installing.',
      buttons: ['View GitHub Release', 'Later'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    });

    if (result.response === 0)
      await shell.openExternal(newest.html_url);

  } catch (e) {
    console.error('[Ryanova updater]', e.message);

    if (manual) {
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Ryanova Updates',
        message: 'Could not check for updates',
        detail: e.message +
          '\n\nRepository: ' + RYANOVA_RELEASES,
        buttons: ['OK']
      });
    }
  } finally {
    ryanovaUpdateBusy = false;
  }
}
// END_RYANOVA_UPDATE_MANAGER_V1

const {app,BrowserWindow,WebContentsView,session,ipcMain,dialog,shell}=require('electron');
const fs=require('fs'),path=require('path');
const VERSION='1.1.0-beta.1';
app.commandLine.appendSwitch('disable-background-networking');
// Chromium sandbox stays ON. Never disable web security or certificate validation.
let win,tabs=[],active=-1,seq=0,settings,history=[],bookmarks=[],downloads=[],blockStats=0;
const toolbarHeight=108;
let htmlFullscreenTab = null;
let overlayView = null;
let panelName = "";
const dataFile=(name)=>path.join(app.getPath('userData'),name+'.json');
function read(name,def){try{return JSON.parse(fs.readFileSync(dataFile(name),'utf8'))}catch{return def}}
function save(name,obj){try{fs.writeFileSync(dataFile(name),JSON.stringify(obj,null,2),{mode:0o600})}catch(e){console.error(e)}}
function validURL(raw){let s=String(raw||'').trim();if(!s)return 'rynova://home';if(s==='rynova://home'||s==='about:blank')return s;if(/^https?:\/\//i.test(s))return s;if(/^(file|javascript|data|chrome|devtools):/i.test(s))return 'rynova://home';if(/^[\w-]+(\.[\w-]+)+(?::\d+)?(?:\/.*)?$/.test(s)||s.startsWith('localhost'))return 'https://'+s;const engines={
  google:'https://www.google.com/search?q=',
  duckduckgo:'https://duckduckgo.com/?q=',
  bing:'https://www.bing.com/search?q=',
  brave:'https://search.brave.com/search?q=',
  startpage:'https://www.startpage.com/sp/search?query='
};const selected=settings.searchEngine||'google';
const template=(settings.searchProviders||{})[selected]||engines[selected]||engines.google;
return template.includes('%s')
  ? template.replaceAll('%s',encodeURIComponent(s))
  : template+encodeURIComponent(s)}
function isBlocked(url){if(!settings.blocking)return false;try{let u=new URL(url);let h=u.hostname.toLowerCase();return /(^|\.)(doubleclick\.net|googlesyndication\.com|googleadservices\.com|adnxs\.com|taboola\.com|outbrain\.com|scorecardresearch\.com|criteo\.com|quantserve\.com|adsrvr\.org|facebook\.net|hotjar\.com|segment\.io|mixpanel\.com)$/.test(h)}catch{return false}}
function state(){return {version:VERSION,electron:process.versions.electron,engine:process.versions.chrome,platform:process.platform,blocking:settings.blocking,home:settings.home,searchEngine:settings.searchEngine||'google',aiProvider:settings.aiProvider||'chatgpt',
searchProviders:settings.searchProviders||{},
aiProviders:settings.aiProviders||{},tabs:tabs.map((t,i)=>({id:t.id,title:t.title,url:t.url,loading:t.loading,active:i===active})),bookmarks,history:history.slice(-150).reverse(),downloads:downloads.slice(-30).reverse(),blocked:blockStats}}
function send(){
  if(win&&!win.isDestroyed()) win.webContents.send('state',state());
  if(overlayView && !overlayView.webContents.isDestroyed()) overlayView.webContents.send('state',state());
}
function resize(){
  if (!win || win.isDestroyed()) return;

  const {width, height} = win.contentView.getBounds();

  tabs.forEach((t,i)=>{
    const home = t.url === 'rynova://home';

    t.view.setBounds({
      x: 0,
      y: htmlFullscreenTab === t ? 0 : toolbarHeight,
      width: i === active && !home ? Math.max(0,width) : 0,
      height: i === active && !home
        ? Math.max(0,height-(htmlFullscreenTab === t ? 0 : toolbarHeight))
        : 0
    });
  });
  positionOverlay();
}

function positionOverlay(){
  if (!win || win.isDestroyed() || !overlayView) return;
  const {width, height} = win.contentView.getBounds();
  const visible = Boolean(panelName) && !htmlFullscreenTab && width > 0 && height > toolbarHeight + 30;
  const w = Math.min(390, Math.max(1,width - 32));
  const h = Math.min(540, Math.max(1,height - toolbarHeight - 12));
  overlayView.setBounds({x:Math.max(0,width - w - 16),y:toolbarHeight,width:w,height:h});
  overlayView.setVisible(visible);
  if(visible){
    // Native sibling views, not CSS z-index: overlay must be last/topmost.
    win.contentView.removeChildView(overlayView);
    win.contentView.addChildView(overlayView);
  }
}
function setPanel(name){
  panelName = ['menu','settings','about','bookmarks','history','downloads'].includes(name) ? name : '';
  if(win && !win.isDestroyed()) win.webContents.send('panel-sync',panelName);
  if(overlayView && !overlayView.webContents.isDestroyed()) overlayView.webContents.send('panel-state',panelName);
  positionOverlay();
  send();
}
function initOverlay(){
  overlayView = new WebContentsView({webPreferences:{
    preload:path.join(__dirname,'preload.js'),sandbox:true,contextIsolation:true,
    nodeIntegration:false,webSecurity:true
  }});
  overlayView.setBackgroundColor('#14253a');
  overlayView.setVisible(false);
  win.contentView.addChildView(overlayView);
  overlayView.webContents.loadFile(path.join(__dirname,'ui','overlay.html')).catch(console.error);
  overlayView.webContents.on('did-finish-load',()=>{
    overlayView.webContents.send('panel-state',panelName);
    overlayView.webContents.send('state',state());
  });
}
function scheduleResize(){
  resize();
  setImmediate(resize);
  setTimeout(resize, 100);
  setTimeout(resize, 300);
}

function activate(index){if(index<0||index>=tabs.length)return;active=index;tabs.forEach((t,i)=>{if(i===index){t.view.setVisible(t.url !== 'rynova://home');t.view.webContents.setBackgroundThrottling(false)}else{t.view.setVisible(false);t.view.webContents.setBackgroundThrottling(true)}});resize();send()}
function newTab(raw){const url=validURL(raw||settings.home);let v=new WebContentsView({webPreferences:{partition:'persist:rynova',sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:true}});v.setBackgroundColor('#0b1220');
  // Use the actual Chromium version for website compatibility.
  const chromeVersion = process.versions.chrome;
  v.webContents.setUserAgent(
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ` +
    `(KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
  );let t={id:++seq,view:v,title:'New Tab',url:url,loading:false};tabs.push(t);win.contentView.addChildView(v);positionOverlay();v.webContents.setWindowOpenHandler(({url})=>{newTab(url);return {action:'deny'}});v.webContents.on('will-navigate',(e,u)=>{if(!/^https?:\/\//i.test(u)&&u!=='about:blank')e.preventDefault()});v.webContents.on('page-title-updated',(_e,title)=>{
  t.title=title||'New Tab';

  if(title && title.trim() && title !== 'New Tab'){
    const entry=[...history].reverse().find(h=>h.url===t.url);
    if(entry){
      entry.title=title;
      save('history',history);
    }
  }

  send();
});v.webContents.on('did-navigate',(_e,u)=>{t.url=u;if(t===current()){t.view.setVisible(true);resize()}history.push({title:t.title,url:u,at:Date.now()});if(history.length>1500)history=history.slice(-1500);save('history',history);send()});v.webContents.on('did-navigate-in-page',(_e,u)=>{t.url=u;if(t===current()){t.view.setVisible(true);resize()}send()});v.webContents.on('did-start-loading',()=>{t.loading=true;send()});v.webContents.on('did-stop-loading',()=>{t.loading=false;send()});
// RYANOVA_HTML_FULLSCREEN
v.webContents.on('enter-html-full-screen', () => {
  htmlFullscreenTab = t;
  setPanel('');
  console.log('[RYANOVA] HTML fullscreen ENTER');
  scheduleResize();
});

v.webContents.on('leave-html-full-screen', () => {
  if (htmlFullscreenTab === t) {
    htmlFullscreenTab = null;
  }
  console.log('[RYANOVA] HTML fullscreen EXIT');
  scheduleResize();
});

v.webContents.on('render-process-gone',()=>{t.title='Tab crashed — reload';send()});activate(tabs.length-1);if(url!=='rynova://home')v.webContents.loadURL(url).catch(()=>{});send()}
function closeTab(index){if(index<0||index>=tabs.length)return;let t=tabs[index];tabs.splice(index,1);win.contentView.removeChildView(t.view);t.view.webContents.close();if(!tabs.length)newTab(settings.home);else activate(Math.min(index,tabs.length-1))}
function current(){return tabs[active]}
function init(){
setTimeout(() => checkRyanovaUpdates(false), 15000);
setInterval(() => checkRyanovaUpdates(false), 24 * 60 * 60 * 1000);
settings=read('settings',{blocking:true,home:'rynova://home',searchEngine:'google',aiProvider:'chatgpt'});history=read('history',[]);bookmarks=read('bookmarks',[]);const ses=session.fromPartition('persist:rynova');ses.setPermissionRequestHandler((_wc,permission,callback)=>{
  console.log('[RYANOVA PERMISSION REQUEST]', permission);
  callback(permission === 'fullscreen');
});ses.webRequest.onBeforeRequest((details,callback)=>{let block=isBlocked(details.url);if(block)blockStats++;callback({cancel:block})});ses.on('will-download',(_e,item)=>{let d={name:item.getFilename(),url:item.getURL(),state:'downloading',at:Date.now()};downloads.push(d);item.on('done',(_event,status)=>{d.state=status;d.path=item.getSavePath();send()});send()});win=new BrowserWindow({width:1180,height:800,minWidth:740,minHeight:500,title:'Ryanova Browser',backgroundColor:'#07111e',webPreferences:{preload:path.join(__dirname,'preload.js'),sandbox:true,contextIsolation:true,nodeIntegration:false}});win.setMenuBarVisibility(false);win.loadFile(path.join(__dirname,'ui','index.html'));initOverlay();win.on('resize',scheduleResize);
win.on('maximize',scheduleResize);
win.on('unmaximize',scheduleResize);
win.on('enter-full-screen',scheduleResize);
win.on('leave-full-screen',scheduleResize);win.webContents.on('did-finish-load',()=>{newTab(settings.home);send()});win.on('closed',()=>{tabs=[];win=null});}
app.whenReady().then(init);app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
function on(name,fn){ipcMain.on(name,(_e,arg)=>{try{fn(arg)}catch(e){console.error(name,e)}})}
on('panel-set',name=>setPanel(name));
on('new-tab',u=>newTab(u));on('select-tab',i=>activate(Number(i)));on('close-tab',i=>closeTab(Number(i)));
on('check-updates',()=>checkRyanovaUpdates(true));
on('navigate',u=>{let t=current();if(!t)return;let url=validURL(u);if(url==='rynova://home'){t.view.webContents.loadURL('about:blank');t.url='rynova://home';t.title='New Tab';send()}else t.view.webContents.loadURL(url).catch(()=>{})});
on('back',()=>{let t=current();if(t&&t.view.webContents.navigationHistory.canGoBack())t.view.webContents.navigationHistory.goBack()});on('forward',()=>{let t=current();if(t&&t.view.webContents.navigationHistory.canGoForward())t.view.webContents.navigationHistory.goForward()});on('reload',()=>current()?.view.webContents.reload());
on('bookmark',()=>{let t=current();if(!t||!t.url||t.url.startsWith('rynova:'))return;let i=bookmarks.findIndex(x=>x.url===t.url);if(i>=0)bookmarks.splice(i,1);else bookmarks.push({title:t.title,url:t.url});save('bookmarks',bookmarks);send()});
on('open-bookmarks',()=>send());on('open-history',()=>send());on('set-blocking',b=>{settings.blocking=!!b;save('settings',settings);send()});
on('save-provider',data=>{
  if(!data||typeof data!=='object')return;
  const type=data.type;
  const id=String(data.id||'').trim().toLowerCase();
  const url=String(data.url||'').trim();

  if(!['search','ai'].includes(type))return;
  if(!/^[a-z][a-z0-9_-]{0,39}$/.test(id))return;
  if(url.length>2048)return;

  let parsed;
  try{parsed=new URL(url.replaceAll('%s','test'));}catch{return;}
  if(parsed.protocol!=='https:')return;
  if(!parsed.hostname)return;

  const key=type==='search'?'searchProviders':'aiProviders';
  settings[key]??={};
  settings[key][id]=url;
  save('settings',settings);
  send();
});
on('delete-provider',data=>{
  if(!data||typeof data!=='object')return;
  const key=data.type==='search'?'searchProviders':
            data.type==='ai'?'aiProviders':null;
  if(!key)return;
  const id=String(data.id||'');
  if(!settings[key]||!Object.hasOwn(settings[key],id))return;
  delete settings[key][id];
  save('settings',settings);
  send();
});
on('set-search-engine',value=>{
  if(!['google','duckduckgo','bing','brave','startpage'].includes(value) && !Object.hasOwn(settings.searchProviders||{},value))return;
  settings.searchEngine=value;save('settings',settings);send();
});
on('set-ai-provider',value=>{
  if(!['chatgpt','gemini','claude','perplexity'].includes(value) && !Object.hasOwn(settings.aiProviders||{},value))return;
  settings.aiProvider=value;save('settings',settings);send();
});
on('open-ai',()=>{
  const urls={
    chatgpt:'https://chatgpt.com/',
    gemini:'https://gemini.google.com/',
    claude:'https://claude.ai/',
    perplexity:'https://www.perplexity.ai/'
  };
  newTab((settings.aiProviders||{})[settings.aiProvider]||
       urls[settings.aiProvider]||urls.chatgpt);
});
on('set-home',url=>{settings.home=validURL(url);save('settings',settings);send()});
on('clear-data',async()=>{const ses=session.fromPartition('persist:rynova');await ses.clearStorageData();await ses.clearCache();history=[];save('history',history);send()});
on('open-downloads',()=>shell.openPath(app.getPath('downloads')));
on('find',q=>{let t=current();if(!t)return;if(q)t.view.webContents.findInPage(String(q).slice(0,200));else t.view.webContents.stopFindInPage('clearSelection')});
on('zoom',v=>{let t=current();if(t)t.view.webContents.setZoomFactor(Math.max(.5,Math.min(2,Number(v)||1)))});
on('devtools',()=>{if(current())current().view.webContents.openDevTools({mode:'detach'})});

ipcMain.on('open-page-devtools',()=>{
  const t=current();
  if(t) t.view.webContents.openDevTools({mode:'detach'});
});

const {globalShortcut}=require('electron');
app.whenReady().then(()=>{
  globalShortcut.register('F12',()=>{
    const t=current();
    if(t) t.view.webContents.openDevTools({mode:'detach'});
  });
});
app.on('will-quit',()=>globalShortcut.unregisterAll());

