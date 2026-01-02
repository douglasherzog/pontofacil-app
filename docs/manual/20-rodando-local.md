# Rodando localmente

## API (FastAPI)

A API fica em `apps/api`.

Passos (PowerShell):

1. Criar venv:

- `python -m venv .venv`

2. Instalar dependências:

- `.\.venv\Scripts\python -m pip install -r apps/api/requirements.txt`

3. Subir servidor:

- `.\.venv\Scripts\python -m uvicorn main:app --reload --port 8011`

Acesse:

- `http://127.0.0.1:8011/docs`

## Admin (Next.js)

O Admin fica em `apps/admin`.

- `pnpm --filter admin dev`

Acesse:

- `http://localhost:3000`

O login padrão (dev) é:

- Email/senha definidos em `apps/api/app/core/config.py` (ou via env `PONTOFACIL_ADMIN_EMAIL` / `PONTOFACIL_ADMIN_PASSWORD`).

Observação: o Admin usa cookie HttpOnly + proxy interno (`/api/proxy/...`).
