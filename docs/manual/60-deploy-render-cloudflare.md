# Deploy em produção (Render + Cloudflare)

Este guia descreve como publicar o PontoFácil usando:

- Render (Admin Next.js + API FastAPI + PostgreSQL)
- Cloudflare (DNS + TLS)

## Domínios sugeridos

- Admin: `https://pf.<seu-dominio>`
- API: `https://api-pf.<seu-dominio>`

Exemplo:

- `https://pf.lavsenhordospassos.com`
- `https://api-pf.lavsenhordospassos.com`

## 1) Render: Banco (PostgreSQL)

1. Render → New → PostgreSQL
2. Anotar a URL do banco.

## 2) Render: API (FastAPI)

Criar Web Service apontando para `apps/api`.

### Commands

- Build Command:
  - `pip install -r requirements.txt`
- Start Command:
  - `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Variáveis de ambiente

Os settings usam prefixo `PONTOFACIL_`.

- `PONTOFACIL_DATABASE_URL`: URL do Postgres
- `PONTOFACIL_JWT_SECRET_KEY`: segredo forte (trocar o padrão)
- `PONTOFACIL_ADMIN_EMAIL`: email do admin
- `PONTOFACIL_ADMIN_PASSWORD`: senha do admin

## 3) Render: Admin (Next.js)

Criar Web Service apontando para `apps/admin`.

### Commands

- Build Command:
  - `pnpm install --frozen-lockfile && pnpm build`
- Start Command:
  - `pnpm start -- -p $PORT`

### Variáveis de ambiente

- `NEXT_PUBLIC_API_BASE_URL`: URL pública da API
  - ex: `https://api-pf.lavsenhordospassos.com`

## 4) Cloudflare DNS

Criar registros:

- `pf` → CNAME para o hostname do Render do Admin
- `api-pf` → CNAME para o hostname do Render da API

TLS/SSL:

- Cloudflare → SSL/TLS: **Full (strict)**

## 5) Ajuste de CORS na API

Em produção, a API deve permitir a origem do Admin:

- `https://pf.<seu-dominio>`

## 6) Checklist final

- Trocar `PONTOFACIL_JWT_SECRET_KEY`
- Trocar senha do admin
- Garantir que o cookie `pf_token` seja `Secure` em produção (HTTPS)
- Smoke test do pareamento e batida de ponto
- Teste em iPhone (câmera/geo requer HTTPS)
