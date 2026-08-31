# Modelo de dados

Migração: [`migrations/003_create_user_profile_extensions.js`](../../../migrations/003_create_user_profile_extensions.js).
Aplicar com `npm run db:migrate` (reverter com `npm run db:rollback`).

## `user_profile_media` (1:1 com `users`)

| Coluna | Tipo | Observação |
|---|---|---|
| `user_id` | `uuid` PK/FK → `users.id` ON DELETE CASCADE | |
| `avatar_url` | `text` | `/uploads/avatars/<userId>.<ext>`, `null` se nunca enviou |
| `cover_url` | `text` | `/uploads/covers/<userId>.<ext>`, `null` se nunca enviou |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Deliberadamente separada de `user_profiles` (Feature 1) — ver decisão em
[`00-overview.md`](./00-overview.md).

## `user_favorite_games` / `user_wishlist_games`

Mesmo formato para as duas tabelas:

| Coluna | Tipo | Observação |
|---|---|---|
| `user_id` | `uuid` NOT NULL FK → `users.id` ON DELETE CASCADE | |
| `game_id` | `uuid` NOT NULL FK → `games.id` ON DELETE CASCADE | |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

PK composta `(user_id, game_id)` — impede duplicar o mesmo jogo na mesma lista;
`addFavorite`/`addToWishlist` usam `ON CONFLICT DO NOTHING` (idempotente).

## `user_achievements`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` NOT NULL FK → `users.id` ON DELETE CASCADE | |
| `game_id` | `uuid` NOT NULL FK → `games.id` ON DELETE CASCADE | |
| `name` | `text` NOT NULL | `CHECK (char_length(name) BETWEEN 1 AND 120)` |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Índice em `user_id`. Várias conquistas por usuário/jogo são permitidas (sem
constraint de unicidade) — o usuário pode criar quantas quiser.

## FK para `games`

Todas as três tabelas usam `ON DELETE CASCADE` para `game_id` — são linhas de
posse do usuário (favorito, item de wishlist, conquista), não dados de catálogo
append-only como `ranking_entries` (Feature de catálogo, que usa `ON DELETE RESTRICT`).
Se um jogo for removido do catálogo, ele some silenciosamente das listas do
usuário em vez de bloquear a exclusão.
