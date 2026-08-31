const jsonHeaders = { "Content-Type": "application/json" };

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Não foi possível completar a operação");
    error.details = payload.details;
    throw error;
  }
  return payload;
}

export async function fetchMyProfile() {
  return parseResponse(await fetch("/api/profile/me"));
}

export async function fetchProfileByUsername(username) {
  return parseResponse(await fetch(`/api/profile/${encodeURIComponent(username)}`));
}

export async function searchUsers(query) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const payload = await parseResponse(await fetch(`/api/profile?${params.toString()}`));
  return payload.users;
}

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);
  return parseResponse(await fetch("/api/profile/avatar", { method: "POST", body: formData }));
}

export async function uploadCover(file) {
  const formData = new FormData();
  formData.append("cover", file);
  return parseResponse(await fetch("/api/profile/cover", { method: "POST", body: formData }));
}

export async function addFavorite(gameId) {
  await parseResponse(
    await fetch("/api/profile/favorites", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ gameId }) }),
  );
}

export async function removeFavorite(gameId) {
  await parseResponse(await fetch(`/api/profile/favorites/${encodeURIComponent(gameId)}`, { method: "DELETE" }));
}

export async function addToWishlist(gameId) {
  await parseResponse(
    await fetch("/api/profile/wishlist", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ gameId }) }),
  );
}

export async function removeFromWishlist(gameId) {
  await parseResponse(await fetch(`/api/profile/wishlist/${encodeURIComponent(gameId)}`, { method: "DELETE" }));
}

export async function createAchievement({ gameId, name }) {
  const payload = await parseResponse(
    await fetch("/api/profile/achievements", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ gameId, name }) }),
  );
  return payload.achievement;
}

export async function deleteAchievement(id) {
  await parseResponse(await fetch(`/api/profile/achievements/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export async function searchGames(query) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("limit", "8");
  const payload = await parseResponse(await fetch(`/api/games?${params.toString()}`));
  return Array.isArray(payload) ? payload : (payload.games || payload.items || payload.data || []);
}
