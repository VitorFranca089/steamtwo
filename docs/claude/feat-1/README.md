# Feature 1 — Cadastro, login e regularização de conta

Status: implementado e coberto por testes automatizados (56 testes, `npm test`) e
build de produção (`npm run build`). **Teste manual end-to-end (navegador) ainda
pendente** — este ambiente não tinha Docker instalado e o Postgres nativo local
não pôde ser configurado nesta sessão (ver "Como rodar" abaixo).

## Índice

- [`00-overview.md`](./00-overview.md) — escopo, decisões e o que ficou de fora
- [`01-data-model.md`](./01-data-model.md) — tabelas, tipos e migração
- [`02-api.md`](./02-api.md) — contrato das rotas `/api/auth/*`
- [`03-security.md`](./03-security.md) — senha, sessão, CPF/idade, admin de teste
- [`04-como-rodar-e-testar.md`](./04-como-rodar-e-testar.md) — passo a passo local e manual de testes

## Resumo rápido

- Cadastro com `username` (único), `email` (único) e senha forte.
- Login por `username` ou `email`, sessão via cookie `httpOnly` (não é JWT).
- Endpoint separado para "regularizar" a conta (nome completo, data de nascimento, CPF),
  com validação de maioridade (18+) e checksum de CPF — implementado, mas tratado como
  prioridade secundária, sem fluxo de KYC/verificação externa.
- Usuário `admin` semeado via `npm run db:seed`, com `role = 'admin'` e acesso irrestrito
  (bypassa a exigência de perfil completo).
