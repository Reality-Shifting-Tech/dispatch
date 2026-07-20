# syntax=docker/dockerfile:1
# All-in-one image: builds the monorepo, then runs the API, the worker, and a
# static file server for the web bundle. Split into per-service images once
# deployment topology matters (post-M0).

FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /repo ./
COPY docker/start.mjs ./docker/start.mjs
EXPOSE 3000 8080
CMD ["node", "docker/start.mjs"]
