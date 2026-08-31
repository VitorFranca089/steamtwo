# Feature 4 — Admin enviando jogos independentes

Status: implementado, coberto por testes automatizados (10 testes novos,
107 no total em `npm test`), build de produção (`npm run build`) e testado
manualmente ponta a ponta em navegador real (Chromium via Playwright, nesta
sessão).

## Índice

- [`00-jogos-independentes.md`](./00-jogos-independentes.md) — decisões de
  design, modelo de dados, contrato da API `/api/admin/*`, UI e testes.

## Resumo rápido

- `/admin/jogos` — só para `role = "admin"`: formulário para enviar um jogo
  novo (nome, resumo, data de lançamento, gêneros, capa e imagem de
  destaque) direto para o catálogo, sem passar pelo IGDB.
- Jogos enviados por um admin são marcados com `origin = 'admin'` no banco e
  aparecem no catálogo com um badge "Independente" — filtrável via o botão
  "Independentes" na página `/catalogo`.
- O job de sincronização do IGDB (`sync:catalog`) nunca sobrescreve um jogo
  enviado por um admin, mesmo em caso de colisão de slug.
