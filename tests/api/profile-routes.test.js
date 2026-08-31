import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { createApiRouter } from "../../server/routes/index.js";
import { createAuthService } from "../../server/services/auth-service.js";
import { createProfileService } from "../../server/services/profile-service.js";
import { createUploadStorage } from "../../server/uploads/storage.js";

function uniqueViolation(constraint) {
  return Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505", constraint });
}

function foreignKeyViolation() {
  return Object.assign(new Error("insert or update on table violates foreign key constraint"), { code: "23503" });
}

function createSharedDb() {
  return { users: [], sessions: [], games: [], media: new Map(), favorites: [], wishlist: [], achievements: [] };
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
    async upsertProfile({ userId, fullName, birthDate, cpf }) {
      const user = db.users.find((candidate) => candidate.id === userId);
      user.cpf = cpf;
      user.verifiedAt = new Date();
      return { userId, fullName, birthDate, cpf, verifiedAt: user.verifiedAt };
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

function fakeProfileRepository(db) {
  const gameById = (id) => db.games.find((game) => game.id === id);

  return {
    async findUserSummaryByUsername(username) {
      const user = db.users.find((candidate) => candidate.username === username);
      return user ? { id: user.id, username: user.username } : null;
    },
    async searchUsers(query) {
      return db.users
        .filter((user) => user.username.toLowerCase().includes(query.toLowerCase()))
        .map((user) => ({ id: user.id, username: user.username, avatarUrl: db.media.get(user.id)?.avatarUrl ?? null }));
    },
    async getMedia(userId) {
      return db.media.get(userId) ?? null;
    },
    async upsertAvatar({ userId, avatarUrl }) {
      const updated = { ...(db.media.get(userId) ?? { avatarUrl: null, coverUrl: null }), avatarUrl };
      db.media.set(userId, updated);
      return updated;
    },
    async upsertCover({ userId, coverUrl }) {
      const updated = { ...(db.media.get(userId) ?? { avatarUrl: null, coverUrl: null }), coverUrl };
      db.media.set(userId, updated);
      return updated;
    },
    async listFavorites(userId) {
      return db.favorites.filter((entry) => entry.userId === userId).map((entry) => ({ ...gameById(entry.gameId), createdAt: entry.createdAt }));
    },
    async listWishlist(userId) {
      return db.wishlist.filter((entry) => entry.userId === userId).map((entry) => ({ ...gameById(entry.gameId), createdAt: entry.createdAt }));
    },
    async addFavorite({ userId, gameId }) {
      if (!gameById(gameId)) throw foreignKeyViolation();
      if (!db.favorites.some((entry) => entry.userId === userId && entry.gameId === gameId)) {
        db.favorites.push({ userId, gameId, createdAt: new Date() });
      }
    },
    async removeFavorite({ userId, gameId }) {
      const index = db.favorites.findIndex((entry) => entry.userId === userId && entry.gameId === gameId);
      if (index >= 0) db.favorites.splice(index, 1);
    },
    async addToWishlist({ userId, gameId }) {
      if (!gameById(gameId)) throw foreignKeyViolation();
      if (!db.wishlist.some((entry) => entry.userId === userId && entry.gameId === gameId)) {
        db.wishlist.push({ userId, gameId, createdAt: new Date() });
      }
    },
    async removeFromWishlist({ userId, gameId }) {
      const index = db.wishlist.findIndex((entry) => entry.userId === userId && entry.gameId === gameId);
      if (index >= 0) db.wishlist.splice(index, 1);
    },
    async listAchievements(userId) {
      return db.achievements
        .filter((entry) => entry.userId === userId)
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          createdAt: entry.createdAt,
          gameId: entry.gameId,
          gameTitle: gameById(entry.gameId)?.title,
          gameCoverUrl: gameById(entry.gameId)?.coverUrl,
        }));
    },
    async createAchievement({ userId, gameId, name }) {
      if (!gameById(gameId)) throw foreignKeyViolation();
      const achievement = { id: randomUUID(), userId, gameId, name, createdAt: new Date() };
      db.achievements.push(achievement);
      return { id: achievement.id, name: achievement.name, createdAt: achievement.createdAt };
    },
    async deleteAchievement({ userId, id }) {
      const index = db.achievements.findIndex((entry) => entry.id === id && entry.userId === userId);
      if (index < 0) return null;
      const [removed] = db.achievements.splice(index, 1);
      return { id: removed.id };
    },
  };
}

const tmpRoots = [];

function buildApp(db) {
  const authService = createAuthService({ repository: fakeUsersRepository(db) });
  const profileService = createProfileService({ repository: fakeProfileRepository(db) });
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "steamtwo-uploads-"));
  tmpRoots.push(rootDir);
  const uploadStorage = createUploadStorage({ rootDir });
  uploadStorage.ensureDirs();
  return createApp({
    apiRouter: createApiRouter({
      authService,
      profileService,
      avatarUpload: uploadStorage.avatarUpload,
      coverUpload: uploadStorage.coverUpload,
      avatarsDir: uploadStorage.avatarsDir,
      coversDir: uploadStorage.coversDir,
    }),
    uploadsDir: rootDir,
  });
}

afterAll(() => {
  for (const rootDir of tmpRoots) fs.rmSync(rootDir, { recursive: true, force: true });
});

async function signupAndLogin(app, username) {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({ username, email: `${username}@exemplo.com`, password: "Senha@123" }).expect(201);
  await agent.post("/api/auth/login").send({ identifier: username, password: "Senha@123" }).expect(200);
  return agent;
}

describe("profile routes", () => {
  it("exige sessão para todas as rotas de mutação", async () => {
    const app = buildApp(createSharedDb());
    await request(app).get("/api/profile/me").expect(401);
    await request(app).post("/api/profile/favorites").send({ gameId: randomUUID() }).expect(401);
    await request(app).delete(`/api/profile/favorites/${randomUUID()}`).expect(401);
    await request(app).post("/api/profile/wishlist").send({ gameId: randomUUID() }).expect(401);
    await request(app).post("/api/profile/achievements").send({ gameId: randomUUID(), name: "Zerei" }).expect(401);
    await request(app).delete(`/api/profile/achievements/${randomUUID()}`).expect(401);
  });

  it("retorna listas vazias para um perfil recém-criado", async () => {
    const db = createSharedDb();
    const app = buildApp(db);
    const agent = await signupAndLogin(app, "jogador1");
    const response = await agent.get("/api/profile/me").expect(200);
    expect(response.body).toMatchObject({ avatarUrl: null, coverUrl: null, favorites: [], wishlist: [], achievements: [] });
  });

  it("faz upload de avatar e persiste entre requisições", async () => {
    const db = createSharedDb();
    const app = buildApp(db);
    const agent = await signupAndLogin(app, "jogador1");

    const uploadResponse = await agent.post("/api/profile/avatar")
      .attach("avatar", Buffer.from("fake-image-bytes"), { filename: "a.png", contentType: "image/png" })
      .expect(200);
    expect(uploadResponse.body.avatarUrl).toMatch(/^\/uploads\/avatars\/.+\.png$/);

    const meResponse = await agent.get("/api/profile/me").expect(200);
    expect(meResponse.body.avatarUrl).toBe(uploadResponse.body.avatarUrl);
  });

  it("rejeita upload de arquivo com mimetype não suportado", async () => {
    const db = createSharedDb();
    const app = buildApp(db);
    const agent = await signupAndLogin(app, "jogador1");
    await agent.post("/api/profile/avatar")
      .attach("avatar", Buffer.from("not an image"), { filename: "a.txt", contentType: "text/plain" })
      .expect(400);
  });

  it("rejeita upload maior que o limite de 5MB", async () => {
    const db = createSharedDb();
    const app = buildApp(db);
    const agent = await signupAndLogin(app, "jogador1");
    const oversized = Buffer.alloc(6 * 1024 * 1024, 1);
    await agent.post("/api/profile/avatar")
      .attach("avatar", oversized, { filename: "big.png", contentType: "image/png" })
      .expect(400);
  });

  it("adiciona, lista e remove favoritos e wishlist", async () => {
    const db = createSharedDb();
    const gameId = randomUUID();
    db.games.push({ id: gameId, slug: "elden-ring", title: "Elden Ring", coverUrl: "https://example.com/elden.jpg" });
    const app = buildApp(db);
    const agent = await signupAndLogin(app, "jogador1");

    await agent.post("/api/profile/favorites").send({ gameId }).expect(201);
    await agent.post("/api/profile/wishlist").send({ gameId }).expect(201);
    const withItems = await agent.get("/api/profile/me").expect(200);
    expect(withItems.body.favorites).toHaveLength(1);
    expect(withItems.body.wishlist).toHaveLength(1);

    await agent.delete(`/api/profile/favorites/${gameId}`).expect(204);
    await agent.delete(`/api/profile/wishlist/${gameId}`).expect(204);
    const cleared = await agent.get("/api/profile/me").expect(200);
    expect(cleared.body.favorites).toHaveLength(0);
    expect(cleared.body.wishlist).toHaveLength(0);
  });

  it("404 ao favoritar um jogo inexistente", async () => {
    const db = createSharedDb();
    const app = buildApp(db);
    const agent = await signupAndLogin(app, "jogador1");
    await agent.post("/api/profile/favorites").send({ gameId: randomUUID() }).expect(404);
  });

  it("cria, lista e apaga conquistas, e impede apagar conquista de outro usuário", async () => {
    const db = createSharedDb();
    const gameId = randomUUID();
    db.games.push({ id: gameId, slug: "elden-ring", title: "Elden Ring", coverUrl: "https://example.com/elden.jpg" });
    const app = buildApp(db);
    const owner = await signupAndLogin(app, "jogador1");
    const other = await signupAndLogin(app, "jogador2");

    const createResponse = await owner.post("/api/profile/achievements").send({ gameId, name: "Zerei sem morrer" }).expect(201);
    const achievementId = createResponse.body.achievement.id;

    const listed = await owner.get("/api/profile/me").expect(200);
    expect(listed.body.achievements).toHaveLength(1);

    await other.delete(`/api/profile/achievements/${achievementId}`).expect(404);
    await owner.delete(`/api/profile/achievements/${achievementId}`).expect(204);
  });

  it("expõe o perfil público sem autenticação e 404 para usuário desconhecido", async () => {
    const db = createSharedDb();
    const gameId = randomUUID();
    db.games.push({ id: gameId, slug: "elden-ring", title: "Elden Ring", coverUrl: "https://example.com/elden.jpg" });
    const app = buildApp(db);
    const agent = await signupAndLogin(app, "jogador1");
    await agent.post("/api/profile/favorites").send({ gameId }).expect(201);

    const publicResponse = await request(app).get("/api/profile/jogador1").expect(200);
    expect(publicResponse.body.user).toEqual({ id: expect.any(String), username: "jogador1" });
    expect(publicResponse.body.favorites).toHaveLength(1);

    await request(app).get("/api/profile/ninguem").expect(404);
  });

  it("busca jogadores por username, excluindo quem já está autenticado", async () => {
    const db = createSharedDb();
    const app = buildApp(db);
    await signupAndLogin(app, "jogador1");
    const agent2 = await signupAndLogin(app, "jogador2");

    const anonResults = await request(app).get("/api/profile?q=jogador").expect(200);
    expect(anonResults.body.users.map((user) => user.username).sort()).toEqual(["jogador1", "jogador2"]);

    const ownResults = await agent2.get("/api/profile?q=jogador").expect(200);
    expect(ownResults.body.users.map((user) => user.username)).toEqual(["jogador1"]);

    const tooShort = await request(app).get("/api/profile?q=j").expect(200);
    expect(tooShort.body.users).toEqual([]);
  });
});
