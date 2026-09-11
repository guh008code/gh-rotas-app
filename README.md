# GH Rotas

Aplicativo Expo / React Native para Android, iOS e web. Planeja viagens com até 8 destinos, sem login, e salva favoritos e histórico no aparelho.

## Executar

Requer Node 22.13+ e Expo Go compatível com SDK 57.

1. Execute os comandos na pasta deste README e do `package.json`.
2. Instale as dependências com `npm install`.
3. Copie `.env.example` para `.env.local` se esse arquivo ainda não existir.
4. Preencha `EXPO_PUBLIC_ORS_API_KEY` com a chave do [OpenRouteService / HeiGIT](https://account.heigit.org/).
5. Execute:

```bash
npm start
```

Para abrir diretamente uma plataforma:

```bash
npm run android
npm run ios
npm run web
```

No Android, abra antes o emulador no Device Manager do Android Studio. Celulares físicos podem abrir o projeto pelo QR code do Expo. A conexão de desenvolvimento com o Expo continua necessária no Expo Go; uma versão de produção instalada funciona sem o computador.

**Não há servidor próprio.** O aplicativo consulta `https://api.openrouteservice.org` diretamente usando Wi-Fi ou dados móveis. Não é necessário configurar porta 3001, IP do computador ou executar `npm run server`.

Ao migrar da versão anterior, pare o Expo e inicie novamente para carregar `EXPO_PUBLIC_ORS_API_KEY`. A antiga variável `ORS_API_KEY` não é mais utilizada. Depois de alterar a chave, recarregue o app; versões instaladas precisam receber uma nova compilação ou atualização compatível.

## Chave compartilhada

Todos os usuários utilizam a mesma chave e consomem a mesma cota do OpenRouteService. Por decisão do projeto, a chave é incorporada ao aplicativo e pode ser extraída da versão distribuída. O prefixo `EXPO_PUBLIC_` indica exatamente isso: não há promessa de segredo dentro do app.

O arquivo `.env.local` continua ignorado pelo Git. Não coloque o valor real em `.env.example`, em código-fonte ou no README. Confira as cotas no [painel](https://account.heigit.org/info/plans). Ao esgotar a cota, o aplicativo mostra uma mensagem e preserva os dados locais.

Para uma futura compilação EAS, configure `EXPO_PUBLIC_ORS_API_KEY` no ambiente utilizado pelo build. O `.env.local` ignorado pelo Git não deve ser a única configuração de uma compilação remota. A preparação de publicação ainda inclui identificador Android, perfis EAS, política de privacidade e testes de uma versão instalada.

## Roteiro de teste

- O mapa de fundo deve carregar com internet mesmo sem a chave ORS.
- Para testar o cálculo sem depender da busca textual, use estes locais públicos de São Paulo:
  - Partida: `-23.5505, -46.6333`
  - Destino 1: `-23.5614, -46.6559`
  - Destino 2: `-23.5874, -46.6576`
- Toque em **Buscar Rotas**. O app abre a tela da viagem com o trajeto em roxo, partida e destinos numerados. A próxima parada fica destacada.
- Use **Editar rota** ou Voltar no Android para retornar ao formulário com os endereços preservados. Uma nova busca reinicia as conclusões.
- Teste favoritos e histórico. A última parada concluída registra a viagem no aparelho.
- Teste também endereços completos, com número, cidade e estado. A busca textual está limitada ao Brasil; resultados ausentes, imprecisos ou ambíguos geram um aviso.
- Para testar GPS no emulador, configure a localização simulada nos controles estendidos. A localização atualmente preenche a partida; não há acompanhamento em tempo real.

O botão de navegação abre o próximo destino no Google Maps; no iOS também há opção de Mapas da Apple. A tela interna mostra o trajeto planejado, sem instruções por voz ou recálculo automático.

## Como funciona

1. O app converte endereços em coordenadas pelo geocodificador do OpenRouteService. Coordenadas digitadas/GPS dispensam essa consulta.
2. Obtém a matriz de tempos do perfil `driving-car`.
3. Encontra no dispositivo a sequência de menor soma de tempos nessa matriz, com origem fixa e último destino livre, sem retorno à origem.
4. Consulta Directions para obter o desenho pelas ruas e os totais por trecho.
5. Exibe o resultado no mapa e mantém favoritos/histórico localmente.

Cada busca usa até 9 consultas de geocodificação, 1 Matrix e 1 Directions. Não há consulta automática enquanto o usuário digita. A busca tem timeout e mostra falhas de conexão, chave inválida e cota esgotada.

Estimativas não incluem trânsito em tempo real, tempo de atendimento, janelas de entrega ou restrições de caminhões. Os tempos de Directions podem diferir ligeiramente dos da matriz; a ordem minimiza a matriz, não garante o menor tempo real. Directions precisa de `instructions: true` para incluir os totais por trecho em `properties.segments`.

## Dados e mapa

Favoritos e histórico são armazenados via AsyncStorage no dispositivo. A viagem em andamento não é restaurada ao fechar o app. Desinstalar ou limpar os dados pode apagar os registros.

O OpenRouteService recebe os endereços/coordenadas necessários para calcular. O OpenStreetMap recebe solicitações de imagens do mapa e o CDN unpkg fornece Leaflet. A navegação externa compartilha as coordenadas do trecho com o provedor escolhido.

O mapa usa WebView/Leaflet no Android e iOS e iframe/Leaflet na web. Não exige chave do Google. A atribuição do OpenStreetMap permanece visível; os tiles são carregados sob demanda, sem downloads offline ou pré-carregamento em massa, usando o cache normal do navegador/WebView. O WebView identifica o aplicativo no User-Agent. Para distribuição e crescimento, respeite a [política de tiles do OSM](https://operations.osmfoundation.org/policies/tiles/) e escolha um provedor com capacidade apropriada; o serviço público não garante disponibilidade.

## Verificar

```bash
npm run typecheck
npm test
npx expo export --platform web
npx expo export --platform android
```

Os testes automatizados usam respostas simuladas e cobrem chamadas diretas HTTPS, falhas de rede, cota, chave ausente, endereços ambíguos, geometria, otimização e armazenamento. O teste manual com chave válida é separado; não registre a chave em logs.

Referências: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Variáveis de ambiente](https://docs.expo.dev/guides/environment-variables/), [OpenRouteService](https://openrouteservice.org/), [Leaflet](https://leafletjs.com/).

## Ícone e tela de abertura

A arte fornecida pelo responsável está em `assets/images/gh-rotas-brand.png` e é compartilhada pelo ícone Android/iOS, favicon e tela nativa de abertura. A imagem original de 512 × 512 foi preservada sem cortes. A configuração está em `app.json`; as referências aos ícones Expo de demonstração foram substituídas nas configurações de publicação.

Para conferir o ícone instalado e a abertura real, gere e instale uma nova compilação. O Expo Go e o recarregamento JavaScript não reproduzem integralmente essas alterações nativas. A arte contém um fundo claro e um padrão ao redor da marca; ambos fazem parte da imagem fornecida.
