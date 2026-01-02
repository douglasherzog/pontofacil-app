# Pareamento de dispositivo (QR Code) e regra 1:1

## Objetivo

Garantir que o funcionário só consiga bater ponto após parear um dispositivo.

- O pareamento é iniciado pelo Admin.
- O funcionário lê um QR Code/código e registra o dispositivo.

## Visão geral do fluxo

### Admin

1. Acessa **Usuários**.
2. Escolhe um funcionário.
3. Abre modal **Dispositivo**.
4. Se existir dispositivo ativo:
   - precisa clicar em **Revogar dispositivo**.
5. Clica em **Gerar QR Code**.
6. O QR Code contém payload `PFPAIR:<codigo>`.

### Funcionário

1. Acessa `/pontos`.
2. Faz leitura do QR Code:
   - via câmera (quando em HTTPS/localhost)
   - ou upload de imagem
   - ou input manual (fallback)
3. App envia para `POST /public/pair-device`:
   - `code`
   - `device_id`
   - `device_name`
4. Ao concluir:
   - marca flag local `pf_device_paired`
   - libera botão **Bater ponto**

## Regra “1 funcionário = 1 dispositivo”

- Backend impede gerar novo código de pareamento se existir dispositivo ativo.
- Admin deve revogar explicitamente.

## Endpoints relevantes

### Admin (API)

- `POST /admin/funcionarios/{id}/device-pairing-code`
- `GET /admin/funcionarios/{id}/device`
- `POST /admin/funcionarios/{id}/device/revoke`

### Público (API)

- `POST /public/pair-device`

## Observações de segurança

- A câmera no iPhone exige **HTTPS** (ou `localhost`).
- Em dev remoto (rede local), o ideal é usar túnel HTTPS (Cloudflare Tunnel/Ngrok) se quiser câmera.

## Smoke test (checklist)

1. Admin: revogar dispositivo
2. Admin: gerar QR
3. Funcionário: ler QR (câmera/upload)
4. Confirmar que **Bater ponto** habilita
5. Bater ponto com sucesso
6. Simular “celular novo” e repetir fluxo
