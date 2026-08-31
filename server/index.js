import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { createPool } from "./db/pool.js";
import { createCatalogReadRepository } from "./db/catalog-read-repository.js";
import { createUsersRepository } from "./db/users-repository.js";
import { createProfileRepository } from "./db/profile-repository.js";
import { createApiRouter } from "./routes/index.js";
import { createCatalogService } from "./services/catalog-service.js";
import { createAuthService } from "./services/auth-service.js";
import { createProfileService } from "./services/profile-service.js";
import { createUploadStorage } from "./uploads/storage.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = path.join(rootDir, "dist", "client");
const uploadsRootDir = path.join(rootDir, "uploads");
let pool = null;
let catalogRepository = null;
let authService = null;
let profileService = null;
let uploadStorage = null;

if (config.databaseUrl) {
  pool = createPool(config.databaseUrl);
  catalogRepository = createCatalogReadRepository(pool);
  authService = createAuthService({ repository: createUsersRepository(pool) });
  profileService = createProfileService({ repository: createProfileRepository(pool) });
  uploadStorage = createUploadStorage({ rootDir: uploadsRootDir });
  uploadStorage.ensureDirs();
}

const catalogService = createCatalogService({ repository: catalogRepository });
const healthCheck = pool
  ? async () => {
      await pool.query("SELECT 1");
      return { status: "connected" };
    }
  : async () => ({ status: "not-configured", mode: "demo" });

const app = createApp({
  apiRouter: createApiRouter({
    catalogService,
    authService,
    profileService,
    avatarUpload: uploadStorage?.avatarUpload,
    coverUpload: uploadStorage?.coverUpload,
    avatarsDir: uploadStorage?.avatarsDir,
    coversDir: uploadStorage?.coversDir,
    healthCheck,
  }),
  staticDir: existsSync(staticDir) ? staticDir : undefined,
  uploadsDir: existsSync(uploadsRootDir) ? uploadsRootDir : undefined,
});

app.listen(config.port, () => {
  console.log(`SteamTwo API disponível na porta ${config.port}`);
});
