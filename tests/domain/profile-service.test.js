import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createProfileService } from "../../server/services/profile-service.js";

function foreignKeyViolation() {
  return Object.assign(new Error("insert or update on table violates foreign key constraint"), { code: "23503" });
}

function fakeRepository({ games = [], users = [] } = {}) {
  const media = new Map();
  const favorites = [];
  const wishlist = [];
  const achievements = [];
  let nextAchievementId = 1;
  const gameById = (id) => games.find((game) => game.id === id);

  return {
    async findUserSummaryByUsername(username) {
      return users.find((user) => user.username === username) ?? null;
    },
    async getMedia(userId) {
      return media.get(userId) ?? null;
    },
    async upsertAvatar({ userId, avatarUrl }) {
      const updated = { ...(media.get(userId) ?? { avatarUrl: null, coverUrl: null }), avatarUrl };
      media.set(userId, updated);
      return updated;
    },
    async upsertCover({ userId, coverUrl }) {
      const updated = { ...(media.get(userId) ?? { avatarUrl: null, coverUrl: null }), coverUrl };
      media.set(userId, updated);
      return updated;
    },
    async listFavorites(userId) {
      return favorites.filter((entry) => entry.userId === userId).map((entry) => ({ ...gameById(entry.gameId), createdAt: entry.createdAt }));
    },
    async listWishlist(userId) {
      return wishlist.filter((entry) => entry.userId === userId).map((entry) => ({ ...gameById(entry.gameId), createdAt: entry.createdAt }));
    },
    async addFavorite({ userId, gameId }) {
      if (!gameById(gameId)) throw foreignKeyViolation();
      if (!favorites.some((entry) => entry.userId === userId && entry.gameId === gameId)) {
        favorites.push({ userId, gameId, createdAt: new Date() });
      }
    },
    async removeFavorite({ userId, gameId }) {
      const index = favorites.findIndex((entry) => entry.userId === userId && entry.gameId === gameId);
      if (index >= 0) favorites.splice(index, 1);
    },
    async addToWishlist({ userId, gameId }) {
      if (!gameById(gameId)) throw foreignKeyViolation();
      if (!wishlist.some((entry) => entry.userId === userId && entry.gameId === gameId)) {
        wishlist.push({ userId, gameId, createdAt: new Date() });
      }
    },
    async removeFromWishlist({ userId, gameId }) {
      const index = wishlist.findIndex((entry) => entry.userId === userId && entry.gameId === gameId);
      if (index >= 0) wishlist.splice(index, 1);
    },
    async listAchievements(userId) {
      return achievements
        .filter((entry) => entry.userId === userId)
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          createdAt: entry.createdAt,
          gameId: entry.gameId,
          gameSlug: gameById(entry.gameId)?.slug,
          gameTitle: gameById(entry.gameId)?.title,
          gameCoverUrl: gameById(entry.gameId)?.coverUrl,
        }));
    },
    async createAchievement({ userId, gameId, name }) {
      if (!gameById(gameId)) throw foreignKeyViolation();
      const achievement = { id: randomUUID(), userId, gameId, name, createdAt: new Date() };
      achievements.push(achievement);
      return { id: achievement.id, name: achievement.name, createdAt: achievement.createdAt };
    },
    async deleteAchievement({ userId, id }) {
      const index = achievements.findIndex((entry) => entry.id === id && entry.userId === userId);
      if (index < 0) return null;
      const [removed] = achievements.splice(index, 1);
      return { id: removed.id };
    },
  };
}

describe("profile service", () => {
  const gameId = randomUUID();
  const games = [{ id: gameId, slug: "elden-ring", title: "Elden Ring", coverUrl: "https://example.com/elden.jpg" }];
  const user = { id: "user-1", username: "jogador1", isVerified: false };

  it("retorna um perfil vazio para um usuário novo", async () => {
    const service = createProfileService({ repository: fakeRepository({ games }) });
    const profile = await service.getMyProfile(user);
    expect(profile).toMatchObject({ user, avatarUrl: null, coverUrl: null, favorites: [], wishlist: [], achievements: [] });
  });

  it("salva avatar e capa a partir do arquivo enviado", async () => {
    const service = createProfileService({ repository: fakeRepository({ games }) });
    await service.saveAvatar(user.id, { filename: `${user.id}.jpg` });
    await service.saveCover(user.id, { filename: `${user.id}.png` });
    const profile = await service.getMyProfile(user);
    expect(profile.avatarUrl).toBe(`/uploads/avatars/${user.id}.jpg`);
    expect(profile.coverUrl).toBe(`/uploads/covers/${user.id}.png`);
  });

  it("adicionar aos favoritos é idempotente", async () => {
    const service = createProfileService({ repository: fakeRepository({ games }) });
    await service.addFavorite(user.id, { gameId });
    await service.addFavorite(user.id, { gameId });
    const profile = await service.getMyProfile(user);
    expect(profile.favorites).toHaveLength(1);
  });

  it("rejeita favoritar um jogo inexistente", async () => {
    const service = createProfileService({ repository: fakeRepository({ games }) });
    await expect(service.addFavorite(user.id, { gameId: randomUUID() })).rejects.toMatchObject({ status: 404 });
  });

  it("adiciona e remove da wishlist", async () => {
    const service = createProfileService({ repository: fakeRepository({ games }) });
    await service.addToWishlist(user.id, { gameId });
    expect((await service.getMyProfile(user)).wishlist).toHaveLength(1);
    await service.removeFromWishlist(user.id, gameId);
    expect((await service.getMyProfile(user)).wishlist).toHaveLength(0);
  });

  it("valida o tamanho do nome da conquista", async () => {
    const service = createProfileService({ repository: fakeRepository({ games }) });
    await expect(service.createAchievement(user.id, { gameId, name: "" })).rejects.toThrow();
  });

  it("rejeita conquista para jogo inexistente", async () => {
    const service = createProfileService({ repository: fakeRepository({ games }) });
    await expect(service.createAchievement(user.id, { gameId: randomUUID(), name: "Platinei" }))
      .rejects.toMatchObject({ status: 404 });
  });

  it("cria e remove uma conquista própria", async () => {
    const service = createProfileService({ repository: fakeRepository({ games }) });
    const achievement = await service.createAchievement(user.id, { gameId, name: "Zerei sem morrer" });
    expect((await service.getMyProfile(user)).achievements).toHaveLength(1);
    await service.deleteAchievement(user.id, achievement.id);
    expect((await service.getMyProfile(user)).achievements).toHaveLength(0);
  });

  it("rejeita apagar conquista de outro usuário ou inexistente", async () => {
    const repository = fakeRepository({ games });
    const service = createProfileService({ repository });
    const achievement = await service.createAchievement(user.id, { gameId, name: "Zerei sem morrer" });
    await expect(service.deleteAchievement("outro-usuario", achievement.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.deleteAchievement(user.id, randomUUID())).rejects.toMatchObject({ status: 404 });
  });

  it("perfil público não expõe e-mail nem status de verificação", async () => {
    const repository = fakeRepository({ games, users: [{ id: "user-1", username: "jogador1" }] });
    const service = createProfileService({ repository });
    await service.addFavorite("user-1", { gameId });
    const publicProfile = await service.getPublicProfile("jogador1");
    expect(publicProfile.user).toEqual({ id: "user-1", username: "jogador1" });
    expect(publicProfile.favorites).toHaveLength(1);
  });

  it("404 ao buscar um perfil público inexistente", async () => {
    const service = createProfileService({ repository: fakeRepository({ games }) });
    await expect(service.getPublicProfile("ninguem")).rejects.toMatchObject({ status: 404 });
  });
});
