export type UserRole = "admin" | "employee";

export type SessionInfo = {
  authenticated: boolean;
  role: UserRole | null;
};

export async function getSession(): Promise<SessionInfo> {
  const res = await fetch("/api/auth/session", { cache: "no-store" });
  if (!res.ok) {
    return { authenticated: false, role: null };
  }
  return (await res.json()) as SessionInfo;
}
