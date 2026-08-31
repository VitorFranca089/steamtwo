import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPool } from "../server/db/pool.js";
import { config } from "../server/config.js";

const username = process.env.ADMIN_USERNAME ?? "admin";
const email = process.env.ADMIN_EMAIL ?? "admin@steamtwo.dev";
const password = process.env.ADMIN_PASSWORD ?? "Admin@12345";

async function main() {
  const pool = createPool(config.databaseUrl);
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (username) DO UPDATE SET
         email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, role = 'admin', updated_at = now()`,
      [username, email, passwordHash],
    );
    console.log(`Usuário admin pronto: username="${username}" email="${email}"`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`Senha padrão de desenvolvimento: ${password} (defina ADMIN_PASSWORD para trocar)`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Falha ao criar usuário admin:", error.message);
  process.exit(1);
});
