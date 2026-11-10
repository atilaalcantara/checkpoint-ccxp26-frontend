# Integração frontend/backend — validação em andamento

- Repositórios Git separados inicializados, sem commits. Configurações locais sensíveis foram ignoradas; arquivos existentes permanecem no disco.
- Cliente HTTP, UUID v4 persistido, participação, votos, resultados, progresso e upload foram conectados à API. Votos usam reconciliação por participação; upload trata `PROCESSING_BUSY` com no máximo duas retentativas e estado incerto com consulta posterior. Sem ajuste de enquadramento envia-se o original; com ajuste, envia-se o recorte gerado no navegador.
- Progresso usa revisão numérica `BigInt` e só apresenta nome e arte da mesma resposta decodificada. Assets futuros são excluídos do build; originais e repositórios ainda podem revelá-los. Enquetes avançam automaticamente após confirmação pelo servidor e abrem os resultados após o terceiro voto.
- `npm run build`: passou (zero erros, dois hints). API construída com Dockerfile `--platform linux/arm64 --target final`; `uname -m` retornou `aarch64`, health ready respondeu 200.
- Teste real em Chromium contra API ARM64 e PostgreSQL temporário isolado: três votos 201, resultados 200 após os votos, foto HEIC de fixture 201, reload preservou status, banco registrou 3 votos, 1 foto, 5 XP e revisão 4. Visitante independente recebeu três atribuições distintas e 403 em resultados antes de votar. Sem erros de console no fluxo principal. Tela de fotos inspecionada em 390×844 com uma imagem real.
- Upload PNG real em viewport desktop também confirmou e mostrou duas fotos recentes. Um teste simulado de `PROCESSING_BUSY` com `Retry-After: 0` fez exatamente três tentativas. Uma resposta real de resultados tinha 830 bytes para três enquetes, nesta base pequena de teste.
- Ainda faltam validações abrangentes: cancelamento e rede instável, concorrência/409 e resposta perdida, três fotos, JPEG, falta de enquetes, armazenamento indisponível, revisões fora de ordem/limiares, teclado/movimento reduzido, CORS de produção, carga e teste em telefone físico. Não anunciar conclusão até concluir os critérios do prompt.

Próximo passo: executar os cenários pendentes com banco isolado e corrigir os problemas encontrados; revisar documentação histórica e contrato antes da publicação.

Os containers temporários da API e do PostgreSQL e o servidor Astro de teste foram encerrados; o `postgres-dev` não foi alterado. A imagem Docker local temporária de build permanece disponível.

## Publicação beta

- Repositórios Git separados preparados. Segredos e configuração local devem permanecer fora do controle de versão; prompts internos de implementação ficam ignorados.
- Código, README e contrato descrevem a integração atual. Documentos de mocks e requisitos antigos são explicitamente históricos.
- O backend mantém arte privada necessária para responder somente com o nível desbloqueado; um repositório público ainda pode expor esses arquivos como spoilers. Avaliar visibilidade privada se isso for indesejado.
