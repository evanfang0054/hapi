# Multi-stage build: build inside Docker, no local toolchain required
# Usage: docker compose up -d --build
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy everything (respects .dockerignore)
COPY . .

# Remove lockfile to avoid version mismatch with Docker bun version
# Replace embeddedAssets.generated.ts with empty stub (only needed for single-exe builds)
RUN rm -f bun.lock && \
    echo 'export const embeddedAssets: never[] = [];' > hub/src/web/embeddedAssets.generated.ts && \
    bun install

# Build web frontend and hub backend
RUN bun run build:web && bun run build:hub

# Stage 2: Runtime
FROM oven/bun:1-slim

WORKDIR /app/hub

COPY --from=builder /app/hub/package.json ./
COPY --from=builder /app/hub/dist/ dist/
COPY --from=builder /app/hub/node_modules/ node_modules/
COPY --from=builder /app/shared/ ../shared/
COPY --from=builder /app/web/dist/ ../web/dist/

ENV HAPI_HOME=/data
ENV HAPI_LISTEN_HOST=0.0.0.0
ENV HAPI_LISTEN_PORT=3006

EXPOSE 3006
VOLUME ["/data"]

CMD ["bun", "run", "dist/index.js"]
