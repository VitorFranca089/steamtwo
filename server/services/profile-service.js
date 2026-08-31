import {
  favoriteSchema,
  gameIdSchema,
  createAchievementSchema,
} from "../domain/profile/validation.js";

function notFoundError(message) {
  return Object.assign(new Error(message), { status: 404 });
}

function toPublicUser(row) {
  return { id: row.id, username: row.username };
}

async function buildProfile(repository, userId) {
  const [media, favorites, wishlist, achievements] = await Promise.all([
    repository.getMedia(userId),
    repository.listFavorites(userId),
    repository.listWishlist(userId),
    repository.listAchievements(userId),
  ]);
  return {
    avatarUrl: media?.avatarUrl ?? null,
    coverUrl: media?.coverUrl ?? null,
    favorites,
    wishlist,
    achievements,
  };
}

async function withGameNotFound(work) {
  try {
    return await work();
  } catch (error) {
    if (error.code === "23503") throw notFoundError("Jogo não encontrado");
    throw error;
  }
}

export function createProfileService({ repository, publicUploadsPath = "/uploads" }) {
  return {
    async getMyProfile(user) {
      return { user, ...(await buildProfile(repository, user.id)) };
    },

    async getPublicProfile(username) {
      const summary = await repository.findUserSummaryByUsername(username);
      if (!summary) throw notFoundError("Perfil não encontrado");
      return { user: toPublicUser(summary), ...(await buildProfile(repository, summary.id)) };
    },

    async saveAvatar(userId, file) {
      if (!file) throw Object.assign(new Error("Envie um arquivo de imagem"), { status: 400 });
      const avatarUrl = `${publicUploadsPath}/avatars/${file.filename}`;
      return repository.upsertAvatar({ userId, avatarUrl });
    },

    async saveCover(userId, file) {
      if (!file) throw Object.assign(new Error("Envie um arquivo de imagem"), { status: 400 });
      const coverUrl = `${publicUploadsPath}/covers/${file.filename}`;
      return repository.upsertCover({ userId, coverUrl });
    },

    async addFavorite(userId, input) {
      const { gameId } = favoriteSchema.parse(input);
      return withGameNotFound(() => repository.addFavorite({ userId, gameId }));
    },

    async removeFavorite(userId, gameId) {
      const parsedGameId = gameIdSchema.parse(gameId);
      return repository.removeFavorite({ userId, gameId: parsedGameId });
    },

    async addToWishlist(userId, input) {
      const { gameId } = favoriteSchema.parse(input);
      return withGameNotFound(() => repository.addToWishlist({ userId, gameId }));
    },

    async removeFromWishlist(userId, gameId) {
      const parsedGameId = gameIdSchema.parse(gameId);
      return repository.removeFromWishlist({ userId, gameId: parsedGameId });
    },

    async createAchievement(userId, input) {
      const { gameId, name } = createAchievementSchema.parse(input);
      return withGameNotFound(() => repository.createAchievement({ userId, gameId, name }));
    },

    async deleteAchievement(userId, id) {
      const parsedId = gameIdSchema.parse(id);
      const deleted = await repository.deleteAchievement({ userId, id: parsedId });
      if (!deleted) throw notFoundError("Conquista não encontrada");
      return deleted;
    },
  };
}
