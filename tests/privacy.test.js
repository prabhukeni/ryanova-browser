'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const p=require('../privacy');
test('categorizes advertising, analytics and social requests',()=>{
 assert.equal(p.category('https://ads.doubleclick.net/ad.js'),'advertising');
 assert.equal(p.category('https://www.google-analytics.com/collect'),'analytics');
 assert.equal(p.category('https://connect.facebook.net/sdk.js'),'social');
 assert.equal(p.category('https://notdoubleclick.net/x'),null);
});
test('level policy keeps standard minimal',()=>{
 assert.equal(p.block('https://doubleclick.net/x','standard'),'advertising');
 assert.equal(p.block('https://google-analytics.com/x','standard'),null);
 assert.equal(p.block('https://google-analytics.com/x','balanced'),'analytics');
 assert.equal(p.block('https://google-analytics.com/x','strict'),'analytics');
});
test('cleans known tracking query parameters and preserves functional ones',()=>{
 const result=p.clean('https://example.com/shop?id=42&utm_source=news&fbclid=abc&lang=en');
 assert.equal(result.url,'https://example.com/shop?id=42&lang=en');
 assert.equal(result.removed,2);
 assert.equal(p.clean('https://example.com/shop?id=42').removed,0);
});
test('does not treat lookalike domain as first party',()=>{
 assert.equal(p.thirdParty('https://evil-example.com/x','https://example.com'),true);
 assert.equal(p.thirdParty('https://cdn.example.com/x','https://example.com'),false);
 assert.equal(p.thirdParty('https://example.com/x','https://example.com'),false);
});
