# Catálogo dependente só do IGDB, e busca funcionando

## Pedido original

Depois de ativar a integração com o IGDB (doc `00`), o usuário pediu duas
coisas juntas, nesta mesma feat:

1. "Deixar o site completamente dependente da API do IGDB... e apenas mande
   os jogos para a Steam, da mesma forma que você estava fazendo antes" —
   confirmado via pergunta de esclarecimento: o IGDB vira a única fonte de
   catálogo e pontuação; os links de "Abrir na loja" continuam indo para a
   Steam/Epic como hoje.
2. "Faça também com que a barra de busca superior funcione, em uma barra de
   busca que consiga aplicar os filtros corretos."

## Descobertas antes de mudar qualquer coisa

Antes de desligar qualquer coisa, foi preciso entender o que já existia:

- `game_rankings` (a tabela que guardaria um "score"/"trend" combinado de
  Steam+Epic) **nunca foi populada por nenhum job** — `repositories.rankings.replace()`
  existe no código mas não é chamado em lugar nenhum. Ou seja, o índice do
  site já caía sempre no fallback `COALESCE(current_ranking.score, g.igdb_popularity, 0)`
  em `catalog-read-repository.js`, ou seja, **já era popularidade do IGDB na
  prática**, mesmo antes deste pedido.
- `sync:rankings` (Steam Charts + Epic) só alimenta `ranking_entries`/`ranking_snapshots`,
  usado para `currentPlayers` — um campo que **não é renderizado em lugar
  nenhum do frontend** hoje (só existe nos dados, não na UI).
- Os links de "Abrir na loja" **já vêm do IGDB**, não de um job separado: o
  cliente IGDB (`normalizeIgdbGame` em `server/integrations/normalizers.js`)
  extrai o id da Steam/Epic de `external_games` de cada jogo e isso vira
  `store_listings`. Então "mandar os jogos para a Steam" já era 100% uma
  função do IGDB, não do scraping do Steam Charts.

Ou seja: a mudança de comportamento real e necessária era bem menor do que
parecia — o índice já era, na prática, só-IGDB. O que faltava era **parar de
recomendar/rodar `sync:rankings`** e, principalmente, **corrigir a
documentação e os textos da UI**, que afirmavam uma combinação Steam+Epic+IGDB
que não correspondia ao que o código de fato fazia.

## O que foi mudado

| Mudança | Onde |
|---|---|
| Texto da metodologia (backend) | `server/routes/index.js` — `methodology.formula`/`rules`/`sources` reescritos para descrever só popularidade do IGDB; menção explícita a links de loja não influenciarem mais a pontuação. |
| Modal "Como calculamos" (frontend) | `src/App.jsx` (`Methodology`) — mesmo texto, adaptado para o modal. |
| `sourceStatus` do dashboard/catálogo | `server/services/catalog-service.js` — de `{steam, epic, igdb}` para `{igdb}` (não era renderizado na UI, mas era enganoso manter as chaves). |
| Textos de apoio | `src/App.jsx` — intro do catálogo e do detalhe do jogo, não citam mais Steam/Epic como fonte de dado. |
| `README.md` | Seção "Como o índice funciona" reescrita; `npm run sync:rankings` removido do fluxo recomendado (o script continua existindo no repositório, só não é mais necessário). |

**Decisão explícita: não apagamos** `server/integrations/steam-client.js`,
`epic-client.js`, `server/jobs/rankings.js`, o script `npm run sync:rankings`
nem as tabelas `ranking_snapshots`/`ranking_entries`/`game_rankings`. Isso foi
tratado como "desativar a dependência", não "remover a funcionalidade" — o
código fica disponível caso seja necessário reativar rankings por loja no
futuro, mas nada no fluxo padrão da aplicação depende dele.

## Busca funcionando em qualquer página

A causa raiz: a caixa de busca no cabeçalho (`Header`) sempre esteve
conectada a um estado `search` em `App.jsx`, mas **só a página `/catalogo`
lia esse estado** para filtrar (`<Catalog query={search} .../>`). Digitar na
busca estando em `/`, `/rankings` ou na página de detalhe de um jogo não
tinha efeito nenhum visível — daí a percepção de "não funciona".

Corrigido em `src/App.jsx` (`Header`): a caixa de busca virou um `<form>`
(`role="search"`) que navega para `/catalogo` automaticamente na primeira
letra digitada fora dessa página (`onChange` chama `onNavigate("catalog")`
quando `view !== "catalog"`), e também no `submit` (Enter). Como o `Header`
nunca é desmontado entre navegações (fica fora do `switch` de `view` no
JSX), o campo de texto não perde foco durante a transição. Os filtros de
loja, gênero e "Independentes" (ver `docs/claude/feat-4`) já combinavam
corretamente com a busca dentro da página de catálogo — não precisaram de
mudança, só precisavam ser alcançáveis a partir de qualquer lugar do site.

## Testes

- `tests/api/routes.test.js` — `sourceStatus.steam` → `sourceStatus.igdb`
  (único teste automatizado que dependia do formato antigo).
- `npm test`: 107 testes passando (sem testes novos — a lógica de negócio dos
  jobs de sync não mudou, só textos/contratos de exibição).

## Verificação manual

Chromium headless (Playwright, nesta sessão): digitar na busca do cabeçalho
estando na Home navega para `/catalogo` e filtra os resultados
imediatamente; abrir o modal "Como calculamos" mostra o texto novo,
mencionando só IGDB (confirmado programaticamente: contém "IGDB" e não
contém mais "Steam Charts").
