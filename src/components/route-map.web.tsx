import { useMemo } from 'react';
import { mapHtml } from '@/lib/map-html';
import type { RouteResult } from '@/lib/routes';

export default function RouteMap({ result, completed = 0, height = 340 }: { result: RouteResult | null; completed?: number; height?: number }) {
  const html = useMemo(() => mapHtml(result, completed), [result, completed]);
  return <iframe title="Mapa do trajeto e das paradas" srcDoc={html} sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" style={{ width: '100%', height, border: 0, borderRadius: 16 }} />;
}
