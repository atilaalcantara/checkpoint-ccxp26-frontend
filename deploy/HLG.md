# CI/CD do frontend HLG

## Contrato

`.github/workflows/hlg.yml` roda somente em push para `homologacao`: Node 24, `npm ci`, testes Node existentes, `astro check` + build; depois build/publicação ARM64 de `Dockerfile.hlg` e deploy pelo environment `homologation`. Imagens `ghcr.io/atilaalcantara/checkpoint-web:hlg-<SHA completo>` e `:hlg`, cache `hlg-web`; o deploy aceita somente a tag SHA HLG. Não publica `latest`.

`Dockerfile.hlg` mantém `PUBLIC_API_URL` vazio no build. `deploy/nginx.hlg.conf` resolve somente `checkpoint-hlg-api:8080` via DNS Docker e encaminha `/api/` na mesma origem, preservando Host. Não existe fallback para PRD; indisponibilidade da API HLG retorna erro. O Dockerfile e nginx originais continuam sendo usados pelo workflow existente.

Container `checkpoint-hlg-web`, rede `checkpoint-hlg-net`, sem portas publicadas. Diretório `/home/ubuntu/apps/checkpoint-hlg` root-owned, modo 750; a conta restrita não escreve scripts/configuração. Imagens privadas precisam de acesso GHCR read-only previamente instalado para Docker root. Proxy TLS do domínio HLG deve apontar para esse contêiner, conectado à rede HLG e preservando Host. A API HLG precisa estar saudável antes do deploy web: o smoke pós-deploy consulta `/api/v1/site-status` através do nginx.

## GitHub

Environments criados via `gh`, sem aprovação obrigatória:

- `homologation`: branch policy exclusiva `homologacao`.
- `production`: branch policy exclusiva `main`.

O workflow PRD compartilhado entre PR e main não recebeu `environment: production`: isso aplicaria a policy `main` também às validações de PR. Seus triggers/comandos permanecem iguais.

Configurar no environment **homologation** deste repositório (nenhum secret criado nesta entrega):

| Tipo | Nome | Uso |
| --- | --- | --- |
| Secret | `HLG_DEPLOY_SSH_KEY` | Chave do usuário SSH restrito |
| Variable | `HLG_SSH_USER` | Login restrito obrigatório, sem fallback PRD |
| Variable | `PUBLIC_PRIVACY_EMAIL` | E-mail exibido na política de privacidade |

`GITHUB_TOKEN` é automático, com `packages: write` somente no job de publicação. SSH usa host fixo `oracle.atilaalcantara.com`, chave ed25519 pública pinada já existente e `StrictHostKeyChecking=yes`. O workflow chama `deploy-web IMAGE`, sem enviar shell ou stdin. A conta `checkpoint-hlg-deploy` tem forced command `/usr/local/sbin/checkpoint-hlg-ssh` → sudo allowlist `/usr/local/sbin/checkpoint-hlg-deploy` → `/usr/local/lib/checkpoint-hlg/operations.py`, todos root-owned. Allowlist exata: `status`, `deploy-api API_IMAGE`, `deploy-web WEB_IMAGE`, `rollback-api`, `rollback-web`. Scripts/flags arbitrários, comandos antigos `migrate`/`deploy` e conteúdo stdin não são executados. Não há `.env` runtime para o frontend nem secret de URL da API.

## Rollback e verificação

Concurrency serializa o workflow; lock global `/run/lock/checkpoint-hlg-deploy.lock` protege API/web/rollback/ativação no host. A implementação root-owned adapta o fluxo revisado de `deploy/hlg.sh`; esse Bash é referência, não é enviado/executado remotamente. Após pull, o anterior é parado, renomeado para `checkpoint-hlg-web-previous` e desconectado da rede. Falha no start, HTTP `/`, `nginx -t` ou smoke same-origin restaura automaticamente o contêiner anterior e falha o workflow. Sem anterior, remove o candidato com falha. Retém uma versão anterior; imagens não são podadas.

O web recebe `web-nginx.conf` root-owned, read-only, equivalente a `deploy/nginx.hlg.conf`, com DNS Docker dinâmico para `checkpoint-hlg-api`. Trocas/rollback da API aguardam o smoke através do web existente, respeitando cache DNS de 10s; não exigem reload do nginx HLG nem do `nginx-proxy` compartilhado. O vhost HLG pendente também resolve o web dinamicamente, evitando reload compartilhado nos futuros deploys web. A ativação inicial desse vhost permanece uma operação administrativa separada e não foi executada.

Rollback individual pela conta restrita:

```bash
ssh -i "$KEY" checkpoint-hlg-deploy@oracle.atilaalcantara.com rollback-web
```

Contrato root-owned instalado e guard real aprovado em 2026-11-16. Status aprovado; 20 comandos negativos, forwarding e stdin verificados; rollback sem anterior rejeitado sem mutação. Harness da adaptação: 15 testes de guards/transações/rollback aprovados. Nenhum deploy/pull/migration executado no host nesta validação.

Validações: `bash -n deploy/hlg.sh`, `node --test tests/*.test.mjs`, `npm run build`, `git diff --check`. Build Docker/`nginx -t`/healthchecks/smoke reais dependem de Docker e da API HLG provisionada. Verificar externamente o domínio HLG, `/api/v1/site-status` e chamadas do navegador na mesma origem.

Resultado local desta entrega (2026-11-16): 3 testes Node aprovados; build Astro aprovado, 0 erros/avisos e 2 hints preexistentes; `actionlint`, sintaxe Bash e diff aprovados. Harness temporário com Docker simulado aprovou 22 cenários conjuntos API/web, incluindo rollback automático no erro do smoke same-origin. Docker daemon indisponível localmente: build ARM64 e verificações reais de nginx/rede/host ainda dependem da execução do workflow após provisionamento. Environments e branch policies confirmados por releitura via `gh api`.
