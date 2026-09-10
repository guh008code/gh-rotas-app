# GH Rotas

App Expo / React Native para Android, iOS e web, sem login. Planeja viagens com até 8 destinos, salva favoritos e histórico no aparelho e mostra um mapa interativo com a sequência das paradas.

## Testar no emulador Android

Requer Node 22.13+, Android Studio com um emulador criado e Expo Go compatível com SDK 57.

1. Execute todos os comandos na pasta que contém este README e o `package.json`.
2. Instale as dependências: `npm install`.
3. Crie uma conta e uma chave gratuita no [OpenRouteService / HeiGIT](https://account.heigit.org/).
4. Abra `.env.local` (já preparado localmente; em um clone novo, copie `.env.example`). Preencha somente `ORS_API_KEY=sua_chave`. Não envie a chave ao GitHub nem use o prefixo `EXPO_PUBLIC_` para ela.
5. Inicie o serviço de rotas em um terminal:

```bash
npm run server
```

6. Abra o emulador pelo Device Manager do Android Studio. Em outro terminal:

```bash
npm run android
```

O app usa automaticamente `http://10.0.2.2:3001` para acessar o servidor do computador a partir do emulador padrão do Android Studio. Se você definiu `EXPO_PUBLIC_ROUTES_API_URL` anteriormente, remova/comente essa variável para usar o padrão. Reinicie o servidor após preencher a chave e o Expo após alterar o ambiente. `npx expo start` também funciona: a detecção do emulador acontece dentro do app. O servidor continua sendo um processo separado; mantenha `npm run server` aberto.

### Roteiro de teste

- O mapa do Brasil deve carregar mesmo sem chave ORS (precisa de internet).
- Informe partida e pelo menos um destino. Para o primeiro teste, use coordenadas de locais públicos de São Paulo, evitando depender da busca de endereços:
  - Partida: `-23.5505, -46.6333`
  - Destino 1: `-23.5614, -46.6559`
  - Destino 2: `-23.5874, -46.6576`
- Toque em **Buscar Rotas**. Com chave válida, a rota aparece em roxo e as paradas são numeradas na ordem calculada.
- Após calcular, o app abre uma tela dedicada à viagem: mapa, partida e destinos em sequência, sem o formulário e os menus de planejamento. A próxima parada fica destacada.
- Use **Editar rota** (ou Voltar no Android) para retornar ao formulário com os endereços preservados. Uma nova busca reinicia a sequência de conclusões.
- Confira os locais encontrados no mapa e na lista antes de abrir a navegação. O botão de navegar abre o aplicativo de mapas externo; a tela interna ainda não acompanha o GPS em tempo real.
- Salve um favorito, reabra o app e reutilize os endereços.
- Marque as paradas como concluídas; a última deve salvar a viagem no histórico.
- Depois teste endereços completos com número, cidade e estado. A busca textual está limitada ao Brasil.
- Para testar GPS, configure a localização simulada no painel de controles estendidos do emulador. Não há acompanhamento de posição em tempo real.

Sem chave, o mapa de fundo e os favoritos funcionam; a busca mostra uma mensagem de configuração. Nenhuma rota fictícia é apresentada como real.

## Web, iOS e celular físico

`npm run web` e `npm run ios` usam `http://localhost:3001` por padrão. No navegador, `APP_ORIGIN` deve corresponder à origem exibida pelo Expo (padrão `http://localhost:8081`; ajuste se a porta mudar).

Para celular físico, configure em `.env.local`:

```dotenv
EXPO_PUBLIC_ROUTES_API_URL=http://IP-LOCAL-DO-COMPUTADOR:3001
HOST=0.0.0.0
```

Use a mesma rede Wi-Fi e libere a porta 3001 no firewall local se necessário. O mapa usa WebView/Leaflet no Android e iOS, e iframe/Leaflet na web; não exige Google Maps SDK nem chave Google. A validação em um emulador/aparelho nativo ainda deve ser realizada. A conexão com a API real e o desenho de rotas foram verificados com coordenadas públicas de São Paulo. O HTTP local é destinado ao desenvolvimento com Expo Go; builds distribuídas devem usar um servidor HTTPS.

## Como funciona

1. O servidor converte os endereços em coordenadas com o geocodificador do OpenRouteService. Coordenadas digitadas/GPS dispensam essa consulta. Resultados ausentes, imprecisos ou ambíguos são recusados.
2. Consulta a matriz de tempos do perfil `driving-car`.
3. O algoritmo local encontra a sequência de menor soma de tempos nessa matriz, com origem fixa e última parada livre, sem retorno à origem.
4. Consulta Directions para obter a geometria pelas ruas e os tempos/distâncias de cada trecho da sequência.
5. O app exibe o trajeto e abre a próxima parada no Google Maps ou, no iOS, também no Mapas da Apple, usando as coordenadas encontradas.

Estimativas não incluem trânsito ao vivo, tempo de atendimento, janelas de entrega ou restrições de caminhões. Os tempos de Directions podem variar ligeiramente dos da matriz; a ordem minimiza a matriz, não garante o menor tempo real da viagem. O navegador externo pode recalcular cada trecho.

Cada busca consome até 9 consultas de geocodificação (uma por endereço), 1 Matrix e 1 Directions. As cotas são compartilhadas pela chave e devem ser conferidas no [painel](https://account.heigit.org/info/plans). Não há cobrança Google para calcular as rotas.

## Dados e mapa de fundo

Favoritos e histórico ficam apenas no dispositivo via AsyncStorage. O servidor não persiste endereços, rotas ou chaves em logs. O OpenRouteService recebe os endereços/coordenadas para calcular. O OpenStreetMap recebe as solicitações das imagens do mapa; Leaflet é carregado pelo CDN unpkg. A navegação externa compartilha as coordenadas do trecho com o provedor escolhido.

Atribuição do OpenStreetMap permanece visível. Os tiles públicos são usados somente sob demanda, com cache normal do navegador/WebView, sem downloads offline ou pré-carregamento em massa. O WebView identifica o aplicativo no User-Agent. Para distribuição e crescimento, escolha um provedor de tiles com capacidade apropriada e cumpra a [política de tiles do OSM](https://operations.osmfoundation.org/policies/tiles/). Não há garantia de disponibilidade do serviço público.

A viagem em andamento não é restaurada após fechar o app. Desinstalar o app ou limpar dados do navegador pode apagar favoritos/histórico.

O servidor incluído é para desenvolvimento local. Antes de disponibilizá-lo na internet, configure HTTPS e controle de abuso/consumo da chave; CORS e o limite básico por IP não substituem essa proteção. Isso não exige login dos usuários.

## Verificar

```bash
npm run typecheck
npm test
npx expo export --platform web
npx expo export --platform android
```

Os testes automatizados de integração usam respostas simuladas do provedor, identificadas como mocks no código. Também foi feita uma consulta manual com chave válida. A resposta real exige `instructions: true` em Directions para incluir os totais por trecho em `properties.segments`. Cobrem coordenadas, geocodificação, ordenação, geometria, cotas, chave inválida, locais inacessíveis e segurança do HTML do mapa.

Referências: [Expo 57](https://docs.expo.dev/versions/v57.0.0/), [ORS Matrix](https://giscience.github.io/openrouteservice/api-reference/endpoints/matrix/), [ORS Directions](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/), [Leaflet](https://leafletjs.com/).
