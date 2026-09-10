import { useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { mapHtml } from '@/lib/map-html';
import type { RouteResult } from '@/lib/routes';

export default function RouteMap({ result, completed = 0, height = 340 }: { result: RouteResult | null; completed?: number; height?: number }) {
  const html = useMemo(() => mapHtml(result, completed), [result, completed]);
  const [failed, setFailed] = useState(false);
  return <View style={{ height, borderRadius: 16, overflow: 'hidden', backgroundColor: '#EEE7FA' }}>
    {failed ? <Text style={{ padding: 20 }}>Não foi possível abrir o mapa. Reabra o aplicativo e confira sua conexão.</Text> : <WebView
      source={{ html }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled
      applicationNameForUserAgent="GHRotas/1.0 (https://github.com/guh008code/gh-rotas-app)"
      onError={() => setFailed(true)} nestedScrollEnabled
      onShouldStartLoadWithRequest={request => {
        if (request.url === 'about:blank' || request.url.startsWith('about:srcdoc')) return true;
        if (request.url === 'https://www.openstreetmap.org/copyright' || request.url === 'https://leafletjs.com/') void Linking.openURL(request.url).catch(() => {});
        return false;
      }}
      style={{ flex: 1 }} />}
  </View>;
}
