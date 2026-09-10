import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRoute } from '../src/lib/openrouteservice.js';
import { validResult } from '../src/lib/routes.ts';
import { mapHtml } from '../src/lib/map-html.ts';

const addresses = ['-23.55, -46.63', '-23.56, -46.65', '-23.57, -46.66'];
const geometry = [[-46.63,-23.55],[-46.64,-23.56],[-46.66,-23.57],[-46.65,-23.56]];
const response = body => ({ ok: true, status: 200, json: async () => body });
function mockedService(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if(url.includes('/geocode/')) return response(overrides.geocode || { features: [{ geometry: { coordinates: [-46.63,-23.55] }, properties: { label: 'Praça da Sé, São Paulo', confidence: 1 } }] });
    if(url.includes('/matrix/')) return response(overrides.matrix || { durations: [[0,1,2],[4,0,100],[5,1,0]] });
    return response(overrides.directions || { features: [{ geometry: { type: 'LineString', coordinates: geometry }, properties: { segments: [{duration:2,distance:200},{duration:1,distance:100}] } }] });
  };
  return { calls, fetchImpl };
}
test('ORS integration orders coordinates, draws street geometry and returns valid client contract', async () => {
  const mock = mockedService();
  const result = await calculateRoute(addresses, {apiKey:'test-key',fetchImpl:mock.fetchImpl});
  assert.equal(mock.calls.length,2);
  assert.deepEqual(JSON.parse(mock.calls[0].options.body).locations, [[-46.63,-23.55],[-46.65,-23.56],[-46.66,-23.57]]);
  assert.deepEqual(JSON.parse(mock.calls[1].options.body).coordinates,[[-46.63,-23.55],[-46.66,-23.57],[-46.65,-23.56]]);
  assert.equal(JSON.parse(mock.calls[1].options.body).instructions, true, 'ORS requires instructions to include per-leg segments');
  assert.equal(mock.calls[0].options.headers.Authorization,'test-key');
  assert.deepEqual(result.legs.map(leg=>leg.address),[addresses[2],addresses[1]]);
  assert.equal(result.meters,300); assert.equal(result.seconds,3);
  assert.deepEqual(result.geometry,geometry); assert.ok(validResult(result,2));
  assert.equal(validResult({...result,geometry:[[Infinity,0]]},2),false);
});
test('geocodes typed addresses and keeps resolved names', async () => {
  const mock=mockedService();
  const result=await calculateRoute(['Praça da Sé, São Paulo',...addresses.slice(1)],{apiKey:'test',fetchImpl:mock.fetchImpl});
  assert.equal(mock.calls.length,3); assert.equal(result.origin.label,'Praça da Sé, São Paulo');
  assert.match(mock.calls[0].url,/boundary.country=BR/);
  assert.ok(!mock.calls[0].url.includes('api_key'));
});
test('rejects missing key without making network calls', async () => {
  await assert.rejects(calculateRoute(addresses,{apiKey:'',fetchImpl:()=>{throw new Error('Should not call');}}),/Configure a chave/);
});
test('handles invalid keys and exhausted quota',async()=>{
  for(const [status,message] of [[403,/chave/],[429,/limite/]]) await assert.rejects(calculateRoute(addresses,{apiKey:'test',fetchImpl:async()=>({ok:false,status})}),message);
});
test('refuses missing, vague and ambiguous geocoding',async()=>{
  for(const features of [[],[{geometry:{coordinates:[-46,-23]},properties:{confidence:0.4}}],[{geometry:{coordinates:[-46,-23]},properties:{confidence:1}},{geometry:{coordinates:[-47,-24]},properties:{confidence:1}}]]) {
    const mock=mockedService({geocode:{features}});
    await assert.rejects(calculateRoute(['Rua A',...addresses.slice(1)],{apiKey:'test',fetchImpl:mock.fetchImpl}));
    assert.equal(mock.calls.length,1);
  }
});
test('null matrix entries are unreachable, never zero time',async()=>{
  const mock=mockedService({matrix:{durations:[[0,null,null],[null,0,null],[null,null,0]]}});
  await assert.rejects(calculateRoute(addresses,{apiKey:'test',fetchImpl:mock.fetchImpl}),/conectar/);
});
test('incomplete geometry does not produce a successful route',async()=>{
  const mock=mockedService({directions:{features:[]}});
  await assert.rejects(calculateRoute(addresses,{apiKey:'test',fetchImpl:mock.fetchImpl}),/incompleto/);
});
test('map data cannot inject script markup',async()=>{
  const mock=mockedService();
  const result=await calculateRoute(addresses,{apiKey:'test',fetchImpl:mock.fetchImpl});
  result.origin.label='</script><script>alert(1)</script>';
  const html=mapHtml(result,1);
  assert.ok(!html.includes(result.origin.label));
  assert.ok(html.includes('textContent='));
  assert.ok(html.includes('OpenStreetMap'));
});
