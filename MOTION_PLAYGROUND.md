# Checkpoint Motion Playground

> **Ferramenta de desenvolvimento:** rota e experimentos locais, não parte do fluxo de produção. A rota existe somente com `astro dev`.

Laboratório local e isolado para comparar propostas; o fluxo Início → Enquete → Fotos permanece inalterado.

**Decisão posterior:** A1 Peek & Pop, B1 Card Fan e C1 Duel Entrance foram escolhidas e integradas às entradas oficiais. O experimento D1 continua isolado; os sprites de nível atuais não foram alterados.

## Executar

```sh
npm run dev
```

Abra `http://localhost:4321/dev/motion` (ou a porta informada pelo Astro). A integração em `astro.config.mjs` injeta a rota **somente quando o comando é `dev`**; a entrada fica em `src/components/MotionPlayground.astro`, fora de `src/pages`. O build estático não inclui a rota nem o código do laboratório. Após alterar a configuração Astro, reinicie o servidor se a rota retornar 404.

Escolha experimento e variante, ajuste os controles e pressione **Play / Replay**. Em telas pequenas o Play traz a prévia à vista; role para retornar aos controles. **Parar**, mudança de variante/parâmetros, perda de foco e aba oculta cancelam efeitos e restauram a cena. A preferência de movimento reduzido do sistema tem prioridade; o controle local permite simulá-la. A seleção na Enquete reproduz apenas o feedback visual atual por 160 ms, sem enviar nem avançar perguntas.

## Experimentos e controles

| Cena | Variantes | Duração inicial |
|---|---|---:|
| Korok | A1 Peek & Pop; A2 Little Hop; A3 Dialogue Reveal | 650 ms |
| Polaroids | B1 Card Fan; B2 Photo Drop; B3 Memory Spread | 600 ms |
| Enquete | C1 Duel Entrance; C2 Anticipation & Settle; C3 Staggered Reveal | 550 ms |
| Nível | D1 Pixel Reveal, apenas conceito com sprites atuais | 850 ms |

O slider de duração controla a duração-base dos efeitos; trechos narrativos, delays e sobreposições podem prolongar o conjunto. Distância ajusta os deslocamentos; acomodação ajusta os pequenos overshoots; intervalo ajusta a separação temporal. Alguns parâmetros não se aplicam a todos os elementos: por exemplo, A3 prioriza escala do balão em vez de deslocar o sprite, e o tamanho das células de D1 é fixo. Trocar de cena restaura a duração-base daquela categoria. A interface não reproduz em loop.

## Técnica e princípios

- Componentes reais `HomeHero`, `RecentPhotos`/`Polaroid` e `QuizCard`, além dos assets otimizados e três fotos independentes existentes. O palco adapta a apresentação ao laboratório; não modifica a composição oficial.
- WAAPI para transform e opacity, keyframes com antecipação, sobreposição, arcos discretos e acomodação. O leque lê a matriz final do próprio CSS e retorna a ela; não escala ou deforma os retratos. O sprite do Korok se desloca sem squash/stretch; a máscara é o limite da composição existente. O balão expande a partir do lado do mascote, com texto revelado depois.
- D1 anima 64 células de opacity, apenas durante o evento, e uma barra com `scaleX`; não existem sprites de nível seguinte nem pontuação real. O número é claramente marcado como simulação. O custo das 64 animações merece medição em dispositivos reais antes de qualquer integração.
- O controle central cancela efeitos e timers antes de nova reprodução. A CSS define o estado de repouso, e efeitos concluídos são removidos; não há `fill: forwards` persistente. O sistema reduzido não dispara movimento.
- A direção artística segue os princípios de staging, antecipação e follow-through, com deslocamentos curtos e sem blur. Referências conceituais: [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion) e [Material Design — Motion](https://m3.material.io/styles/motion/overview). A acessibilidade e o contexto dos componentes têm prioridade sobre movimento decorativo.

## Avaliação comparativa

Julgamento visual e técnico inicial, não medição de FPS ou validação física. Performance e compatibilidade são expectativas a confirmar no aparelho.

| Variante | Expressividade | Clareza | Coerência | Performance estimada | Manutenção | Mobile |
|---|---|---|---|---|---|---|
| A1 Peek & Pop | Alta | Alta | Alta | Boa | Baixa | Boa; conferir máscara |
| A2 Little Hop | Alta | Boa | Boa | Boa | Baixa | Boa; conferir nitidez em movimento |
| A3 Dialogue Reveal | Média | Alta | Alta | Boa | Baixa | Boa; texto só aparece com balão legível |
| B1 Card Fan | Alta | Alta | Alta | Boa | Média | Boa; preservar matriz final |
| B2 Photo Drop | Média | Alta | Alta | Boa | Média | Boa; verificar sobreposição |
| B3 Memory Spread | Boa | Boa | Alta | Boa | Média | Boa; movimento mais discreto |
| C1 Duel Entrance | Alta | Alta | Boa | Boa | Baixa | Boa; conferir bordas estreitas |
| C2 Anticipation & Settle | Média | Boa | Alta | Boa | Baixa | Boa |
| C3 Staggered Reveal | Média | Alta | Alta | Boa | Baixa | Boa; leitura progressiva |
| D1 Pixel Reveal | Alta | Boa | Boa | A medir | Média | A medir; 64 efeitos simultâneos |

**Recomendação para discussão:** A1 dá personalidade imediata sem atrapalhar o balão; A3 é a opção mais discreta. B3 organiza as memórias de modo mais natural e econômico visualmente que B1, mantendo a composição final. C1 comunica o duelo da pergunta de demonstração, mas C3 é mais reutilizável para perguntas sem confronto; recomendação geral C3. D1 é apenas um protótipo, sujeito a medição e a sprites reais antes de integrar.

## Verificação realizada

- Build `npm run build`: Astro check sem erros/avisos; uma única rota estática (`/index.html`); busca em `dist/**/motion*` sem resultados.
- Playwright/Chromium: capturas de início, 300 ms e final para as dez variantes em `.playwright-mcp/playground-{korok,photos,quiz,level}-*`. Para inspecionar quadros intermediários, as animações foram pausadas e posicionadas em tempos conhecidos; isso não substitui avaliação perceptiva contínua em aparelho real. A captura de B2 revelou transparência excessiva entre fotos; foi reduzida e recapturada como `playground-photos-2-revised.png`.
- 375×667, 390×844, 440×956 e desktop 1440×900: sem overflow horizontal; prévia entre 310 e 372 px de largura. Play em celular traz o palco para a área visível.
- Verificados replay, troca de variante, alteração de parâmetros, Parar, perda de foco sintética, preferência reduzida simulada e do sistema, feedback de seleção e conclusão/reinício do nível. Sem erros de página observados no teste funcional. Aplicação principal: ordem de telas preservada, navegação por teclado Início → Enquete conferida.
- Limitações: Chromium emulado não garante a nitidez, o timing percebido ou o desempenho no Safari/iPhone físico. A mudança de aba real, a arbitragem tátil e o comportamento sob carga devem ser testados no dispositivo antes da integração. A avaliação visual é uma proposta, não aprovação final.
