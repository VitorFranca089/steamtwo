import { describe, expect, it } from "vitest";
import { createAuthService } from "../../server/services/auth-service.js";

function uniqueViolation(constraint) {
  return Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505", constraint });
}

function fakeRepository() {
  const users = [];
  const sessions = [];
  let nextId = 1;

  return {
    users,
    async create({ username, email, passwordHash, role = "user" }) {
      if (users.some((user) => user.username === username)) throw uniqueViolation("users_username_key");
      if (users.some((user) => user.email === email)) throw uniqueViolation("users_email_key");
      const user = { id: String(nextId++), username, email, passwordHash, role, verifiedAt: null };
      users.push(user);
      return user;
    },
    async findByIdentifier(identifier) {
      return users.find((user) => user.username === identifier || user.email === identifier) ?? null;
    },
    async upsertProfile({ userId, fullName, birthDate, cpf }) {
      if (users.some((user) => user.id !== userId && user.cpf === cpf)) throw uniqueViolation("user_profiles_cpf_key");
      const user = users.find((candidate) => candidate.id === userId);
      user.cpf = cpf;
      user.verifiedAt = new Date();
      return { userId, fullName, birthDate, cpf, verifiedAt: user.verifiedAt };
    },
    sessions: {
      async create({ userId, tokenHash, expiresAt }) {
        const session = { userId, tokenHash, expiresAt };
        sessions.push(session);
        return session;
      },
      async findValidByTokenHash(tokenHash) {
        const session = sessions.find((candidate) => candidate.tokenHash === tokenHash && candidate.expiresAt > new Date());
        if (!session) return null;
        const user = users.find((candidate) => candidate.id === session.userId);
        return { id: user.id, username: user.username, email: user.email, role: user.role, verifiedAt: user.verifiedAt };
      },
      async delete(tokenHash) {
        const index = sessions.findIndex((candidate) => candidate.tokenHash === tokenHash);
        if (index >= 0) sessions.splice(index, 1);
      },
    },
  };
}

describe("auth service", () => {
  it("cadastra um usuário e nunca expõe o hash da senha", async () => {
    const service = createAuthService({ repository: fakeRepository() });
    const user = await service.signup({ username: "jogador1", email: "jogador1@exemplo.com", password: "Senha@123" });
    expect(user).toEqual({ id: "1", username: "jogador1", email: "jogador1@exemplo.com", role: "user", isVerified: false, emailVerified: false });
  });

  it("rejeita cadastro com nome de usuário duplicado", async () => {
    const repository = fakeRepository();
    const service = createAuthService({ repository });
    await service.signup({ username: "jogador1", email: "a@exemplo.com", password: "Senha@123" });
    await expect(service.signup({ username: "jogador1", email: "b@exemplo.com", password: "Senha@123" }))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining("usuário") });
  });

  it("rejeita cadastro com e-mail duplicado", async () => {
    const repository = fakeRepository();
    const service = createAuthService({ repository });
    await service.signup({ username: "jogador1", email: "a@exemplo.com", password: "Senha@123" });
    await expect(service.signup({ username: "jogador2", email: "a@exemplo.com", password: "Senha@123" }))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining("mail") });
  });

  it("autentica com credenciais corretas e cria uma sessão", async () => {
    const repository = fakeRepository();
    const service = createAuthService({ repository });
    await service.signup({ username: "jogador1", email: "jogador1@exemplo.com", password: "Senha@123" });
    const { token, user } = await service.login({ identifier: "jogador1", password: "Senha@123" });
    expect(token).toHaveLength(64);
    expect(user.username).toBe("jogador1");
    await expect(service.sessionUser(token)).resolves.toMatchObject({ username: "jogador1" });
  });

  it("rejeita senha incorreta ou usuário inexistente", async () => {
    const repository = fakeRepository();
    const service = createAuthService({ repository });
    await service.signup({ username: "jogador1", email: "jogador1@exemplo.com", password: "Senha@123" });
    await expect(service.login({ identifier: "jogador1", password: "errada" })).rejects.toMatchObject({ status: 401 });
    await expect(service.login({ identifier: "ninguem", password: "Senha@123" })).rejects.toMatchObject({ status: 401 });
  });

  it("invalida a sessão após logout", async () => {
    const repository = fakeRepository();
    const service = createAuthService({ repository });
    await service.signup({ username: "jogador1", email: "jogador1@exemplo.com", password: "Senha@123" });
    const { token } = await service.login({ identifier: "jogador1", password: "Senha@123" });
    await service.logout(token);
    await expect(service.sessionUser(token)).resolves.toBeNull();
  });

  it("completa o perfil e marca o usuário como verificado", async () => {
    const repository = fakeRepository();
    const service = createAuthService({ repository });
    const user = await service.signup({ username: "jogador1", email: "jogador1@exemplo.com", password: "Senha@123" });
    const profile = await service.completeProfile(user.id, { fullName: "Fulano da Silva", birthDate: "2000-01-01", cpf: "100.000.000-19" });
    expect(profile.cpf).toBe("10000000019");
    const { token } = await service.login({ identifier: "jogador1", password: "Senha@123" });
    await expect(service.sessionUser(token)).resolves.toMatchObject({ isVerified: true });
  });

  it("rejeita perfil com CPF já usado por outra conta", async () => {
    const repository = fakeRepository();
    const service = createAuthService({ repository });
    const first = await service.signup({ username: "jogador1", email: "a@exemplo.com", password: "Senha@123" });
    const second = await service.signup({ username: "jogador2", email: "b@exemplo.com", password: "Senha@123" });
    await service.completeProfile(first.id, { fullName: "Fulano", birthDate: "2000-01-01", cpf: "100.000.000-19" });
    await expect(service.completeProfile(second.id, { fullName: "Ciclano", birthDate: "2000-01-01", cpf: "100.000.000-19" }))
      .rejects.toMatchObject({ status: 409 });
  });
});
