# Manual PontoFácil

## Visão geral

O PontoFácil é um sistema de registro de ponto com:

- App **Mobile** (funcionário) para registrar marcações.
- App **Admin Web** (gestor/RH) para gerenciar usuários, consultar pontos e gerar relatórios.
- **API FastAPI** (fonte de verdade) para autenticação, regras e persistência.

## Perfis

- **Administrador**: gerencia usuários, acompanha registros e emite relatórios.
- **Funcionário**: registra pontos e consulta seus registros (via mobile).

## Objetivo deste manual

Este manual atende dois públicos:

- **Usuário final**: como usar o sistema (Admin/Mobile) de forma simples.
- **Desenvolvedor**: como instalar, rodar, entender a arquitetura e evoluir o projeto.
