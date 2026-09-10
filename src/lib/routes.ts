export type Leg = { address: string; seconds: number; meters: number };
export type RouteResult = { legs: Leg[]; seconds: number; meters: number };
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
export async function searchRoutes(origin: string, stops: string[]): Promise<RouteResult> {
  if (!apiUrl) throw new Error('O cálculo de rotas ainda não foi configurado. Por enquanto, salve seus endereços nos favoritos.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/routes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin, stops }), signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível calcular a rota.');
    if (!Array.isArray(data.legs) || data.legs.length !== stops.length || !Number.isFinite(data.seconds) || !Number.isFinite(data.meters) || !data.legs.every((leg: Leg) => typeof leg.address === 'string' && Number.isFinite(leg.seconds) && Number.isFinite(leg.meters))) throw new Error('O serviço retornou uma rota inválida.');
    return data;
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error instanceof TypeError)) throw new Error('Verifique sua conexão e se o serviço de rotas está disponível.');
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
