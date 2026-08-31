import "dotenv/config";

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? "",
  twitchClientId: process.env.TWITCH_CLIENT_ID ?? "",
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET ?? "",
  steamCountry: process.env.STEAM_COUNTRY ?? "BR",
  epicLocale: process.env.EPIC_LOCALE ?? "pt-BR",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173",
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 2525),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.MAIL_FROM ?? "SteamTwo <no-reply@steamtwo.dev>",
  },
};

