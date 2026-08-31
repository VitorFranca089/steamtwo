# Como configurar o Mailtrap e testar

## 1. Configurar o Mailtrap

1. Crie (ou abra) uma inbox de testes no [Mailtrap](https://mailtrap.io).
2. Na aba **SMTP Settings** da inbox, copie host, porta, usuário e senha.
3. Preencha no seu `.env` (os mesmos nomes já existem em `.env.example`, mantidos
   sincronizados a cada variável nova adicionada por esta feature):

```bash
APP_BASE_URL=http://localhost:5173
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=seu-usuario-mailtrap
SMTP_PASS=sua-senha-mailtrap
MAIL_FROM=SteamTwo <no-reply@steamtwo.dev>
```

Sem `SMTP_HOST` preenchido, o mailer fica desligado (`createMailer` retorna
`null`) e a aplicação continua funcionando normalmente — só não envia e-mails
de verdade (ver [`05-conta-verificacao-e-senha.md`](./05-conta-verificacao-e-senha.md)).
`APP_BASE_URL` deve apontar para onde o frontend roda (a porta do `npm run dev`
pode variar se a 5173 já estiver ocupada — ajuste se necessário).

## 2. Rodar a aplicação

```bash
npm run db:migrate
npm run dev:api
npm run dev
```

## 3. Testes automatizados

```bash
npm test
```

95 testes no total (76 já existentes + 19 novos desta parte):

- `tests/domain/auth-account-service.test.js` — verificação de e-mail, troca de
  username/e-mail/senha, esqueci/redefinir senha, usando um repositório fake em
  memória e um **mailer fake** (captura as mensagens "enviadas" num array em vez
  de chamar SMTP de verdade) — não precisa de Mailtrap real para rodar.
- `tests/api/auth-account-routes.test.js` — as mesmas jornadas via HTTP
  (`supertest`), incluindo o token real extraído do corpo do e-mail fake para
  confirmar que o link funciona de ponta a ponta.

Nenhum desses testes depende de credenciais reais do Mailtrap.

## 4. Roteiro de teste manual

Com o app rodando, catálogo com pelo menos 1 usuário logado:

1. Cadastre uma conta nova → um e-mail de verificação é enviado automaticamente
   (chega na inbox do Mailtrap, se configurado).
2. Acesse "Configurações" no header → banner amarelo "E-mail ainda não verificado".
3. Clique no link do e-mail recebido no Mailtrap (`/verificar-email?token=...`) →
   tela de confirmação, depois volte para "Configurações" → banner vira verde
   "E-mail verificado".
4. Na tela de conta, troque o username → toast de sucesso, nome atualizado no header.
5. Troque o e-mail com a senha atual errada → toast de erro. Repita com a senha
   certa → e-mail atualizado, banner de verificação volta a ficar pendente, um
   novo e-mail de verificação chega no Mailtrap para o novo endereço.
6. Preencha/edite nome completo, data de nascimento e CPF → toast de sucesso
   (mesma rota da Feature 1).
7. Troque a senha (informando a senha atual) → toast de sucesso e a aplicação
   desloga automaticamente, voltando para a tela de login.
8. Faça login com a senha nova para confirmar que a troca realmente aplicou.
9. Na tela de login, clique "Recuperar acesso" → preencha o username/e-mail →
   mensagem genérica de sucesso (a mesma mensagem aparece mesmo se a conta não existir).
10. Abra o link de redefinição recebido no Mailtrap → defina uma nova senha →
    confirmação → faça login com a senha nova.
11. Acesse `/redefinir-senha` sem token, e depois `/redefinir-senha?token=algo-invalido`
    → mensagens de erro apropriadas em cada caso.

## Como isso foi verificado nesta sessão (sem Mailtrap real disponível)

Como não havia uma credencial real do Mailtrap para usar neste ambiente, a
jornada completa (itens 1–10 acima) foi validada em duas partes:

- **Lógica de token e API** (as partes que realmente importam ficarem
  corretas): testes automatizados com o mailer fake, cobrindo geração,
  hashing, expiração, uso único e os efeitos colaterais (invalidar sessões,
  zerar verificação ao trocar e-mail etc.).
- **Fluxo visual completo, incluindo clicar num link de verificação real**:
  rodado uma vez em Chromium headless (Playwright) contra uma instância do
  servidor com um mailer temporário que só logava o link no console em vez de
  enviar de verdade (só para esta verificação local — nada disso faz parte do
  código do projeto). Cadastro → link capturado do log → clicado no navegador →
  confirmação → badge "E-mail verificado" aparecendo na tela de conta, tudo
  com a mesma sessão de navegador, sem nenhuma modificação no código de produção.

Isso dá confiança de que o fluxo funciona de ponta a ponta; falta apenas a
validação com uma inbox real do Mailtrap, que só o usuário final consegue
fazer com sua própria credencial.
