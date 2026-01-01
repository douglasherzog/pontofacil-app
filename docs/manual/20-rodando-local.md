# Rodando localmente

## API (FastAPI)

A API fica em `apps/api`.

Passos (PowerShell):

1. Criar venv:

- `python -m venv .venv`

2. Instalar dependências:

- `.\.venv\Scripts\python -m pip install -r requirements.txt`

3. Subir servidor:

- `.\.venv\Scripts\python -m uvicorn main:app --reload --port 8000`

Acesse:

- `http://127.0.0.1:8000/docs`

## Admin (Next.js)

O Admin fica em `apps/admin`.

- `pnpm -C apps/admin dev`

Acesse:

- `http://localhost:3000`

O login padrão (dev) é:

- `admin@local` / `admin`
