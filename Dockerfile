FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# PUBLIC_API_URL vazio = mesma origem (o nginx abaixo faz proxy de /api/ para a API).
ARG PUBLIC_PRIVACY_EMAIL=
ENV PUBLIC_API_URL= PUBLIC_PRIVACY_EMAIL=$PUBLIC_PRIVACY_EMAIL
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/checkpoint-security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
