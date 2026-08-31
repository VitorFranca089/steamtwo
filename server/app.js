import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";

export function createApp({ apiRouter, staticDir, uploadsDir } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  if (apiRouter) app.use("/api", apiRouter);
  if (uploadsDir) app.use("/uploads", express.static(uploadsDir));

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/(?:api|uploads)(?:\/|$)).*/, (_request, response) => {
      response.sendFile(path.resolve(staticDir, "index.html"));
    });
  }

  app.use((error, _request, response, _next) => {
    const isValidationError = error?.name === "ZodError";
    const isMulterError = error?.name === "MulterError";
    const status = Number(error.status ?? (isValidationError ? 400 : isMulterError ? 400 : 500));
    response.status(status).json({
      error: status >= 500
        ? "Erro interno do servidor"
        : isMulterError
          ? "Arquivo inválido ou maior que o limite permitido (5MB)"
          : error.message,
      ...(isValidationError ? { details: error.issues } : {}),
    });
  });

  return app;
}
