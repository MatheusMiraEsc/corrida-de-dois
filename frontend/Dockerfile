# ---------------------------------------------------------------------------
# Frontend do Corrida dos Dois: build estático (Vite) servido pelo Nginx.
#
# As URLs do backend NÃO ficam gravadas no build: o container gera /config.js
# na subida a partir de API_URL e WS_URL. Assim a mesma imagem funciona com o
# backend Node ou com o Java — basta mudar as variáveis.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx tsc -b && npx vite build

FROM nginx:1.29-alpine AS runtime
# O Nginx substitui ${PORT} do template na subida (serviços de nuvem definem PORT).
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
RUN chmod +x /docker-entrypoint.d/40-app-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=80 \
    API_URL=http://localhost:3000 \
    WS_URL=ws://localhost:3000/ws
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:${PORT}/ >/dev/null || exit 1
