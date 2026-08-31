# Feature 2 — Perfil de usuário (foto, capa, favoritos, wishlist, conquistas)

Status: implementado, coberto por testes automatizados (76 testes no total, `npm test`,
sendo 20 novos desta feature), build de produção (`npm run build`) e **testado
manualmente ponta a ponta em navegador real** (Chromium via Playwright, nesta sessão) —
cadastro → upload de avatar/capa → favoritos → wishlist → conquista → perfil público →
KYC ainda funcionando.

## Índice

- [`00-overview.md`](./00-overview.md) — escopo, decisões e o que ficou de fora
- [`01-data-model.md`](./01-data-model.md) — tabelas novas e migração
- [`02-api.md`](./02-api.md) — contrato das rotas `/api/profile/*`
- [`03-uploads-e-ux.md`](./03-uploads-e-ux.md) — upload de arquivo, feedback ao usuário (toasts) e um bug de refresh de imagem corrigido
- [`04-como-rodar-e-testar.md`](./04-como-rodar-e-testar.md) — passo a passo local e manual de testes

## Resumo rápido

- `/perfil` — perfil do próprio usuário: upload de foto e capa (arquivo real, não URL),
  favoritos, wishlist e conquistas criadas pelo próprio usuário (escolhe um jogo do
  catálogo + dá um nome livre).
- `/perfil/:username` — visualização pública, somente leitura, do perfil de qualquer usuário.
- `/perfil/verificar` — o antigo formulário de KYC (Feature 1), preservado como está,
  apenas movido de URL (antes era `/perfil`).
- Toda mutação (upload, adicionar/remover jogo, criar/apagar conquista) dá feedback
  visual imediato via toast de sucesso/erro.
