import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { createApiRouter } from "../../server/routes/index.js";
import { createAuthService } from "../../server/services/auth-service.js";
import { createAdminCatalogService } from "../../server/services/admin-catalog-service.js";
import { createUploadStorage } from "../../server/uploads/storage.js";

function uniqueViolation(constraint) {
  return Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505", constraint });
}

function createSharedDb() {
  return { users: [], sessions: [], games: [] };
}

function fakeUsersRepository(db) {
  let nextId = 1;
  return {
    async create({ username, email, passwordHash, role = "user" }) {
      if (db.users.some((user) => user.username === username)) throw uniqueViolation("users_username_key");
      if (db.users.some((user) => user.email === email)) throw uniqueViolation("users_email_key");
      const user = { id: String(nextId++), username, email, passwordHash, role, verifiedAt: null };
      db.users.push(user);
      return user;
    },
    async findByIdentifier(identifier) {
      return db.users.find((user) => user.username === identifier || user.email === identifier) ?? null;
    },
    sessions: {
      async create({ userId, tokenHash, expiresAt }) {
        db.sessions.push({ userId, tokenHash, expiresAt });
      },
      async findValidByTokenHash(tokenHash) {
        const session = db.sessions.find((candidate) => candidate.tokenHash === tokenHash && candidate.expiresAt > new Date());
        if (!session) return null;
        const user = db.users.find((candidate) => candidate.id === session.userId);
        return { id: user.id, username: user.username, email: user.email, role: user.role, verifiedAt: user.verifiedAt };
      },
      async delete(tokenHash) {
        const index = db.sessions.findIndex((candidate) => candidate.tokenHash === tokenHash);
        if (index >= 0) db.sessions.splice(index, 1);
      },
    },
  };
}

function fakeAdminRepository(db) {
  return {
    games: {
      async createIndependent({ slug, title, summary, coverUrl, heroUrl, releasedAt, genres, submittedBy }) {
        if (db.games.some((game) => game.slug === slug)) throw uniqueViolation("games_slug_key");
        const game = { id: randomUUID(), slug, title, summary, coverUrl, heroUrl, releasedAt, genres: genres.map((g) => g.name), origin: "admin", submittedBy };
        db.games.push(game);
        return { id: game.id, slug: game.slug, title: game.title };
      },
      async listByOrigin(origin) {
        return db.games.filter((game) => game.origin === origin);
      },
      async deleteById(id, { origin } = {}) {
        const index = db.games.findIndex((game) => game.id === id && (!origin || game.origin === origin));
        if (index < 0) return null;
        const [removed] = db.games.splice(index, 1);
        return { id: removed.id };
      },
    },
  };
}

const tmpRoots = [];

function buildApp(db) {
  const authService = createAuthService({ repository: fakeUsersRepository(db) });
  const adminCatalogService = createAdminCatalogService({ repository: fakeAdminRepository(db) });
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "steamtwo-admin-uploads-"));
  tmpRoots.push(rootDir);
  const uploadStorage = createUploadStorage({ rootDir });
  uploadStorage.ensureDirs();
  return createApp({
    apiRouter: createApiRouter({
      authService,
      adminCatalogService,
      gameImageUpload: uploadStorage.gameImageUpload,
    }),
    uploadsDir: rootDir,
  });
}

afterAll(() => {
  for (const rootDir of tmpRoots) fs.rmSync(rootDir, { recursive: true, force: true });
});

// The signup route always creates `role: "user"`; tests that need an admin
// promote the fake user afterwards, mirroring what `npm run db:seed` does
// for the real admin account in production.
async function signupAndLogin(app, username) {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({ username, email: `${username}@exemplo.com`, password: "Senha@123" }).expect(201);
  await agent.post("/api/auth/login").send({ identifier: username, password: "Senha@123" }).expect(200);
  return agent;
}

describe("admin catalog routes", () => {
  it("exige sessão e depois papel de admin para todas as rotas", async () => {
    const db = createSharedDb();
    const app = buildApp(db);
    await request(app).get("/api/admin/games").expect(401);
    await request(app).post("/api/admin/games").field("title", "Jogo X").expect(401);
    await request(app).delete(`/api/admin/games/${randomUUID()}`).expect(401);

    const regularAgent = await signupAndLogin(app, "jogador1");
    await regularAgent.get("/api/admin/games").expect(403);
    await regularAgent.post("/api/admin/games").field("title", "Jogo X").expect(403);
  });

  it("permite que um admin envie, liste e apague um jogo independente", async () => {
    const db = createSharedDb();
    const app = buildApp(db);
    const agent = await signupAndLogin(app, "admin1");
    db.users.find((user) => user.username === "admin1").role = "admin";

    const created = await agent.post("/api/admin/games")
      .field("title", "Jogo Indie Autoral")
      .field("summary", "Feito por uma dupla independente.")
      .field("genres", "Plataforma, Indie")
      .attach("cover", Buffer.from("fake-image-bytes"), { filename: "cover.png", contentType: "image/png" })
      .expect(201);
    expect(created.body.game).toMatchObject({ title: "Jogo Indie Autoral" });

    const list = await agent.get("/api/admin/games").expect(200);
    expect(list.body.games).toHaveLength(1);
    expect(list.body.games[0]).toMatchObject({ origin: "admin", title: "Jogo Indie Autoral" });

    await agent.delete(`/api/admin/games/${created.body.game.id}`).expect(204);
    const afterDelete = await agent.get("/api/admin/games").expect(200);
    expect(afterDelete.body.games).toHaveLength(0);
  });

  it("rejeita título vazio com 400 e título duplicado com 409", async () => {
    const db = createSharedDb();
    const app = buildApp(db);
    const agent = await signupAndLogin(app, "admin1");
    db.users.find((user) => user.username === "admin1").role = "admin";

    await agent.post("/api/admin/games").field("title", "").expect(400);
    await agent.post("/api/admin/games").field("title", "Jogo Repetido").expect(201);
    await agent.post("/api/admin/games").field("title", "Jogo Repetido").expect(409);
  });

  it("404 ao apagar um jogo independente inexistente", async () => {
    const db = createSharedDb();
    const app = buildApp(db);
    const agent = await signupAndLogin(app, "admin1");
    db.users.find((user) => user.username === "admin1").role = "admin";
    await agent.delete(`/api/admin/games/${randomUUID()}`).expect(404);
  });
});
