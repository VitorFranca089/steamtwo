import { Router } from "express";
import { SESSION_COOKIE } from "../domain/auth/constants.js";
import { requireAuth } from "../middleware/auth.js";

function sessionCookieOptions(expires) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expires ? { expires } : {}),
  };
}

export function createAuthRouter({ authService }) {
  const router = Router();

  router.post("/signup", async (request, response, next) => {
    try {
      const user = await authService.signup(request.body);
      response.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (request, response, next) => {
    try {
      const { token, expiresAt, user } = await authService.login(request.body);
      response.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", async (request, response, next) => {
    try {
      await authService.logout(request.cookies?.[SESSION_COOKIE]);
      response.clearCookie(SESSION_COOKIE, { path: "/" });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", (request, response) => {
    response.json({ user: request.user ?? null });
  });

  router.post("/profile", requireAuth, async (request, response, next) => {
    try {
      const profile = await authService.completeProfile(request.user.id, request.body);
      response.json({ profile });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
