# syntax=docker/dockerfile:1

# standard node image (Debian Bookworm) includes common tools (git, ca-certs, etc.)
FROM node:20 AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json ./
# Note: patching requires the patch file, but we'll try fresh install without lockfile first.
# If patches fail, we might need to be careful.
# But pnpm patch relies on 'patchedDependencies' in package.json.
COPY patches ./patches

# FORCE FRESH INSTALL to ensure Linux binaries for esbuild/vite are downloaded
RUN rm -f pnpm-lock.yaml
RUN corepack prepare pnpm@10.4.1 --activate
RUN pnpm install --reporter=verbose

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

# Split build command for better debugging with verbose flags
# We redirect stderr to stdout to ensure we see errors
RUN pnpm exec vite build --logLevel error
RUN pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js
RUN pnpm exec esbuild server/scripts/migrate.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/migrate.js

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# pnpm for runtime commands (migrations)
RUN corepack prepare pnpm@10.4.1 --activate

COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
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
