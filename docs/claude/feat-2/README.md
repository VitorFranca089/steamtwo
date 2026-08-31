# Feature 2 — Perfil de usuário e conta

Cobre duas entregas relacionadas ao perfil/conta do usuário, cada uma documentada
em sua própria sequência de arquivos abaixo:

1. **Perfil público** (foto, capa, favoritos, wishlist, conquistas) — docs `00`–`04`.
2. **Conta, verificação de e-mail e redefinição de senha** — docs `05`–`07`.
3. **Correções de UX/segurança** pedidas depois do uso real (engrenagem de
   configurações, bloqueio de `/conta` sem KYC, avatar sem foto, CPF travado,
   mensagens de erro legíveis) — doc `08`.

Status: implementado, coberto por testes automatizados (97 testes no total,
`npm test`, sendo 41 novos entre as três partes desta feature), build de
produção (`npm run build`) e **testado manualmente ponta a ponta em navegador
real** (Chromium via Playwright, nesta sessão) — cadastro → upload de
avatar/capa → favoritos → wishlist → conquista → perfil público → verificação
de e-mail com link real clicado → troca de username/e-mail/senha → esqueci a
senha → bloqueio de `/conta` sem KYC → KYC (Feature 1) ainda funcionando.

## Índice

**Perfil público**
- [`00-overview.md`](./00-overview.md) — escopo, decisões e o que ficou de fora
- [`01-data-model.md`](./01-data-model.md) — tabelas novas e migração
- [`02-api.md`](./02-api.md) — contrato das rotas `/api/profile/*`
- [`03-uploads-e-ux.md`](./03-uploads-e-ux.md) — upload de arquivo, feedback ao usuário (toasts) e um bug de refresh de imagem corrigido
- [`04-como-rodar-e-testar.md`](./04-como-rodar-e-testar.md) — passo a passo local e manual de testes

**Conta, verificação de e-mail e senha**
- [`05-conta-verificacao-e-senha.md`](./05-conta-verificacao-e-senha.md) — escopo, decisões e o que ficou de fora
- [`06-mailer-e-api.md`](./06-mailer-e-api.md) — mail sender reutilizável, modelo de dados e contrato das novas rotas `/api/auth/*`
- [`07-como-testar-conta.md`](./07-como-testar-conta.md) — configurar o Mailtrap, rodar e testar
- [`08-correcoes-avatar-conta-e-seguranca.md`](./08-correcoes-avatar-conta-e-seguranca.md) — engrenagem de configurações, bloqueio de `/conta` sem KYC, avatar sem foto, CPF travado e mensagens de erro legíveis

## Resumo rápido

- `/perfil` — perfil do próprio usuário: upload de foto e capa (arquivo real, não URL),
  favoritos, wishlist e conquistas criadas pelo próprio usuário (escolhe um jogo do
  catálogo + dá um nome livre).
- `/perfil/:username` — visualização pública, somente leitura, do perfil de qualquer usuário.
- `/perfil/verificar` — o antigo formulário de KYC (Feature 1), preservado como está.
- `/conta` — configurações da conta: username, e-mail (com verificação), dados
  pessoais (nome/nascimento/CPF) e troca de senha.
- `/esqueci-senha` e `/redefinir-senha` — recuperação de acesso por token enviado por e-mail.
- Mail sender reutilizável (`server/integrations/mailer.js`, via Mailtrap/SMTP) —
  pronto para qualquer feature futura que precise enviar e-mail ao usuário.
- Toda mutação (upload, adicionar/remover jogo, criar/apagar conquista, salvar
  dados da conta) dá feedback visual imediato via toast de sucesso/erro.
