FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY src/ src/
COPY drizzle/ drizzle/
COPY tsconfig.json drizzle.config.ts ./
RUN npx tsc --outDir dist

FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist dist/
COPY --from=builder /app/drizzle drizzle/
COPY drizzle.config.ts ./
EXPOSE 3100
CMD ["node", "dist/index.js"]
