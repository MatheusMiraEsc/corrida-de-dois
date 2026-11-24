# ---------------------------------------------------------------------------
# Backend Node do Corrida dos Dois
#   docker build -t corrida-backend-node .                  → servidor
#   docker build -t corrida-migrate --target migrate .      → aplica migrations
# ---------------------------------------------------------------------------

# 1) Build: instala tudo, gera o cliente Prisma e compila o TypeScript.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# 2) Migrations: imagem de uso único que cria/atualiza as tabelas do banco
#    (usada pelo serviço "migrate" do docker compose).
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

# 3) Runtime: só o necessário para rodar, sem dependências de desenvolvimento.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
