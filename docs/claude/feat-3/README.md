# Feature 3 — Integração com o IGDB, índice só-IGDB e busca

Status: ativado e verificado contra o IGDB real. 100 jogos sincronizados
(`npm run sync:catalog` e `npm run sync:popularity`), 107 testes automatizados
passando (`npm test`), API local servindo os dados reais em `GET /api/games`,
índice do site (score/ranking) rodando só com dado do IGDB, busca do
cabeçalho funcionando em qualquer página.

## Índice

- [`00-integracao-igdb.md`](./00-integracao-igdb.md) — o que já existia, três
  bugs adormecidos encontrados e corrigidos ao rodar de verdade pela primeira
  vez, e a mudança de contrato do IGDB (`popularity` → `popularity_primitives`)
  que precisou ser tratada.
- [`01-catalogo-so-igdb-e-busca.md`](./01-catalogo-so-igdb-e-busca.md) — por
  que o índice já era, na prática, só-IGDB; o que foi desativado (não
  removido) para tornar isso explícito; e o bug de UX que fazia a busca do
  cabeçalho não funcionar fora da página de catálogo.
- [`02-notas-avaliacao-reais.md`](./02-notas-avaliacao-reais.md) — os três
  números de "avaliação" no destaque da home eram literais fixos (96/93/95),
  iguais para qualquer jogo; substituídos por dados reais do IGDB
  (popularidade, nota de avaliação e hype), com duas colunas novas no banco.

## Resumo rápido

- A integração (cliente OAuth/IGDB, jobs de sync, upsert idempotente no
  catálogo) já estava implementada desde o início do projeto — o trabalho
  desta rodada foi configurar as credenciais reais (Twitch Developer Console)
  e corrigir o que só quebra contra o Postgres/IGDB reais.
- `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET` no `.env.example` não mudaram —
  já existiam como placeholders vazios, sincronizados com o código.
- `npm run sync:catalog` — busca os jogos com maior "popularidade" no IGDB
  (via `/popularity_primitives`) e faz upsert idempotente por `slug`.
- `npm run sync:popularity` — mesma fonte, atualiza só o índice de
  popularidade histórica dos jogos já existentes.
- O Índice SteamTwo (score/ranking exibido no site) vem inteiramente da
  popularidade do IGDB; Steam/Epic não influenciam mais a pontuação, só os
  links de "Abrir na loja" (que também já vêm do IGDB, via `external_games`).
  `npm run sync:rankings` (Steam Charts/Epic) continua no repositório mas
  deixou de ser necessário — ver `01-catalogo-so-igdb-e-busca.md`.
- A busca do cabeçalho agora funciona a partir de qualquer página: digitar
  nela navega para `/catalogo` e aplica o filtro imediatamente.
