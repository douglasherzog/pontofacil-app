# API (FastAPI)

## Swagger

- `GET /docs`: documentação interativa

## Autenticação

- `POST /auth/login`: retorna `access_token`

## Usuário logado

- `GET /public/me`: retorna dados do usuário logado (inclui `nome` e `genero` para employee)

## Funcionários (Admin)

- `GET /admin/funcionarios`: lista funcionários
- `POST /admin/funcionarios`: cria funcionário (inclui `genero`)
- `PUT /admin/funcionarios/{id}`: edita funcionário
- `DELETE /admin/funcionarios/{id}`: desativa funcionário (mantém histórico)

## Dispositivo (pareamento)

- `POST /admin/funcionarios/{id}/device-pairing-code`: gera código de pareamento (bloqueia se já existir device ativo)
- `GET /admin/funcionarios/{id}/device`: consulta device ativo
- `POST /admin/funcionarios/{id}/device/revoke`: revoga device ativo

- `POST /public/pair-device`: pareia dispositivo com o código

## Pontos

- `POST /pontos`: registra um ponto (autenticado)
- `GET /pontos/me`: lista últimos pontos do usuário logado
