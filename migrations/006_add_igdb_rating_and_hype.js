/**
 * The Hero section on the homepage showed three "evaluation" numbers
 * (traction/quality/engagement) that were hardcoded literals (96/93/95),
 * never computed from real data for any game. This adds the two IGDB fields
 * needed to make "quality" and "engagement" honest: `total_rating` (combined
 * critic+user review score, 0-100) and `hypes` (count of users marking the
 * game as anticipated) — the same two-step sync (server/jobs/catalog.js)
 * already fetches everything else about a game, this just widens the fields
 * it asks IGDB for.
 */
export async function up(pgm) {
  pgm.addColumn("games", {
    igdb_rating: { type: "numeric(5,2)" },
    igdb_hype: { type: "integer" },
  });
}

export async function down(pgm) {
  pgm.dropColumn("games", ["igdb_rating", "igdb_hype"]);
}
