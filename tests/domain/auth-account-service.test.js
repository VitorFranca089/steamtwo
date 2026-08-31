import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
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
    users,
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

function extractToken(link) {
  return new URL(link).searchParams.get("token");
}

async function signupUser(service, overrides = {}) {
  return service.signup({ username: "jogador1", email: "jogador1@exemplo.com", password: "Senha@123", ...overrides });
}

describe("auth service — conta, verificação de e-mail e redefinição de senha", () => {
  it("envia um e-mail de verificação ao cadastrar, quando há mailer configurado", async () => {
    const mailer = fakeMailer();
    const service = createAuthService({ repository: fakeRepository(), mailer, appBaseUrl: "http://localhost:5173" });
    await signupUser(service);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("jogador1@exemplo.com");
    expect(mailer.sent[0].subject).toContain("Confirme");
  });

  it("não falha o cadastro quando não há mailer configurado", async () => {
    const service = createAuthService({ repository: fakeRepository() });
    await expect(signupUser(service)).resolves.toMatchObject({ emailVerified: false });
  });

  it("confirma a verificação de e-mail com um token válido", async () => {
    const mailer = fakeMailer();
    const service = createAuthService({ repository: fakeRepository(), mailer, appBaseUrl: "http://localhost:5173" });
    await signupUser(service);
    const token = extractToken(mailer.sent[0].html.match(/href="([^"]+)"/)[1]);

    await service.confirmEmailVerification({ token });
    const { user } = await service.login({ identifier: "jogador1", password: "Senha@123" });
    expect(user.emailVerified).toBe(true);
  });

  it("rejeita confirmação com token inválido", async () => {
    const service = createAuthService({ repository: fakeRepository(), mailer: fakeMailer(), appBaseUrl: "http://localhost:5173" });
    await signupUser(service);
    await expect(service.confirmEmailVerification({ token: "token-invalido" })).rejects.toMatchObject({ status: 400 });
  });

  it("reenvia o e-mail de verificação e invalida o token anterior", async () => {
    const mailer = fakeMailer();
    const service = createAuthService({ repository: fakeRepository(), mailer, appBaseUrl: "http://localhost:5173" });
    const user = await signupUser(service);
    const firstToken = extractToken(mailer.sent[0].html.match(/href="([^"]+)"/)[1]);

    await service.requestEmailVerification(user.id);
    expect(mailer.sent).toHaveLength(2);
    const secondToken = extractToken(mailer.sent[1].html.match(/href="([^"]+)"/)[1]);

    await expect(service.confirmEmailVerification({ token: firstToken })).rejects.toMatchObject({ status: 400 });
    await expect(service.confirmEmailVerification({ token: secondToken })).resolves.toBeUndefined();
  });

  it("altera o nome de usuário e rejeita duplicado", async () => {
    const service = createAuthService({ repository: fakeRepository() });
    const user = await signupUser(service);
    await service.signup({ username: "jogador2", email: "jogador2@exemplo.com", password: "Senha@123" });

    await expect(service.changeUsername(user.id, { username: "jogador2" })).rejects.toMatchObject({ status: 409 });
    await expect(service.changeUsername(user.id, { username: "novoNome" })).resolves.toMatchObject({ username: "novoNome" });
  });

  it("altera o e-mail com a senha atual correta e reenvia verificação", async () => {
    const mailer = fakeMailer();
    const service = createAuthService({ repository: fakeRepository(), mailer, appBaseUrl: "http://localhost:5173" });
    const user = await signupUser(service);

    await expect(service.changeEmail(user.id, { email: "novo@exemplo.com", currentPassword: "errada" }))
      .rejects.toMatchObject({ status: 401 });

    await service.changeEmail(user.id, { email: "novo@exemplo.com", currentPassword: "Senha@123" });
    const account = await service.getAccount(user.id);
    expect(account.email).toBe("novo@exemplo.com");
    expect(account.emailVerified).toBe(false);
    expect(mailer.sent).toHaveLength(2);
    expect(mailer.sent[1].to).toBe("novo@exemplo.com");
  });

  it("altera a senha com a senha atual correta e derruba todas as sessões", async () => {
    const service = createAuthService({ repository: fakeRepository() });
    const user = await signupUser(service);
    const { token } = await service.login({ identifier: "jogador1", password: "Senha@123" });

    await expect(service.changePassword(user.id, { currentPassword: "errada", newPassword: "Nova@1234" }))
      .rejects.toMatchObject({ status: 401 });

    await service.changePassword(user.id, { currentPassword: "Senha@123", newPassword: "Nova@1234" });
    await expect(service.sessionUser(token)).resolves.toBeNull();
    await expect(service.login({ identifier: "jogador1", password: "Nova@1234" })).resolves.toBeTruthy();
  });

  it("solicita redefinição de senha sem revelar se a conta existe", async () => {
    const mailer = fakeMailer();
    const service = createAuthService({ repository: fakeRepository(), mailer, appBaseUrl: "http://localhost:5173" });
    await signupUser(service);
    mailer.sent.length = 0;

    await expect(service.requestPasswordReset({ identifier: "ninguem@exemplo.com" })).resolves.toBeUndefined();
    expect(mailer.sent).toHaveLength(0);

    await service.requestPasswordReset({ identifier: "jogador1" });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].subject).toContain("Redefinir");
  });

  it("redefine a senha com um token válido e derruba as sessões", async () => {
    const mailer = fakeMailer();
    const service = createAuthService({ repository: fakeRepository(), mailer, appBaseUrl: "http://localhost:5173" });
    await signupUser(service);
    const { token: sessionToken } = await service.login({ identifier: "jogador1", password: "Senha@123" });

    await service.requestPasswordReset({ identifier: "jogador1" });
    const resetToken = extractToken(mailer.sent.at(-1).html.match(/href="([^"]+)"/)[1]);

    await service.resetPassword({ token: resetToken, password: "OutraNova@1" });
    await expect(service.sessionUser(sessionToken)).resolves.toBeNull();
    await expect(service.login({ identifier: "jogador1", password: "OutraNova@1" })).resolves.toBeTruthy();
    await expect(service.resetPassword({ token: resetToken, password: "Terceira@12" })).rejects.toMatchObject({ status: 400 });
  });

  it("rejeita redefinição com token inválido ou expirado", async () => {
    const service = createAuthService({ repository: fakeRepository(), mailer: fakeMailer(), appBaseUrl: "http://localhost:5173" });
    await signupUser(service);
    await expect(service.resetPassword({ token: "token-invalido", password: "OutraNova@1" }))
      .rejects.toMatchObject({ status: 400 });
  });
});
