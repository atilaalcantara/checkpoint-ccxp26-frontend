# Participação — demonstração local

> **Documento histórico:** descreve o fluxo local de mock antes da integração. A participação vigente usa a API; veja `CONTRATO_API.md` e `README.md`.

`src/scripts/mock-participation.ts` centraliza o registro `checkpoint-participation-v1` em `localStorage`: três IDs distintos embaralhados por Fisher–Yates, respostas por ID, posição da pergunta e confirmação da foto. O registro é salvo antes de conceder XP; o total mockado é derivado das respostas e da foto, evitando somas duplicadas após reload. Ao falhar a gravação, a ação não é confirmada nem gera XP. Outra aba é atualizada pelo evento `storage`. O armazenamento é local, pode ser apagado pelo navegador e não oferece proteção antifraude nem pontuação comunitária real.

Cada voto confirmado fica registrado até a continuação escolhida pelo visitante. Três respostas desbloqueiam resultados de todas as perguntas mockadas. Se houver menos de três perguntas, as disponíveis podem ser respondidas, mas a interface comunica indisponibilidade ao final, sem liberar resultados; `resultsAuthorized` reserva espaço para uma decisão excepcional futura do servidor. Resultados são dados demonstrativos explicitamente identificados, incluindo o voto local, e não dados reais. A coleção é informativa, com cartões horizontais navegáveis por arraste ou teclado, distinção oliva para vencedor, empate neutro e ausência de votos sem vencedor.

Na seção Fotos, selecionar ou cancelar não consome o limite. O botão **Confirmar simulação** grava apenas o estado local: não transmite nem armazena a imagem. Após confirmar, o estado e +2 XP persistem e o controle de envio é removido. A amostra existente mantém três imagens; não há galeria completa.

## API futura

Trocar `getParticipation`, `recordMockVote`, `continueMockPoll`, `canSeeResults`, `getMockResults` e `submitMockPhoto` por respostas e operações autorizadas do backend. O servidor deve fornecer atribuições estáveis, elegibilidade, agregados, confirmação de upload e total comunitário, além de impor idempotência e limites entre dispositivos. Voto e foto só devem atualizar XP após confirmação; se a resposta já contiver o total oficial, aplicá-lo diretamente sem somar novamente. A UI não deve depender de `localStorage` para autorização real.

## Verificação

Playwright/Chromium: atribuição sem repetição, voto único, recarga parcial, três respostas, cinco resultados, desbloqueio após recarga, empate, ausência de votos, menos de três perguntas e falha simulada de gravação. A foto foi selecionada sem XP e confirmada uma vez com +2, mantendo o estado após recarga; três fotos recentes permaneceram visíveis. Testados teclado, movimento reduzido e passagem para Fotos. Em 320×568, 375×667, 390×844, 440×956 e desktop não houve overflow horizontal na coleção. O build passa pelo Astro check; não há script de lint separado. Ainda não houve validação física no iPhone.
