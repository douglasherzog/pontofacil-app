# Arquitetura

## Monorepo

O repositório usa `pnpm-workspace.yaml` e organiza apps em `apps/*`.

- `apps/api`: backend FastAPI
- `apps/admin`: frontend web (Admin)
- `apps/mobile`: app mobile (Expo)

## Fonte de verdade

A fonte de verdade para dados e autenticação é a **API FastAPI**.

## Autenticação

### Admin Web (Next.js)

O Admin usa autenticação com **cookie HttpOnly** (`pf_token`) e um **proxy interno**:

- Login: `POST /api/auth/login` (Next) grava o cookie HttpOnly.
- Sessão: `GET /api/auth/session` (Next) retorna status/role.
- Chamadas autenticadas: `GET|POST|PUT|DELETE /api/proxy/...` (Next) injeta `Authorization: Bearer <token>`.

Detalhes: `31-auth-cookie-proxy.md`.

### API FastAPI

- JWT é validado na API.
- Admin/Employee são roles distintas.

## Fluxos principais

- Cadastro/gestão de funcionários (Admin): criação/edição/desativação.
- Pareamento do dispositivo (Employee): QR Code + regra 1 funcionário = 1 dispositivo.
