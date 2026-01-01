const TOKEN_COOKIE_NAME = "pf_token";

export function getTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${TOKEN_COOKIE_NAME}=`));

  if (!raw) return null;
  const value = raw.slice(`${TOKEN_COOKIE_NAME}=`.length);
  return value ? decodeURIComponent(value) : null;
}

export function setToken(token: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
  try {
    localStorage.setItem(TOKEN_COOKIE_NAME, token);
  } catch {}
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const cookieToken = getTokenFromCookie();
  if (cookieToken) return cookieToken;

  try {
    return localStorage.getItem(TOKEN_COOKIE_NAME);
  } catch {
    return null;
  }
}

export function clearToken(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  try {
    localStorage.removeItem(TOKEN_COOKIE_NAME);
  } catch {}
}
