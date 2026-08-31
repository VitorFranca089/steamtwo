import { SESSION_COOKIE } from "../domain/auth/constants.js";

/** Attaches `request.user` (or null) on every request so any route can read the current session. */
export function createSessionMiddleware({ authService }) {
  return async function attachUser(request, _response, next) {
    try {
      const token = request.cookies?.[SESSION_COOKIE];
      request.user = authService && token ? await authService.sessionUser(token) : null;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuth(request, response, next) {
  if (!request.user) return response.status(401).json({ error: "Autenticação necessária" });
  return next();
}

export function requireAdmin(request, response, next) {
  if (request.user?.role !== "admin") return response.status(403).json({ error: "Acesso restrito a administradores" });
  return next();
}
