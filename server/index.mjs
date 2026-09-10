import { createServer } from 'node:http';
import { calculateRoute, RouteError } from './openrouteservice.mjs';

// Development service. Protect the shared API quota before public deployment.
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
  if (req.url === '/health' && req.method === 'GET') return send(200, { service: 'gh-rotas', configured: Boolean(process.env.ORS_API_KEY?.trim()) });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.url !== '/routes' || req.method !== 'POST') return send(404, { error: 'Não encontrado.' });
  const now = Date.now();
  for (const [key, value] of requests) if (value.until < now) requests.delete(key);
  const ip = req.socket.remoteAddress;
  const count = requests.get(ip) || { until: now + 60000, count: 0 };
  requests.set(ip, count);
  if (++count.count > 10) return send(429, { error: 'Aguarde um minuto antes de buscar novamente.' });
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
    const result = await calculateRoute(addresses, { apiKey: process.env.ORS_API_KEY });
    send(200, result);
  } catch (error) {
    if (error instanceof RouteError) return send(error.status, { error: error.message });
    send(502, { error: 'Não foi possível acessar o OpenRouteService. Verifique a conexão e tente novamente.' });
  }
}).listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Serviço de rotas na porta ${port}`));
