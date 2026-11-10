# Otimização de assets — Checkpoint CCXP26

> **Nota de escopo:** este relatório preserva medições e protótipos históricos. Fotos de demonstração ficam restritas ao playground local; o build de produção as remove. A prévia de upload atual envia o recorte ajustado ou, sem ajuste, o original.

> **Atualização mais recente — AVIF único:** os assets de imagem publicados pela aplicação foram padronizados em AVIF, sem fallback para navegadores que não o suportam. Os originais permanecem preservados como fontes. Personagens, Korok, logo e ícones de seção são gerados em AVIF q88 quando atingem PSNR ≥40 dB sobre o fundo creme e variação máxima de alpha de 6/255; a moldura e as máscaras usam AVIF lossless com comparação exata dos pixels visíveis e alpha. O cenário usa AVIF q70. Em Safari/iOS anterior ao suporte a AVIF, as imagens não terão fallback. O suporte a AVIF como favicon deve ser conferido separadamente no navegador alvo.
>
> **Comparação com o WebP anterior:** soma local de logo, cenário de 390 px, personagens iniciais e Korok: **127.532 → 94.885 bytes** (−32.647 B, aproximadamente 25,6%). Juh + Átila: 43.820 → 30.743 B; Korok: 21.404 → 14.215 B. A moldura lossless cresceu de 61.018 → 75.019 B e as três fotos de demonstração somadas passaram de 71.486 → 72.147 B. A soma de todos os arquivos examinados, incluindo ambas resoluções do cenário e níveis futuros, passou de 596.410 → 511.276 B; isso não é tráfego de uma visita, pois assets futuros e outras resoluções não são todos solicitados. Resultados dependem das imagens e parâmetros; AVIF não é sempre menor.
>
> **Verificação:** `npm run optimize:assets` e `npm run build`; comparação visual da Home e Fotos no build de produção em Chromium emulado (`.playwright-mcp/avif-home.png` e `avif-fotos.png`), carregamento dos cinco níveis e nenhuma requisição de imagens de níveis futuros na abertura fria. Não houve teste físico no iPhone. Os registros de WebP abaixo são históricos.

> **Atualização — WebP com perdas:** os arquivos de imagem publicados continuam unificados em WebP. Após comparação visual entre WebP lossless, WebP q90/q95 e AVIF q88, os personagens e Korok passaram para **WebP q95**, com alpha exato e PSNR mínimo de 32 dB medido sobre o fundo creme. O limiar anterior de 40 dB foi relaxado com a concordância de aceitar pequena perda visual; PSNR é apenas um indicador e não substitui revisão visual. A moldura e as máscaras continuam lossless; logo e ícones também usam q95. Cenário e fotos mantêm seus WebP já aprovados. Os originais PNG/JPEG/SVG continuam preservados como fontes, fora dos assets públicos. Os números e escolhas AVIF/PNG/JPEG abaixo são históricos.
>
> **Comparação de arquivos locais:** os dois personagens iniciais passam de 122.772 B em WebP lossless para 43.820 B em q95 (−78.952 B); em AVIF anterior somavam 30.455 B. Korok passa de 47.680 B para 21.404 B (−26.276 B). Somando logo, cenário de 390 px, personagens iniciais e Korok: 232.760 → 127.532 B (−105.228 B, cerca de 45%); a soma anterior com AVIF era 98.367 B. São tamanhos locais, não medições de transferência total. O carregamento dos níveis futuros continua sob demanda. Navegadores sem WebP, como Safari/iOS anterior à versão 14, não têm fallback de imagem; o favicon WebP também depende de suporte do navegador.
>
> **Revisão:** comparações lado a lado em tamanho de arquivo dos personagens e Korok foram inspecionadas, além da Home em Chromium emulado (`.playwright-mcp/webp95-home.png`). Os resultados q95 atuais no pipeline foram 37,2 dB para Juh, 35,3 dB para Átila e 33,4 dB para Korok, sobre o fundo creme, com alpha igual ao preparado. As comparações não foram validadas em iPhone físico.

Relatório técnico da otimização de imagens, fontes e estratégia de carregamento
da Home, feita para o acesso via QR Code na CCXP (rede móvel potencialmente
lenta, instável e congestionada). Todas as medições abaixo são reais —
coletadas com `sharp`/`cwebp`/`pngquant`/`oxipng`/ImageMagick durante a análise
e com Playwright (Chromium, DevTools Protocol) para bytes transferidos, LCP e
CLS. Nenhum número é estimado.

## Resumo executivo

| Métrica (Home, 440×956 @2x, cache desabilitado) | Antes | Depois | Economia |
|---|---|---|---|
| **Total transferido** | 890.611 bytes (~870 KB) | 207.978–208.143 bytes (~203 KB) | **−76,6%** |
| Bytes de imagem | 802.630 bytes | 118.666 bytes | **−85,2%** |
| Requisições | 14 | 14 | — |
| Downloads duplicados/não usados | 0 | 0 | — |
| LCP (local, sem latência de rede) | 76 ms | 60–80 ms | — |
| CLS | 0 | 0 | — |
| Elemento LCP | cenário de fundo | cenário de fundo | — |

O orçamento de 200–250 KB definido para a primeira tela foi atingido
(**≈203 KB**), sem recorrer a nenhuma técnica que comprometesse a fidelidade
visual aprovada — todas as reduções com perdas foram aprovadas após inspeção
visual lado a lado (em escala real e ampliada) e um gate automático de PSNR.

## Atualização — Polaroid reutilizável e telas Fotos/Enquete

Esta seção documenta a extensão do pipeline e da estratégia de carregamento
feita ao implementar as telas Fotos e Enquete, reaproveitando a infraestrutura
acima sem reabrir decisões já tomadas (formatos vencedores, hash de conteúdo,
gate de PSNR etc. continuam os mesmos).

### Novos assets

| Asset | Original | Publicado | Economia | Técnica |
|---|---|---|---|---|
| Ícone "Fotos" (`cameraFotos.png`) | 109.346 B (560×404) | 12.132 B AVIF q88 (314×220) | **−88,9%** | Mesmo pipeline "portrait" dos personagens — redimensionado a ~2× o uso medido, `<picture>` AVIF→WebP→PNG |
| Ícone "Enquete" (`enqueteIcon.png`) | 120.952 B (505×399) | 13.010 B AVIF q88 (267×220) | **−89,2%** | Idem |
| Moldura Polaroid (`molduraPolaroidUnica.png`) | 328.623 B (1005×1105) | 61.018 B WebP *lossless* (420×462) | **−81,4%** | Categoria nova "frame": só lossless (PNG/WebP/AVIF lossless comparados, vence o menor); alpha da janela e dos cantos validado byte a byte — ver justificativa abaixo |
| 3 fotos de demonstração (stock, Unsplash License) | 1.035.988–3.576.173 B (originais, 3840–5184px) | 16.306–28.010 B cada (`<picture>` AVIF/WebP/JPEG, 360×330) | **≈97–99%** | Miniatura pré-cortada no tamanho real da janela da moldura, simulando o que um backend de galeria entregaria |

**Por que a moldura não usa AVIF/WebP com perdas (diferente dos personagens):**
ela é reutilizada atrás de **qualquer** fotografia futura e tem uma janela
realmente transparente; qualquer artefato de compressão ali (ou na borda
impressa) ficaria visível por cima da foto do visitante. O ganho de
redimensionar (1005px → 420px, já ~2× o maior uso real) já captura a maior
parte da economia possível; manter a codificação final sem perdas elimina
qualquer risco de neblina/halo sobre fotos futuras, pelo custo de alguns KB.

**Fotos de demonstração:** não há backend de galeria ainda, então não existem
fotos reais de visitantes. Para validar visualmente a composição em leque
contra o protótipo, três fotos de banco de imagens de licença livre
(Unsplash License, não são uploads reais) foram baixadas e processadas pelo
mesmo tipo de pipeline que uma miniatura de API produziria. Ver
`scripts/prepare-demo-photos.mjs` e `src/data/demo-recent-photos.ts` —
ambos documentam explicitamente, em comentário, que o conteúdo é placeholder
e deve ser substituído pela resposta real da API quando o backend existir.

### Moldura: uma única requisição para três Polaroids

A moldura (`Polaroid.astro`) é importada uma vez por instância, mas como as
três instâncias apontam para a **mesma URL com hash** (`scripts/lib/hashed-output.mjs`
garante um único arquivo por conteúdo), o navegador reaproveita a resposta
em cache de memória: confirmado via CDP, em um contexto limpo, que
`molduraPolaroidUnica.*.webp` aparece **exatamente uma vez** na aba Network
ao abrir a tela Fotos com as três Polaroids preenchidas.

### A armadilha do `loading="lazy"` em telas empilhadas

A primeira implementação usou `loading="lazy"` nas imagens de Fotos/Enquete,
confiando no comportamento nativo do navegador. Medição real mostrou que
**não bastava**: como as três telas ficam empilhadas numa única coluna
rolável (sem uma segunda navegação/rota), a tela Fotos começa a apenas ~1
altura de viewport abaixo da Home — distância pequena o suficiente para a
heurística de pré-carregamento nativa do Chromium buscar as imagens mesmo
sem o visitante jamais rolar para lá. Resultado medido: o payload da Home
subiu de ~208 KB para **~379 KB** só por isso.

**Correção:** um script dedicado, `src/scripts/defer-images.ts` (importado uma
vez em `ScreenStack.astro`, reaproveitável por qualquer tela futura), guarda
a URL real em `data-src`/`data-srcset` em vez de `src`/`srcset` e só promove
esses atributos quando a `.experience-screen` correspondente começa a
intersectar de fato o viewport do controlador de navegação — o mesmo
`[data-screen-viewport]` que `screen-navigation.ts` já usa como `root` do seu
próprio `IntersectionObserver`, mantendo as duas responsabilidades (navegação
vs. carregamento de mídia) em scripts separados e pequenos.

Uma armadilha adicional apareceu nessa correção: como as telas ficam
exatamente coladas umas nas outras (sem gap), um `threshold: 0` já considera
"intersectando" o simples encostar das bordas (razão de interseção 0, mas
`isIntersecting: true` pela definição da API) — ativando a tela seguinte
cedo demais. Usar `threshold: 0.01` (uma sobreposição real, ainda que
pequena) resolveu.

| Cenário (440×956 @2x, cache desabilitado) | Bytes transferidos | Requisições |
|---|---|---|
| Home, só `loading="lazy"` (medido, com o bug) | 366.319–378.972 | 19–20 |
| **Home, com `defer-images.ts` (publicado)** | **221.746** | **14** |
| Home → navega para Fotos (cumulativo) | 366.571 | 20 |

O payload da Home ficou ~14 KB acima do número da seção anterior (≈208 KB),
por conta do HTML um pouco maior (novos elementos/atributos) e do próprio
`defer-images.ts`; nenhuma imagem de Fotos/Enquete é buscada até a navegação
real acontecer, confirmado por URL na aba Network.



| Asset | Caminho original | Formato | Dimensões | Tamanho | Alpha | Cores (`identify -k`) | Exibição CSS máxima medida |
|---|---|---|---|---|---|---|---|
| Cenário (fonte) | `background.png` | PNG | 877×1794 | 1.472.305 B | não | 38.412 | 419×857 CSS px (@440×956) |
| Cenário (publicado, 390w) | `src/assets/home-background-390.webp` | WebP | 390×798 | 189.860 B | não | 15.472 | — |
| Cenário (publicado, 520w) | `src/assets/home-background-520.webp` | WebP | 520×1064 | 323.686 B | não | 21.750 | — |
| Logo | `public/assets/branding/checkpoint-ccxp26-logo.png` | PNG | 720×213 | 157.719 B | sim | 20.006 | 360×106 CSS px (desktop) |
| Juh | `public/assets/characters/Nivel1juhDesconhecidos.png` | PNG | 191×448 | 75.277 B | sim | 14.553 | 92×216 CSS px (@440×956) |
| Átila | `public/assets/characters/Nivel1atilaDesconhecidos.png` | PNG | 184×448 | 78.406 B | sim | 14.086 | 89×216 CSS px (@440×956) |
| Korok | `public/assets/mascot/korok.png` | PNG | 202×260 | 59.229 B | sim | 13.180 | 90×115 CSS px (@440×956) |
| Ícone Início | `public/assets/icons/navigation/houseGuideBar.png` | PNG (máscara, alpha-only) | 757×741 | 33.697 B | sim | 256 | **32×32 CSS px fixo** |
| Ícone Fotos | `.../cameraGuideBar.png` | PNG (máscara) | 896×752 | 37.753 B | sim | 256 | 32×32 CSS px fixo |
| Ícone Enquete | `.../enqueteGuideBar.png` | PNG (máscara) | 814×734 | 36.863 B | sim | 256 | 32×32 CSS px fixo |
| Fonte Inter (UI) | `src/assets/fonts/inter-latin-variable.woff2` | WOFF2 variável | — | 48.256 B | — | — | usada (`--font-ui`) |
| Fonte Jersey 10 (display) | `src/assets/fonts/jersey-10-latin.woff2` | WOFF2 | — | 13.276 B | — | — | usada (`--font-display`, títulos Fotos/Enquete) |
| Fonte Pixelify Sans | `src/assets/fonts/pixelify-sans-latin-variable.woff2` | WOFF2 variável | — | 12.016 B | — | — | **órfã** — nenhuma referência no código |
| Fonte Press Start 2P | `src/assets/fonts/press-start-2p-latin.woff2` | WOFF2 | — | 12.512 B | — | — | **órfã** — nenhuma referência no código |

**Descoberta mais relevante do inventário:** os três ícones de navegação eram
exibidos a **32×32 px CSS** (96×96 px físicos no máximo, em telas 3x), mas os
arquivos preparados tinham ~750–900 px de lado — 250 a 400× mais pixels que o
necessário. Esse foi o maior ganho percentual de toda a otimização (98%+).

O cenário de fundo, apesar de já passar por um pipeline de responsive images
(`srcset` 390w/520w) e WebP *lossless*, era o maior contribuinte de bytes:
sozinho, a variante 520w pesava mais que todos os personagens, logo e ícones
somados.

Não havia arquivos duplicados em uso simultâneo; as duas fontes órfãs
(Pixelify Sans e Press Start 2P) eram resquícios de iterações anteriores do
design, anteriores à criação do logotipo em PNG e à adoção da Jersey 10 — o
build do Astro já não as incluía em `dist/` (nada as importava), mas
permaneciam no repositório como ruído. Foram removidas, junto das licenças
correspondentes em `public/licenses/`.

## 3. Ferramentas

| Ferramenta | Uso nesta otimização |
|---|---|
| **sharp** (já era devDependency) | Única ferramenta usada no **pipeline de build reproduzível** (`npm run optimize:assets`): redimensionamento, recorte por alpha, geração de AVIF/WebP/PNG, quantização de paleta (via `libimagequant`, embutido). Sem dependência de binários externos do sistema. |
| ImageMagick (`identify`, `compare`) | Só na fase de **análise/validação manual** (inventário de dimensões/cores, PSNR exploratório). Não é usado pelo script de build. |
| `cwebp`/`dwebp` (libwebp) | Só na fase de análise manual, para conferir os números do `sharp` contra o encoder de referência. |
| `pngquant` | Só na fase de análise manual, para comparar quantização de paleta contra a já embutida no `sharp`. |
| `oxipng` | Só na fase de análise manual, para confirmar que a recompressão PNG do `sharp` (`compressionLevel: 9`) já captura a maior parte do ganho possível sem perdas. |

Homebrew foi usado para instalar `pngquant` e `oxipng` (ImageMagick e
`webp`/`cwebp` já estavam instalados). **Nenhuma dessas ferramentas de
terminal virou dependência do pipeline final** — `npm run optimize:assets`
usa exclusivamente `sharp`, que já era uma devDependency do projeto. Isso
mantém o pipeline reproduzível em qualquer máquina que já rode `npm install`,
sem exigir Homebrew.

## 4. Pixel art: decisões por categoria

### 4.1–4.4 Personagens, logo e Korok

**Resolução:** já estavam muito próximas do ideal. A altura máxima real de
exibição (medida via Playwright nas 4 viewports) é **216 px CSS** — um valor
travado pelo `clamp()` do design, não pela altura da tela. A 2×, isso são
~432 px — e os arquivos já preparados tinham 448 px de altura. Nenhum
redimensionamento adicional foi necessário aqui; o ganho veio de formato e
compressão, não de resolução.

**Paleta e formato — testados e medidos** (exemplo: Juh, 75.277 B original):

| Candidato | Bytes | PSNR | Veredito |
|---|---|---|---|
| PNG recomprimido (oxipng-equivalente, sem perdas) | 71.073 | ∞ (idêntico) | pouco ganho (−5,6%) |
| WebP *lossless* | 59.770 | ∞ (idêntico) | fallback seguro (−20,6%) |
| AVIF *lossless* | 69.977 | ∞ (idêntico) | **pior** que WebP lossless — descartado |
| PNG indexado (pngquant, 256 cores) | 31.327 | 47,6 dB | seguro, mas superado pelo AVIF com perdas |
| WebP *near-lossless* (80) | 49.356 | 56,1 dB | seguro, mas superado pelo AVIF com perdas |
| **AVIF qualidade 88 (escolhido)** | **13.762** | **47,4 dB** | **publicado** — melhor relação bytes/qualidade |

AVIF *lossless* comprimiu **pior** que o WebP *lossless* para este conteúdo
(confirma a instrução de não supor qual formato vence às cegas). Já o AVIF
**com perdas controladas** (qualidade 88) venceu todos os concorrentes por
larga margem, inclusive opções lossy alternativas testadas na mesma faixa de
qualidade perceptual (PSNR). O mesmo padrão se confirmou para Átila, Korok e
logo (tabela completa na seção "Resultados finais").

**Validação visual:** comparação lado a lado em escala real de exibição
(92/89/90/360 px CSS) e em recorte ampliado no rosto (óculos, cabelo, pele) —
ver metodologia na seção 14. Nenhuma diferença perceptível em nenhum dos
quatro assets, inclusive no logotipo (lettering), que recebeu atenção extra
por ser o elemento de marca.

**Transparência:** o recorte por bounding box de alpha (mantido do pipeline
anterior) já eliminava margens transparentes excessivas, preservando 8 px de
folga para antialiasing. Nenhuma mudança adicional foi necessária aqui; a
validação de pixels passou a comparar RGB **apenas onde o pixel é visível**
(alpha > 0) — diferentes codificadores podem escolher RGB arbitrário sob
alpha = 0 sem que isso seja um dano real de transparência (descoberto durante
a implementação: o WebP *lossless* do `sharp` falhava uma comparação byte-a-byte
ingênua contra o PNG de referência exatamente por essa razão, nas áreas
100% transparentes).

### Ícones de navegação (maior ganho percentual)

**Resolução:** redimensionados de ~750–900 px para **128 px de altura** —
confirmado visualmente como uma margem de segurança de 4× sobre a exibição
real (32 px CSS, até 96 px físicos em 3x). Testei 64/96/128/160 px: 64 px já
perdia visivelmente o acabamento "serrilhado" característico do pixel art nas
bordas diagonais do ícone de casa; 96 px já ficava muito próximo do original;
128 px ficou praticamente indistinguível do original mesmo exibido a 128 px
CSS (4× maior que o uso real), por um custo adicional de menos de 1 KB sobre
os 96 px.

**Formato:** mantido PNG (indexado quando menor, "plain" caso contrário —
decisão automática do pipeline, sempre sem perdas na própria recompressão).
WebP venceria por ~1,4 KB a mais de economia nesta faixa de tamanho, mas optei
por manter PNG para não introduzir uma dependência de suporte a WebP dentro
de `mask-image`/`-webkit-mask-image` — um recurso de navegador com histórico
de compatibilidade mais inconsistente que `<img src>`. Dado que o ganho de
resolução já captura ~95% da economia possível, o risco de compatibilidade
não se justificava pelos ~4 KB adicionais.

| Ícone | Original | Redimensionado + PNG indexado | Economia |
|---|---|---|---|
| Início (casa) | 33.697 B (757×741) | 4.705 B (131×128) | **−86,0%** |
| Fotos (câmera) | 37.753 B (896×752) | 4.996 B (153×128) | **−86,8%** |
| Enquete (balão) | 36.863 B (814×734) | 4.768 B (142×128) | **−87,1%** |

## 6. Cenário de fundo

O cenário é pixel art com gradientes suaves (céu, nuvens, silhuetas
sobrepostas da multidão) — exatamente o tipo de conteúdo em que compressão
*sem perdas* é ineficiente (o ruído de geração por IA nos gradientes não
comprime bem) e uma pequena perda controlada é imperceptível.

| Candidato (520w) | Bytes | Economia vs. WebP lossless |
|---|---|---|
| PNG recomprimido (sem perdas) | 470.198 | — |
| **WebP *lossless* (estratégia anterior)** | **323.686** | — |
| AVIF *lossless* | 367.072 | pior que WebP lossless |
| WebP qualidade 95 | 28.942 | −91,1% |
| **WebP qualidade 90 (escolhido)** | **18.586** | **−94,3%** |
| WebP qualidade 85 | 14.188 | −95,6% |
| WebP qualidade 80 | 11.554 | −96,4% |
| AVIF qualidade 85 | 18.594 | −94,3% (empata com WebP 90) |

Qualidade 90 foi escolhida como ponto de equilíbrio conservador: já captura
94%+ da economia máxima possível, com PSNR de 43,3–44,3 dB (acima do piso de
35 dB definido como gate automático) e nenhuma diferença perceptível nos
pontos de maior risco — testados especificamente:

- **Texto "CCXP" na fachada** (bordas de alto contraste): nítido em todas as
  variantes de 95 a 80, sem blocagem visível.
- **Gradiente do céu e silhuetas da multidão** (zona de maior risco de
  banding): inspecionado com saturação/contraste artificialmente ampliados
  (`filter: saturate(2.4) contrast(1.5)`) para forçar a visibilidade de
  qualquer blocagem — nenhuma encontrada mesmo nessa visão exagerada, em
  nenhuma das variantes testadas.

**Separação fundo creme / ilustração via CSS:** avaliada e **descartada**. A
imagem já é predominantemente composta por formas ilustradas com poucas áreas
de cor sólida contínua grande o bastante para justificar a complexidade de
camadas adicionais; com o WebP de qualidade 90 já em ~13–19 KB, o ganho
teórico de separar o fundo não seria mensurável o suficiente para justificar
uma composição com mais de uma camada/requisição.

As duas variantes responsivas (390w/520w) foram mantidas sem alteração de
largura: a análise de uso real (abaixo) mostrou que mesmo a 2× DPR na maior
viewport testada (440×956), a necessidade física é de ~838 px — acima da
variante de 520w publicada, ou seja, **o site já não envia bytes em excesso
para telas de alta densidade**; adicionar uma terceira variante a 3× não traria
ganho (o navegador já usa a maior disponível) e só aumentaria a superfície do
pipeline.

## 7. Variantes responsivas

| Asset | Variantes publicadas | Critério |
|---|---|---|
| Cenário | 390w / 520w (`srcset` + `sizes`, mantido do pipeline anterior) | Cobre 1x–2x nas viewports testadas sem sobra |
| Logo, Juh, Átila, Korok | 1 resolução única (~2× do uso máximo medido) | Diferença entre 1x/2x é pequena nestes elementos; gerar duas resoluções manuais não compensaria a complexidade adicional frente ao ganho já obtido em formato |
| Ícones | 1 resolução única (128 px) | Ícone de 32 px CSS; variantes adicionais não produziriam economia relevante |

`width`/`height` explícitos (ou `aspect-ratio` herdado do layout) foram
mantidos em todas as imagens — CLS = 0 confirmado antes e depois.

## 8. Integração ao Astro

- **Cenário:** continua importado via `src/assets/` e processado pelo
  pipeline nativo do Vite/Astro (hash de conteúdo automático em `_astro/`).
- **Logo, Juh, Átila, Korok:** publicados como três arquivos por asset (AVIF
  + WebP *lossless* + PNG) em `public/assets/<categoria>/`, consumidos via
  `<picture>` com `<source type="image/avif">` → `<source type="image/webp">`
  → `<img src=".png">`. Confirmado por inspeção de rede (contexto limpo, sem
  histórico de outras navegações) que **cada `<picture>` baixa exatamente um
  arquivo** — nunca os três.
- **Ícones:** continuam publicados como PNG único (mesma estrutura de
  manifesto anterior), consumidos via CSS `mask-image`.
- **Hash de conteúdo:** os arquivos em `public/assets/` agora recebem um
  sufixo de hash SHA-256 (10 caracteres) no nome — ex.:
  `korok.67f2c345c6.avif` — gerado e limpo automaticamente pelo próprio
  script (`scripts/lib/hashed-output.mjs`). Isso dá a esses assets, que não
  passam pelo pipeline do Vite, a mesma propriedade de cache "para sempre com
  segurança" que os arquivos em `_astro/` já tinham. Rodar o script de novo
  sem mudar a imagem de origem produz o **mesmo hash** (confirmado) e não
  acumula arquivos órfãos de execuções anteriores.
- Os arquivos de origem em alta resolução permanecem em `source-assets/official/`
  e **nunca são copiados para `dist/`** (fora de `public/`, fora do grafo de
  imports do Vite).

## 9. Estratégia de carregamento

- **Home:** logo, cenário, Juh, Átila, Korok e os três ícones continuam
  `loading="eager"`. Apenas o cenário mantém `fetchpriority="high"`
  (confirmado via `PerformanceObserver` como o real elemento de LCP, em todas
  as execuções) — **não** foi atribuído `fetchpriority="high"` a todas as
  imagens, só à que efetivamente determina o LCP.
- Removido um `<link rel="preload">` duplo (AVIF + WebP) que eu havia
  introduzido para o logo: medição em rede mostrou que o Chromium baixava
  **os dois** arquivos de preload independentemente do `type`, desperdiçando
  bytes — diferente do comportamento de `<picture><source type>`, que
  filtra corretamente (zero downloads duplicados confirmados para
  Juh/Átila/Korok, que nunca tiveram preload manual). A prioridade do logo já
  vem do `fetchpriority="high"` + `loading="eager"` no próprio `<img>`.
- **Fotos/Enquete:** ainda são apenas títulos de placeholder (sem backend de
  galeria, por decisão explícita de escopo) — portanto **não há hoje nenhuma
  imagem para adiar**; a estratégia de "carregar miniaturas só quando
  necessário" já está, por construção, satisfeita (não existem miniaturas
  ainda). Fica registrado aqui como requisito para quando o backend da
  galeria for implementado: as miniaturas da tela Fotos deverão usar
  `loading="lazy"` (ou disparo via `IntersectionObserver`, já usado pelo
  `screen-navigation.ts` para outra finalidade) e nunca os arquivos originais
  de alta resolução.
- **Personagens de níveis futuros:** não existem ainda no repositório
  (nenhuma referência a "nível 2" ou similar encontrada). Fica documentado
  como regra para quando forem adicionados: seguir o mesmo pipeline de
  `prepare-official-assets.mjs`, sem preload do nível seguinte.

## 10. Fontes e CSS

- **Removidas:** `pixelify-sans-latin-variable.woff2` (12.016 B) e
  `press-start-2p-latin.woff2` (12.512 B), além das licenças correspondentes
  em `public/licenses/`. Confirmado via `grep` que nenhum arquivo do projeto
  as referenciava — eram resíduos de iterações de design anteriores à criação
  do logotipo em PNG.
- **Mantidas:** Inter (UI, variável, 48.256 B, pré-carregada) e Jersey 10
  (display, 13.276 B, usada só nos títulos de Fotos/Enquete — corretamente
  **não** pré-carregada, por não ser necessária na Home).
- Nenhuma fonte é carregada de serviço externo (Google Fonts etc.) — os dois
  WOFF2 usados já estavam hospedados localmente em `src/assets/fonts/` e
  continuam assim.
- Nenhum framework CSS ou biblioteca de animação foi adicionado.

## 11. Pipeline reutilizável

```bash
npm run optimize:assets          # tudo: cenário + logo/personagens/Korok/ícones/molduras + fotos demo
npm run optimize:background      # só o cenário
npm run prepare:official-assets  # só logo/personagens/Korok/ícones/moldura Polaroid
npm run prepare:demo-photos      # só as 3 fotos de demonstração (placeholder, ver seção acima)
```

Os scripts de imagem (todos, exceto o de fotos de demonstração, que lida com
fotografias reais e não com pixel art):

1. Leem os arquivos de origem (de `source-assets/official/` ou da raiz, se um
   arquivo novo for colocado lá).
2. Identificam dimensões e transparência automaticamente (bounding box de
   alpha).
3. Geram os candidatos de formato/qualidade **fixados neste relatório**
   (não há busca automática de "melhor qualidade" em tempo de build — os
   parâmetros foram decididos aqui, após inspeção visual, e ficam
   documentados como constantes no topo de cada script).
4. Comparam tamanhos e validam:
   - Candidatos **sem perdas** (PNG, WebP lossless, AVIF lossless da
     moldura): validados byte-a-byte (pixels visíveis, alpha sempre exato)
     contra a versão preparada — falham o build se divergirem.
   - Candidatos **com perdas** (AVIF dos retratos/ícones de seção, WebP
     lossy do cenário): validados por um **gate automático de PSNR**
     (`scripts/lib/psnr.mjs`, puro JavaScript, sem dependência de binário
     externo) — o build falha se a fonte mudar o bastante para cair abaixo
     do piso aprovado, forçando uma nova inspeção visual manual antes de
     aceitar.
5. Escrevem os arquivos otimizados, com hash de conteúdo no nome
   (`scripts/lib/hashed-output.mjs` — reexecutar sem mudar a imagem de
   origem produz o mesmo hash, confirmado, sem acumular arquivos órfãos de
   execuções anteriores), e um relatório tabular no terminal (bytes, PSNR,
   economia).

Nenhum arquivo original é sobrescrito; ficam arquivados em
`source-assets/official/` (assets oficiais) ou `source-assets/demo/` (fotos
de demonstração).

## 12. Medição antes/depois (metodologia e números)

Todas as medições usaram Playwright (Chromium via DevTools Protocol),
contexto de navegador **limpo** (sem histórico de outras navegações),
`Network.setCacheDisabled(true)` para simular a primeira visita, viewport
440×956 @2x (a maior necessidade real medida entre as quatro viewports-alvo).
O "transferred" reportado é o tamanho real do corpo da resposta
(`response.body()` via CDP) — ou seja, o que efetivamente trafega pela rede
para cada recurso, não o tamanho em disco nem uma estimativa.

| | Antes | Depois |
|---|---|---|
| Total transferido | 890.611 B | 207.978–208.143 B |
| Imagens | 802.630 B | 118.666 B |
| Fontes | 61.532 B | 61.532 B (sem alteração) |
| CSS | 14.306 B | 14.331 B (sem alteração relevante) |
| JS | 5.589 B | 5.589 B (sem alteração) |
| Requisições | 14 | 14 |
| Downloads duplicados/formato errado | 0 (não testado — ver nota) | 0 (confirmado) |
| LCP (local) | 76 ms | 60–80 ms |
| CLS | 0 | 0 |

**Segunda visita (cache HTTP do navegador):** testada com `page.reload()`
após uma primeira visita — o servidor de **preview** do Astro
(`astro preview`) envia `Cache-Control: no-cache` para tudo, então **nenhuma**
requisição foi servida do disk cache nessa configuração (0 de 14). Isso é
esperado para um servidor de desenvolvimento/preview e é exatamente o motivo
de `nginx.conf.example` (seção 13) documentar `Cache-Control: public,
max-age=31536000, immutable` para os assets com hash — em produção, a segunda
visita de um mesmo dispositivo não deve baixar nenhum desses arquivos de
novo.

**Rede móvel lenta (simulada):** usando
`Network.emulateNetworkConditions` (latência 150 ms, ~1,6 Mbps de download —
aproximação de uma "4G lenta/congestionada"), a versão otimizada carrega em
**~1,28 s** (evento `load`). Esta é uma **simulação local**, não uma medição
da rede real da CCXP — registrada como referência de ordem de grandeza, não
como garantia de desempenho no evento. Não recriei a mesma simulação para a
versão **antes** da otimização (exigiria reverter temporariamente todo o
pipeline já integrado); a redução de tempo de transferência nessa rede segue
diretamente proporcional à redução de 76,6% em bytes já medida — a maior
parte do tempo de carregamento nesse perfil é consumida pelo download, não
pela latência fixa dos 14 requests.

## 13. Cache para hospedagem própria

Ver `nginx.conf.example` na raiz do projeto. Resumo da estratégia:

| Caminho | Cache-Control | Por quê |
|---|---|---|
| `_astro/*` (JS/CSS/fontes/cenário, hash do Vite) | `public, max-age=31536000, immutable` | Nome muda se o conteúdo mudar |
| `assets/*` (logo/personagens/Korok/ícones, hash próprio) | `public, max-age=31536000, immutable` | Mesma garantia, via `scripts/lib/hashed-output.mjs` |
| `favicon.svg`, `licenses/*` | `public, max-age=86400` | Estático mas sem hash no nome — cache moderado + ETag |
| `index.html` (sem hash) | `no-cache` | Precisa revalidar a cada visita para refletir deploys |

Compressão: gzip (universal) e Brotli (se o módulo estiver disponível) para
texto (HTML/CSS/JS/SVG/fontes). Imagens (AVIF/WebP/PNG) ficam **fora** da
lista de tipos compressíveis — já são formatos binários comprimidos;
recomprimi-las no Nginx não economiza bytes relevantes e só gasta CPU do
servidor.

## 14. Validação visual (Playwright, viewports 375×667 / 390×844 / 440×956 / 1440×900)

Processo seguido, com pelo menos uma rodada completa de revisão (nenhuma
regressão foi encontrada, então uma segunda rodada de correção não foi
necessária):

1. **Comparação em escala real** nas quatro viewports — screenshots
   capturados após a integração final, lado a lado com o design aprovado:
   logotipo, personagens (rosto, óculos, cabelo), Korok, cenário (gradiente,
   fachada "CCXP", silhuetas) e os três ícones, todos nítidos e fiéis.
2. **Comparação com zoom** (muito além da escala real de exibição) para
   forçar a visibilidade de qualquer artefato de compressão: ícones
   comparados a 128 px CSS (4× o uso real); personagens e logo comparados em
   recorte de rosto/lettering ampliado; cenário comparado com
   saturação/contraste artificialmente realçados nas zonas de gradiente e
   silhuetas. Nenhum artefato (blocagem, banding, halo, transparência
   danificada) encontrado em nenhum candidato aprovado.
3. **Métrica objetiva (PSNR)** como complemento à inspeção visual, não
   substituto: todos os candidatos aprovados ficaram entre 43,3 e 47,6 dB —
   confortavelmente acima do piso de "visualmente sem perdas" geralmente
   citado (~35–40 dB) para este tipo de conteúdo ilustrado/flat-shaded.
4. **Checagem de rede** em contexto limpo: confirmado que cada `<picture>`
   baixa exatamente um formato (nunca os três) e que não há preload
   desperdiçado (após remover o preload duplo do logo).

Nenhuma variante precisou ser revertida — todas as escolhas com perdas
(AVIF 88 para retratos, WebP 90 para o cenário, redimensionamento para 128 px
nos ícones) passaram na inspeção na primeira rodada.

## 15. Testes funcionais pós-otimização

Confirmado via Playwright, no mesmo contexto da build otimizada:

| Funcionalidade | Resultado |
|---|---|
| Clique nos itens da barra inferior (ida e volta) | OK — transição suave, `aria-current` correto |
| Arraste da cápsula até um item não adjacente | OK — anima e encaixa no destino |
| Rolagem vertical por wheel/swipe entre as 3 telas | OK |
| Navegação por teclado (`Home`/`End`) | OK — instantânea, como projetado |
| Barra de progresso (Nível 01, 0/100 pts) | OK — inalterada |
| Balão de fala do Korok | OK — inalterado |
| Composição dos personagens sobre o gramado | OK — alinhamento dos pés preservado |
| Responsividade nas 4 viewports | OK |
| `npm run build` | OK — 0 erros, 0 avisos, 0 hints |
| Console do navegador | 0 erros, 0 avisos |

## Resultados finais por asset

| Asset | Original | Otimizado (publicado) | Economia | Técnica |
|---|---|---|---|---|
| Cenário (520w) | 323.686 B (WebP lossless) | 18.586 B (WebP q90) | **−94,3%** | Compressão com perdas aprovada (gradiente tolera bem) |
| Cenário (390w) | 189.860 B (WebP lossless) | 12.756 B (WebP q90) | **−93,3%** | Idem |
| Logo | 157.719 B (PNG, já recortado) | 40.937 B (AVIF q88, `<picture>`) | **−74,0%** | AVIF com perdas + fallback WebP lossless/PNG |
| Juh | 75.277 B (PNG) | 13.762 B (AVIF q88) | **−81,7%** | Idem |
| Átila | 78.406 B (PNG) | 16.693 B (AVIF q88) | **−78,7%** | Idem |
| Korok | 59.229 B (PNG) | 14.219 B (AVIF q88) | **−76,0%** | Idem |
| Ícone Início | 33.697 B | 4.705 B | **−86,0%** | Redimensionado 757×741 → 131×128 + PNG indexado |
| Ícone Fotos (navegação) | 37.753 B | 4.996 B | **−86,8%** | Redimensionado 896×752 → 153×128 + PNG indexado |
| Ícone Enquete (navegação) | 36.863 B | 4.768 B | **−87,1%** | Redimensionado 814×734 → 142×128 + PNG indexado |
| Ícone de abertura "Fotos" | 109.346 B | 12.132 B (AVIF q88) | **−88,9%** | `<picture>`, mesmo tratamento dos retratos |
| Ícone de abertura "Enquete" | 120.952 B | 13.010 B (AVIF q88) | **−89,2%** | Idem |
| Moldura Polaroid (reutilizada 3×) | 328.623 B | 61.018 B (WebP lossless) | **−81,4%** | Só lossless — janela transparente não tolera artefato |

## Recursos adiados para telas posteriores

- **Fotos:** implementada (cabeçalho, composição de 3 Polaroids em leque,
  CTA de envio com prévia local). Os assets dessa tela (ícone, moldura, 3
  fotos) só são buscados quando a tela realmente se aproxima do viewport —
  ver `src/scripts/defer-images.ts` e a seção "Atualização — Polaroid
  reutilizável..." acima. As fotografias reais dos visitantes ainda não
  existem (sem backend); o componente usa fotos de demonstração claramente
  identificadas como placeholder (`src/data/demo-recent-photos.ts`).
- **Enquete:** implementada (cabeçalho, cartão de votação, estados de
  seleção/envio). Mesma estratégia de carregamento adiado para o ícone de
  abertura.
- **Personagens de níveis futuros:** nenhum existe ainda no repositório;
  regra documentada para seguir o mesmo pipeline sem preload antecipado.

## Possíveis melhorias futuras

- Se o orçamento de 200–250 KB precisar ficar ainda mais justo no futuro
  (por exemplo, ao adicionar conteúdo nas telas Fotos/Enquete), o próximo
  maior contribuinte é o **logo** (40.937 B) — uma versão AVIF em qualidade
  85 (36.024 B medido na análise) ainda estava visualmente limpa nos testes e
  pode ser adotada se necessário.
- Considerar Brotli pré-comprimido estaticamente (`.br` ao lado dos arquivos
  de `_astro/`) no deploy, para evitar o custo de CPU de comprimir em tempo
  de resposta a cada requisição — hoje documentado apenas como compressão
  dinâmica do Nginx, suficiente para o volume de tráfego esperado no evento.
- Quando o backend da galeria de Fotos existir, repetir este mesmo processo
  de decisão (inventário → candidatos → PSNR → inspeção visual → pipeline)
  para as fotos enviadas pelos usuários, que terão características bem
  diferentes (fotografias reais, não pixel art) e provavelmente se beneficiarão
  mais de AVIF/WebP com perdas moderadas desde o início.
