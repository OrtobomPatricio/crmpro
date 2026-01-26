# syntax=docker/dockerfile:1

# standard node image (Debian Bookworm) includes common tools (git, ca-certs, etc.)
FROM node:20 AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
# Copy patches separately
COPY patches ./patches

# Install patch utility and use NPM instead of PNPM
RUN apt-get update && apt-get install -y patch

# 1. Install dependencies with npm
# 2. Manually apply wouter patch (since npm doesn't support patchedDependencies)
RUN npm install && \
    patch -d node_modules/wouter -p1 < patches/wouter@3.7.1.patch || echo "Patch failed or already applied?"

FROM deps AS build
COPY . .

# Pass build-time variables for the frontend
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

# Verify vite binary exists
RUN ls -la node_modules/.bin/vite || echo "Vite binary missing!"

# Build using NPM/NPX
RUN npm run build -- --logLevel error || npx vite build --logLevel error
RUN npx esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js
RUN npx esbuild server/scripts/migrate.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/migrate.js

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary files
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/drizzle/schema.ts ./drizzle/schema.ts

# Simple entrypoint: runs migrations then starts server
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
