/**
 * Profile domain: avatar/cover media, favorite games, wishlist and
 * user-created achievements. Kept separate from user_profiles (KYC identity)
 * so that customizing a public profile never depends on verification status.
 */
export async function up(pgm) {
  pgm.createTable("user_profile_media", {
    user_id: { type: "uuid", primaryKey: true, references: '"users"', onDelete: "cascade" },
    avatar_url: { type: "text" },
    cover_url: { type: "text" },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("user_favorite_games", {
    user_id: { type: "uuid", notNull: true, references: '"users"', onDelete: "cascade" },
    game_id: { type: "uuid", notNull: true, references: '"games"', onDelete: "cascade" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: { primaryKey: ["user_id", "game_id"] },
  });

  pgm.createTable("user_wishlist_games", {
    user_id: { type: "uuid", notNull: true, references: '"users"', onDelete: "cascade" },
    game_id: { type: "uuid", notNull: true, references: '"games"', onDelete: "cascade" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, {
    constraints: { primaryKey: ["user_id", "game_id"] },
  });

  pgm.createTable("user_achievements", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: '"users"', onDelete: "cascade" },
    game_id: { type: "uuid", notNull: true, references: '"games"', onDelete: "cascade" },
    name: { type: "text", notNull: true, check: "char_length(name) BETWEEN 1 AND 120" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("user_achievements", ["user_id"]);
}

export async function down(pgm) {
  pgm.dropTable("user_achievements");
  pgm.dropTable("user_wishlist_games");
  pgm.dropTable("user_favorite_games");
  pgm.dropTable("user_profile_media");
}
