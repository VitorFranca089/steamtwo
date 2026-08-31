import fs from "node:fs";
import path from "node:path";
import multer from "multer";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_MIME_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function unsupportedMimeError() {
  return Object.assign(new Error("Tipo de arquivo não suportado. Envie JPEG, PNG ou WEBP."), { status: 400 });
}

function createUploader(dir) {
  const storage = multer.diskStorage({
    destination(_request, _file, callback) {
      callback(null, dir);
    },
    filename(request, file, callback) {
      const ext = ALLOWED_MIME_EXT[file.mimetype];
      callback(null, `${request.user.id}.${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter(_request, file, callback) {
      if (!ALLOWED_MIME_EXT[file.mimetype]) return callback(unsupportedMimeError());
      callback(null, true);
    },
  });
}

export function createUploadStorage({ rootDir }) {
  const avatarsDir = path.join(rootDir, "avatars");
  const coversDir = path.join(rootDir, "covers");

  return {
    avatarsDir,
    coversDir,
    avatarUpload: createUploader(avatarsDir),
    coverUpload: createUploader(coversDir),
    ensureDirs() {
      fs.mkdirSync(avatarsDir, { recursive: true });
      fs.mkdirSync(coversDir, { recursive: true });
    },
  };
}

export function removeStaleFiles(dir, userId, keepFilename) {
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith(`${userId}.`) && entry !== keepFilename) {
      fs.unlinkSync(path.join(dir, entry));
    }
  }
}
