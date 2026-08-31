/**
 * Auth domain: accounts, optional identity profile (for age/CPF verification)
 * and server-side sessions. citext gives case-insensitive uniqueness for
 * username/email without extra normalization logic in the app layer.
 */
export async function up(pgm) {
  pgm.createExtension("citext", { ifNotExists: true });
  pgm.createType("user_role", ["user", "admin"]);

  pgm.createTable("users", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    username: { type: "citext", notNull: true, unique: true },
    email: { type: "citext", notNull: true, unique: true },
    password_hash: { type: "text", notNull: true },
    role: { type: "user_role", notNull: true, default: "user" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("user_profiles", {
    user_id: { type: "uuid", primaryKey: true, references: '"users"', onDelete: "cascade" },
    full_name: { type: "text", notNull: true },
    birth_date: { type: "date", notNull: true },
    cpf: { type: "text", notNull: true, unique: true },
    verified_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("user_sessions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: '"users"', onDelete: "cascade" },
    token_hash: { type: "text", notNull: true, unique: true },
    expires_at: { type: "timestamptz", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("user_sessions", ["user_id"]);
  pgm.createIndex("user_sessions", ["expires_at"]);
}

export async function down(pgm) {
  pgm.dropTable("user_sessions");
  pgm.dropTable("user_profiles");
  pgm.dropTable("users");
  pgm.dropType("user_role");
  pgm.dropExtension("citext", { ifExists: true });
}
