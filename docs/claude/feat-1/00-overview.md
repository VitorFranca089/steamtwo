# Visão geral

## Pedido original

- Cadastro com `username` (único), `email` (único) e senha forte (8+ caracteres,
  com maiúscula, minúscula, número e caractere especial).
- Depois do cadastro, o usuário pode "se regularizar" na plataforma preenchendo
  nome completo, data de nascimento e CPF (verificação de idade / criação de perfil).
  Essa parte é secundária — o foco é login e cadastro.
- Um usuário de teste `admin` que pode fazer qualquer coisa na plataforma, já
  implementado (seed).

## Decisões de arquitetura (e por quê)

| Decisão | Escolha | Motivo |
|---|---|---|
| Estratégia de sessão | Cookie `httpOnly` opaco, sessão persistida em `user_sessions` | Mais simples de revogar (logout, admin derrubando sessão) do que JWT; evita gerenciar um segredo de assinatura só para isso. Só é armazenado o hash SHA-256 do token, nunca o token em si. |
| Hash de senha | `bcryptjs` (12 rounds) | Pure-JS: evita depender de toolchain nativa (node-gyp) num ambiente Windows sem esse setup garantido. |
| Unicidade de username/email | `citext` no Postgres | Uniqueness case-insensitive sem normalizar manualmente em toda query. |
| Perfil (nome/nascimento/CPF) | Tabela separada `user_profiles`, 1:1 opcional | Cadastro continua leve; "regularização" é claramente um passo posterior e opcional, como pedido. |
| Idade mínima | 18 anos, hardcoded (`MINIMUM_AGE_YEARS`) | Suposição razoável para uma plataforma de jogos (pode ter conteúdo não indicado para menores); não foi especificado pelo usuário — revisitar se houver requisito diferente. |
| Admin de teste | Script idempotente `npm run db:seed` (não migração) | Migração deveria ser só schema; seed de dados é reexecutável e configurável via `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`. |
| Modo demo (sem banco) | Auth **não** tem fallback mockado | Diferente do catálogo (que tem dados de exemplo), autenticação exige Postgres real — não faz sentido simular contas de usuário. Se `DATABASE_URL` não estiver configurada, as rotas `/api/auth/*` simplesmente não existem. |

## Fora de escopo (intencionalmente)

- Verificação de e-mail (envio de e-mail de confirmação) — não foi pedido; "verificar
  conta" no pedido original se refere à verificação de idade/identidade via perfil, não e-mail.
- Recuperação de senha ("esqueci minha senha").
- Painel de administração dedicado (o admin apenas tem `role = 'admin'` e passa por
  todos os `requireAdmin`/bypass de verificação já existentes).
- Rate limiting / proteção contra força bruta no login.
- Upload de documento para validar o CPF/identidade de fato — a validação atual é
  apenas o checksum matemático do CPF, não uma verificação contra uma base real.

## Teste manual pendente

Este ambiente de desenvolvimento não tinha Docker instalado (o `docker-compose.yml`
do projeto pressupõe isso) e havia um Postgres 18 nativo já rodando localmente,
mas sem credenciais compartilhadas nesta sessão. A lógica está integralmente
coberta por testes automatizados (repositório com fakes, serviço, rotas via
supertest), porém o fluxo completo no navegador (criar conta → logar → completar
perfil → logout) ainda precisa ser validado manualmente. Ver
[`04-como-rodar-e-testar.md`](./04-como-rodar-e-testar.md).
