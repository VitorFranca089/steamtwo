# Admin enviando jogos independentes

## Pedido original

"Perfil de admin poder enviar jogos novos para a plataforma (classificados
como jogos independentes para o catálogo)."

## Decisões de design (e por quê)

| Decisão | Escolha | Motivo |
|---|---|---|
| Como marcar "independente" | Coluna `games.origin` (`enum: 'igdb' \| 'admin'`) | Um jogo enviado por um admin é, por definição, classificado como independente nesta plataforma — não existe um caso de admin enviando um jogo "não independente". A origem já carrega essa classificação, sem precisar de uma segunda flag booleana redundante. |
| Colisão de slug com o IGDB | `games.upsert` (usado pelo `sync:catalog`) ganhou `WHERE games.origin = 'igdb'` no `ON CONFLICT DO UPDATE` | Sem isso, se um admin cria um jogo com o mesmo slug que um jogo que o IGDB venha a sincronizar depois, o sync silenciosamente sobrescreveria os dados do admin. Com o guard, o `UPDATE` é pulado (zero linhas) e o código busca a linha existente de volta — o jogo do admin nunca é tocado pelo sync. |
| Upload de capa/imagem de destaque | Arquivo real (multer), como no avatar/capa de perfil (feat-2) | Mesmo padrão já estabelecido no projeto para mídia enviada pelo usuário; evita um segundo mecanismo (URL manual) para o mesmo tipo de dado. |
| Nome do arquivo de imagem | UUID aleatório, não `${userId}.${ext}` | Diferente de avatar/capa (1:1 com o usuário), um admin pode enviar vários jogos — precisa de um nome por arquivo, não por usuário. |
| Gêneros | Texto livre separado por vírgula (`"RPG, Indie, Roguelike"`), reaproveitando a tabela `genres` já existente | Mesma tabela usada pelo catálogo do IGDB; evita duas taxonomias de gênero paralelas. Slugificado e deduplicado no service (`toSlug`, já usado pelo normalizador do IGDB). |
| Tradução de erros (slug duplicado) | Repositório lança o erro bruto do Postgres (`23505`); o **serviço** traduz para 409 | Mesma convenção já usada em `auth-service.js` (usuário/e-mail duplicado) e `profile-service.js` (jogo inexistente) — o repositório não decide HTTP status, quem decide é a camada de serviço. |
| Filtro "Independentes" no catálogo | Novo parâmetro `independent=true` em `GET /api/games` | Pedido implícito em "classificados... para o catálogo" — não bastava só marcar, também devia dar pra navegar/filtrar por essa classificação. |

## Modelo de dados

`migrations/005_add_game_origin.js` — adiciona à tabela `games` já existente
(de `migrations/001`):

- `origin game_origin NOT NULL DEFAULT 'igdb'` (novo tipo enum `game_origin`).
- `submitted_by uuid REFERENCES users ON DELETE SET NULL` — quem enviou (nulo
  para os jogos do IGDB, e também se o admin que enviou for excluído depois).
- Índice em `origin` (usado pelo filtro do catálogo e pela listagem do painel
  admin).

## API

Tudo em `server/routes/admin.js`, montado em `/api/admin`, atrás de
`requireAuth` + `requireAdmin` (middleware já existente desde a feature 1):

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/games` | Lista os jogos com `origin = 'admin'`, mais recentes primeiro. |
| POST | `/api/admin/games` | Multipart: `title`, `summary`, `releaseDate`, `genres` (texto), `cover` (arquivo), `hero` (arquivo, opcional — se ausente, usa a capa também como imagem de destaque). |
| DELETE | `/api/admin/games/:id` | Remove um jogo independente (só remove se `origin = 'admin'` — não deixa um admin apagar um jogo do IGDB por essa rota). |

`GET /api/games` (catálogo público, já existente) ganhou o parâmetro opcional
`independent=true`, que filtra só os jogos com `origin = 'admin'`.

## Frontend

- `/admin/jogos` (`src/AdminPages.jsx`, `AdminGamesPage`) — formulário de
  envio + lista dos jogos já enviados, com botão de apagar. Mesmo padrão de
  feedback (toasts) e de estado local otimista (adiciona/remove da lista
  antes da resposta do servidor, reverte em caso de erro) já usado no perfil
  (feat-2).
- Acesso: link "Enviar jogo" no `AccountBox` do cabeçalho, visível só para
  `user.role === "admin"`. Acessar `/admin/jogos` sem ser admin mostra uma
  tela de "Acesso restrito a administradores" (não expõe o formulário, nem
  que seja só visualmente).
- Badge "Independente" (`IndependentBadge`, `src/App.jsx`) nos cards do
  catálogo e na página de detalhe, sempre que `game.origin === "admin"`.
- Filtro "Independentes" na barra de ferramentas do catálogo
  (`independent-filter`), ao lado do filtro de loja/gênero já existentes.

## Correção de design no caminho

O usuário reportou (com captura de tela) que os campos de upload de capa e
imagem de destaque estavam feios — inputs `<input type="file">` nativos do
navegador, sem estilo. Substituídos por um botão customizado que abre o
seletor de arquivo (`inputRef.current.click()`) e mostra o nome do arquivo
escolhido, mesmo padrão visual do resto da aplicação (mesma técnica de
input oculto + botão já usada em `AvatarCoverEditor`, na feature 2).

## Testes

- `tests/domain/admin-catalog-service.test.js` (6 testes) — geração de slug,
  dedup de gêneros repetidos (`"RPG, Indie, rpg"` vira só 2 gêneros), capa
  usada como hero quando não há hero, título vazio rejeitado, título
  duplicado retorna 409, listagem e exclusão.
- `tests/api/admin-catalog-routes.test.js` (4 testes) — 401 sem sessão, 403
  para usuário autenticado não-admin, fluxo completo de envio (multipart com
  arquivo) → listagem → exclusão, e 404 ao apagar um id inexistente.
- `npm test`: 107 testes passando no total.

## Verificação manual

Chromium headless (Playwright, nesta sessão), como admin: enviar um jogo
("Ecos do Vazio", com capa, gêneros e resumo) → aparece na lista do painel
marcado "Independente" → aparece no catálogo com o filtro "Independentes" →
badge visível também na página de detalhe → apagar pelo painel remove da
lista. Como usuário comum: `/admin/jogos` mostra "Acesso restrito a
administradores" e o link "Enviar jogo" não aparece no cabeçalho.
