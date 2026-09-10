# GH Rotas

Aplicativo Expo / React Native para planejar viagens com várias paradas, sem login. Interface em português para Android, iOS e web.

## Executar

Requer Node 22.13+ e npm.

```bash
npm install
npm start
```

Abra pelo Expo Go no celular ou use `npm run android`, `npm run ios` ou `npm run web`. Localização requer permissão do dispositivo; no navegador, HTTPS ou localhost. As plataformas móveis ainda precisam de validação em aparelhos reais.

## Funcionalidades

- Partida digitada ou obtida por GPS e de 1 a 8 destinos.
- Cálculo somente ao tocar em **Buscar Rotas**, após validar os campos.
- Sequência de menor tempo total estimado, usando as durações rodoviárias do Google e programação dinâmica exata. Origem fixa, destino final livre, sem retorno à origem. Não considera trânsito em tempo real, tempo de atendimento, janelas de entrega ou restrições de caminhões.
- Abertura de cada trecho no Google Maps; no iOS, também no Mapas da Apple. O navegador externo pode recalcular o trecho.
- Conclusão manual de cada parada; a última conclusão registra a viagem no histórico.
- Favoritos e histórico persistidos apenas no aparelho por AsyncStorage. Favoritos guardam endereços e são recalculados ao reutilizar. Desinstalar o app ou apagar dados do navegador pode removê-los. A viagem em andamento não é recuperada ao fechar o app.

Sem configurar o serviço de mapas, os formulários e favoritos funcionam, mas o app não inventa cálculos nem apresenta uma sequência otimizada.

## Habilitar o cálculo real

1. Crie um projeto no Google Cloud, habilite o faturamento e a **Routes API**. O serviço pode gerar cobranças.
2. Crie uma chave restrita à Routes API e ao IP do servidor quando aplicável.
3. Copie `.env.example` para `.env.local` e preencha `GOOGLE_MAPS_API_KEY`. Nunca coloque essa chave em uma variável `EXPO_PUBLIC_` ou no código do app.
4. Execute `npm run server` e, em outro terminal, `npm start`.
5. Para testar no celular, configure `HOST=0.0.0.0` e `EXPO_PUBLIC_ROUTES_API_URL=http://IP-LOCAL-DO-COMPUTADOR:3001`. Use a mesma rede Wi-Fi e reinicie o Expo após alterar o ambiente. No navegador, ajuste `APP_ORIGIN` se a origem não for `http://localhost:8081`.

O servidor Node não grava endereços ou viagens: recebe os endereços, consulta a matriz de trajetos do Google e devolve a sequência. O histórico/favoritos permanecem no dispositivo. Ao abrir mapas externos, a partida e o destino do trecho são compartilhados com o provedor escolhido.

O servidor incluído é para desenvolvimento local, com limite básico de requisições e tamanho de corpo. Antes de disponibilizá-lo na internet, providencie HTTPS, proteção contra abuso (por exemplo, atestação do app), limites globais de consumo e configuração de orçamento. CORS não substitui controle contra abuso; isso não exige criar login para o usuário.

## Verificar

```bash
npm run typecheck
npm test
npx expo export --platform web
```

Os testes cobrem otimização global, caminhos inacessíveis, comparação com busca exaustiva de 8 paradas, validação de formulário e leitura do armazenamento. O teste real da Routes API exige uma chave configurada.

Referências: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Google Routes API](https://developers.google.com/maps/documentation/routes/compute_route_matrix), [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).
