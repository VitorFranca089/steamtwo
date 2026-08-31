# SteamTwo

Catálogo de jogos com dashboard de popularidade movido a dados do IGDB, interface em React/HTML/CSS/JS, API Node.js/Express e persistência PostgreSQL.

## Funcionalidades

- dashboard com mais jogados agora, média da última semana, popularidade histórica e recorde monitorado;
- catálogo pesquisável e filtrável por loja, gênero e jogos independentes; busca funciona a partir de qualquer página;
- ranking transparente baseado inteiramente na popularidade do IGDB;
- página de detalhes com link para a loja oficial (Steam/Epic, quando o IGDB identifica o jogo lá);
- catálogo sincronizado do IGDB (título, capa, gêneros, popularidade) com histórico de execuções (`sync_runs`);
- admins podem enviar jogos independentes direto para o catálogo, sem depender do IGDB (`/admin/jogos`);
- fallback visual com dados realistas quando o PostgreSQL ainda não foi configurado;
- cadastro e login de usuários (username/e-mail únicos, senha forte, sessão via cookie);
- regularização de conta com nome completo, data de nascimento e CPF (verificação de idade);
- perfil de usuário com foto e capa (upload real), favoritos, wishlist e conquistas
  criadas pelo próprio usuário, além de uma versão pública somente leitura (`/perfil/:username`);
- aba "Jogadores" para buscar e visitar o perfil público de qualquer outra pessoa —
  sempre somente leitura, com um selo indicando isso, nunca editável por quem está logado;
- tela de configurações da conta (`/conta`) com verificação de e-mail, troca de
  username/e-mail/senha e edição dos dados pessoais;
- recuperação de senha por token enviado por e-mail (`/esqueci-senha`, `/redefinir-senha`),
  com um mail sender reutilizável (via Mailtrap/SMTP) para futuras notificações.

## Como o índice funciona

O Índice SteamTwo vem inteiramente da popularidade normalizada que o IGDB calcula para cada jogo — mesma fonte do catálogo, capas e gêneros. Steam e Epic Games não alimentam mais a pontuação; eles continuam aparecendo como link de "Abrir na loja" quando o IGDB identifica o jogo nessas lojas (via `external_games`), mas isso é só um link, não um sinal de ranking. Veja [`docs/claude/feat-3`](./docs/claude/feat-3/README.md) para o histórico dessa decisão.

- **Agora / Última semana:** popularidade IGDB (não há mais coleta própria de snapshot diário).
- **De sempre:** popularidade histórica do IGDB; não representa horas jogadas.
- **Recorde monitorado:** maior índice registrado desde o início da coleta.
- Jogos independentes enviados por um admin (sem dado do IGDB) começam com pontuação zero.

## Execução local

Requisitos: Node.js 20+ e PostgreSQL 17 (ou Docker).

```bash
npm install
docker compose up -d
copy .env.example .env
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev
```

`npm run db:seed` cria (ou atualiza) um usuário administrador de teste com
acesso irrestrito à plataforma. Por padrão: username `admin`, e-mail
`admin@steamtwo.dev`, senha `Admin@12345` — sobrescreva com `ADMIN_USERNAME`,
`ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env`. Veja mais em
[`docs/claude/feat-1`](./docs/claude/feat-1/README.md) (cadastro/login),
[`docs/claude/feat-2`](./docs/claude/feat-2/README.md) (perfil de usuário e conta),
[`docs/claude/feat-3`](./docs/claude/feat-3/README.md) (integração com o IGDB, índice
só-IGDB e busca), [`docs/claude/feat-4`](./docs/claude/feat-4/README.md) (admin
enviando jogos independentes) e [`docs/claude/feat-5`](./docs/claude/feat-5/README.md)
(aba "Jogadores", perfil de terceiros somente leitura).

Para os e-mails (verificação de conta e "esqueci minha senha") funcionarem de
verdade, preencha `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` no `.env` com as
credenciais SMTP de uma inbox do [Mailtrap](https://mailtrap.io) — sem isso a
aplicação roda normalmente, só não envia e-mails. Veja
[`docs/claude/feat-2/07-como-testar-conta.md`](./docs/claude/feat-2/07-como-testar-conta.md).

Frontend: `http://127.0.0.1:5173/`  
API: `http://127.0.0.1:3001/api/health`

O catálogo e o índice do site dependem do IGDB: preencha `TWITCH_CLIENT_ID` e
`TWITCH_CLIENT_SECRET` no `.env` (credenciais de um app na
[Twitch Developer Console](https://dev.twitch.tv/console/apps), que é como o
IGDB autentica) e execute:

```bash
npm run sync:catalog
npm run sync:popularity
```

`npm run sync:rankings` (coleta de Steam Charts/Epic) ainda existe no
repositório, mas não é mais necessário — o índice não depende mais dele. Veja
[`docs/claude/feat-3`](./docs/claude/feat-3/README.md).

## Verificação

```bash
npm test
npm run build
npm run test:sites
```

O banco pode ser revertido uma migração por vez com `npm run db:rollback`.

