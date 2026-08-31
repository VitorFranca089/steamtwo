# Mail sender e API de conta

## Modelo de dados

Migração: [`migrations/004_add_email_verification_and_password_reset.js`](../../../migrations/004_add_email_verification_and_password_reset.js).

### `users` (coluna nova)

| Coluna | Tipo | Observação |
|---|---|---|
| `email_verified_at` | `timestamptz`, nullable | presença = e-mail confirmado. Independente de `user_profiles.verified_at` (KYC). |

### `email_verification_tokens`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `users.id` ON DELETE CASCADE | |
| `email` | `citext` NOT NULL | o e-mail sendo confirmado no momento em que o token foi gerado |
| `token_hash` | `text` UNIQUE NOT NULL | SHA-256 do token opaco enviado por e-mail |
| `expires_at` | `timestamptz` NOT NULL | 24h a partir da geração |
| `created_at` | `timestamptz` | |

### `password_reset_tokens`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `users.id` ON DELETE CASCADE | |
| `token_hash` | `text` UNIQUE NOT NULL | |
| `expires_at` | `timestamptz` NOT NULL | 1h a partir da geração |
| `created_at` | `timestamptz` | |

Um pedido novo (reenvio de verificação ou novo "esqueci a senha") sempre apaga
tokens anteriores do mesmo usuário antes de criar um novo (`deleteByUserId`) —
só o link mais recente enviado por e-mail funciona.

## Mail sender

`server/integrations/mailer.js`:

- `createMailer({ host, port, user, pass, from })` — retorna `null` se `host`
  estiver vazio (SMTP não configurado); caso contrário, um objeto com
  `sendMail({ to, subject, html, text })` usando `nodemailer`.
- `verificationEmail({ username, link })` e `passwordResetEmail({ username, link })` —
  geram `{ subject, html, text }` prontos para passar a `sendMail`. Qualquer feature
  futura que precise mandar e-mail para o usuário pode reaproveitar `createMailer`
  (já exportado em `server/integrations/index.js`) e só escrever seu próprio template.
- `server/index.js` monta o mailer com `createMailer(config.smtp)` e injeta em
  `createAuthService({ ..., mailer, appBaseUrl: config.appBaseUrl })`. `appBaseUrl`
  é usado para montar os links (`${appBaseUrl}/verificar-email?token=...` e
  `${appBaseUrl}/redefinir-senha?token=...`).

## API — `/api/auth/*` (rotas novas)

Mesmo contrato de erro do resto do projeto: `{ error, details? }`, 400/401/404/409/500.

### `GET /api/auth/account`

Requer sessão. Retorna os dados completos para a tela de configurações:

```json
{
  "account": {
    "id": "uuid", "username": "jogador1", "email": "jogador1@exemplo.com",
    "emailVerified": false, "isVerified": false,
    "fullName": null, "birthDate": null, "cpf": null
  }
}
```

### `PATCH /api/auth/username`

Requer sessão. Body: `{ username }` (mesma validação do cadastro, inclusive
bloqueio de nomes reservados). `200 { account }` · `409` se já estiver em uso.

### `PATCH /api/auth/email`

Requer sessão. Body: `{ email, currentPassword }`. Confirma a senha atual antes
de trocar; zera `emailVerified` e dispara um novo e-mail de verificação.
`200 { account }` · `401` (senha incorreta) · `409` (e-mail já cadastrado).

### `POST /api/auth/password/change`

Requer sessão. Body: `{ currentPassword, newPassword }`. Deriva todas as
sessões do usuário (incluindo a atual — o cookie é limpo na resposta).
`204` · `401` (senha atual incorreta) · `400` (nova senha fraca).

### `POST /api/auth/password/forgot`

Sem autenticação. Body: `{ identifier }` (username ou e-mail). Sempre
`200 { message }` com uma mensagem genérica, exista ou não a conta.

### `POST /api/auth/password/reset`

Sem autenticação. Body: `{ token, password }`. `204` em sucesso (senha trocada,
todas as sessões derrubadas) · `400` (token inválido, expirado ou já usado).

### `POST /api/auth/email/verify/request`

Requer sessão. Sem body. Reenvia o e-mail de verificação para o e-mail atual
da conta (invalida qualquer token anterior). `204`.

### `POST /api/auth/email/verify/confirm`

Sem autenticação (o token é a própria credencial). Body: `{ token }`. `204`
em sucesso · `400` (token inválido/expirado).
