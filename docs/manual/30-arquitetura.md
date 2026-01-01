# Arquitetura

## Monorepo

O repositório usa `pnpm-workspace.yaml` e organiza apps em `apps/*`.

- `apps/api`: backend FastAPI
- `apps/admin`: frontend web (Admin)
- `apps/mobile`: app mobile (Expo)

## Fonte de verdade

A fonte de verdade para dados e autenticação é a **API FastAPI**.

## Autenticação

- Admin autentica via `POST /auth/login`.
- O token JWT é usado no header `Authorization: Bearer <token>`.
