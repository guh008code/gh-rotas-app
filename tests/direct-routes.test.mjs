import test from 'node:test';
import assert from 'node:assert/strict';
import { searchRoutes } from '../src/lib/routes.ts';

const origin='-23.5505, -46.6333', stop='-23.5614, -46.6559';
test('app calculates directly over HTTPS without a local server', async () => {
  const original=globalThis.fetch;
  const urls=[];
  globalThis.fetch=async (url,options)=>{
    urls.push(url);
    assert.equal(options.headers.Authorization,'test-shared-key');
    assert.ok(options.signal instanceof AbortSignal);
    return {ok:true,status:200,json:async()=>url.includes('/matrix/') ? {durations:[[0,120],[150,0]]} : {features:[{geometry:{type:'LineString',coordinates:[[-46.6333,-23.5505],[-46.6559,-23.5614]]},properties:{segments:[{distance:1000,duration:120}]}}]}};
  };
  try {
    const route=await searchRoutes(origin,[stop],'test-shared-key');
    assert.equal(route.seconds,120);
    assert.equal(route.legs.length,1);
    assert.equal(urls.length,2);
    assert.ok(urls.every(url=>url.startsWith('https://api.openrouteservice.org/')));
  } finally {globalThis.fetch=original;}
});
test('missing key and invalid input do not perform network calls', async () => {
  const original=globalThis.fetch;
  globalThis.fetch=()=>{assert.fail('Should not fetch');};
  try {
    await assert.rejects(searchRoutes(origin,[stop],''),/chave/);
    await assert.rejects(searchRoutes('',[stop],'test'),/Preencha/);
  } finally {globalThis.fetch=original;}
});
test('offline error tells the user to check their connection', async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{throw new TypeError('Network request failed');};
  try {await assert.rejects(searchRoutes(origin,[stop],'test'),/Wi-Fi ou dados móveis/);}
  finally {globalThis.fetch=original;}
});
test('shared quota exhaustion surfaces the provider message', async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:false,status:429});
  try {await assert.rejects(searchRoutes(origin,[stop],'test'),/limite de consultas/);}
  finally {globalThis.fetch=original;}
});
