import { z } from "zod";
import { createIndependentGameSchema } from "../domain/admin/validation.js";
import { toSlug } from "../integrations/normalizers.js";

const gameIdSchema = z.string().uuid("Jogo inválido");

function conflictError(message) {
  return Object.assign(new Error(message), { status: 409 });
}

function notFoundError(message) {
  return Object.assign(new Error(message), { status: 404 });
}

function parseGenres(raw) {
  if (!raw) return [];
  const seen = new Set();
  const genres = [];
  for (const part of raw.split(",")) {
    const name = part.trim();
    if (!name) continue;
    const slug = toSlug(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    genres.push({ slug, name });
  }
  return genres;
}

export function createAdminCatalogService({ repository, publicUploadsPath = "/uploads" } = {}) {
  return {
    async listGames() {
      return repository.games.listByOrigin("admin");
    },

    async createGame(input, { submittedBy, coverFile, heroFile } = {}) {
      const { title, summary, releaseDate, genres } = createIndependentGameSchema.parse(input);
      const slug = toSlug(title);
      if (!slug) throw conflictError("Não foi possível gerar um identificador para esse nome");
      const coverUrl = coverFile ? `${publicUploadsPath}/games/${coverFile.filename}` : null;
      const heroUrl = heroFile ? `${publicUploadsPath}/games/${heroFile.filename}` : coverUrl;
      try {
        return await repository.games.createIndependent({
          slug,
          title,
          summary: summary || null,
          coverUrl,
          heroUrl,
          releasedAt: releaseDate || null,
          genres: parseGenres(genres),
          submittedBy,
        });
      } catch (error) {
        if (error.code === "23505") throw conflictError("Já existe um jogo com esse nome");
        throw error;
      }
    },

    async deleteGame(id) {
      const parsedId = gameIdSchema.parse(id);
      const deleted = await repository.games.deleteById(parsedId, { origin: "admin" });
      if (!deleted) throw notFoundError("Jogo independente não encontrado");
      return deleted;
    },
  };
}
