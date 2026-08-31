/**
 * Adds e-mail verification (separate from the KYC "verified_at" in user_profiles)
 * and password-reset support. Both use short-lived, single-use, hashed tokens —
 * same pattern as user_sessions (SHA-256 hash stored, raw token only ever sent by e-mail).
 */
export async function up(pgm) {
  pgm.addColumn("users", {
    email_verified_at: { type: "timestamptz" },
  });

  pgm.createTable("email_verification_tokens", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: '"users"', onDelete: "cascade" },
    email: { type: "citext", notNull: true },
    token_hash: { type: "text", notNull: true, unique: true },
    expires_at: { type: "timestamptz", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("email_verification_tokens", ["user_id"]);

  pgm.createTable("password_reset_tokens", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: '"users"', onDelete: "cascade" },
    token_hash: { type: "text", notNull: true, unique: true },
    expires_at: { type: "timestamptz", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("password_reset_tokens", ["user_id"]);
}

export async function down(pgm) {
  pgm.dropTable("password_reset_tokens");
  pgm.dropTable("email_verification_tokens");
  pgm.dropColumn("users", "email_verified_at");
}
