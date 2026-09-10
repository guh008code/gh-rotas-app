export type Coordinate = [number, number]; // longitude, latitude (GeoJSON)
export type RoutePoint = { address: string; label: string; coordinate: Coordinate };
export type Leg = RoutePoint & { seconds: number; meters: number };
export type RouteResult = { origin: RoutePoint; legs: Leg[]; seconds: number; meters: number; geometry: Coordinate[]; provider: 'openrouteservice' };
export type SavedRoute = { id: string; origin: string; stops: string[]; date: string };
export type Library = { favorites: SavedRoute[]; history: SavedRoute[] };
export const storageKey = 'gh-rotas:library:v1';
export const apiUrl = process.env.EXPO_PUBLIC_ROUTES_API_URL;
export function validate(origin: string, stops: string[]) {
  const all = [origin, ...stops].map(value => value.trim());
  if (all.some(value => !value)) return 'Preencha a partida e todos os destinos ou remova as paradas vazias.';
  if (stops.length < 1 || stops.length > 8) return 'Informe de 1 a 8 destinos.';
  if (all.some(value => value.length > 500)) return 'Use endereços com até 500 caracteres.';
  if (new Set(all.map(value => value.toLocaleLowerCase('pt-BR'))).size !== all.length) return 'Informe endereços diferentes para cada parada.';
  return null;
}
export async function searchRoutes(origin: string, stops: string[], endpoint = apiUrl): Promise<RouteResult> {
  if (!endpoint) throw new Error('O cálculo de rotas ainda não foi configurado. Por enquanto, salve seus endereços nos favoritos.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65000);
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/routes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin, stops }), signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível calcular a rota.');
    if (!validResult(data, stops.length)) throw new Error('O serviço retornou uma rota inválida.');
    return data;
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error instanceof TypeError)) throw new Error('Não foi possível conectar ao serviço de rotas. No computador, execute npm run server e tente novamente.');
    throw error;
  } finally { clearTimeout(timer); }
}
export function readLibrary(raw: string | null): Library {
  if (!raw) return { favorites: [], history: [] };
  const data = JSON.parse(raw);
  const valid = (items: unknown): items is SavedRoute[] => Array.isArray(items) && items.every(item => typeof item?.id === 'string' && typeof item.origin === 'string' && Array.isArray(item.stops) && item.stops.every((s: unknown) => typeof s === 'string') && typeof item.date === 'string');
  if (!valid(data.favorites) || !valid(data.history)) throw new Error('Dados locais inválidos.');
  return data;
}

export function validResult(data: any, stopCount: number): data is RouteResult {
  const coordinate = (c: any) => Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
  const point = (p: any) => p && typeof p.address === 'string' && typeof p.label === 'string' && coordinate(p.coordinate);
  const positive = (n: any) => Number.isFinite(n) && n >= 0;
  return !!data && data.provider === 'openrouteservice' && point(data.origin) && Array.isArray(data.legs) && data.legs.length === stopCount && data.legs.every((leg: any) => point(leg) && positive(leg.seconds) && positive(leg.meters)) && positive(data.seconds) && positive(data.meters) && Array.isArray(data.geometry) && data.geometry.length >= 2 && data.geometry.every(coordinate);
}
