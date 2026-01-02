# Admin Web (para gestores/RH)

## Objetivo

O Admin Web é o painel para:

- Gerenciar usuários
- Consultar registros de ponto
- Gerar relatórios

## Como entrar

1. Abra o Admin no navegador.
2. Informe e-mail e senha.
3. Clique em **Entrar**.

## Navegação

- **Dashboard**: visão geral e atalhos.
- **Usuários**: criação/gestão de funcionários.
- **Pontos**: consulta e filtros.
- **Relatórios**: exportação e auditoria.
- **Configurações**: parâmetros do sistema.

## Usuários (funcionários)

Na tela **Usuários** o admin pode:

- Criar funcionário (nome, email, senha, gênero).
- Editar funcionário.
- Excluir (desativar) funcionário (mantém histórico de pontos).

## Dispositivo (QR Code)

Para permitir que um funcionário bata ponto em um celular, é necessário parear um dispositivo:

1. Usuários → selecionar funcionário → **Dispositivo**
2. Se existir device ativo: **Revogar dispositivo**
3. **Gerar QR Code** e entregar para o funcionário ler no `/pontos`

Detalhes do fluxo: `32-pareamento-dispositivo.md`.
