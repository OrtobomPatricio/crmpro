# syntax=docker/dockerfile:1

FROM node:20-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
# Install dependencies including dev dependencies (needed for build)
RUN apt-get update && apt-get install -y --no-install-recommends patch && rm -rf /var/lib/apt/lists/*
RUN pnpm install --frozen-lockfile
# Apply patches if any
RUN patch -d node_modules/wouter -p1 < patches/wouter@3.7.1.patch || echo "Patch applied or unnecessary"

FROM deps AS build
COPY . .

# Build arguments mapped to env for build process
ARG VITE_OAUTH_PORTAL_URL
ARG VITE_APP_ID
ARG VITE_DEV_BYPASS_AUTH
ARG VITE_ANALYTICS_ENDPOINT
ARG VITE_ANALYTICS_WEBSITE_ID

ENV VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL \
    VITE_APP_ID=$VITE_APP_ID \
    VITE_DEV_BYPASS_AUTH=$VITE_DEV_BYPASS_AUTH \
    VITE_ANALYTICS_ENDPOINT=$VITE_ANALYTICS_ENDPOINT \
    VITE_ANALYTICS_WEBSITE_ID=$VITE_ANALYTICS_WEBSITE_ID \
    NODE_OPTIONS="--max-old-space-size=4096" \
    NODE_ENV=production

# Build Client & Server
RUN pnpm exec vite build --logLevel error
RUN pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js
RUN pnpm exec esbuild server/scripts/migrate.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/migrate.js

# Prune for production
RUN pnpm prune --prod

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Copy necessary files from build
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Drizzle migration files (SQL) are required at runtime
COPY --from=build /app/drizzle ./drizzle
# Schema might be needed if using drizzle-kit at runtime, but usually not for compiled migrate.js. Keeping just in case.
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/drizzle/schema.ts ./drizzle/

COPY deploy/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
