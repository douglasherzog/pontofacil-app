# Autenticação no Admin (Cookie HttpOnly + Proxy)

## Objetivo

No Admin Web (`apps/admin`), a autenticação foi desenhada para:

- Evitar armazenar JWT em `localStorage`.
- Reduzir risco de XSS roubando token.
- Centralizar chamadas autenticadas através de um **proxy interno**.

## Conceito

O Admin usa **cookie HttpOnly** (nome: `pf_token`) como armazenamento do JWT.

- O cookie é configurado pelo próprio Next.js (rotas internas `/api/auth/*`).
- O browser não lê o cookie (HttpOnly).
- Chamadas para a API FastAPI passam pelo endpoint `/api/proxy/...`.

## Rotas internas (Next.js)

### `POST /api/auth/login`

- Recebe email/senha.
- Faz login na API FastAPI.
- Recebe `access_token`.
- Grava cookie HttpOnly `pf_token`.

### `POST /api/auth/logout`

- Remove o cookie `pf_token`.

### `GET /api/auth/session`

- Lê o cookie `pf_token`.
- Retorna status:
  - `authenticated: boolean`
  - `role: "admin" | "employee" | null`

### `ALL /api/proxy/[...path]`

- Recebe requisição do frontend.
- Lê `pf_token` do cookie.
- Injeta `Authorization: Bearer <token>`.
- Encaminha a requisição para a API FastAPI.

## Consequências práticas

- Frontend (React) chama **sempre** `/api/proxy/...` para endpoints protegidos.
- O JWT não é exposto ao JS do browser.

## Debug

- Se endpoints autenticados retornarem 401 no Admin:
  - confirme que o login está gravando o cookie.
  - confirme que `/api/proxy/...` está anexando `Authorization`.
  - confirme o `NEXT_PUBLIC_API_BASE_URL`.

## Em produção

- Garanta HTTPS para cookies `Secure`.
- Ajuste CORS na API para permitir a origem `https://pf.<seu-dominio>`.

Observação importante: no endpoint `POST /api/auth/login` o cookie deve ser gravado com `secure: true` em produção.
