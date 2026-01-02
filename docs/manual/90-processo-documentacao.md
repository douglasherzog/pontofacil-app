# Processo de documentação (padrão de atualização)

## Objetivo

Garantir que a documentação do PontoFácil seja fácil de manter e sempre reflita o estado real do sistema.

Este projeto mantém documentação viva em `docs/manual/`.

## Regra principal

A cada mudança relevante no sistema (feature, decisão de arquitetura, alteração de fluxo), atualizar a documentação no mesmo PR/commit.

## Checklist mínimo (por mudança)

- Se mudou um **fluxo de usuário**:
  - atualizar o capítulo correspondente (Admin/Mobile/Pontos/QR/etc)
- Se mudou **arquitetura**:
  - atualizar `30-arquitetura.md`
  - atualizar capítulo específico (ex: `31-auth-cookie-proxy.md`)
- Se mudou **deploy/config/env**:
  - atualizar `60-deploy-render-cloudflare.md`
- Se foi uma mudança grande:
  - adicionar 3–8 bullets em `05-historico.md`

## Template de entrada de histórico

Copie e cole no `05-historico.md` quando necessário:

- **Data**: YYYY-MM-DD
- **Mudança**: <resumo curto>
- **Motivo**: <por quê>
- **Impacto**: <o que mudou para o usuário/dev>
- **Arquivos**: <paths principais>
- **Como testar**: <passos rápidos>

## Sugestão de workflow

- Em cada PR:
  - incluir uma seção “Docs” no texto do PR indicando quais capítulos foram atualizados.
- Em cada release:
  - revisar `60-deploy-render-cloudflare.md` e `70-troubleshooting.md`.
