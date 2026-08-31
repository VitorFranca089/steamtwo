import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

export function createAdminRouter({ adminCatalogService, gameImageUpload }) {
  const router = Router();
  router.use(requireAuth, requireAdmin);

  router.get("/games", async (_request, response, next) => {
    try {
      response.json({ games: await adminCatalogService.listGames() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/games", gameImageUpload.fields([{ name: "cover", maxCount: 1 }, { name: "hero", maxCount: 1 }]), async (request, response, next) => {
    try {
      const game = await adminCatalogService.createGame(request.body, {
        submittedBy: request.user.id,
        coverFile: request.files?.cover?.[0],
        heroFile: request.files?.hero?.[0],
      });
      response.status(201).json({ game });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/games/:id", async (request, response, next) => {
    try {
      await adminCatalogService.deleteGame(request.params.id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
