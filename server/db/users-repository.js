/** Persistence boundary for accounts, identity profiles and sessions. All methods use placeholders. */
export function createUsersRepository(pool) {
  return {
    async create({ username, email, passwordHash, role = "user" }) {
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, role, created_at AS "createdAt"`,
        [username, email, passwordHash, role],
      );
      return result.rows[0];
    },

    async findByIdentifier(identifier) {
      const result = await pool.query(
        `SELECT u.id, u.username, u.email, u.password_hash AS "passwordHash", u.role,
           p.verified_at AS "verifiedAt"
         FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE u.username = $1 OR u.email = $1`,
        [identifier],
      );
      return result.rows[0] ?? null;
    },

    async findById(id) {
      const result = await pool.query(
        `SELECT u.id, u.username, u.email, u.role, u.created_at AS "createdAt",
           p.full_name AS "fullName", p.birth_date AS "birthDate", p.cpf, p.verified_at AS "verifiedAt"
         FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE u.id = $1`,
        [id],
      );
      return result.rows[0] ?? null;
    },

    async upsertProfile({ userId, fullName, birthDate, cpf }) {
      const result = await pool.query(
        `INSERT INTO user_profiles (user_id, full_name, birth_date, cpf)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           full_name = EXCLUDED.full_name, birth_date = EXCLUDED.birth_date,
           cpf = EXCLUDED.cpf, verified_at = now(), updated_at = now()
         RETURNING user_id AS "userId", full_name AS "fullName", birth_date AS "birthDate",
           cpf, verified_at AS "verifiedAt"`,
        [userId, fullName, birthDate, cpf],
      );
      return result.rows[0];
    },

    sessions: {
      async create({ userId, tokenHash, expiresAt }) {
        const result = await pool.query(
          `INSERT INTO user_sessions (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3) RETURNING id, user_id AS "userId", expires_at AS "expiresAt"`,
          [userId, tokenHash, expiresAt],
        );
        return result.rows[0];
      },

      async findValidByTokenHash(tokenHash) {
        const result = await pool.query(
          `SELECT u.id, u.username, u.email, u.role, p.verified_at AS "verifiedAt"
           FROM user_sessions s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN user_profiles p ON p.user_id = u.id
           WHERE s.token_hash = $1 AND s.expires_at > now()`,
          [tokenHash],
        );
        return result.rows[0] ?? null;
      },

      async delete(tokenHash) {
        await pool.query("DELETE FROM user_sessions WHERE token_hash = $1", [tokenHash]);
      },
    },
  };
}
