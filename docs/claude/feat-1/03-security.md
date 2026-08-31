# Segurança

## Senha

- Hash com `bcryptjs`, 12 rounds (`server/services/auth-service.js`).
- Política (client e servidor, mesmas regras — ver `passwordChecklist` em
  `src/auth-api.js` e `passwordSchema` em `server/domain/auth/validation.js`):
  mínimo 8 caracteres, 1 minúscula, 1 maiúscula, 1 número, 1 caractere especial.
- A senha (e o hash) nunca são incluídos em nenhuma resposta da API (`toSafeUser`
  em `auth-service.js` projeta só `id/username/email/role/isVerified`).

## Sessão

- Cookie `steamtwo_session`: `httpOnly`, `sameSite=lax`, `secure` quando
  `NODE_ENV=production`, sem acesso via JavaScript no cliente.
- O valor do cookie é um token aleatório de 32 bytes (`crypto.randomBytes`),
  nunca gravado como está no banco — só o SHA-256 dele (`user_sessions.token_hash`).
  Um vazamento do banco não permite reconstruir sessões válidas.
- TTL de 7 dias (`SESSION_TTL_MS`); logout apaga a linha da sessão no banco
  imediatamente (não é só "esquecer" um JWT que continuaria válido até expirar).
- Não há renovação automática (sliding expiration) — fora de escopo por ora.

## CPF e idade

- CPF validado por checksum matemático padrão (mod 11) em
  `server/domain/auth/cpf.js` — **não** é uma verificação contra uma base real
  (Receita Federal); apenas garante que o número tem o formato/dígitos
  verificadores corretos.
- Idade mínima de 18 anos (`calculateAge` em `server/domain/auth/age.js`),
  calculada a partir de `birthDate` no momento do envio do formulário de perfil.
- CPF é único por conta (`user_profiles.cpf UNIQUE`) — impede duas contas
  reivindicando a mesma identidade.

## Usuário admin de teste

Criado/atualizado via `npm run db:seed` (script `scripts/seed-admin.mjs`,
idempotente — pode rodar quantas vezes quiser). Credenciais padrão (dev only):

- username: `admin` (ou `ADMIN_USERNAME`)
- email: `admin@steamtwo.dev` (ou `ADMIN_EMAIL`)
- senha: `Admin@12345` (ou `ADMIN_PASSWORD`)

O admin **não precisa** completar o perfil (nome/nascimento/CPF) para ter acesso
irrestrito — o "pode fazer o que quiser" é modelado como `role = 'admin'`, e
qualquer rota que precise reservar algo só para administradores deve usar o
middleware `requireAdmin` (`server/middleware/auth.js`), que checa
`request.user.role === "admin"` e ignora o estado de verificação do perfil.

⚠️ As credenciais padrão são adequadas apenas para desenvolvimento local. Em
qualquer ambiente compartilhado, defina `ADMIN_PASSWORD` (e idealmente
`ADMIN_EMAIL`) nas variáveis de ambiente antes de rodar o seed.
