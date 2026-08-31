# API — `/api/auth/*`

Todas as rotas ficam disponíveis apenas quando `DATABASE_URL` está configurada
(ver [`server/index.js`](../../../server/index.js)). Erros seguem o padrão já
existente no projeto: `{ error, details? }`, com `status` 400 para erro de
validação (Zod), 401/403/409 para regras de negócio, 500 para o resto.

## `POST /api/auth/signup`

Body: `{ username, email, password }`

- `username`: 3–24 caracteres, `[a-zA-Z0-9_.]`.
- `email`: normalizado para minúsculas.
- `password`: mínimo 8 caracteres, com minúscula, maiúscula, número e caractere especial.

Respostas: `201 { user }` · `400` (validação) · `409` (`username` ou `email` já em uso).

## `POST /api/auth/login`

Body: `{ identifier, password }` (`identifier` = username **ou** email)

Em sucesso, define o cookie `steamtwo_session` (`httpOnly`, `sameSite=lax`,
`secure` em produção, expira em 7 dias) e retorna `200 { user }`.

Respostas: `200 { user }` · `401` (credenciais inválidas — mensagem genérica,
não revela se foi o usuário ou a senha).

## `POST /api/auth/logout`

Sem body. Invalida a sessão atual (remove do banco) e limpa o cookie.

Resposta: `204`.

## `GET /api/auth/me`

Sem autenticação obrigatória. Retorna `200 { user }`, com `user: null` se não
houver sessão válida.

## `POST /api/auth/profile`

Requer sessão válida (`401` sem cookie/sessão). Body: `{ fullName, birthDate, cpf }`.

- `fullName`: 3–160 caracteres.
- `birthDate`: data; usuário precisa ter 18 anos ou mais na data do envio.
- `cpf`: aceita com ou sem pontuação; validado por checksum (mod 11); normalizado
  para 11 dígitos antes de salvar.

Respostas: `200 { profile }` · `400` (validação, incluindo menor de idade ou CPF
inválido) · `401` (sem sessão) · `409` (CPF já usado por outra conta).

## Forma do objeto `user`

```json
{ "id": "uuid", "username": "jogador1", "email": "jogador1@exemplo.com", "role": "user", "isVerified": false }
```

`isVerified` é `true` assim que existe uma linha em `user_profiles` para o usuário
(ou seja, depois de `POST /api/auth/profile` com sucesso). O usuário `admin`
semeado (ver [`03-security.md`](./03-security.md)) não precisa disso — `role`
já é suficiente para o front-end e para qualquer `requireAdmin` no backend.
