# CI/CD do frontend HLG

## Contrato

`.github/workflows/hlg.yml` roda somente em push para `homologacao`: Node 24, `npm ci`, testes Node existentes, `astro check` + build; depois build/publicação ARM64 de `Dockerfile.hlg` e deploy pelo environment `homologation`. Imagens `ghcr.io/atilaalcantara/checkpoint-web:hlg-<SHA completo>` e `:hlg`, cache `hlg-web`; o deploy aceita somente a tag SHA HLG. Não publica `latest`.

`Dockerfile.hlg` mantém `PUBLIC_API_URL` vazio no build. `deploy/nginx.hlg.conf` é a cópia exata da configuração real `/home/ubuntu/apps/checkpoint-hlg/web-nginx.conf`, montada read-only em `/etc/nginx/conf.d/default.conf` pelo dispatcher. O Dockerfile também inclui a configuração, mas o bind mount do host prevalece em runtime; atualizar a imagem não atualiza esse mount. Mudanças futuras exigem sincronização administrativa e `nginx -t`. Resolve somente `checkpoint-hlg-api:8080` via DNS Docker e encaminha `/api/` na mesma origem, preservando Host; sem fallback PRD. Dockerfile/nginx originais são usados pelo workflow PRD.

Container `checkpoint-hlg-web`, rede `checkpoint-hlg-net`, sem portas publicadas. Diretório `/home/ubuntu/apps/checkpoint-hlg` root-owned, modo 750; a conta restrita não escreve scripts/configuração. Imagens privadas precisam de acesso GHCR read-only previamente instalado para Docker root. Proxy TLS do domínio HLG deve apontar para esse contêiner, conectado à rede HLG e preservando Host. A API HLG precisa estar saudável antes do deploy web: o smoke pós-deploy consulta `/api/v1/site-status` através do nginx.

## GitHub

Environments criados via `gh`, sem aprovação obrigatória:

- `homologation`: branch policy exclusiva `homologacao`.
- `production`: branch policy exclusiva `main`.

O workflow PRD compartilhado entre PR e main não usa `environment: production`: isso aplicaria a policy `main` também às validações de PR. Depois do deploy SSH (somente push), verifica externamente `/` e `/api/v1/site-status`. O HLG faz os mesmos checks através do proxy TLS já ativo. `curl --fail` com retries/timeouts falha o job se o proxy público não servir; não aciona rollback remoto automático.

Configurar no environment **homologation** deste repositório (nenhum secret criado nesta entrega):

| Tipo | Nome | Uso |
| --- | --- | --- |
| Secret | `HLG_DEPLOY_SSH_KEY` | Chave do usuário SSH restrito |
| Variable | `HLG_SSH_USER` | Login restrito obrigatório, sem fallback PRD |
| Variable | `PUBLIC_PRIVACY_EMAIL` | E-mail exibido na política de privacidade |

`GITHUB_TOKEN` é automático, com `packages: write` somente no job de publicação. SSH usa host fixo `oracle.atilaalcantara.com`, chave ed25519 pública pinada já existente e `StrictHostKeyChecking=yes`. O workflow chama `deploy-web IMAGE`, sem enviar shell ou stdin. A conta `checkpoint-hlg-deploy` tem forced command `/usr/local/sbin/checkpoint-hlg-ssh` → sudo allowlist `/usr/local/sbin/checkpoint-hlg-deploy` → `/usr/local/lib/checkpoint-hlg/operations.py`, todos root-owned. Allowlist exata: `status`, `deploy-api API_IMAGE`, `deploy-web WEB_IMAGE`, `rollback-api`, `rollback-web`. Scripts/flags arbitrários, comandos antigos `migrate`/`deploy` e conteúdo stdin não são executados. Não há `.env` runtime para o frontend nem secret de URL da API.

Verificação via GitHub API em 2026-11-16: **`PUBLIC_PRIVACY_EMAIL` ausente nas vars do repositório e dos environments production e homologation**. PRD lê vars do repositório (job sem environment); HLG pode usar override em homologation ou herdar a var do repositório. O código usa string vazia e mostra `Contato: informe aqui o canal de contato do projeto.` enquanto ausente. Nenhum e-mail foi criado, inferido ou configurado. O responsável deve fornecer um contato real e configurar a var antes do próximo build que deva exibi-lo; é valor público fixado no build, não configuração runtime.

## Rollback e verificação

Concurrency serializa o workflow web; API/web mantêm releases independentes no mesmo environment. O lock global `/run/lock/checkpoint-hlg-deploy.lock` protege API/web/rollback/ativação no host com espera bounded de **600s**, polling de 250ms e relógio monotônico. Timeout falha antes de mutações; não exige repetir automaticamente uma operação que já iniciou. O limite de 20 minutos do job inclui build, espera e execução. A fonte real do dispatcher root-owned está versionada em **Backend `deploy/operations.py`**, com testes de infraestrutura em `deploy/test_operations.py` (fora dos auth/tests existentes). `deploy/hlg.sh` neste repo é apenas cliente SSH local: `bash deploy/hlg.sh deploy-web IMAGE`, `status` ou `rollback-web`; requer chave e host key previamente configurados, não contém Docker/guards/lock próprios e não é executado remotamente pelo CI.

Após pull, o anterior é parado, renomeado para `checkpoint-hlg-web-previous` e desconectado da rede. Falha no start, HTTP `/`, `nginx -t` ou smoke same-origin restaura automaticamente o contêiner anterior e falha o workflow. Sem anterior, remove o candidato com falha. Retém uma versão anterior; imagens não são podadas.

O web recebe `web-nginx.conf` root-owned, read-only, idêntico a `deploy/nginx.hlg.conf`, com DNS Docker dinâmico para `checkpoint-hlg-api`. Trocas/rollback da API aguardam o smoke através do web existente, respeitando cache DNS de 10s; não exigem reload do nginx HLG nem do `nginx-proxy` compartilhado. O vhost HLG **já ativo** também resolve o web dinamicamente, evitando reload compartilhado nos futuros deploys web.

Rollback individual pela conta restrita:

```bash
ssh -i "$KEY" checkpoint-hlg-deploy@oracle.atilaalcantara.com rollback-web
```

Deploy real confirmado em 2026-11-16: [frontend 43920019861](https://github.com/atilaalcantara/checkpoint-ccxp26-frontend/actions/runs/43920019861) e [backend 43920021425](https://github.com/atilaalcantara/checkpoint-ccxp26-backend/actions/runs/43920021425), ambos tentativa **2** com sucesso. A tentativa 1 falhou por contenção no lock não bloqueante; concurrency de um repo não serializa o outro.

Correção de espera instalada no dispatcher HLG em 2026-11-16, sem deploy/pull/migration adicional. Verificado no host: timeout bounded, forced command status aguardando lock e concluindo após liberação, guard real, readiness API, `nginx -t` e smoke web/same-origin. A cópia nginx versionada foi comparada ao mount real. Checks externos de `/` e `/api/v1/site-status` em HLG e PRD; testes locais: `bash -n deploy/hlg.sh`, `node --test tests/*.test.mjs`, `npm run build`, `actionlint`, `git diff --check`. Os novos passos CI aguardam commit/push pelo coordenador.

Resultado: quatro HTTP 200 externos; 3 testes Node aprovados; build com 0 erros/avisos e 2 hints preexistentes. Harness temporário dos dois clientes SSH aprovou 22 cenários válidos/inválidos sem conexão real. SHA-256 do nginx versionado e mount real: `86e311981b961cca5177db5411e97ebfddb262e457ba2134fc650e03c6dd2738`. Aviso do runner sobre actions Docker declarando Node 20 e sendo executadas em Node 24 documentado no backend `deploy/HLG.md`; não bloqueou os runs.
