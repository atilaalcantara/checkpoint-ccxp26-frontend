# Progressão de demonstração e integração futura

> **Documento histórico:** descreve a progressão local anterior à API. A interface vigente lê XP, limites e artes da API conforme `CONTRATO_API.md`.

> **Atualização mais recente:** os sprites publicados agora usam AVIF q88, e não WebP. A moldura e máscaras usam AVIF lossless; não há fallback para navegadores sem AVIF. Os parágrafos abaixo sobre padronização WebP são históricos.

> **Atualização de assets:** o frontend publica imagens em WebP; sprites e Korok usam WebP q95 com perdas, preservando alpha, após comparação visual e revisão do limite de qualidade. A moldura continua lossless. Os valores e formatos AVIF abaixo descrevem a medição anterior, preservada como histórico. As artes futuras ainda estão publicadas como arquivos locais; a restrição de spoilers depende da integração com o backend.

O XP atual é **uma demonstração local, persistida neste navegador e não compartilhada entre visitantes**. É derivado das respostas e da confirmação de foto na mesma entrada de `localStorage`; não representa um total comunitário real. Cada visitante pode simular até três votos e uma foto, totalizando até 5 XP.

## Estrutura

- `src/data/progression.ts`: patamares acumulados (0, 3, 7, 12 e 19), sprites, recompensas e `calculateProgress`. No último patamar a barra fica cheia e não há próximo nível.
- `src/scripts/mock-participation.ts`: atribuição, respostas, elegibilidade e foto simulada, persistidos atomicamente; a deduplicação local não é proteção antifraude.
- `src/scripts/community-xp.ts`: calcula o total a partir desse estado e notifica a apresentação; o backend deverá substituir o total simulado.
- `src/scripts/progression-ui.ts`: atualização da barra e troca de imagens depois da decodificação. Mantém o desenho anterior caso o carregamento falhe, protege contra carregamentos fora de ordem e só anima a troca na Home visível.
- `src/scripts/xp-feedback.ts`: indicação discreta de XP; reduz movimento conforme a preferência do sistema.
- `quiz.ts`: registra +1 após confirmação local e espera a continuação. As três respostas desbloqueiam os resultados mockados.
- `photo-upload.ts`: escolha de arquivo é somente prévia. O botão de confirmação é explicitamente identificado como simulação; concede +2 uma única vez e informa que nada foi enviado.

## Backend futuro

1. Buscar o XP comunitário oficial e alimentar o estado de apresentação, inclusive em atualizações posteriores. O backend deve ser a fonte de verdade.
2. Substituir `recordMockVote` pela operação de voto real; atualizar o estado e mostrar +1 somente depois de sucesso confirmado. Falhas não podem avançar nem conceder XP.
3. Na implementação de upload real, substituir `submitMockPhoto` e mostrar +2 apenas após resposta bem-sucedida, usando um identificador estável retornado pelo servidor. Escolher arquivo, iniciar upload, mensagens ou descrições não geram XP.
4. Definir com a API se a resposta já inclui o **total atualizado**. Nesse caso, aplicar esse total em vez de incrementá-lo novamente e mostrar o feedback separadamente; não combinar os dois caminhos. Idempotência e concorrência entre dispositivos precisam ser garantidas no backend por identificadores de operação e regras de voto/upload.

## Assets

`npm run prepare:official-assets` lê os originais em `PersonagensENiveis/`, mantendo-os intactos, e gera arquivos com hash em `public/assets/characters/` e referências em `src/assets/official-assets.json`. O processo existente recorta a área visível com margem, usa altura máxima de 448 px e kernel `nearest`, produz AVIF q88 com gate PSNR ≥40 dB, além de fallbacks WebP lossless e PNG. Os cinco novos AVIFs têm, respectivamente, 22.651 B (Juh Amigos), 20.380 B (Átila Amigos), 35.614 B (Namorados), 42.834 B (Noivos) e 70.413 B (Casados); PSNR medido de 43,4 a 47,0 dB. Os arquivos de fallback só são solicitados conforme suporte do navegador. Outros níveis não são pré-carregados.

## Validação

Playwright/Chromium: patamares e valores intermediários, inclusive 9 XP (Namorados, 2/5, 40%), salto direto para o último nível, retorno rápido entre níveis, deduplicação de recibos, seleção de foto sem XP e simulação de foto com +2. Os cinco níveis foram conferidos em 320×568, 375×667, 390×844, 440×956 e 1440×900: imagens com base alinhada, altura do palco estável e sem overflow horizontal. Contexto frio não solicitou sprites de níveis futuros. Sem teste físico no iPhone; tempos de carregamento em rede móvel e transição no Safari ainda precisam ser conferidos no aparelho.
