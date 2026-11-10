# Checkpoint CCXP26

> **Versão beta:** o frontend Astro consome a API ASP.NET Core para participação, votos, resultados, progresso comunitário e fotos. Consulte `INTEGRATION_STATUS.md` para o resumo de validação e limitações conhecidas.

Para desenvolvimento, configure a URL acessível pelo **navegador** antes de iniciar o Astro, por exemplo `PUBLIC_API_URL=http://127.0.0.1:8080 npm run dev`, ou copie `.env.example` para `.env`. Em um celular, `127.0.0.1` é o próprio aparelho: use o endereço de rede acessível do computador e configure o servidor da API e o firewall de acordo. Produção requer HTTPS e origem explícita em `Cors:Origins`; não exponha o PostgreSQL. A variável é incorporada ao build estático, portanto configure-a também ao executar `npm run build`.

Sem ajuste de enquadramento, o upload envia o arquivo original. Ao arrastar a foto, o navegador gera um recorte em PNG ou JPEG para envio; o suporte à prévia depende do navegador, e HEIC pode ser enviado como original mesmo quando a prévia não abre. O backend valida formatos e processa a foto. Artes futuras permanecem nos arquivos-fonte e em cópias já distribuídas, mas são excluídas do build estático atual; repositórios públicos ainda podem revelá-las.

Experiência estática em **Astro + TypeScript + CSS nativo**, com três telas verticais: **Início → Enquete → Fotos**. O build produz HTML/CSS/JS estáticos; as ações e os dados da comunidade são carregados em runtime pela API.

**Fonte de verdade:** [`design.markdown`](./design.markdown), revisão 2.5, e [`prototipo3Paginas.png`](./prototipo3Paginas.png). A marca, o casal, Korok e os ícones agora usam os PNGs oficiais fornecidos.

## Executar e gerar produção

Configure `PUBLIC_API_URL` para o endereço de API que o navegador consegue alcançar. Para desenvolvimento local, use `PUBLIC_API_URL=http://127.0.0.1:8080 npm run dev`. Em celular, `127.0.0.1` é o próprio aparelho; use o endereço de rede do computador. Em produção, use HTTPS e configure uma origem explícita em `Cors:Origins` no backend. O valor de `PUBLIC_API_URL` é incorporado ao build.

Requisitos: Node.js **22.23.4+** (recomendado: Node 24 LTS) e npm **9.6.5+**.

```sh
npm ci
npm run dev
```

Abra `http://localhost:4321`. Para verificar e revisar a produção:

```sh
npm run build
npm run preview
```

`build` verifica Astro/TypeScript e gera **um único documento estático**, `dist/index.html`, com as três telas. `npm run check` executa apenas a verificação. Node.js não é necessário no servidor de produção.

## Estrutura

```text
src/
  assets/
    fonts/                         # WOFF2 locais
    home-background-{390,520}.webp
    official-assets.json           # URLs e dimensões dos PNGs preparados
  components/
    HomeHero.astro                 # Marca, cenário, balão, progresso e orientação
    ExperienceProgress.astro       # Nível/pontos em Inter e progress nativo
    ScreenStack.astro              # Shell 100dvh, snap e scrollports internos
    BottomNavigation.astro         # Três links e máscaras dos PNGs oficiais
  scripts/screen-navigation.ts     # Gestos, teclado e estado ativo da navegação
  layouts/BaseLayout.astro         # HTML, metadados, preload do logo PNG e Inter
  pages/index.astro                # Composição das três telas e valores iniciais
  styles/
    tokens.css                     # Paleta, tipografia, espaços e geometria
    global.css                     # Base e fontes
public/
  assets/
    branding/                      # checkpoint-ccxp26-logo.png
    characters/                    # Sprites oficiais de Juh e Átila
    mascot/                        # korok.png
    icons/navigation/              # houseGuideBar, cameraGuideBar, enqueteGuideBar
  favicon.svg
  licenses/                        # Licenças SIL OFL
scripts/optimize-assets.mjs         # Otimização reproduzível do cenário
scripts/prepare-official-assets.mjs # Preparação dos sete PNGs oficiais
source-assets/official/             # Originais recebidos, fora de public/
```

Os originais `background.png` e `prototipo3Paginas.png` permanecem na raiz e não são publicados em `dist/`. Fontes históricas de comparação podem permanecer no código-fonte, mas somente **Inter e Jersey 10** são importadas e transferidas no runtime.

## Navegação

- O shell usa Grid com uma área de telas e uma faixa própria para a barra inferior. `100dvh` acompanha a altura útil; a barra respeita safe areas e nunca cobre o conteúdo.
- Cada tela ocupa toda a área acima da barra. O scrollport externo usa `scroll-snap-type: y mandatory`, e cada tela usa `scroll-snap-align: start` e `scroll-snap-stop: always`.
- CSS Snap foi testado sozinho e permitiu saltar duas telas com wheel forte/rajadas de trackpad. O controlador TypeScript complementa esse comportamento, sem bibliotecas e sem listeners de scroll pesados.
- Touch na área das telas: uma troca por gesto vertical com deslocamento de pelo menos 48px. Multitoque/pinch, gestos horizontais e edição de campos não são interceptados pelo controlador vertical.
- Wheel/trackpad: uma troca por sequência de eventos; uma pausa de 200ms delimita um novo gesto e absorve a cauda de inércia. Listeners não passivos estão restritos ao viewport das telas, nunca ao documento.
- Conteúdo interno rolável consome seu gesto. Chegar ao fim de um conteúdo não troca também a tela nesse mesmo gesto; uma nova intenção no limite pode navegar. Scrollports internos usam contenção de overscroll.
- Setas, PageUp/PageDown e espaço navegam quando não há conteúdo interno a rolar; Shift+espaço retorna, Home/End acessam os extremos. Campos de edição preservam as próprias teclas.
- Pela barra, o acesso é direto, sem animar através de telas intermediárias. Nas trocas adjacentes, o navegador faz a transição suave; com movimento reduzido, o alinhamento é imediato.
- A cápsula ativa é compartilhada e arrastável com touch, mouse ou caneta. Pointer capture mantém o acompanhamento, e a soltura seleciona/encaixa no item mais próximo. Durante o arraste, `aria-current` continua representando a tela real; a prévia só vira seleção ao soltar. Cancelamento e deslocamento curto retornam à seleção apropriada. O clique gerado depois de arrastar é suprimido para não selecionar novamente a origem.
- `IntersectionObserver` atualiza `aria-current` conforme a tela visível. Telas inativas usam `inert`; o foco é transferido quando necessário, sem rolar a tela. Resize preserva a tela ativa. Hashes `#inicio`, `#fotos` e `#enquete` permitem acesso direto.

### Conteúdo maior que a tela

Cada `.experience-screen` contém um `.screen-scroll` com `data-screen-scroll`, foco por teclado e `overflow: auto`. A Home cabe nas viewports solicitadas; zoom, orientação horizontal ou conteúdo futuro maior podem ativar essa rolagem interna. Não remover esse mecanismo nem esconder campos para forçar uma viewport.

## Composição visual

- **Logo PNG oficial** em `public/assets/branding/checkpoint-ccxp26-logo.png`, com seu próprio lettering e detalhes laterais. `<h1>` preservado com alt “Checkpoint CCXP26”; imagem prioritária, centralizada e proporcional. Subtítulo continua HTML independente. Jersey 10 foi removida da marca e do preload; permanece apenas porque os títulos Fotos/Enquete ainda a utilizam.
- **Inter** para nível, pontos, textos e navegação. `Yahaha!` usa Inter forte/itálica, expressiva e oliva.
- Sequência da Home: marca → subtítulo → cenário → progresso → balão → duas setas e “Role para participar”. Não há botão Explorar nem seção Sobre no fluxo principal.
- O balão usa HTML/CSS com cantos contínuos de 24px, contorno fino, ponta esquerda e sombra quente difusa. Korok está integrado à esquerda. A borda é contabilizada no padding aprovado para não gerar scroll residual.
- O progresso mantém `<progress>` com valor real, trilha de 20px, dez divisões decorativas e marcador circular de 22px, sem alteração nesta etapa. O marcador no início não representa pontos ganhos; o valor permanece zero. A cápsula mantém largura máxima 112px, agora com iluminação oliva sutil e sombra discreta.
- O refinamento eliminou a centralização vertical excedente do conjunto, reforçou CHECKPOINT em relação a CCXP26 e limitou o balão a 280px no desktop. Os gaps respondem à altura útil; não há padding inferior redundante que consuma o primeiro gesto como uma rolagem interna de poucos pixels.
- O cenário usa exclusivamente as versões proporcionais de `background.png`. A largura se adapta também à altura disponível. A imagem mantém sua proporção; somente a margem decorativa vazia é contida para não criar overflow. O conteúdo normal continua determinando a altura necessária para leitura.
- Sprites oficiais integrados: Juh à esquerda, Átila à direita, ambos ancorados ao gramado; Korok junto à ponta do balão. Os slots continuam disponíveis, com esses assets como conteúdo padrão. Não há geração de artes, recorte do protótipo ou lógica de níveis.
- Ícones oficiais PNG por `mask-image` e `-webkit-mask-image`, com alpha original: marrom inativo, claro ativo. Larguras ópticas 32/32/33px, respeitando proporção. Zero SVGs substitutos na barra; anel roxo somente em `:focus-visible`, nunca como estado ativo comum.

## Performance e assets

- SSG, sem frameworks hidratados, dependências de navegação, API, serviços externos em runtime ou animação contínua. O único JavaScript de aplicação é o controlador de navegação.
- Relatório técnico completo da otimização (inventário, candidatos testados, PSNR, bytes antes/depois, validação visual e funcional): **[`ASSET_OPTIMIZATION.md`](./ASSET_OPTIMIZATION.md)**. Resumo abaixo.
- Primeira abertura da Home (440×956 @2x, cache desabilitado, medido via Playwright/CDP): **890.611 → ~208.000 bytes transferidos (−76,6%)**, dentro do orçamento de 200–250 KB. 14 requisições antes e depois, zero downloads duplicados ou de formato não usado, LCP e CLS inalterados (elemento LCP é o cenário).
- Cenário: WebP **com perdas controladas** (qualidade 90), não mais lossless — testes mostraram que WebP/AVIF *lossless* comprimem muito mal este conteúdo (gradientes de céu/nuvens/multidão), enquanto uma pequena perda aprovada visualmente (PSNR 43–44dB) corta ~94% dos bytes da versão anterior. `srcset` 390/520px mantido.
- Logo, Juh, Átila e Korok: publicados como `<picture>` com três candidatos — **AVIF (qualidade 88, aprovado por inspeção visual + PSNR ≥40dB)** → WebP sem perdas (fallback) → PNG indexado/plano (fallback universal). O navegador baixa só um dos três (confirmado em rede).
- Ícones de navegação: redimensionados de ~750–900px para **128px** de altura (exibição real é 32px CSS, até 96px físicos em 3x — 128px dá margem de 4× confirmada visualmente), mantidos como PNG (compatibilidade de `mask-image`).
- Todos os assets publicados em `public/assets/` recebem um hash de conteúdo de 10 caracteres no nome (`scripts/lib/hashed-output.mjs`), igual à garantia que o Vite já dá aos arquivos em `_astro/`: permite `Cache-Control: immutable` sem risco de servir uma versão desatualizada.
- Fontes: Inter (UI, com preload) e Jersey 10 (display, só nos títulos de Fotos/Enquete, sem preload por não ser crítica na Home) — obtidas das distribuições oficiais do Google Fonts; o navegador do visitante não consulta esse serviço, e as licenças acompanham a saída em `dist/licenses/`. Pixelify Sans e Press Start 2P (órfãs desde a criação do logo em PNG) foram removidas do repositório.

Para gerar novamente os assets a partir dos originais autorizados:

```sh
npm run optimize:assets          # cenário + logo/personagens/Korok/ícones, em um só comando
npm run build
```

Os parâmetros de qualidade/resolução usados (AVIF 88, WebP 90, 128px para ícones etc.) são constantes documentadas no topo de cada script, decididas após inspeção visual — o pipeline não escolhe automaticamente uma nova qualidade sem essa revisão. Candidatos sem perdas são validados pixel a pixel; candidatos com perdas passam por um gate automático de PSNR (`scripts/lib/psnr.mjs`, JavaScript puro, sem dependência de binário externo) que falha o build se a fonte mudar demais, forçando nova inspeção visual antes de aceitar.

### Preparação dos PNGs oficiais

Os sete arquivos de origem (logo, Juh, Átila, Korok, 3 ícones) foram encontrados na raiz do Frontend; os originais íntegros ficam em `source-assets/official/` e nunca são copiados para `dist/`. O script identifica a área com alpha ≥8 e adiciona folga de 8px, sem limiarizar os pixels internos. Logo é limitado a 720px de largura, casal a 448px de altura e Korok a 260px (~2× do uso máximo medido); ícones são redimensionados a 128px de altura (ver acima). `npm run prepare:official-assets -- --inspect` inspeciona sem escrever/mover; adicione `--details` para comparar envelopes de alpha. Nenhuma dependência de runtime foi adicionada — o pipeline usa só `sharp`, já presente como devDependency.

## Hospedagem estática e cache

Copie todo o conteúdo de `dist/` para a raiz pública do domínio. `npm run preview` é somente para revisão local. Exemplo completo de configuração em **[`nginx.conf.example`](./nginx.conf.example)**.

Política recomendada no servidor HTTP existente:

- `/_astro/` e `/assets/`: `Cache-Control: public, max-age=31536000, immutable` — ambos têm hash de conteúdo no nome (Vite para o primeiro, `scripts/lib/hashed-output.mjs` para o segundo).
- HTML: `Cache-Control: no-cache`, com revalidação para buscar a versão atual.
- `favicon.svg` e `licenses/`: cache curto (1 dia) com revalidação — estáticos, mas sem hash no nome.
- Gzip/Brotli para HTML, CSS, JS e SVG; AVIF/WebP/PNG/WOFF2 já são comprimidos e ficam fora da lista de tipos compressíveis.
- Publicar HTML e assets de forma consistente; manter assets anteriores durante a troca se o deploy for incremental.

Cabeçalhos HTTP são responsabilidade do servidor. Não há CDN obrigatória, SSR, Service Worker ou servidor Node.js de produção.

## Integração e limitações

O progresso, as perguntas, as respostas e os resultados vêm da API. Uma resposta é registrada ao tocar numa opção; após a autorização, os resultados aparecem automaticamente. Sem ajuste de enquadramento, o upload envia o original; ao arrastar a imagem na prévia, o navegador prepara um recorte. O suporte à prévia depende do navegador; HEIC pode ser enviado como original mesmo quando não abre para prévia. Fotos recentes são públicas conforme as regras atuais do backend. Moderação, retenção e remoção administrativa devem ser definidas antes do evento.

## Validação da revisão de UX

- Build estático e verificação Astro/TypeScript sem erros, avisos ou hints; auditoria npm sem vulnerabilidades reportadas.
- Screenshots revisados contra a referência em **375×667, 390×844, 440×956 e 1440×900**. Home sem overflow horizontal e sem rolagem interna nas quatro; orientação de continuação acima da barra. Somente a Home fica visível quando parada.
- Logo, sprites e os três PNGs de máscara confirmados nos requests reais. Logo baixado uma única vez apesar do preload; nenhum SVG na navegação. Inter no nível e nos textos; sem chamadas externas.
- **CLS observado: 0** nos carregamentos locais das quatro viewports. Nenhuma falha de Network ou erro/aviso de console nos contextos de teste.
- Wheel forte e rajadas de trackpad: a revisão inicial somente com CSS saltava duas telas; com o controlador, avança uma e permanece alinhada. Testados também retorno, gestos touch por CDP, dois swipes rápidos, setas, PageDown, acesso direto à Enquete e deep link.
- Preferência de movimento reduzido: troca imediata. Resize mantém a tela selecionada. Telas inativas fora da ordem de foco; foco do scrollport desenhado para dentro, sem ficar cortado.
- Arraste/encaixe da cápsula testado com mouse e touch por CDP: acesso direto, retorno, arraste curto, cancelamento e ausência de troca vertical por gesto na barra. A cápsula termina alinhada ao item selecionado.
- Conteúdo alto e textarea inseridos temporariamente **apenas no navegador de teste**: rolagem/edição internas preservadas; não há troca de tela no mesmo gesto. Nenhum formulário de teste foi incluído no projeto.
- Viewports adicionais de 220×400 e 375×400: alternativa com rolagem interna, sem overflow horizontal; conteúdo final continua alcançável e não é coberto pela barra.

As medições de CLS acima são locais; não representam uma medição de Core Web Vitals no ambiente do evento.

As capturas e resultados da integração dos assets oficiais, seguidos do histórico das etapas anteriores, estão em [`VISUAL_REVIEW.md`](./VISUAL_REVIEW.md).
