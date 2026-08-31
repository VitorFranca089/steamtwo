async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Não foi possível completar a operação");
    error.details = payload.details;
    throw error;
  }
  return payload;
}

export async function fetchAdminGames() {
  const payload = await parseResponse(await fetch("/api/admin/games"));
  return payload.games;
}

export async function createAdminGame({ title, summary, releaseDate, genres, coverFile, heroFile }) {
  const formData = new FormData();
  formData.append("title", title);
  if (summary) formData.append("summary", summary);
  if (releaseDate) formData.append("releaseDate", releaseDate);
  if (genres) formData.append("genres", genres);
  if (coverFile) formData.append("cover", coverFile);
  if (heroFile) formData.append("hero", heroFile);
  const payload = await parseResponse(await fetch("/api/admin/games", { method: "POST", body: formData }));
  return payload.game;
}

export async function deleteAdminGame(id) {
  await parseResponse(await fetch(`/api/admin/games/${encodeURIComponent(id)}`, { method: "DELETE" }));
}
