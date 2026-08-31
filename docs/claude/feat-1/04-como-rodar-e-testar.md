# Como rodar e testar

## 1. Subir o banco

Via Docker (padrão do projeto):

```bash
docker compose up -d
```

Ou apontando `DATABASE_URL` (no `.env`) para qualquer Postgres 14+ já existente.
Se for usar um Postgres já instalado localmente (fora do Docker), crie o papel
e o banco antes de migrar:

```sql
CREATE ROLE steamtwo LOGIN PASSWORD 'steamtwo';
CREATE DATABASE steamtwo OWNER steamtwo;
```

## 2. Instalar dependências, configurar `.env` e migrar

```bash
npm install
copy .env.example .env
npm run db:migrate
```

## 3. Criar o usuário admin de teste

```bash
npm run db:seed
```

Isso imprime as credenciais usadas (username/e-mail; a senha só aparece se você
não tiver definido `ADMIN_PASSWORD` no `.env`). Rodar de novo é seguro — o
script faz `ON CONFLICT` e apenas atualiza o registro existente.

## 4. Rodar a aplicação

```bash
npm run dev:api
npm run dev
```

- Frontend: http://127.0.0.1:5173/
- API: http://127.0.0.1:3001/api/health

## 5. Testes automatizados

```bash
npm test
```

Cobre (56 testes no total, incluindo os já existentes do catálogo):

- `tests/domain/auth-cpf.test.js` — checksum de CPF e cálculo de idade.
- `tests/domain/auth-validation.test.js` — regras de username/senha/e-mail/perfil (Zod).
- `tests/domain/auth-service.test.js` — cadastro, login, sessão, logout, conflito de
  username/e-mail/CPF, conclusão de perfil — usando um repositório fake em memória
  (sem precisar de banco real).
- `tests/api/auth-routes.test.js` — rotas HTTP via `supertest` (cookie de sessão,
  401/409/400 nos casos de erro), também com repositório fake.

Nenhum desses testes precisa de Postgres rodando.

## 6. Roteiro de teste manual (pendente de execução nesta sessão)

Com o app rodando e o admin semeado:

1. Acesse `/cadastro`, crie uma conta com uma senha fraca → deve mostrar os
   requisitos não atendidos e bloquear o envio antes mesmo de chamar a API.
2. Cadastre com uma senha forte → deve redirecionar para `/entrar`.
3. Tente cadastrar de novo com o mesmo `username` (ou `email`) → erro 409 exibido no formulário.
4. Faça login com o usuário criado → deve ir para a home, header mostra o
   username e o link "Completar perfil".
5. Acesse `/perfil`, envie nome completo + data de nascimento (menor de 18) →
   deve ser rejeitado. Envie novamente com uma data válida (18+) e um CPF válido
   → o link "Completar perfil" some do header.
6. Faça logout → header volta a mostrar "Entrar"/"Criar conta"; `GET /api/auth/me`
   deve retornar `user: null`.
7. Faça login com o admin (`npm run db:seed`) → o header deve mostrar o badge
   `ADMIN` e **não** exibir "Completar perfil", mesmo sem ter enviado dados de perfil.
