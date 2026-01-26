# syntax=docker/dockerfile:1
FROM node:20 AS base
WORKDIR /app

# activar pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

RUN apt-get update && apt-get install -y patch

# instalar deps con pnpm
RUN pnpm install --frozen-lockfile

# aplicar patch wouter por si acaso
RUN patch -d node_modules/wouter -p1 < patches/wouter@3.7.1.patch || echo "Patch failed or already applied?"

FROM deps AS build
COPY . .

ARG VITE_OAUTH_PORTAL_URL
ARG VITE_APP_ID
ARG VITE_DEV_BYPASS_AUTH
ARG VITE_ANALYTICS_ENDPOINT
ARG VITE_ANALYTICS_WEBSITE_ID

ENV VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL
ENV VITE_APP_ID=$VITE_APP_ID
ENV VITE_DEV_BYPASS_AUTH=$VITE_DEV_BYPASS_AUTH
ENV VITE_ANALYTICS_ENDPOINT=$VITE_ANALYTICS_ENDPOINT
ENV VITE_ANALYTICS_WEBSITE_ID=$VITE_ANALYTICS_WEBSITE_ID
ENV NODE_OPTIONS="--max-old-space-size=4096"

# build frontend + bundles server
RUN pnpm exec vite build --logLevel error
RUN pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js
RUN pnpm exec esbuild server/scripts/migrate.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/migrate.js

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/drizzle/schema.ts ./drizzle/schema.ts

COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
