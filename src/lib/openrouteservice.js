import { optimize } from './optimizer.js';

export class RouteError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
const validCoordinate = point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;
const nonnegative = value => Number.isFinite(value) && value >= 0;

export async function calculateRoute(addresses, { apiKey, fetchImpl = fetch, signal }) {
  if (!apiKey) throw new RouteError('Configure a chave do OpenRouteService para calcular os trajetos. O mapa e os favoritos já estão disponíveis.', 503);
  async function request(path, body) {
    const response = await fetchImpl(`https://api.openrouteservice.org${path}`, {
      method: body ? 'POST' : 'GET', signal,
      headers: { Authorization: apiKey, ...(body && { 'Content-Type': 'application/json' }) },
      ...(body && { body: JSON.stringify(body) }),
    });
    if (response.status === 401 || response.status === 403) throw new RouteError('A chave do OpenRouteService não foi aceita. Confira a chave e as permissões no painel do serviço.', 503);
    if (response.status === 429) throw new RouteError('O limite de consultas do OpenRouteService foi atingido. Aguarde e tente novamente.', 429);
    if (response.status === 400 || response.status === 404) throw new RouteError('Não foi possível traçar uma rota entre esses pontos. Confira os endereços e o acesso por carro.', 422);
    if (!response.ok) throw new RouteError('O OpenRouteService está indisponível. Tente novamente em instantes.');
    return response.json();
  }
  // Sequential geocoding avoids bursts against the free account's rate limit.
  const points = [];
  for (const address of addresses) {
    const match = address.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if (match) {
      const coordinate = [Number(match[2]), Number(match[1])];
      if (!validCoordinate(coordinate)) throw new RouteError('Coordenadas fora dos limites. Confira latitude e longitude.', 400);
      points.push({ address, label: address, coordinate });
      continue;
    }
    const query = new URLSearchParams({ text: address, size: '2', 'boundary.country': 'BR' });
    const data = await request(`/geocode/search?${query}`);
    const candidates = (data.features || []).filter(feature => validCoordinate(feature.geometry?.coordinates));
    const hit = candidates[0];
    if (!hit) throw new RouteError(`Endereço não encontrado: ${address}. Inclua número, cidade e estado.`, 422);
    const confidence = hit.properties?.confidence;
    if (typeof confidence === 'number' && confidence < 0.7) throw new RouteError(`Endereço impreciso: ${address}. Inclua número, cidade e estado ou use coordenadas.`, 422);
    const second = candidates[1];
    if (second && typeof confidence === 'number' && typeof second.properties?.confidence === 'number' && confidence - second.properties.confidence < 0.05 && Math.hypot(hit.geometry.coordinates[0] - second.geometry.coordinates[0], hit.geometry.coordinates[1] - second.geometry.coordinates[1]) > 0.01) {
      throw new RouteError(`Há mais de um local para: ${address}. Acrescente cidade, estado e CEP.`, 422);
    }
    points.push({ address, label: hit.properties?.label || address, coordinate: hit.geometry.coordinates.slice(0, 2) });
  }
  if (new Set(points.map(point => point.coordinate.join(','))).size !== points.length) throw new RouteError('Dois endereços apontam para o mesmo local. Confira as paradas.', 422);
  const matrix = await request('/v2/matrix/driving-car', { locations: points.map(p => p.coordinate), metrics: ['duration'], resolve_locations: false });
  if (!Array.isArray(matrix.durations) || matrix.durations.length !== points.length || matrix.durations.some(row => !Array.isArray(row) || row.length !== points.length)) throw new RouteError('O serviço retornou tempos inválidos. Tente novamente.');
  const durations = matrix.durations.map(row => row.map(value => nonnegative(value) ? value : Infinity));
  let optimized;
  try { optimized = optimize(durations); } catch (error) { throw new RouteError(error.message, 422); }
  const ordered = [points[0], ...optimized.order.map(index => points[index])];
  // ORS omits properties.segments when instructions=false, including each leg's totals.
  const directions = await request('/v2/directions/driving-car/geojson', { coordinates: ordered.map(point => point.coordinate), instructions: true, elevation: false, preference: 'fastest' });
  const route = directions.features?.[0];
  const geometry = route?.geometry?.coordinates;
  const segments = route?.properties?.segments;
  if (route?.geometry?.type !== 'LineString' || !Array.isArray(geometry) || geometry.length < 2 || !geometry.every(validCoordinate) || !Array.isArray(segments) || segments.length !== ordered.length - 1 || !segments.every(segment => nonnegative(segment.duration) && nonnegative(segment.distance))) throw new RouteError('O serviço retornou um trajeto incompleto. Tente novamente.');
  const legs = ordered.slice(1).map((point, index) => ({ ...point, seconds: segments[index].duration, meters: segments[index].distance }));
  return {
    origin: ordered[0], legs, geometry: geometry.map(point => point.slice(0, 2)),
    seconds: legs.reduce((sum, leg) => sum + leg.seconds, 0),
    meters: legs.reduce((sum, leg) => sum + leg.meters, 0),
    provider: 'openrouteservice',
  };
}
