# Checkpoint CCXP26 — Requisitos para o backend

**Estado:** documento histórico de requisitos entre frontend e backend. O contrato vigente é [`CONTRATO_API.md`](./CONTRATO_API.md). Decisões posteriores: votos e fotos não usam chave de idempotência nem endpoint de operações; a recuperação é feita por `PUT /participation`. Resultados são retornados integralmente em ordem alfabética, sem páginas ou cursores; a classificação por votos é feita no frontend. Alternativas não possuem `iconKey` nem `tone`. Onde este documento divergir, prevalece o contrato vigente.

> O frontend e o backend já estão integrados. Trechos abaixo que descrevem mocks, endpoints futuros ou decisões antigas são apenas histórico; consulte `CONTRATO_API.md` e os READMEs atuais para o comportamento vigente.

**Contexto:** aplicação web aberta a partir de QR Code durante a CCXP, principalmente em celulares, com rede possivelmente lenta ou intermitente. A participação deve ser espontânea, sem cadastro obrigatório. O backend será desenvolvido em **.NET** e deverá rodar em **Linux ARM**; a distribuição, a arquitetura exata e os recursos da instância ainda precisam ser confirmados.

## 1. Decisões de produto e arquitetura

| Assunto | Direção acordada |
|---|---|
| Identificação | O **navegador gera e guarda um identificador anônimo**. O frontend o envia nas operações que precisam reconhecer a participação. Sem fingerprint. |
| Enquetes | O backend atribui até três enquetes distintas e controla respostas e elegibilidade associadas ao identificador. |
| Resultados | Após as três respostas válidas, liberar os resultados disponíveis, ordenados pelos mais votados; páginas iniciais de cinco, com pré-busca no quarto card. |
| Foto | Uma contribuição confirmada por identificador; +2 XP uma vez. Mostrar até três fotos recentes, sem galeria completa. |
| Progressão | XP é comunitário e oficial no servidor; +1 por voto válido e +2 por foto confirmada. Exibir progresso do nível atual até o próximo. |
| Artes de nível | A direção escolhida é **AVIF em Base64 no mesmo retorno dos dados de nível**, sem exigir URL separada nem serviço externo de storage. Inicialmente pode ser enviada novamente em consultas; otimizar apenas se as medições indicarem necessidade. |
| Rede | Manter a última informação já recebida e usá-la enquanto a nova consulta acontece; não bloquear a interface por atualização em segundo plano. |

> **O que existe hoje:** frontend estático com dados de demonstração, sem API real. Enquetes, respostas, resultados, foto simulada e XP são armazenados localmente neste navegador. O XP exibido atualmente **não é compartilhado** entre visitantes e a foto selecionada **não é transmitida**. Os requisitos abaixo descrevem a integração futura.

## 2. Identificador anônimo do navegador

### 2.1. Geração, persistência e envio

1. No primeiro acesso, o frontend gera um identificador **aleatório, suficientemente longo e não previsível**, usando recursos criptográficos do navegador, por exemplo `crypto.randomUUID()` em contexto seguro, ou `crypto.getRandomValues()` como alternativa compatível. Não derivar o valor de características do aparelho, IP, nome, horário ou `Math.random()`.
2. Guardar o identificador localmente e reutilizá-lo nas visitas seguintes, recargas e operações da mesma instalação do navegador. A forma de envio — por exemplo, um cabeçalho ou outro mecanismo — será definida no contrato; deve ser consistente em todas as operações personalizadas.
3. Enviar o mesmo identificador nas operações que precisem reconhecer a participação: iniciar/retomar enquetes, registrar voto, consultar elegibilidade e resultados, consultar limite de foto, enviar foto e verificar uma operação cujo resultado seja incerto.
4. Para consultas estritamente públicas, como progresso comunitário e fotos recentes, **não é necessário exigir o identificador**, salvo se a mesma resposta também trouxer informações personalizadas. Isso permite cache público sem misturar estados individuais.
5. O backend usa esse valor para localizar ou criar a participação e faz a validação das regras. A criação/recuperação deve ser segura para requisições repetidas ou simultâneas, sem criar atribuições conflitantes para o mesmo identificador.

### 2.2. Limite conhecido desta escolha

O limite será **por identificador salvo naquele navegador**, não uma garantia de uma pessoa por aparelho. Se os dados do site forem apagados, o armazenamento for bloqueado/evicto, o acesso for por aba privada ou a pessoa mudar de navegador/aparelho, um novo identificador pode ser gerado e a participação anterior pode não ser reconhecida. Isso inclui Safari e Chrome no mesmo celular. Um visitante poderá, nessas condições, começar outra participação; o backend não consegue evitar isso de forma confiável com apenas esse identificador.

Essa limitação é aceita como consequência da solução simples, sem cadastro e sem fingerprint. O identificador não é uma conta, não prova quem é a pessoa e pode ser copiado ou forjado. Usar HTTPS e um valor de alta entropia, não expor o identificador em URLs públicas nem em logs desnecessários e não confiar nele como proteção antifraude forte. Definir no contrato o tratamento de identificador ausente, malformado ou de uma participação inexistente.

Se o navegador não conseguir gerar ou persistir o identificador, a aplicação deve informar que **não consegue garantir a continuidade da participação** e não apresentar ações como confirmadas sem resposta do servidor. Não prometer recuperação após perda do armazenamento. O comportamento exato — permitir uma sessão temporária ou exigir armazenamento — permanece para decisão de UX.

## 3. Home — evolução comunitária

### 3.1. Informações necessárias

O frontend precisa receber, no mesmo estado coerente:

- Identificação estável e nome do **nível atual**.
- Total acumulado de XP comunitário.
- XP acumulado mínimo do nível atual e XP acumulado necessário para desbloquear o próximo, quando houver próximo nível. Com esses valores, o frontend calcula o progresso dentro do intervalo, o quanto falta e o percentual. O servidor pode enviar também valores calculados, desde que todos reflitam o mesmo estado.
- Indicação de que a evolução chegou ao **nível final**; nesse caso não existe próximo nível e a barra deve aparecer concluída.
- Informações dos **níveis anteriores já alcançados**: identificador, nome e limites aplicáveis. A Home atual não tem uma área de histórico; a apresentação desses dados é futura. Não é necessário enviar todas as imagens antigas se não forem usadas.
- Revisão ou instante de atualização, para o frontend distinguir informação antiga e evitar substituir um estado recente por uma resposta atrasada.
- A arte necessária para apresentar o nível atual, conforme a seção 3.3. Nos níveis com dois personagens separados, o retorno deve permitir identificar cada personagem; nos níveis conjuntos, deve representar uma única imagem. A representação exata será definida no contrato.

O backend **não deve enviar nome, imagem ou catálogo dos níveis futuros**. Pode informar o número total de XP necessário para a próxima evolução sem revelar seu nome. Essa regra também vale para arquivos públicos e manifests: esconder apenas a informação retornada pela API não preserva a surpresa se os sprites futuros permanecerem publicados.

### 3.2. Níveis e cálculo

| Etapa | XP acumulado mínimo | Arte |
|---|---:|---|
| Desconhecidos | 0 | Juh e Átila em duas imagens |
| Amigos | 3 | Juh e Átila em duas imagens |
| Namorados | 7 | Casal em uma imagem |
| Noivos | 12 | Casal em uma imagem |
| Casados | 19 | Casal em uma imagem; etapa final |

Exemplo: com **9 XP**, o nível é Namorados; o intervalo vai de 7 a 12 XP, o progresso é **2 de 5**, restam **3 XP** e a barra está em **40%**. Os números são as regras atuais; o servidor será a fonte de verdade. A pontuação pode ultrapassar vários limites de uma só vez e deve resultar diretamente no nível correspondente.

### 3.3. Entrega e cache da arte

- A direção inicial é retornar a imagem **AVIF codificada em Base64 junto com os dados do nível**. Para Desconhecidos e Amigos são necessárias duas imagens; para os níveis seguintes, uma. O contrato deverá indicar o tipo de imagem, a composição e dimensões necessárias para a apresentação.
- As poucas artes podem ser guardadas como arquivos junto ao backend; não há exigência de um serviço externo de armazenamento nem de uma URL pública por imagem. O modo de armazená-las internamente é escolha da implementação.
- Podemos começar enviando a arte na resposta de nível sempre que for conveniente. Base64 aumenta os bytes em cerca de 33% antes da eventual compressão HTTP; isso é aceitável como ponto de partida. Se medições mostrarem repetição custosa, uma versão da arte conhecida pelo frontend pode permitir omiti-la em respostas posteriores — **otimização futura, não obrigação inicial**.
- O frontend guarda o último estado e a arte recebida e monta a Home com eles enquanto atualiza em segundo plano após recarga. Atualização de nome, progresso e arte deve representar uma revisão coerente; não combinar uma imagem antiga com o novo nível como se fossem correspondentes. Se a consulta falhar, manter o que já foi recebido com indicação discreta de que pode estar desatualizado.
- Na primeira visita sem cache, o frontend pode mostrar a composição inicial de Desconhecidos enquanto consulta o servidor. Sem rede na primeira visita, não há garantia de que o estado comunitário atual esteja disponível. Se o novo nível chegar mas sua arte não puder ser exibida, informar/carregar adequadamente sem afirmar visualmente que a imagem antiga é a nova.
- **Situação atual a mudar na integração:** `src/data/progression.ts`, o manifesto e os arquivos públicos ainda incluem todos os nomes, limites e sprites futuros. Precisaremos removê-los do frontend público e dos manifests para cumprir o requisito de não revelação. Base64 não protege por si só uma imagem já incluída em arquivos públicos.

### 3.4. Assets atuais e custo observado

O frontend atualmente publica as imagens em **AVIF**, sem fallback para navegadores que não o suportam. A compatibilidade específica do favicon AVIF ainda precisa ser conferida nos navegadores alvo. Os originais são preservados fora dos assets públicos. Os valores abaixo são **arquivos locais**, não medição do tráfego total da página.

| Etapa | Arquivo | Resolução | Tamanho AVIF |
|---|---|---:|---:|
| Desconhecidos | Juh | 191 × 448 | 13.977 B |
| Desconhecidos | Átila | 184 × 448 | 16.766 B |
| Amigos | Juh | 273 × 448 | 22.905 B |
| Amigos | Átila | 261 × 448 | 20.538 B |
| Namorados | Casal | 336 × 448 | 36.114 B |
| Noivos | Casal | 362 × 448 | 42.940 B |
| Casados | Casal | 417 × 448 | 70.669 B |

Os dois personagens iniciais somam **30.743 B**. A imagem de Casados representada em Base64 ocupa aproximadamente **94.228 B**, antes da eventual compressão da resposta HTTP e de outros dados. O pipeline recorta transparência excedente, redimensiona os personagens com `nearest` e gera AVIF q88 com verificação de qualidade; a moldura e as máscaras são lossless. A soma de logo, cenário de 390 px, personagens iniciais e Korok é **94.885 B** em arquivos locais; isso não inclui fontes, HTML ou JavaScript. Detalhes e medições anteriores estão em `ASSET_OPTIMIZATION.md`.

## 4. Enquetes — atribuição e votação

### 4.1. Iniciar e retomar

Para o identificador recebido, o backend deve atribuir **até três enquetes distintas** entre as ativas. Na condição normal, atribuir exatamente três. A seleção deve ser aleatória e persistida no servidor; recarregar ou retornar com o mesmo identificador recupera a mesma atribuição e as respostas já confirmadas. Não atribuir novas perguntas por renderização ou reconsulta.

O frontend não precisa pedir uma quantidade arbitrária: **três é a regra do backend**. O retorno deve informar o estado necessário para retomada e, para cada enquete atribuída:

- ID estável e pergunta original.
- Duas alternativas, cada uma com ID e texto próprios; o título não precisa conter os nomes das alternativas.
- Eventuais chaves de apresentação para cores/ícones já conhecidos pelo frontend, se forem necessárias; não é obrigatório enviar imagens ou SVG.
- Situação respondida/não respondida e, se útil para a retomada, a alternativa do próprio visitante.
- Quantidade atribuída/respondida e situação de conclusão/indisponibilidade, sem enviar resultados agregados antes da autorização.

Se houver menos de três enquetes ativas, informar a indisponibilidade e não inventar perguntas. Por padrão, resultados só são liberados após três respostas; uma condição excepcional futura precisa vir explicitamente autorizada pelo servidor.

### 4.2. Confirmar voto

- Receber identificador do navegador, enquete atribuída, alternativa e uma **chave de idempotência** para a tentativa. Repetições da mesma tentativa reutilizam essa chave.
- Validar se a participação existe, a enquete foi atribuída, a opção é válida e ainda não há voto daquele identificador naquela enquete. O servidor, não o frontend, aplica o limite.
- Registrar o voto e acrescentar **+1 XP comunitário uma única vez**, de modo transacional ou equivalente. Requisições duplicadas ou simultâneas não podem gerar dois votos nem duas recompensas.
- Confirmar sucesso ou informar o motivo da não confirmação; devolver o estado atualizado da participação e o progresso comunitário/revisão necessários ao frontend. O frontend mostra `+1 XP` apenas após sucesso e **não soma novamente** se o total oficial já vier na resposta.
- Se a conexão cair após o servidor registrar o voto, permitir consulta da operação ou repetição com a mesma chave, retornando o resultado já confirmado sem duplicar XP.

O frontend atual usa confirmação com botão para continuar. Há uma divergência no histórico: uma orientação anterior pediu avanço automático e uma especificação posterior pediu continuação manual. **A escolha definitiva de UX deve ser confirmada**; nenhuma das duas deve alterar as garantias de confirmação e idempotência do backend.

## 5. Resultados das enquetes

### 5.1. Autorização e informações

- Liberar resultados somente após o backend confirmar a conclusão das três respostas atribuídas, salvo exceção explicitamente autorizada. A autorização deve ser recuperável com o mesmo identificador após recarga.
- Antes da autorização, o servidor não deve entregar agregados, percentuais nem vencedor para aquela participação. O frontend também não deve mostrá-los durante a votação.
- Após liberar, permitir consultar os resultados de **todas as enquetes disponíveis para visualização**, não somente as três atribuídas. Cada resultado precisa de ID, título original, IDs e textos das alternativas, votos por alternativa e total de votos. O frontend pode calcular percentuais e vencedor a partir das contagens; o contrato deve definir arredondamento se o servidor também fornecer percentuais.
- Tratar empate sem vencedor e ausência de votos de forma neutra. A tela de resultados é apenas informativa: não permitir votar nela.
- Ordenar pelo **total de votos decrescente**, com desempate estável definido no contrato.

**Ponto para confirmar:** interpretar “enquetes respondidas” como enquetes com **pelo menos um voto agregado de qualquer visitante**, não apenas as três daquela pessoa. Nesse entendimento, enquetes sem votos não entram na lista inicial. Se forem incluídas no futuro, o frontend já precisa conseguir representar zero votos.

### 5.2. Paginação e atualização

- Retornar inicialmente **cinco resultados** e informação para buscar a próxima página quando existir. O frontend mostra cards horizontais e pode iniciar a próxima busca ao chegar ao **quarto card** da página carregada.
- Falha de pré-busca não deve remover os resultados já recebidos, bloquear a navegação ou criar cards duplicados. Deve ser possível tentar novamente.
- Como a ordem muda conforme chegam votos, o contrato deve prever paginação consistente. Recomenda-se cursor com desempate determinístico e revisão/snapshot da listagem; ao atualizar a classificação, iniciar nova revisão ou reconciliar por ID. Definir expiração e recuperação de cursor na etapa de contrato.
- Não é necessário tempo real: atualizar periodicamente e em segundo plano enquanto a seção estiver visível e a conexão permitir. **60–120 segundos** é apenas sugestão inicial para teste; intervalo e política final ainda não foram decididos. Pausar em aba oculta/offline e reduzir tentativas após falhas.
- Manter resultados anteriormente recebidos durante a atualização. Se usados sem conexão, indicar que podem estar desatualizados e mostrá-los apenas quando o desbloqueio daquela participação já tiver sido confirmado. O servidor continua responsável pelo controle real de acesso.

## 6. Fotos recentes

O backend fornece **até três fotos recentes disponíveis** para a composição existente. Se houver menos, informar apenas as disponíveis para que o frontend apresente estado parcial ou vazio; não criar galeria completa, histórico, curtidas ou carrossel de todas as fotos. A seleção exata — três mais recentes ou amostra entre recentes — ainda deve ser confirmada.

Para cada item, o frontend precisa de ID estável, imagem pronta, tipo/formato, dimensões, versão/atualização e texto alternativo quando disponível. A imagem é **somente a fotografia**; a moldura Polaroid é um asset do frontend e não deve vir incorporada à foto.

### Formato e proporção atuais

- As miniaturas de demonstração são geradas em **AVIF, 360 × 330 px**, proporção 12:11, com recorte `cover`; o componente aplica enquadramento adicional via CSS caso necessário.
- Os três arquivos AVIF atuais medem **27.828 B, 27.406 B e 16.913 B**. São exemplos, não limites garantidos: tamanho e qualidade variam conforme a imagem e o encoder.
- A moldura atual é AVIF lossless de **420 × 462 px**, com 75.019 B, usada sobre as imagens. Fotos recentes podem ser carregadas quando a seção Fotos for acessada, não necessariamente na abertura da Home.
- O transporte das três miniaturas ainda precisa ser fechado: **Base64 no retorno de fotos recentes é uma opção simples coerente com a preferência para as artes de nível**; também é possível discutir outra forma sem exigir serviço externo de storage. O contrato deve definir como o frontend recebe bytes, formato e atualização, e medir o tamanho total de três imagens na rede real. A escolha de Base64 para a arte do nível não determina automaticamente o contrato das fotos recentes.

## 7. Envio de uma fotografia

### 7.1. Elegibilidade e confirmação

1. O backend informa, para o identificador do navegador, se ainda pode enviar uma foto ou se a participação já foi concluída.
2. Selecionar arquivo, visualizar, cancelar ou começar a transferência **não consome o limite**, não significa sucesso e não gera XP.
3. No envio, receber identificador, arquivo e chave de idempotência da tentativa. Validar elegibilidade, tipo real, dimensões e limites; não confiar só na extensão ou no MIME declarado.
4. Após confirmação de sucesso definida no contrato, registrar a única contribuição e conceder **+2 XP comunitário uma vez**, em operação transacional ou equivalente. Não conceder XP adicional por legenda ou descrição.
5. Retornar o estado confirmado de foto e o progresso comunitário/revisão; o frontend mostra o feedback após sucesso. Se a resposta se perder, permitir consultar ou repetir com a mesma chave sem duplicar a foto ou o XP. Ao recarregar com o mesmo identificador, a pessoa continua sem poder enviar outra.
6. Falha ou cancelamento não pode consumir a oportunidade. O contrato deve distinguir falha, processamento pendente e resultado desconhecido, sem informar como enviado algo que não foi confirmado.

**Processamento e publicação são decisões separadas:** a confirmação de uma contribuição não significa necessariamente que ela apareça imediatamente entre as três fotos. Precisamos definir o que constitui sucesso e como tratar eventual falha de processamento ou rejeição posterior, incluindo se haverá revisão antes da publicação. Não assumir estorno de XP sem regra definida.

### 7.2. Compressão antes do envio e processamento no servidor

- **Frontend:** a proposta é tentar redimensionar/comprimir localmente antes do envio para gastar menos dados, priorizando ampla compatibilidade. Um ponto de partida é usar APIs nativas de imagem/Canvas e produzir **JPEG** para o upload quando o navegador conseguir; isso não altera a padronização **AVIF dos assets exibidos**. O arquivo de entrada, o formato de transferência e o formato final exibido são decisões diferentes.
- Para experimentar, limitar o lado maior a aproximadamente **1.600–2.048 px**, mantendo proporção, e testar qualidade JPEG de **0,75–0,85**. Buscar algo como **300–700 KB**, sem garantir que todo arquivo atinja esse tamanho. Medir tempo, memória e qualidade nos aparelhos reais antes de fixar os limites.
- Validar o tipo real e tamanho do resultado: `canvas.toBlob()` pode falhar ou devolver PNG se o formato pedido não for suportado. Não renomear outro formato como JPEG e não enviar silenciosamente um arquivo muito grande. Usar bytes/`Blob`, sem converter o upload inteiro para Base64 sem necessidade.
- A pessoa pode selecionar JPEG, PNG, HEIC/HEIF ou outro formato; a capacidade de ler a entrada varia conforme o navegador. Se não conseguir converter, informar e oferecer escolha de arquivo compatível ou envio do original apenas se o backend o aceitar e a pessoa concordar com o tamanho. Testar orientação, rotação, cor, transparência e metadados; não prometer remoção de EXIF sem validá-la.
- **Backend:** validar novamente, aplicar orientação, criar a miniatura AVIF de 360 × 330 e armazená-la para reutilização, em vez de recodificá-la a cada consulta. Preservar proporção e aplicar o recorte apropriado à amostra. Definir tratamento de metadados, dados pessoais e exposição pública antes do lançamento.
- **Opção técnica a testar, não dependência aprovada:** NetVips/libvips em .NET tem pacotes nativos para Linux ARM64 glibc e musl e suporte a AVIF. Validar a combinação de versão, distribuição, codecs de entrada — especialmente HEIC —, CPU, memória e licenças no ambiente real. Não assumimos desempenho nem suporte a HEIC apenas por existir encoder AVIF.

## 8. Rede instável, cache e segurança das operações

- **Carregar quando necessário:** Home precisa do estado de progresso; enquetes ao iniciar/retomar; resultados apenas após autorização; fotos recentes ao acessar Fotos. Dados públicos e personalizados podem ser combinados quando isso simplificar a API sem vazar informação privada entre visitantes.
- **Estado anterior:** conservar o último progresso e arte recebidos e apresentar uma indicação de desatualização quando necessário. Fotos e resultados já recebidos podem permanecer visíveis durante falhas, respeitando a autorização da própria participação. Não há promessa de funcionamento offline completo na primeira visita.
- **Atualizações não bloqueantes:** manter a interface utilizável durante consultas e atualização de resultados. Tempo real não é requisito. Definir timeout, retentativa, intervalo e cancelamento com base em testes na rede do evento.
- **Distinguir estados de ação:** aguardando conexão, enviando, confirmado, falhou e resultado desconhecido. Uma resposta perdida pode corresponder a uma operação já registrada: consultar ou repetir com a mesma chave de idempotência.
- **Cache:** respostas personalizadas não devem ser reutilizadas por outro identificador ou cache compartilhado. O contrato deverá definir versionamento/revalidação e política para dados públicos, fotos removidas e alterações de arte. Se arte Base64 vier junto de dados mutáveis, avaliar custo de respostas repetidas; a versão inicial simples pode priorizar clareza e ser medida antes de otimização.
- **Envio de foto:** não guardar o arquivo de forma persistente nem prometer envio em segundo plano sem uma decisão explícita de produto sobre privacidade, uso de espaço, retentativa e consumo de dados.
- **Validação e concorrência:** servidor deve tratar requisições repetidas, cliques rápidos, duas abas e rede que cai após gravação. Garantir voto/foto/XP uma única vez para a participação identificada e operação, inclusive sob concorrência.
- **Diagnóstico:** mensagens devem diferenciar indisponibilidade temporária, identificador ausente/inválido, enquete já respondida, resultado ainda bloqueado, foto já enviada, arquivo inválido e resultado incerto. Não registrar o identificador completo, arquivos ou informações sensíveis desnecessariamente em logs.

## 9. Matriz do que o contrato precisará cobrir

Esta tabela descreve **operações conceituais**, ainda sem fixar rotas ou JSON.

| Operação | O frontend informa | O backend precisa devolver ou garantir |
|---|---|---|
| Consultar progresso | Nada personalizado, se a resposta for pública | Nível atual, XP/limites, estado final, revisão, níveis anteriores necessários e arte atual em Base64. Sem dados de níveis futuros. |
| Iniciar/retomar participação | Identificador anônimo | Até três enquetes atribuídas, alternativas, respostas confirmadas e elegibilidade; atribuição persistente para o mesmo ID. |
| Registrar voto | Identificador, enquete, alternativa e chave da tentativa | Confirmação ou motivo de falha; estado atualizado; +1 aplicado uma só vez e XP oficial/revisão. |
| Consultar resultados | Identificador e posição/cursor quando necessário | Autorização, até cinco resultados ordenados, contagens e informação para continuar; nunca liberar antes da elegibilidade. |
| Consultar fotos recentes | Nenhum ID se o conteúdo for público | Até três miniaturas AVIF e metadados necessários; transporte exato ainda a decidir. |
| Consultar limite de foto | Identificador | Se a participação já confirmou uma foto ou ainda está elegível. |
| Enviar foto | Identificador, arquivo e chave da tentativa | Confirmação ou estado/erro; limite e +2 aplicados uma vez; XP oficial/revisão. |
| Consultar operação incerta | Identificador e referência/chave da tentativa | Confirmação anterior, falha ou estado pendente, sem repetir efeitos. |

## 10. Pontos ainda abertos antes dos esquemas JSON

1. **Resultados:** confirmar o significado de “enquetes respondidas” e se enquetes sem votos entram na lista. Definir snapshot/cursor e comportamento de atualização.
2. **Fotos recentes:** confirmar “três mais recentes” versus amostra entre recentes, regras para menos de três e transporte das miniaturas AVIF.
3. **Upload:** confirmar formatos de entrada aceitos, limites de bytes/dimensões, comportamento para HEIC, compressão no cliente, o momento de sucesso e eventual revisão/publicação.
4. **UX das perguntas:** decidir avanço automático ou continuação manual diante das orientações conflitantes do histórico; o backend só precisa confirmar o voto e devolver estado.
5. **Histórico dos níveis:** decidir se a primeira versão exibirá etapas anteriores e quais metadados/imagens elas precisam.
6. **Rede:** definir timeout, frequência de atualização e se haverá voto pendente local. Não prometer funcionamento totalmente offline sem projetá-lo e testá-lo.
7. **Identificador indisponível:** decidir se o usuário poderá continuar em uma sessão temporária ou se deverá habilitar armazenamento para participar. A perda após limpeza e separação entre navegadores são limitações já conhecidas da solução escolhida.
8. **Infraestrutura:** confirmar distribuição Linux ARM, memória/CPU e empacotamento .NET; testar AVIF e codecs de entrada no ambiente real.
9. **Fotos e privacidade:** definir prazo de retenção, remoção, apresentação pública e tratamento de metadados.

## 11. Próxima etapa

O contrato proposto, os exemplos e o modelo relacional estão em [`CONTRATO_API.md`](./CONTRATO_API.md). O prompt para implementação do backend está em [`PROMPT_BACKEND.md`](./PROMPT_BACKEND.md). A integração do frontend e a substituição dos mocks continuam sendo etapas posteriores; depois, medir transferência e experiência no iPhone e em outros aparelhos reais.
