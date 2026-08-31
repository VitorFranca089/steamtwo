import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { removeStaleFiles } from "../uploads/storage.js";

export function createProfileRouter({ profileService, avatarUpload, coverUpload, avatarsDir, coversDir }) {
  const router = Router();

  router.get("/", async (request, response, next) => {
    try {
      const users = await profileService.searchUsers(request.query.q, { excludeUsername: request.user?.username });
      response.json({ users });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAuth, async (request, response, next) => {
    try {
      response.json(await profileService.getMyProfile(request.user));
    } catch (error) {
      next(error);
    }
  });

  router.post("/avatar", requireAuth, avatarUpload.single("avatar"), async (request, response, next) => {
    try {
      removeStaleFiles(avatarsDir, request.user.id, request.file.filename);
      const media = await profileService.saveAvatar(request.user.id, request.file);
      response.json(media);
    } catch (error) {
      next(error);
    }
  });

  router.post("/cover", requireAuth, coverUpload.single("cover"), async (request, response, next) => {
    try {
      removeStaleFiles(coversDir, request.user.id, request.file.filename);
      const media = await profileService.saveCover(request.user.id, request.file);
      response.json(media);
    } catch (error) {
      next(error);
    }
  });

  router.post("/favorites", requireAuth, async (request, response, next) => {
    try {
      await profileService.addFavorite(request.user.id, request.body);
      response.status(201).end();
    } catch (error) {
      next(error);
    }
  });

  router.delete("/favorites/:gameId", requireAuth, async (request, response, next) => {
    try {
      await profileService.removeFavorite(request.user.id, request.params.gameId);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/wishlist", requireAuth, async (request, response, next) => {
    try {
      await profileService.addToWishlist(request.user.id, request.body);
      response.status(201).end();
    } catch (error) {
      next(error);
    }
  });

  router.delete("/wishlist/:gameId", requireAuth, async (request, response, next) => {
    try {
      await profileService.removeFromWishlist(request.user.id, request.params.gameId);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/achievements", requireAuth, async (request, response, next) => {
    try {
      const achievement = await profileService.createAchievement(request.user.id, request.body);
      response.status(201).json({ achievement });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/achievements/:id", requireAuth, async (request, response, next) => {
    try {
      await profileService.deleteAchievement(request.user.id, request.params.id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/:username", async (request, response, next) => {
    try {
      response.json(await profileService.getPublicProfile(request.params.username));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
