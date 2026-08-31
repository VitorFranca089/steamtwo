# API — `/api/profile/*`

Rotas disponíveis apenas quando `DATABASE_URL` está configurada (mesmo padrão
da Feature 1). Erros seguem `{ error, details? }`, `status` 400 (validação
Zod ou multer), 401 (sem sessão), 404 (jogo/conquista/usuário inexistente), 500.

A rota pública `GET /api/profile/:username` é registrada **depois** de todas
as rotas literais abaixo — ver decisão sobre usernames reservados em
[`00-overview.md`](./00-overview.md).

## `GET /api/profile/me`

Requer sessão (`401` sem cookie). Retorna o perfil completo e editável:

```json
{
  "user": { "id": "uuid", "username": "jogador1", "role": "user", "isVerified": false },
  "avatarUrl": "/uploads/avatars/<uuid>.jpg",
  "coverUrl": null,
  "favorites": [{ "id": "uuid", "slug": "elden-ring", "title": "...", "coverUrl": "...", "createdAt": "..." }],
  "wishlist": [ /* mesmo formato */ ],
  "achievements": [{ "id": "uuid", "name": "Zerei sem morrer", "createdAt": "...", "gameId": "uuid", "gameTitle": "...", "gameCoverUrl": "..." }]
}
```

## `POST /api/profile/avatar` / `POST /api/profile/cover`

Requer sessão. `multipart/form-data`, campo `avatar` ou `cover` respectivamente
(um único arquivo). Aceita `image/jpeg`, `image/png`, `image/webp`, até 5MB.

Respostas: `200 { avatarUrl, coverUrl }` (estado atualizado dos dois campos) ·
`400` (mimetype não suportado, ou arquivo maior que 5MB — erro do `multer`
mapeado no handler de erro central) · `401`.

## `POST /api/profile/favorites` / `POST /api/profile/wishlist`

Requer sessão. Body: `{ gameId }` (uuid de um jogo do catálogo).

Respostas: `201` · `400` (uuid inválido) · `401` · `404` (jogo inexistente).
Idempotente — favoritar duas vezes o mesmo jogo não gera erro nem duplicata.

## `DELETE /api/profile/favorites/:gameId` / `DELETE /api/profile/wishlist/:gameId`

Requer sessão. Resposta: `204` (mesmo se o jogo não estava na lista — remoção
também é idempotente).

## `POST /api/profile/achievements`

Requer sessão. Body: `{ gameId, name }` (`name`: 1–120 caracteres).

Respostas: `201 { achievement }` · `400` (validação) · `401` · `404` (jogo inexistente).

## `DELETE /api/profile/achievements/:id`

Requer sessão. Só apaga conquista do próprio usuário — tentar apagar a de
outro usuário (ou um id inexistente) retorna `404` sem distinguir os dois
casos (não revela se a conquista existe e é de outra pessoa).

## `GET /api/profile/:username`

Sem autenticação. Mesmo formato de `GET /api/profile/me`, mas com um `user`
público (`{ id, username }`, sem `email`/`isVerified`) e todas as listas
somente para leitura do lado do cliente (a API não impede escrita, mas o
frontend público não expõe nenhum controle de edição).

Respostas: `200` · `404` (`username` desconhecido).
