# Troubleshooting

## Não consigo entrar no Admin

- Confirme que a API está rodando em `http://127.0.0.1:8000`.
- Confirme as credenciais.

## Erro de CORS

Se o navegador bloquear chamadas, a API precisa permitir a origem do Admin (ex: `http://localhost:3000`).

## Pandoc não encontrado

- Instale o Pandoc.
- Verifique `pandoc --version`.
