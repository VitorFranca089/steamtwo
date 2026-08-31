/** Persistence boundary for avatar/cover media, favorites, wishlist and achievements. */
export function createProfileRepository(pool) {
  return {
    async findUserSummaryByUsername(username) {
      const result = await pool.query(
        `SELECT id, username FROM users WHERE username = $1`,
        [username],
      );
      return result.rows[0] ?? null;
    },

    async getMedia(userId) {
      const result = await pool.query(
        `SELECT avatar_url AS "avatarUrl", cover_url AS "coverUrl"
         FROM user_profile_media WHERE user_id = $1`,
        [userId],
      );
      return result.rows[0] ?? null;
    },

    async upsertAvatar({ userId, avatarUrl }) {
      const result = await pool.query(
        `INSERT INTO user_profile_media (user_id, avatar_url)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url, updated_at = now()
         RETURNING avatar_url AS "avatarUrl", cover_url AS "coverUrl"`,
        [userId, avatarUrl],
      );
      return result.rows[0];
    },

    async upsertCover({ userId, coverUrl }) {
      const result = await pool.query(
        `INSERT INTO user_profile_media (user_id, cover_url)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET cover_url = EXCLUDED.cover_url, updated_at = now()
         RETURNING avatar_url AS "avatarUrl", cover_url AS "coverUrl"`,
        [userId, coverUrl],
      );
      return result.rows[0];
    },

    async listFavorites(userId) {
      const result = await pool.query(
        `SELECT g.id, g.slug, g.title, g.cover_url AS "coverUrl", x.created_at AS "createdAt"
         FROM user_favorite_games x JOIN games g ON g.id = x.game_id
         WHERE x.user_id = $1 ORDER BY x.created_at DESC`,
        [userId],
      );
      return result.rows;
    },

    async listWishlist(userId) {
      const result = await pool.query(
        `SELECT g.id, g.slug, g.title, g.cover_url AS "coverUrl", x.created_at AS "createdAt"
         FROM user_wishlist_games x JOIN games g ON g.id = x.game_id
         WHERE x.user_id = $1 ORDER BY x.created_at DESC`,
        [userId],
      );
      return result.rows;
    },

    async addFavorite({ userId, gameId }) {
      await pool.query(
        `INSERT INTO user_favorite_games (user_id, game_id) VALUES ($1, $2)
         ON CONFLICT (user_id, game_id) DO NOTHING`,
        [userId, gameId],
      );
    },

    async removeFavorite({ userId, gameId }) {
      await pool.query(
        `DELETE FROM user_favorite_games WHERE user_id = $1 AND game_id = $2`,
        [userId, gameId],
      );
    },

    async addToWishlist({ userId, gameId }) {
      await pool.query(
        `INSERT INTO user_wishlist_games (user_id, game_id) VALUES ($1, $2)
         ON CONFLICT (user_id, game_id) DO NOTHING`,
        [userId, gameId],
      );
    },

    async removeFromWishlist({ userId, gameId }) {
      await pool.query(
        `DELETE FROM user_wishlist_games WHERE user_id = $1 AND game_id = $2`,
        [userId, gameId],
      );
    },

    async listAchievements(userId) {
      const result = await pool.query(
        `SELECT a.id, a.name, a.created_at AS "createdAt",
           g.id AS "gameId", g.slug AS "gameSlug", g.title AS "gameTitle", g.cover_url AS "gameCoverUrl"
         FROM user_achievements a JOIN games g ON g.id = a.game_id
         WHERE a.user_id = $1 ORDER BY a.created_at DESC`,
        [userId],
      );
      return result.rows;
    },

    async createAchievement({ userId, gameId, name }) {
      const result = await pool.query(
        `INSERT INTO user_achievements (user_id, game_id, name)
         VALUES ($1, $2, $3) RETURNING id, name, created_at AS "createdAt"`,
        [userId, gameId, name],
      );
      return result.rows[0];
    },

    async deleteAchievement({ userId, id }) {
      const result = await pool.query(
        `DELETE FROM user_achievements WHERE id = $1 AND user_id = $2 RETURNING id`,
        [id, userId],
      );
      return result.rows[0] ?? null;
    },
  };
}
