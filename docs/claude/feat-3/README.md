# Feature 3 — Integração com o IGDB (sincronização de catálogo)

Status: ativado e verificado contra o IGDB real. 100 jogos sincronizados
(`npm run sync:catalog` e `npm run sync:popularity`), 97 testes automatizados
passando (`npm test`), API local servindo os dados reais em `GET /api/games`.

## Índice

- [`00-integracao-igdb.md`](./00-integracao-igdb.md) — o que já existia, três
  bugs adormecidos encontrados e corrigidos ao rodar de verdade pela primeira
  vez, e a mudança de contrato do IGDB (`popularity` → `popularity_primitives`)
  que precisou ser tratada.

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
