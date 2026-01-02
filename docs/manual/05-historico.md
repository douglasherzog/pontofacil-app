# Histórico e decisões

## Objetivo

Este documento registra, em alto nível, as principais decisões e mudanças do PontoFácil, para facilitar retomadas futuras e manter rastreabilidade.

## Linha do tempo (resumo)

### Base do sistema

- Monorepo com `apps/api` (FastAPI), `apps/admin` (Next.js), `apps/mobile` (Expo).
- Fonte de verdade: API FastAPI.

### Autenticação no Admin (mudança importante)

- Migração do Admin para **autenticação por cookie HttpOnly**.
- Criação de rotas internas no Next.js:
  - `POST /api/auth/login` (faz login na API e grava cookie HttpOnly `pf_token`).
  - `POST /api/auth/logout` (remove cookie).
  - `GET /api/auth/session` (retorna status/role baseado no cookie).
  - `ALL /api/proxy/[...path]` (proxy interno: injeta `Authorization: Bearer <token>` baseado no cookie).

Resultado: o token não fica no `localStorage` e o browser não manipula JWT diretamente.

### Fluxo de pareamento de dispositivo (funcionário)

- Implementação de pareamento seguro com QR Code:
  - Admin gera código/QR para o funcionário.
  - Funcionário lê QR (câmera ou upload de imagem) e realiza pareamento.
  - “Bater ponto” fica bloqueado até o dispositivo estar pareado.

### Regra de segurança: 1 funcionário = 1 dispositivo

- Backend passou a bloquear geração de novo pairing se houver dispositivo ativo.
- Admin precisa **revogar** dispositivo antes de cadastrar outro.

### UX / Layout por role

- Funcionário: experiência simplificada (sem sidebar), foco apenas na página `/pontos`.
- Saudação personalizada com nome + ajuste de gênero (“bem vindo/bem vinda”).

### Cadastro de gênero e CRUD de funcionário (Admin)

- Admin passou a registrar `genero` (homem/mulher) no cadastro do funcionário.
- Adicionados endpoints de editar/desativar funcionário (mantendo histórico).

### Produção

- Planejamento de deploy usando Render + Cloudflare:
  - `pf.<dominio>` para Admin
  - `api-pf.<dominio>` para API

## Onde encontrar detalhes

- Auth por cookie + proxy: `31-auth-cookie-proxy.md`
- Pareamento e regra 1:1: `32-pareamento-dispositivo.md`
- Deploy Render + Cloudflare: `60-deploy-render-cloudflare.md`
- Processo de atualização da documentação: `90-processo-documentacao.md`
