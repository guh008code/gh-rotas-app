import type { RouteResult } from './routes';
export class RouteError extends Error {
  status: number;
  constructor(message: string, status?: number);
}
export function calculateRoute(addresses: string[], options: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<RouteResult>;
