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

export async function fetchCurrentUser() {
  const payload = await parseResponse(await fetch("/api/auth/me"));
  return payload.user;
}

export async function signup({ username, email, password }) {
  const payload = await parseResponse(
    await fetch("/api/auth/signup", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ username, email, password }) }),
  );
  return payload.user;
}

export async function login({ identifier, password }) {
  const payload = await parseResponse(
    await fetch("/api/auth/login", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ identifier, password }) }),
  );
  return payload.user;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function completeProfile({ fullName, birthDate, cpf }) {
  const payload = await parseResponse(
    await fetch("/api/auth/profile", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ fullName, birthDate, cpf }) }),
  );
  return payload.profile;
}

export function passwordChecklist(password = "") {
  return [
    { label: "Pelo menos 8 caracteres", met: password.length >= 8 },
    { label: "Uma letra minúscula", met: /[a-z]/.test(password) },
    { label: "Uma letra maiúscula", met: /[A-Z]/.test(password) },
    { label: "Um número", met: /[0-9]/.test(password) },
    { label: "Um caractere especial", met: /[^A-Za-z0-9]/.test(password) },
  ];
}
