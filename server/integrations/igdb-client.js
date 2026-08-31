import { requestJson } from "./http.js";
import { normalizeIgdbGame } from "./normalizers.js";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const API_URL = "https://api.igdb.com/v4";
// IGDB removeu o campo `popularity` de /games; o sinal de popularidade agora
// vive em /popularity_primitives. O tipo 2 ("Want to Play") é o que tem maior
// cobertura no catálogo (ver docs/claude/feat-3), então é o padrão aqui.
const DEFAULT_POPULARITY_TYPE = 2;
// `value` em /popularity_primitives é uma fração normalizada (soma ~1 entre
// todo o catálogo, então os líderes ficam na casa de 0.001-0.002) — sem
// reescalar, tudo arredondaria para 0.0 na UI. O fator foi calibrado para que
// o topo do catálogo real fique perto de 100, mesma ordem de grandeza do
// antigo campo `popularity` (0-100) que este código substituiu.
const POPULARITY_SCALE = 50_000;
const CATALOG_FIELDS = "id,name,slug,summary,storyline,first_release_date,cover.image_id,screenshots.image_id,genres.id,genres.name,external_games.category,external_games.uid,total_rating,hypes";

export function createIgdbClient({ clientId, clientSecret, fetchImpl, now = () => Date.now() } = {}) {
  let token = null;
  let tokenExpiresAt = 0;

  async function accessToken() {
    if (token && now() < tokenExpiresAt - 60_000) return token;
    if (!clientId || !clientSecret) throw new Error("TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET são obrigatórios para IGDB");
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" });
    const response = await requestJson(TOKEN_URL, {
      service: "twitch",
      fetchImpl,
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      retries: 1,
    });
    token = response.access_token;
    tokenExpiresAt = now() + Number(response.expires_in ?? 0) * 1000;
    if (!token) throw new Error("Twitch não retornou access_token");
    return token;
  }

  async function query(endpoint, query) {
    const bearerToken = await accessToken();
    return requestJson(`${API_URL}/${endpoint}`, {
      service: "igdb",
      fetchImpl,
      method: "POST",
      headers: { "Client-ID": clientId, Authorization: `Bearer ${bearerToken}`, Accept: "application/json" },
      body: query,
    });
  }

  async function popularGames({ limit, offset, popularityType = DEFAULT_POPULARITY_TYPE, updatedAfter } = {}) {
    const primitives = await query("popularity_primitives", `fields game_id,value; where popularity_type = ${popularityType}; sort value desc; limit ${limit}; offset ${offset};`);
    if (!primitives.length) return [];
    const popularityByGameId = new Map(primitives.map((item) => [item.game_id, item.value]));
    const ids = primitives.map((item) => item.game_id).join(",");
    const filter = updatedAfter ? ` & updated_at > ${Math.floor(new Date(updatedAfter).getTime() / 1000)}` : "";
    // Sem `limit` explícito o IGDB aplica o padrão de 10 resultados, mesmo
    // com mais ids no `where id = (...)` — por isso sempre voltavam só 10
    // jogos, não importava quantos primitives fossem pedidos.
    const games = await query("games", `fields ${CATALOG_FIELDS}; where id = (${ids}) & version_parent = null${filter}; limit ${primitives.length};`);
    return games
      .map((game) => ({ ...game, popularity: (popularityByGameId.get(game.id) ?? 0) * POPULARITY_SCALE }))
      .sort((a, b) => b.popularity - a.popularity);
  }

  return {
    query,
    async listCatalog({ limit = 100, offset = 0, updatedAfter } = {}) {
      const games = await popularGames({ limit, offset, updatedAfter });
      return games.map(normalizeIgdbGame);
    },
    async listHistoricalPopularity({ limit = 100, offset = 0 } = {}) {
      const games = await popularGames({ limit, offset });
      return games.map(normalizeIgdbGame);
    },
  };
}
