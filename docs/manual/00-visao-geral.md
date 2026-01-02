# Manual PontoFácil

## Visão geral

O PontoFácil é um sistema de registro de ponto com:

- App **Mobile** (funcionário) para registrar marcações.
- App **Admin Web** (gestor/RH) para gerenciar usuários, consultar pontos e gerar relatórios.
- Interface Web para **Funcionário** (página `/pontos`) quando usado pelo navegador.
- **API FastAPI** (fonte de verdade) para autenticação, regras e persistência.

## Perfis

- **Administrador**: gerencia usuários, acompanha registros e emite relatórios.
- **Funcionário**: registra pontos e consulta seus registros.

Observação: o funcionário pode registrar ponto via Mobile e/ou via Web (dependendo do setup). Em ambos os casos, o sistema exige **pareamento de dispositivo** para liberar a batida.

## Objetivo deste manual

Este manual atende dois públicos:

- **Usuário final**: como usar o sistema (Admin/Mobile) de forma simples.
- **Desenvolvedor**: como instalar, rodar, entender a arquitetura e evoluir o projeto.
