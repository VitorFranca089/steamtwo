import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { createApiRouter } from "../../server/routes/index.js";
import { createAuthService } from "../../server/services/auth-service.js";

function uniqueViolation(constraint) {
  return Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505", constraint });
}

function fakeRepository() {
  const users = [];
  const sessions = [];
  const emailVerificationTokens = [];
  const passwordResetTokens = [];

  return {
    async create({ username, email, passwordHash, role = "user" }) {
      if (users.some((user) => user.username === username)) throw uniqueViolation("users_username_key");
      if (users.some((user) => user.email === email)) throw uniqueViolation("users_email_key");
      const user = { id: randomUUID(), username, email, passwordHash, role, verifiedAt: null, emailVerifiedAt: null };
      users.push(user);
      return user;
    },
    async findByIdentifier(identifier) {
      return users.find((user) => user.username === identifier || user.email === identifier) ?? null;
    },
    async findById(id) {
      return users.find((user) => user.id === id) ?? null;
    },
    async updateUsername({ userId, username }) {
      if (users.some((user) => user.id !== userId && user.username === username)) throw uniqueViolation("users_username_key");
      const user = users.find((candidate) => candidate.id === userId);
      user.username = username;
      return { id: user.id, username: user.username };
    },
    async updateEmail({ userId, email }) {
      if (users.some((user) => user.id !== userId && user.email === email)) throw uniqueViolation("users_email_key");
      const user = users.find((candidate) => candidate.id === userId);
      user.email = email;
      user.emailVerifiedAt = null;
      return { id: user.id, email: user.email };
    },
    async updatePasswordHash({ userId, passwordHash }) {
      const user = users.find((candidate) => candidate.id === userId);
      user.passwordHash = passwordHash;
    },
    async markEmailVerified({ userId, email }) {
      const user = users.find((candidate) => candidate.id === userId && candidate.email === email);
      if (user) user.emailVerifiedAt = new Date();
    },
    async upsertProfile({ userId, fullName, birthDate, cpf }) {
      const user = users.find((candidate) => candidate.id === userId);
      user.cpf = cpf;
      user.verifiedAt = new Date();
      return { userId, fullName, birthDate, cpf, verifiedAt: user.verifiedAt };
    },
    sessions: {
      async create({ userId, tokenHash, expiresAt }) {
        sessions.push({ userId, tokenHash, expiresAt });
      },
      async findValidByTokenHash(tokenHash) {
        const session = sessions.find((candidate) => candidate.tokenHash === tokenHash && candidate.expiresAt > new Date());
        if (!session) return null;
        const user = users.find((candidate) => candidate.id === session.userId);
        return { id: user.id, username: user.username, email: user.email, role: user.role, verifiedAt: user.verifiedAt, emailVerifiedAt: user.emailVerifiedAt };
      },
      async delete(tokenHash) {
        const index = sessions.findIndex((candidate) => candidate.tokenHash === tokenHash);
        if (index >= 0) sessions.splice(index, 1);
      },
      async deleteAllForUser(userId) {
        for (let index = sessions.length - 1; index >= 0; index -= 1) {
          if (sessions[index].userId === userId) sessions.splice(index, 1);
        }
      },
    },
    emailVerification: {
      async create({ userId, email, tokenHash, expiresAt }) {
        emailVerificationTokens.push({ userId, email, tokenHash, expiresAt });
      },
      async findValidByTokenHash(tokenHash) {
        const record = emailVerificationTokens.find((candidate) => candidate.tokenHash === tokenHash && candidate.expiresAt > new Date());
        return record ? { userId: record.userId, email: record.email } : null;
      },
      async deleteByUserId(userId) {
        for (let index = emailVerificationTokens.length - 1; index >= 0; index -= 1) {
          if (emailVerificationTokens[index].userId === userId) emailVerificationTokens.splice(index, 1);
        }
      },
    },
    passwordReset: {
      async create({ userId, tokenHash, expiresAt }) {
        passwordResetTokens.push({ userId, tokenHash, expiresAt });
      },
      async findValidByTokenHash(tokenHash) {
        const record = passwordResetTokens.find((candidate) => candidate.tokenHash === tokenHash && candidate.expiresAt > new Date());
        return record ? { userId: record.userId } : null;
      },
      async deleteByUserId(userId) {
        for (let index = passwordResetTokens.length - 1; index >= 0; index -= 1) {
          if (passwordResetTokens[index].userId === userId) passwordResetTokens.splice(index, 1);
        }
      },
    },
  };
}

function fakeMailer() {
  const sent = [];
  return { sent, async sendMail(message) { sent.push(message); } };
}

function extractToken(html) {
  return new URL(html.match(/href="([^"]+)"/)[1]).searchParams.get("token");
}

function buildApp(mailer = fakeMailer()) {
  const authService = createAuthService({ repository: fakeRepository(), mailer, appBaseUrl: "http://localhost:5173" });
  return { app: createApp({ apiRouter: createApiRouter({ authService }) }), mailer };
}

async function signupAndLogin(app, username = "jogador1") {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({ username, email: `${username}@exemplo.com`, password: "Senha@123" }).expect(201);
  await agent.post("/api/auth/login").send({ identifier: username, password: "Senha@123" }).expect(200);
  return agent;
}

describe("auth account routes", () => {
  it("exige sessão para as rotas de conta", async () => {
    const { app } = buildApp();
    await request(app).get("/api/auth/account").expect(401);
    await request(app).patch("/api/auth/username").send({ username: "novo" }).expect(401);
    await request(app).patch("/api/auth/email").send({ email: "a@b.com", currentPassword: "x" }).expect(401);
    await request(app).post("/api/auth/password/change").send({ currentPassword: "x", newPassword: "y" }).expect(401);
    await request(app).post("/api/auth/email/verify/request").expect(401);
  });

  it("retorna os dados da conta autenticada", async () => {
    const { app } = buildApp();
    const agent = await signupAndLogin(app);
    const response = await agent.get("/api/auth/account").expect(200);
    expect(response.body.account).toMatchObject({ username: "jogador1", email: "jogador1@exemplo.com", emailVerified: false, isVerified: false });
  });

  it("confirma o e-mail com o token recebido no cadastro", async () => {
    const { app, mailer } = buildApp();
    const agent = await signupAndLogin(app);
    const token = extractToken(mailer.sent[0].html);

    await request(app).post("/api/auth/email/verify/confirm").send({ token }).expect(204);
    const response = await agent.get("/api/auth/account").expect(200);
    expect(response.body.account.emailVerified).toBe(true);
  });

  it("rejeita confirmação de e-mail com token inválido", async () => {
    const { app } = buildApp();
    await request(app).post("/api/auth/email/verify/confirm").send({ token: "invalido" }).expect(400);
  });

  it("reenvia o e-mail de verificação autenticado", async () => {
    const { app, mailer } = buildApp();
    const agent = await signupAndLogin(app);
    await agent.post("/api/auth/email/verify/request").expect(204);
    expect(mailer.sent).toHaveLength(2);
  });

  it("altera username e e-mail autenticado", async () => {
    const { app } = buildApp();
    const agent = await signupAndLogin(app);

    await agent.patch("/api/auth/username").send({ username: "novoNome" }).expect(200);
    await agent.patch("/api/auth/email").send({ email: "novo@exemplo.com", currentPassword: "senhaErrada" }).expect(401);
    const response = await agent.patch("/api/auth/email").send({ email: "novo@exemplo.com", currentPassword: "Senha@123" }).expect(200);
    expect(response.body.account.email).toBe("novo@exemplo.com");
  });

  it("altera a senha e derruba a sessão atual", async () => {
    const { app } = buildApp();
    const agent = await signupAndLogin(app);

    await agent.post("/api/auth/password/change").send({ currentPassword: "senhaErrada", newPassword: "Nova@1234" }).expect(401);
    await agent.post("/api/auth/password/change").send({ currentPassword: "Senha@123", newPassword: "Nova@1234" }).expect(204);
    await agent.get("/api/auth/account").expect(401);

    await request(app).post("/api/auth/login").send({ identifier: "jogador1", password: "Nova@1234" }).expect(200);
  });

  it("solicita e conclui a redefinição de senha por token, sem exigir sessão", async () => {
    const { app, mailer } = buildApp();
    await signupAndLogin(app);
    mailer.sent.length = 0;

    await request(app).post("/api/auth/password/forgot").send({ identifier: "ninguem@exemplo.com" }).expect(200);
    expect(mailer.sent).toHaveLength(0);

    await request(app).post("/api/auth/password/forgot").send({ identifier: "jogador1" }).expect(200);
    expect(mailer.sent).toHaveLength(1);
    const token = extractToken(mailer.sent[0].html);

    await request(app).post("/api/auth/password/reset").send({ token: "invalido", password: "Reset@1234" }).expect(400);
    await request(app).post("/api/auth/password/reset").send({ token, password: "Reset@1234" }).expect(204);
    await request(app).post("/api/auth/login").send({ identifier: "jogador1", password: "Reset@1234" }).expect(200);
  });
});
