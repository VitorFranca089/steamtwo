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

  router.get("/account", requireAuth, async (request, response, next) => {
    try {
      response.json({ account: await authService.getAccount(request.user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/username", requireAuth, async (request, response, next) => {
    try {
      const account = await authService.changeUsername(request.user.id, request.body);
      response.json({ account });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/email", requireAuth, async (request, response, next) => {
    try {
      const account = await authService.changeEmail(request.user.id, request.body);
      response.json({ account });
    } catch (error) {
      next(error);
    }
  });

  router.post("/password/change", requireAuth, async (request, response, next) => {
    try {
      await authService.changePassword(request.user.id, request.body);
      response.clearCookie(SESSION_COOKIE, { path: "/" });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/password/forgot", async (request, response, next) => {
    try {
      await authService.requestPasswordReset(request.body);
      response.json({ message: "Se existir uma conta com esses dados, enviamos um e-mail com instruções." });
    } catch (error) {
      next(error);
    }
  });

  router.post("/password/reset", async (request, response, next) => {
    try {
      await authService.resetPassword(request.body);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/email/verify/request", requireAuth, async (request, response, next) => {
    try {
      await authService.requestEmailVerification(request.user.id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/email/verify/confirm", async (request, response, next) => {
    try {
      await authService.confirmEmailVerification(request.body);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
