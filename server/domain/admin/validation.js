import { z } from "zod";

// Multipart form fields always arrive as strings, so dates/lists are parsed
// and validated as text here; the service turns them into the shapes the
// repository expects (a Date, an array of {slug, name} genres).
export const createIndependentGameSchema = z.object({
  title: z.string().trim().min(2, "Informe o nome do jogo").max(120, "O nome deve ter no máximo 120 caracteres"),
  summary: z.string().trim().max(2000, "O resumo deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
  releaseDate: z.string().trim().refine((value) => !value || !Number.isNaN(Date.parse(value)), "Data de lançamento inválida").optional().or(z.literal("")),
  genres: z.string().trim().max(300, "A lista de gêneros é muito longa").optional().or(z.literal("")),
});
