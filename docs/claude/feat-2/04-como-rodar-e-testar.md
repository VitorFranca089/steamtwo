# Como rodar e testar

Pré-requisitos: banco já migrado (`npm run db:migrate`, inclui a migração
002 da Feature 1 e a 003 desta feature) e ao menos um usuário cadastrado
(ver [`docs/claude/feat-1/04-como-rodar-e-testar.md`](../feat-1/04-como-rodar-e-testar.md)).

## 1. Rodar a aplicação

```bash
npm run dev:api
npm run dev
```

- Frontend: http://127.0.0.1:5173/ (ou próxima porta livre, ex. 5174)
- API: http://127.0.0.1:3001/api/health

## 2. Catálogo precisa ter jogos

O seletor de jogos (favoritos/wishlist/conquistas) usa `GET /api/games`, que
lê da tabela `games`. Se o catálogo estiver vazio (nenhum `npm run
sync:catalog` rodado ainda), o seletor não encontra nada. Para testar
localmente sem rodar os jobs de sincronização reais, insira alguns jogos
direto no banco:

```sql
INSERT INTO games (slug, title, cover_url) VALUES
  ('elden-ring-shadow-of-the-erdtree', 'ELDEN RING Shadow of the Erdtree', 'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/library_600x900_2x.jpg'),
  ('black-myth-wukong', 'Black Myth: Wukong', 'https://cdn.cloudflare.steamstatic.com/steam/apps/2358720/library_600x900_2x.jpg');
```

## 3. Testes automatizados

```bash
npm test
```

76 testes no total (56 já existentes + 20 novos desta feature):

- `tests/domain/profile-service.test.js` — regras de negócio do serviço de
  perfil (avatar/capa, favoritos idempotentes, 404 para jogo/conquista
  inexistente, projeção pública sem e-mail/`isVerified`), com repositório
  fake em memória.
- `tests/api/profile-routes.test.js` — rotas HTTP via `supertest`, incluindo
  upload multipart real (`.attach(...)`) contra um diretório temporário,
  rejeição de mimetype/tamanho inválido, e isolamento entre usuários
  (um não consegue apagar conquista do outro).

Nenhum desses testes precisa de Postgres real nem grava fora de um diretório
temporário descartado ao final.

## 4. Roteiro de teste manual

Com o app rodando, catálogo com pelo menos 2-3 jogos, e um usuário logado:

1. Acesse "Meu perfil" (`/perfil`) → banner de verificação pendente (se a
   conta ainda não tiver passado pelo KYC), avatar/capa vazios, listas vazias.
2. Envie uma foto de perfil → **a imagem deve trocar imediatamente**, sem
   precisar dar refresh, e um toast verde "Foto de perfil atualizada." deve
   aparecer no canto inferior direito. Envie uma segunda foto diferente em
   seguida (ainda sem refresh) → deve trocar de novo.
3. Envie uma capa → mesma verificação (toast + atualização imediata).
4. Tente enviar um arquivo `.txt` ou maior que 5MB → toast vermelho de erro,
   nenhuma imagem quebrada na tela.
5. Clique em "Adicionar jogo" em Favoritos, busque e selecione um jogo → o
   jogo aparece na grade na hora e um toast de sucesso confirma. Repita para
   Wishlist.
6. Remova um item de qualquer lista (ícone de lixeira) → some da tela e toast
   confirma a remoção.
7. Em Conquistas, clique "Nova conquista" sem escolher um jogo → toast
   vermelho "Escolha um jogo para a conquista." (validação client-side).
   Escolha um jogo, digite um nome, envie → aparece na lista com toast de
   sucesso citando o nome digitado.
8. Apague a conquista criada → some da lista, toast confirma.
9. Faça logout e acesse `/perfil/<username>` do usuário que você acabou de
   editar → mesmo layout, porém **sem** nenhum botão de editar/adicionar/
   remover/enviar arquivo; os dados persistidos (o que sobrou depois do
   passo 6/8) devem aparecer corretamente.
10. Acesse `/perfil/um-username-que-nao-existe` → tela de "Perfil não
    encontrado" com botão para voltar ao início.
11. Acesse `/perfil/verificar` → o formulário de KYC da Feature 1 continua
    funcionando normalmente, sem relação com o que foi feito nesta feature.

Este roteiro foi executado nesta sessão via Chromium headless (Playwright),
incluindo a verificação específica do item 2 (upload duplo sem refresh) —
ver [`03-uploads-e-ux.md`](./03-uploads-e-ux.md) para o bug que isso pegou
e como foi corrigido.
