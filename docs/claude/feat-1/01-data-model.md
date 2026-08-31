# Modelo de dados

Migração: [`migrations/002_create_users.js`](../../../migrations/002_create_users.js).
Aplicar com `npm run db:migrate` (reverter com `npm run db:rollback`).

## `users`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `username` | `citext` UNIQUE NOT NULL | case-insensitive |
| `email` | `citext` UNIQUE NOT NULL | case-insensitive |
| `password_hash` | `text` NOT NULL | bcrypt, nunca exposto pela API |
| `role` | `user_role` (`user` \| `admin`) NOT NULL DEFAULT `user` | |
| `created_at`, `updated_at` | `timestamptz` | |

## `user_profiles` (1:1 opcional com `users`)

| Coluna | Tipo | Observação |
|---|---|---|
| `user_id` | `uuid` PK/FK → `users.id` ON DELETE CASCADE | |
| `full_name` | `text` NOT NULL | |
| `birth_date` | `date` NOT NULL | validado como 18+ na camada de aplicação |
| `cpf` | `text` UNIQUE NOT NULL | armazenado só com dígitos (normalizado antes de gravar) |
| `verified_at` | `timestamptz` NOT NULL DEFAULT `now()` | presença desta linha = conta "regularizada" |
| `created_at`, `updated_at` | `timestamptz` | |

Ausência de linha em `user_profiles` = perfil incompleto (`isVerified: false` na API).

## `user_sessions`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `users.id` ON DELETE CASCADE | |
| `token_hash` | `text` UNIQUE NOT NULL | SHA-256 do token opaco enviado ao cliente; o token bruto nunca é persistido |
| `expires_at` | `timestamptz` NOT NULL | 7 dias a partir do login (`SESSION_TTL_MS`) |
| `created_at` | `timestamptz` | |

Índices em `user_id` e `expires_at` (para lookup de sessão e limpeza futura de expiradas).

## Extensões/tipos

- `citext` (nova) — uniqueness case-insensitive.
- `pgcrypto` (já existia, migração 001) — `gen_random_uuid()`.
- `user_role` enum (`user`, `admin`).
