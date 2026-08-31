# Conta, verificação de e-mail e redefinição de senha

## Pedido original

- Uma tela de "configurações da conta" mostrando username, nome verdadeiro, CPF e e-mail.
- Validação de e-mail para tornar o perfil válido.
- Um "mail sender" reutilizável para que futuras funcionalidades também consigam
  enviar e-mail para o usuário.
- Possibilitar que o usuário altere os dados da própria conta.
- "Esqueci minha senha": o usuário troca a senha usando um token enviado por e-mail.
- E-mail configurado via Mailtrap: a chave de acesso vai no `.env` real do usuário;
  `.env.example` deve ter os mesmos nomes de variável como placeholder, sempre sincronizados.
- Executar sem pedir aprovação a cada passo, até tudo funcionar.

## Decisões de arquitetura (e por quê)

| Decisão | Escolha | Motivo |
|---|---|---|
| Transporte de e-mail | `nodemailer` com transporte SMTP genérico (`server/integrations/mailer.js`) | Mailtrap oferece credenciais SMTP prontas para uso ("SMTP Settings" da inbox de testes) — mais portátil que amarrar o código a uma API HTTP específica de um provedor. Trocar de Mailtrap para qualquer outro SMTP (SendGrid, Amazon SES, etc.) no futuro é só trocar variáveis de ambiente. |
| Mailer ausente/não configurado | `createMailer` retorna `null` quando `SMTP_HOST` está vazio; todo envio de e-mail no `auth-service.js` é best-effort (`if (!mailer) return;`) | O projeto já segue esse padrão para features que dependem de configuração externa opcional (ex.: auth em si só existe com `DATABASE_URL`). Sem isso, rodar o projeto localmente sem preencher o Mailtrap quebraria cadastro/login inteiros. |
| Verificação de e-mail é separada da verificação de KYC | Nova coluna `users.email_verified_at`, independente de `user_profiles.verified_at` (Feature 1) | São validações de naturezas diferentes (posse do e-mail vs. identidade/idade). Misturar as duas mudaria o significado de `isVerified` já usado em vários lugares do frontend (badge "Completar perfil", bypass de admin etc.). O front agora mostra os dois status lado a lado na tela de conta. |
| Tokens de verificação e de redefinição de senha | Tabelas dedicadas (`email_verification_tokens`, `password_reset_tokens`), mesmo padrão de `user_sessions`: token opaco de 32 bytes, só o hash SHA-256 é persistido, expiração e uso único | Reaproveita um padrão já testado no projeto (sessões) em vez de inventar um novo mecanismo. Função de geração/hash compartilhada em `server/domain/auth/tokens.js`. |
| Expiração dos tokens | Verificação de e-mail: 24h. Redefinição de senha: 1h. | Redefinição de senha é mais sensível (dá acesso à conta), então a janela é bem mais curta. Valores em `server/domain/auth/constants.js`. |
| "Esqueci a senha" não revela se a conta existe | `POST /api/auth/password/forgot` sempre responde `200` com a mesma mensagem genérica, envia e-mail só se a conta existir | Evita enumeração de contas por e-mail/usuário — prática padrão de segurança para esse tipo de fluxo. |
| Trocar a senha (autenticado) e redefinir a senha (via token) derrubam todas as sessões | `sessions.deleteAllForUser` chamado nos dois fluxos | Se alguém mais tinha uma sessão ativa (ou a senha vazou), trocar a senha precisa invalidar qualquer acesso anterior, não só a sessão atual. O endpoint `POST /api/auth/password/change` também limpa o cookie da requisição atual e o frontend redireciona para o login. |
| Trocar e-mail exige a senha atual | `PATCH /api/auth/email` recebe `{ email, currentPassword }` | E-mail é usado para redefinir senha — trocar sem confirmar a senha atual abriria uma forma de sequestrar a conta a partir de uma sessão roubada. |
| Trocar e-mail zera a verificação | `updateEmail` seta `email_verified_at = NULL` e um novo e-mail de verificação é enviado automaticamente | O novo endereço ainda não teve a posse comprovada; simplificação de v1: a troca já é aplicada em `users.email` imediatamente (não existe um "e-mail pendente" separado) — ver limitação abaixo. |
| Dados pessoais (nome/nascimento/CPF) na tela de conta | Reaproveita o endpoint já existente `POST /api/auth/profile` (Feature 1) | Já fazia exatamente o que a tela de conta precisa (upsert com validação de idade/CPF); nenhuma rota nova foi necessária para esse pedaço. |
| Username editável | Novo endpoint `PATCH /api/auth/username`, mesma validação/bloqueio de nomes reservados já usados no cadastro | Consistência: as mesmas regras que valem para escolher um username no cadastro valem para trocar depois. |

## Fora de escopo (intencionalmente)

- **E-mail "pendente" de confirmação**: ao trocar o e-mail, o endereço antigo deixa de
  funcionar para login imediatamente (a troca é aplicada na hora, não fica um e-mail
  antigo válido até confirmar o novo). Se o usuário digitar um e-mail errado, ele
  precisa corrigir manualmente na tela de conta — não há e-mail de confirmação para o
  endereço **antigo** avisando sobre a mudança.
- Rate limiting nos endpoints de "esqueci a senha" / reenvio de verificação (proteção
  contra spam de envio de e-mails) — mesma lacuna já documentada para login na Feature 1.
- Autenticação de dois fatores.
- Notificação por e-mail de outras ações de segurança (ex.: "sua senha foi alterada").
  O mail sender já está pronto para isso (`server/integrations/mailer.js`), mas nenhum
  gatilho adicional foi criado — fica para quando alguma feature futura precisar.
- Deleção de conta.
