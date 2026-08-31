import { Router } from "express";
import { z } from "zod";
import { createCatalogService } from "../services/catalog-service.js";
import { createAuthRouter } from "./auth.js";
import { createProfileRouter } from "./profile.js";
import { createAdminRouter } from "./admin.js";
import { createSessionMiddleware } from "../middleware/auth.js";

const storeSchema = z.enum(["all", "steam", "epic"]).default("all");
const periodSchema = z.enum(["now", "week", "all-time"]).default("now");
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

// A pontuação vem inteiramente da popularidade do IGDB (ver docs/claude/feat-3):
// Steam/Epic deixaram de alimentar o ranking, mas continuam sendo a origem dos
// links de "Abrir na loja" quando o IGDB identifica o jogo nessas lojas.
const methodology = {
  name: "Índice SteamTwo",
  formula: "Popularidade normalizada do IGDB (escala 0-100+)",
  rules: [
    "A pontuação vem do sinal de popularidade do IGDB — a mesma fonte do catálogo, capas e gêneros.",
    "Links de loja (Steam/Epic) continuam aparecendo quando o IGDB identifica o jogo nessas lojas, mas não influenciam mais a pontuação.",
    "Jogos recém-sincronizados sem popularidade registrada no IGDB começam com pontuação zero até a próxima sincronização.",
    "De sempre é popularidade histórica do IGDB, não uma contagem de horas jogadas.",
  ],
  sources: ["IGDB"],
};

export function createApiRouter({
  catalogService = createCatalogService(),
  authService,
  profileService,
  adminCatalogService,
  avatarUpload,
  coverUpload,
  gameImageUpload,
  avatarsDir,
  coversDir,
  healthCheck,
} = {}) {
  const router = Router();

  router.use(createSessionMiddleware({ authService }));
  if (authService) router.use("/auth", createAuthRouter({ authService }));
  if (profileService) {
    router.use("/profile", createProfileRouter({ profileService, avatarUpload, coverUpload, avatarsDir, coversDir }));
  }
  if (adminCatalogService) {
    router.use("/admin", createAdminRouter({ adminCatalogService, gameImageUpload }));
  }

  router.get("/health", async (_request, response, next) => {
    try {
      const database = healthCheck ? await healthCheck() : { status: "not-configured" };
      response.json({ status: "ok", database, timestamp: new Date().toISOString() });
    } catch (error) {
      next(Object.assign(error, { status: 503 }));
    }
  });

  router.get("/dashboard", async (request, response, next) => {
    try {
      const { store } = z.object({ store: storeSchema }).parse(request.query);
      response.json(await catalogService.dashboard({ store }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/rankings", async (request, response, next) => {
    try {
      const query = z.object({
        period: periodSchema,
        store: storeSchema,
        page: pageSchema,
        limit: limitSchema,
      }).parse(request.query);
      response.json(await catalogService.rankings(query));
    } catch (error) {
      next(error);
    }
  });

  router.get("/games", async (request, response, next) => {
    try {
      const query = z.object({
        q: z.string().max(100).default(""),
        genre: z.string().max(60).optional(),
        store: storeSchema,
        sort: z.enum(["popularity", "name"]).default("popularity"),
        page: pageSchema,
        limit: limitSchema.default(12),
        independent: z.coerce.boolean().default(false),
      }).parse(request.query);
      response.json(await catalogService.games(query));
    } catch (error) {
      next(error);
    }
  });

  router.get("/games/:slug", async (request, response, next) => {
    try {
      const slug = z.string().regex(/^[a-z0-9-]+$/).parse(request.params.slug);
      const game = await catalogService.game(slug);
      if (!game) return response.status(404).json({ error: "Jogo não encontrado" });
      return response.json(game);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/methodology", (_request, response) => response.json(methodology));

  return router;
}

