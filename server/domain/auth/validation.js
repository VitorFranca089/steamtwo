import { z } from "zod";
import { isValidCpf, normalizeCpf } from "./cpf.js";
import { calculateAge } from "./age.js";
import { MINIMUM_AGE_YEARS } from "./constants.js";

const RESERVED_USERNAMES = new Set([
  "me",
  "avatar",
  "avatars",
  "cover",
  "covers",
  "favorites",
  "wishlist",
  "achievements",
]);

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "O nome de usuário deve ter pelo menos 3 caracteres")
  .max(24, "O nome de usuário deve ter no máximo 24 caracteres")
  .regex(/^[a-zA-Z0-9_.]+$/, "Use apenas letras, números, ponto ou sublinhado")
  .refine((value) => !RESERVED_USERNAMES.has(value.toLowerCase()), "Este nome de usuário não está disponível");

export const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido").max(160);

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .regex(/[a-z]/, "A senha deve conter ao menos uma letra minúscula")
  .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula")
  .regex(/[0-9]/, "A senha deve conter ao menos um número")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter ao menos um caractere especial");

export const signupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Informe seu usuário ou e-mail"),
  password: z.string().min(1, "Informe sua senha"),
});

export const profileSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe o nome completo").max(160),
    birthDate: z.coerce.date({ message: "Data de nascimento inválida" }),
    cpf: z
      .string()
      .transform(normalizeCpf)
      .refine((value) => isValidCpf(value), "CPF inválido"),
  })
  .refine((data) => calculateAge(data.birthDate) >= MINIMUM_AGE_YEARS, {
    message: `É necessário ter ${MINIMUM_AGE_YEARS} anos ou mais para se regularizar na plataforma`,
    path: ["birthDate"],
  });

export const usernameChangeSchema = z.object({ username: usernameSchema });

export const emailChangeSchema = z.object({
  email: emailSchema,
  currentPassword: z.string().min(1, "Informe sua senha atual"),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Informe sua senha atual"),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, "Informe seu usuário ou e-mail"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token inválido"),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token inválido"),
});
