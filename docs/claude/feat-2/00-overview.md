# Visão geral

## Pedido original

- Página de perfil funcional: depois de completar o cadastro, o usuário deve
  conseguir personalizar o perfil com foto de perfil, foto de capa, jogos
  favoritos e uma wishlist de jogos.
- "Conquistas de jogos" — nesta primeira versão, criadas do zero pelo próprio
  usuário: ele escolhe um jogo (do catálogo já existente) e dá um nome livre
  para a conquista. Sem descrição, data ou imagem além da capa do jogo.
- Confirmado com o usuário antes de implementar: upload **real de arquivo**
  para foto/capa (não apenas colar uma URL), e o perfil deve ser **visitável
  publicamente** (`/perfil/:username`), além do próprio usuário poder editar o seu.
- Depois de construída, dois problemas de UX foram reportados e corrigidos
  nesta mesma leva de trabalho (ver [`03-uploads-e-ux.md`](./03-uploads-e-ux.md)):
  a foto de perfil não atualizava visualmente logo após o upload, e nenhuma
  ação (upload, favoritar, criar conquista etc.) dava qualquer feedback de
  sucesso ou erro ao usuário.

## Decisões de arquitetura (e por quê)

| Decisão | Escolha | Motivo |
|---|---|---|
| Onde ficam avatar/capa | Tabela nova `user_profile_media` (1:1 com `users`), não colunas em `user_profiles` | `user_profiles` (Feature 1) já tem um significado específico: a existência da linha marca a conta como "verificada" (KYC). Colocar avatar/capa ali obrigaria o usuário a se verificar antes de personalizar o perfil, o que não foi pedido. |
| Relação com o KYC existente | Desacopladas. O formulário de KYC (`ProfilePage` em `AuthPages.jsx`) continua igual, só muda de URL: `/perfil` → `/perfil/verificar`. `/perfil` passou a ser o perfil rico novo. | Verificação virou um banner/CTA dentro do perfil novo, não mais um bloqueio — nada no pedido exigia KYC antes de personalizar o perfil ou favoritar um jogo. |
| Modelo de conquistas | `user_achievements(id, user_id, game_id, name, created_at)` — texto livre (1–120 caracteres), várias linhas por usuário/jogo permitidas | Corresponde exatamente ao pedido ("nesse primeiro momento, algo criado do 0, selecionando o jogo e dando um nome"); sem campos extras não pedidos. |
| Armazenamento de arquivo | Disco local (`uploads/avatars/`, `uploads/covers/`, gitignored), servido via `express.static("/uploads")` | Sem infraestrutura de upload/CDN existente no projeto; disco local é a opção mais simples que ainda entrega upload real de arquivo, como pedido. |
| Nome do arquivo | Determinístico: `${userId}.${extensão validada}` | Reupload sobrescreve naturalmente o arquivo anterior; se o usuário troca de formato (ex.: png → jpg), um passo de limpeza remove o arquivo antigo com extensão diferente. |
| Limite e tipos de upload | 5MB, apenas `image/jpeg`, `image/png`, `image/webp` | Limite razoável para foto de perfil/capa; mesma whitelist de formatos usada em qualquer rede social comum. |
| Reuso do catálogo | `GET /api/games` (já existente) alimenta o seletor de jogos usado em favoritos, wishlist e conquistas | Nenhuma rota nova de busca de jogos precisou ser criada. |
| Rotas reservadas | `usernameSchema` (Feature 1) passou a bloquear `me`, `avatar(s)`, `cover(s)`, `favorites`, `wishlist`, `achievements` | `GET /api/profile/:username` é registrada depois das rotas literais (`/me`, `/avatar` etc.); sem o bloqueio, um usuário chamado `me` nunca conseguiria ter seu perfil público em `/api/profile/me` (sempre cairia na rota "meu perfil"). |
| Feedback ao usuário | Sistema de toast reutilizável (`src/Toast.jsx`) | Ver [`03-uploads-e-ux.md`](./03-uploads-e-ux.md) — corrigido depois de reportado, não fazia parte do pedido original mas é essencial para a feature ser utilizável. |

## Fora de escopo (intencionalmente)

- Reordenar/destacar favoritos ou itens da wishlist.
- Edição ou recorte (crop) da imagem antes do upload — a imagem enviada é usada como está.
- Moderação de conteúdo das imagens ou dos nomes de conquista.
- Armazenamento em nuvem/CDN para os uploads — fica em disco local, como decidido acima.
- Perfis de outros usuários navegáveis a partir de uma lista/diretório de usuários —
  `/perfil/:username` existe, mas não há um "explorar usuários"; é preciso saber o username.
- Conquistas com descrição, data de conclusão, ou imagem própria além da capa do jogo escolhido.
