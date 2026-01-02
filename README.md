# PontoFácil (monorepo)

## Apps

- `apps/api`: API FastAPI
- `apps/admin`: Admin Web (Next.js)
- `apps/mobile`: App mobile (Expo)

## Documentação

A documentação viva do projeto fica em:

- `docs/manual/README.md`

## Rodar local (atalho)

- API:
  - `python -m venv .venv`
  - `./.venv/Scripts/python -m pip install -r apps/api/requirements.txt`
  - `./.venv/Scripts/python -m uvicorn main:app --reload --port 8011` (em `apps/api`)

- Admin:
  - `pnpm --filter admin dev`

## Deploy

Ver `docs/manual/60-deploy-render-cloudflare.md`.
