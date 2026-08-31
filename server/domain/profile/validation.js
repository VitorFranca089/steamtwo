import { z } from "zod";

export const gameIdSchema = z.string().uuid("Jogo inválido");

export const favoriteSchema = z.object({ gameId: gameIdSchema });

export const achievementNameSchema = z
  .string()
  .trim()
  .min(1, "Informe um nome para a conquista")
  .max(120, "O nome deve ter no máximo 120 caracteres");

export const createAchievementSchema = z.object({
  gameId: gameIdSchema,
  name: achievementNameSchema,
});
