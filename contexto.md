# Contexto do projeto — GH Rotas

Última atualização: 10/09/2026.

Este documento registra as regras de produto, as decisões de arquitetura e os padrões adotados no projeto. O README contém as instruções operacionais de execução e teste. Atualizar ambos quando uma decisão alterar o funcionamento do app; distinguir funcionalidades implementadas de possibilidades futuras.

## Objetivo e plataformas

Aplicativo de planejamento de rotas logísticas, com interface simples, moderna e minimalista em português do Brasil. O usuário informa a partida e os destinos, e o app organiza a sequência de menor tempo estimado de deslocamento.

Android e iOS são as plataformas principais. A versão web serve também para desenvolvimento e verificação da interface. A versão instalada deve funcionar usando a internet do próprio dispositivo, por Wi-Fi ou dados móveis, sem depender do computador do desenvolvedor.

## Regras de produto

1. Não exigir login nem criação de conta dos usuários.
2. Salvar favoritos e histórico de viagens concluídas somente no dispositivo, usando AsyncStorage. Não implementar sincronização em nuvem como parte do escopo atual.
3. Aceitar a partida digitada como endereço ou coordenadas. A opção de localização utiliza o GPS do dispositivo após permissão do usuário; se não houver permissão, permitir preenchimento manual.
4. Exigir uma partida e pelo menos um destino. O limite atual é de 8 destinos.
5. Permitir adicionar e remover destinos antes do cálculo, independentemente da ordem em que forem informados.
6. Consultar e organizar a rota somente após tocar em **Buscar Rotas**. Não fazer consultas automáticas enquanto o usuário digita.
7. Validar campos vazios, duplicados e endereços com mais de 500 caracteres. Não gerar resultados fictícios diante de falha de rede, configuração ausente ou resposta inválida.
8. Buscar endereços textuais no Brasil. Recusar resultados não encontrados, muito imprecisos ou ambíguos, orientando o usuário a complementar os dados. Mostrar os locais resolvidos para conferência antes da navegação.
9. Fixar a partida e permitir que o algoritmo escolha o último destino. Não incluir retorno automático à origem.
10. Otimizar pela soma dos tempos estimados entre os pontos, não pela menor distância em linha reta. O perfil atual é de carro, sem restrições específicas de caminhões.
11. Permitir salvar e reutilizar favoritos. Reutilizar um favorito preenche o formulário; uma nova busca recalcula a rota.
12. A conclusão de cada parada é manual. Concluir a última parada registra a viagem no histórico local.

## Fluxo de interface

### Planejamento

- Apresentar partida, destinos, opção de localização, adição/remoção de paradas, **Buscar Rotas** e salvamento de favoritos.
- Manter acesso a favoritos e histórico.
- Bloquear ações conflitantes durante localização, cálculo ou salvamento.
- Mostrar carregamento e mensagens de erro junto ao ponto de ação, especialmente ao botão de busca.
- O mapa de fundo pode carregar com internet mesmo antes do cálculo e sem a chave ORS configurada.

### Viagem calculada

- Após uma busca bem-sucedida, substituir a tela de planejamento por uma tela dedicada à viagem.
- Dar destaque ao mapa, ao endereço de partida e aos destinos numerados na ordem calculada. Destacar a próxima parada e diferenciar as concluídas.
- Não manter o formulário, o banner promocional ou os menus de planejamento nessa tela.
- Manter as ações essenciais: **Editar rota**, navegação externa e conclusão da parada/viagem.
- **Editar rota** e Voltar no Android retornam ao formulário com os endereços preservados. Uma nova busca reinicia o progresso de conclusões.
- Preservar os avisos de erro de navegação e salvamento na tela da viagem.

## Arquitetura atual: sem servidor próprio

O aplicativo acessa diretamente `https://api.openrouteservice.org` pela conexão do usuário. O OpenRouteService executa os cálculos rodoviários nos servidores do provedor; a ordenação das paradas e o armazenamento local acontecem no aparelho.

Fluxo:

1. Converter endereços em coordenadas pelo geocodificador ORS. Coordenadas digitadas ou obtidas pelo GPS dispensam essa consulta.
2. Consultar a matriz de tempos do perfil `driving-car`.
3. Executar no dispositivo o algoritmo de programação dinâmica que encontra a sequência de menor soma de tempos na matriz, para até 8 destinos.
4. Consultar Directions para obter a geometria do trajeto pelas ruas e os tempos/distâncias dos trechos.
5. Desenhar o trajeto no mapa e apresentar os locais resolvidos.

Decisões técnicas:

- Enviar `instructions: true` ao Directions: a resposta real do ORS omite `properties.segments` quando as instruções estão desativadas, incluindo os totais por trecho necessários ao app.
- Interpretar coordenadas GeoJSON como `[longitude, latitude]`; converter para `[latitude, longitude]` onde o mapa ou a navegação exigir.
- Tratar valores nulos/inválidos na matriz como trechos inacessíveis, nunca como tempo zero.
- Fazer geocodificação sequencial, validar as respostas e aplicar timeout à busca.
- Cada busca pode consumir até 9 consultas de geocodificação, 1 Matrix e 1 Directions.
- Não reintroduzir a dependência de `npm run server`, porta 3001, `localhost`, IP do computador ou `EXPO_PUBLIC_ROUTES_API_URL` para calcular rotas. Essa arquitetura foi substituída por decisão do projeto.

## Chave da API, Git e compilação

- A variável atual é **`EXPO_PUBLIC_ORS_API_KEY`**. A antiga `ORS_API_KEY`, usada pelo servidor local, foi substituída.
- Todos os usuários utilizam a mesma chave e compartilham a cota da conta ORS. Essa decisão foi explicitamente aceita pelo responsável pelo projeto.
- Para desenvolvimento, guardar o valor real em `.env.local`, ignorado pelo Git.
- Versionar somente `.env.example`, com o nome da variável e valor vazio. Nunca copiar a chave real para código-fonte, documentação, testes, comentários ou logs.
- Para builds remotos, configurar `EXPO_PUBLIC_ORS_API_KEY` no ambiente do projeto Expo/EAS utilizado pela compilação. O build deve receber a chave sem depender de um arquivo de credenciais no GitHub.
- A chave pode ir dentro do aplicativo compilado, conforme a decisão do projeto. Mantê-la fora do Git não a torna secreta dentro do aplicativo distribuído: valores incorporados podem ser extraídos.
- Não solicitar que cada usuário configure sua própria chave.
- Ao esgotar a cota, mostrar um aviso e preservar favoritos/histórico. A internet individual do usuário não cria uma cota individual.
- Manter `.env`, `.env.local`, dependências, caches e artefatos gerados fora do Git conforme `.gitignore`. Não forçar a inclusão desses arquivos.

## Mapa e navegação

- Usar OpenRouteService para endereços e cálculo; OpenStreetMap para o mapa de fundo.
- Renderizar com Leaflet em WebView no Android/iOS e iframe na web. Leaflet é carregado pelo CDN unpkg.
- Exibir a geometria real retornada pelo provedor, com linha roxa e marcadores de partida e destinos.
- Manter a atribuição visível ao OpenStreetMap. Carregar tiles sob demanda, respeitando o cache e a política do provedor, sem downloads em massa ou promessa de funcionamento offline.
- O WebView identifica o aplicativo no User-Agent. Tratar rótulos como texto, sem inserir conteúdo de endereços como HTML executável.
- A navegação externa abre o Google Maps com as coordenadas do próximo destino; no iOS, oferecer também Mapas da Apple. Não é necessária uma chave Google para essas URLs.

### Limites atuais e evolução possível

O mapa interno exibe o trajeto planejado. Ainda não implementa acompanhamento contínuo da posição, instruções por voz, orientação passo a passo, recálculo por desvio ou localização em segundo plano.

Essas funcionalidades de GPS automotivo foram discutidas como uma evolução possível, não como recursos já entregues. Não anunciá-las como disponíveis.

As estimativas atuais não consideram trânsito ao vivo, tempo de atendimento ou janelas de entrega. Os tempos do Directions podem variar em relação aos da matriz; a sequência minimiza a matriz, sem garantir o menor tempo real de viagem. O app de navegação externo pode recalcular o trecho.

A viagem em andamento não é restaurada após fechar o aplicativo. Desinstalar ou limpar os dados pode remover favoritos e histórico.

## Padrões de organização e implementação

- Base atual: Expo SDK 57, React Native, Expo Router e TypeScript; Node 22.13+ para desenvolvimento.
- Seguir `AGENTS.md`: ler a documentação da versão exata do Expo antes de escrever código dependente do SDK.
- `src/app/index.tsx`: estado principal e fluxo de planejamento, favoritos, histórico e transição para a viagem.
- `src/components/active-trip.tsx`: apresentação da viagem calculada.
- `src/components/route-map.tsx` e `route-map.web.tsx`: componentes de mapa por plataforma.
- `src/lib/map-html.ts`: documento do mapa compartilhado entre as plataformas, com dados escapados.
- `src/lib/routes.ts`: contratos de dados, validação, entrada da busca e leitura dos registros locais.
- `src/lib/openrouteservice.js`: integração direta com o provedor.
- `src/lib/optimizer.js`: algoritmo de ordenação, independente da interface e da rede.
- Os módulos JavaScript de cálculo possuem contratos `.d.ts` para consumo pelo TypeScript.
- Manter componentes de apresentação separados da integração e do algoritmo. Reutilizar a lógica entre plataformas e limitar diferenças de plataforma aos pontos necessários.
- Não embutir dependências de Node/servidor no código executado pelo aplicativo.
- Usar rótulos acessíveis em campos e botões, estados de carregamento e mensagens em português claro.
- Preservar alterações e assets do usuário ao executar outros ajustes.

## Identidade visual

- Interface moderna, minimalista, com prioridade à leitura em telas de celular.
- Paleta atualmente aplicada: roxo principal `#6D38C3`, fundo `#F7F6FA`, superfícies brancas, destaque suave `#EEE7FA` e texto escuro `#302044`.
- Usar espaçamento consistente, cantos arredondados, contraste legível e alvos de toque confortáveis.
- A referência inicial sugerida foi `https://app.opurple.com.br/Login.aspx`, mas sua paleta não foi confirmada por acesso à página. Os valores acima registram a identidade efetivamente implementada.
- A imagem fornecida pelo responsável, `icone_gh_rotas.png`, foi incorporada como `assets/images/gh-rotas-brand.png` e é usada no ícone Android/iOS, favicon web e tela nativa de abertura. Preservar a arte original, incluindo seu fundo.
- A tela de abertura usa a imagem centralizada, sem distorção, sobre fundo claro `#E5E5E5`. Alterações no ícone e na abertura nativa exigem uma nova compilação para validação final.

## Validação e publicação

Comandos disponíveis:

```bash
npm start
npm run android
npm run ios
npm run web
npm run typecheck
npm test
npx expo export --platform web
npx expo export --platform android
```

- Executar verificações proporcionais à mudança. Para alterações na integração e no algoritmo, testar sucesso, falhas de rede, chave ausente/inválida, cota, endereços ambíguos, matriz inacessível e geometria inválida.
- Usar fixtures e chaves fictícias em testes automatizados. Consultas reais de validação usam a configuração local e não devem imprimir a chave.
- Conferir visualmente mudanças de interface, incluindo a transição para a viagem e o retorno à edição.
- Distinguir exportação de bundle, teste em navegador/emulador e teste de um app de produção instalado. Um deles não comprova automaticamente os demais.
- Já foram verificados testes automatizados, TypeScript, bundles web/Android e cálculo real pela interface web sem servidor próprio. Após novas alterações, validar novamente o que for afetado.
- Antes da Google Play: finalizar assets, configurar identificador Android e perfis EAS, cadastrar a variável no ambiente do build, preparar política de privacidade/declarações de dados e testar a versão instalada em aparelhos reais, inclusive por dados móveis.
- Não afirmar que apenas alterar ícones torna o app pronto para publicação. A aprovação da loja e a configuração da compilação são etapas separadas.

## Privacidade e serviços externos

Favoritos e histórico permanecem no dispositivo, mas o cálculo online envia endereços/coordenadas ao OpenRouteService. A visualização consulta tiles do OpenStreetMap e carrega Leaflet do CDN; abrir a navegação compartilha as coordenadas do trecho com o aplicativo de mapas escolhido.

Comunicar esse funcionamento com clareza, inclusive na documentação e nos materiais de publicação. “Dados locais” não significa que o planejamento funciona inteiramente offline ou sem consultas a terceiros.
