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
  let nextId = 1;
  return {
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
    async findById(id) {
      return users.find((user) => user.id === id) ?? null;
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
        return { id: user.id, username: user.username, email: user.email, role: user.role, verifiedAt: user.verifiedAt };
      },
      async delete(tokenHash) {
        const index = sessions.findIndex((candidate) => candidate.tokenHash === tokenHash);
        if (index >= 0) sessions.splice(index, 1);
      },
    },
  };
}

function buildApp() {
  const authService = createAuthService({ repository: fakeRepository() });
  return createApp({ apiRouter: createApiRouter({ authService }) });
}

describe("auth routes", () => {
  it("cadastra, faz login com cookie de sessão e retorna o usuário atual", async () => {
    const app = buildApp();
    const agent = request.agent(app);

    await agent.post("/api/auth/signup")
      .send({ username: "jogador1", email: "jogador1@exemplo.com", password: "Senha@123" })
      .expect(201);

    const loginResponse = await agent.post("/api/auth/login")
      .send({ identifier: "jogador1", password: "Senha@123" })
      .expect(200);
    expect(loginResponse.headers["set-cookie"][0]).toContain("steamtwo_session=");

    const meResponse = await agent.get("/api/auth/me").expect(200);
    expect(meResponse.body.user).toMatchObject({ username: "jogador1", role: "user", isVerified: false });
  });

  it("retorna usuário nulo quando não há sessão", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/auth/me").expect(200);
    expect(response.body.user).toBeNull();
  });

  it("rejeita cadastro com senha fraca", async () => {
    const app = buildApp();
    await request(app).post("/api/auth/signup")
      .send({ username: "jogador1", email: "jogador1@exemplo.com", password: "fraca" })
      .expect(400);
  });

  it("rejeita login com credenciais inválidas", async () => {
    const app = buildApp();
    await request(app).post("/api/auth/login")
      .send({ identifier: "ninguem", password: "Senha@123" })
      .expect(401);
  });

  it("bloqueia completar perfil sem sessão", async () => {
    const app = buildApp();
    await request(app).post("/api/auth/profile")
      .send({ fullName: "Fulano da Silva", birthDate: "2000-01-01", cpf: "100.000.000-19" })
      .expect(401);
  });

  it("retorna uma mensagem legível (não JSON bruto) para CPF inválido", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ username: "jogador1", email: "jogador1@exemplo.com", password: "Senha@123" }).expect(201);
    await agent.post("/api/auth/login").send({ identifier: "jogador1", password: "Senha@123" }).expect(200);

    const response = await agent.post("/api/auth/profile")
      .send({ fullName: "Fulano da Silva", birthDate: "2000-01-01", cpf: "111.111.111-11" })
      .expect(400);
    expect(response.body.error).toBe("CPF inválido");
  });

  it("completa o perfil autenticado e derruba a sessão no logout", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({ username: "jogador1", email: "jogador1@exemplo.com", password: "Senha@123" }).expect(201);
    await agent.post("/api/auth/login").send({ identifier: "jogador1", password: "Senha@123" }).expect(200);

    const profileResponse = await agent.post("/api/auth/profile")
      .send({ fullName: "Fulano da Silva", birthDate: "2000-01-01", cpf: "100.000.000-19" })
      .expect(200);
    expect(profileResponse.body.profile.cpf).toBe("10000000019");

    await agent.post("/api/auth/logout").expect(204);
    const meAfterLogout = await agent.get("/api/auth/me").expect(200);
    expect(meAfterLogout.body.user).toBeNull();
  });
});
