import { apiRequest } from "./api";
import { setToken } from "./tokenStorage";

export type LoginPayload = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  token_type?: string;
};

export async function login(payload: LoginPayload) {
  const res = await apiRequest<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) return res;

  setToken(res.data.access_token);
  return res;
}
