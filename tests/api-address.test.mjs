import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiAddress } from '../src/lib/api-address.ts';
import { searchRoutes } from '../src/lib/routes.ts';

test('direct Expo start resolves emulator without public environment variable', () => {
  assert.equal(resolveApiAddress({platform:'android',isDevice:false,host:'192.168.1.5:8081'}),'http://10.0.2.2:3001');
  assert.equal(resolveApiAddress({platform:'ios',isDevice:false}),'http://localhost:3001');
});
test('web and physical device use development host', () => {
  assert.equal(resolveApiAddress({platform:'web',isDevice:true,host:'http://localhost:8082'}),'http://localhost:3001');
  assert.equal(resolveApiAddress({platform:'android',isDevice:true,host:'192.168.1.5:8081'}),'http://192.168.1.5:3001');
});
test('explicit deployment endpoint overrides local development defaults', () => {
  assert.equal(resolveApiAddress({explicit:'https://routes.example.com/',platform:'android',isDevice:false}),'https://routes.example.com');
});
test('search uses the resolved endpoint and surfaces provider error', async () => {
  const original=globalThis.fetch;
  let target;
  globalThis.fetch=async url=>{target=url;return {ok:false,json:async()=>({error:'Endereço não encontrado.'})};};
  try {
    await assert.rejects(searchRoutes('A',['B'],'http://10.0.2.2:3001'),/Endereço não encontrado/);
    assert.equal(target,'http://10.0.2.2:3001/routes');
  } finally {globalThis.fetch=original;}
});
