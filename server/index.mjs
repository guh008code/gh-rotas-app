import { createServer } from 'node:http';
import { optimize } from './optimizer.mjs';

// Development service. Never expose a billable API publicly without abuse protection.
const port = Number(process.env.PORT || 3001);
const allowedOrigin = process.env.APP_ORIGIN || 'http://localhost:8081';
const requests = new Map();
createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.headers.origin === allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  const send = (status, value) => { res.writeHead(status); res.end(JSON.stringify(value)); };
  if (req.headers.origin && req.headers.origin !== allowedOrigin) return send(403, { error: 'Origem não autorizada.' });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.url !== '/routes' || req.method !== 'POST') return send(404, { error: 'Não encontrado.' });
  const now = Date.now();
  for (const [key, value] of requests) if (value.until < now) requests.delete(key);
  const ip = req.socket.remoteAddress;
  const count = requests.get(ip) || { until: now + 60000, count: 0 };
  requests.set(ip, count);
  if (++count.count > 10) return send(429, { error: 'Aguarde um minuto antes de buscar novamente.' });
  if (!process.env.GOOGLE_MAPS_API_KEY) return send(503, { error: 'O cálculo de rotas ainda não foi configurado. Você já pode salvar seus endereços nos favoritos.' });
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 12000) return send(413, { error: 'Solicitação muito grande.' });
    }
    let input;
    try { input = JSON.parse(body); } catch { return send(400, { error: 'Solicitação inválida.' }); }
    const { origin, stops } = input || {};
    const valid = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
    if (!valid(origin) || !Array.isArray(stops) || stops.length < 1 || stops.length > 8 || !stops.every(valid)) return send(400, { error: 'Informe a partida e de 1 a 8 destinos válidos.' });
    const addresses = [origin.trim(), ...stops.map(s => s.trim())];
    if (new Set(addresses.map(s => s.toLocaleLowerCase('pt-BR'))).size !== addresses.length) return send(400, { error: 'Os endereços devem ser diferentes.' });
    const points = addresses.map(address => {
      const coordinates = address.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
      if (coordinates) {
        const latitude = Number(coordinates[1]), longitude = Number(coordinates[2]);
        if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { waypoint: { location: { latLng: { latitude, longitude } } } };
      }
      return { waypoint: { address } };
    });
    const response = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY, 'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition' },
      body: JSON.stringify({ origins: points, destinations: points, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', languageCode: 'pt-BR', regionCode: 'BR' }),
    });
    if (!response.ok) return send(502, { error: 'O serviço de mapas não conseguiu calcular. Confira a configuração da Routes API e tente novamente.' });
    const entries = await response.json();
    if (!Array.isArray(entries)) throw new Error('Invalid matrix');
    const durations = addresses.map(() => addresses.map(() => Infinity));
    const distances = addresses.map(() => addresses.map(() => 0));
    for (const entry of entries) {
      const i = entry.originIndex ?? 0, j = entry.destinationIndex ?? 0;
      const seconds = Number(String(entry.duration).replace(/s$/, ''));
      if (i >= 0 && i < points.length && j >= 0 && j < points.length && entry.condition === 'ROUTE_EXISTS' && !entry.status?.code && Number.isFinite(seconds) && seconds >= 0) {
        durations[i][j] = seconds;
        distances[i][j] = entry.distanceMeters || 0;
      }
    }
    let result;
    try { result = optimize(durations); } catch (error) { return send(422, { error: error.message }); }
    let previous = 0;
    const legs = result.order.map(index => {
      const leg = { address: addresses[index], seconds: durations[previous][index], meters: distances[previous][index] };
      previous = index;
      return leg;
    });
    send(200, { legs, seconds: result.seconds, meters: legs.reduce((sum, leg) => sum + leg.meters, 0) });
  } catch { send(502, { error: 'Não foi possível acessar o serviço de mapas. Tente novamente.' }); }
}).listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Serviço de rotas na porta ${port}`));
