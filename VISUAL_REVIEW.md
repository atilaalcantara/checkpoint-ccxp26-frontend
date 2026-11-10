# Relatório do loop de refinamento visual

> **Relatório histórico:** registra rodadas anteriores de revisão. A integração e as interações mais recentes estão descritas no README e no código atual.

## Correção defensiva — encaixe entre telas no iPhone

Relato: em um iPhone 16e, um arraste podia deixar a interface entre duas telas. A inspeção revelou uma causa plausível: um novo toque iniciado durante o encaixe era ignorado pelo controlador, permitindo à rolagem nativa disputar posição com a animação em curso. Não foi possível confirmar a causa exata no aparelho físico.

O novo toque interrompe o encaixe anterior e parte da posição corrente. Quando o navegador assume um evento de toque não cancelável, o controlador deixa a rolagem nativa seguir; após a rolagem ficar parada, uma verificação pontual alinha a tela mais próxima se necessário. Arrastes iniciados sobre botões também são reconhecidos, preservando o toque simples. A rolagem interna continua prioritária.

Playwright/Chromium com toque emulado: arraste curto e longo, ida/volta, cancelamento, novo gesto durante o encaixe, toque e arraste sobre alternativa, recuperação de posição intermediária forçada, resize durante gesto e movimento reduzido terminaram alinhados. Em 320×568, a primeira intenção rolou o conteúdo interno e a seguinte mudou de tela. Sem erros de página observados. Isso não substitui a verificação em Safari no iPhone 16e, especialmente com barras dinâmicas e gestos reais.

## Motion System v1.1 — diagnóstico e entradas

### A — defeito do progresso (corrigido antes das novas entradas)

Reproduzido por ida e volta com arraste em 393×852. Antes/depois, `opacity` do título, cartão e ancestrais continuava em 1, sem animações residuais. A diferença estava em `.scene-composition`: antes, `transform: none`; depois, matriz identidade deixada pelo parallax (`translateY(0px)`). Isso cria um contexto de empilhamento; o raster `.scene`, cujo trecho creme ultrapassa a caixa de composição, passava a cobrir o título/pontos do progresso. `elementsFromPoint` confirmou `.scene` à frente de `.level` somente após navegar. Não era um fill residual de opacity da WAAPI.

Correção: camadas explícitas e estáveis (cenário z=0, welcome z=1) e remoção da transformação inline quando o parallax volta a zero. Nenhum reset global de opacity. Capturas `.playwright-mcp/v11-home-before.png`, `v11-home-bug.png`, `v11-home-fixed-initial.png`, `v11-home-return-{1,5,10}.png`. Retornos 1/5/10 e arrastes com reversão/cancelamento conservaram opacity=1, transform estático e zero animações residuais no progresso. Comparação raw do recorte `v11-progress-first.png`/`v11-progress-return.png`: diferença máxima 1/255 por canal (arredondamento de rasterização), média 0,00361; sem perda de contraste relevante.

### B — troca direta e coreografias

O fade de 85+115 ms do viewport inteiro, chegando a opacity .18, produzia uma queda global de luminosidade em Fotos e se sobrepunha à entrada e à decodificação. Foi substituído por troca direta com deslocamento curto de 6 px/160 ms só do conteúdo, mantendo o viewport sempre em opacity=1. As entradas são disparadas depois da confirmação do destino, uma única vez por tela.

Implementado e testado uma tela de cada vez: Home (logo, Juh/Átila escalonados, progresso, Korok e balão), Enquete (ícone/títulos/pergunta/alternativas), Fotos (cabeçalho, abertura curta das laterais do leque, central em destaque e CTA). As imagens de Fotos não são ocultadas enquanto aguardam decode; callbacks são invalidados se a navegação muda. Ao terminar, transforms e opacity voltam ao CSS. Retornar a Fotos não repetiu nenhuma animação do leque.

Evidências: `v11-home-entry-middle.png`, `v11-enquete-entry-middle.png`, `v11-fotos-entry-middle.png`, `v11-fotos-final.png` e `v11-final-{inicio,enquete,fotos}.png` em `.playwright-mcp/`. Inspeção visual confirmada nesta sessão: `v11-home-bug.png` mostra o defeito (texto "Nível 01" e trilha de pontos completamente cobertos pela cauda roxa do cenário); `v11-final-inicio.png` e `v11-final-fotos.png` mostram a Home com o progresso totalmente legível e a tela de Fotos sem regressões visuais.

- **JavaScript de produção (v1.1):** soma dos arquivos únicos em `dist/_astro` após as correções e a coreografia de entrada: 16.434 → 18.491 bytes sem compressão; gzip calculado por arquivo, somado: 7.065 → 8.010 bytes (+2.057 B raw / +945 B gzip sobre o v1). Mesma ressalva: é tamanho calculado localmente, não transferência de rede medida. Nenhuma dependência nova.

### C — regressão e limitações

Playwright/Chromium: 320×568, 375×667, 390×844, 440×956 e 1440×900, sem overflow horizontal, alinhamento final correto e mesmos fallbacks internos prévios em 320×568. Testados alternância direta, retorno à Home durante a entrada de Fotos, interrupção por preferência reduzida, resize, reversão e cancelamento de gesto touch emulado. Durante arraste ainda não confirmado, a próxima tela não tinha coreografia ativa. Callback de visibilidade foi testado com mudança sintética de `document.hidden`/visibilitychange; troca real de aba e sensação tátil em Safari físico permanecem para validação no dispositivo. Seleção direta da Enquete continuou avançando. Sem erros de página observados na sessão fria de rede; Home buscou oito imagens, Fotos cinco adicionais, uma única moldura e nenhum asset novo.

## Motion System v1 — validação incremental

- **Gesto vertical:** substituído o disparo automático inicial por acompanhamento contínuo. Playwright/CDP touch emulado mediu 100 px de avanço e reversão para 30 px enquanto pressionado; arraste curto retornou a 0 e longo encaixou em 752 px (altura útil em 393×852). Suite adicional confirmou curto/lento, longo/lento, rápido, inversão, touchcancel, retorno Fotos→Enquete e limites Início/Fotos, todos alinhados ao final.
- **Navegação inferior:** amostras de opacity mostraram saída até .18 e entrada até 1; scrollTop saltou diretamente 0→1504 ao selecionar Fotos, sem passagem pela Enquete. Cápsula arrastável e teclado Home/End mantidos. Cancelamento de drag de imagem nativa foi impedido no viewport para preservar o gesto de mouse.
- **Home:** composição inteira recebe parallax proporcional de até 8 px; pés e gramado continuam juntos. Sem deslocamento em movimento reduzido.
- **Informações/prévia:** diálogo nativo com expansão a partir do ícone, Escape, overlay, botão e retorno de foco. Corrigido conflito de especificidade dos estilos antigos do popover quando seu conteúdo é movido para o modal. Prévia local expande e recolhe, sem simular upload. Fechar durante uma expansão reverte a animação em andamento.
- **Microinterações:** feedback de seleção antecede a troca da pergunta; Polaroids entram uma única vez, sem modificar os transforms de rotação individuais.
- **Responsividade:** 320×568, 360×740, 375×667, 390×844, 393×852, 440×956, 768×1024 e 1440×900; sem overflow horizontal, destinos alinhados e mesmos fallbacks internos anteriores. Em 320×568, um swipe rolou 60 px dentro da Home sem mover o scrollport externo. Resize mantém alinhamento e reduz movimento respeitado. JavaScript desabilitado: links e imagens noscript de Fotos disponíveis.
- **Evidências:** `.playwright-mcp/motion-drag-intermediate.png`, `motion-info-middle.png` e `motion-info-final.png`. Capturas são de Chromium emulado, não de Safari físico. Ainda requer avaliação tátil no iPhone: arbitragem de touchmove, barras dinâmicas, retorno do seletor nativo e estabilidade do parallax em pixel art.
- **JavaScript de produção:** soma dos arquivos únicos em `dist/_astro`: 10.353 → 16.434 bytes sem compressão; gzip calculado localmente por arquivo: 4.444 → 7.065 bytes (+2.621 B). Gzip é tamanho calculado, não transferência medida no servidor de preview. Nenhuma dependência adicionada. Abertura fria: apenas oito imagens da Home; seleção direta de Fotos buscou seus cinco assets e nenhuma ilustração da Enquete, com uma única moldura. Três aberturas/fechamentos consecutivos durante a expansão terminaram sem modal residual. Texto de Fotos ampliado a 200% por CSS manteve o CTA acessível por rolagem interna, sem overflow horizontal.

## Refinamento responsivo — evidência do iPhone 16e

Nas capturas fornecidas, Fotos mostrava o CTA cortado no limite da área rolável; ao rolar, o cabeçalho saía da área visível. A Enquete apresentava espaços excessivos. A barra inferior já ocupa sua própria linha no shell: as medições não indicaram reserva duplicada. Em 375×667, antes dos ajustes, Fotos ocupava 661 px e Enquete 626 px em uma área útil de 567 px.

Foram removidos a legenda complementar de Fotos e espaços decorativos excessivos; o ícone de seção e o leque agora respeitam também a altura disponível. A Enquete mantém suas opções lado a lado até a largura realmente estreita exigir empilhamento. Após os ajustes, Fotos e Enquete cabem na área útil de 375×667; em 320×568 ainda pode ser necessária rolagem interna. A Home foi preservada e também pode precisar de rolagem interna em alturas pequenas.

Playwright/Chromium: viewports 320×568, 360×740, 375×667, 390×844, 393×852, 414×896, 440×956, 768×1024 e 1440×900, sem overflow horizontal medido. Capturas de diagnóstico em `.playwright-mcp/responsive-before-{inicio,enquete,fotos}.png` e de comparação em `.playwright-mcp/responsive-after-{inicio,enquete,fotos}.png`. Foram verificados swipe emulado de ida/volta, wheel, arraste da cápsula, seleção direta da enquete, prévia local de foto, movimento reduzido e mudança de altura. Não houve teste físico adicional no iPhone; safe areas reais dependem de nova conferência no dispositivo.

## Ajustes de acabamento — informações e enquete

Removidos os indicadores e a contagem da enquete; o encerramento mostra o estado respondido com indicação de que as respostas de demonstração não foram enviadas. As três telas receberam controle de informações com conteúdo próprio. O foco de teclado passou de roxo para oliva e o contorno do contêiner de rolagem foi removido. Fotos recebeu painel mais discreto e ajustes de tipografia, largura do botão e espaçamento seguindo a referência. Inter local foi mantida, com peso ajustado nos subtítulos para aproximar o protótipo sem baixar outra fonte.

## Etapa 7 — feedback de usuário: vazamento da Polaroid, espaçamento, ordem das telas e quiz

Rodada de ajustes a partir de feedback direto sobre a Etapa 6, com uma screenshot real mostrando a fotografia central vazando para fora da moldura.

### Correções aplicadas

1. **Vazamento da foto na moldura:** não reproduzido no Chromium em nenhuma das quatro viewports testadas, mas corrigido de forma defensiva — `overflow: hidden` no contêiner `.polaroid` (nenhum pixel pode escapar da própria caixa do componente, independente de qualquer arredondamento/variação de renderização) e margem da foto ligeiramente mais apertada que a janela medida da moldura (segurança extra contra sub-pixel).
2. **Tela Fotos não ocupava a altura inteira:** o conteúdo (cabeçalho, painel, CTA) ficava compactado no topo, deixando um vão vazio antes da navegação inferior. Corrigido com `display: flex; flex-direction: column; min-height: 100%; justify-content: space-between`, a mesma filosofia de distribuição da Home — confirmado nas quatro viewports, sem vão residual em telas altas e com rolagem interna graciosa em telas baixas.
3. **Ordem das telas invertida:** Início → Enquete → Fotos (antes: Início → Fotos → Enquete), incluindo a ordem dos itens na barra inferior (o índice do link precisa bater com o índice da tela, pois a cápsula se posiciona por índice — `BottomNavigation.astro` e `index.astro` atualizados juntos).
4. **Indicador de arrastar-para-baixo:** Enquete (agora penúltima tela, com Fotos abaixo) passou a usar a MESMA animação de sobe-e-desce da Home, em vez da versão estática anterior (que fazia sentido só quando Enquete era a última tela).
5. **Enquete redesenhada como quiz sequencial:** removido o padrão "selecionar opção → confirmar com botão Votar". Agora: 3–5 perguntas pré-carregadas (`src/data/quiz-questions.ts`, dados de demonstração), uma por vez, cada uma com duas opções em botões coloridos (tokens existentes via `color-mix`: oliva, lavanda, âmbar, creme) com ícone — tocar já registra e avança para a próxima, com transição suave (fade + deslocamento, ~200–220ms). Ao final, mensagem de encerramento honesta, sem resultados fabricados.

### Bug encontrado durante a implementação do quiz

Os botões da primeira pergunta (renderizados pelo Astro no servidor) mostravam cor e ícone corretos; os das perguntas seguintes (criadas via `document.createElement` no cliente) apareciam cinza, sem ícone. Causa: o CSS com escopo do Astro exige o atributo `data-astro-cid-*`, que só existe em elementos renderizados pelo próprio template — elementos criados via JavaScript no cliente nunca o recebem, então os seletores `.quiz-option--*` nunca combinavam com eles. Corrigido marcando o bloco de estilos do `QuizCard.astro` como `is:global`, já que os nomes de classe (`quiz-*`) são específicos o suficiente para não colidir com nada.

### Validação

Testado nas quatro viewports obrigatórias (375×667, 390×844, 440×956, 1440×900) para Fotos e Enquete. Confirmado via Playwright: navegação por clique/arraste da cápsula/wheel/teclado funcionando com a nova ordem; quiz completo (5 perguntas) via mouse e teclado (Tab + Enter, com foco movendo corretamente e anúncio por `aria-live` a cada pergunta); upload de foto com prévia ainda funcional após a mudança de layout; console sem erros em nenhuma etapa; payload da Home inalterado (nenhum asset de Enquete/Fotos carrega antes da navegação real), moldura Polaroid buscada uma única vez.

## Etapa 6 — implementação das telas Fotos e Enquete

As duas telas, até então placeholders (só o título), foram implementadas
seguindo `prototipo3Paginas.png` e os tokens/componentes já estabelecidos
pela Home. Destaque desta etapa: a composição "Flagras mais recentes" usa
uma **única moldura Polaroid reutilizável** (`molduraPolaroidUnica.png`),
nunca mesclada com a fotografia em arquivo final — o encaixe é só CSS
(`Polaroid.astro` + `RecentPhotos.astro`).

### Rodada 1 — implementação inicial e diagnóstico

Primeira captura em 440×956 revelou dois defeitos de implementação, não de
composição:

1. **Leque sem rotação nem sobreposição:** as três Polaroids empilhavam em
   fluxo normal (uma embaixo da outra), cada uma quase do tamanho da tela.
   Causa raiz: `class="fan-item fan-item--left"` era passado como prop
   direto para `<Polaroid>`, mas o atributo de escopo do Astro
   (`data-astro-cid-*`) aplicado aos seletores seguia sendo o do próprio
   `Polaroid.astro`, não o do `RecentPhotos.astro` — os seletores
   `.fan-item` nunca combinavam com o elemento real. Corrigido envolvendo
   cada `<Polaroid>` num `<div class="fan-item ...">` próprio do componente
   pai (padrão: o pai controla posição/rotação, o filho controla seu
   próprio conteúdo).
2. **Prévia da foto visível por padrão:** `.photo-preview { display: grid }`
   e o atributo `hidden` têm a mesma especificidade CSS; a regra autoral
   vencia a regra `[hidden]` do agente de usuário. Corrigido com
   `.photo-preview[hidden] { display: none }`.

Depois de corrigido, uma captura ampliada (zoom 2× na área do leque) confirmou
encaixe correto da fotografia na janela da moldura, sem vazamento e com os
cantos arredondados coerentes com a pixel art.

### Rodada 2 — comparação lado a lado com o protótipo

Fotos e Enquete comparadas, lado a lado, com os recortes correspondentes de
`prototipo3Paginas.png`. Única diferença de impacto encontrada: o coração
"♥" do texto complementar da tela Fotos usava a cor padrão do texto em vez
do verde-oliva do protótipo — corrigido (`.photo-heart { color:
var(--color-olive) }`). Resto da composição (ícones, título, painel,
proporção do leque, cartão de enquete, opções, botão) já correspondia de
perto ao protótipo nesta rodada — nenhuma correção adicional foi necessária.

### Validação de performance (ver `ASSET_OPTIMIZATION.md` para números completos)

Medição real revelou que `loading="lazy"` sozinho não impedia o
pré-carregamento das imagens de Fotos/Enquete (+170 KB na Home, medido),
porque as telas ficam fisicamente a só ~1 viewport de distância na mesma
coluna rolável. Corrigido com um adiamento mais forte baseado em
`data-src`/`data-srcset` + `IntersectionObserver` (`src/scripts/defer-images.ts`),
reaproveitando o mesmo `root` ([data-screen-viewport]) que o controlador de
navegação já usa. Confirmado após a correção: Home volta a ~222 KB
transferidos, a moldura Polaroid é buscada **uma única vez** mesmo aparecendo
em três componentes, e nenhuma imagem de Fotos/Enquete é solicitada antes da
navegação real até essas telas.

### Testes funcionais

Confirmados via Playwright: abertura do seletor nativo de arquivo ao tocar
no CTA de Fotos, prévia local correta após selecionar uma imagem, texto
honesto de indisponibilidade de envio (nunca uma falsa confirmação),
"Escolher outra" limpando a prévia; seleção de opção na Enquete habilitando
o botão "Votar", estado selecionado visualmente claro, texto honesto de
ausência de backend após o envio (nunca "Voto registrado!" fingido);
navegação compartilhada (clique nos três itens, arraste da cápsula, swipe
vertical, teclado) sem regressões com as novas telas; CLS = 0 mantido mesmo
com o carregamento adiado de imagens. Responsividade confirmada em
375×667, 390×844, 440×956 e 1440×900, sem overflow horizontal.

## Etapa 5 — otimização avançada de assets e performance mobile

Esta etapa não alterou layout, interação ou conteúdo — o objetivo foi reduzir a
transferência de dados da primeira abertura (acesso via QR Code na CCXP, rede
móvel potencialmente lenta/instável), mantendo fidelidade visual. Relatório
técnico completo, com todas as medições, candidatos testados e critérios de
aprovação: **[`ASSET_OPTIMIZATION.md`](./ASSET_OPTIMIZATION.md)**.

Resumo das mudanças:

- Cenário de fundo: de WebP *sem perdas* para WebP qualidade 90 (com perdas
  aprovadas) — o conteúdo (gradientes de céu/nuvens/multidão) comprimia muito
  mal sem perdas; a nova versão corta ~94% dos bytes, aprovada após inspeção
  visual com contraste/saturação artificialmente ampliados nas zonas de maior
  risco (texto "CCXP", gradiente do céu, silhuetas).
- Logo, Juh, Átila e Korok: passaram a ser publicados como `<picture>` com
  AVIF (qualidade 88, aprovado) → WebP sem perdas → PNG, em vez de um único
  PNG. Economia de 74–82% por asset, sem diferença perceptível em nenhuma das
  quatro viewports de revisão, inclusive em recorte ampliado de rosto/lettering.
- Ícones de navegação: redimensionados de ~750–900px para 128px de altura
  (exibição real é 32px CSS) — eram, de longe, o maior desperdício
  identificado no inventário. Testados 64/96/128/160px; 128px foi o menor
  valor visualmente indistinguível do original mesmo exibido 4× maior que o
  uso real. Economia de 86–87% por ícone.
- Duas fontes órfãs (Pixelify Sans, Press Start 2P — resíduos de iterações
  anteriores ao logo em PNG) foram removidas do repositório.
- Todos os assets em `public/assets/` passaram a ter hash de conteúdo no
  nome, habilitando cache "para sempre" seguro em produção (ver
  `nginx.conf.example`).

**Resultado medido (Playwright/CDP, cache desabilitado, 440×956 @2x):**
890.611 → ~208.000 bytes transferidos na Home (**−76,6%**), dentro do
orçamento de 200–250 KB definido para a primeira tela. Zero downloads
duplicados ou de formato não utilizado; LCP e CLS inalterados (continuam
76→~60ms local e 0, respectivamente; o elemento de LCP continua sendo o
cenário). Reconfirmados, sem regressão: navegação vertical, cápsula
arrastável, clique nos ícones, barra de progresso, balão do Korok,
composição dos personagens e responsividade nas quatro viewports.

## Etapa 4 — integração dos assets oficiais (PNG)

Esta etapa substitui o logotipo tipográfico, o balão SVG facetado e os ícones SVG desenhados à mão pelos **sete PNGs oficiais fornecidos**, localizados na raiz do Frontend:

- `checkpoint-ccxp26-logo.png`, `Nivel1juhDesconhecidos.png`, `Nivel1atilaDesconhecidos.png`, `korok.png`, `houseGuideBar.png`, `cameraGuideBar.png`, `enqueteGuideBar.png`.

Todos tinham canal alpha, mas com resíduos quase transparentes (alpha 1–7) fora da arte, o que produzia caixas de recorte artificialmente grandes/quadradas (ex.: o logo, horizontal, aparentava quase 1:1). O script `scripts/prepare-official-assets.mjs` localiza a área com alpha ≥8, adiciona 8px de folga, recorta sem limiarizar pixels internos, limita a resolução (logo 720px, casal 448px de altura, Korok 260px — por volta de 2× o uso máximo em tela) e para os três ícones de navegação preserva **somente o canal alpha**, descartando RGB não usado pela máscara. Cada saída foi validada byte a byte contra a matriz preparada (sem perdas de codificação) e, nos ícones, o alpha final foi comparado ao alpha do recorte original.

Tamanho conjunto: **2.981.875 bytes recebidos → 578.944 bytes publicados** (~81% menor). Os originais íntegros foram arquivados em `source-assets/official/`, fora de `public/`.

### Rodada 1 (desta etapa) — captura e diagnóstico inicial

Primeira captura em 440×956 após integrar os sete PNGs mostrou: logotipo oficial centralizado, Juh à esquerda e Átila à direita sobre o gramado, Korok junto ao balão (agora arredondado) e os três ícones de navegação via máscara CSS. Bounding boxes identificaram dois ajustes:

1. O casal ficava com a cabeça muito próxima do subtítulo e os pés um pouco acima da linha do gramado.
2. A câmera tinha ~30% mais área opaca equivalente que a casa — peso óptico desigual entre os três ícones.

### Rodada 2 (desta etapa) — ajustes finos

- Altura do casal reduzida de `26cqh` para `25.2cqh` (e dos breakpoints baixos proporcionalmente), sem mover a base/pés, apenas reequilibrando a distância até o subtítulo.
- Larguras ópticas dos ícones ajustadas para 32/32/33px (antes 30/34/32), aproximando o peso visual das três máscaras.
- Preload de imagem do logo adicionado ao `<head>`, compartilhando o mesmo URL do `<img>` (sem download duplicado).

**Resultado da nova captura:** `groundError` (diferença entre os pés do casal e a linha do gramado) ficou abaixo de 2px nas quatro viewports; `headGap` (espaço entre subtítulo e topo dos personagens) ficou ≥10px em todas. A revisão responsiva, porém, revelou que a troca do balão SVG por `border` CSS introduzia 2px de rolagem interna em 390×844 (a borda não estava contabilizada no padding já aprovado).

### Rodada 3 (desta etapa) — correção da borda do balão

- O padding interno do balão passou a descontar a espessura da borda (`calc(var(--space-X) - var(--bubble-border))`), preservando a altura externa aprovada sem gerar scroll residual.
- Nova bateria de testes confirmou **zero overflow interno/horizontal** nas quatro viewports, ordem Juh→Átila preservada, progresso ainda em 0, nenhum SVG na navegação (`navSVGs: 0`), as três máscaras apontando para os PNGs corretos, e nenhum contorno roxo permanente no estado ativo comum (`outlineStyle: 'none'`), com foco visível preservado via `:focus-visible` no teclado.

### Diferenças corrigidas nesta etapa

| Item | Antes (etapas anteriores) | Depois (assets oficiais) |
|---|---|---|
| Logotipo | Texto HTML em Jersey 10/Press Start 2P | PNG oficial `checkpoint-ccxp26-logo.png`, 720×213, com lettering e estrelas originais |
| Casal | Ausente (sem assets autorizados) | `Nivel1juhDesconhecidos.png` (esquerda) + `Nivel1atilaDesconhecidos.png` (direita), ancorados ao gramado |
| Mascote | Ausente | `korok.png`, posicionado à esquerda do balão |
| Balão | SVG poligonal facetado | HTML/CSS com `border-radius: 24px`, contorno fino, ponta lateral e `--shadow-card` |
| Ícones de navegação | SVGs desenhados à mão | Três PNGs oficiais aplicados via `mask-image`/`-webkit-mask-image`, cor por `currentColor` |
| Cápsula ativa | Verde sólido | Gradiente sutil oliva→oliva-hover, sombra discreta, sem contorno roxo permanente |

### Testes funcionais desta etapa (adicionais aos já registrados abaixo)

- Clique nos três itens (Fotos, Enquete, Início): seleção e `aria-current` corretos.
- Arraste da cápsula com mouse de Início até Fotos: encaixe alinhado (erro 0px), sem contorno de foco, tela trocada apenas na soltura.
- Foco por teclado (`Tab`): anel violeta via `:focus-visible` presente e visível — confirmando que o contorno roxo não aparece permanentemente, apenas na navegação por teclado.
- Navegação vertical por wheel (8 eventos de 160px): avança exatamente uma tela.
- Verificação de rede: exatamente 1 requisição para o logo (sem duplicação por preload+`<img>`), e as 7 URLs dos PNGs oficiais presentes; nenhum recurso externo; sem erros/avisos de console.
- `npm run build`: Astro/TypeScript sem erros, avisos ou hints.

### Pendências desta etapa

Nenhuma. Os três sprites restantes (casal + Korok) citados como ausentes nas rodadas anteriores foram localizados e integrados nesta etapa — essa era a única diferença estrutural pendente registrada anteriormente.

---

## Histórico — rodadas da etapa de navegação por telas e progresso segmentado

## Método e número de rodadas

Foram realizadas **três rodadas de correção e comparação após a captura inicial**, usando o preview estático de produção no Playwright MCP. Houve cinco capturas principais em **440×956**: inicial, rodada 1, rodada 2 e duas verificações da rodada 3, além das capturas responsivas.

A comparação considera o conteúdo interno do primeiro smartphone de `prototipo3Paginas.png`, ignorando moldura e elementos do sistema operacional. As medidas abaixo são coordenadas CSS da aplicação, não uma alegação de extração exata do protótipo.

O diagnóstico usou screenshots, computed styles, bounding boxes, fonte realmente renderizada via DevTools Protocol, dimensões do cenário, overflow e monitoramento de Network/console. Cada rodada foi seguida de build, nova captura e inspeção.

## Captura inicial e três diferenças prioritárias

1. **Hierarquia/composição:** o conjunto centralizado adicionava cerca de 25px antes do cenário. CHECKPOINT tinha pouca presença em relação a CCXP26; o progresso começava em y≈547 e deixava o bloco superior mais baixo que a referência.
2. **Progresso:** trilha fina de 16px, sem divisões e sem o marcador circular. Era semanticamente correta, mas visualmente incompleta em relação à referência.
3. **Navegação:** destaque de aproximadamente 125×55px, largo e baixo, ícones pequenos com viewBox não quadrado e destaque vinculado ao background de cada link. Não havia uma cápsula compartilhada que pudesse ser arrastada.

Também foram registradas a largura excessiva do balão e a falta dos sprites. Os sprites não foram tratados como diferenças corrigíveis nesta etapa, pois não há assets separados autorizados e o escopo mantém sua inserção para depois.

## Rodada 1 — composição, tipografia e progresso

- Removida a centralização vertical excedente do conjunto; o fluxo começa no topo da área útil.
- Reequilibrada a relação tipográfica: CHECKPOINT de 32 para 36px nominais em 440px; CCXP26 de 104 para 100px, sem distorcer glifos. Família Jersey 10 preservada.
- Subtítulo responsivo de 16–18px. Área do cenário ajustada proporcionalmente, mantendo a imagem existente e a região do gramado.
- Gaps maiores entre os blocos inferiores, em vez de espaço excedente acima de toda a composição.
- Trilha de 20px, dez divisões visuais e marcador de 22px com ponto central. O `<progress>` continua em **0 / 100**: o marcador é decorativo e não representa pontos fictícios.

**Resultado da nova captura:** topo do progresso em y≈503, trilha/marcador proporcionais e nenhuma rolagem interna na resolução principal. A nova comparação mostrou que o balão ainda tinha 273px de largura e legenda pequena de 16px; a navegação continuava com o acabamento anterior.

## Rodada 2 — balão, cápsula e ícones

- Balão de 273 para 252px na resolução principal, mais alinhado à direita e com espaço reservado ao mascote à esquerda.
- Facetas menores no SVG, mantendo ponta lateral e texto HTML. Yahaha mais expressivo, até 40px; legenda até 18px.
- Barra com altura mínima de 80px. Cápsula compartilhada limitada a 112px e ícones em 32px com viewBox 24×24, sem achatamento.
- Implementado arraste por Pointer Events com captura local, prévia visual e encaixe no destino mais próximo ao soltar. A seleção semântica e a tela só mudam na soltura.
- Arraste curto retorna ao mesmo item; cancelamento restaura a seleção. Clique sintetizado após arraste é suprimido para não voltar à origem. Sem dependências novas.

**Resultado da nova captura:** balão de 252×103px; cápsula de aproximadamente 112×62px; ícones com mais presença. Mouse e touch confirmaram encaixe e sincronização. A revisão responsiva detectou 6px, 12px e 2px de overflow interno, respectivamente em 375×667, 390×844 e 1440×900.

## Rodada 3 — responsividade e eliminação do scroll residual

- Bounding boxes mostraram que o conteúdo visível cabia, mas um padding inferior redundante aumentava a altura rolável. Ele foi removido; a navegação já reserva sua própria faixa e safe area.
- Balão limitado a 280px no desktop, evitando alargamento excessivo.
- Simuladas reservas equivalentes a 44px no topo e 34px no rodapé em 390×844, via CSS no navegador de teste. Elas revelaram 13px adicionais de scroll interno. Uma container query reduz os gaps quando a altura útil fica abaixo de 740px, preservando texto e cenário.
- Repetidas capturas e medições: **zero overflow interno e horizontal nas quatro viewports obrigatórias**. Na simulação de safe areas de 390×844, overflow também zerado e primeiro swipe avançando diretamente para Fotos.

## Primeira versus última captura — 440×956

| Medida na aplicação | Inicial | Final |
|---|---:|---:|
| Topo do bloco de progresso | 546,7px | 498,9px |
| Altura do bloco de progresso | 89,9px | 102,7px |
| Altura da trilha | 16px | 20px |
| Divisões visuais / marcador | Ausentes | 10 divisões / 22px |
| Largura do balão | 273,2px | 252px |
| Corpo da legenda do balão | 16px | 18px |
| Dimensões do destaque ativo | 124,7×54,8px | 112×62,5px |
| Dimensões externas dos SVGs de navegação | 26×26px, viewBox 24×26 | 32×32px, viewBox 24×24 |

O conjunto superior ficou mais intencional, o progresso ganhou a linguagem da referência e o balão/cápsula deixaram de parecer controles genéricos desproporcionados. Os espaços foram redistribuídos entre os blocos, com acesso direto à próxima tela no primeiro gesto normal.

## Evidências de captura

Arquivos gerados pelo Playwright em `.playwright-mcp/` durante a execução local, ignorados no versionamento:

- Inicial: `page-2026-11-09T02-56-03-082Z.png`.
- Rodada 1: `page-2026-11-09T03-01-35-475Z.png`.
- Rodada 2: `page-2026-11-09T03-05-53-207Z.png`.
- Rodada 3, primeira revisão: `page-2026-11-09T03-09-34-236Z.png`.
- Final 440×956: `page-2026-11-09T03-18-03-760Z.png`.
- Final 375×667: `page-2026-11-09T03-18-28-262Z.png`.
- Final 390×844: `page-2026-11-09T03-18-53-399Z.png`.
- Final 1440×900: `page-2026-11-09T03-19-07-636Z.png`.

## Testes funcionais e de produção

- Toques nos três itens, seleção direta e atualização do estado ativo: aprovados.
- Arraste com mouse nas quatro resoluções: encaixe alinhado ao item selecionado, sem saltar para a origem depois da soltura.
- Touch real emulado por CDP: arraste de Início direto à Enquete, retorno, arraste curto, cancelamento e encaixe aprovados. Durante o arraste, a tela e `aria-current` permaneceram na origem; na soltura, selecionaram o destino.
- Swipe para cima/baixo: tela e cápsula sincronizadas. Gesto vertical começando na barra não acionou a navegação vertical do conteúdo.
- Wheel forte e rajadas representativas de trackpad: uma tela por gesto, sem telas paradas pela metade. Verificados junto com setas de teclado nas quatro resoluções.
- Movimento reduzido: seleção/alinhamento imediato, sem animação de encaixe perceptível.
- Sem overflow horizontal, cortes ou conteúdo coberto pela barra nas viewports obrigatórias; os scrollports internos continuam disponíveis para conteúdos maiores.
- Network/console: nenhuma falha, erro ou aviso nos contextos novos de teste. Somente recursos locais; duas fontes WOFF2, sem downloads duplicados.
- **CLS local observado: 0** nas quatro resoluções. Não é uma medição de Core Web Vitals no evento.
- `npm run build`: Astro/TypeScript sem erros, avisos ou hints; saída estática com um documento contendo as três telas.
- `npm audit`: nenhuma vulnerabilidade reportada.

## Diferenças que estavam pendentes nesta etapa (resolvidas na Etapa 4 acima)

- **Casal e Korok:** não existiam sprites separados autorizados no projeto nesta etapa. Permaneceram ausentes conforme o escopo então vigente; não foram criados placeholders, recortes do mockup ou ilustrações substitutas. **Esta pendência foi resolvida na Etapa 4**, documentada no topo deste arquivo, com a integração dos três PNGs oficiais.
- **Lettering:** Jersey 10 era uma aproximação HTML do lettering ilustrado nesta etapa. **Substituída na Etapa 4** pelo PNG oficial do logotipo; Jersey 10 permanece apenas nos títulos decorativos de Fotos/Enquete.
- Fotos e Enquete mantêm apenas seus títulos, conforme a etapa anterior; não foram acrescentadas funcionalidades.

O ciclo desta etapa foi encerrado após corrigir as diferenças estruturais e de componentes que eram tratáveis no escopo então vigente e validar a navegação. As diferenças remanescentes identificadas aqui (sprites e lettering) foram tratadas na Etapa 4.
