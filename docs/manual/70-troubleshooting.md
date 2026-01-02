# Troubleshooting

## Não consigo entrar no Admin

- Confirme que a API está rodando em `http://127.0.0.1:8011` (dev).
- Confirme as credenciais.

## Cookies / sessão não persiste

- Em produção, o cookie HttpOnly deve ser `Secure` e exige HTTPS.
- Se estiver testando câmera no iPhone, é necessário HTTPS (ou `localhost`).

## Erro de CORS

Se o navegador bloquear chamadas, a API precisa permitir a origem do Admin (ex: `http://localhost:3000`).

Em produção, permitir `https://pf.<seu-dominio>`.

## Pandoc não encontrado

- Instale o Pandoc.
- Verifique `pandoc --version`.
