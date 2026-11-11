
// RYANOVA_UPDATE_MANAGER_V2
const httpsRyanova = require('node:https');
const cryptoRyanova = require('node:crypto');
const {spawn: spawnRyanova} = require('node:child_process');
const RYANOVA_RELEASES = 'https://github.com/prabhukeni/ryanova-browser/releases';
const RYANOVA_API = 'https://api.github.com/repos/prabhukeni/ryanova-browser/releases?per_page=30';
let ryanovaUpdateBusy = false;
let ryanovaLastNotice = '';
let ryanovaUpdateStatus = 'Idle';
function ryanovaVersionParts(value) {
  const m=String(value).replace(/^v/,'').match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.(\d+))?$/i);
  return m?{nums:[+m[1],+m[2],+m[3]],pre:m[4]||'',preNum:+(m[5]||0)}:null;
}
function ryanovaCompareVersions(a,b) {
  const x=ryanovaVersionParts(a),y=ryanovaVersionParts(b);
  if(!x||!y) return 0;
  for(let i=0;i<3;i++)if(x.nums[i]!==y.nums[i])return Math.sign(x.nums[i]-y.nums[i]);
  if(!x.pre&&y.pre)return 1;
  if(x.pre&&!y.pre)return -1;
  if(x.pre!==y.pre)return x.pre>y.pre?1:-1;
  return Math.sign(x.preNum-y.preNum);
}
function ryanovaRequest(url, maxBytes, redirects=0) {
  return new Promise((resolve,reject)=>{
    const u=new URL(url);
    if(u.protocol!=='https:' || !['api.github.com','github.com','objects.githubusercontent.com','release-assets.githubusercontent.com'].includes(u.hostname))return reject(new Error('Untrusted download host'));
    const req=httpsRyanova.get(u,{headers:{'User-Agent':'Ryanova-Browser-Updater','Accept':'application/vnd.github+json'},timeout:20000},res=>{
      if([301,302,303,307,308].includes(res.statusCode)){
        const next=new URL(res.headers.location||'',u);
        res.resume();
        if(redirects>=5)return reject(new Error('Too many redirects'));
        return resolve(ryanovaRequest(next.href,maxBytes,redirects+1));
      }
      if(res.statusCode!==200){res.resume();return reject(new Error('HTTP '+res.statusCode));}
      let size=0;const chunks=[];
      res.on('data',c=>{size+=c.length;if(size>maxBytes){res.destroy(new Error('Download exceeds size limit'));return;}chunks.push(c);});
      res.on('end',()=>resolve(Buffer.concat(chunks)));
      res.on('error',reject);
    });
    req.on('timeout',()=>req.destroy(new Error('Request timed out')));
    req.on('error',reject);
  });
}
async function ryanovaDownloadFile(url,target,maxBytes) {
  const fsR=require('node:fs');
  const u=new URL(url);
  if(u.protocol!=='https:'||!['github.com','objects.githubusercontent.com','release-assets.githubusercontent.com'].includes(u.hostname))throw Error('Untrusted asset URL');
  await new Promise((resolve,reject)=>{
    const part=target+'.partial';let written=0;
    const output=fsR.createWriteStream(part,{flags:'wx',mode:0o600});
    let settled=false;
    const fail=e=>{if(settled)return;settled=true;output.destroy();fsR.rm(part,{force:true},()=>reject(e));};
    const get=(address,hops)=>{
      const req=httpsRyanova.get(address,{headers:{'User-Agent':'Ryanova-Browser-Updater'},timeout:30000},res=>{
        if([301,302,303,307,308].includes(res.statusCode)){
          const next=new URL(res.headers.location||'',address);res.resume();
          if(hops>=5||next.protocol!=='https:'||!['github.com','objects.githubusercontent.com','release-assets.githubusercontent.com'].includes(next.hostname))return fail(Error('Untrusted redirect'));
          return get(next.href,hops+1);
        }
        if(res.statusCode!==200){res.resume();return fail(Error('Asset HTTP '+res.statusCode));}
        res.on('data',c=>{written+=c.length;if(written>maxBytes){res.destroy(Error('Asset too large'));return;}ryanovaUpdateStatus='Downloading '+Math.floor(written/1048576)+' MB';});
        res.on('error',fail);res.pipe(output);
        output.on('finish',()=>{if(settled)return;settled=true;output.close(()=>fsR.rename(part,target,e=>e?reject(e):resolve()));});
      });
      req.on('timeout',()=>req.destroy(Error('Download timed out')));req.on('error',fail);
    };
    output.on('error',fail);get(url,0);
  });
}
function ryanovaPackageType(){
  if(process.platform!=='linux'||!app.isPackaged)return null;
  if(process.env.APPIMAGE)return 'AppImage';
  return 'deb';
}
async function checkRyanovaUpdates(manual=false){
  if(ryanovaUpdateBusy)return;
  if(!manual&&settings?.autoUpdates===false)return;
  ryanovaUpdateBusy=true;
  try{
    ryanovaUpdateStatus='Checking GitHub';
    const releases=JSON.parse((await ryanovaRequest(RYANOVA_API,1024*1024)).toString('utf8'));
    if(!Array.isArray(releases))throw Error('Invalid release response');
    const valid=releases.filter(r=>!r.draft&&ryanovaVersionParts(r.tag_name)&&typeof r.html_url==='string'&&r.html_url.startsWith(RYANOVA_RELEASES+'/tag/'));
    valid.sort((a,b)=>ryanovaCompareVersions(b.tag_name,a.tag_name));
    const latest=valid[0],current=app.getVersion();
    if(!latest||ryanovaCompareVersions(latest.tag_name,current)<=0){
      ryanovaUpdateStatus='Up to date';
      if(manual)await dialog.showMessageBox({type:'info',title:'Ryanova Updates',message:'Ryanova Browser is up to date',detail:'Installed: '+current,buttons:['OK']});
      return;
    }
    if(!manual&&ryanovaLastNotice===latest.tag_name)return;
    ryanovaLastNotice=latest.tag_name;
    const type=ryanovaPackageType();
    const asset=latest.assets?.find(a=>typeof a.name==='string'&&a.name.endsWith(type==='AppImage'?'.AppImage':'.deb')&&a.name.includes(latest.tag_name.replace(/^v/,''))&&a.browser_download_url?.startsWith('https://github.com/prabhukeni/ryanova-browser/releases/download/'));
    const checksum=latest.assets?.find(a=>/^SHA256SUMS(?:[^/]*)?\.txt$/.test(a.name)&&a.browser_download_url?.startsWith('https://github.com/prabhukeni/ryanova-browser/releases/download/'));
    const canDownload=!!(type&&asset&&checksum);
    const result=(!manual&&canDownload&&settings?.autoUpdates!==false) ? {response:0} : await dialog.showMessageBox({type:'info',title:'Ryanova Update Available',message:'Ryanova Browser '+latest.tag_name+' is available',detail:'Installed: '+current+'\nAvailable: '+latest.tag_name+'\n\n'+(canDownload?'Download and verify this release? Installation requires your approval.':'Open GitHub to download the release.'),buttons:canDownload?['Download update','View GitHub release','Later']:['View GitHub release','Later'],defaultId:canDownload?2:1,cancelId:canDownload?2:1,noLink:true});
    if((canDownload&&result.response===1)||(!canDownload&&result.response===0)){await shell.openExternal(latest.html_url);return;}
    if(!canDownload||result.response!==0)return;
    const fsR=require('node:fs'),pathR=require('node:path');
    const folder=pathR.join(app.getPath('userData'),'verified-updates');
    fsR.mkdirSync(folder,{recursive:true,mode:0o700});
    if(!/^[a-zA-Z0-9 ._()-]+$/.test(asset.name))throw Error('Unsafe asset filename');
    const destination=pathR.join(folder,asset.name);
    const checksumText=(await ryanovaRequest(checksum.browser_download_url,1024*1024)).toString('utf8');
    const line=checksumText.split(/\r?\n/).find(l=>l.trim().endsWith(asset.name)&&/^[a-f0-9]{64}\s+/i.test(l));
    if(!line)throw Error('No SHA256 entry for '+asset.name);
    const expected=line.trim().slice(0,64).toLowerCase();
    fsR.rmSync(destination,{force:true});fsR.rmSync(destination+'.partial',{force:true});
    await ryanovaDownloadFile(asset.browser_download_url,destination,1024*1024*700);
    const digest=cryptoRyanova.createHash('sha256').update(fsR.readFileSync(destination)).digest('hex');
    if(digest!==expected){fsR.rmSync(destination,{force:true});throw Error('SHA256 verification failed');}
    ryanovaUpdateStatus='Verified '+asset.name;
    const approved=await dialog.showMessageBox({type:'question',title:'Install Ryanova Update',message:'Download verified. Install '+latest.tag_name+'?',detail:type==='AppImage'?'Ryanova will close and replace the currently running AppImage. A backup will be retained.':'Ryanova will open the downloaded DEB in your system package installer. Administrator authorization may be required.',buttons:['Install','Later'],defaultId:1,cancelId:1,noLink:true});
    if(approved.response!==0)return;
    if(type==='deb'){
      const error=await shell.openPath(destination);
      if(error)await dialog.showMessageBox({type:'info',message:'Open the verified DEB with your package installer',detail:destination+'\n'+error});
      return;
    }
    const running=process.env.APPIMAGE;
    if(!running||!fsR.existsSync(running))throw Error('Running AppImage path unavailable');
    const script=pathR.join(__dirname,'updater','replace-appimage.sh');
    if(!fsR.existsSync(script))throw Error('AppImage update helper missing');
    fsR.chmodSync(destination,0o700);
    const child=spawnRyanova('/bin/bash',[script,String(process.pid),running,destination],{detached:true,stdio:'ignore'});
    child.unref();app.quit();
  }catch(e){
    ryanovaUpdateStatus='Update error: '+e.message;
    console.error('[Ryanova updater]',e);
    if(manual||ryanovaLastNotice)await dialog.showMessageBox({type:'warning',title:'Ryanova Updates',message:'Update could not complete',detail:e.message,buttons:['OK']});
  }finally{ryanovaUpdateBusy=false;}
}
// END_RYANOVA_UPDATE_MANAGER_V2

const {app,BrowserWindow,WebContentsView,session,ipcMain,dialog,shell}=require('electron');
const fs=require('fs'),path=require('path');
const privacy=require('./privacy');
const VERSION=app.getVersion();
app.commandLine.appendSwitch('disable-background-networking');
// Chromium sandbox stays ON. Never disable web security or certificate validation.
let win,tabs=[],active=-1,seq=0,settings,history=[],bookmarks=[],downloads=[],blockStats=0;
const privacyCounters=()=>({advertising:0,analytics:0,social:0,links:0,cookies:0});
const privatePartitions=new Set();
let privacySendTimer=null;
function queuePrivacyState(){if(privacySendTimer)return;privacySendTimer=setTimeout(()=>{privacySendTimer=null;send()},300)}
function tabForContents(id){return tabs.find(t=>t.view.webContents.id===id)}
function tabLevel(t){return t?.level||'strict'}
function privacyRequest(details){const t=tabForContents(details.webContentsId);if(!t)return false;const cat=privacy.block(details.url,tabLevel(t));if(cat){t.stats[cat]++;blockStats++;queuePrivacyState();return true}return false}
function attachPrivacySession(ses){
  ses.setPermissionRequestHandler((_wc,permission,callback)=>callback(permission==='fullscreen'));
  ses.webRequest.onBeforeRequest((details,callback)=>callback({cancel:privacyRequest(details)}));
  ses.webRequest.onBeforeSendHeaders((details,callback)=>{
    const t=tabForContents(details.webContentsId);
    if(t&&t.level==='strict'&&details.resourceType!=='mainFrame'&&privacy.thirdParty(details.url,t.url)){
      const headers={...details.requestHeaders};
      for(const key of Object.keys(headers))if(key.toLowerCase()==='cookie')delete headers[key];
      return callback({requestHeaders:headers});
    }
    callback({requestHeaders:details.requestHeaders});
  });
  ses.webRequest.onHeadersReceived((details,callback)=>{
    const t=tabForContents(details.webContentsId);
    if(t&&t.level==='strict'&&details.resourceType!=='mainFrame'&&privacy.thirdParty(details.url,t.url)){
      const headers={...details.responseHeaders};let removed=0;
      for(const key of Object.keys(headers))if(key.toLowerCase()==='set-cookie'){removed+=(Array.isArray(headers[key])?headers[key].length:1);delete headers[key]}
      if(removed){t.stats.cookies+=removed;queuePrivacyState()}
      return callback({responseHeaders:headers});
    }
    callback({responseHeaders:details.responseHeaders});
  });
  ses.on('will-download',(_e,item)=>{let d={name:item.getFilename(),url:item.getURL(),state:'downloading',at:Date.now()};downloads.push(d);item.on('done',(_event,status)=>{d.state=status;d.path=item.getSavePath();send()});send()});
}
function sanitizeForTab(t,url){const cleaned=privacy.clean(url);if(cleaned.removed&&t){t.stats.links+=cleaned.removed;queuePrivacyState()}return cleaned.url}

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
function state(){return {version:VERSION,electron:process.versions.electron,engine:process.versions.chrome,platform:process.platform,autoUpdates:settings.autoUpdates!==false,updateStatus:ryanovaUpdateStatus,blocking:true,home:settings.home,searchEngine:settings.searchEngine||'google',aiProvider:settings.aiProvider||'chatgpt',
searchProviders:settings.searchProviders||{},
aiProviders:settings.aiProviders||{},tabs:tabs.map((t,i)=>({id:t.id,title:t.title,url:t.url,loading:t.loading,active:i===active,level:t.level,private:t.private,stats:{...t.stats}})),bookmarks,history:history.slice(-150).reverse(),downloads:downloads.slice(-30).reverse(),blocked:blockStats}}
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
  panelName = ['menu','settings','about','bookmarks','history','downloads','privacy'].includes(name) ? name : '';
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
function newTab(raw,options={}){const isPrivate=options.private===true;
  const partition=isPrivate?'ryanova-private-'+(seq+1):'persist:rynova';
  if(isPrivate){privatePartitions.add(partition);attachPrivacySession(session.fromPartition(partition))}
  const initial=validURL(raw||settings.home);
  const cleaned=privacy.clean(initial);
  const url=cleaned.url;
  let v=new WebContentsView({webPreferences:{partition,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:true}});v.setBackgroundColor('#0b1220');
  // Use the actual Chromium version for website compatibility.
  const chromeVersion = process.versions.chrome;
  v.webContents.setUserAgent(
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ` +
    `(KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
  );let t={id:++seq,view:v,title:'New Tab',url:url,loading:false,private:isPrivate,partition,level:'strict',stats:privacyCounters()};t.stats.links+=cleaned.removed;tabs.push(t);win.contentView.addChildView(v);positionOverlay();v.webContents.setWindowOpenHandler(({url})=>{newTab(url,{private:t.private});return {action:'deny'}});v.webContents.on('will-navigate',(e,u)=>{if(!/^https?:\/\//i.test(u)&&u!=='about:blank'){e.preventDefault();return}const cleaned=sanitizeForTab(t,u);if(cleaned!==u){e.preventDefault();v.webContents.loadURL(cleaned).catch(()=>{})}});v.webContents.on('page-title-updated',(_e,title)=>{
  t.title=title||'New Tab';

  if(title && title.trim() && title !== 'New Tab'){
    const entry=t.private?null:[...history].reverse().find(h=>h.url===t.url);
    if(entry){
      entry.title=title;
      save('history',history);
    }
  }

  send();
});v.webContents.on('did-navigate',(_e,u)=>{t.url=u;if(t===current()){t.view.setVisible(true);resize()}if(!t.private){history.push({title:t.title,url:u,at:Date.now()});if(history.length>1500)history=history.slice(-1500);save('history',history);}send()});v.webContents.on('did-navigate-in-page',(_e,u)=>{t.url=u;if(t===current()){t.view.setVisible(true);resize()}send()});v.webContents.on('did-start-loading',()=>{t.loading=true;send()});v.webContents.on('did-stop-loading',()=>{t.loading=false;send()});
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
function closeTab(index){if(index<0||index>=tabs.length)return;let t=tabs[index];tabs.splice(index,1);win.contentView.removeChildView(t.view);t.view.webContents.close();if(t.private){privatePartitions.delete(t.partition);const privateSession=session.fromPartition(t.partition);privateSession.clearStorageData().catch(console.error);privateSession.clearCache().catch(console.error)}if(!tabs.length)newTab(settings.home);else activate(Math.min(index,tabs.length-1))}
function current(){return tabs[active]}
function init(){
setTimeout(() => checkRyanovaUpdates(false), 15000);
setInterval(() => checkRyanovaUpdates(false), 24 * 60 * 60 * 1000);
settings=read('settings',{blocking:true,home:'rynova://home',searchEngine:'google',aiProvider:'chatgpt'});history=read('history',[]);bookmarks=read('bookmarks',[]);const ses=session.fromPartition('persist:rynova');attachPrivacySession(ses);win=new BrowserWindow({width:1180,height:800,minWidth:740,minHeight:500,title:'Ryanova Browser',backgroundColor:'#07111e',webPreferences:{preload:path.join(__dirname,'preload.js'),sandbox:true,contextIsolation:true,nodeIntegration:false}});win.setMenuBarVisibility(false);win.loadFile(path.join(__dirname,'ui','index.html'));initOverlay();win.on('resize',scheduleResize);
win.on('maximize',scheduleResize);
win.on('unmaximize',scheduleResize);
win.on('enter-full-screen',scheduleResize);
win.on('leave-full-screen',scheduleResize);win.webContents.on('did-finish-load',()=>{newTab(settings.home);send()});win.on('closed',()=>{tabs=[];win=null});}
app.whenReady().then(init);app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
function on(name,fn){ipcMain.on(name,(e,arg)=>{if(!win||win.isDestroyed()||![win.webContents.id,overlayView?.webContents.id].includes(e.sender.id))return;try{fn(arg)}catch(e){console.error(name,e)}})}
on('panel-set',name=>setPanel(name));
on('new-tab',u=>newTab(u));on('new-private-tab',()=>newTab('rynova://home',{private:true}));
on('set-tab-privacy',data=>{const t=current();if(!t||!data||!privacy.LEVELS.includes(data.level))return;t.level=data.level;send();t.view.webContents.reload()});on('select-tab',i=>activate(Number(i)));on('close-tab',i=>closeTab(Number(i)));
on('check-updates',()=>checkRyanovaUpdates(true));
on('set-auto-updates',enabled=>{settings.autoUpdates=!!enabled;save('settings',settings);send();});
on('navigate',u=>{let t=current();if(!t)return;let url=sanitizeForTab(t,validURL(u));if(url==='rynova://home'){t.view.webContents.loadURL('about:blank');t.url='rynova://home';t.title='New Tab';send()}else t.view.webContents.loadURL(url).catch(()=>{})});
on('back',()=>{let t=current();if(t&&t.view.webContents.navigationHistory.canGoBack())t.view.webContents.navigationHistory.goBack()});on('forward',()=>{let t=current();if(t&&t.view.webContents.navigationHistory.canGoForward())t.view.webContents.navigationHistory.goForward()});on('reload',()=>current()?.view.webContents.reload());
on('bookmark',()=>{let t=current();if(!t||!t.url||t.url.startsWith('rynova:'))return;let i=bookmarks.findIndex(x=>x.url===t.url);if(i>=0)bookmarks.splice(i,1);else bookmarks.push({title:t.title,url:t.url});save('bookmarks',bookmarks);send()});
on('open-bookmarks',()=>send());on('open-history',()=>send());// Legacy global blocker toggle intentionally superseded by per-tab Privacy Shield.
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
on('clear-data',async()=>{const ses=session.fromPartition('persist:rynova');await ses.clearStorageData();await ses.clearCache();for(const t of tabs)t.stats=privacyCounters();history=[];save('history',history);send()});
on('open-downloads',()=>shell.openPath(app.getPath('downloads')));
on('find',q=>{let t=current();if(!t)return;if(q)t.view.webContents.findInPage(String(q).slice(0,200));else t.view.webContents.stopFindInPage('clearSelection')});
on('zoom',v=>{let t=current();if(t)t.view.webContents.setZoomFactor(Math.max(.5,Math.min(2,Number(v)||1)))});
on('devtools',()=>{if(current())current().view.webContents.openDevTools({mode:'detach'})});

ipcMain.on('open-page-devtools',(e)=>{if(!win||e.sender!==win.webContents)return;
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

