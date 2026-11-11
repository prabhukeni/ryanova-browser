// Ryanova Privacy Shield beta.5: deterministic, local-only protection helpers.
'use strict';
const LEVELS = Object.freeze(['strict','balanced','standard']);
const TRACKERS = Object.freeze({
  advertising: ['doubleclick.net','googlesyndication.com','googleadservices.com','adnxs.com','criteo.com','adsrvr.org','taboola.com','outbrain.com'],
  analytics: ['google-analytics.com','googletagmanager.com','scorecardresearch.com','quantserve.com','hotjar.com','segment.io','mixpanel.com','amplitude.com'],
  social: ['facebook.net','connect.facebook.net','analytics.twitter.com','ads-twitter.com']
});
const PARAMS = new Set(['fbclid','gclid','dclid','msclkid','igshid','mc_cid','mc_eid','twclid','yclid','_hsenc','_hsmi','vero_id']);
function hostname(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.hostname.toLowerCase():''}catch{return ''}}
function category(url){const h=hostname(url);if(!h)return null;for(const [name,hosts] of Object.entries(TRACKERS))if(hosts.some(x=>h===x||h.endsWith('.'+x)))return name;return null}
function clean(url){try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol))return {url,removed:0};let removed=0;for(const key of [...u.searchParams.keys()])if(PARAMS.has(key.toLowerCase())||key.toLowerCase().startsWith('utm_')){removed+=u.searchParams.getAll(key).length;u.searchParams.delete(key)}return {url:removed?u.href:url,removed}}catch{return {url,removed:0}}}
function thirdParty(request,top){const a=hostname(request),b=hostname(top);if(!a||!b)return false;return a!==b&&!a.endsWith('.'+b)&&!b.endsWith('.'+a)}
function block(url,level){const c=category(url);return level==='standard'&&c!=='advertising'?null:c}
module.exports={LEVELS,category,clean,thirdParty,block};
