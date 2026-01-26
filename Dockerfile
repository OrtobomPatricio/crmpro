# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# Needed for pnpm patch-package (fixes wouter)
COPY patches ./patches
RUN corepack prepare pnpm@10.4.1 --activate \
  # NOTE: local-friendly install. For strict CI builds you can switch to --frozen-lockfile
  && pnpm install --no-frozen-lockfile

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

RUN pnpm build

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
