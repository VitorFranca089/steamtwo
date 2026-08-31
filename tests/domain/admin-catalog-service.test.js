import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAdminCatalogService } from "../../server/services/admin-catalog-service.js";

function fakeRepository() {
  const games = [];
  return {
    games: {
      async createIndependent({ slug, title, summary, coverUrl, heroUrl, releasedAt, genres, submittedBy }) {
        if (games.some((game) => game.slug === slug)) {
          throw Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
        }
        const game = { id: randomUUID(), slug, title, summary, coverUrl, heroUrl, releasedAt, genres, origin: "admin", submittedBy };
        games.push(game);
        return { id: game.id, slug: game.slug, title: game.title };
      },
      async listByOrigin(origin) {
        return games.filter((game) => game.origin === origin);
      },
      async deleteById(id, { origin } = {}) {
        const index = games.findIndex((game) => game.id === id && (!origin || game.origin === origin));
        if (index < 0) return null;
        const [removed] = games.splice(index, 1);
        return { id: removed.id };
      },
    },
    _games: games,
  };
}

describe("admin catalog service", () => {
  it("cria um jogo independente, gera o slug e classifica genêros repetidos como um só", async () => {
    const repository = fakeRepository();
    const service = createAdminCatalogService({ repository });
    const game = await service.createGame(
      { title: "Meu Jogo Indie!", summary: "Uma aventura autoral.", releaseDate: "2026-01-10", genres: "RPG, Indie, rpg" },
      { submittedBy: "user-1" },
    );
    expect(game).toMatchObject({ slug: "meu-jogo-indie", title: "Meu Jogo Indie!" });
    expect(repository._games[0]).toMatchObject({
      origin: "admin",
      submittedBy: "user-1",
      genres: [{ slug: "rpg", name: "RPG" }, { slug: "indie", name: "Indie" }],
    });
  });

  it("usa a capa enviada como hero quando nenhuma imagem de hero é enviada", async () => {
    const repository = fakeRepository();
    const service = createAdminCatalogService({ repository, publicUploadsPath: "/uploads" });
    await service.createGame(
      { title: "Jogo Sem Hero", genres: "" },
      { submittedBy: "user-1", coverFile: { filename: "cover.png" } },
    );
    expect(repository._games[0]).toMatchObject({ coverUrl: "/uploads/games/cover.png", heroUrl: "/uploads/games/cover.png" });
  });

  it("rejeita título vazio", async () => {
    const service = createAdminCatalogService({ repository: fakeRepository() });
    await expect(service.createGame({ title: "" }, { submittedBy: "user-1" })).rejects.toThrow();
  });

  it("rejeita título duplicado com 409", async () => {
    const repository = fakeRepository();
    const service = createAdminCatalogService({ repository });
    await service.createGame({ title: "Jogo Único" }, { submittedBy: "user-1" });
    await expect(service.createGame({ title: "Jogo Único" }, { submittedBy: "user-1" })).rejects.toMatchObject({ status: 409 });
  });

  it("lista só os jogos de origem admin", async () => {
    const repository = fakeRepository();
    const service = createAdminCatalogService({ repository });
    await service.createGame({ title: "Jogo A" }, { submittedBy: "user-1" });
    await service.createGame({ title: "Jogo B" }, { submittedBy: "user-1" });
    const list = await service.listGames();
    expect(list).toHaveLength(2);
  });

  it("apaga um jogo independente e rejeita id inexistente com 404", async () => {
    const repository = fakeRepository();
    const service = createAdminCatalogService({ repository });
    const created = await service.createGame({ title: "Jogo Para Apagar" }, { submittedBy: "user-1" });
    await service.deleteGame(created.id);
    expect(repository._games).toHaveLength(0);
    await expect(service.deleteGame(created.id)).rejects.toMatchObject({ status: 404 });
  });
});
