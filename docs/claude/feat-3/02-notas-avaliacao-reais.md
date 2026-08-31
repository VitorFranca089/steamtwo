# Notas de avaliação reais no Hero (em vez de números fixos)

## Pedido original

"Arrume essas notas de avaliação e deixe ele mais centralizado ao IGDB como
conversamos."

## O bug

A seção de destaque da home (`Hero`, em `src/App.jsx`) tinha três números
"de avaliação" — **Tração**, **Qualidade (avaliações)** e **Engajamento** —
que eram literais fixos no JSX: `<b>96</b>`, `<b>93</b>`, `<b>95</b>`. Não
vinham de nenhum dado real, não mudavam entre jogos, e o parágrafo acima
deles ainda dizia "Ranking combinado de Steam e Epic Games", o que já não
era verdade desde a mudança para índice só-IGDB (`01-catalogo-so-igdb-e-busca.md`).

O título do Hero (`<h1>ELDEN RING SHADOW OF THE ERDTREE</h1>`) e a data no
"DATA SPOTLIGHT" (`Segunda-feira, 24 de agosto de 2026`) também eram fixos,
ignorando completamente o jogo (`game`) recebido por props — ou seja, o
destaque da home sempre "dizia" ser Elden Ring, mesmo quando o jogo em
destaque de verdade (calculado a partir da popularidade real) era outro.

## O que foi corrigido

1. **Duas colunas novas na tabela `games`** (`migrations/006_add_igdb_rating_and_hype.js`):
   `igdb_rating` (nota combinada de crítica+usuários do IGDB, 0–100) e
   `igdb_hype` (quantidade de pessoas marcando o jogo como "hyped" no IGDB).
2. **Cliente IGDB** (`server/integrations/igdb-client.js`) passou a pedir
   `total_rating,hypes` junto dos outros campos já buscados — nenhuma
   chamada extra à API, só mais dois campos na mesma query.
3. **Normalizador** (`server/integrations/normalizers.js`) e o job de sync
   (`server/db/job-repository.js`) passam esses dois valores adiante até o
   Postgres, seguindo o mesmo caminho que `igdb_popularity` já usava.
4. **`catalog-read-repository.js`** expõe os dois campos como `qualityScore`
   e `hypeCount` em cada jogo devolvido pela API.
5. **`Hero`** (`src/App.jsx`) reescrito:
   - Título e data dinâmicos (`{game.shortTitle || game.title}`, data de
     hoje formatada), em vez de texto fixo.
   - As três linhas de estatística agora mostram **Popularidade** (o mesmo
     índice IGDB já usado como pontuação principal), **Avaliação IGDB**
     (`qualityScore`) e **Hype** (`hypeCount`, formatado como "1,2 mil"
     quando grande) — todas vindas do jogo de verdade, com "—" quando o
     IGDB não tem o dado (comum em jogos ainda não lançados, como
     aconteceu com Grand Theft Auto VI no catálogo real sincronizado nesta
     sessão).
   - Texto de apoio reescrito para não citar mais Steam/Epic como fonte da
     pontuação.

Jogos independentes enviados por um admin (`docs/claude/feat-4`) não têm
esses campos (não vêm do IGDB) e mostram "—" normalmente, sem quebrar.

## Backfill

Jogos já sincronizados antes desta mudança não tinham `igdb_rating`/`igdb_hype`
salvos. Rodado `npm run sync:catalog` e `npm run sync:popularity` de novo
nesta sessão para preencher os 100 jogos já no catálogo — o upsert é
idempotente por `slug`, então isso apenas atualizou as linhas existentes.

## Testes

`npm test`: 107 testes passando (nenhum teste novo — a lógica coberta por
testes não mudou, só quais campos são buscados/persistidos e como a UI os
exibe; a normalização e os jobs de sync já tinham cobertura para o
formato geral desses dados).

## Verificação manual

Chromium headless (Playwright, nesta sessão), contra o catálogo real
sincronizado: o Hero da home mostra "Elden Ring" (jogo real em destaque, não
mais o texto fixo), com Popularidade 60,9, Avaliação IGDB 95,2 e Hype 96 —
todos números reais e específicos daquele jogo, confirmados também via
`GET /api/dashboard`.
