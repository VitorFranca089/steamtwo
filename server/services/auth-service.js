import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { signupSchema, loginSchema, profileSchema } from "../domain/auth/validation.js";
import { SESSION_TTL_MS } from "../domain/auth/constants.js";

const PASSWORD_SALT_ROUNDS = 12;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function toSafeUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    isVerified: Boolean(row.verifiedAt),
  };
}

function conflictError(message) {
  return Object.assign(new Error(message), { status: 409 });
}

function invalidCredentialsError() {
  return Object.assign(new Error("Usuário ou senha inválidos"), { status: 401 });
}

export function createAuthService({ repository }) {
  return {
    async signup(input) {
      const { username, email, password } = signupSchema.parse(input);
      const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
      try {
        const user = await repository.create({ username, email, passwordHash });
        return toSafeUser(user);
      } catch (error) {
        if (error.code === "23505") {
          if (error.constraint?.includes("username")) throw conflictError("Nome de usuário já está em uso");
          if (error.constraint?.includes("email")) throw conflictError("E-mail já cadastrado");
        }
        throw error;
      }
    },

    async login(input) {
      const { identifier, password } = loginSchema.parse(input);
      const user = await repository.findByIdentifier(identifier);
      const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
      if (!passwordMatches) throw invalidCredentialsError();

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await repository.sessions.create({ userId: user.id, tokenHash: hashToken(token), expiresAt });

      return { token, expiresAt, user: toSafeUser(user) };
    },

    async logout(token) {
      if (!token) return;
      await repository.sessions.delete(hashToken(token));
    },

    async sessionUser(token) {
      if (!token) return null;
      const session = await repository.sessions.findValidByTokenHash(hashToken(token));
      return session ? toSafeUser(session) : null;
    },

    async completeProfile(userId, input) {
      const { fullName, birthDate, cpf } = profileSchema.parse(input);
      try {
        return await repository.upsertProfile({ userId, fullName, birthDate, cpf });
      } catch (error) {
        if (error.code === "23505" && error.constraint?.includes("cpf")) {
          throw conflictError("Este CPF já está associado a outra conta");
        }
        throw error;
      }
    },
  };
}
