# Feature 5 — Aba "Jogadores" (ver o perfil de outras pessoas)

Status: implementado, coberto por testes automatizados (5 testes novos, 110
no total em `npm test`) e testado manualmente ponta a ponta em navegador
real (Chromium via Playwright, nesta sessão).

## Índice

- [`00-aba-jogadores.md`](./00-aba-jogadores.md) — o que já existia (perfil
  público seguro desde a feature 2), o que faltava (nenhum jeito de
  descobrir/chegar no perfil de outra pessoa pela UI) e o que foi
  construído: busca de jogadores e o selo visual "Somente leitura".

## Resumo rápido

- Nova aba **"Jogadores"** no cabeçalho — busca por nome de usuário e abre o
  perfil público de qualquer pessoa, sem precisar login.
- O perfil de outra pessoa mostra um selo **"Somente leitura"** ao lado do
  username — a engrenagem de configurações e todos os botões de edição só
  aparecem no próprio perfil.
- Nada mudou na segurança: mutação de perfil (favoritos, wishlist,
  conquistas, foto, capa) sempre usa a sessão do usuário logado — nunca foi
  possível, nem antes nem depois, editar o perfil de outra pessoa pela API.
