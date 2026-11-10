# Checkpoint CCXP26 — Frontend

Site estático em Astro + TypeScript com três telas verticais (Início → Enquete → Fotos). Os dados vêm da [API](https://github.com/atilaalcantara/checkpoint-ccxp26-backend) em runtime; não há Node no servidor.

## Como funciona
- `src/pages/index.astro` compõe as telas; `src/pages/privacidade.astro` é o aviso de privacidade.
- `src/scripts/api.ts` fala com `/api/v1/*`. O visitante é um UUID aleatório salvo no `localStorage` (sem cookies nem analytics).
- Upload de foto (`photo-upload.ts`): prévia e enquadramento no navegador, **caixa de consentimento obrigatória**, feedback de erro/ocupado e reconciliação se a resposta se perder.
- `build` roda `astro check` e gera `dist/`. Os scripts não são inlinados, para a CSP usar `script-src 'self'`.

## Desenvolvimento
Requer Node 22.23.4+ (recomendado 24) e npm 9.6.5+.
```sh
cp .env.example .env     # PUBLIC_API_URL=http://127.0.0.1:8080
npm ci
npm run dev              # http://localhost:4321
```
No celular, use o IP do computador em `PUBLIC_API_URL` (127.0.0.1 é o próprio aparelho).

## Produção
```sh
PUBLIC_API_URL= PUBLIC_PRIVACY_EMAIL=contato@seu-dominio npm run build
```
- `PUBLIC_API_URL` **vazio** = mesma origem: o Nginx serve o `dist/` e faz proxy de `/api/` para a API, sem CORS. Esse valor é fixado no build.
- `PUBLIC_PRIVACY_EMAIL` é o canal de contato mostrado em `/privacidade` (pedidos de exclusão).
- Copie `dist/` para o servidor e adapte `nginx.conf.example` (HTTPS, redirect 80→443, CSP e demais headers, cache longo em `_astro/` e `assets/`, HTML sempre revalidado, rate limit e limite de upload de 11 MB em `/api/`). Como `add_header` em um `location` anula os do nível superior, o snippet `nginx-security-headers.conf.example` é incluído nos locations.

## Estrutura
```text
src/components/  telas e componentes   src/scripts/  API, upload, votos, XP, navegação
src/styles/      tokens e CSS global   src/assets/   fontes e imagens otimizadas
public/          favicon e licenças    scripts/      otimização de assets
```
