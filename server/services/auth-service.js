import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import {
  signupSchema,
  loginSchema,
  profileSchema,
  usernameChangeSchema,
  emailChangeSchema,
  passwordChangeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../domain/auth/validation.js";
import { generateToken, hashToken } from "../domain/auth/tokens.js";
import { EMAIL_VERIFICATION_TTL_MS, PASSWORD_RESET_TTL_MS, SESSION_TTL_MS } from "../domain/auth/constants.js";
import { passwordResetEmail, verificationEmail } from "../integrations/mailer.js";

const PASSWORD_SALT_ROUNDS = 12;

function toSafeUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    isVerified: Boolean(row.verifiedAt),
    emailVerified: Boolean(row.emailVerifiedAt),
  };
}

function conflictError(message) {
  return Object.assign(new Error(message), { status: 409 });
}

function invalidCredentialsError() {
  return Object.assign(new Error("Usuário ou senha inválidos"), { status: 401 });
}

function invalidTokenError(message = "Link inválido ou expirado") {
  return Object.assign(new Error(message), { status: 400 });
}

export function createAuthService({ repository, mailer, appBaseUrl = "" }) {
  async function sendVerificationEmail({ userId, username, email }) {
    if (!mailer) return;
    await repository.emailVerification.deleteByUserId(userId);
    const { token, tokenHash } = generateToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    await repository.emailVerification.create({ userId, email, tokenHash, expiresAt });
    const link = `${appBaseUrl}/verificar-email?token=${token}`;
    try {
      await mailer.sendMail({ to: email, ...verificationEmail({ username, link }) });
    } catch (error) {
      console.error("Falha ao enviar e-mail de verificação:", error.message);
    }
  }

  return {
    async signup(input) {
      const { username, email, password } = signupSchema.parse(input);
      const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
      try {
        const user = await repository.create({ username, email, passwordHash });
        await sendVerificationEmail({ userId: user.id, username: user.username, email: user.email });
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

    async getAccount(userId) {
      const user = await repository.findById(userId);
      if (!user) throw Object.assign(new Error("Conta não encontrada"), { status: 404 });
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: Boolean(user.emailVerifiedAt),
        isVerified: Boolean(user.verifiedAt),
        fullName: user.fullName ?? null,
        birthDate: user.birthDate ?? null,
        cpf: user.cpf ?? null,
      };
    },

    async changeUsername(userId, input) {
      const { username } = usernameChangeSchema.parse(input);
      try {
        return await repository.updateUsername({ userId, username });
      } catch (error) {
        if (error.code === "23505" && error.constraint?.includes("username")) {
          throw conflictError("Nome de usuário já está em uso");
        }
        throw error;
      }
    },

    async changeEmail(userId, input) {
      const { email, currentPassword } = emailChangeSchema.parse(input);
      const user = await repository.findById(userId);
      const passwordMatches = user ? await bcrypt.compare(currentPassword, user.passwordHash) : false;
      if (!passwordMatches) throw invalidCredentialsError();

      try {
        const updated = await repository.updateEmail({ userId, email });
        await sendVerificationEmail({ userId, username: user.username, email });
        return updated;
      } catch (error) {
        if (error.code === "23505" && error.constraint?.includes("email")) {
          throw conflictError("E-mail já cadastrado");
        }
        throw error;
      }
    },

    async changePassword(userId, input) {
      const { currentPassword, newPassword } = passwordChangeSchema.parse(input);
      const user = await repository.findById(userId);
      const passwordMatches = user ? await bcrypt.compare(currentPassword, user.passwordHash) : false;
      if (!passwordMatches) throw invalidCredentialsError();

      const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
      await repository.updatePasswordHash({ userId, passwordHash });
      await repository.sessions.deleteAllForUser(userId);
    },

    async requestEmailVerification(userId) {
      const user = await repository.findById(userId);
      if (!user) throw Object.assign(new Error("Conta não encontrada"), { status: 404 });
      await sendVerificationEmail({ userId: user.id, username: user.username, email: user.email });
    },

    async confirmEmailVerification(input) {
      const { token } = verifyEmailSchema.parse(input);
      const record = await repository.emailVerification.findValidByTokenHash(hashToken(token));
      if (!record) throw invalidTokenError();
      await repository.markEmailVerified({ userId: record.userId, email: record.email });
      await repository.emailVerification.deleteByUserId(record.userId);
    },

    async requestPasswordReset(input) {
      const { identifier } = forgotPasswordSchema.parse(input);
      const user = await repository.findByIdentifier(identifier);
      if (!user || !mailer) return;

      await repository.passwordReset.deleteByUserId(user.id);
      const { token, tokenHash } = generateToken();
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
      await repository.passwordReset.create({ userId: user.id, tokenHash, expiresAt });
      const link = `${appBaseUrl}/redefinir-senha?token=${token}`;
      try {
        await mailer.sendMail({ to: user.email, ...passwordResetEmail({ username: user.username, link }) });
      } catch (error) {
        console.error("Falha ao enviar e-mail de redefinição de senha:", error.message);
      }
    },

    async resetPassword(input) {
      const { token, password } = resetPasswordSchema.parse(input);
      const record = await repository.passwordReset.findValidByTokenHash(hashToken(token));
      if (!record) throw invalidTokenError();

      const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
      await repository.updatePasswordHash({ userId: record.userId, passwordHash });
      await repository.passwordReset.deleteByUserId(record.userId);
      await repository.sessions.deleteAllForUser(record.userId);
    },
  };
}
