/**
 * Lets an admin submit games directly to the catalog instead of only via the
 * IGDB sync job. `origin` distinguishes the two so the sync job never
 * overwrites an admin-submitted row on a slug collision, and the catalog can
 * label/filter these as independent titles.
 */
export async function up(pgm) {
  pgm.createType("game_origin", ["igdb", "admin"]);
  pgm.addColumn("games", {
    origin: { type: "game_origin", notNull: true, default: "igdb" },
    submitted_by: { type: "uuid", references: '"users"', onDelete: "set null" },
  });
  pgm.createIndex("games", ["origin"]);
}

export async function down(pgm) {
  pgm.dropIndex("games", ["origin"]);
  pgm.dropColumn("games", ["origin", "submitted_by"]);
  pgm.dropType("game_origin");
}
